// Input tolerance — mirrors pipeline/alphabet.py + tolerance.py [LOCKED spec §3.4]
export const LATIN_LOOKALIKE: Record<string, string> = {
  o: "о", y: "у", e: "е", a: "а", c: "с", p: "р",
  x: "х", k: "к", m: "м", t: "т", h: "н", b: "в",
};

const CONFUSABLE = new Set([
  "о|ө", "ө|о", "у|ү", "ү|у", "е|э", "э|е", "и|й", "й|и", "ц|ч", "ч|ц",
]);

const PUNCT = "\"'`“”«»()[]{}.,!?;:*…—–‐‑‒−_/";

export function nfc(s: string): string {
  return s.normalize("NFC");
}

export function cleanToken(raw: string): string {
  let s = nfc(raw).trim().toLowerCase();
  s = s.replace(new RegExp(`^[${escapeRe(PUNCT)}\\s]+|[${escapeRe(PUNCT)}\\s]+$`, "g"), "");
  return s;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

export function toCyrillicLookalikes(s: string): string {
  return [...s].map((ch) => LATIN_LOOKALIKE[ch] ?? ch).join("");
}

export function isMnWord(token: string): boolean {
  if (!token) return false;
  return /^[\u0430-\u044f\u0451\u04e9\u04e7\u0430-\u04FF-]+$/.test(token);
}

export function subCost(a: string, b: string): number {
  if (a === b) return 0;
  return CONFUSABLE.has(`${a}|${b}`) ? 0.5 : 1.0;
}

/** Weighted Levenshtein with early abandon — port of tolerance.weighted_distance. */
export function weightedDistance(a: string, b: string, cap = 1.0): number {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > Math.floor(cap)) return cap + 1;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const ca = a[i - 1];
    const cur = [i, ...new Array(lb).fill(0)];
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + subCost(ca, b[j - 1]),
      );
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[lb];
}
