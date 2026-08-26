"""Form-dictionary construction (spec §3.3 step 1).

Runs the rule-based lemmatizer over frequent corpus forms; keeps mappings that
are unambiguous enough to trust, producing word_forms.jsonl consumed at runtime
by the API's morphology instance (dictionary-first).

Usage:
  python -m pipeline.forms build
"""
from __future__ import annotations

import json

from . import config
from .morphology import Morphology
from .vocab import load_forms, load_lemmas


def load_manual_merges():
    """Curated form->lemma overrides (meta/manual_merges.tsv, form<TAB>lemma).

    For cases frequency cannot decide: мориноор maps to морин by corpus
    statistics (poetic морин outnumbers морь on Wikipedia) but the game wants
    the modern citation form. Dictionary entries win at lookup time
    (dictionary-first), so these overrides take effect for guesses.
    """
    path = config.CURATED_DIR / "manual_merges.tsv"
    if not path.exists():
        return {}
    merges = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) == 2:
            merges[parts[0]] = parts[1]
    return merges


def build(min_form_freq: int | None = None) -> int:
    forms_path = config.VOCAB_DIR / "forms.tsv"
    lemmas_path = config.VOCAB_DIR / "lemmas.tsv"
    if not forms_path.exists() or not lemmas_path.exists():
        raise SystemExit("run `python -m pipeline.vocab` first")

    forms, form_freq = load_forms(forms_path)
    lemma_list, lemma_freq = load_lemmas(lemmas_path)
    lemma_set = set(lemma_list)

    min_form_freq = min_form_freq or max(config.MIN_FORM_FREQ, 10)
    candidates = [(f, c) for f, c in zip(forms, [form_freq[f] for f in forms])
                  if c >= min_form_freq]

    morph = Morphology(vocab=lemma_set, freq=form_freq)
    manual = load_manual_merges()
    out_path = config.VOCAB_DIR / "word_forms.jsonl"
    kept = ambiguous = 0
    emitted: set[str] = set()
    with out_path.open("w", encoding="utf-8") as fh:

        def emit(form: str, lemma: str, freq: int, source: str):
            nonlocal kept
            if form in emitted or lemma not in lemma_set or lemma == form:
                return
            fh.write(json.dumps({"form": form, "lemma": lemma, "freq": freq,
                                 "source": source}, ensure_ascii=False) + "\n")
            emitted.add(form)
            kept += 1

        for form, lemma in manual.items():
            emit(form, lemma, 0, "manual")

        for form, c in candidates:
            if form in emitted:
                continue
            if form in lemma_set:
                continue  # already a lemma itself
            cands = morph.all_candidates(form)
            if not cands:
                continue
            best_depth = min(cands.values())
            top = sorted(
                (l for l, d in cands.items() if d == best_depth),
                key=lambda l: (-form_freq.get(l, 0), len(l), l),
            )
            if len(top) != 1:
                ambiguous += 1
                continue  # only keep unambiguous derivations
            lemma = top[0]
            if lemma_freq.get(lemma, 0) < config.MIN_LEMMA_FREQ:
                continue
            emit(form, lemma, c, "rules")
    print(f"[forms] mappings={kept:,} ambiguous_skipped={ambiguous:,} -> {out_path}")
    return kept


def load(path=None) -> dict[str, str]:
    path = path or (config.VOCAB_DIR / "word_forms.jsonl")
    mapping: dict[str, str] = {}
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            mapping[rec["form"]] = rec["lemma"]
    return mapping


def main() -> None:
    build()


if __name__ == "__main__":
    main()
