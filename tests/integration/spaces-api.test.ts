import { createServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { templateById } from '../../shared/spaces';
// @ts-expect-error — plain JS test helper
import { startMockAnthropic } from '../mock/anthropic.mjs';
import { env, hasStack, newUser } from './helpers';

const christmas = templateById('christmas')!.design;

describe.skipIf(!hasStack)('Spaces API', () => {
  let mock: { server: import('node:http').Server; port: number };
  let routes: typeof import('../../server/routes').API_ROUTES;

  beforeAll(async () => {
    mock = await startMockAnthropic();
    Object.assign(process.env, {
      SUPABASE_URL: env!.SUPABASE_URL,
      SUPABASE_ANON_KEY: env!.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env!.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DAILY_AI_LIMIT_PER_USER: '20',
    });
    routes = (await import('../../server/routes')).API_ROUTES;
  });
  afterAll(() => mock.server.close());

  type U = Awaited<ReturnType<typeof newUser>>;
  const token = async (u: U) => (await u.client.auth.getSession()).data.session!.access_token;
  async function call(path: string, u: U | null, body?: unknown) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (u) headers.authorization = `Bearer ${await token(u)}`;
    return routes[path.split('?')[0]](new Request(`http://localhost${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  }
  async function atlas(u: U, message: string, mode = 'chat') {
    const res = await call('/api/atlas', u, { action: 'chat', message, mode });
    const text = await res.text();
    return text.trim().split('\n').map((l) => JSON.parse(l));
  }
  const remaining = async (u: U) => (await (await call('/api/ai', u)).json()).remaining as number;

  it('designs a Space from plain words, validated, as one AI action, without saving', async () => {
    const u = await newUser('Designer');
    const res = await call('/api/ai', u, { feature: 'space_design', request: 'a christmas list' });
    const data = await res.json();
    expect(res.status).toBe(200);
    const { design, follow_up, dropped } = data.result;
    expect(design.fields.map((f: { key: string }) => f.key)).toEqual(['gift', 'for', 'price', 'link', 'bought']);
    expect(dropped.join(' ')).toMatch(/hologram/);
    expect(follow_up).toMatchObject({ kind: 'budget' });
    expect(data.remaining).toBe(19);
    expect((await u.client.from('spaces').select('id')).data).toEqual([]);
  });

  it('redesigns an existing Space and keeps its keys', async () => {
    const u = await newUser('Redesign');
    const { data: sp } = await u.client.from('spaces').insert({ name: 'Gifts', design: christmas }).select('id').single();
    const data = await (await call('/api/ai', u, { feature: 'space_design', request: 'add a size field', space_id: sp!.id })).json();
    const keys = data.result.design.fields.map((f: { key: string }) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['gift', 'for', 'price', 'size']));
  });

  it('Atlas asks one follow-up, then drafts a Space preview and counts it as one action', async () => {
    const u = await newUser('Elf');
    const first = await atlas(u, 'make me a Christmas list');
    expect(first.filter((e) => e.t === 'text').map((e) => e.v).join('')).toMatch(/budget/i);
    const before = await remaining(u);
    const events = await atlas(u, 'yes, $500');
    const action = events.find((e) => e.t === 'action' && e.tool === 'create_space');
    expect(action.space_id).toBeTruthy();
    const { data: draft } = await u.client.from('spaces').select('status, design, name').eq('id', action.space_id).single();
    expect(draft!.status).toBe('draft');
    expect(draft!.design.summaries.find((s: { kind: string }) => s.kind === 'budget').target).toBe(500);
    expect(await remaining(u)).toBe(before - 1);
  });

  it('Atlas logs runs with quick-add parsing and reads summaries', async () => {
    const u = await newUser('Runner');
    const running = templateById('running')!;
    await u.client.from('spaces').insert({ name: 'Running log', emoji: '🏃', design: running.design });
    const ev = await atlas(u, 'log a run 5k 28:30 felt great', 'voice');
    expect(ev.some((e) => e.t === 'action' && e.tool === 'add_space_items')).toBe(true);
    const { data: items } = await u.client.from('space_items').select('data');
    expect(items![0].data).toMatchObject({ distance: 5, time: 1710, notes: 'felt great' });
    expect(items![0].data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await u.client.from('spaces').insert({ name: 'Christmas', design: christmas });
    const { data: xmas } = await u.client.from('spaces').select('id').eq('name', 'Christmas').single();
    await u.client.from('space_items').insert([
      { space_id: xmas!.id, data: { gift: 'AirPods', price: 130 } },
      { space_id: xmas!.id, data: { gift: 'Socks', price: 20 } },
    ]);
    const spent = await atlas(u, 'how much have I spent on Christmas?');
    expect(spent.filter((e) => e.t === 'text').map((e) => e.v).join('')).toMatch(/\$150/);
  });

  it('share links return only allowed fields, no account info, and stop when turned off', async () => {
    const u = await newUser('Sharer');
    const { data: sp } = await u.client.from('spaces').insert({ name: 'Wishes', design: christmas }).select('id').single();
    await u.client.from('space_items').insert({ space_id: sp!.id, data: { gift: 'AirPods', for: 'Mom', price: 130, bought: true, link: 'https://apple.com/' } });
    const { data: share } = await u.client.from('space_shares').insert({ space_id: sp!.id }).select('token').single();
    const res = await call(`/api/spaces?share=${share!.token}`, null);
    expect(res.headers.get('x-robots-tag')).toMatch(/noindex/);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(body.items[0].values).toEqual({ gift: 'AirPods', for: 'Mom', link: 'https://apple.com/' });
    expect(text).not.toMatch(/130|bought|price|Sharer|user_id|@test\.local/);
    expect(text).not.toContain(sp!.id);
    await u.client.from('space_shares').update({ enabled: false }).eq('space_id', sp!.id);
    expect((await call(`/api/spaces?share=${share!.token}`, null)).status).toBe(404);
    expect((await call(`/api/spaces?share=not-a-token`, null)).status).toBe(404);
  });

  it('link previews refuse private networks and need a session', async () => {
    const u = await newUser('Links');
    const server = createServer((_, res) => res.end('<title>secret</title>')).listen(0);
    const port = (server.address() as import('node:net').AddressInfo).port;
    for (const url of [`http://127.0.0.1:${port}/`, 'http://localhost/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'file:///etc/passwd', 'http://10.0.0.1/']) {
      const res = await call('/api/spaces', u, { action: 'preview', url });
      const { preview } = await res.json();
      expect(preview.ok, url).toBe(false);
      expect(preview.title, url).toBeFalsy();
    }
    server.close();
    expect((await call('/api/spaces', null, { action: 'preview', url: 'https://example.com' })).status).toBe(401);
  });
});
