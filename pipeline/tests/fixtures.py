"""Shared fixtures: a miniature vocabulary + form dictionary covering every
hand-checked pair in test_morphology, plus realistic distractors."""
from __future__ import annotations

from pipeline.morphology import Morphology

# Citation forms / lemmas (nouns and verb infinitives).
VOCAB_WORDS = [
    # nouns
    "нохой", "гэр", "хот", "ном", "багш", "эмч", "ажил", "нар", "мод",
    "өвөл", "цаг", "хүүхэд", "сургууль", "машин", "найз", "хоол", "дуу",
    "эм", "морь", "тэмээ", "гар", "аав", "ээж", "гутал", "өдөр",
    # realistic distractors: words that overlap with inflected patterns
    "хий",      # noun 'air' — collides with хийнэ → must yield verb хийх
    "хар",      # 'black' — collides with харсан
    "хэл",      # 'language' — collides with хэлсэн
    "модон",    # oblique form of мод — depth tie-break check
    # verbs (infinitives)
    "байх", "чадах", "явах", "үзэх", "орах", "өгөх", "унших", "ярих",
    "очих", "суух", "ирэх", "болох", "гуйх", "мэдэх", "хүсэх", "хэлэх",
    "авах", "олох", "бичих", "харах", "тоглох", "хайрлах", "ярилцах",
    "хийх",
]

# Irregulars / suppletions the rule engine cannot derive — exactly what the
# corpus-built word_forms dictionary exists for (dictionary-first design).
FORM_DICT = {
    "хүмүүс": "хүн",       # suppletive plural
    "эхэлсэн": "эхлэх",    # syncopated verb stem
    "хүрдэг": "хүсэх",     # irregular habitual
    "гутлын": "гутал",     # vowel elision genitive
}

FREQ = {w: len(VOCAB_WORDS) - i for i, w in enumerate(VOCAB_WORDS)}


def make_morph() -> Morphology:
    return Morphology(
        form_to_lemma=FORM_DICT,
        vocab=set(VOCAB_WORDS),
        freq=FREQ,
    )


def make_surfaces() -> dict[str, str]:
    """Surface -> lemma map as the API would build it from vocab + word_forms."""
    morph = make_morph()
    surfaces: dict[str, str] = {}
    for w in VOCAB_WORDS:
        surfaces[w] = w
    surfaces.update(FORM_DICT)
    # representative corpus-derived inflected entries (word_forms table)
    surfaces["номоо"] = "ном"
    surfaces["номоос"] = "ном"
    # every vocab word resolves to itself through morphology too
    for w in list(surfaces):
        resolved = morph.lemmatize(w)
        if resolved:
            surfaces[w] = resolved
    return surfaces


def make_guesser():
    from pipeline.tolerance import Guesser

    return Guesser(make_morph(), make_surfaces(), FREQ)
