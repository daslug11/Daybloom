import { publicDesign, type ItemValues, type LinkPreview } from '../../shared/spaces/index.js';
import { requireUser } from '../auth.js';
import { handle, HttpError, json, methodNotAllowed, readJson } from '../http.js';
import { serviceClient } from '../supabase.js';
import { rowDesign } from './data.js';
import { previewFor } from './linkPreview.js';

/**
 * GET  /api/spaces?share=<token>          → a read-only Space for its share link (no login)
 * POST /api/spaces {action:'preview', url} → link preview {title, image, price, site} (no AI)
 */
export const handleSpacesRequest = handle(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const token = url.searchParams.get('share') ?? '';
    return sharedSpace(token);
  }
  if (req.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const auth = await requireUser(req);
  const body = await readJson<{ action?: string; url?: string; urls?: string[] }>(req, 8000);
  if (body.action === 'preview') {
    if (!allow(auth.user.id)) throw new HttpError(429, 'Too many link previews at once. Try again in a minute.');
    if (typeof body.url !== 'string' || !body.url.trim()) throw new HttpError(400, 'Missing link.');
    return json({ preview: await previewFor(body.url.trim()) });
  }
  throw new HttpError(400, 'Unknown Spaces action.');
});

// A small per-instance limiter: 40 fresh previews per user per minute.
const recent = new Map<string, number[]>();
function allow(userId: string) {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 40) return false;
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 5000) recent.clear();
  return true;
}

const NOINDEX = { 'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer' };

/**
 * Reads a shared Space with the service role, then returns only what the owner
 * chose to share: no account info, no private fields (or anything computed from
 * them), no budgets, no internal ids.
 */
async function sharedSpace(token: string) {
  if (!/^[0-9a-f]{48,128}$/.test(token)) return json({ error: 'This link isn’t valid.' }, 404, NOINDEX);
  const svc = serviceClient();
  const { data: share } = await svc.from('space_shares').select('space_id, enabled').eq('token', token).maybeSingle();
  if (!share || !share.enabled) return json({ error: 'This link has been turned off or doesn’t exist.' }, 404, NOINDEX);
  const { data: space } = await svc.from('spaces').select('id, name, emoji, color, description, design, status').eq('id', share.space_id).maybeSingle();
  if (!space || space.status === 'draft') return json({ error: 'This link has been turned off or doesn’t exist.' }, 404, NOINDEX);
  const { data: rows } = await svc.from('space_items').select('data, meta, position').eq('space_id', space.id).order('position').limit(2000);

  const design = publicDesign(rowDesign(space));
  const keys = new Set(design.fields.map((f) => f.key));
  const imageKeys = design.fields.filter((f) => f.type === 'image').map((f) => f.key);
  const items = (rows ?? []).map((r, i) => {
    const values: ItemValues = {};
    for (const [k, v] of Object.entries((r.data ?? {}) as ItemValues)) if (keys.has(k)) values[k] = v;
    const previews = (r.meta as { previews?: Record<string, LinkPreview> })?.previews ?? {};
    const shownPreviews: Record<string, LinkPreview> = {};
    for (const [k, p] of Object.entries(previews)) if (keys.has(k) && p?.ok) shownPreviews[k] = { url: p.url, title: p.title, image: p.image, site: p.site, ok: true };
    return { id: `i${i + 1}`, values, meta: { previews: shownPreviews } };
  });

  // Images live in a private bucket; hand out short-lived signed links for the shared ones only.
  const paths = [...new Set(items.flatMap((it) => imageKeys.map((k) => it.values[k]).filter((p): p is string => typeof p === 'string' && !p.startsWith('https://'))))];
  if (paths.length) {
    const { data: signed } = await svc.storage.from('space-images').createSignedUrls(paths.slice(0, 500), 3600);
    const map = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
    for (const it of items) for (const k of imageKeys) if (typeof it.values[k] === 'string' && !(it.values[k] as string).startsWith('https://')) it.values[k] = map.get(it.values[k] as string);
  }

  return json(
    { space: { name: space.name, emoji: space.emoji, color: space.color, description: space.description, design }, items },
    200,
    { ...NOINDEX, 'cache-control': 'private, max-age=30' },
  );
}
