"""Mongolian Cyrillic alphabet, vowel harmony and character-level utilities.

Mongolian Cyrillic (as used in Mongolia):
    а б в г д е ё ж з и й к л м н о ө п р с т у ү ф х ц ч ш щ ъ ы ь э ю я Ө Ү

Vowel harmony groups:
    back   (эрийн эгшгээ):  а о у ы (iotated я ё ю behave as their vowels: а/о/у)
    front  (нарийн эгшгээ): э ө ү
    neutral: и е
"""
from __future__ import annotations

import re
import unicodedata

BACK_VOWELS = frozenset("аоуыяёю")
FRONT_VOWELS = frozenset("эөү")
NEUTRAL_VOWELS = frozenset("ие")
ALL_VOWELS = BACK_VOWELS | FRONT_VOWELS | NEUTRAL_VOWELS

LOWER_LETTERS = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяөү"
UPPER_LETTERS = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯӨҮ"
MN_LETTERS = frozenset(LOWER_LETTERS + UPPER_LETTERS)

_TOKEN_RE = re.compile(r"[а-яёөүА-ЯЁӨҮ]+(?:-[а-яёөүА-ЯЁӨҮ]+)?")

# Latin lookalikes typed by accident on mixed keyboards [LOCKED spec §3.4].
LATIN_LOOKALIKE = {
    "o": "о", "y": "у", "e": "е", "a": "а", "c": "с", "p": "р",
    "x": "х", "k": "к", "m": "м", "t": "т", "h": "н", "b": "в",
}

# Pairs treated as cost-0.5 substitutions in fuzzy matching (spec §3.4).
CONFUSABLE_PAIRS = frozenset(
    frozenset(pair)
    for pair in (("о", "ө"), ("у", "ү"), ("е", "э"), ("и", "й"), ("ц", "ч"))
)

_PUNCT_STRIP = "\"'`“”«»()[]{}.,!?;:*…—–‐‑‒−_/"


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def clean_token(raw: str) -> str:
    """Trim, lowercase, NFC-normalize, strip wrapping punctuation.

    Does NOT apply the Latin lookalike map — see to_cyrillic_lookalikes();
    guess resolution applies it as a fallback pass.
    """
    s = nfc(raw).strip().lower()
    s = s.strip(_PUNCT_STRIP + " ")
    return s.strip()


def is_mn_word(token: str) -> bool:
    """True if every alphabetic char is Mongolian Cyrillic (hyphen allowed inside)."""
    if not token or len(token.replace("-", "")) < 1:
        return False
    return all(ch in MN_LETTERS or ch == "-" for ch in token)


def find_tokens(text: str):
    """Yield normalized tokens from free text."""
    for m in _TOKEN_RE.finditer(text):
        tok = clean_token(m.group(0))
        if tok and is_mn_word(tok):
            yield tok


def last_harmony(word: str) -> str | None:
    """'back' | 'front' | None — harmony class driven by the last definite vowel."""
    for ch in reversed(word.lower()):
        if ch in BACK_VOWELS:
            return "back"
        if ch in FRONT_VOWELS:
            return "front"
    return None


def to_cyrillic_lookalikes(s: str) -> str:
    """Map stray Latin letters onto their Cyrillic lookalikes."""
    return "".join(LATIN_LOOKALIKE.get(ch, ch) for ch in s)


def sub_cost(a: str, b: str) -> float:
    if a == b:
        return 0.0
    if frozenset((a, b)) in CONFUSABLE_PAIRS:
        return 0.5
    return 1.0
