-- DRAFT puzzle schedule — requires admin approval before publishing.
-- Idempotent: re-running replaces unpublished drafts only.
WITH game AS (SELECT id FROM games WHERE slug = 'oirkhon')
INSERT INTO puzzles (game_id, puzzle_number, play_date, answer_lemma_id, published)
SELECT g.id, v.puzzle_number, v.play_date, l.id, FALSE
FROM (VALUES
  (1, DATE '2026-08-26', 'өвдөх', 'medium'),
  (2, DATE '2026-08-27', 'харилцан', 'medium'),
  (3, DATE '2026-08-28', 'шилжүүлэх', 'medium'),
  (4, DATE '2026-08-29', 'баттулга', 'hard'),
  (5, DATE '2026-08-30', 'зэрэгцээ', 'medium'),
  (6, DATE '2026-08-31', 'сайхан', 'easy'),
  (7, DATE '2026-09-01', 'сонирхох', 'medium'),
  (8, DATE '2026-09-02', 'нааш', 'medium'),
  (9, DATE '2026-09-03', 'гадаргуу', 'medium'),
  (10, DATE '2026-09-04', 'цуу', 'medium'),
  (11, DATE '2026-09-05', 'авир', 'hard'),
  (12, DATE '2026-09-06', 'зогсоох', 'hard'),
  (13, DATE '2026-09-07', 'сэргэн', 'easy'),
  (14, DATE '2026-09-08', 'өмгөөлөгч', 'medium'),
  (15, DATE '2026-09-09', 'хааяа', 'medium'),
  (16, DATE '2026-09-10', 'гүйх', 'medium'),
  (17, DATE '2026-09-11', 'худалдан', 'medium'),
  (18, DATE '2026-09-12', 'тариалан', 'hard'),
  (19, DATE '2026-09-13', 'талаархи', 'medium'),
  (20, DATE '2026-09-14', 'судас', 'easy'),
  (21, DATE '2026-09-15', 'тулга', 'medium'),
  (22, DATE '2026-09-16', 'төрүүлэх', 'medium'),
  (23, DATE '2026-09-17', 'хөдөлгүүр', 'medium'),
  (24, DATE '2026-09-18', 'үнэмшил', 'medium'),
  (25, DATE '2026-09-19', 'цэнэглэх', 'medium'),
  (26, DATE '2026-09-20', 'эрмэлзэл', 'hard'),
  (27, DATE '2026-09-21', 'айл', 'easy'),
  (28, DATE '2026-09-22', 'нарс', 'medium'),
  (29, DATE '2026-09-23', 'хилс', 'medium'),
  (30, DATE '2026-09-24', 'үйлчилгээ', 'medium'),
  (31, DATE '2026-09-25', 'туршлага', 'medium'),
  (32, DATE '2026-09-26', 'хойших', 'medium'),
  (33, DATE '2026-09-27', 'нүүх', 'hard'),
  (34, DATE '2026-09-28', 'шар', 'easy'),
  (35, DATE '2026-09-29', 'газ', 'medium'),
  (36, DATE '2026-09-30', 'дэвшин', 'medium')
) AS v(puzzle_number, play_date, lemma, difficulty)
JOIN game g ON TRUE
JOIN lemmas l ON l.lemma = v.lemma
WHERE NOT EXISTS (
  SELECT 1 FROM puzzles p
  WHERE p.game_id = g.id AND p.puzzle_number = v.puzzle_number
);
