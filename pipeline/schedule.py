"""Draft puzzle scheduling (Phase-1 prep; spec §3.8).

Produces a DRAFT 30-day schedule from answer_candidates.csv for admin review:
  data/meta/draft_schedule_30d.csv   (puzzle_number, play_date, lemma, difficulty)
  db/seed/draft_puzzles.sql          (idempotent INSERTs, published=FALSE)

Nothing here approves words — the admin panel sign-off remains required before
any puzzle goes live. Easier words land on Mondays (locked spec decision).

Usage:
  python -m pipeline.schedule --days 30 --epoch 2026-09-01
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import random
from pathlib import Path

from . import config
from .vocab import load_lemmas

# Surfaces that should never be daily answers even if they survived reduction:
# converbs/finites/genitives that slipped through as "lemmas".
_BAD_ENDINGS = ("ж", "лаа", "лээ", "лоо", "лөө", "сан", "сэн", "сон", "сөн",
                "даг", "дэг", "дог", "на", "нэ", "но", "нө",
                "ын", "ийн", "ны", "ыг", "ийг", "д", "т",
                "аас", "ээс", "оос", "өөс", "аар", "ээр", "оор", "өөр",
                "тай", "тэй", "той", "хаа", "хээ", "ууд", "үүд",
                "жээ", "в")   # finite-past / reported-speech leftovers
MIN_ANSWER_FREQ = 120         # concrete/common words only


def _answer_pool() -> set[str]:
    """Nouns from the vocab that look like citable concrete answers."""
    lemmas, freq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    pool = set()
    for lemma in lemmas:
        if not config.ANSWER_MIN_LEN <= len(lemma) <= config.ANSWER_MAX_LEN:
            continue
        if any(lemma.endswith(e) for e in _BAD_ENDINGS):
            continue
        if freq.get(lemma, 0) < MIN_ANSWER_FREQ:
            continue
        pool.add(lemma)
    return pool


def load_candidates():
    path = config.META_DIR / "answer_candidates.csv"
    if not path.exists():
        raise SystemExit("run `python -m pipeline.candidates` first")
    rows = list(csv.DictReader(path.open("r", encoding="utf-8")))
    pool = _answer_pool()
    rows = [r for r in rows if r["lemma"] in pool]
    buckets: dict[str, list[dict]] = {"easy": [], "medium": [], "hard": []}
    for r in rows:
        r["frequency"] = int(r["frequency"])
        buckets[r["difficulty"]].append(r)
    return buckets


def pick(buckets: dict[str, list[dict]], difficulty: str, rng: random.Random):
    pool = buckets.get(difficulty) or buckets["medium"]
    idx = rng.randrange(len(pool))
    return pool.pop(idx)


def weekday_difficulty(weekday: int, rng: random.Random) -> str:
    """Monday(0)=easy per spec; midweek medium; weekends harder."""
    if weekday == 0:
        return "easy"
    if weekday in (5, 6):
        return rng.choice(["medium", "hard"])
    return "medium"


def build(days: int, epoch: dt.date, seed: int = 20260901):
    config.ensure_dirs()
    buckets = load_candidates()
    rng = random.Random(seed)

    rows = []
    used: set[str] = set()
    for i in range(days):
        day = epoch + dt.timedelta(days=i)
        diff = weekday_difficulty(day.weekday(), rng)
        row = pick(buckets, diff, rng)
        while row["lemma"] in used:
            row = pick(buckets, diff, rng)
        used.add(row["lemma"])
        rows.append({"puzzle_number": i + 1, "play_date": day.isoformat(),
                     "lemma": row["lemma"], "difficulty": diff})

    out_csv = config.META_DIR / "draft_schedule_30d.csv"
    with out_csv.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["puzzle_number", "play_date", "lemma", "difficulty"])
        writer.writeheader()
        writer.writerows(rows)

    sql_path = Path(__file__).resolve().parent.parent / "db" / "seed" / "draft_puzzles.sql"
    sql_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "-- DRAFT puzzle schedule — requires admin approval before publishing.",
        "-- Idempotent: re-running replaces unpublished drafts only.",
        "WITH game AS (SELECT id FROM games WHERE slug = 'oirkhon')",
    ]
    values = ",\n".join(
        f"  ({r['puzzle_number']}, DATE '{r['play_date']}', '{r['lemma']}', "
        f"'{r['difficulty']}')" for r in rows)
    lines.append(
        "INSERT INTO puzzles (game_id, puzzle_number, play_date, answer_lemma_id, published)\n"
        "SELECT g.id, v.puzzle_number, v.play_date, l.id, FALSE\n"
        "FROM (VALUES\n" + values + "\n"
        ") AS v(puzzle_number, play_date, lemma, difficulty)\n"
        "JOIN game g ON TRUE\n"
        "JOIN lemmas l ON l.lemma = v.lemma\n"
        "WHERE NOT EXISTS (\n"
        "  SELECT 1 FROM puzzles p\n"
        "  WHERE p.game_id = g.id AND p.puzzle_number = v.puzzle_number\n"
        ");")
    sql_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    mondays = sum(1 for r in rows if r["difficulty"] == "easy")
    print(f"[schedule] {len(rows)} drafts ({mondays} easy-Mondays) -> {out_csv}")
    print(f"[schedule] seed SQL -> {sql_path}")
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--epoch", default="2026-09-01",
                    help="day 1 of the game; puzzle_number = days_since_epoch + 1")
    args = ap.parse_args()
    build(args.days, dt.date.fromisoformat(args.epoch))


if __name__ == "__main__":
    main()
