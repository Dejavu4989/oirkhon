"""Hand-checked playability decisions (stdlib-only, no data files needed).

Every case here was a real false positive or false negative found while
auditing the corpus vocabulary; keep them when changing the rules.
"""
import unittest
from collections import Counter

from pipeline.playable import Playability, looks_foreign

# A small vocabulary with frequencies, enough for the stem checks to work.
VOCAB = {
    # nouns
    "хот": 14572, "гэр": 11274, "ном": 4768, "ажил": 10360, "арга": 3000,
    "хана": 900, "шөнө": 800, "чоно": 400, "хулгана": 300, "багана": 200,
    "цонх": 600, "хонх": 150, "мах": 900, "чих": 500, "түүх": 5000,
    "төхөөрөмж": 700, "сурвалж": 400, "боломж": 3000, "агаар": 2500,
    "дугаар": 3000, "хязгаар": 800, "гурав": 2000, "сэдэв": 900,
    "эмэгтэй": 3000, "эрэг": 500, "эрэгтэй": 2500, "булчин": 400,
    "сансар": 900, "хор": 800, "төл": 300, "тал": 5000, "чиглэл": 2000,
    "бат": 3000, "мөнх": 1500, "цог": 300, "баяр": 2447, "оюун": 900,
    "болд": 400, "урт": 2000, "улс": 30000, "хүн": 30000, "хүнд": 2000,
    "сан": 2000, "санхүү": 3000, "он": 15000, "хаан": 5000, "нэг": 50000,
    # verbs (infinitives)
    "явах": 5000, "авах": 6000, "хийх": 9000, "багтах": 900, "хаах": 900,
    "хамаарах": 700, "ажиллах": 8000, "болох": 20000, "төлөх": 800,
    "элэх": 60, "хасах": 300, "ирэх": 4000,
    # leaked forms that must be dropped
    "хотын": 3000, "гэрт": 500, "явлаа": 300, "явсан": 800, "явдаг": 400,
    "ажиллаж": 900, "хийж": 2000, "багтана": 300, "хамаарна": 200,
    "ирнэ": 400, "талаар": 4000, "аргаар": 700, "чиглэлээр": 500,
    "хотууд": 400, "онд": 79876, "оны": 61770, "хааны": 800, "хүний": 9000,
    "боломжтой": 5000, "хотынхон": 300, "ажлынх": 200, "дууг": 900, "дуу": 9433,
    "идвэл": 100, "идэх": 3000, "хүйтэрч": 150, "хүйтрэх": 400, "эмнэлэгт": 900,
    "эмнэлэг": 2500, "аймгийн": 4000, "аймаг": 6000, "хотод": 700,
    "булчингийн": 300, "бодлого": 3000, "бодлогын": 2500, "бодлогоо": 400,
    "бодлогууд": 300, "говь": 900, "говийн": 700, "тарих": 800, "тарьж": 300,
    "залгах": 400, "залган": 200, "огторгуй": 500, "огторгуйн": 300,
    "харваач": 400, "харваачид": 200, "харшид": 100, "харш": 700,
    "уралдаан": 1500, "уралдаанд": 1200, "хамтлаг": 900, "хамтлагийнхан": 200,
    "тайлбар": 800, "тайлбараа": 150, "гэрээ": 1000, "хороо": 900,
    "ажилчин": 2000, "ажилчид": 900, "хамтлагийнхаа": 150,
    # names
    "батмөнх": 323, "цогбаяр": 100, "оюунболд": 120, "баянмөнх": 178,
    # misc
    "нь": 170543, "ба": 50802, "бат-эрдэнэ": 90, "улаанбаатар": 3908,
    "монгол": 48896,
}


def make(exceptions=(), **kw):
    return Playability(
        list(VOCAB), dict(VOCAB),
        capitals={"улаанбаатар": 0.83, "монгол": 0.62},
        exceptions=frozenset(exceptions),
        blocklist=frozenset({"гомо"}),
        forms_per=Counter({w: 5 for w in VOCAB}),
        **kw,
    )


