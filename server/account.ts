import { requireUser } from './auth.js';
import { handle, HttpError, json, methodNotAllowed, readJson } from './http.js';
import { serviceClient } from './supabase.js';

/**
 * POST /api/account {action: 'delete', confirm: 'DELETE'}
 * Deletes the auth user; every table cascades from auth.users, so all of the
 * user's data goes with it. Uploaded Space images (Storage) are removed first.
 * (Exports are done in the browser through RLS.)
 */
export const handleAccountRequest = handle(async (req) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = await requireUser(req);
  const body = await readJson<{ action?: string; confirm?: string }>(req);
  if (body.action !== 'delete') throw new HttpError(400, 'Unknown account action.');
  if (body.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  await deleteImages(auth.user.id);
  const { error } = await serviceClient().auth.admin.deleteUser(auth.user.id);
  if (error) {
    console.error('[account delete]', error);
    throw new HttpError(500, 'Could not delete your account. Please try again or contact support.');
  }
  return json({ deleted: true });
});

/** Removes every file in the user's folder of the Space images bucket. */
async function deleteImages(userId: string) {
  const bucket = serviceClient().storage.from('space-images');
  for (let round = 0; round < 50; round++) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error || !data?.length) return;
    const { error: rmError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
    if (rmError) {
      console.error('[account delete images]', rmError);
      return;
    }
  }
}
