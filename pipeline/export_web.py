"""Export a single runtime artifact for the Next.js app (spec §4).

Writes data/web/export.json.gz containing everything request-time code needs:
  schedule : draft puzzles (number, date, answer, difficulty)
  lemmas   : [[lemma, freq, pos], ...]
  forms    : {inflected form: lemma}
  ranks    : {puzzle_number: {lemma: rank}}  (full 1..N ranking per puzzle)

The answer lives here on disk/server only — guess routes expose ranks,
never the answer until solve/give-up.

Usage: python -m pipeline.export_web [--vectors data/vectors/fasttext_mn.npz]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json

from . import config
from .vocab import load_forms, load_lemmas


def build(vectors_path: str) -> None:
    try:
        import numpy as np
        from .embeddings import io as vio
    except ImportError as exc:
        raise SystemExit("pip install numpy") from exc

    schedule = []
    csv_path = config.META_DIR / "draft_schedule_30d.csv"
    if not csv_path.exists():
        raise SystemExit("run `python -m pipeline.schedule` first")
    for row in csv.DictReader(csv_path.open("r", encoding="utf-8")):
        schedule.append({
            "n": int(row["puzzle_number"]),
            "date": row["play_date"],
            "answer": row["lemma"],
            "difficulty": row["difficulty"],
        })

    lemmas, lfreq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    forms, _ffreq = load_forms(config.VOCAB_DIR / "forms.tsv")
    form_map = {}
    for line in open(config.VOCAB_DIR / "word_forms.jsonl", encoding="utf-8"):
        rec = json.loads(line)
        form_map[rec["form"]] = rec["lemma"]

    vectors, vec_ids = vio.load(vectors_path)
    vecs = vio.l2_normalize(vectors)
    index = {w: i for i, w in enumerate(vec_ids)}

    ranks: dict[str, dict[str, int]] = {}
    for item in schedule:
        answer = item["answer"]
        if answer not in index:
            print(f"[export] WARNING: answer '{answer}' not in vectors, skipped")
            continue
        sims = vecs @ vecs[index[answer]]
        order = np.argsort(-sims, kind="stable")
        ranks[str(item["n"])] = {vec_ids[i]: pos + 1 for pos, i in enumerate(order)}
        print(f"[export] puzzle {item['n']} '{answer}' ranked")

    out_dir = config.DATA_DIR / "web"
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "schedule": schedule,
        "lemmas": [[w, lfreq.get(w, 0)] for w in lemmas],
        "forms": form_map,
        "ranks": ranks,
    }
    out = out_dir / "export.json.gz"
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False)
    print(f"[export] wrote {out} ({out.stat().st_size/1e6:.1f} MB compressed)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--vectors", default="data/vectors/fasttext_mn.npz")
    args = ap.parse_args()
    build(args.vectors)


if __name__ == "__main__":
    main()
