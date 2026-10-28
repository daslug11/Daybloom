import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import type { AuthedRequest } from '../auth.js';
import { HttpError } from '../http.js';
import { serviceClient } from '../supabase.js';
import { anthropic } from './client.js';
import { EFFORT, MAX_TOKENS, MODEL, ZERO_USAGE, type TokenUsage } from './config.js';
import { beginAi, finishAi } from './limits.js';

export interface AiResult<T> {
  result: T;
  /** AI requests left today after this one (null when served from cache). */
  remaining: number | null;
  cached: boolean;
}

/** Turns SDK errors into messages a user can act on. */
export function aiErrorToHttp(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof Anthropic.RateLimitError) return new HttpError(503, 'The AI service is busy right now. Please try again in a minute.');
  if (err instanceof Anthropic.AuthenticationError) return new HttpError(503, 'AI is not configured correctly on the server.');
  if (err instanceof Anthropic.APIError) return new HttpError(502, 'The AI service had a problem. Please try again.');
  return new HttpError(500, 'Something went wrong while thinking. Please try again.');
}

/**
 * One structured (JSON) AI call: checks limits, calls the model with a capped
 * max_tokens, records tokens/cost, and refunds the request if it fails.
 */
export async function runStructured<S extends z.ZodType>(
  auth: AuthedRequest,
  feature: string,
  opts: { system: string; prompt: string; schema: S; maxTokens?: number },
): Promise<{ result: z.infer<S>; remaining: number }> {
  const ticket = await beginAi(auth, feature);
  let usage: TokenUsage = ZERO_USAGE;
  try {
    const res = await anthropic().messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? MAX_TOKENS.structured,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
      output_config: { effort: EFFORT, format: zodOutputFormat(opts.schema) },
    });
    usage = res.usage;
    if (res.stop_reason === 'refusal') throw new HttpError(422, "Sorry — I can't help with that one.");
    if (res.stop_reason === 'max_tokens' || res.parsed_output == null) {
      throw new HttpError(502, 'The answer came back incomplete. Please try again.');
    }
    await finishAi(ticket, usage, true);
    return { result: res.parsed_output as z.infer<S>, remaining: ticket.remaining };
  } catch (err) {
    await finishAi(ticket, usage, false);
    if (!(err instanceof HttpError)) console.error(`[ai:${feature}]`, err);
    throw aiErrorToHttp(err);
  }
}

/** Per-user cache in ai_cache. Cached answers don't use the daily allowance. */
export async function cached<T>(
  auth: AuthedRequest,
  feature: string,
  key: string,
  force: boolean,
  produce: () => Promise<{ result: T; remaining: number }>,
): Promise<AiResult<T>> {
  const svc = serviceClient();
  if (!force) {
    const { data } = await svc
      .from('ai_cache')
      .select('result')
      .eq('user_id', auth.user.id)
      .eq('feature', feature)
      .eq('cache_key', key)
      .maybeSingle();
    if (data) return { result: data.result as T, remaining: null, cached: true };
  }
  const { result, remaining } = await produce();
  await svc.from('ai_cache').upsert({ user_id: auth.user.id, feature, cache_key: key, result, created_at: new Date().toISOString() });
  return { result, remaining, cached: false };
}
