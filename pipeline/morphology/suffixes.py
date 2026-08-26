"""Mongolian morphology: suffix inventory + lemmatizer (spec §3.3).

Design (dictionary-first, rules as fallback):
  1. word_forms dictionary hit  → lemma
  2. surface form already in vocabulary → identity
  3. bounded BFS suffix stripping with vowel-harmony pruning; every candidate
     endpoint must exist in the vocabulary/form dictionary ("never strip a
     suffix if the result is not in the vocabulary").
"""
from __future__ import annotations

# Suffix groups. Surface variants include connective-vowel and oblique-stem
# spellings so that a single strip can land on the citation stem; the
# vocabulary check arbitrates which parses are real.

GROUPS: dict[str, tuple[str, ...]] = {
    # --- nominal case -------------------------------------------------------
    "genitive": ("ын", "ийн", "ы", "ий", "н", "ны", "ний", "ины"),
    "accusative": ("ыг", "ийг", "г", "ныг", "нийг"),
    "dative_locative": (
        "д", "т",
        "ад", "эд", "од", "өд", "ид", "нд", "онд", "өнд",
        "ард", "эрд", "орд", "өрд", "анд", "энд",
        # dative/locative + reflexive possessive compounds: найздаа, аавдаа …
        "даа", "дээ", "доо", "дөө", "таа", "тээ", "тоо", "төө",
    ),
    "ablative": ("аас", "ээс", "оос", "өөс", "ноос", "нөөс",
                 # й-glide spellings after ь/й-final stems: сургууляас
                 "яас", "яэс"),
    "instrumental": ("аар", "ээр", "оор", "өөр", "гаар", "гээр", "гоор", "гөөр",
                     "ноор", "нөөр", "яар", "яэр"),
    "comitative": ("тай", "тэй", "той"),
    # --- plural -------------------------------------------------------------
    "plural": ("ууд", "үүд", "нууд", "нүүд", "чууд", "чүүд"),
    # --- negation / possession ----------------------------------------------
    "negation": ("гүй",),
    "possessive": ("аа", "ээ", "оо", "өө", "гаа", "гээ", "гоо", "гөө", "иоо", "игоо", "игээ"),
    # --- verb morphology ------------------------------------------------------
    "verb_past": ("сан", "сэн", "сон", "сөн"),
    "verb_habitual": ("даг", "дэг", "дог"),
    "verb_past1st": ("лаа", "лээ", "лоо", "лөө"),
    "verb_future": ("на", "нэ", "но", "нө"),
    "verb_converb": ("ж", "ч"),
    "verb_infinitive": ("х",),   # special-cased in the lemmatizer
}

VERBAL_GROUPS = frozenset(
    {
        "verb_past", "verb_habitual", "verb_past1st",
        "verb_future", "verb_converb", "negation", "verb_infinitive",
    }
)

# Harmony class of suffix variants. Values:
#   "back"/"front" — must match stem harmony
#   None           — invariant/exempt: the connective-и series attaches after
#                    й/ш/ж/ч finals regardless of stem harmony (морийг,
#                    багшийн), and negation -гүй is invariable (чадахгүй).
# Everything not listed derives its harmony from its own vowels.
HARMONY_OVERRIDES = {
    "ийн": None, "ийг": None, "ий": None,
    "ний": None, "нийг": None, "ины": None, "иоо": None, "игоо": None, "игээ": None,
    "гүй": None,
    "ын": "back", "ыг": "back", "ы": "back", "ны": "back", "ныг": "back",
    "ид": "front", "эд": "front", "ад": "back", "од": "back", "өд": "front",
    "онд": "back", "өнд": "front", "анд": "back", "энд": "front",
    "ууд": "back", "үүд": "front", "нууд": "back", "нүүд": "front",
    "ээс": "front", "аас": "back", "оос": "back", "өөс": "front",
    "ээр": "front", "аар": "back", "оор": "back", "өөр": "front",
    "тэй": "front", "той": "back", "тай": "back",
    "сэн": "front", "сан": "back", "сон": "back", "сөн": "front",
    "дэг": "front", "даг": "back", "дог": "back",
    "лээ": "front", "лаа": "back", "лоо": "back", "лөө": "front",
    "нэ": "front", "на": "back", "но": "back", "нө": "front",
    "ээ": "front", "аа": "back", "оо": "back", "өө": "front",
}


def all_suffixes() -> list[tuple[str, str]]:
    """(suffix, group) sorted longest-first for matching."""
    items: list[tuple[str, str]] = []
    seen: set[str] = set()
    for group, variants in GROUPS.items():
        for v in variants:
            if v not in seen:
                seen.add(v)
                items.append((v, group))
    items.sort(key=lambda t: (-len(t[0]), t[0]))
    return items


ALL_SUFFIXES: tuple[tuple[str, str], ...] = tuple(all_suffixes())

CONNECTIVES_BACK = ("", "а", "о", "и")
CONNECTIVES_FRONT = ("", "э", "ө", "и")
# Repair characters inserted into syncopated stems (өдр→өдөр, ажл→ажил,
# сургуул→сургууль). Vocabulary membership arbitrates every candidate.
INSERT_VOWELS_BACK = "аоуиь"
INSERT_VOWELS_FRONT = "эөүиь"

