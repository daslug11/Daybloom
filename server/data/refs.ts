/**
 * Short, per-request references (T1, N2, H3, G1 …) for rows we show the model.
 * They cost far fewer tokens than UUIDs and the model can't half-copy them.
 * Only rows the server loaded for this request (via the user's RLS client)
 * get a ref, so the model can never address another user's data.
 */
export type RefKind = 'T' | 'N' | 'H' | 'G' | 'M';

export class RefMap {
  private byRef = new Map<string, string>();
  private byId = new Map<string, string>();
  private counters: Record<RefKind, number> = { T: 0, N: 0, H: 0, G: 0, M: 0 };

  ref(kind: RefKind, id: string): string {
    const existing = this.byId.get(id);
    if (existing) return existing;
    const ref = `${kind}${++this.counters[kind]}`;
    this.byRef.set(ref, id);
    this.byId.set(id, ref);
    return ref;
  }

  /** Resolves a ref (or a raw UUID we already handed out) of the expected kind. */
  resolve(kind: RefKind, value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim().toUpperCase();
    if (v.startsWith(kind) && this.byRef.has(v)) return this.byRef.get(v)!;
    const lower = value.trim().toLowerCase();
    const ref = this.byId.get(lower);
    return ref && ref.startsWith(kind) ? lower : null;
  }
}
