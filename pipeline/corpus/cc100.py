"""CC-100 `mn` collector — one big xz-compressed text file.

https://data.statmt.org/cc-100/mn.txt.xz  (~1 GB compressed; stream it).
OSAR/HF `oscar-corpus/mn` is an alternative with the same line format.

Usage:
  python -m pipeline.corpus.cc100 [--file mn.txt.xz] [--max-lines N]
"""
from __future__ import annotations

import argparse
import lzma
from pathlib import Path
from urllib.request import urlopen

from .. import config
from ..alphabet import nfc
from ..textnorm import keep_document

CC100_URL = "https://data.statmt.org/cc-100/mn.txt.xz"


def _stream(path: str | None):
    if path:
        return lzma.open(path, "rt", encoding="utf-8")
    resp = urlopen(CC100_URL, timeout=120)
    return lzma.open(resp, "rt", encoding="utf-8")


def collect(out_dir: Path | None = None, max_lines: int = 0, file: str | None = None,
            chunk: int = 500_000) -> int:
    config.ensure_dirs()
    out_dir = out_dir or config.CORPUS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    total = kept = shard = 0
    fh_out = None

    def target():
        return out_dir / f"cc100_{shard:05d}.txt"

    for line in _stream(file):
        total += 1
        line = nfc(line.strip())
        if line and keep_document(line):
            if fh_out is None:
                fh_out = target().open("a", encoding="utf-8")
            fh_out.write(line + "\n")
            kept += 1
        if total % chunk == 0:
            if fh_out:
                fh_out.close()
                fh_out = None
                shard += 1
        if max_lines and total >= max_lines:
            break
    if fh_out:
        fh_out.close()
    print(f"[cc100] lines_seen={total} lines_kept={kept}")
    return kept


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--file", help="local mn.txt.xz instead of downloading")
    ap.add_argument("--max-lines", type=int, default=0)
    args = ap.parse_args()
    collect(max_lines=args.max_lines, file=args.file)


if __name__ == "__main__":
    main()
