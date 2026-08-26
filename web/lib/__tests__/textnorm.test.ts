import { describe, expect, it } from "vitest";
import {
  cleanToken, subCost, toCyrillicLookalikes, weightedDistance,
} from "../textnorm";

describe("cleanToken", () => {
  it("trims, lowercases, NFC-normalizes", () => {
    expect(cleanToken("  НОХОЙ ")).toBe("нохой");
    expect(cleanToken("«ном».")).toBe("ном");
  });
});

describe("lookalikes [LOCKED map]", () => {
  it("maps latin to cyrillic", () => {
    expect(toCyrillicLookalikes("toy")).toBe("тоу");
    expect(toCyrillicLookalikes("xot")).toBe("хот");
  });
  it("leaves unmapped letters alone", () => {
    expect(toCyrillicLookalikes("noxoy")).toBe("nохоу");
  });
});

describe("weightedDistance", () => {
  it("confusables cost 0.5", () => {
    expect(weightedDistance("нохой", "нохои")).toBe(0.5);
    expect(weightedDistance("хот", "хөт")).toBe(0.5);
  });
  it("plain subs and indels cost 1", () => {
    expect(weightedDistance("ноход", "нохой")).toBe(1);
    expect(weightedDistance("ном", "номд")).toBe(1);
  });
  it("abandons beyond cap", () => {
    expect(weightedDistance("но", "нохойд")).toBeGreaterThan(1);
  });
  it("subCost pairs", () => {
    expect(subCost("о", "ө")).toBe(0.5);
    expect(subCost("а", "б")).toBe(1);
  });
});
