"""Central paths and tunables for the pipeline.

All data artifacts live under PIPELINE_DATA_DIR (default: <repo>/data) which is
gitignored — corpora, vocab files and vectors are reproducible build outputs.
"""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("PIPELINE_DATA_DIR", REPO_ROOT / "data"))

CORPUS_DIR = DATA_DIR / "corpus"
VOCAB_DIR = DATA_DIR / "vocab"
VECTORS_DIR = DATA_DIR / "vectors"
META_DIR = DATA_DIR / "meta"

# Curated, version-controlled lists (admin-maintained, committed to git).
CURATED_DIR = Path(os.environ.get("PIPELINE_CURATED_DIR", REPO_ROOT / "meta"))

# --- vocabulary targets (spec §3.2) ---------------------------------------
TOP_FORMS = 40_000          # keep top word forms from the corpus
MAX_LEMMAS = 30_000         # final lemma vocabulary ceiling
MIN_FORM_FREQ = 5           # drop forms rarer than this before lemmatizing
MIN_LEMMA_FREQ = 3          # drop lemmas rarer than this after aggregation

# --- morphology ------------------------------------------------------------
MAX_SUFFIX_DEPTH = 3        # морь+д+оос = 2; leave headroom for stacking
REDUCE_MERGE_MARGIN = 1.3   # merge form->lemma only if lemma freq exceeds
                            # the surface form's freq by this factor

# --- answer candidates (spec §3.8) -----------------------------------------
ANSWER_MIN_LEN = 3
ANSWER_MAX_LEN = 9


def ensure_dirs() -> None:
    for d in (CORPUS_DIR, VOCAB_DIR, VECTORS_DIR, META_DIR):
        d.mkdir(parents=True, exist_ok=True)
