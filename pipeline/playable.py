"""Which lemmas are fit to play with.

The corpus vocabulary is, for game purposes, more than half noise: proper
nouns, verb forms, inflected forms that survived lemma reduction, and
function words. This module is the single place that decides two things:

  playable(word)      may be a hint, may appear in the give-up list, and
                      belongs to the rank space every guess is measured in
  answer_eligible(w)  stricter: playable AND common AND native-looking AND
                      attested in inflected use -> may be a daily answer

Everything is rule-based and stdlib-only. Rules that could hurt real words
check the vocabulary first (a converb is only dropped if its verb exists), and
two curated files under meta/ override them:

  meta/noun_exceptions.txt   always playable, one per line   (түүх, эмэгтэй …)
  meta/blocklist.txt         never an answer                  (existing file)

Audit what the rules do:
  python -m pipeline.playable --audit           counts + samples per reason
  python -m pipeline.playable --why WORD ...    explain individual words
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from . import config
from .alphabet import BACK_VOWELS, FRONT_VOWELS

# The pos column in lemmas.tsv is literally "ends in -х" — цонх, мах and чих
# are tagged verb — so nothing here reads it.

VOWELS = frozenset("аэиоуөүяеёюый")
CONSONANTS = frozenset("бвгджзклмнпрстфхцчшщ")

# Grammatical words: particles, pronouns, conjunctions, auxiliaries,
# demonstratives, question words, postpositions. Content words stay out even
# when very frequent (их, олон, бага are real adjectives).
STOPWORDS = frozenset("""
нь ба юм бол болон бөгөөд буюу гэж гэдэг гэсэн гэх гэвч гэхдээ гэхэд хэмээн
хэмээх мөн зэрэг тус дахь дэх энэ тэр эдгээр тэдгээр энэхүү тэрхүү түүний
түүнийг түүнд бүх бүгд аль ямар хэрэв учир учраас тухай тухайд харин ч л даа
дээ юу вэ бэ уу үү бас буй байгаа байсан байх байна байдаг байв байлаа болно
болох болсон болж болов бүр бүхий хэн хаана хэзээ яагаад хэрхэн ийм тийм иймд
тиймээс өөрөөр мэт шиг хүртэл дагуу тулд тул хойш урьд одоо энд тэнд эндээс
тэндээс ингэж тэгж ингээд тэгээд хэдий хэдийгээр ер бүү битгий үгүй биш за
нэгэн би та бид тэд миний манай таны бидний тэдний өөрийн өөрсдийн дор дотор
гадна хооронд хамт нийт нийтдээ эсвэл боловч юмуу жич бол болбол буюу
билээ тухайн хувьд зөвхөн ихэвчлэн улмаар шууд харьяат үеэр үед ялангуяа
магадгүй лав яг зүгээр бараг ойролцоогоор
""".split())

# ---- personal names -----------------------------------------------------------
# Mongolian given names are compounds of ordinary lexemes (бат+мөнх, цог+баяр)
# written as one token, which is exactly why the capitalisation heuristic
# misses them: names in lists and infoboxes never count as "mid-sentence".
NAME_TAILS = frozenset("""
мөнх баяр болд бат сүрэн жаргал цэцэг тунгалаг эрдэнэ чулуун чулуу дорж сайхан
гэрэл болор туяа наран дулам маа хүү даваа пүрэв лхагва бямба ням зул цэрэн жав
хишиг өлзий буян бүрэн төгс оюун тулга дэлгэр дэмбэрэл ханд надмид лувсан гомбо
цогт чимэг зориг билэг амар батаа цэнд баатар тэмүүлэн тэмүүжин хүлэг сүх төмөр
алтан мөрөн ундрах тогтох нямбуу жамц дагва дулмаа рагчаа пэрэнлэй уянга солонго
гантулга саруул сэцэн мандах ариун очир бадам эрхэм
""".split())

# Tails that are also everyday nouns (санхүү = finance, ийнхүү = thus) only
# count when the head is itself a name element, not merely a known word.
WEAK_NAME_TAILS = frozenset("""
хүү маа нар бат сүх чулуу төмөр алтан тунгалаг сайхан болор тулга бүрэн ариун
мөрөн ундрах тогтох мандах хүлэг
""".split())

NAME_HEADS = frozenset("""
бат баян тод цог оюун энх мөнх нар ган алтан цэрэн лхагва даваа пүрэв бямба ням
ариун амар дэлгэр шижир урт отгон сүх нэргүй лув гомбо ганбат наран сайн буян
зол өлзий болор туяа хатан тэмүүлэн батаа хүрэл мөнгөн төмөр алт эрдэнэ цэцэг
чулуун дорж жаргал сайхан гэрэл тунгалаг сүрэн болд баяр ундрам бадам очир
баатар дамдин нацаг элбэг жамсран ганзориг гүн цолмон
""".split())

# Words that are fine to guess but make hopeless answers: numerals,
# quantifiers, adverbs, postpositions, and generic wiki nouns.
ANSWER_STOPWORDS = frozenset("""
нэг хоёр гурав дөрөв тав зургаа долоо найм ес арав зуу мянга сая тэрбум
олон цөөн зарим бүх хэд хэдэн их бага дунд хамгийн маш нэлээд ихэнх цөөнх
олонх дийлэнх бусад өөр бүхэн дараа дээр доор урьд өмнө хойно дотор гадна
хооронд анх удаа дахин заримдаа үргэлж байнга одоо хэзээ мөн адил ижил
хэсэг үйл байдал зүйл хэрэг хэлбэр төрөл хэмжээ тоо холбоос албан ерөнхий
тусгай загвар хуудас жагсаалт тухай эх сурвалж гурван дөрвөн таван зургаан
долоон найман есөн арван хорин гучин дөчин тавин мянган
""".split())

# Time nouns whose case forms outnumber the citation form in an encyclopedia
# ("1990 онд", "5-р сарын"): merge them regardless of frequency.
TIME_NOUNS = frozenset("он сар жил өдөр цаг зуун минут секунд долоо үе".split())

# ---- suffix inventories --------------------------------------------------------
# Verb forms: dropped only when the verb they belong to is in the vocabulary.
VERB_FORM_SUFFIXES = (
    "жээ", "чээ", "лаа", "лээ", "лоо", "лөө", "сан", "сэн", "сон", "сөн",
    "даг", "дэг", "дог", "дөг", "аад", "ээд", "оод", "өөд", "на", "нэ", "но",
    "нө", "вал", "вэл", "бал", "бэл", "ж", "ч", "в", "н",
)
# Case forms: dropped only when the base noun is in the vocabulary.
CASE_SUFFIXES = (
    "гийнхаа", "гийнхээ", "гийнхоо", "гийнхөө", "гийнхан", "гийнхэн", "гийнх",
    "гийн", "гийг", "гаас", "гээс", "гоос", "гөөс", "гаар", "гээр", "гоор", "гөөр", "гүй",
    "ынхаа", "ийнхаа", "ийнхээ", "ынхоо", "ийнхоо", "ынхөө", "ийнхөө",
    "ныхаа", "нийхээ", "ныхоо", "нийхөө",
    "ынхан", "ынхон", "ийнхан", "ийнхон", "ийнхэн", "ийнхөн", "ынх", "ийнх",
    "аасаа", "ээсээ", "оосоо", "өөсөө",
    "аараа", "ээрээ", "оороо", "өөрөө", "тайгаа", "тэйгээ", "тойгоо",
    "ууд", "үүд", "чууд", "чүүд", "нууд", "нүүд",
    "ийн", "ын", "ний", "ны", "ийг", "ыг", "аас", "ээс", "оос", "өөс", "ы", "ий",
    "аар", "ээр", "оор", "өөр", "тай", "тэй", "той", "руу", "рүү",
    "даа", "дээ", "доо", "дөө", "таа", "тээ", "тоо", "төө",
    "ад", "эд", "од", "өд", "ид", "нд", "г",
)
SHORT_CASE = ("д", "т")   # dative — ambiguous, needs a frequency margin


def load_capital_ratio() -> dict[str, float]:
    """token -> share of occurrences capitalised mid-sentence (vocab.py output)."""
    path = config.VOCAB_DIR / "capitals.tsv"
    out: dict[str, float] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split("\t")
        if len(parts) == 3:
            try:
                cap, total = int(parts[1]), int(parts[2])
            except ValueError:
                continue
            if total:
                out[parts[0]] = cap / total
    return out


def load_lines(path: Path) -> frozenset[str]:
    if not path.exists():
        return frozenset()
    return frozenset(
        line.strip().lower()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    )


def load_forms_per_lemma() -> Counter:
    """How many distinct inflected forms the corpus attested for each lemma."""
    path = config.VOCAB_DIR / "word_forms.jsonl"
    counts: Counter = Counter()
    if path.exists():
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                counts[json.loads(line)["lemma"]] += 1
    return counts


def looks_foreign(word: str) -> str | None:
    """Loanword signals. Native Mongolian words start with a single consonant
    (never р/в/п, never a cluster), have no ф/щ/к, no doubled consonant, and
    obey vowel harmony. Any one of these is enough to keep a word out of the
    answer pool — they remain perfectly valid guesses."""
    w = word.replace("-", "")
    if not w:
        return None
    if len(w) >= 2 and w[0] in CONSONANTS and w[1] in CONSONANTS:
        return "initial-cluster"
    if w[0] in "рвп":
        return "initial-letter"
    if any(ch in w for ch in "фщк"):
        return "foreign-letter"
    for a, b in zip(w, w[1:]):
        if a == b and a in CONSONANTS:
            return "double-consonant"
    if any(ch in BACK_VOWELS for ch in w) and any(ch in FRONT_VOWELS for ch in w):
        return "harmony"
    if w.endswith(("изм", "ист", "ция", "ци", "тик", "ика", "логи", "ент")):
        return "foreign-suffix"
    if len(w) >= 4 and w[-1] == "м" and w[-2] in CONSONANTS:
        return "foreign-cluster"        # алгоритм, механизм — native words never end in Cм
    return None


class Playability:
    """Decides, for one vocabulary, what may be played and what may be an answer."""

    def __init__(self, lemmas: list[str], freq: dict[str, int], *,
                 capitals: dict[str, float] | None = None,
                 exceptions: frozenset[str] = frozenset(),
                 blocklist: frozenset[str] = frozenset(),
                 forms_per: Counter | None = None,
                 min_answer_freq: int = 120,
                 min_forms: int = 2,
                 proper_ratio: float = 0.5):
        self.vocab = set(lemmas)
        self.freq = freq
        self.capitals = capitals or {}
        self.exceptions = exceptions
        self.blocklist = blocklist
        self.forms_per = forms_per if forms_per is not None else Counter()
        self.min_answer_freq = min_answer_freq
        self.min_forms = min_forms
        self.proper_ratio = proper_ratio

    @classmethod
    def from_data(cls, lemmas: list[str], freq: dict[str, int], **kw) -> "Playability":
        return cls(
            lemmas, freq,
            capitals=load_capital_ratio(),
            exceptions=load_lines(config.CURATED_DIR / "noun_exceptions.txt"),
            blocklist=load_lines(config.CURATED_DIR / "blocklist.txt"),
            forms_per=load_forms_per_lemma(),
            **kw,
        )

    # ---- helpers ----------------------------------------------------------------

    @staticmethod
    def is_infinitive(w: str) -> bool:
        return len(w) >= 4 and w.endswith("х") and w[-2] in VOWELS

    def verb_stem_exists(self, stem: str) -> bool:
        """явла -> яв+ах, хий -> хий+х, багта -> багта+х."""
        if len(stem) < 2:
            return False
        # багта+х, хий+х — but ха+х is not хаах, so a vowel-final stem
        # never grows an extra vowel (that is what protects хана, чоно, шөнө).
        joins = ("",) if stem[-1] in VOWELS else ("", "а", "э", "о", "ө")
        stems = [stem]
        if stem.endswith("ь"):
            stems.append(stem[:-1] + "и")        # тарь+ж -> тарих
        # unstable vowel: the stem's last vowel drops before the infinitive
        # suffix (хүйтэр+ч but хүйтрэх), so also try it without that vowel
        if len(stem) >= 4 and stem[-1] not in VOWELS and stem[-2] in VOWELS and stem[-3] not in VOWELS:
            stems.append(stem[:-2] + stem[-1])
        for st in stems:
            for v in joins:
                cand = st + v + "х"
                if cand in self.vocab and self.is_infinitive(cand):
                    return True
        return False

    def base_noun_exists(self, base: str, word: str, margin: float = 0.0) -> bool:
        """The stem of an inflected form must be a known word. A margin (base
        this many times more frequent than the form) is only asked of the
        one-letter dative, where хүн+д and the adjective хүнд collide.

        Handles the unstable vowel: аймгийн is аймаг+ийн, the stem having lost
        its last vowel before the suffix."""
        if len(base) < 2 or base in STOPWORDS:
            return False
        if base not in self.vocab:
            restored = None
            if len(base) >= 3 and base[-1] in CONSONANTS and base[-2] in CONSONANTS:
                # unstable vowel: аймг+ийн -> аймаг
                for v in "аэоөуүи":
                    cand = base[:-1] + v + base[-1]
                    if cand in self.vocab and cand not in STOPWORDS:
                        restored = cand
                        break
            if restored is None and len(base) >= 3:
                # dropped final vowel (бодлог+ын -> бодлого) or soft sign (гов+ийн -> говь)
                for tail in ("а", "э", "о", "ө", "у", "ү", "и", "ь"):
                    cand = base + tail
                    if cand in self.vocab and cand not in STOPWORDS:
                        restored = cand
                        break
            if restored is None:
                return False
            base = restored
        if base in TIME_NOUNS:
            return True
        return self.freq.get(base, 0) >= margin * self.freq.get(word, 0)

    def is_name(self, w: str) -> bool:
        if len(w) < 6:
            return False
        for tail in NAME_TAILS:
            if w.endswith(tail) and len(w) - len(tail) >= 2:
                head = w[: -len(tail)]
                if head in NAME_HEADS:
                    return True
                if tail not in WEAK_NAME_TAILS and head in self.vocab:
                    return True
        return False

    # ---- playability --------------------------------------------------------------

    def reason(self, w: str) -> str | None:
        """Why `w` must stay out of the rank space, or None if it is playable."""
        if w in self.exceptions:
            return None
        if w in STOPWORDS:
            return "stopword"
        if "-" in w or not w.isalpha():
            return "compound"
        if self.capitals.get(w, 0.0) >= self.proper_ratio:
            return "proper-noun"
        if self.is_name(w):
            return "name"
        if self.is_infinitive(w):
            return "verb"
        for sfx in VERB_FORM_SUFFIXES:
            if w.endswith(sfx) and len(w) - len(sfx) >= 2:
                if self.verb_stem_exists(w[: -len(sfx)]):
                    return "verb-form"
        for sfx in CASE_SUFFIXES:
            if w.endswith(sfx) and len(w) - len(sfx) >= 2:
                base = w[: -len(sfx)]
                if self.base_noun_exists(base, w):
                    return "inflected"
                # арга+ар -> аргаар: the stem vowel absorbed the suffix vowel
                merged = base + sfx[0]
                if sfx[0] in VOWELS and merged != w and self.base_noun_exists(merged, w):
                    return "inflected"
        for sfx in SHORT_CASE:
            if w.endswith(sfx) and len(w) >= 3:
                margin = 1.5 if len(w) <= 4 else 0.0
                if self.base_noun_exists(w[:-1], w, margin=margin):
                    return "inflected"
        if w.endswith("йн") and len(w) >= 5 and w[:-1] in self.vocab:
            return "inflected"          # огторгуй+н, нохой+н
        if w.endswith("чид") and len(w) >= 6 and (w[:-1] + "н") in self.vocab:
            return "inflected"          # ажилчин -> ажилчид (харваач+ид is the -ид rule)
        if len(w) >= 6 and w[-2:] in ("аа", "ээ", "оо", "өө"):
            if w[:-1] in self.vocab or (w[:-2] in self.vocab and w[:-2] not in STOPWORDS):
                return "inflected"      # бодлого+о, тайлбар+аа
        if w.endswith(("дугаар", "дүгээр")) and len(w) > 6:
            return "inflected"          # ordinal: нэгдүгээр, хоёрдугаар
        return None

    def playable(self, w: str) -> bool:
        return self.reason(w) is None

    # ---- answers ------------------------------------------------------------------

    def answer_reason(self, w: str, morph=None) -> str | None:
        """Why `w` must not be a daily answer, or None if it is eligible."""
        r = self.reason(w)
        if r:
            return r
        if w in self.blocklist:
            return "blocklist"
        if w in ANSWER_STOPWORDS:
            return "generic"
        if not config.ANSWER_MIN_LEN <= len(w) <= config.ANSWER_MAX_LEN:
            return "length"
        if self.freq.get(w, 0) < self.min_answer_freq:
            return "rare"
        foreign = looks_foreign(w)
        if foreign:
            return f"loanword:{foreign}"
        # A word the corpus never inflected is a headline, a caption or a
        # transliteration — not something people say.
        if self.forms_per and self.forms_per.get(w, 0) < self.min_forms:
            return "unattested"
        if morph is not None and not is_citation_form(w, morph, self.freq):
            return "non-citation"
        return None

    def answer_eligible(self, w: str, morph=None) -> bool:
        return self.answer_reason(w, morph) is None


def is_citation_form(lemma: str, morph, freq) -> bool:
    """Reject unmerged inflected forms (ажлынхаа, хуулиас, томилж …).

    Strict: ANY derivation to an equally-or-more frequent known word
    disqualifies — daily answers must be terminal citation forms.
    """
    cands = morph.all_candidates(lemma)
    derived = [l for l in cands if l != lemma]
    if not derived:
        return True
    best = max(derived, key=lambda l: freq.get(l, 0))
    return freq.get(best, 0) < max(freq.get(lemma, 0), 1)


# ---- CLI --------------------------------------------------------------------------

def _load_vocab():
    from .vocab import load_lemmas
    lemmas, freq = load_lemmas(config.VOCAB_DIR / "lemmas.tsv")
    return lemmas, freq, Playability.from_data(lemmas, freq)


def audit(sample: int = 25, top: int = 4000) -> None:
    lemmas, freq, play = _load_vocab()
    by_reason: dict[str, list[str]] = {}
    for w in lemmas:
        by_reason.setdefault(play.reason(w) or "playable", []).append(w)
    total = len(lemmas)
    print(f"vocabulary: {total} lemmas\n")
    for reason, words in sorted(by_reason.items(), key=lambda kv: -len(kv[1])):
        print(f"{reason:<14} {len(words):6d}  ({100 * len(words) / total:5.1f}%)")
    # Dropped words among the most frequent are where false positives would hurt.
    print(f"\nDropped words among the top {top} by frequency — review for mistakes:")
    ranked = set(lemmas[:top])
    for reason, words in by_reason.items():
        if reason == "playable":
            continue
        hits = [w for w in words if w in ranked][:sample]
        if hits:
            print(f"  {reason:<12} " + " ".join(hits))

    answers = [w for w in lemmas if play.answer_eligible(w)]
    print(f"\nanswer-eligible (before citation-form check): {len(answers)}")
    print("  most frequent:", " ".join(answers[:40]))
    loose = Playability(lemmas, freq, capitals=play.capitals, exceptions=play.exceptions,
                        blocklist=play.blocklist, forms_per=play.forms_per, min_forms=0)
    lost = [w for w in lemmas if play.answer_reason(w) == "unattested"
            and loose.answer_reason(w) is None]
    print(f"\nremoved only by the attestation floor (min_forms={play.min_forms}): {len(lost)}")
    print("  sample:", " ".join(lost[:50]))


def why(words: list[str]) -> None:
    _, _, play = _load_vocab()
    for w in words:
        w = w.strip().lower()
        r = play.reason(w)
        a = play.answer_reason(w)
        print(f"{w:<16} playable={'yes' if r is None else 'no (' + r + ')':<22} "
              f"answer={'yes' if a is None else 'no (' + a + ')'}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--audit", action="store_true")
    ap.add_argument("--why", nargs="+", metavar="WORD")
    args = ap.parse_args()
    if args.why:
        why(args.why)
    else:
        audit()


if __name__ == "__main__":
    main()
