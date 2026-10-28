import { requireUser } from '../auth.js';
import { handle, HttpError, json, methodNotAllowed, readJson } from '../http.js';
import { FEATURES, type FeatureName } from './features.js';
import { aiStatus } from './limits.js';

/**
 * GET  /api/ai            → { enabled, remaining, limit, paused, message? }
 * POST /api/ai {feature, ...input} → { result, remaining, cached }
 * AI only ever runs here because the user pressed a ✨ button.
 */
export const handleAiRequest = handle(async (req) => {
  const auth = await requireUser(req);
  if (req.method === 'GET') return json(await aiStatus(auth));
  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const body = await readJson<Record<string, unknown>>(req);
  const feature = body.feature as FeatureName;
  if (typeof feature !== 'string' || !Object.hasOwn(FEATURES, feature)) throw new HttpError(400, 'Unknown AI feature.');
  const out = await FEATURES[feature](auth, body);
  return json(out);
});
