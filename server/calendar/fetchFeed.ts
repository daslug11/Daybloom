import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_FEED_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** A failure with a message that is safe and useful to show in the UI. */
export class FeedError extends Error {}

/** webcal:// is just https:// with a different hat on. */
export function normalizeFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FeedError("That isn't a valid link.");
  }
  if (url.protocol === 'webcal:' || url.protocol === 'webcals:') url = new URL(`https://${raw.trim().replace(/^webcals?:\/\//i, '')}`);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new FeedError('Only http(s) and webcal links can be synced.');
  if (url.username || url.password) throw new FeedError('Links with embedded usernames or passwords are not supported.');
  return url;
}

function isPrivateV4(ip: string) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb');
}

/**
 * The backend fetches URLs that users type in, so refuse anything that points at
 * localhost or a private network (SSRF guard). Set SYNC_ALLOW_PRIVATE=1 to test
 * against a feed served on your own machine.
 */
async function assertPublicHost(url: URL) {
  if (process.env.SYNC_ALLOW_PRIVATE === '1') return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new FeedError('Local and private network addresses cannot be synced.');
  }
  let addresses: { address: string }[];
  try {
    addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch {
    throw new FeedError(`Couldn't find the server "${host}". Check the link for typos.`);
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FeedError('Local and private network addresses cannot be synced.');
  }
}

function statusMessage(status: number) {
  if (status === 401 || status === 403) {
    return `The calendar server refused access (${status}). Use the calendar's secret/private iCal address, not its sharing page.`;
  }
  if (status === 404 || status === 410) return `Feed not found (${status}). The link may have been reset or deleted.`;
  if (status === 429) return 'The calendar server is rate-limiting us (429). Try again in a few minutes.';
  if (status >= 500) return `The calendar server had an error (${status}). Try again later.`;
  return `The calendar server answered with HTTP ${status}.`;
}

async function readCapped(res: Response): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_FEED_BYTES) throw new FeedError('This feed is too large to sync (over 5 MB).');
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_FEED_BYTES) {
      await reader.cancel();
      throw new FeedError('This feed is too large to sync (over 5 MB).');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Fetches a feed's raw text, following a few redirects and re-checking each hop. */
export async function fetchFeedText(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let url = normalizeFeedUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5', 'user-agent': 'Daybloom-CalendarSync/1.0' },
      });
    } catch (err) {
      if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        throw new FeedError('The calendar server took too long to respond (10s).');
      }
      throw new FeedError("Couldn't connect to the calendar server.");
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new FeedError(statusMessage(res.status));
      url = normalizeFeedUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new FeedError(statusMessage(res.status));
    return readCapped(res);
  }
  throw new FeedError('Too many redirects while fetching the feed.');
}
