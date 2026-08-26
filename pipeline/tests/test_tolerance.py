import unittest

from pipeline.tests.fixtures import FREQ, make_guesser, make_morph
from pipeline.tolerance import Guesser, weighted_distance


class TestWeightedDistance(unittest.TestCase):
    def test_identical(self):
        self.assertEqual(weighted_distance("ном", "ном"), 0.0)

    def test_confusable_substitution_half(self):
        self.assertEqual(weighted_distance("хот", "хөт"), 0.5)
        self.assertEqual(weighted_distance("цас", "час"), 0.5)
        self.assertEqual(weighted_distance("нохой", "нохои"), 0.5)  # и↔й

    def test_plain_substitution_full(self):
        self.assertEqual(weighted_distance("ноход", "нохой"), 1.0)  # д vs й

    def test_insert_delete_full(self):
        self.assertEqual(weighted_distance("ном", "номд"), 1.0)
        self.assertEqual(weighted_distance("номд", "ном"), 1.0)

    def test_length_gap_abandons(self):
        self.assertGreater(weighted_distance("но", "нохойд"), 1.0)


class TestGuessResolution(unittest.TestCase):
    def setUp(self):
        self.guesser = make_guesser()

    def test_exact(self):
        r = self.guesser.resolve("нохой")
        self.assertEqual((r.status, r.lemma), ("exact", "нохой"))

    def test_case_and_whitespace(self):
        for raw in ("НОХОЙ", " нохой ", "«Нохой»"):
            r = self.guesser.resolve(raw)
            self.assertEqual(r.lemma, "нохой", raw)

    def test_inflected_form_is_exact_not_corrected(self):
        r = self.guesser.resolve("нохойн")
        self.assertEqual((r.status, r.lemma), ("exact", "нохой"))

    def test_typo_autocorrected_with_notice(self):
        """Spec §12: нохои (mistyped й) is auto-corrected with a visible notice."""
        r = self.guesser.resolve("нохои")
        self.assertEqual(r.status, "corrected")
        self.assertEqual(r.lemma, "нохой")
        self.assertIn("нохои» → «нохой» гэж ойлголоо.", r.message)

    def test_latin_lookalikes_map_silently(self):
        # 'xot' maps through the locked lookalike table straight to хот;
        # normalize() includes the mapping, so this is exact, not corrected.
        r = self.guesser.resolve("xot")
        self.assertEqual(r.status, "exact")
        self.assertEqual(r.lemma, "хот")

    def test_ambiguous_fuzzy_is_unknown(self):
        # 'номо' is distance 1.0 from both ном (delete о) and номоо (insert о).
        r = self.guesser.resolve("номо")
        self.assertEqual(r.status, "unknown")

    def test_gibberish_unknown_and_logged(self):
        seen = []
        g = Guesser(make_morph(), make_guesser().surfaces, FREQ, log_unknown=seen.append)
        r = g.resolve("ззззз")
        self.assertEqual(r.status, "unknown")
        self.assertEqual(seen, ["ззззз"])

    def test_too_short_unknown(self):
        self.assertEqual(self.guesser.resolve("н").status, "unknown")


if __name__ == "__main__":
    unittest.main()
