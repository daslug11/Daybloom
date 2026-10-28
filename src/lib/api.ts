import type { AtlasAction } from './types';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Calls one of our /api endpoints with the user's session. */
export async function apiFetch<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach Daybloom right now. Check your connection.", 0);
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new ApiError('The server sent an unexpected response.', res.status);
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status}).`, res.status, data);
  return data as T;
}

export interface AiStatus {
  enabled: boolean;
  remaining: number;
  limit: number;
  paused: boolean;
  reason?: string;
  message?: string;
  /** True for ADMIN_EMAIL — shows the /admin link in Settings. */
  admin?: boolean;
}

export interface AiResponse<T> {
  result: T;
  remaining: number | null;
  cached: boolean;
}

export type AtlasEvent =
  | { t: 'text'; v: string }
  | ({ t: 'action' } & AtlasAction)
  | { t: 'confirm'; id: string; summary: string }
  | { t: 'done'; remaining: number }
  | { t: 'error'; message: string };

/** Streams an Atlas reply as events (NDJSON). */
export async function* atlasStream(message: string, mode: 'chat' | 'voice', signal?: AbortSignal): AsyncGenerator<AtlasEvent> {
  let res: Response;
  try {
    res = await fetch('/api/atlas', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ action: 'chat', message, mode }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    throw new ApiError("Can't reach Atlas right now. Check your connection.", 0);
  }
  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith('application/json')) {
    const data = await res.json();
    throw new ApiError(data.error ?? 'Atlas is unavailable.', res.status, data);
  }
  if (!res.ok || !res.body) throw new ApiError('Atlas is unavailable.', res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) yield JSON.parse(line) as AtlasEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AtlasEvent;
}
