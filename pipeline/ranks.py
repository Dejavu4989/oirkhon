"""Rank precomputation (spec §3.9).

For a scheduled answer: cosine-similarity against the whole vocabulary,
descending sort, full ranked list persisted to Postgres `puzzle_ranks`
(PK (puzzle_id, lemma_id)) and cached in Redis as hash ranks:{puzzle_id}.

Usage:
  python -m pipeline.ranks --vectors data/vectors/best.npz \
      --answer морь --puzzle-id 267 [--dsn $PIPELINE_DATABASE_URL] [--redis $PIPELINE_REDIS_URL]
"""
from __future__ import annotations

import argparse

from .embeddings import io as vio


def ranked_list(vectors, ids: list[str], answer_idx: int) -> list[tuple[str, int]]:
    """Full ranking: rank 1 = the answer itself."""
    vecs = vio.l2_normalize(vectors)
    sims = vecs @ vecs[answer_idx]
    order = np_argsort(sims)
    return [(ids[i], pos + 1) for pos, i in enumerate(order)]


def np_argsort(sims):
    import numpy as np
    return np.argsort(-sims, kind="stable")


def index_of(ids: list[str], word: str) -> int:
    try:
        return ids.index(word)
    except ValueError as exc:
        raise SystemExit(f"'{word}' not in vocabulary — lemmatize it first") from exc


def write_postgres(puzzle_id: int, ranked: list[tuple[str, int]], dsn: str,
                   lemma_to_id: dict[str, int] | None = None) -> None:
    try:
        import psycopg2
    except ImportError as exc:
        raise SystemExit("pip install psycopg2-binary") from exc
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        rows = []
        for lemma, rank in ranked:
            lid = (lemma_to_id or {}).get(lemma)
            if lid is None:
                cur.execute("SELECT id FROM lemmas WHERE lemma = %s", (lemma,))
                row = cur.fetchone()
                lid = row[0] if row else None
            if lid is not None:
                rows.append((puzzle_id, lid, rank))
        cur.execute("DELETE FROM puzzle_ranks WHERE puzzle_id = %s", (puzzle_id,))
        psycopg2.extras.execute_values(
            cur,
            "INSERT INTO puzzle_ranks (puzzle_id, lemma_id, rank) VALUES %s",
            rows, page_size=5000,
        )
    print(f"[ranks] puzzle {puzzle_id}: {len(rows)} rows written to postgres")


def write_redis(puzzle_id: int, ranked: list[tuple[str, int]], url: str) -> None:
    try:
        import redis
    except ImportError as exc:
        raise SystemExit("pip install redis") from exc
    client = redis.Redis.from_url(url)
    key = f"ranks:{puzzle_id}"
    pipe = client.pipeline()
    pipe.delete(key)
    mapping = {lemma.encode("utf-8"): str(rank) for lemma, rank in ranked}
    for start in range(0, len(mapping), 10_000):
        chunk = list(mapping.items())[start:start + 10_000]
        pipe.hset(key, mapping=dict(chunk))
    pipe.execute()
    print(f"[ranks] puzzle {puzzle_id}: redis cache written ({key})")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--vectors", required=True)
    ap.add_argument("--answer", required=True, help="answer lemma (surface form)")
    ap.add_argument("--puzzle-id", type=int, required=True)
    ap.add_argument("--dsn", default=None)
    ap.add_argument("--redis", default=None)
    args = ap.parse_args()

    vectors, ids = vio.load(args.vectors)
    ranked = ranked_list(vectors, ids, index_of(ids, args.answer))
    print(f"[ranks] top-5 for '{args.answer}': "
          + ", ".join(f"{w}({r})" for w, r in ranked[:5]))
    if args.dsn:
        write_postgres(args.puzzle_id, ranked, args.dsn)
    if args.redis:
        write_redis(args.puzzle_id, ranked, args.redis)


if __name__ == "__main__":
    main()
