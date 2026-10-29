import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { expandSeries, groupSessions, planEndDate, planOccurrences, type Occurrence } from '../../../server/data/recurrence';
import { addDays, dayIn } from '../../lib/dates';
import { supabase } from '../../lib/supabase';
import type { BlockSeries, OccurrenceRow, Plan, PlanSession } from '../../lib/types';
import { useUserId } from '../useAuth';
import { useTimeZone } from '../useProfile';
import { must } from './cache';

export const plansKey = (uid: string) => ['plans', uid];
export const seriesKey = (uid: string) => ['block_series', uid];
export const occurrencesKey = (uid: string) => ['series_occurrences', uid];

const SERIES_COLUMNS = 'id, plan_id, title, details, days, start_min, duration_min, start_date, end_date';
const OCCURRENCE_COLUMNS = 'series_id, day, done_at, skipped, start_min, duration_min, title, details';

export function usePlans() {
  const uid = useUserId();
  return useQuery({
    queryKey: plansKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('plans').select('*').order('created_at', { ascending: false }).limit(200)) as Plan[],
  });
}

export function useSeries() {
  const uid = useUserId();
  return useQuery({
    queryKey: seriesKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('block_series').select(SERIES_COLUMNS).order('start_date').limit(500)) as BlockSeries[],
  });
}

export function useOccurrenceRows() {
  const uid = useUserId();
  return useQuery({
    queryKey: occurrencesKey(uid),
    enabled: !!uid,
    queryFn: async () => must(await supabase.from('series_occurrences').select(OCCURRENCE_COLUMNS).limit(10_000)) as OccurrenceRow[],
  });
}

/** Recurring-block sessions between two days for the Planner and dashboard. A paused plan's sessions are hidden from the day it was paused. */
export function useRecurring(from: string, to: string) {
  const tz = useTimeZone();
  const { data: plans = [] } = usePlans();
  const { data: series = [] } = useSeries();
  const { data: rows = [] } = useOccurrenceRows();
  return useMemo(() => {
    const pausedFrom = new Map(plans.filter((p) => p.status === 'paused').map((p) => [p.id, p.paused_at ? dayIn(tz, new Date(p.paused_at)) : from]));
    return expandSeries(series, rows, from, to).filter((o) => !(o.plan_id && pausedFrom.has(o.plan_id) && o.day >= pausedFrom.get(o.plan_id)!));
  }, [plans, series, rows, from, to, tz]);
}

export type Decision = { action: 'keep' | 'skip' } | { action: 'shift'; start: number };

export interface AddPlanInput {
  plan: Plan;
  sessions: PlanSession[];
  startDate: string;
  weeks: number;
  /** Keyed by `${day}:${sessionIndex}` (see planOccurrences). */
  decisions: Record<string, Decision>;
  habit: boolean;
  goalTitle: string | null;
}

export interface AddedPlan {
  planId: string;
  seriesIds: string[];
  habitId: string | null;
  goalId: string | null;
  sessions: number;
}

