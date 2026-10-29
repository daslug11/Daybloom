// Local stand-in for Supabase's API gateway (Kong): routes /auth/v1 → GoTrue,
// /rest/v1 → PostgREST, and serves branded email templates for GoTrue to fetch.
// Development / tests only.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(here, '..', 'supabase', 'templates');
const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const ROUTES = [
  { prefix: '/auth/v1', target: 'http://127.0.0.1:54331' },
  { prefix: '/rest/v1', target: 'http://127.0.0.1:54332' },
];

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, content-profile, accept-profile, prefer, range, x-supabase-api-version',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, x-total-count',
};

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    return res.end();
  }
  if (url.startsWith('/templates/')) {
    const file = path.join(TEMPLATES, path.basename(url.split('?')[0]));
    try {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      return res.end('not found');
    }
  }
  const route = ROUTES.find((r) => url === r.prefix || url.startsWith(r.prefix + '/') || url.startsWith(r.prefix + '?'));
  if (!route) {
    res.writeHead(404, cors);
    return res.end(JSON.stringify({ message: 'no route' }));
  }
  const target = new URL(url.slice(route.prefix.length) || '/', route.target);
  const headers = { ...req.headers, host: target.host };
  const upstream = http.request(target, { method: req.method, headers }, (up) => {
    const out = { ...up.headers };
    for (const [k, v] of Object.entries(cors)) if (!(k in out)) out[k] = v;
    res.writeHead(up.statusCode ?? 502, out);
    up.pipe(res);
  });
  upstream.on('error', (err) => {
    res.writeHead(502, cors);
    res.end(JSON.stringify({ message: `gateway: ${err.message}` }));
  });
  req.pipe(upstream);
});

server.listen(PORT, () => console.log(`[gateway] http://localhost:${PORT}  (/auth/v1, /rest/v1, /templates)`));
