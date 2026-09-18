"""Quality-gate inspector (spec §3.6).

Prints the nearest neighbours of a word the way the game will rank them: among
*playable* words only (pipeline.playable), with the answer's own stem marked.
Pass --all to see the raw model output with the reason each word is hidden.

Usage:
  python -m pipeline.inspect морь --vectors data/vectors/fasttext_mn.npz
  python -m pipeline.inspect ном --vectors ft.npz labse.npz --top 30    (+ ensemble view)
  python -m pipeline.inspect харш --vectors ft.npz --all
"""
from __future__ import annotations

import argparse
import sys

from . import config
from .alphabet import clean_token
from .embeddings import io as vio
from .playable import Playability
from .vocab import load_lemmas


def _playability() -> Playability:
    lemmas, freq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    return Playability.from_data(lemmas, freq)


def shares_stem(a: str, b: str) -> bool:
    """Mirror of sharesStem() in web/lib/actions.ts: ь and и alternate in stems."""
    if a == b:
        return False
    x, y = a.replace("ь", "и"), b.replace("ь", "и")
    n = min(4, len(x), len(y))
    return n >= 3 and x[:n] == y[:n]


def _print_rows(rows, word: str, play: Playability, show_all: bool) -> None:
    shown = 0
    for w, score in rows:
        if w == word:
            continue
        why = play.reason(w)
        if why and not show_all:
            continue
        shown += 1
        tag = f"   [{why}]" if why else ("   ~stem" if shares_stem(word, w) else "")
        s = f"{score:.3f}" if score is not None else ""
        print(f"{shown:3d}. {w:<24s} {s}{tag}")


def show_single(path: str, word: str, top_k: int, play: Playability, show_all: bool) -> bool:
    vectors, ids = vio.load(path)
    if word not in ids:
        print(f"[{path}] '{word}' not in vocabulary")
        return False
    vecs = vio.l2_normalize(vectors)
    sims = vecs @ vecs[ids.index(word)]
    order = _argsort_desc(sims)
    rows = []
    for idx in order:
        w = ids[idx]
        if w == word:
            continue
        if show_all or play.playable(w):
            rows.append((w, float(sims[idx])))
        if len(rows) >= top_k:
            break
    print(f"\n=== {path} :: {word}  ({'raw' if show_all else 'playable only'}) ===")
    _print_rows(rows, word, play, show_all)
    return True


def _argsort_desc(sims):
    import numpy as np
    return np.argsort(-sims, kind="stable")


def show_ensemble(paths: list[str], word: str, top_k: int, play: Playability,
                  show_all: bool) -> bool:
    from .embeddings import ensemble as ens
    ids0 = vio.load(paths[0])[1]
    if word not in ids0:
        print(f"ensemble: '{word}' not in vocabulary")
        return False
    ranked = ens.neighbors_rank_average(paths, ids0.index(word), top_k * 6)
    rows = []
    for i, _score in ranked:
        w = ids0[i]
        if w == word:
            continue
        if show_all or play.playable(w):
            rows.append((w, None))
        if len(rows) >= top_k:
            break
    print(f"\n=== ensemble(rank-avg) :: {word} ===")
    _print_rows(rows, word, play, show_all)
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("word")
    ap.add_argument("--vectors", nargs="+", required=True)
    ap.add_argument("--top", type=int, default=50)
    ap.add_argument("--all", action="store_true", help="raw model output, hidden words tagged")
    args = ap.parse_args()

    try:
        import numpy  # noqa: F401
    except ImportError:
        sys.exit("pip install numpy  # required for inspect")

    word = clean_token(args.word)
    play = _playability()
    why = play.reason(word)
    if why:
        print(f"note: '{word}' itself is not playable ({why})")
    found_any = False
    for path in args.vectors:
        found_any = show_single(path, word, args.top, play, args.all) or found_any
    if len(args.vectors) > 1:
        found_any = show_ensemble(args.vectors, word, args.top, play, args.all) or found_any
    if not found_any:
        sys.exit(1)


if __name__ == "__main__":
    main()
