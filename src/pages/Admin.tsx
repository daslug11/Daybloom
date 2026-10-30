import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/layout/Logo';
import { Card, CardTitle } from '../components/ui/Card';
import { ErrorState, Spinner } from '../components/ui/States';
import { useToast } from '../hooks/useToast';
import { apiFetch, ApiError } from '../lib/api';
import { cn } from '../lib/utils';
import { useDocumentTitle } from './public/useDocumentTitle';

interface Overview {
  total_users: number;
  new_users_7d: number;
  today: { requests: number; cost_usd: number };
  month: { requests: number; cost_usd: number };
  daily: { day: string; requests: number; cost_usd: number }[];
  top_users: { user_id: string; email: string; name: string | null; requests_today: number; requests_month: number; cost_usd: number; daily_limit: number | null; blocked: boolean }[];
  config: { daily_limit_per_user: number; daily_spend_cap_usd: number; monthly_spend_cap_usd: number; allowed_emails: number | null };
}
interface FoundUser {
  user_id: string;
  email: string;
  name: string | null;
  daily_limit: number | null;
  blocked: boolean;
}

/** Dollars at 2 decimals; 4 only for non-zero amounts under a cent, so tiny costs don't read as $0.00. */
const usd = (n: number) => {
  const v = Number(n) || 0;
  return `$${v.toFixed(v !== 0 && Math.abs(v) < 0.01 ? 4 : 2)}`;
};
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

function LimitLabel({ limit, blocked, fallback }: { limit: number | null; blocked: boolean; fallback: number }) {
  if (blocked) return <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Blocked</span>;
  return <span className="tabular-nums">{limit ?? `${fallback} (default)`}</span>;
}

/** Spend against a cap: the figure, a percentage and a thin meter (amber from 80%, red at the cap). */
function SpendTile({ label, spent, cap, sub }: { label: string; spent: number; cap: number; sub: string }) {
  const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
  return (
    <Card className="!p-4">
      <p className="muted text-xs font-medium">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {usd(spent)} <span className="muted text-sm font-medium">of {usd(cap)}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-ink/70')} style={{ width: `${pct}%` }} />
      </div>
      <p className="muted mt-1.5 text-xs tabular-nums">
        {pct}% of the cap · {sub}
      </p>
    </Card>
  );
}

