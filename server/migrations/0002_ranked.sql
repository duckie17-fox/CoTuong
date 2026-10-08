-- Đấu xếp hạng (spec v4): hàng chờ ghép trận, ván xếp hạng với máy
CREATE TABLE match_queue (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  elo INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL,
  room_code TEXT, color TEXT
);
CREATE TABLE bot_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL, bot_name TEXT NOT NULL, bot_elo INTEGER NOT NULL, color TEXT NOT NULL,
  created_at INTEGER NOT NULL, finished_at INTEGER,
  result TEXT, reason TEXT, elo_before INTEGER, elo_after INTEGER
);
CREATE INDEX bot_games_user ON bot_games(user_id, created_at);
