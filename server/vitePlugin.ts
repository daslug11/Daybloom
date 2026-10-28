import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { API_ROUTES } from './routes.js';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  if (!response.body) return res.end();
  // Stream (Atlas replies arrive token by token).
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

/** Serves the same /api handlers Vercel runs, so `npm run dev` and `npm run preview` need no second process. */
export function apiRoutes(): Plugin {
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0];
    const handler = API_ROUTES[path];
    if (!handler) return next();
    try {
      await send(res, await handler(await toRequest(req)));
    } catch (err) {
      console.error('[api]', err);
      if (!res.headersSent) res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal error' }));
    }
  };
  return {
    name: 'daybloom-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
