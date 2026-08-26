"""Vocabulary construction (spec §3.2).

Tokenizes corpus shards, counts frequency, keeps the top ~40k word forms,
reduces to lemmas via the morphology engine, applies filters, and writes:

  data/vocab/forms.tsv    form<TAB>freq
  data/vocab/lemmas.tsv   lemma<TAB>freq<TAB>pos<TAB>rank
  data/vocab/meta.json    build parameters + stats

Usage:
  python -m pipeline.vocab build [--top 40000] [--min-freq 5]
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from . import config
from .alphabet import clean_token, is_mn_word
from .morphology import Morphology


def count_forms(corpus_dir: Path | None = None):
    """Returns (form_counter, cap_counter).

    cap_counter tracks how often each (lowercased) token occurred
    Capitalized mid-sentence — the signal for proper-noun detection (§3.2).
    """
    import re
    corpus_dir = corpus_dir or config.CORPUS_DIR
    counter: Counter = Counter()
    cap_counter: Counter = Counter()
    files = sorted(corpus_dir.glob("*.txt"))
    if not files:
        raise SystemExit(f"no corpus shards under {corpus_dir} — run a collector first")
    token_re = re.compile(r"[а-яёөүА-ЯЁӨҮ]+(?:-[а-яёөүА-ЯЁӨҮ]+)?")
    for path in files:
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                found = token_re.findall(line)
                if not found:
                    continue
                for i, tok in enumerate(found):
                    norm = clean_token(tok)
                    if not norm or not is_mn_word(norm):
                        continue
                    counter[norm] += 1
                    if i > 0 and tok[0].isupper() and tok[1:].islower():
                        cap_counter[norm] += 1
    return counter, cap_counter


def guess_pos(lemma: str) -> str:
    # Crude first pass: citation form of Mongolian verbs ends in -х.
    # Refine later against a dictionary source; admin panel can override.
    if lemma.endswith("х") and len(lemma) >= 3:
        return "verb"
    return "noun"


def load_lemmas(path: Path) -> tuple[list[str], dict[str, int]]:
    lemmas: list[str] = []
    freq: dict[str, int] = {}
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 2:
                lemmas.append(parts[0])
                freq[parts[0]] = int(parts[1])
    return lemmas, freq


def load_forms(path: Path) -> tuple[list[str], dict[str, int]]:
    return load_lemmas(path)  # same TSV shape (form, freq)


def load_no_merge():
    """Forms that must never be merged into a lemma (admin-maintained).

    Frequency margins cannot catch everything: багана ('pole') is genuinely
    rarer than бага ('small'), but they are different words. Admins add one
    form per line to data/meta/no_merge.txt.
    """
    path = config.CURATED_DIR / "no_merge.txt"
    if not path.exists():
        return frozenset()
    return frozenset(
        line.strip() for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    )


def reduce_to_lemma(form: str, freq: int, morph: Morphology,
                    margin: float = config.REDUCE_MERGE_MARGIN,
                    no_merge: frozenset | None = None) -> str:
    """Frequency-margin reduction (spec §3.2 step 3).

    A form merges into a derived lemma only when that lemma is clearly more
    frequent than the form itself — so ноход → нохой merges, but багана does
    not collapse into бага (protected by no_merge).
    """
    if no_merge and form in no_merge:
        return form
    cands = morph.all_candidates(form)
    best_key = None
    best_lemma = None
    for lemma, depth in cands.items():
        if lemma == form:
            continue
        f = morph.freq.get(lemma, 0)
        if f < margin * max(freq, 1):
            continue
        key = (-f, depth, len(lemma), lemma)
        if best_key is None or key < best_key:
            best_key, best_lemma = key, lemma
    return best_lemma if best_lemma is not None else form


def build(top: int = config.TOP_FORMS, min_freq: int = config.MIN_FORM_FREQ,
          corpus_dir: Path | None = None) -> None:
    config.ensure_dirs()
    counts, cap_counts = count_forms(corpus_dir)
    forms = [(f, c) for f, c in counts.most_common(top) if c >= min_freq and len(f) >= 2]
    print(f"[vocab] distinct tokens={len(counts):,} kept forms={len(forms):,}")

    forms_path = config.VOCAB_DIR / "forms.tsv"
    with forms_path.open("w", encoding="utf-8") as fh:
        for form, c in forms:
            fh.write(f"{form}\t{c}\n")

    # Proper-noun evidence: capitalized-mid-sentence ratio (§3.2 drop rule).
    capitals_path = config.VOCAB_DIR / "capitals.tsv"
    with capitals_path.open("w", encoding="utf-8") as fh:
        for tok, cap in cap_counts.most_common():
            total = counts.get(tok, 0)
            if total >= 10 and cap / total >= 0.5:
                fh.write(f"{tok}\t{cap}\t{total}\n")

    # Reduce to lemmas. First pass is rule-only (no dictionary yet).
    vocab_set = {f for f, _ in forms}
    morph = Morphology(vocab=vocab_set, freq=dict(forms))
    no_merge = load_no_merge()
    lemma_counts: Counter = Counter()
    merged = 0
    for form, c in forms:
        lemma = reduce_to_lemma(form, c, morph, no_merge=no_merge)
        if lemma != form:
            merged += 1
        lemma_counts[lemma] += c
    lemmas = [(l, c) for l, c in lemma_counts.most_common(config.MAX_LEMMAS)
              if c >= config.MIN_LEMMA_FREQ and len(l) >= 2]

    lemmas_path = config.VOCAB_DIR / "lemmas.tsv"
    with lemmas_path.open("w", encoding="utf-8") as fh:
        for rank, (lemma, c) in enumerate(lemmas, start=1):
            fh.write(f"{lemma}\t{c}\t{guess_pos(lemma)}\t{rank}\n")

    meta = {
        "distinct_tokens": len(counts),
        "kept_forms": len(forms),
        "lemmas": len(lemmas),
        "merged_forms": merged,
        "top": top,
        "min_form_freq": min_freq,
        "merge_margin": config.REDUCE_MERGE_MARGIN,
    }
    (config.VOCAB_DIR / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[vocab] merged {merged:,} inflected forms; lemmas={len(lemmas):,} -> {lemmas_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--top", type=int, default=config.TOP_FORMS)
    ap.add_argument("--min-freq", type=int, default=config.MIN_FORM_FREQ)
    args = ap.parse_args()
    build(top=args.top, min_freq=args.min_freq)


if __name__ == "__main__":
    main()
