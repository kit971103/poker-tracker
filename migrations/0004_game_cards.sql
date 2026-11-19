-- Score-card PNG per closed game, used as the og:image for link previews.
-- Rendered in the admin's browser (canvas) and uploaded, so the Worker never rasterises anything.
CREATE TABLE IF NOT EXISTS game_cards (
  game_id     INTEGER PRIMARY KEY REFERENCES games(id),
  png_b64     TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
