/** #tags written in text, lower-cased and de-duplicated. */
export function extractTags(text: string): string[] {
  return [...new Set([...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{1,30})/gu)].map((m) => m[1].toLowerCase()))].slice(0, 20);
}

/** First line of a note, trimmed — handy as a default task/goal title. */
export function firstLine(text: string, max = 120) {
  const line = text.replace(/^[\s#>*-]+/, '').split('\n').find((l) => l.trim()) ?? '';
  const clean = line.replace(/^\s*[-*]\s*\[[ xX]\]\s*/, '').replace(/[*_`]/g, '').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
