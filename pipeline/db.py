"""Database access for pipeline outputs (Postgres via psycopg2).

Environment:
  PIPELINE_DATABASE_URL  e.g. postgresql://oirkhon:secret@localhost:5432/oirkhon

Usage:
  python -m pipeline.db apply-schema
  python -m pipeline.db upsert-lemmas data/vocab/lemmas.tsv
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path

SCHEMA_PATH = Path(__file__).resolve().parent.parent / "db" / "migrations" / "001_init.sql"


def _connect():
    try:
        import psycopg2
    except ImportError as exc:
        raise SystemExit("pip install psycopg2-binary") from exc
    dsn = os.environ.get("PIPELINE_DATABASE_URL")
    if not dsn:
        raise SystemExit("set PIPELINE_DATABASE_URL")
    return psycopg2.connect(dsn)


def apply_schema() -> None:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
    print("[db] schema applied")


def upsert_lemmas(lemmas_tsv: Path) -> None:
    from .vocab import load_lemmas
    lemmas, freq = load_lemmas(Path(lemmas_tsv))
    with _connect() as conn, conn.cursor() as cur:
        from psycopg2.extras import execute_values
        rows = []
        # file format: lemma<TAB>freq<TAB>pos<TAB>rank
        import csv
        with open(lemmas_tsv, "r", encoding="utf-8") as fh:
            for parts in csv.reader(fh, delimiter="\t"):
                if len(parts) >= 3:
                    rows.append((parts[0], int(parts[1]), parts[2]))
        execute_values(
            cur,
            """INSERT INTO lemmas (lemma, frequency, pos) VALUES %s
               ON CONFLICT (lemma) DO UPDATE
                 SET frequency = EXCLUDED.frequency, pos = EXCLUDED.pos""",
            rows, page_size=5000,
        )
    print(f"[db] upserted {len(lemmas)} lemmas")


def upsert_word_forms(word_forms_jsonl: Path) -> None:
    import json
    with _connect() as conn, conn.cursor() as cur:
        from psycopg2.extras import execute_values
        rows = []
        with open(word_forms_jsonl, "r", encoding="utf-8") as fh:
            for line in fh:
                rec = json.loads(line)
                rows.append((rec["form"], rec["lemma"]))
        execute_values(
            cur,
            """INSERT INTO word_forms (form, lemma_id)
               SELECT f.form, l.id FROM (VALUES %s) AS f(form, lemma)
               JOIN lemmas l ON l.lemma = f.lemma
               ON CONFLICT (form) DO NOTHING""",
            rows, page_size=5000,
        )
    print(f"[db] upserted {len(rows)} word forms")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("apply-schema")
    p1 = sub.add_parser("upsert-lemmas")
    p1.add_argument("path")
    p2 = sub.add_parser("upsert-word-forms")
    p2.add_argument("path")
    args = ap.parse_args()
    if args.cmd == "apply-schema":
        apply_schema()
    elif args.cmd == "upsert-lemmas":
        upsert_lemmas(Path(args.path))
    elif args.cmd == "upsert-word-forms":
        upsert_word_forms(Path(args.path))


if __name__ == "__main__":
    main()