/** Plan and recurring-block writes. None of these use AI. */
export function usePlanActions() {
  const qc = useQueryClient();
  const uid = useUserId();
  const tz = useTimeZone();
  const refresh = () =>
    Promise.all(
      [plansKey(uid), seriesKey(uid), occurrencesKey(uid), ['habits', uid], ['habit_logs', uid], ['goals', uid]].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
  const today = () => dayIn(tz);

  async function undoAdd(added: AddedPlan) {
    if (added.seriesIds.length) must(await supabase.from('block_series').delete().in('id', added.seriesIds).select('id'));
    must(await supabase.from('plans').update({ status: 'draft', added_at: null, habit_id: null, goal_id: null }).eq('id', added.planId).select('id'));
    if (added.habitId) await supabase.from('habits').delete().eq('id', added.habitId);
    if (added.goalId) await supabase.from('goals').delete().eq('id', added.goalId);
    await refresh();
  }

  async function addToPlanner(input: AddPlanInput): Promise<AddedPlan> {
    const { plan, sessions, startDate, weeks, decisions } = input;
    const endDate = planEndDate(startDate, weeks);
    const added: AddedPlan = { planId: plan.id, seriesIds: [], habitId: null, goalId: null, sessions: 0 };
    try {
      // One weekly series per distinct session; same time and content on several days share a series.
      const groups = groupSessions(sessions);
      const groupOf = sessions.map((s) => groups.findIndex((g) => g.start === s.start && g.duration === s.duration && g.title === s.title && g.details === s.details));
      for (const g of groups) {
        const row = must(
          await supabase
            .from('block_series')
            .insert({ plan_id: plan.id, title: g.title, details: g.details, days: g.days, start_min: g.start, duration_min: g.duration, start_date: startDate, end_date: endDate })
            .select('id')
            .single(),
        ) as { id: string };
        added.seriesIds.push(row.id);
      }
      const occurrences = planOccurrences(sessions, startDate, weeks);
      const exceptions: { series_id: string; day: string; skipped: boolean; start_min: number | null }[] = [];
      for (const o of occurrences) {
        const d = decisions[`${o.day}:${o.session}`];
        const series_id = added.seriesIds[groupOf[o.session]];
        if (d?.action === 'skip') exceptions.push({ series_id, day: o.day, skipped: true, start_min: null });
        if (d?.action === 'shift') exceptions.push({ series_id, day: o.day, skipped: false, start_min: d.start });
      }
      if (exceptions.length) must(await supabase.from('series_occurrences').insert(exceptions).select('day'));
      added.sessions = occurrences.length - exceptions.filter((e) => e.skipped).length;

      if (input.habit) {
        const h = must(await supabase.from('habits').insert({ name: plan.title.slice(0, 120), emoji: '🗓️' }).select('id').single()) as { id: string };
        added.habitId = h.id;
      }
      if (input.goalTitle?.trim()) {
        const g = must(
          await supabase.from('goals').insert({ title: input.goalTitle.trim().slice(0, 200), emoji: '🎯', target: Math.max(1, added.sessions), current: 0, unit: 'sessions', due_date: endDate }).select('id').single(),
        ) as { id: string };
        added.goalId = g.id;
      }
      must(
        await supabase
          .from('plans')
          .update({ status: 'active', sessions, start_date: startDate, weeks, added_at: new Date().toISOString(), paused_at: null, habit_id: added.habitId, goal_id: added.goalId })
          .eq('id', plan.id)
          .select('id'),
      );
    } catch (err) {
      await undoAdd(added).catch(() => {});
      throw err;
    }
    await refresh();
    return added;
  }

  /** Check a session off (or back on). Also logs the linked habit and moves the linked goal. */
  async function setDone(o: Occurrence, done: boolean, plan?: Plan) {
    must(
      await supabase
        .from('series_occurrences')
        .upsert({ series_id: o.series_id, day: o.day, done_at: done ? new Date().toISOString() : null }, { onConflict: 'series_id,day' })
        .select('day'),
    );
    if (plan?.habit_id && o.day <= today()) {
      if (done) await supabase.from('habit_logs').upsert({ habit_id: plan.habit_id, day: o.day }, { onConflict: 'habit_id,day', ignoreDuplicates: true });
      else await supabase.from('habit_logs').delete().eq('habit_id', plan.habit_id).eq('day', o.day);
    }
    if (plan?.goal_id) {
      const { data: goal } = await supabase.from('goals').select('current, target, completed_at').eq('id', plan.goal_id).maybeSingle();
      if (goal) {
        const current = Math.max(0, Number(goal.current) + (done ? 1 : -1));
        const reached = current >= Number(goal.target);
        await supabase.from('goals').update({ current, completed_at: reached ? goal.completed_at ?? new Date().toISOString() : null }).eq('id', plan.goal_id);
      }
    }
    await refresh();
  }

  return {
    refresh,
    addToPlanner,
    undoAdd,
    setDone,

    async saveDraft(id: string, patch: Partial<Pick<Plan, 'title' | 'sessions' | 'weeks' | 'start_date'>>) {
      must(await supabase.from('plans').update(patch).eq('id', id).eq('status', 'draft').select('id'));
      await refresh();
    },

    async setStatus(plan: Plan, status: 'draft' | 'dismissed' | 'active' | 'paused') {
      const patch = status === 'paused' ? { status, paused_at: new Date().toISOString() } : status === 'active' ? { status, paused_at: null } : { status };
      must(await supabase.from('plans').update(patch).eq('id', plan.id).select('id'));
      await refresh();
    },

    /** Remove a plan. With `deleteFuture`, its blocks from today on are deleted too; past sessions stay as history. */
    async removePlan(plan: Plan, deleteFuture: boolean) {
      if (deleteFuture) {
        const t = today();
        const series = must(await supabase.from('block_series').select('id, start_date').eq('plan_id', plan.id)) as { id: string; start_date: string }[];
        const future = series.filter((s) => s.start_date >= t).map((s) => s.id);
        const ongoing = series.filter((s) => s.start_date < t).map((s) => s.id);
        if (future.length) must(await supabase.from('block_series').delete().in('id', future).select('id'));
        if (ongoing.length) {
          must(await supabase.from('block_series').update({ end_date: addDays(t, -1) }).in('id', ongoing).select('id'));
          await supabase.from('series_occurrences').delete().in('series_id', ongoing).gte('day', t);
        }
      }
      must(await supabase.from('plans').delete().eq('id', plan.id).select('id'));
      await refresh();
    },

    /** "This one only": change or skip a single session. */
    async editOccurrence(o: Occurrence, patch: { start_min?: number; duration_min?: number; title?: string; details?: string; skipped?: boolean }) {
      must(await supabase.from('series_occurrences').upsert({ series_id: o.series_id, day: o.day, ...patch }, { onConflict: 'series_id,day' }).select('day'));
      await refresh();
    },

    /** "All in this plan": change every session of the recurring block. */
    async editSeries(seriesId: string, patch: Partial<Pick<BlockSeries, 'title' | 'details' | 'start_min' | 'duration_min' | 'days' | 'end_date'>>) {
      must(await supabase.from('block_series').update(patch).eq('id', seriesId).select('id'));
      await refresh();
    },

    async deleteSeries(seriesId: string) {
      must(await supabase.from('block_series').delete().eq('id', seriesId).select('id'));
      await refresh();
    },

    async createSeries(row: Omit<BlockSeries, 'id' | 'plan_id'>) {
      const created = must(await supabase.from('block_series').insert(row).select('id').single()) as { id: string };
      await refresh();
      return created.id;
    },
  };
}