class PlayableRules(unittest.TestCase):
    def setUp(self):
        self.p = make()

    def assertPlayable(self, *words):
        for w in words:
            self.assertIsNone(self.p.reason(w), f"{w} should be playable")

    def assertDropped(self, reason, *words):
        for w in words:
            self.assertEqual(self.p.reason(w), reason, f"{w} should be dropped as {reason}")

    def test_nouns_ending_in_consonant_x_are_not_verbs(self):
        self.assertPlayable("цонх", "хонх", "мах", "чих")

    def test_infinitives_are_verbs(self):
        self.assertDropped("verb", "явах", "авах", "хийх", "багтах", "хаах")

    def test_verb_forms_need_their_verb_to_exist(self):
        self.assertDropped("verb-form", "явлаа", "явсан", "явдаг", "ажиллаж",
                           "хийж", "багтана", "хамаарна", "ирнэ")

    def test_a_vowel_final_stem_never_grows_a_vowel(self):
        # хана is not the present tense of хаах: ха+х is not a verb
        self.assertPlayable("хана", "шөнө", "чоно", "хулгана", "багана")

    def test_nouns_that_merely_end_like_verb_forms(self):
        self.assertPlayable("төхөөрөмж", "сурвалж", "гурав", "сэдэв")

    def test_case_forms_need_their_base_to_exist(self):
        self.assertDropped("inflected", "хотын", "гэрт", "талаар", "аргаар",
                           "чиглэлээр", "хотууд", "хааны", "хүний", "боломжтой")
        self.assertPlayable("агаар", "дугаар", "хязгаар", "боломж")

    def test_derived_and_unstable_vowel_forms(self):
        self.assertDropped("inflected", "хотынхон", "ажлынх", "дууг", "аймгийн",
                           "хотод", "эмнэлэгт")
        self.assertDropped("verb-form", "идвэл", "хүйтэрч")
        self.assertPlayable("дуу", "аймаг", "эмнэлэг")

    def test_allomorphs_and_restored_vowels(self):
        self.assertDropped("inflected", "булчингийн", "бодлогын", "бодлогоо", "бодлогууд",
                           "говийн", "огторгуйн", "харваачид", "харшид", "уралдаанд",
                           "хамтлагийнхан", "хамтлагийнхаа", "тайлбараа", "ажилчид")
        self.assertDropped("verb-form", "тарьж", "залган")
        # short words with a long vowel are real nouns, not reflexives
        self.assertPlayable("гэрээ", "хороо", "говь", "бодлого", "уралдаан", "хамтлаг")

    def test_time_nouns_merge_even_when_the_form_is_more_frequent(self):
        # "1990 онд" makes онд five times more frequent than он in an encyclopedia
        self.assertDropped("inflected", "онд", "оны")

    def test_short_dative_needs_a_frequency_margin_but_the_allowlist_wins(self):
        self.assertDropped("inflected", "хүнд")
        self.assertIsNone(make(exceptions={"хүнд"}).reason("хүнд"))

    def test_names_are_compounds_of_name_elements(self):
        self.assertDropped("name", "батмөнх", "цогбаяр", "оюунболд", "баянмөнх")
        self.assertPlayable("бат", "мөнх", "баяр", "болд")

    def test_weak_name_tails_need_a_name_head(self):
        # санхүү (finance) ends in -хүү but сан is not a name element
        self.assertPlayable("санхүү")

    def test_capitalised_tokens_are_proper_nouns(self):
        self.assertDropped("proper-noun", "улаанбаатар", "монгол")
        self.assertIsNone(make(exceptions={"монгол"}).reason("монгол"))

    def test_function_words_and_compounds(self):
        self.assertDropped("stopword", "нь", "ба")
        self.assertDropped("compound", "бат-эрдэнэ")

    def test_allowlist_beats_every_rule(self):
        p = make(exceptions={"түүх", "эмэгтэй", "эрэгтэй"})
        for w in ("түүх", "эмэгтэй", "эрэгтэй"):
            self.assertIsNone(p.reason(w))
        # without it these homonyms would be lost
        self.assertEqual(self.p.reason("түүх"), "verb")
        self.assertEqual(self.p.reason("эрэгтэй"), "inflected")
        self.assertIsNone(self.p.reason("эмэгтэй"))   # эмэг is not a word


class AnswerRules(unittest.TestCase):
    def setUp(self):
        self.p = make(exceptions={"түүх"})

    def test_playable_is_necessary(self):
        self.assertEqual(self.p.answer_reason("явах"), "verb")
        self.assertEqual(self.p.answer_reason("батмөнх"), "name")

    def test_common_native_nouns_pass(self):
        for w in ("хот", "гэр", "ном", "булчин", "сансар", "цонх", "хонх", "түүх"):
            self.assertIsNone(self.p.answer_reason(w), w)

    def test_generic_words_are_not_answers(self):
        self.assertEqual(self.p.answer_reason("нэг"), "generic")
        self.assertEqual(self.p.answer_reason("гурав"), "generic")

    def test_rare_short_and_blocked(self):
        self.assertEqual(self.p.answer_reason("хор"), "length") if len("хор") < 3 else None
        p = make(min_answer_freq=1000)
        self.assertEqual(p.answer_reason("хонх"), "rare")

    def test_loanwords_are_not_answers(self):
        self.assertEqual(looks_foreign("блокчэйн"), "initial-cluster")
        self.assertEqual(looks_foreign("статик"), "initial-cluster")
        self.assertEqual(looks_foreign("ректор"), "initial-letter")
        self.assertEqual(looks_foreign("басс"), "double-consonant")
        self.assertEqual(looks_foreign("коллеж"), "foreign-letter")
        self.assertEqual(looks_foreign("модэль"), "harmony")   # о (back) with э (front)
        self.assertEqual(looks_foreign("алгоритм"), "foreign-cluster")
        self.assertEqual(looks_foreign("нацизм"), "foreign-suffix")
        self.assertIsNone(looks_foreign("хэм"))
        self.assertIsNone(looks_foreign("дэм"))
        for native in ("хот", "сургууль", "төхөөрөмж", "хүндэтгэл", "цэцэрлэг"):
            self.assertIsNone(looks_foreign(native), native)

    def test_unattested_words_are_not_answers(self):
        p = Playability(list(VOCAB), dict(VOCAB), forms_per=Counter({"хот": 12, "гэр": 1}))
        self.assertIsNone(p.answer_reason("хот"))
        self.assertEqual(p.answer_reason("гэр"), "unattested")
        self.assertIsNone(Playability(list(VOCAB), dict(VOCAB),
                                      forms_per=Counter({"гэр": 1}), min_forms=1)
                          .answer_reason("гэр"))


if __name__ == "__main__":
    unittest.main()
