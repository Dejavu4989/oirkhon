"""Shared base for sentence-transformers based models (e5 / LaBSE).

Usage:
  python -m pipeline.embeddings.st_model --model intfloat/multilingual-e5-large \
      --prompt query --lemmas data/vocab/lemmas.tsv --out data/vectors/e5_large.npz
  python -m pipeline.embeddings.st_model --model sentence-transformers/LaBSE \
      --lemmas data/vocab/lemmas.tsv --out data/vectors/labse.npz
"""
from __future__ import annotations

import argparse

from ..vocab import load_lemmas
from . import io as vio


def embed(model_name: str, lemmas_path: str, prompt: str | None,
          batch_size: int = 256, device: str | None = None):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise SystemExit(
            "pip install sentence-transformers torch  # required for ST models") from exc

    lemmas, _freq = load_lemmas(lemmas_path)
    texts = [f"{prompt}: {w}" if prompt else w for w in lemmas]
    model = SentenceTransformer(model_name, device=device)
    vecs = model.encode(
        texts, batch_size=batch_size, show_progress_bar=True,
        normalize_embeddings=False, convert_to_numpy=True,
    )
    return vecs.astype("float32"), lemmas


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--model", required=True)
    ap.add_argument("--prompt", default=None,
                    help="e.g. 'query' for e5 (becomes 'query: <word>')")
    ap.add_argument("--lemmas", default="data/vocab/lemmas.tsv")
    ap.add_argument("--out", required=True)
    ap.add_argument("--batch-size", type=int, default=256)
    args = ap.parse_args()
    vecs, ids = embed(args.model, args.lemmas, args.prompt, args.batch_size)
    vio.save(args.out, vio.l2_normalize(vecs), ids)


if __name__ == "__main__":
    main()
