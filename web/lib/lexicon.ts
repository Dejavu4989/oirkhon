// Lexicon + guess resolution — server-side only. Mirrors pipeline/tolerance.py.
// Loads data/web/export.json.gz (vocab, form dictionary, rank snapshots).
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { cleanToken, isMnWord, toCyrillicLookalikes, weightedDistance } from "./textnorm";

export interface ScheduleEntry {
  n: number;
  date: string;      // ISO date
  answer: string;    // NEVER sent to clients before solve/give-up
  difficulty: string;
}

export interface ExportShape {
  schedule: ScheduleEntry[];
  lemmas: [string, number][];
  forms: Record<string, string>;
  ranks: Record<string, Record<string, number>>;
}

let cached: ExportShape | null = null;

function exportPath(): string {
  const env = process.env.OIRKHON_EXPORT;
  if (env) return env;
  // `next start` runs with cwd=web/; data lives at repo root.
  for (const p of ["../data/web/export.json.gz", "data/web/export.json.gz"]) {
    if (fs.existsSync(p)) return p;
  }
  return "../data/web/export.json.gz";
}

export function loadExport(): ExportShape {
  if (cached) return cached;
  const buf = fs.readFileSync(exportPath());
  const json = buf[0] === 0x1f && buf[1] === 0x8b
    ? gunzipSync(buf).toString("utf-8")     // pipeline exports gzip (export_web.py)
    : buf.toString("utf-8");
  const raw = JSON.parse(json) as ExportShape;
  cached = raw;
  return raw;
}

/** test hook */
export function setExport(shape: ExportShape | null): void {
  cached = shape;
}

export class Lexicon {
  readonly vocab: Set<string>;
  private readonly freq: Map<string, number> = new Map();
  private readonly surfaces: Map<string, string> = new Map(); // known surface -> lemma

  constructor(private exp: ExportShape) {
    this.vocab = new Set(exp.lemmas.map(([w]) => w));
    for (const [w, f] of exp.lemmas) this.freq.set(w, f);
    for (const [w] of exp.lemmas) this.surfaces.set(w, w);
    for (const [form, lemma] of Object.entries(exp.forms)) this.surfaces.set(form, lemma);
  }

  get size(): number {
    return this.vocab.size;
  }

  /** Dictionary-first, then identity — rules live in the exported word_forms map. */
  lemmatize(word: string): string | null {
    const w = cleanToken(word);
    if (!w || !isMnWord(w) || w.length < 2) return null;
    const dict = this.exp.forms[w];
    if (dict) return dict;
    if (this.vocab.has(w)) return w;
    return null;
  }

  resolveGuess(raw: string): {
    status: "exact" | "corrected" | "unknown";
    matched: string | null;
    lemma: string | null;
    message: string | null;
  } {
    const typed = raw.trim();
    const w = cleanToken(typed);
    if (!w || w.length < 2) return { status: "unknown", matched: null, lemma: null, message: null };

    for (const cand of [w, toCyrillicLookalikes(w)]) {
      const lemma = this.lemmatize(cand);
      if (lemma) return { status: "exact", matched: cand, lemma, message: null };
    }

    // Unambiguous Levenshtein-1 correction over known surfaces.
    type Hit = { d: number; negFreq: number; surf: string; lemma: string };
    const hits: Hit[] = [];
    for (const [surf, lemma] of this.surfaces) {
      if (Math.abs(surf.length - w.length) > 1) continue;
      const d = weightedDistance(w, surf);
      if (d <= 1.0) hits.push({ d, negFreq: -(this.freq.get(surf) ?? 0), surf, lemma });
    }
    if (!hits.length) return { status: "unknown", matched: null, lemma: null, message: null };
    hits.sort((a, b) => a.d - b.d || a.negFreq - b.negFreq || a.surf.localeCompare(b.surf));
    const best = hits[0];
    if (hits.length === 1 || best.d < hits[1].d) {
      return {
        status: "corrected",
        matched: best.surf,
        lemma: best.lemma,
        message: `«${typed}» → «${best.surf}» гэж ойлголоо.`,
      };
    }
    return { status: "unknown", matched: null, lemma: null, message: null };
  }
}

let lexiconSingleton: Lexicon | null = null;
let lexiconSource: ExportShape | null = null;

export function getLexicon(): Lexicon {
  const exp = loadExport();
  if (!lexiconSingleton || lexiconSource !== exp) {
    lexiconSingleton = new Lexicon(exp);
    lexiconSource = exp;
  }
  return lexiconSingleton;
}
