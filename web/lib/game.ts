// Rank buckets + progress bar + share text — mirrors pipeline/gameutil.py
export type Bucket = "solved" | "hot" | "warm" | "cool" | "cold";

interface BucketSpec { lo: number; hi: number; name: Bucket; label: string; square: string }

export const BUCKETS: BucketSpec[] = [
  { lo: 1, hi: 1, name: "solved", label: "Зөв!", square: "🟩" },
  { lo: 2, hi: 100, name: "hot", label: "маш ойрхон", square: "🟩" },
  { lo: 101, hi: 1000, name: "warm", label: "ойрхон", square: "🟨" },
  { lo: 1001, hi: 5000, name: "cool", label: "хол", square: "🟧" },
  { lo: 5001, hi: Number.MAX_SAFE_INTEGER, name: "cold", label: "маш хол", square: "⬜" },
];

export function bucketForRank(rank: number): Bucket {
  for (const b of BUCKETS) if (rank >= b.lo && rank <= b.hi) return b.name;
  return "cold";
}

export function bucketLabel(rank: number): string {
  for (const b of BUCKETS) if (rank >= b.lo && rank <= b.hi) return b.label;
  return "маш хол";
}

export function progressFill(rank: number, vocabSize: number): number {
  if (rank <= 1) return 1.0;
  const v = Math.max(vocabSize, 2);
  const r = Math.min(rank, v);
  return Math.max(0, Math.min(1, 1 - Math.log(r) / Math.log(v)));
}

/**
 * Width of a guess bar, 0..1 — presentation only.
 *
 * Exponential falloff rather than the log curve of `progressFill`: it keeps the
 * closest guesses near full width and collapses distant ones to a sliver, which
 * is what makes the board readable at a glance. `progressFill` stays the shared
 * value mirrored in pipeline/gameutil.py and used by the API.
 */
export function barWidth(rank: number, vocabSize: number): number {
  const tau = Math.max(vocabSize, 64) / 32;
  const w = 0.92 * Math.exp(-(Math.max(rank, 1) - 1) / tau);
  return Math.max(0.012, Math.min(0.92, w));
}

export function bestProgression(ranks: number[]): string[] {
  const squares: string[] = [];
  let best = Number.MAX_SAFE_INTEGER;
  for (const r of ranks) {
    best = Math.min(best, r);
    squares.push(BUCKETS.find((b) => best >= b.lo && best <= b.hi)?.square ?? "⬜");
  }
  return squares;
}

export function shareText(puzzleNumber: number, guessRanks: number[],
                          hintsUsed: number, solved: boolean,
                          domain = "lessgames.mn"): string {
  const head = `Ойрхон #${puzzleNumber} 🇲🇳`;
  const status = `${guessRanks.length} таалт, ${hintsUsed} сэжүүр` + (solved ? "" : " (бууж өгсөн)");
  const bar = bestProgression(guessRanks).join("");
  return [head, status, bar, domain].join("\n");
}
