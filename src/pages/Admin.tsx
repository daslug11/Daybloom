import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/layout/Logo';
import { Card, CardTitle } from '../components/ui/Card';
import { ErrorState, Spinner } from '../components/ui/States';
import { useToast } from '../hooks/useToast';
import { apiFetch, ApiError } from '../lib/api';

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

const usd = (n: number) => `$${Number(n).toFixed(Number(n) < 1 ? 4 : 2)}`;

function UserControls({ user, defaultLimit, onSaved }: { user: FoundUser; defaultLimit: number; onSaved: () => void }) {
  const [limit, setLimit] = useState(user.daily_limit == null ? '' : String(user.daily_limit));
  const [blocked, setBlocked] = useState(user.blocked);
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => apiFetch('/api/admin', { action: 'set_override', user_id: user.user_id, daily_limit: limit === '' ? null : Number(limit), blocked }),
    onSuccess: () => {
      toast(`Saved for ${user.email}`);
      onSaved();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not save.'),
  });
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label>
        <span className="label">Daily AI limit</span>
        <input className="input w-36" type="number" min={0} max={10000} placeholder={`Default (${defaultLimit})`} value={limit} onChange={(e) => setLimit(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} /> Block AI
      </label>
      <button className="btn-primary !py-2" disabled={save.isPending}>
        Save
      </button>
    </form>
  );
}

/** Usage, spend and per-user limits. The API only answers for ADMIN_EMAIL. */
export default function Admin() {
  const qc = useQueryClient();
  const toast = useToast();
  const overview = useQuery({ queryKey: ['admin'], queryFn: () => apiFetch<Overview>('/api/admin'), retry: false });
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<FoundUser | null>(null);
  const find = useMutation({
    mutationFn: () => apiFetch<FoundUser>('/api/admin', { action: 'find_user', email }),
    onSuccess: setFound,
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Lookup failed.'),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const forbidden = overview.error instanceof ApiError && overview.error.status === 403;
  const d = overview.data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Logo />
        <Link to="/app" className="btn-ghost">
          <ArrowLeft size={14} /> Back to app
        </Link>
      </header>
      <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
      <p className="muted mb-6 text-sm">AI usage and spend across all users. Costs are estimates from token counts at the model’s list price.</p>

      {overview.isLoading && <Spinner />}
      {forbidden && <ErrorState message="Admins only — this page is for the account set as ADMIN_EMAIL." />}
      {overview.error && !forbidden && <ErrorState message={(overview.error as Error).message} onRetry={() => overview.refetch()} />}

      {d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Users', value: d.total_users, sub: `+${d.new_users_7d} in 7 days` },
              { label: 'AI requests today', value: d.today.requests, sub: `${usd(d.today.cost_usd)} of ${usd(d.config.daily_spend_cap_usd)} daily cap` },
              { label: 'AI requests this month', value: d.month.requests, sub: `${usd(d.month.cost_usd)} of ${usd(d.config.monthly_spend_cap_usd)} monthly cap` },
              { label: 'Default daily limit', value: d.config.daily_limit_per_user, sub: d.config.allowed_emails == null ? 'AI open to all users' : `AI limited to ${d.config.allowed_emails} allowed emails` },
            ].map((t) => (
              <Card key={t.label} className="!p-4">
                <p className="muted text-xs font-semibold uppercase tracking-wider">{t.label}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{t.value}</p>
                <p className="faint mt-0.5 text-xs">{t.sub}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardTitle>Find a user</CardTitle>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) find.mutate();
              }}
            >
              <input className="input" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="User email" />
              <button className="btn-ghost shrink-0" disabled={find.isPending}>
                Find
              </button>
            </form>
            {found && (
              <div className="mt-4 rounded-xl border border-slate-900/10 p-3 dark:border-white/10">
                <p className="mb-2 text-sm font-medium">
                  {found.name || '—'} · {found.email}
                </p>
                <UserControls key={found.user_id} user={found} defaultLimit={d.config.daily_limit_per_user} onSaved={refresh} />
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Top users this month</CardTitle>
            {d.top_users.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="faint text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-3">User</th>
                      <th className="py-2 pr-3 text-right">Today</th>
                      <th className="py-2 pr-3 text-right">Month</th>
                      <th className="py-2 pr-3 text-right">Cost</th>
                      <th className="py-2 pr-3">Limit</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {d.top_users.map((u) => (
                      <tr key={u.user_id} className="border-t border-slate-900/5 dark:border-white/5">
                        <td className="max-w-[220px] truncate py-2 pr-3">{u.email}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{u.requests_today}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{u.requests_month}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{usd(u.cost_usd)}</td>
                        <td className="py-2 pr-3">{u.blocked ? <span className="text-rose-600">Blocked</span> : u.daily_limit ?? 'Default'}</td>
                        <td className="py-2 text-right">
                          <button className="link text-xs" onClick={() => setFound({ user_id: u.user_id, email: u.email, name: u.name, daily_limit: u.daily_limit, blocked: u.blocked })}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
    </div>
  );
}
