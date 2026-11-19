-- Verifiable seat / dealer-button draws. Append-only: a re-draw adds a row, nothing is overwritten.
CREATE TABLE IF NOT EXISTS seat_draws (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     INTEGER REFERENCES games(id),      -- open game at draw time, if any
  date        TEXT    NOT NULL,                  -- YYYY-MM-DD (Vancouver), part of the seed input
  players     TEXT    NOT NULL CHECK (json_valid(players)),  -- JSON array of names, sorted
  seats       INTEGER NOT NULL,
  nonce       TEXT    NOT NULL,                  -- random hex generated at draw time
  seed        TEXT    NOT NULL,                  -- sha256(seedInput) hex
  result      TEXT    NOT NULL CHECK (json_valid(result)),   -- JSON array, one entry per seat (name or null)
  button      INTEGER NOT NULL,                  -- 1-based seat number of the dealer button
  created_by  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS seat_draws_game ON seat_draws(game_id);
