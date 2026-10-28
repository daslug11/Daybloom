import type { SupabaseClient, User } from '@supabase/supabase-js';
import { env } from './env.js';
import { HttpError } from './http.js';
import { serviceClient, userClient } from './supabase.js';

export interface AuthedRequest {
  user: User;
  /** Queries run as this user (RLS enforced). */
  db: SupabaseClient;
  email: string;
}

/** Verifies the `Authorization: Bearer <access token>` header with Supabase Auth. */
export async function requireUser(req: Request): Promise<AuthedRequest> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Please log in again.');
  const { data, error } = await serviceClient().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired. Please log in again.');
  return { user: data.user, db: userClient(token), email: (data.user.email ?? '').toLowerCase() };
}

export async function requireAdmin(req: Request): Promise<AuthedRequest> {
  const auth = await requireUser(req);
  const admin = env.adminEmail;
  if (!admin || auth.email !== admin || !auth.user.email_confirmed_at) {
    throw new HttpError(403, 'Admins only.');
  }
  return auth;
}
