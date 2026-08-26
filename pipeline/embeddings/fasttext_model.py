"""fastText cc.mn.300 embeddings (subword-aware; handles morphology well).

Download the .bin from https://fasttext.cc/docs/en/crawl-vectors.html
(models/cc.mn.300.bin.gz) and decompress before running.

Usage:
  python -m pipeline.embeddings.fasttext_model --bin cc.mn.300.bin \
      --lemmas data/vocab/lemmas.tsv --out data/vectors/fasttext_mn.npz
"""
from __future__ import annotations

import argparse

import numpy as np

from ..vocab import load_lemmas
from . import io as vio


def embed(bin_path: str, lemmas_path: str):
    try:
        from gensim.models.fasttext import load_facebook_vectors
    except ImportError as exc:
        raise SystemExit("pip install gensim  # required for fastText loading") from exc

    lemmas, _freq = load_lemmas(lemmas_path)
    kv = load_facebook_vectors(bin_path)

    missing = 0
    vecs = np.zeros((len(lemmas), kv.vector_size), dtype=np.float32)
    for i, w in enumerate(lemmas):
        try:
            vecs[i] = kv.get_vector(w)  # OOV words come from ngrams (subword)
        except KeyError:
            missing += 1
    if missing:
        print(f"[fasttext] {missing} lemmas had no vector (zero-filled)")
    return vecs, lemmas


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bin", required=True)
    ap.add_argument("--lemmas", default="data/vocab/lemmas.tsv")
    ap.add_argument("--out", default="data/vectors/fasttext_mn.npz")
    args = ap.parse_args()
    vecs, ids = embed(args.bin, args.lemmas)
    vio.save(args.out, vio.l2_normalize(vecs), ids)


if __name__ == "__main__":
    main()
