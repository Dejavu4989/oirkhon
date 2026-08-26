"""Mongolian news-site collector skeleton.

Respects robots.txt, sends a descriptive UA, rate-limits requests.
Site-specific article URL patterns live in SITES; extend per site after
checking each site's terms and robots.txt before enabling it.

Usage:
  python -m pipeline.corpus.news --site ikon --max-pages 50
"""
from __future__ import annotations

import argparse
import re
import time
import urllib.robotparser
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from .. import config
from ..textnorm import iter_sentences, keep_document, normalize_document

USER_AGENT = "OirkhonCorpusBot/0.1 (+contact: admin@oirkhon.example)"
DELAY_SECONDS = 3.0

SITES: dict[str, dict] = {
    # Enable only after robots.txt review. Patterns are Python regexps matched
    # against absolute hrefs found on the section pages listed in `seeds`.
    # "ikon": {
    #     "seeds": ["https://ikon.mn/"],
    #     "article": re.compile(r"^https://ikon\.mn/[a-z0-9\-]+/\d+$"),
    #     "paragraph_selector": lambda attrs, cls: "p" == tag,
    # },
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._skip = 0
        self.chunks: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer", "header"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer", "header") and self._skip:
            self._skip -= 1
        if tag == "p" and self._buf:
            text = " ".join(self._buf).strip()
            if text:
                self.chunks.append(text)
            self._buf = []

    def handle_data(self, data):
        if not self._skip:
            self._buf.append(data)


def fetch(url: str) -> str | None:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=30) as resp:
            if resp.headers.get_content_type() != "text/html":
                return None
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001 — crawler must survive bad pages
        print(f"[news] fetch failed {url}: {exc}")
        return None


def allowed(rp: urllib.robotparser.RobotFileParser, url: str) -> bool:
    try:
        return rp.can_fetch(USER_AGENT, url)
    except Exception:  # noqa: BLE001
        return False


def crawl(site: str, max_pages: int = 50) -> int:
    if site not in SITES:
        raise SystemExit(f"site '{site}' not configured — review robots.txt first, "
                         f"then add selectors to SITES in pipeline/corpus/news.py")
    cfg = SITES[site]
    config.ensure_dirs()
    rp = urllib.robotparser.RobotFileParser()
    seed = cfg["seeds"][0]
    root = "/".join(seed.split("/")[:3])
    rp.set_url(urljoin(root, "/robots.txt"))
    rp.read()

    queue = list(cfg["seeds"])
    seen: set[str] = set()
    saved = 0
    while queue and saved < max_pages:
        url = queue.pop(0)
        if url in seen or not allowed(rp, url):
            continue
        seen.add(url)
        time.sleep(DELAY_SECONDS)
        html = fetch(url)
        if html is None:
            continue
        if cfg["article"].match(url):
            parser = _TextExtractor()
            parser._buf = []  # type: ignore[attr-defined]
            parser.feed(html)
            text = normalize_document("\n".join(parser.chunks))
            if keep_document(text):
                out = config.CORPUS_DIR / f"news_{site}.txt"
                with out.open("a", encoding="utf-8") as fh:
                    for sent in iter_sentences(text):
                        fh.write(sent + "\n")
                saved += 1
        for href in re.findall(r'href="([^"#]+)"', html):
            absolute = urljoin(url, href)
            if cfg["article"].match(absolute) and absolute not in seen:
                queue.append(absolute)
    print(f"[news:{site}] articles_saved={saved}")
    return saved


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--site", required=True)
    ap.add_argument("--max-pages", type=int, default=50)
    args = ap.parse_args()
    crawl(args.site, args.max_pages)


if __name__ == "__main__":
    main()
