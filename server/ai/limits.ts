import type { AuthedRequest } from '../auth.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { serviceClient } from '../supabase.js';
import { estimateCost, RATE_LIMIT_PER_MINUTE, type TokenUsage } from './config.js';

export interface AiTicket {
  requestId: number;
  remaining: number;
  limit: number;
}

const MESSAGES: Record<string, string> = {
  blocked: 'AI features are turned off for your account. Contact support if you think this is a mistake.',
  not_allowed: "AI features aren't enabled for your account yet.",
  paused_daily: 'AI is resting until tomorrow 🌙',
  paused_monthly: 'AI is resting until next month 🌙',
  daily_limit: "You've used today's ✨ AI allowance. It resets at midnight UTC.",
  no_key: 'AI is not configured on this server yet.',
};

/** True if this user may use AI at all (ALLOWED_EMAILS allow-list). */
export function emailAllowed(email: string) {
  const list = env.allowedEmails;
  return !list || list.includes(email.toLowerCase());
}

/**
 * Checks every limit atomically in the database and reserves one request.
 * Throws a 429/403/503 HttpError with a friendly message when AI can't run.
 */
export async function beginAi(auth: AuthedRequest, feature: string): Promise<AiTicket> {
  if (!env.anthropicKeyPresent) throw new HttpError(503, MESSAGES.no_key, { reason: 'no_key' });
  if (!emailAllowed(auth.email)) throw new HttpError(403, MESSAGES.not_allowed, { reason: 'not_allowed' });
  const { data, error } = await serviceClient().rpc('ai_begin', {
    p_user: auth.user.id,
    p_feature: feature,
    p_default_limit: env.dailyAiLimit,
    p_daily_cap: env.dailySpendCap,
    p_monthly_cap: env.monthlySpendCap,
    p_per_minute: RATE_LIMIT_PER_MINUTE,
  });
  if (error) {
    console.error('[ai_begin]', error);
    throw new HttpError(500, 'Could not check your AI allowance. Please try again.');
  }
  if (!data.ok) {
    const reason = data.reason as string;
    if (reason === 'rate_limited') {
      throw new HttpError(429, `Easy there — try again in ${data.retry_after}s.`, { reason, retryAfter: data.retry_after });
    }
    const status = reason === 'blocked' ? 403 : reason.startsWith('paused') ? 503 : 429;
    throw new HttpError(status, MESSAGES[reason] ?? 'AI is unavailable right now.', { reason, remaining: data.remaining ?? 0 });
  }
  return { requestId: data.request_id, remaining: data.remaining, limit: data.limit };
}

/** Records tokens and cost. When `ok` is false the user's request is refunded. */
export async function finishAi(ticket: AiTicket, usage: TokenUsage, ok: boolean) {
  const { error } = await serviceClient().rpc('ai_finish', {
    p_request_id: ticket.requestId,
    p_input: usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    p_output: usage.output_tokens,
    p_cost: estimateCost(usage),
    p_ok: ok,
  });
  if (error) console.error('[ai_finish]', error);
}

export interface AiStatus {
  enabled: boolean;
  remaining: number;
  limit: number;
  paused: boolean;
  reason?: string;
  message?: string;
}

export async function aiStatus(auth: AuthedRequest): Promise<AiStatus> {
  if (!env.anthropicKeyPresent) return { enabled: false, remaining: 0, limit: 0, paused: false, reason: 'no_key', message: MESSAGES.no_key };
  if (!emailAllowed(auth.email)) {
    return { enabled: false, remaining: 0, limit: 0, paused: false, reason: 'not_allowed', message: MESSAGES.not_allowed };
  }
  const { data, error } = await serviceClient().rpc('ai_status', {
    p_user: auth.user.id,
    p_default_limit: env.dailyAiLimit,
    p_daily_cap: env.dailySpendCap,
    p_monthly_cap: env.monthlySpendCap,
  });
  if (error) throw new HttpError(500, 'Could not load your AI allowance.');
  if (data.blocked) return { enabled: false, remaining: 0, limit: data.limit, paused: false, reason: 'blocked', message: MESSAGES.blocked };
  if (data.paused) return { enabled: false, remaining: data.remaining, limit: data.limit, paused: true, reason: 'paused', message: MESSAGES.paused_daily };
  return { enabled: true, remaining: data.remaining, limit: data.limit, paused: false };
}
