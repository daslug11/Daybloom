import { requireAdmin } from './auth.js';
import { env } from './env.js';
import { handle, HttpError, json, methodNotAllowed, readJson } from './http.js';
import { serviceClient } from './supabase.js';

/**
 * GET  /api/admin → usage overview + current limits (ADMIN_EMAIL only)
 * POST /api/admin {action:'find_user', email} | {action:'set_override', user_id, daily_limit|null, blocked}
 */
export const handleAdminRequest = handle(async (req) => {
  await requireAdmin(req);
  const svc = serviceClient();
  if (req.method === 'GET') {
    const { data, error } = await svc.rpc('admin_overview', { p_days: 30 });
    if (error) throw new HttpError(500, 'Could not load usage.');
    return json({
      ...data,
      config: {
        daily_limit_per_user: env.dailyAiLimit,
        daily_spend_cap_usd: env.dailySpendCap,
        monthly_spend_cap_usd: env.monthlySpendCap,
        allowed_emails: env.allowedEmails?.length ?? null,
      },
    });
  }
  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const body = await readJson<{ action?: string; email?: string; user_id?: string; daily_limit?: number | null; blocked?: boolean }>(req);
  if (body.action === 'find_user') {
    if (!body.email) throw new HttpError(400, 'Enter an email.');
    const { data } = await svc.rpc('admin_find_user', { p_email: body.email.trim() });
    if (!data) throw new HttpError(404, 'No user with that email.');
    return json(data);
  }
  if (body.action === 'set_override') {
    if (!body.user_id) throw new HttpError(400, 'Missing user.');
    const limit = body.daily_limit == null ? null : Math.floor(Number(body.daily_limit));
    if (limit != null && (!Number.isFinite(limit) || limit < 0 || limit > 10000)) throw new HttpError(400, 'Daily limit must be 0–10000, or empty for the default.');
    const { error } = await svc.rpc('admin_set_override', { p_user: body.user_id, p_daily_limit: limit, p_blocked: !!body.blocked });
    if (error) throw new HttpError(500, 'Could not save.');
    return json({ ok: true });
  }
  throw new HttpError(400, 'Unknown admin action.');
});
