"""Answer-candidate generation (spec §3.8).

Never auto-selects answers: produces a *candidate* list for admin review.
Eligibility is decided by pipeline.playable — a candidate is a playable,
common, native-looking, attested, terminal citation-form noun that is not on
meta/blocklist.txt. Difficulty is a rough band from corpus frequency.

Output: data/meta/answer_candidates.csv
        (lemma, frequency, difficulty, suggested_weekday)
suggested_weekday: easier words proposed for Mondays (0=Monday … 6=Sunday).
"""
from __future__ import annotations

import csv
import random
from collections import Counter

from . import config
from .playable import Playability
from .vocab import load_lemmas


def difficulty(frequency: int, length: int) -> str:
    """Frequency bands, not list positions — stable across vocabulary rebuilds."""
    if frequency >= 1000 and length <= 6:
        return "easy"
    if frequency >= 300:
        return "medium"
    return "hard"


WEEKDAY_FOR_DIFFICULTY = {"easy": 0, "medium": 3, "hard": 5}


def generate(seed: int = 20260101):
    config.ensure_dirs()
    lemmas, freq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    play = Playability.from_data(lemmas, freq)
    from pipeline.morphology import Morphology
    morph = Morphology(vocab=set(lemmas), freq=freq)

    rows = []
    skipped: Counter = Counter()
    for lemma in lemmas:
        why = play.answer_reason(lemma, morph)
        if why:
            skipped[why.split(":", 1)[0]] += 1
            continue
        rows.append({
            "lemma": lemma,
            "frequency": freq[lemma],
            "difficulty": difficulty(freq[lemma], len(lemma)),
        })

    rng = random.Random(seed)
    rng.shuffle(rows)
    for row in rows:
        row["suggested_weekday"] = WEEKDAY_FOR_DIFFICULTY[row["difficulty"]]

    out = config.META_DIR / "answer_candidates.csv"
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh, fieldnames=["lemma", "frequency", "difficulty", "suggested_weekday"])
        writer.writeheader()
        writer.writerows(rows)

    bands = Counter(r["difficulty"] for r in rows)
    print(f"[candidates] {len(rows)} -> {out}  "
          f"(easy={bands['easy']}, medium={bands['medium']}, hard={bands['hard']})")
    print("[candidates] skipped: " + ", ".join(
        f"{k}={v}" for k, v in sorted(skipped.items(), key=lambda kv: -kv[1])))
    print("[candidates] for admin review — nothing is auto-approved")
    return rows


def main() -> None:
    generate()


if __name__ == "__main__":
    main()
