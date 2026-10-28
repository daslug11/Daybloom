import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import { handleDemoCalendar, handleSyncRequest } from './sync.js';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  return new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
}

/** Serves the same /api handlers Vercel runs, so `npm run dev` and `npm run preview` need no second process. */
export function calendarSyncApi(): Plugin {
  const routes: Record<string, (r: Request) => Response | Promise<Response>> = {
    '/api/calendar-sync': handleSyncRequest,
    '/api/demo-calendar.ics': handleDemoCalendar,
  };
  const middleware = async (req: IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
    const path = (req.url ?? '').split('?')[0];
    const handler = routes[path];
    if (!handler) return next();
    try {
      const response = await handler(await toRequest(req));
      res.statusCode = response.status;
      response.headers.forEach((v, k) => res.setHeader(k, v));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error('[api]', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal error' }));
    }
  };
  return {
    name: 'daybloom-calendar-sync-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
