-- Seat draw feature removed (#18). Drops its table and the AUTOINCREMENT counter row.
DROP TABLE IF EXISTS seat_draws;
DELETE FROM sqlite_sequence WHERE name = 'seat_draws';
