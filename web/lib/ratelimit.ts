// In-memory sliding-window rate limiter (spec §7: 30/min per session, 300/hour per IP).
// Single-process dev implementation; swap for Redis in production.
type Window = { hits: number[] };

const windows = new Map<string, Window>();

export function allowHit(key: string, limit: number, windowMs: number,
                         now: number = Date.now()): boolean {
  const w = windows.get(key) ?? { hits: [] };
  w.hits = w.hits.filter((t) => now - t < windowMs);
  if (w.hits.length >= limit) {
    windows.set(key, w);
    return false;
  }
  w.hits.push(now);
  windows.set(key, w);
  return true;
}

export function resetLimits(): void {
  windows.clear();
}