function UserControls({ user, defaultLimit, onSaved, onCancel }: { user: FoundUser; defaultLimit: number; onSaved: () => void; onCancel: () => void }) {
  const [limit, setLimit] = useState(user.daily_limit == null ? '' : String(user.daily_limit));
  const [blocked, setBlocked] = useState(user.blocked);
  const toast = useToast();
  const id = useId();
  const save = useMutation({
    mutationFn: () => apiFetch('/api/admin', { action: 'set_override', user_id: user.user_id, daily_limit: limit === '' ? null : Number(limit), blocked }),
    onSuccess: () => {
      toast(`Saved for ${user.email}`);
      onSaved();
    },
  });
  const error = save.error ? errorText(save.error, 'Could not save.') : '';
  return (
    <form
      className="space-y-3"
      aria-label={`Editing ${user.email}`}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-sm font-medium">
        Editing <span className="break-all">{user.name ? `${user.name} · ${user.email}` : user.email}</span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="label">Daily AI limit</span>
          <input
            autoFocus
            className="input w-40"
            type="number"
            min={0}
            max={10000}
            placeholder={`Default (${defaultLimit})`}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </label>
        <div className="pb-1">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} className="h-4 w-4 accent-ink" aria-describedby={`${id}-block`} /> Block AI
          </label>
          <p id={`${id}-block`} className="muted text-xs">
            They keep using Daybloom; ✨ buttons and Atlas are off.
          </p>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={save.isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Usage, spend and per-user limits. The API only answers for ADMIN_EMAIL. */
export default function Admin() {
  useDocumentTitle('Admin · Daybloom');
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['admin'], queryFn: () => apiFetch<Overview>('/api/admin'), retry: false });
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<FoundUser | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const find = useMutation({
    mutationFn: () => apiFetch<FoundUser>('/api/admin', { action: 'find_user', email }),
    onMutate: () => setFound(null),
    onSuccess: setFound,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  // Closing the inline editor hands focus back to the row's Edit button.
  const closeEditor = () => {
    const id = editing;
    setEditing(null);
    requestAnimationFrame(() => document.getElementById(`edit-${id}`)?.focus());
  };
  const findError = find.error ? errorText(find.error, 'Lookup failed.') : '';

  const forbidden = overview.error instanceof ApiError && overview.error.status === 403;
  const d = overview.data;
  const resting = d && (d.month.cost_usd >= d.config.monthly_spend_cap_usd ? 'monthly' : d.today.cost_usd >= d.config.daily_spend_cap_usd ? 'daily' : null);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <Link to="/app" className="btn-ghost">
          <ArrowLeft size={14} /> Back to app
        </Link>
      </header>
      <main id="main">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
        <p className="muted text-sm">AI usage and spend across all users. Costs are estimates from token counts at the model’s list price.</p>
        {d && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            <span className={cn('h-2 w-2 rounded-full', resting ? 'bg-danger' : 'bg-success')} aria-hidden />
            {resting === 'monthly'
              ? 'AI resting: monthly cap reached. It resumes on the 1st (UTC).'
              : resting === 'daily'
                ? 'AI resting: daily cap reached. It resumes at 00:00 UTC.'
                : 'AI running · allowances and the daily cap reset at 00:00 UTC'}
          </p>
        )}
        <div className="mb-6" />

        {overview.isLoading && <Spinner />}
        {forbidden && <ErrorState message="Admins only — this page is for the account set as ADMIN_EMAIL." />}
        {overview.error && !forbidden && <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />}

        {d && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SpendTile label="Spend today" spent={d.today.cost_usd} cap={d.config.daily_spend_cap_usd} sub={`${d.today.requests} AI requests today`} />
              <SpendTile label="Spend this month" spent={d.month.cost_usd} cap={d.config.monthly_spend_cap_usd} sub={`${d.month.requests} AI requests this month`} />
              {[
                { label: 'Users', value: d.total_users, sub: `+${d.new_users_7d} in 7 days` },
                { label: 'Default daily limit', value: d.config.daily_limit_per_user, sub: d.config.allowed_emails == null ? 'AI open to all users' : `AI limited to ${d.config.allowed_emails} allowed emails` },
              ].map((t) => (
                <Card key={t.label} className="!p-4">
                  <p className="muted text-xs font-medium">{t.label}</p>
                  <p className="mt-1 text-2xl font-extrabold tabular-nums">{t.value}</p>
                  <p className="muted mt-0.5 text-xs">{t.sub}</p>
                </Card>
              ))}
            </div>

            <Card>
              <CardTitle id="find-title">Find a user</CardTitle>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                aria-labelledby="find-title"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) find.mutate();
                }}
              >
                <label className="min-w-0 flex-1">
                  <span className="label">User email (exact match)</span>
                  <input
                    className="input"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!findError || undefined}
                    aria-describedby={findError ? 'find-error' : undefined}
                  />
                </label>
                <button className="btn-ghost shrink-0" disabled={find.isPending}>
                  {find.isPending ? 'Finding…' : 'Find'}
                </button>
              </form>
              {findError && (
                <p id="find-error" role="alert" className="mt-2 text-sm text-danger">
                  {findError}
                </p>
              )}
              {found && (
                <div className="mt-4 rounded-control border border-line p-3">
                  <UserControls
                    key={found.user_id}
                    user={found}
                    defaultLimit={d.config.daily_limit_per_user}
                    onSaved={() => {
                      setFound(null);
                      refresh();
                    }}
                    onCancel={() => setFound(null)}
                  />
                </div>
              )}
            </Card>

            <Card>
              <CardTitle>Top 25 by cost this month</CardTitle>
              {d.top_users.length ? (
                <table className="block w-full text-left text-sm sm:table">
                  <thead className="muted hidden text-xs sm:table-header-group">
                    <tr>
                      <th className="py-2 pr-3 font-medium">User</th>
                      <th className="py-2 pr-3 text-right font-medium">Today</th>
                      <th className="py-2 pr-3 text-right font-medium">Month</th>
                      <th className="py-2 pr-3 text-right font-medium">Cost</th>
                      <th className="py-2 pr-3 font-medium">Daily limit</th>
                      <th className="py-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="block sm:table-row-group">
                    {d.top_users.map((u) => {
                      const open = editing === u.user_id;
                      return (
                        <Fragment key={u.user_id}>
                          {/* Phone: a stacked row (who, numbers, limit) with a full-size Edit button. sm+: a table row. */}
                          <tr className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-3 sm:table-row sm:py-0">
                            <td className="min-w-0 sm:max-w-[240px] sm:py-2 sm:pr-3">
                              <div className="truncate" title={u.email}>
                                {u.email}
                              </div>
                              {u.name && <div className="muted truncate text-xs">{u.name}</div>}
                              <div className="muted mt-0.5 text-xs tabular-nums sm:hidden">
                                {u.requests_today} today · {u.requests_month} this month · {usd(u.cost_usd)}
                              </div>
                            </td>
                            <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">{u.requests_today}</td>
                            <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">{u.requests_month}</td>
                            <td className="hidden py-2 pr-3 text-right tabular-nums sm:table-cell">{usd(u.cost_usd)}</td>
                            <td className="col-start-1 row-start-2 text-xs sm:table-cell sm:py-2 sm:pr-3 sm:text-sm">
                              <span className="muted sm:hidden">Daily limit: </span>
                              <LimitLabel limit={u.daily_limit} blocked={u.blocked} fallback={d.config.daily_limit_per_user} />
                            </td>
                            <td className="col-start-2 row-span-2 row-start-1 text-right sm:table-cell sm:py-1">
                              <button
                                className={cn('btn-ghost min-h-[44px] sm:min-h-0 sm:!py-1.5', open && 'bg-raised')}
                                id={`edit-${u.user_id}`}
                                aria-expanded={open}
                                aria-label={`Edit ${u.email}`}
                                onClick={() => setEditing(open ? null : u.user_id)}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                          {open && (
                            <tr className="block sm:table-row">
                              <td colSpan={6} className="block pb-4 sm:table-cell">
                                <div className="rounded-control border border-line bg-raised p-3">
                                  <UserControls
                                    user={{ user_id: u.user_id, email: u.email, name: u.name, daily_limit: u.daily_limit, blocked: u.blocked }}
                                    defaultLimit={d.config.daily_limit_per_user}
                                    onSaved={() => {
                                      closeEditor();
                                      refresh();
                                    }}
                                    onCancel={closeEditor}
                                  />
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="muted text-sm">No AI usage this month yet.</p>
              )}
            </Card>

            <Card>
              <CardTitle>Last 30 days</CardTitle>
              {d.daily.length ? (
                <ul className="space-y-1 text-sm">
                  {[...d.daily].reverse().map((r) => (
                    <li key={r.day} className="flex justify-between gap-2 tabular-nums">
                      <span>{r.day}</span>
                      <span className="muted">
                        {r.requests} requests · {usd(r.cost_usd)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted text-sm">No usage yet.</p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
