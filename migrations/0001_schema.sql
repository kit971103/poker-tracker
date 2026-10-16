-- Poker tracker schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS players (
  id          INTEGER PRIMARY KEY,           -- 0 = [system] (historical chip-imbalance rows)
  name        TEXT    NOT NULL UNIQUE,
  nickname    TEXT,
  rep_hand    TEXT,
  memo        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id                INTEGER PRIMARY KEY,
  name              TEXT    NOT NULL,
  date              TEXT    NOT NULL,        -- YYYY-MM-DD (Vancouver local date)
  base_buyin        INTEGER NOT NULL DEFAULT 1000,  -- chips per buy-in
  cash              REAL    NOT NULL DEFAULT 20,    -- dollars per buy-in
  bb_size           INTEGER NOT NULL DEFAULT 2,
  memo              TEXT,
  include_dashboard INTEGER NOT NULL DEFAULT 1,
  status            TEXT    NOT NULL DEFAULT 'closed' CHECK (status IN ('open','closed')),
  host_player_id    INTEGER REFERENCES players(id),
  diff_mode         TEXT    CHECK (diff_mode IN ('host','ratio')),
  diff_chips        INTEGER NOT NULL DEFAULT 0,      -- sum(end) - sum(buyin) at close
  created_by        TEXT,
  closed_by         TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  closed_at         TEXT
);

-- Only one running game at a time
CREATE UNIQUE INDEX IF NOT EXISTS one_open_game ON games(status) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS game_players (
  game_id     INTEGER NOT NULL REFERENCES games(id),
  player_id   INTEGER NOT NULL REFERENCES players(id),
  buyin       INTEGER NOT NULL DEFAULT 0,    -- total chips bought in
  chips       TEXT CHECK (chips IS NULL OR json_valid(chips)),
                                             -- chip counts by denomination as JSON, e.g. {"1":7,"5":2,"100":25}
                                             -- (NULL for migrated history)
  end_chips   INTEGER,                       -- chips at end (computed from `chips` for new games)
  adj         INTEGER NOT NULL DEFAULT 0,    -- imbalance adjustment applied at close
  memo        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS gp_player ON game_players(player_id);
