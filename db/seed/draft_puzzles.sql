-- DRAFT puzzle schedule — requires admin approval before publishing.
-- Idempotent: re-running replaces unpublished drafts only.
WITH game AS (SELECT id FROM games WHERE slug = 'oirkhon')
INSERT INTO puzzles (game_id, puzzle_number, play_date, answer_lemma_id, published)
SELECT g.id, v.puzzle_number, v.play_date, l.id, FALSE
FROM (VALUES
  (1, DATE '2026-09-01', 'настан', 'medium'),
  (2, DATE '2026-09-02', 'хишиг', 'medium'),
  (3, DATE '2026-09-03', 'геометр', 'medium'),
  (4, DATE '2026-09-04', 'цэцэрлэг', 'medium'),
  (5, DATE '2026-09-05', 'солилцоо', 'hard'),
  (6, DATE '2026-09-06', 'тээрэм', 'hard'),
  (7, DATE '2026-09-07', 'орлого', 'easy'),
  (8, DATE '2026-09-08', 'баатарсүх', 'medium'),
  (9, DATE '2026-09-09', 'оролцоо', 'medium'),
  (10, DATE '2026-09-10', 'исгэх', 'medium'),
  (11, DATE '2026-09-11', 'сайгүй', 'medium'),
  (12, DATE '2026-09-12', 'авъяаслаг', 'medium'),
  (13, DATE '2026-09-13', 'овогтон', 'hard'),
  (14, DATE '2026-09-14', 'битүү', 'easy'),
  (15, DATE '2026-09-15', 'дэс', 'medium'),
  (16, DATE '2026-09-16', 'агнуур', 'medium'),
  (17, DATE '2026-09-17', 'соёмбо', 'medium'),
  (18, DATE '2026-09-18', 'шош', 'medium'),
  (19, DATE '2026-09-19', 'кинетик', 'medium'),
  (20, DATE '2026-09-20', 'түшиц', 'hard'),
  (21, DATE '2026-09-21', 'цэнгэг', 'easy'),
  (22, DATE '2026-09-22', 'тенор', 'medium'),
  (23, DATE '2026-09-23', 'шаньюй', 'medium'),
  (24, DATE '2026-09-24', 'найдвар', 'medium'),
  (25, DATE '2026-09-25', 'тогтолцоо', 'medium'),
  (26, DATE '2026-09-26', 'сэнгээ', 'hard'),
  (27, DATE '2026-09-27', 'аврага', 'medium'),
  (28, DATE '2026-09-28', 'суурин', 'easy'),
  (29, DATE '2026-09-29', 'шашинтан', 'medium'),
  (30, DATE '2026-09-30', 'шагдар', 'medium')
) AS v(puzzle_number, play_date, lemma, difficulty)
JOIN game g ON TRUE
JOIN lemmas l ON l.lemma = v.lemma
WHERE NOT EXISTS (
  SELECT 1 FROM puzzles p
  WHERE p.game_id = g.id AND p.puzzle_number = v.puzzle_number
);
