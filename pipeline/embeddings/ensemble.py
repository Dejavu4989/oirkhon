"""Ensemble utilities (spec §3.5): concatenation + rank-average neighbors.

Rank-averaging is done per query at inspection time (full n×n rank matrices
are unnecessary); concatenated vectors are what get stored for puzzles.
"""
from __future__ import annotations

import numpy as np

from . import io as vio


def concat(paths: list[str], out: str) -> tuple[np.ndarray, list[str]]:
    """L2-normalize each model then concatenate with 1/sqrt(k) scaling so the
    result is again unit-norm and no single model dominates."""
    loaded = [vio.load(p) for p in paths]
    ids0 = loaded[0][1]
    assert all(ids == ids0 for _, ids in loaded), "models must share lemma order"
    parts = [vio.l2_normalize(v) / np.sqrt(len(loaded)) for v, _ in loaded]
    return np.hstack(parts).astype(np.float32), ids0


def neighbors_rank_average(paths: list[str], word_idx: int, top_k: int = 50):
    """Per-model neighbor rankings averaged by reciprocal position."""
    rank_sums: dict[int, float] = {}
    for p in paths:
        vecs, _ids = vio.load(p)
        vecs = vio.l2_normalize(vecs)
        sims = vecs @ vecs[word_idx]
        order = np.argsort(-sims)[: top_k * 3]
        for pos, idx in enumerate(order):
            rank_sums[int(idx)] = rank_sums.get(int(idx), 0.0) + pos
    ranked = sorted(rank_sums.items(), key=lambda kv: kv[1])[:top_k]
    return ranked
