/** Small helpers shared by every /api handler (Web Request/Response). */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

/** Parses a JSON body, refusing anything larger than `maxBytes`. */
export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 32_000): Promise<T> {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new HttpError(413, 'Request is too large.');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request is too large.');
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new HttpError(400, 'Request body must be JSON.');
  }
}

/** Wraps a handler so thrown HttpErrors become JSON responses and anything else a 500. */
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, ...err.extra }, err.status);
      console.error('[api]', err);
      return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
    }
  };
}

export function methodNotAllowed(allowed: string[]) {
  return json({ error: `Use ${allowed.join(' or ')}.` }, 405, { allow: allowed.join(', ') });
}
