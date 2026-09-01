// Unknown-word queue — feeds the admin review list (spec §5 `unknown_words`).
// Dev: JSON file under data/web/unknown_words.json. The column names match the
// Postgres table so this swaps for a single UPSERT later:
//   INSERT INTO unknown_words (raw_input) VALUES ($1)
//   ON CONFLICT (raw_input) DO UPDATE
//     SET count = unknown_words.count + 1, last_seen_at = now();
import fs from "node:fs";
import path from "node:path";
import { cleanToken, isMnWord } from "./textnorm";

export interface UnknownRecord {
  raw_input: string;
  count: number;
  resolved: boolean;
  created_at: string;
  last_seen_at: string;
}

// Input is attacker-controlled: bound both the row width and the table size so
// a junk flood cannot grow the queue without limit.
const MAX_LEN = 32;
const MAX_ROWS = 5000;

function queuePath(): string {
  if (process.env.OIRKHON_UNKNOWN) return process.env.OIRKHON_UNKNOWN;
  for (const p of ["../data/web/unknown_words.json", "data/web/unknown_words.json"]) {
    if (fs.existsSync(p)) return p;
  }
  return "../data/web/unknown_words.json";
}

function readQueue(file: string): Record<string, UnknownRecord> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

/**
 * Record a guess that resolved to nothing. Only plausible Mongolian words are
 * kept — the queue exists to find vocabulary gaps, not to log every typo.
 * Returns the stored key, or null when the input was not worth recording.
 */
export function recordUnknown(raw: string, now: Date = new Date()): string | null {
  const word = cleanToken(raw);
  if (!word || word.length < 2 || word.length > MAX_LEN) return null;
  if (!isMnWord(word)) return null;

  const file = queuePath();
  const all = readQueue(file);
  const existing = all[word];
  const ts = now.toISOString();

  if (existing) {
    existing.count += 1;
    existing.last_seen_at = ts;
  } else {
    if (Object.keys(all).length >= MAX_ROWS) return null;  // full: only counts update
    all[word] = { raw_input: word, count: 1, resolved: false, created_at: ts, last_seen_at: ts };
  }

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(all), "utf-8");
  } catch {
    return null;   // never fail a guess because the queue is unwritable
  }
  return word;
}

/** Admin view: most-frequent unresolved gaps first. */
export function pendingUnknown(limit = 100): UnknownRecord[] {
  return Object.values(readQueue(queuePath()))
    .filter((r) => !r.resolved)
    .sort((a, b) => b.count - a.count || a.raw_input.localeCompare(b.raw_input))
    .slice(0, limit);
}
