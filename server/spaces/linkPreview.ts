/**
 * Link previews (title, image, price) for links in Spaces, without AI.
 *
 * Safety: only http(s) on default ports; every address the hostname resolves to
 * is checked at connect time (so DNS tricks can't reach private networks);
 * redirects are re-checked; 5-second budget; at most 512 KB read; HTML only.
 * Results are cached for a week (failures for a day).
 */
import { createHash } from 'node:crypto';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { LinkPreview } from '../../shared/spaces/index.js';
import { cleanUrl } from '../../shared/spaces/index.js';
import { serviceClient } from '../supabase.js';

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_OK_MS = 7 * 86_400_000;
const CACHE_FAIL_MS = 86_400_000;

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(address: string): boolean {
  let ip = address.toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    if (ip === '::' || ip === '::1') return true;
    const first = parseInt(ip.split(':')[0] || '0', 16);
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00 || ip.startsWith('64:ff9b:') || ip.startsWith('2001:db8');
  }
  return true;
}

/** A DNS lookup that refuses to hand back private addresses (used for every connection). */
function safeLookup(hostname: string, options: object, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = (addresses as LookupAddress[]) ?? [];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      const e = new Error('blocked address') as NodeJS.ErrnoException;
      e.code = 'EBLOCKED';
      return callback(e, '');
    }
    if ((options as { all?: boolean }).all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

export function allowedUrl(raw: string): URL | null {
  const clean = cleanUrl(raw);
  if (!clean) return null;
  const u = new URL(clean);
  if (u.username || u.password) return null;
  if (u.port && !['80', '443'].includes(u.port)) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (isIP(host) && isPrivateAddress(host)) return null;
  return u;
}

interface Fetched {
  status: number;
  type: string;
  body: string;
  location?: string;
  finalUrl: string;
}

function fetchOnce(url: URL, deadline: number): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const left = deadline - Date.now();
    if (left <= 0) return reject(new Error('timeout'));
    const req = mod.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup as never,
        timeout: left,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; DaybloomLinkPreview/1.0; +https://daybloom.online)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'en',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const type = String(res.headers['content-type'] ?? '');
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, type, body: '', location: String(res.headers.location), finalUrl: url.toString() });
        }
        if (!/text\/html|application\/xhtml/i.test(type)) {
          res.destroy();
          return resolve({ status, type, body: '', finalUrl: url.toString() });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => {
          size += c.length;
          chunks.push(c);
          // Everything a preview needs is near the top; stop early.
          if (size >= MAX_BYTES || /<\/head>/i.test(c.toString('latin1'))) res.destroy();
        });
        const done = () => resolve({ status, type, body: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString('utf8'), finalUrl: url.toString() });
        res.on('end', done);
        res.on('close', done);
        res.on('error', () => done());
      },
    );
    const timer = setTimeout(() => req.destroy(new Error('timeout')), left);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.on('close', () => clearTimeout(timer));
    req.end();
  });
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

function meta(html: string, names: string[]): string | null {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name.replace(/[:.]/g, '\\$&')}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return null;
}

/** Pulls title, image, price and site name out of a page's head. */
export function parsePreview(html: string, pageUrl: string): Omit<LinkPreview, 'url' | 'ok'> {
  const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]{1,300})<\/title>/i)![1]) : null);
  let image = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
  if (image) {
    try {
      const abs = new URL(image, pageUrl);
      image = abs.protocol === 'https:' || abs.protocol === 'http:' ? abs.toString().slice(0, 1000) : null;
    } catch {
      image = null;
    }
  }
  let price: number | null = null;
  let currency: string | null = null;
  const p = meta(html, ['product:price:amount', 'og:price:amount', 'price']);
  if (p) {
    price = Number(p.replace(/[^0-9.]/g, ''));
    currency = meta(html, ['product:price:currency', 'og:price:currency', 'priceCurrency']);
  } else {
    // JSON-LD Product offers.
    const ld = html.match(/"price"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/);
    if (ld) {
      price = Number(ld[1]);
      currency = html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/)?.[1] ?? null;
    }
  }
  if (price !== null && (!Number.isFinite(price) || price <= 0 || price > 1e7)) price = null;
  const site = meta(html, ['og:site_name']) ?? new URL(pageUrl).hostname.replace(/^www\./, '');
  return {
    title: title ? title.slice(0, 200) : null,
    image,
    price,
    currency: currency && /^[A-Z]{3}$/.test(currency.toUpperCase()) ? currency.toUpperCase() : null,
    site: site.slice(0, 80),
  };
}

export async function fetchPreview(raw: string): Promise<LinkPreview> {
  const start = allowedUrl(raw);
  if (!start) return { url: raw, ok: false };
  const deadline = Date.now() + TIMEOUT_MS;
  let url = start;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetchOnce(url, deadline);
      if (res.location) {
        const next = allowedUrl(new URL(res.location, url).toString());
        if (!next) return { url: start.toString(), ok: false };
        url = next;
        continue;
      }
      if (res.status >= 400 || !res.body) return { url: start.toString(), ok: false, site: start.hostname.replace(/^www\./, '') };
      return { url: start.toString(), ok: true, ...parsePreview(res.body, res.finalUrl) };
    }
  } catch {
    // Timeouts, blocked addresses, TLS errors: no preview, the link still works.
  }
  return { url: start.toString(), ok: false, site: start.hostname.replace(/^www\./, '') };
}

/** Cached preview (shared across users: it's public page data, keyed by URL). */
export async function previewFor(raw: string): Promise<LinkPreview> {
  const clean = allowedUrl(raw)?.toString();
  if (!clean) return { url: raw, ok: false };
  const key = createHash('sha256').update(clean).digest('hex');
  const svc = serviceClient();
  const { data } = await svc.from('link_previews').select('data, fetched_at').eq('url_hash', key).maybeSingle();
  if (data) {
    const age = Date.now() - new Date(data.fetched_at).getTime();
    const prev = data.data as LinkPreview;
    if (age < (prev.ok ? CACHE_OK_MS : CACHE_FAIL_MS)) return prev;
  }
  const fresh = await fetchPreview(clean);
  await svc.from('link_previews').upsert({ url_hash: key, url: clean.slice(0, 2000), data: fresh, fetched_at: new Date().toISOString() });
  return fresh;
}
