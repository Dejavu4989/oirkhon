"""Document-level normalization: NFC, script filtering, sentence iteration,
and Wikipedia markup stripping.

Corpus ingestion contract (spec §3.1): normalize to NFC, strip documents that
are not predominantly Mongolian Cyrillic, drop CJK/heavy-Latin docs.
"""
from __future__ import annotations

import re

from .alphabet import MN_LETTERS, nfc

_CJK_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
_SENT_SPLIT_RE = re.compile(r"[.!?…\n]+")
_URL_RE = re.compile(r"https?://\S+|www\.\S+")


def script_profile(text: str) -> dict:
    alpha = [ch for ch in text if ch.isalpha()]
    total = len(alpha)
    cyr = sum(1 for ch in alpha if ch in MN_LETTERS)
    lat = sum(1 for ch in alpha if ch.isascii())
    return {
        "alpha": total,
        "cyrillic": cyr,
        "latin": lat,
        "has_cjk": bool(_CJK_RE.search(text)),
    }


def keep_document(text: str, min_cyr_ratio: float = 0.6, max_latin_ratio: float = 0.3) -> bool:
    prof = script_profile(text)
    if prof["alpha"] < 20 or prof["has_cjk"]:
        return False
    if prof["cyrillic"] / prof["alpha"] < min_cyr_ratio:
        return False
    return prof["latin"] / prof["alpha"] <= max_latin_ratio


def iter_sentences(text: str):
    for sent in _SENT_SPLIT_RE.split(text):
        sent = sent.strip()
        if 2 <= len(sent) <= 300:
            yield sent


def normalize_document(text: str) -> str:
    return nfc(text.replace("\r\n", "\n").replace("\r", "\n"))


# --- Wikipedia markup stripping (streaming-friendly, no deps) ---------------

_TEMPLATE_RE = re.compile(r"\{\{[^{}]*\}\}", re.DOTALL)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_REF_RE = re.compile(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", re.DOTALL | re.IGNORECASE)
_TABLE_RE = re.compile(r"\{\|.*?\|\}", re.DOTALL)
_TAG_RE = re.compile(r"</?[a-z][^>]*>", re.IGNORECASE)
_WIKILINK_RE = re.compile(r"\[\[(?:[^\[\]|]*\|)?([^\[\]|]*)\]\]")
_EXT_LINK_RE = re.compile(r"\[(?:https?://|mailto:)[^\s\]]+(?:\s+([^\]]+))?\]")
_HEADING_RE = re.compile(r"^=+\s*(.*?)\s*=+$", re.MULTILINE)
_BOLD_RE = re.compile(r"'{2,5}")
_FILE_LINES_RE = re.compile(r"^(File|Image|Файл|Зураг):.*$", re.MULTILINE | re.IGNORECASE)
_BLANK_RE = re.compile(r"\n{3,}")


def strip_wiki_markup(text: str) -> str:
    text = _COMMENT_RE.sub(" ", text)
    text = _REF_RE.sub(" ", text)
    # Nested templates/files: peel innermost braces repeatedly (bounded).
    for _ in range(12):
        new = _TEMPLATE_RE.sub(" ", text)
        if new == text:
            break
        text = new
    text = _TABLE_RE.sub(" ", text)
    text = _WIKILINK_RE.sub(r"\1", text)
    text = _EXT_LINK_RE.sub(r"\1", text)
    text = _TAG_RE.sub(" ", text)
    text = _HEADING_RE.sub(r"\1", text)
    text = _BOLD_RE.sub("", text)
    text = _URL_RE.sub(" ", text)
    text = _FILE_LINES_RE.sub(" ", text)
    text = _BLANK_RE.sub("\n\n", text)
    return text
