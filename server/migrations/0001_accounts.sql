-- Tài khoản, phiên đăng nhập, đồng bộ tiến độ, bạn bè, lời mời, ván tính Elo (spec v3, mục 5)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,            -- chữ thường
  display_name TEXT NOT NULL,
  pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1200,
  rated_games INTEGER NOT NULL DEFAULT 0,
  peak_elo INTEGER NOT NULL DEFAULT 1200,
  wins INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
  user_agent TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE progress (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL, updated_at INTEGER NOT NULL
);
-- một dòng cho mỗi cặp, user_a < user_b
CREATE TABLE friends (
  user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,                     -- pending | accepted
  requested_by INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b)
);
CREATE INDEX friends_b ON friends(user_b);
CREATE TABLE invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL, color TEXT NOT NULL, rated INTEGER NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  status TEXT NOT NULL                      -- pending | accepted | declined
);
CREATE INDEX invites_to ON invites(to_user, status);
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL, game_no INTEGER NOT NULL,
  red_user INTEGER, black_user INTEGER,     -- NULL khi tài khoản đã xoá
  red_name TEXT, black_name TEXT,
  moves TEXT NOT NULL, result TEXT, reason TEXT, rated INTEGER NOT NULL,
  elo_red_before INTEGER, elo_red_after INTEGER, elo_black_before INTEGER, elo_black_after INTEGER,
  ended_at INTEGER NOT NULL,
  UNIQUE (room_code, game_no)
);
CREATE INDEX games_red ON games(red_user, ended_at);
CREATE INDEX games_black ON games(black_user, ended_at);
CREATE TABLE login_attempts (
  ip TEXT NOT NULL, hour INTEGER NOT NULL, count INTEGER NOT NULL,
  PRIMARY KEY (ip, hour)
);
