"""Export a single runtime artifact for the Next.js app (spec §4).

Writes data/web/export.json.gz containing everything request-time code needs:
  format   : 2
  schedule : draft puzzles (number, date, answer, difficulty)
  lemmas   : [[lemma, freq], ...]           every word a player may guess
  forms    : {inflected form: lemma}
  playable : [lemma, ...]                    the rank space (see below)
  ranks    : {puzzle_number: [rank, ...]}   one int per lemma, aligned to `lemmas`

The rank space
--------------
Every guess is ranked among the *playable* words only — nouns fit to play with
(pipeline.playable): no verb forms, no proper nouns, no inflected leftovers, no
function words. Those words get dense ranks 1..K. Every other known word is
still guessable and gets the rank it would have had among the playable words
("how many playable words are closer than this"), so a player who types a verb
sees an honest number without verbs ever being offered as hints.

Per-answer exclusions (meta/answer_exclusions.tsv) push a word that fastText
places close for the wrong sense to the very bottom of that puzzle.

The answer lives here on disk/server only — guess routes expose ranks, never
the answer until solve/give-up.

Usage: python -m pipeline.export_web [--vectors data/vectors/fasttext_mn.npz]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json

from . import config
from .playable import Playability
from .vocab import load_lemmas


def load_answer_exclusions() -> dict[str, set[str]]:
    path = config.CURATED_DIR / "answer_exclusions.tsv"
    out: dict[str, set[str]] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        parts = line.strip().split("\t")
        if len(parts) == 2:
            out.setdefault(parts[0].strip(), set()).add(parts[1].strip())
    return out


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
    form_map = {}
    for line in open(config.VOCAB_DIR / "word_forms.jsonl", encoding="utf-8"):
        rec = json.loads(line)
        form_map[rec["form"]] = rec["lemma"]

    play = Playability.from_data(lemmas, lfreq)
    playable = [w for w in lemmas if play.playable(w)]
    playable_set = set(playable)
    exclusions = load_answer_exclusions()

    vectors, vec_ids = vio.load(vectors_path)
    vecs = vio.l2_normalize(vectors)
    index = {w: i for i, w in enumerate(vec_ids)}
    pos_in_lemmas = {w: i for i, w in enumerate(lemmas)}
    missing = [w for w in lemmas if w not in index]
    if missing:
        print(f"[export] WARNING: {len(missing)} lemmas have no vector "
              f"(e.g. {missing[:5]}) — they will rank last")
    all_vec_idx = np.array([index.get(w, -1) for w in lemmas])
    has_vec = all_vec_idx >= 0

    ranks: dict[str, list[int]] = {}
    for item in schedule:
        answer = item["answer"]
        if answer not in index:
            print(f"[export] WARNING: answer '{answer}' not in vectors, skipped")
            continue
        excluded = exclusions.get(answer, set())
        # The rank space for this puzzle: playable words minus exclusions, plus
        # the answer itself even when today's rules would not choose it — old
        # puzzles must keep working for the archive.
        space = [w for w in playable if w not in excluded and w in index]
        if answer not in playable_set:
            space.append(answer)
        space_idx = np.array([index[w] for w in space])

        sims_all = vecs @ vecs[index[answer]]
        sims_space = sims_all[space_idx]
        order = np.argsort(-sims_space, kind="stable")
        dense = {space[j]: pos + 1 for pos, j in enumerate(order)}
        K = len(space)

        # Everyone else: 1 + number of playable words strictly closer.
        desc = -np.sort(-sims_space)
        out = np.full(len(lemmas), K, dtype=np.int32)
        sims_lemmas = np.where(has_vec, sims_all[np.where(has_vec, all_vec_idx, 0)], -np.inf)
        out[has_vec] = 1 + np.searchsorted(-desc, -sims_lemmas[has_vec], side="left")
        for w, r in dense.items():
            out[pos_in_lemmas[w]] = r
        for w in excluded:
            if w in pos_in_lemmas:
                out[pos_in_lemmas[w]] = K
        assert out[pos_in_lemmas[answer]] == 1, answer
        ranks[str(item["n"])] = out.tolist()

        top = [space[j] for j in order[1:6]]
        flag = " *" if answer not in playable_set else ""
        print(f"[export] #{item['n']:<3} {answer:<14}{flag} -> {' '.join(top)}")

    out_dir = config.DATA_DIR / "web"
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "format": 2,
        "schedule": schedule,
        "lemmas": [[w, lfreq.get(w, 0)] for w in lemmas],
        "forms": form_map,
        "playable": playable,
        "ranks": ranks,
    }
    out = out_dir / "export.json.gz"
    with gzip.open(out, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"[export] {len(lemmas)} lemmas, {len(playable)} playable, "
          f"{len(ranks)} puzzles -> {out} ({out.stat().st_size / 1e6:.1f} MB compressed)")
    print("[export] * = answer drafted before the current rules; kept for the archive")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vectors", default="data/vectors/fasttext_mn.npz")
    args = ap.parse_args()
    build(args.vectors)


if __name__ == "__main__":
    main()
