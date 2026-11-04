/** Spaces in the app: shared building blocks plus browser-only helpers (colours, images). */
import type React from 'react';
import { LIMITS, SPACE_COLORS, type ItemValues, type LinkPreview, type SpaceDesign, type SpaceSettings, type StatusColor } from '../../shared/spaces';
import { supabase } from './supabase';

export * from '../../shared/spaces';

export interface Space {
  id: string;
  name: string;
  emoji: string;
  color: number;
  description: string;
  design: SpaceDesign;
  settings: SpaceSettings & { samples?: ItemValues[] };
  status: 'draft' | 'active' | 'archived';
  request: string;
  habit_id: string | null;
  goal_id: string | null;
  goal_field: string | null;
  template_id: string | null;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface SpaceItem {
  id: string;
  space_id: string;
  values: ItemValues;
  meta: { previews?: Record<string, LinkPreview> };
  position: number;
  created_at: string;
  updated_at: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  emoji: string;
  color: number;
  description: string;
  design: SpaceDesign;
  settings: SpaceSettings;
  created_at: string;
}

export interface SpaceShare {
  id: string;
  space_id: string;
  token: string;
  enabled: boolean;
}

export const SPACE_COLUMNS = '*';
export const ITEM_COLUMNS = 'id, space_id, values:data, meta, position, created_at, updated_at';

export function spaceColor(color: number) {
  return (SPACE_COLORS[color] ?? SPACE_COLORS[0]).hex;
}

/** The Space's emoji on a tile tinted with its colour (like calendars). */
export function spaceTile(color: number): React.CSSProperties {
  const hex = spaceColor(color);
  return { background: `${hex}26`, boxShadow: `inset 0 0 0 1px ${hex}59` };
}

/** Status pill colours: tinted fill, readable text in both themes, hairline ring. */
export const STATUS_CLASSES: Record<StatusColor, string> = {
  gray: 'bg-ink/[0.07] text-ink ring-ink/20',
  red: 'bg-danger/10 text-danger ring-danger/30',
  orange: 'bg-[#f97316]/15 text-[#b4470b] dark:text-[#fdba74] ring-[#f97316]/35',
  yellow: 'bg-warning/15 text-warning ring-warning/35',
  green: 'bg-success/10 text-success ring-success/30',
  blue: 'bg-[#3b82f6]/15 text-[#1d4ed8] dark:text-[#93c5fd] ring-[#3b82f6]/35',
  purple: 'bg-[#8b5cf6]/15 text-[#6d28d9] dark:text-[#c4b5fd] ring-[#8b5cf6]/35',
  pink: 'bg-[#ec4899]/15 text-[#be185d] dark:text-[#f9a8d4] ring-[#ec4899]/35',
};

/** Solid dot colours for status options (board columns, menus): ≥3:1 on both themes' surfaces. */
export const STATUS_DOT: Record<StatusColor, string> = {
  gray: '#8d8d95',
  red: '#e11d48',
  orange: '#ea580c',
  yellow: '#ca8a04',
  green: '#16a34a',
  blue: '#2563eb',
  purple: '#7c3aed',
  pink: '#db2777',
};

export const SPACE_EMOJIS = ['✨', '🎄', '🎁', '🏃', '🏋️', '📚', '🎬', '🧳', '💰', '📝', '🎓', '💼', '🥗', '🍳', '⭐', '🌱', '🎮', '🎵', '✈️', '🏠', '🐶', '💡', '🛒', '🎨'];

// ---------------------------------------------------------------------------
// Images: private bucket, signed URLs fetched in batches and cached.
// ---------------------------------------------------------------------------
const BUCKET = 'space-images';
const signed = new Map<string, { url: string; expires: number }>();
let pending: { path: string; resolve: (u: string | null) => void }[] = [];
let timer: number | null = null;

async function flush() {
  const batch = pending;
  pending = [];
  timer = null;
  const paths = [...new Set(batch.map((b) => b.path))];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const map = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  for (const p of paths) if (map.has(p)) signed.set(p, { url: map.get(p)!, expires: Date.now() + 55 * 60_000 });
  for (const b of batch) b.resolve(map.get(b.path) ?? null);
}

/** A displayable URL for an image value (a storage path, or an https URL used as-is). */
export function imageUrl(value: string): Promise<string | null> {
  if (value.startsWith('https://') || value.startsWith('blob:')) return Promise.resolve(value);
  const hit = signed.get(value);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    pending.push({ path: value, resolve });
    timer ??= window.setTimeout(flush, 20);
  });
}

export function cachedImageUrl(value: string): string | null {
  if (value.startsWith('https://') || value.startsWith('blob:')) return value;
  const hit = signed.get(value);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

/** Shrinks a photo in the browser (max 1600px, WebP/JPEG) so uploads stay well under the 2 MB limit. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image.');
  if (file.type === 'image/gif' && file.size <= LIMITS.imageBytes) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('That image couldn’t be read.');
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  for (const q of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', q));
    const out = blob && blob.type === 'image/webp' ? blob : await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (out && out.size <= LIMITS.imageBytes) return out;
  }
  throw new Error('That image is too large, even after shrinking it.');
}

export async function uploadImage(userId: string, file: File): Promise<string> {
  const blob = await shrinkImage(file);
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(error.message.includes('size') ? 'That image is too large (2 MB max).' : 'The image couldn’t be uploaded. Please try again.');
  return path;
}

/** People/groups already used in a Space (quick add recognises them). */
export function peopleIn(design: SpaceDesign, items: { values: ItemValues }[]): string[] {
  const f = design.fields.find((x) => x.type === 'person');
  if (!f) return [];
  const seen = new Map<string, string>();
  for (const i of items) {
    const v = i.values[f.key];
    if (typeof v === 'string' && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  }
  return [...seen.values()].slice(0, 200);
}

export function shareUrl(token: string) {
  return `${window.location.origin}/s/${token}`;
}
