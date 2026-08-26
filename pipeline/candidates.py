"""Answer-candidate generation (spec §3.8).

Never auto-selects answers: produces a *candidate* list for admin review.
Filters: concrete common nouns/simple verbs, 3–9 letters, frequency band,
blocklist (profanity/proper nouns/offensive — data/meta/blocklist.txt,
one item per line). Rough difficulty from frequency rank + length.

Output: data/meta/answer_candidates.csv (lemma,frequency,difficulty,suggested_weekday)
suggested_weekday: easier words proposed for Mondays (0=Monday … 6=Sunday).
"""
from __future__ import annotations

import csv
import random

from . import config
from .vocab import load_lemmas


def load_blocklist():
    path = config.CURATED_DIR / "blocklist.txt"
    if not path.exists():
        return frozenset()
    return frozenset(
        line.strip().lower()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    )


def difficulty(rank: int, length: int) -> str:
    if rank <= 4000 and length <= 6:
        return "easy"
    if rank <= 12000:
        return "medium"
    return "hard"


WEEKDAY_FOR_DIFFICULTY = {"easy": 0, "medium": 3, "hard": 5}


def load_proper_nouns():
    """Tokens that usually appear Capitalized mid-sentence → proper nouns."""
    path = config.VOCAB_DIR / "capitals.tsv"
    if not path.exists():
        return frozenset()
    out = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) == 3:
            out.add(parts[0])
    return out


def is_citation_form(lemma: str, morph, freq) -> bool:
    """Reject unmerged inflected forms (томилж, олов, ялгалын …)."""
    cands = morph.all_candidates(lemma)
    derived = [l for l in cands if l != lemma]
    if not derived:
        return True
    best = max(derived, key=lambda l: freq.get(l, 0))
    return freq.get(best, 0) < config.REDUCE_MERGE_MARGIN * max(freq.get(lemma, 0), 1)


def generate(max_candidates: int = 2000, seed: int = 20260101):
    config.ensure_dirs()
    blocklist = load_blocklist()
    proper = load_proper_nouns()
    lemmas, freq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    from pipeline.morphology import Morphology
    morph = Morphology(vocab=set(lemmas), freq=freq)

    rows = []
    skipped = {"proper": 0, "noncitation": 0}
    for idx, lemma in enumerate(lemmas, start=1):
        if not (config.ANSWER_MIN_LEN <= len(lemma) <= config.ANSWER_MAX_LEN):
            continue
        if lemma in blocklist or "-" in lemma:
            continue
        if idx > 15000:
            break  # beyond this, words get too obscure for a daily game
        if lemma.lower() in proper:
            skipped["proper"] += 1
            continue
        if not is_citation_form(lemma, morph, freq):
            skipped["noncitation"] += 1
            continue
        rows.append({
            "lemma": lemma,
            "frequency": freq[lemma],
            "difficulty": difficulty(idx, len(lemma)),
        })

    rng = random.Random(seed)
    rng.shuffle(rows)
    rows = rows[:max_candidates]
    for row in rows:
        row["suggested_weekday"] = WEEKDAY_FOR_DIFFICULTY[row["difficulty"]]

    out = config.META_DIR / "answer_candidates.csv"
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh, fieldnames=["lemma", "frequency", "difficulty", "suggested_weekday"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"[candidates] {len(rows)} -> {out} "
          f"(skipped: proper={skipped['proper']}, non-citation={skipped['noncitation']}) "
          "— for admin review, nothing auto-approved")
    return rows


def main() -> None:
    generate()


if __name__ == "__main__":
    main()
