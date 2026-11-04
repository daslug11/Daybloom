import { describe, expect, it } from 'vitest';
import { templateById } from '../../shared/spaces';
import { anonClient, hasStack, newUser, serviceClient } from './helpers';

const running = templateById('running')!.design;
const christmas = templateById('christmas')!.design;

describe.skipIf(!hasStack)('Spaces database', () => {
  it('isolates spaces, items, templates and shares between users', async () => {
    const a = await newUser('SpaceA');
    const b = await newUser('SpaceB');
    const { data: space, error } = await a.client.from('spaces').insert({ name: 'Gifts', design: christmas }).select('*').single();
    expect(error).toBeNull();
    await a.client.from('space_items').insert({ space_id: space.id, data: { gift: 'Socks' } });
    await a.client.from('space_templates').insert({ name: 'Mine', design: christmas });
    const { data: share } = await a.client.from('space_shares').insert({ space_id: space.id }).select('*').single();
    expect(share.token).toMatch(/^[0-9a-f]{64}$/);

    for (const t of ['spaces', 'space_items', 'space_templates', 'space_shares']) {
      const { data } = await b.client.from(t).select('*');
      expect(data, t).toEqual([]);
    }
    // B can't add items to A's Space, even knowing its id.
    const { error: cross } = await b.client.from('space_items').insert({ space_id: space.id, data: { gift: 'x' } });
    expect(cross).not.toBeNull();
    // Visitors (anon) see nothing, and nobody but the server can read the link-preview cache.
    const anon = anonClient();
    for (const t of ['spaces', 'space_items', 'space_shares', 'link_previews']) {
      const { data } = await anon.from(t).select('*');
      expect(data ?? [], t).toEqual([]);
    }
    const { data: cache } = await a.client.from('link_previews').select('*');
    expect(cache ?? []).toEqual([]);
  });

  it('never lets an owner pick or change a share token', async () => {
    const a = await newUser('Token');
    const { data: space } = await a.client.from('spaces').insert({ name: 'Wishlist', design: christmas }).select('id').single();
    const { data: share } = await a.client.from('space_shares').insert({ space_id: space!.id, token: 'a'.repeat(64) }).select('token').single();
    expect(share!.token).not.toBe('a'.repeat(64));
    const { error } = await a.client.from('space_shares').update({ token: 'b'.repeat(64) }).eq('space_id', space!.id);
    expect(error).not.toBeNull();
    const { error: off } = await a.client.from('space_shares').update({ enabled: false }).eq('space_id', space!.id);
    expect(off).toBeNull();
  });

  it('rejects oversized designs', async () => {
    const a = await newUser('Big');
    const fields = Array.from({ length: 16 }, (_, i) => ({ key: `f${i}`, name: `F${i}`, type: 'text' }));
    const { error } = await a.client.from('spaces').insert({ name: 'Too big', design: { ...christmas, fields } });
    expect(error).not.toBeNull();
    const opts = Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, label: `O${i}`, color: 'gray' }));
    const { error: e2 } = await a.client.from('spaces').insert({ name: 'Opts', design: { ...christmas, fields: [{ key: 's', name: 'S', type: 'status', options: opts }] } });
    expect(e2).not.toBeNull();
  });

  it('caps active Spaces at 25 (archived and drafts do not count)', async () => {
    const a = await newUser('Limit');
    const rows = Array.from({ length: 25 }, (_, i) => ({ name: `S${i}`, design: christmas }));
    expect((await a.client.from('spaces').insert(rows)).error).toBeNull();
    const over = await a.client.from('spaces').insert({ name: 'One more', design: christmas });
    expect(over.error?.message).toMatch(/up to 25 active Spaces/);
    expect((await a.client.from('spaces').insert({ name: 'Draft', design: christmas, status: 'draft' })).error).toBeNull();
    const { data: first } = await a.client.from('spaces').select('id').eq('name', 'S0').single();
    await a.client.from('spaces').update({ status: 'archived' }).eq('id', first!.id);
    expect((await a.client.from('spaces').insert({ name: 'Now fits', design: christmas })).error).toBeNull();
    const revive = await a.client.from('spaces').update({ status: 'active' }).eq('id', first!.id);
    expect(revive.error?.message).toMatch(/up to 25/);
  });

  it('counts logged items toward a linked habit and goal, and takes deleted ones back off', async () => {
    const a = await newUser('Runner');
    const { data: habit } = await a.client.from('habits').insert({ name: 'Run' }).select('id').single();
    const { data: goal } = await a.client.from('goals').insert({ title: 'Run 20 km', target: 20, unit: 'km' }).select('id').single();
    const { data: space } = await a.client
      .from('spaces')
      .insert({ name: 'Runs', design: running, habit_id: habit!.id, goal_id: goal!.id, goal_field: 'distance' })
      .select('id')
      .single();
    const today = new Date().toISOString().slice(0, 10);
    const { data: item } = await a.client.from('space_items').insert({ space_id: space!.id, data: { date: today, distance: 5, time: 1710 } }).select('id').single();
    await a.client.from('space_items').insert({ space_id: space!.id, data: { date: today, distance: 8 } });
    const g1 = await a.client.from('goals').select('current, completed_at').eq('id', goal!.id).single();
    expect(Number(g1.data!.current)).toBe(13);
    const logs = await a.client.from('habit_logs').select('day').eq('habit_id', habit!.id);
    expect(logs.data!.map((l) => l.day)).toEqual([today]);
    // Editing the distance adjusts the goal; deleting takes it off.
    await a.client.from('space_items').update({ data: { date: today, distance: 12, time: 1710 } }).eq('id', item!.id);
    expect(Number((await a.client.from('goals').select('current').eq('id', goal!.id).single()).data!.current)).toBe(20);
    expect((await a.client.from('goals').select('completed_at').eq('id', goal!.id).single()).data!.completed_at).not.toBeNull();
    await a.client.from('space_items').delete().eq('id', item!.id);
    const g2 = (await a.client.from('goals').select('current, completed_at').eq('id', goal!.id).single()).data!;
    expect(Number(g2.current)).toBe(8);
    expect(g2.completed_at).toBeNull();
    // Deleting the whole Space keeps the goal progress already made.
    await a.client.from('spaces').delete().eq('id', space!.id);
    expect(Number((await a.client.from('goals').select('current').eq('id', goal!.id).single()).data!.current)).toBe(8);
  });

  it('caps items per Space', async () => {
    const svc = serviceClient();
    const a = await newUser('Full');
    const { data: space } = await a.client.from('spaces').insert({ name: 'Full', design: christmas }).select('id').single();
    const batch = (n: number) => Array.from({ length: n }, (_, i) => ({ user_id: a.id, space_id: space!.id, data: { gift: `g${i}` } }));
    for (let i = 0; i < 5; i++) expect((await svc.from('space_items').insert(batch(1000))).error).toBeNull();
    const over = await a.client.from('space_items').insert({ space_id: space!.id, data: { gift: 'one too many' } });
    expect(over.error?.message).toMatch(/5,000/);
  }, 60_000);

  it('limits image uploads to the user’s own folder, images only, 2 MB', async () => {
    const a = await newUser('Pics');
    const b = await newUser('Other');
    const png = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const ok = await a.client.storage.from('space-images').upload(`${a.id}/one.png`, png, { contentType: 'image/png' });
    expect(ok.error).toBeNull();
    const elsewhere = await a.client.storage.from('space-images').upload(`${b.id}/sneaky.png`, png, { contentType: 'image/png' });
    expect(elsewhere.error).not.toBeNull();
    const notImage = await a.client.storage.from('space-images').upload(`${a.id}/x.html`, new Blob(['<script>'], { type: 'text/html' }), { contentType: 'text/html' });
    expect(notImage.error).not.toBeNull();
    const big = await a.client.storage.from('space-images').upload(`${a.id}/big.png`, new Blob([new Uint8Array(2.5 * 1024 * 1024)], { type: 'image/png' }), { contentType: 'image/png' });
    expect(big.error).not.toBeNull();
    // B can't read A's image.
    const peek = await b.client.storage.from('space-images').download(`${a.id}/one.png`);
    expect(peek.error).not.toBeNull();
  });
});
