"""Input tolerance for guesses (spec §3.4).

Resolution order:
  1. clean (trim/lower/NFC) + Latin lookalike mapping
  2. exact hit via morphology dictionary/vocabulary
  3. Levenshtein-1 fuzzy search over known surfaces with cost-0.5 substitutions
     for о↔ө, у↔ү, е↔э, и↔й, ц↔ч — accepted only when unambiguous.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass

from .alphabet import clean_token, sub_cost, to_cyrillic_lookalikes


@dataclass(frozen=True)
class Resolution:
    status: str          # 'exact' | 'corrected' | 'unknown'
    input: str           # raw player input
    matched: str | None  # surface form that matched
    lemma: str | None    # resolved lemma id string
    message: str | None = None


def weighted_distance(a: str, b: str, cap: float = 1.0) -> float:
    """Levenshtein with confusable-pair substitutions at cost 0.5; early abandon."""
    la, lb = len(a), len(b)
    if abs(la - lb) > int(cap):
        return cap + 1.0
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        ca = a[i - 1]
        cur = [i] + [0.0] * lb
        row_min = cur[0]
        for j in range(1, lb + 1):
            d = min(
                prev[j] + 1.0,
                cur[j - 1] + 1.0,
                prev[j - 1] + sub_cost(ca, b[j - 1]),
            )
            cur[j] = d
            if d < row_min:
                row_min = d
        if row_min > cap:
            return cap + 1.0
        prev = cur
    return prev[lb]


CORRECTION_MESSAGE = "«{typed}» → «{corrected}» гэж ойлголоо."


class Guesser:
    """Stateless guess resolver bound to a vocabulary snapshot."""

    def __init__(
        self,
        morphology,
        surfaces: Mapping[str, str],
        freq: Mapping[str, int] | None = None,
        log_unknown: Callable[[str], None] | None = None,
    ) -> None:
        """surfaces: known surface form -> lemma (vocabulary + word_forms)."""
        self.morphology = morphology
        self.surfaces = dict(surfaces)
        self.freq = dict(freq or {})
        self.log_unknown = log_unknown

    def resolve(self, raw: str) -> Resolution:
        typed = raw.strip()
        w = clean_token(typed)
        if not w or len(w) < 2:
            return Resolution("unknown", typed, None, None)

        # Pass 1+2: as-typed, then with Latin lookalikes mapped.
        for cand in (w, to_cyrillic_lookalikes(w)):
            lemma = self.morphology.lemmatize(cand)
            if lemma is not None:
                return Resolution("exact", typed, cand, lemma)

        # Pass 3: unambiguous Levenshtein-1 correction.
        hits = []
        for surf, lemma in self.surfaces.items():
            if abs(len(surf) - len(w)) > 1:
                continue
            d = weighted_distance(w, surf)
            if d <= 1.0:
                hits.append((d, -self.freq.get(surf, 0), surf, lemma))
        if not hits:
            if self.log_unknown:
                self.log_unknown(typed)
            return Resolution("unknown", typed, None, None)

        hits.sort()
        best = hits[0]
        if len(hits) == 1 or best[0] < hits[1][0]:
            surf, lemma = best[2], best[3]
            msg = CORRECTION_MESSAGE.format(typed=typed, corrected=surf)
            return Resolution("corrected", typed, surf, lemma, msg)

        if self.log_unknown:
            self.log_unknown(typed)
        return Resolution("unknown", typed, None, None)


def resolve(morphology, surfaces, raw: str, freq=None, log_unknown=None) -> Resolution:
    return Guesser(morphology, surfaces, freq, log_unknown).resolve(raw)
