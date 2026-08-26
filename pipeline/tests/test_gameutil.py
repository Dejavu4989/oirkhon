import unittest

from pipeline.gameutil import (
    bucket_for_rank,
    bucket_label,
    best_progression,
    progress_fill,
    share_text,
)


class TestBuckets(unittest.TestCase):
    def test_boundaries(self):
        cases = {
            1: "solved", 2: "hot", 100: "hot",
            101: "warm", 1000: "warm", 1001: "cool", 5000: "cool",
            5001: "cold", 30000: "cold",
        }
        for rank, expected in cases.items():
            self.assertEqual(bucket_for_rank(rank), expected, rank)

    def test_labels_mongolian(self):
        self.assertEqual(bucket_label(50), "маш ойрхон")
        self.assertEqual(bucket_label(500), "ойрхон")
        self.assertEqual(bucket_label(2000), "хол")
        self.assertEqual(bucket_label(9000), "маш хол")


class TestProgressBar(unittest.TestCase):
    def test_solved_is_full(self):
        self.assertEqual(progress_fill(1, 30000), 1.0)

    def test_monotonically_decreasing(self):
        fills = [progress_fill(r, 30000) for r in range(1, 30001, 37)]
        self.assertEqual(fills, sorted(fills, reverse=True))

    def test_worst_rank_near_zero(self):
        self.assertLessEqual(progress_fill(30000, 30000), 0.01)


class TestShareText(unittest.TestCase):
    def test_best_progression_squares(self):
        ranks = [5000, 200, 50, 300]
        self.assertEqual(best_progression(ranks), ["🟧", "🟨", "🟩", "🟩"])

    def test_share_text_format(self):
        text = share_text("Ойрхон", 267, [5000, 200, 50, 1], 2, True)
        lines = text.splitlines()
        self.assertEqual(lines[0], "Ойрхон #267 🇲🇳")
        self.assertEqual(lines[1], "4 таалт, 2 сэжүүр")
        self.assertEqual(lines[2], "🟧🟨🟩🟩")
        self.assertEqual(lines[3], "lessgames.mn")

    def test_unsolved_marked(self):
        text = share_text("Ойрхон", 5, [8000, 6000], 0, False)
        self.assertIn("бууж өгсөн", text)


if __name__ == "__main__":
    unittest.main()
