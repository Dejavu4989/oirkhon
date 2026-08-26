-- DRAFT puzzle schedule — requires admin approval before publishing.
-- Idempotent: re-running replaces unpublished drafts only.
WITH game AS (SELECT id FROM games WHERE slug = 'oirkhon')
INSERT INTO puzzles (game_id, puzzle_number, play_date, answer_lemma_id, published)
SELECT g.id, v.puzzle_number, v.play_date, l.id, FALSE
FROM (VALUES
  (1, DATE '2026-09-01', 'мэдэрч', 'medium'),
  (2, DATE '2026-09-02', 'нандин', 'medium'),
  (3, DATE '2026-09-03', 'түрэн', 'medium'),
  (4, DATE '2026-09-04', 'шалгуур', 'medium'),
  (5, DATE '2026-09-05', 'шагнуулав', 'hard'),
  (6, DATE '2026-09-06', 'серия', 'hard'),
  (7, DATE '2026-09-07', 'хүнс', 'easy'),
  (8, DATE '2026-09-08', 'хавирган', 'medium'),
  (9, DATE '2026-09-09', 'интерфейс', 'medium'),
  (10, DATE '2026-09-10', 'экс', 'medium'),
  (11, DATE '2026-09-11', 'хачин', 'medium'),
  (12, DATE '2026-09-12', 'турбин', 'medium'),
  (13, DATE '2026-09-13', 'онох', 'hard'),
  (14, DATE '2026-09-14', 'ивээн', 'easy'),
  (15, DATE '2026-09-15', 'үрс', 'medium'),
  (16, DATE '2026-09-16', 'ядам', 'medium'),
  (17, DATE '2026-09-17', 'виз', 'medium'),
  (18, DATE '2026-09-18', 'учрал', 'medium'),
  (19, DATE '2026-09-19', 'хийсвэр', 'medium'),
  (20, DATE '2026-09-20', 'үрэл', 'hard'),
  (21, DATE '2026-09-21', 'казах', 'easy'),
  (22, DATE '2026-09-22', 'мөхөл', 'medium'),
  (23, DATE '2026-09-23', 'захиран', 'medium'),
  (24, DATE '2026-09-24', 'атеизм', 'medium'),
  (25, DATE '2026-09-25', 'өдөөдөг', 'medium'),
  (26, DATE '2026-09-26', 'зөгнөл', 'medium'),
  (27, DATE '2026-09-27', 'нүүдэллэх', 'hard'),
  (28, DATE '2026-09-28', 'архив', 'easy'),
  (29, DATE '2026-09-29', 'төдийлөн', 'medium'),
  (30, DATE '2026-09-30', 'жүжигчин', 'medium')
) AS v(puzzle_number, play_date, lemma, difficulty)
JOIN game g ON TRUE
JOIN lemmas l ON l.lemma = v.lemma
WHERE NOT EXISTS (
  SELECT 1 FROM puzzles p
  WHERE p.game_id = g.id AND p.puzzle_number = v.puzzle_number
);
