"""Quality-gate inspector (spec §3.6).

Prints the top-K nearest neighbors of a word from one or more vector files;
with multiple files it also prints a rank-averaged ensemble view.

Usage:
  python -m pipeline.inspect морь --vectors data/vectors/fasttext_mn.npz
  python -m pipeline.inspect ном --vectors ft.npz e5.npz labse.npz --top 50
"""
from __future__ import annotations

import argparse
import sys

from .alphabet import clean_token
from .embeddings import ensemble as ens
from .embeddings import io as vio


def _lookup(ids: list[str], word: str) -> str | None:
    if word in ids:
        return word
    return None


def show_single(path: str, word: str, top_k: int) -> bool:
    vectors, ids = vio.load(path)
    target = _lookup(ids, word)
    if target is None:
        print(f"[{path}] '{word}' not in vocabulary")
        return False
    vecs = vio.l2_normalize(vectors)
    sims = vecs @ vecs[ids.index(target)]
    order = _argsort_desc(sims)[:top_k]
    print(f"\n=== {path} :: {word} ===")
    for pos, idx in enumerate(order, start=1):
        print(f"{pos:3d}. {ids[idx]:<24s} {sims[idx]:.3f}")
    return True


def _argsort_desc(sims):
    import numpy as np
    return np.argsort(-sims, kind="stable")


def show_ensemble(paths: list[str], word: str, top_k: int) -> bool:
    loaded = [vio.load(p) for p in paths]
    ids0 = loaded[0][1]
    target = _lookup(ids0, word)
    if target is None:
        print(f"ensemble: '{word}' not in vocabulary")
        return False
    idx = ids0.index(target)
    ranked = ens.neighbors_rank_average(paths, idx, top_k)
    print(f"\n=== ensemble(rank-avg) :: {word} ===")
    for pos, (i, _score) in enumerate(ranked, start=1):
        print(f"{pos:3d}. {ids0[i]}")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("word")
    ap.add_argument("--vectors", nargs="+", required=True)
    ap.add_argument("--top", type=int, default=50)
    args = ap.parse_args()

    try:
        import numpy  # noqa: F401
    except ImportError:
        sys.exit("pip install numpy  # required for inspect")

    word = clean_token(args.word)
    found_any = False
    for path in args.vectors:
        found_any = show_single(path, word, args.top) or found_any
    if len(args.vectors) > 1:
        found_any = show_ensemble(args.vectors, word, args.top) or found_any
    if not found_any:
        sys.exit(1)


if __name__ == "__main__":
    main()
