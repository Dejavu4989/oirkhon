-- DRAFT puzzle schedule — requires admin approval before publishing.
-- Idempotent: re-running replaces unpublished drafts only.
WITH game AS (SELECT id FROM games WHERE slug = 'oirkhon')
INSERT INTO puzzles (game_id, puzzle_number, play_date, answer_lemma_id, published)
SELECT g.id, v.puzzle_number, v.play_date, l.id, FALSE
FROM (VALUES
  (1, DATE '2026-08-26', 'урсац', 'medium'),
  (2, DATE '2026-08-27', 'статик', 'medium'),
  (3, DATE '2026-08-28', 'зогсоох', 'medium'),
  (4, DATE '2026-08-29', 'амьсгал', 'hard'),
  (5, DATE '2026-08-30', 'батмөнх', 'hard'),
  (6, DATE '2026-08-31', 'өргөх', 'easy'),
  (7, DATE '2026-09-01', 'харш', 'medium'),
  (8, DATE '2026-09-02', 'зүтгэл', 'medium'),
  (9, DATE '2026-09-03', 'басс', 'medium'),
  (10, DATE '2026-09-04', 'харваа', 'medium'),
  (11, DATE '2026-09-05', 'блокчэйн', 'medium'),
  (12, DATE '2026-09-06', 'хориглох', 'hard'),
  (13, DATE '2026-09-07', 'судлах', 'easy'),
  (14, DATE '2026-09-08', 'бичигдэх', 'medium'),
  (15, DATE '2026-09-09', 'харцага', 'medium'),
  (16, DATE '2026-09-10', 'үлдэгдэл', 'medium'),
  (17, DATE '2026-09-11', 'булчин', 'medium'),
  (18, DATE '2026-09-12', 'чимэглэл', 'medium'),
  (19, DATE '2026-09-13', 'суурин', 'hard'),
  (20, DATE '2026-09-14', 'ген', 'easy'),
  (21, DATE '2026-09-15', 'хүндэтгэл', 'medium'),
  (22, DATE '2026-09-16', 'сансар', 'medium'),
  (23, DATE '2026-09-17', 'хаяа', 'medium'),
  (24, DATE '2026-09-18', 'ургуулах', 'medium'),
  (25, DATE '2026-09-19', 'довтлогч', 'hard'),
  (26, DATE '2026-09-20', 'хувиргах', 'medium'),
  (27, DATE '2026-09-21', 'ректор', 'easy'),
  (28, DATE '2026-09-22', 'явдал', 'medium'),
  (29, DATE '2026-09-23', 'тулгуур', 'medium'),
  (30, DATE '2026-09-24', 'ойролцоо', 'medium'),
  (31, DATE '2026-09-25', 'хэрэглэх', 'medium'),
  (32, DATE '2026-09-26', 'шошго', 'medium'),
  (33, DATE '2026-09-27', 'төлөвлөх', 'hard'),
  (34, DATE '2026-09-28', 'төхөөрөмж', 'easy'),
  (35, DATE '2026-09-29', 'үржүүлэх', 'medium'),
  (36, DATE '2026-09-30', 'сэлүүр', 'medium')
) AS v(puzzle_number, play_date, lemma, difficulty)
JOIN game g ON TRUE
JOIN lemmas l ON l.lemma = v.lemma
WHERE NOT EXISTS (
  SELECT 1 FROM puzzles p
  WHERE p.game_id = g.id AND p.puzzle_number = v.puzzle_number
);
