import { describe, expect, it } from "vitest";
import {
  barWidth, bestProgression, bucketForRank, bucketLabel, progressFill, shareText,
} from "../game";

describe("buckets", () => {
  it("boundaries match spec §6.1", () => {
    expect(bucketForRank(1)).toBe("solved");
    expect(bucketForRank(2)).toBe("hot");
    expect(bucketForRank(100)).toBe("hot");
    expect(bucketForRank(101)).toBe("warm");
    expect(bucketForRank(1000)).toBe("warm");
    expect(bucketForRank(1001)).toBe("cool");
    expect(bucketForRank(5000)).toBe("cool");
    expect(bucketForRank(5001)).toBe("cold");
  });
  it("mongolian labels", () => {
    expect(bucketLabel(50)).toBe("маш ойрхон");
    expect(bucketLabel(9000)).toBe("маш хол");
  });
});

describe("progressFill", () => {
  it("logarithmic and monotonic", () => {
    expect(progressFill(1, 22396)).toBe(1);
    const fills = [1, 10, 100, 1000, 10000].map((r) => progressFill(r, 22396));
    for (let i = 1; i < fills.length; i++) expect(fills[i]).toBeLessThan(fills[i - 1]);
  });
});

describe("shareText", () => {
  it("matches spec §6.5 format", () => {
    const text = shareText(267, [5000, 200, 50, 1], 2, true);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Ойрхон #267 🇲🇳");
    expect(lines[1]).toBe("4 таалт, 2 сэжүүр");
    expect(lines[2]).toBe(bestProgression([5000, 200, 50, 1]).join(""));
    expect(lines).toHaveLength(4);
  });
});

describe("barWidth", () => {
  const V = 22396;

  it("is widest for the closest guess and never full-bleed", () => {
    expect(barWidth(1, V)).toBeLessThanOrEqual(0.92);
    expect(barWidth(1, V)).toBeGreaterThan(0.9);
  });

  it("shrinks strictly while the difference is still legible", () => {
    const ranks = [1, 90, 149, 601, 1042, 1646];
    for (let i = 1; i < ranks.length; i++) {
      expect(barWidth(ranks[i], V)).toBeLessThan(barWidth(ranks[i - 1], V));
    }
  });

  it("never grows with rank, and far words share the sliver floor", () => {
    const ranks = [1, 90, 149, 601, 1042, 1646, 3162, 17008];
    for (let i = 1; i < ranks.length; i++) {
      expect(barWidth(ranks[i], V)).toBeLessThanOrEqual(barWidth(ranks[i - 1], V));
    }
    // Past ~3000 every bar is the same sliver — same as the reference design.
    expect(barWidth(3162, V)).toBe(barWidth(17008, V));
  });

  it("keeps a visible sliver for very distant words", () => {
    expect(barWidth(999999, V)).toBeGreaterThan(0);
    expect(barWidth(999999, V)).toBeLessThan(0.05);
  });

  it("never returns NaN for degenerate input", () => {
    for (const [r, v] of [[0, 0], [1, 1], [-5, 10]]) {
      expect(Number.isFinite(barWidth(r, v))).toBe(true);
    }
  });
});
