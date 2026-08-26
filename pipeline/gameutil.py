"""Shared game math used by both the pipeline (rank jobs/tests) and the web app.

Rank buckets (spec §6.1) and the logarithmic progress bar.
"""
from __future__ import annotations

import math

BUCKETS: tuple[tuple[int, int, str, str, str], ...] = (
    (1, 1, "solved", "Зөв!", ""),
    (2, 100, "hot", "маш ойрхон", "🟩"),
    (101, 1000, "warm", "ойрхон", "🟨"),
    (1001, 5000, "cool", "хол", "🟧"),
    (5001, 10**12, "cold", "маш хол", "⬜"),
)


def bucket_for_rank(rank: int) -> str:
    for lo, hi, name, _label, _sq in BUCKETS:
        if lo <= rank <= hi:
            return name
    return "cold"


def bucket_label(rank: int) -> str:
    for lo, hi, _name, label, _sq in BUCKETS:
        if lo <= rank <= hi:
            return label
    return BUCKETS[-1][3]


def bucket_square(rank: int) -> str:
    for lo, hi, _name, _label, sq in BUCKETS:
        if lo <= rank <= hi:
            return sq or "🟩"
    return "⬜"


def progress_fill(rank: int, vocab_size: int) -> float:
    """1 - log(rank)/log(vocab_size), clamped to [0, 1]."""
    if rank <= 1:
        return 1.0
    v = max(int(vocab_size), 2)
    r = min(int(rank), v)
    value = 1.0 - (math.log(r) / math.log(v))
    return max(0.0, min(1.0, value))


def best_progression(ranks: list[int]) -> list[str]:
    """Squares of the running-best (lowest) rank so far — spec §6.5 share bar."""
    squares: list[str] = []
    best = 10**12
    for r in ranks:
        best = min(best, r)
        squares.append(bucket_square(best))
    return squares


def share_text(game: str, puzzle_number: int, guess_ranks: list[int],
               hints_used: int, solved: bool, domain: str = "lessgames.mn") -> str:
    head = f"{game} #{puzzle_number} 🇲🇳"
    status = f"{len(guess_ranks)} таалт, {hints_used} сэжүүр" + ("" if solved else " (бууж өгсөн)")
    bar = "".join(best_progression(guess_ranks))
    return "\n".join([head, status, bar, domain])
