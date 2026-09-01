-- Ойрхон platform — initial schema (spec §5).
-- Apply with: python -m pipeline.db apply-schema

CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT UNIQUE,
    phone         TEXT UNIQUE,
    display_name  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ
);

-- Anonymous play allowed: user_id NULL + anon_token cookie.
CREATE TABLE IF NOT EXISTS sessions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id),
    anon_token  TEXT UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    plan          TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly', 'lifetime')),
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ,
    provider      TEXT NOT NULL,
    provider_ref  TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
    ON subscriptions(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS payments (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT REFERENCES users(id),
    provider      TEXT NOT NULL,
    provider_ref  TEXT UNIQUE,
    amount        BIGINT NOT NULL,
    currency      TEXT NOT NULL DEFAULT 'MNT',
    status        TEXT NOT NULL DEFAULT 'pending',
    raw_payload   JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
    id              BIGSERIAL PRIMARY KEY,
    slug            TEXT UNIQUE NOT NULL,
    name_mn         TEXT NOT NULL,
    name_en         TEXT,
    description_mn  TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0
);

INSERT INTO games (slug, name_mn, name_en, description_mn, sort_order)
VALUES ('oirkhon', 'Ойрхон', 'Oirkhon',
        'Өдөр бүр нэг нууц үг. Таалтаараа ойртуулж олоорой.', 1)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS lemmas (
    id                   BIGSERIAL PRIMARY KEY,
    lemma                TEXT UNIQUE NOT NULL,
    pos                  TEXT CHECK (pos IN ('noun', 'verb', 'adj', 'other')) DEFAULT 'noun',
    frequency            BIGINT NOT NULL DEFAULT 0,
    is_answer_candidate  BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved          BOOLEAN NOT NULL DEFAULT FALSE,
    difficulty           TEXT CHECK (difficulty IN ('easy', 'medium', 'hard'))
);
CREATE INDEX IF NOT EXISTS idx_lemmas_lemma ON lemmas(lemma);
CREATE INDEX IF NOT EXISTS idx_lemmas_candidates ON lemmas(is_answer_candidate) WHERE is_answer_candidate;

CREATE TABLE IF NOT EXISTS word_forms (
    id        BIGSERIAL PRIMARY KEY,
    lemma_id  BIGINT NOT NULL REFERENCES lemmas(id),
    form      TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_word_forms_form ON word_forms(form);

CREATE TABLE IF NOT EXISTS puzzles (
    id               BIGSERIAL PRIMARY KEY,
    game_id          BIGINT NOT NULL REFERENCES games(id),
    puzzle_number    INT NOT NULL,
    play_date        DATE NOT NULL,
    answer_lemma_id  BIGINT NOT NULL REFERENCES lemmas(id),
    published        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (game_id, puzzle_number),
    UNIQUE (game_id, play_date)
);
CREATE INDEX IF NOT EXISTS idx_puzzles_play_date ON puzzles(play_date);

CREATE TABLE IF NOT EXISTS puzzle_ranks (
    puzzle_id  BIGINT NOT NULL REFERENCES puzzles(id),
    lemma_id   BIGINT NOT NULL REFERENCES lemmas(id),
    rank       INT NOT NULL,
    PRIMARY KEY (puzzle_id, lemma_id)
);
CREATE INDEX IF NOT EXISTS idx_puzzle_ranks_rank ON puzzle_ranks(puzzle_id, rank);

CREATE TABLE IF NOT EXISTS plays (
    id           BIGSERIAL PRIMARY KEY,
    session_id   BIGINT NOT NULL REFERENCES sessions(id),
    user_id      BIGINT REFERENCES users(id),
    puzzle_id    BIGINT NOT NULL REFERENCES puzzles(id),
    solved       BOOLEAN NOT NULL DEFAULT FALSE,
    guess_count  INT NOT NULL DEFAULT 0,
    hints_used   INT NOT NULL DEFAULT 0,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    UNIQUE (session_id, puzzle_id)
);

CREATE TABLE IF NOT EXISTS guesses (
    id           BIGSERIAL PRIMARY KEY,
    play_id      BIGINT NOT NULL REFERENCES plays(id),
    lemma_id     BIGINT NOT NULL REFERENCES lemmas(id),
    rank         INT NOT NULL,
    guess_index  INT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (play_id, lemma_id)
);

-- Only 'nearby_word' is produced now: a hint reveals a word ranked closer than
-- the player's best guess. 'letter_count'/'first_letter' are kept in the CHECK
-- for rows written before that change.
CREATE TABLE IF NOT EXISTS hints (
    id         BIGSERIAL PRIMARY KEY,
    play_id    BIGINT NOT NULL REFERENCES plays(id),
    hint_type  TEXT NOT NULL CHECK (hint_type IN ('letter_count', 'first_letter', 'nearby_word')),
    payload    JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unknown_words (
    id           BIGSERIAL PRIMARY KEY,
    raw_input    TEXT UNIQUE NOT NULL,
    count        BIGINT NOT NULL DEFAULT 1,
    resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_unknown_words_count ON unknown_words(count DESC) WHERE NOT resolved;
