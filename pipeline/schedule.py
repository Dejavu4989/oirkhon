"""Draft puzzle scheduling (Phase-1 prep; spec §3.8).

Produces a DRAFT schedule from answer_candidates.csv for admin review:
  data/meta/draft_schedule_30d.csv   (puzzle_number, play_date, lemma, difficulty)
  db/seed/draft_puzzles.sql          (idempotent INSERTs, published=FALSE)

Nothing here approves words — the admin panel sign-off remains required before
any puzzle goes live. Easier words land on Mondays (locked spec decision).

Usage:
  python -m pipeline.schedule --days 30 --epoch 2026-09-01     fresh draft
  python -m pipeline.schedule --from 24 --days 67              keep #1–#24 verbatim,
                                                               regenerate/extend the rest
  python -m pipeline.schedule --swap [--from 24]               replace only rows that are
                                                               no longer eligible
  python -m pipeline.schedule --audit                          flag problems in the draft

Puzzles that have already been played must never change: a subscriber's
archive board stores ranks against the original answer. Pass --from N with
today's puzzle number to protect everything up to and including it.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import random
from pathlib import Path

from . import config
from .playable import Playability
from .vocab import load_lemmas

FIELDS = ["puzzle_number", "play_date", "lemma", "difficulty"]


def _csv_path() -> Path:
    return config.META_DIR / "draft_schedule_30d.csv"


def _playability() -> Playability:
    lemmas, freq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    return Playability.from_data(lemmas, freq)


def load_candidates(play: Playability | None = None):
    """Candidates bucketed by difficulty, re-checked against the current rules
    so a stale CSV can never reintroduce a verb or a name."""
    path = config.META_DIR / "answer_candidates.csv"
    if not path.exists():
        raise SystemExit("run `python -m pipeline.candidates` first")
    play = play or _playability()
    rows = list(csv.DictReader(path.open("r", encoding="utf-8")))
    buckets: dict[str, list[dict]] = {"easy": [], "medium": [], "hard": []}
    for r in rows:
        if not play.answer_eligible(r["lemma"]):
            continue
        r["frequency"] = int(r["frequency"])
        buckets.setdefault(r["difficulty"], buckets["medium"]).append(r)
    return buckets


def load_schedule():
    path = _csv_path()
    if not path.exists():
        return []
    return list(csv.DictReader(path.open("r", encoding="utf-8")))


def pick(buckets: dict[str, list[dict]], difficulty: str, rng: random.Random):
    pool = buckets.get(difficulty) or buckets["medium"] or buckets["hard"] or buckets["easy"]
    if not pool:
        raise SystemExit("candidate pool exhausted — loosen the rules or add words")
    return pool.pop(rng.randrange(len(pool)))


def weekday_difficulty(weekday: int, rng: random.Random) -> str:
    """Monday(0)=easy per spec; midweek medium; weekends harder."""
    if weekday == 0:
        return "easy"
    if weekday in (5, 6):
        return rng.choice(["medium", "hard"])
    return "medium"


def _write(rows: list[dict]) -> None:
    out_csv = _csv_path()
    with out_csv.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows({k: r[k] for k in FIELDS} for r in rows)
    sql_path = write_seed_sql(rows)
    easy = sum(1 for r in rows if r["difficulty"] == "easy")
    print(f"[schedule] {len(rows)} drafts ({easy} easy-Mondays) -> {out_csv}")
    print(f"[schedule] seed SQL -> {sql_path}")


def build(days: int, epoch: dt.date, seed: int = 20260901):
    """Fresh draft — every row is regenerated."""
    return extend(days, keep_through=0, epoch=epoch, seed=seed)


def extend(days: int, keep_through: int, epoch: dt.date | None = None,
           seed: int = 20260901):
    """Keep puzzles 1..keep_through exactly as drafted; (re)generate the rest
    up to `days` puzzles, never reusing a kept answer."""
    config.ensure_dirs()
    existing = load_schedule()
    kept = [r for r in existing if int(r["puzzle_number"]) <= keep_through]
    if keep_through and len(kept) < keep_through:
        raise SystemExit(f"draft only has {len(kept)} puzzles; cannot keep through #{keep_through}")
    if epoch is None:
        if not existing:
            raise SystemExit("no draft schedule yet — pass --epoch YYYY-MM-DD")
        first = min(existing, key=lambda r: int(r["puzzle_number"]))
        epoch = dt.date.fromisoformat(first["play_date"]) - dt.timedelta(
            days=int(first["puzzle_number"]) - 1)

    play = _playability()
    buckets = load_candidates(play)
    used = {r["lemma"] for r in kept}
    for pool in buckets.values():
        pool[:] = [r for r in pool if r["lemma"] not in used]

    rng = random.Random(seed)
    rows = list(kept)
    for i in range(keep_through, days):
        day = epoch + dt.timedelta(days=i)
        diff = weekday_difficulty(day.weekday(), rng)
        row = pick(buckets, diff, rng)
        used.add(row["lemma"])
        rows.append({"puzzle_number": i + 1, "play_date": day.isoformat(),
                     "lemma": row["lemma"], "difficulty": diff})

    _write(rows)
    if keep_through:
        print(f"[schedule] kept #1–#{keep_through} unchanged; drafted #{keep_through + 1}–#{days}")
    return rows


def swap_blocked(keep_through: int = 0, seed: int = 20260826):
    """Replace ONLY rows whose lemma is no longer answer-eligible (blocklisted,
    or caught by a rule that has since improved). Every other row stays
    untouched — no reshuffle. Rows up to keep_through are reported, not changed."""
    config.ensure_dirs()
    play = _playability()
    rows = load_schedule()
    if not rows:
        raise SystemExit("no draft schedule to swap — run without --swap first")
    buckets = load_candidates(play)
    pool = [r["lemma"] for b in buckets.values() for r in b]
    taken = {r["lemma"] for r in rows}
    rng = random.Random(seed)

    swapped, protected = [], []
    for r in rows:
        why = play.answer_reason(r["lemma"])
        if not why:
            continue
        if int(r["puzzle_number"]) <= keep_through:
            protected.append((r["puzzle_number"], r["lemma"], why))
            continue
        new = rng.choice(pool)
        while new in taken:
            new = rng.choice(pool)
        swapped.append((r["puzzle_number"], r["lemma"], new, why))
        r["lemma"] = new
        taken.add(new)

    _write(rows)
    for n, old, new, why in swapped:
        print(f"[swap] #{n}: {old} -> {new}   ({why})")
    for n, old, why in protected:
        print(f"[swap] #{n}: {old} left alone — already played ({why})")
    print(f"[swap] {len(swapped)} swapped, {len(protected)} protected")
    return rows


def audit() -> None:
    """Flag every drafted answer the current rules would reject."""
    play = _playability()
    rows = load_schedule()
    bad = 0
    for r in rows:
        why = play.answer_reason(r["lemma"])
        flag = f"   <- {why}" if why else ""
        bad += bool(why)
        print(f"  #{r['puzzle_number']:<3} {r['play_date']}  {r['lemma']:<16}{flag}")
    print(f"\n{len(rows)} puzzles, {bad} would not pass today's rules")


def write_seed_sql(rows: list[dict]) -> Path:
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
    return sql_path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--epoch", help="day 1 of the game (default: taken from the existing draft)")
    ap.add_argument("--from", dest="keep_through", type=int, default=0, metavar="N",
                    help="keep puzzles 1..N exactly as they are")
    ap.add_argument("--swap", action="store_true",
                    help="keep the schedule; replace only ineligible answers")
    ap.add_argument("--audit", action="store_true", help="flag problems in the current draft")
    args = ap.parse_args()

    if args.audit:
        audit()
    elif args.swap:
        swap_blocked(keep_through=args.keep_through)
    else:
        epoch = dt.date.fromisoformat(args.epoch) if args.epoch else None
        if not args.keep_through and epoch is None:
            epoch = dt.date(2026, 9, 1)
        extend(args.days, keep_through=args.keep_through, epoch=epoch)


if __name__ == "__main__":
    main()
