"""Mongolian Wikipedia dump collector (spec §3.1).

Streams https://dumps.wikimedia.org/mnwiki/latest/mnwiki-latest-pages-articles.xml.bz2
(or a local --file), strips wiki markup, filters non-Cyrillic docs and writes
sentence-per-line shards under data/corpus/.

Usage:
  python -m pipeline.corpus.wiki [--file DUMP.xml.bz2] [--max-docs N] [--shard-size N]
"""
from __future__ import annotations

import argparse
import bz2
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import urlopen

from .. import config
from ..textnorm import iter_sentences, keep_document, normalize_document, strip_wiki_markup

DUMP_URL = "https://dumps.wikimedia.org/mnwiki/latest/mnwiki-latest-pages-articles.xml.bz2"


def _local(tag: str) -> str:
    """Strip the XML namespace — dump format versions differ (0.10/0.11)."""
    return tag.rsplit("}", 1)[-1]


def _open_stream(path: str | None):
    if path:
        return bz2.open(path, "rt", encoding="utf-8")
    resp = urlopen(DUMP_URL, timeout=60)
    return bz2.open(resp, "rt", encoding="utf-8")


def iter_pages(stream):
    """Yield (title, wikitext) using incremental parsing to stay flat in memory."""
    context = ET.iterparse(stream, events=("end",))
    for _event, elem in context:
        if _local(elem.tag) == "page":
            title_el = text_el = None
            for child in elem:
                if _local(child.tag) == "title":
                    title_el = child
                elif _local(child.tag) == "revision":
                    for sub in child:
                        if _local(sub.tag) == "text":
                            text_el = sub
            title = title_el.text or "" if title_el is not None else ""
            text = text_el.text or "" if text_el is not None else ""
            yield title, text
            elem.clear()


def collect(out_dir: Path | None = None, max_docs: int = 0, shard_size: int = 2000,
            file: str | None = None) -> int:
    config.ensure_dirs()
    out_dir = out_dir or config.CORPUS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    written = docs = shard_idx = 0
    buf: list[str] = []

    def flush():
        nonlocal buf, shard_idx, written
        if not buf:
            return
        shard = out_dir / f"wiki_{shard_idx:04d}.txt"
        with shard.open("a", encoding="utf-8") as fh:
            fh.write("\n".join(buf) + "\n")
        written += len(buf)
        buf = []
        shard_idx += 1

    stream = _open_stream(file)
    for title, text in iter_pages(stream):
        if ":" in title.split("/", 1)[0] and title.split(":", 1)[0] in {
            "File", "Image", "Category", "Template", "Wikipedia", "Help",
            "MediaWiki", "Portal", "Файл", "Зураг", "Ангилал", "Загвар",
        }:
            continue
        clean = strip_wiki_markup(normalize_document(text))
        if not keep_document(clean):
            continue
        sents = list(iter_sentences(clean))
        if len(sents) < 2:
            continue
        buf.extend(sents)
        buf.append("")  # blank line = document boundary
        docs += 1
        if len(buf) >= shard_size:
            flush()
        if max_docs and docs >= max_docs:
            break
    flush()
    print(f"[wiki] documents={docs} sentences={written} shards={shard_idx} -> {out_dir}")
    return written


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--file", help="local .xml.bz2 dump instead of downloading")
    ap.add_argument("--max-docs", type=int, default=0, help="stop after N documents (0=all)")
    ap.add_argument("--shard-size", type=int, default=2000, help="sentences per shard file")
    args = ap.parse_args()
    collect(max_docs=args.max_docs, shard_size=args.shard_size, file=args.file)


if __name__ == "__main__":
    main()
