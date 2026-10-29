import { requireUser } from '../auth.js';
import { env } from '../env.js';
import { handle, HttpError, json, methodNotAllowed, readJson } from '../http.js';
import { FEATURES, type FeatureName } from './features.js';
import { aiStatus } from './limits.js';

/**
 * GET  /api/ai            → { enabled, remaining, limit, paused, message?, admin }
 * POST /api/ai {feature, ...input} → { result, remaining, cached }
 * AI only ever runs here because the user pressed a ✨ button.
 */
export const handleAiRequest = handle(async (req) => {
  const auth = await requireUser(req);
  if (req.method === 'GET') {
    // `admin` only decides whether Settings shows a link to /admin; /api/admin checks again itself.
    const admin = !!env.adminEmail && auth.email === env.adminEmail && !!auth.user.email_confirmed_at;
    return json({ ...(await aiStatus(auth)), admin });
  }
  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const body = await readJson<Record<string, unknown>>(req);
  const feature = body.feature as FeatureName;
  if (typeof feature !== 'string' || !Object.hasOwn(FEATURES, feature)) throw new HttpError(400, 'Unknown AI feature.');
  const out = await FEATURES[feature](auth, body);
  return json(out);
});
