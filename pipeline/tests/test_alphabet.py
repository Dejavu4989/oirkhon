import unittest

from pipeline.alphabet import (
    clean_token,
    find_tokens,
    is_mn_word,
    last_harmony,
    sub_cost,
    to_cyrillic_lookalikes,
)


class TestCleanToken(unittest.TestCase):
    def test_trim_lower(self):
        self.assertEqual(clean_token("  НОХОЙ "), "нохой")

    def test_strips_punctuation(self):
        self.assertEqual(clean_token("«ном»."), "ном")

    def test_nfc_composes_decomposed_input(self):
        self.assertEqual(clean_token("е\u0308"), clean_token("ё"))


class TestHarmony(unittest.TestCase):
    def test_back(self):
        self.assertEqual(last_harmony("нохой"), "back")
        self.assertEqual(last_harmony("хотын"), "back")
        self.assertEqual(last_harmony("явах"), "back")

    def test_front(self):
        self.assertEqual(last_harmony("сүлд"), "front")
        self.assertEqual(last_harmony("эмч"), "front")
        self.assertEqual(last_harmony("гэр"), "front")

    def test_neutral_only(self):
        self.assertIsNone(last_harmony("шил"))

    def test_ы_is_back(self):
        self.assertEqual(last_harmony("машин"), "back")


class TestLookalikes(unittest.TestCase):
    def test_map(self):
        self.assertEqual(to_cyrillic_lookalikes("toy"), "тоу")
        # letters outside the locked map stay untouched
        self.assertEqual(to_cyrillic_lookalikes("noxoy"), "nохоу")
        self.assertEqual(to_cyrillic_lookalikes("hot"), "нот")  # h→н per spec

    def test_cyrillic_untouched(self):
        self.assertEqual(to_cyrillic_lookalikes("ном"), "ном")


class TestSubCost(unittest.TestCase):
    def test_confusables_half(self):
        for a, b in (("о", "ө"), ("у", "ү"), ("е", "э"), ("и", "й"), ("ц", "ч")):
            self.assertEqual(sub_cost(a, b), 0.5)

    def test_other_substitutions_full(self):
        self.assertEqual(sub_cost("а", "б"), 1.0)
        self.assertEqual(sub_cost("о", "ү"), 1.0)

    def test_same_free(self):
        self.assertEqual(sub_cost("н", "н"), 0.0)


class TestTokenize(unittest.TestCase):
    def test_find_tokens(self):
        got = set(find_tokens("Номыг унш. Хотод явах!"))
        self.assertEqual(got, {"номыг", "унш", "хотод", "явах"})

    def test_is_mn_word(self):
        self.assertTrue(is_mn_word("өвөл"))
        self.assertFalse(is_mn_word("abc"))
        self.assertFalse(is_mn_word(""))


if __name__ == "__main__":
    unittest.main()
