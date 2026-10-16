-- Lanternfish initial schema.

CREATE TABLE accounts (id INTEGER PRIMARY KEY, email TEXT UNIQUE, created INTEGER);

CREATE TABLE sites (
  id TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id),
  name TEXT, domains TEXT, timezone TEXT, public INTEGER DEFAULT 0,
  server_key TEXT, exclude_paths TEXT, funnel TEXT, created INTEGER,
  share_nonce TEXT
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  site_id TEXT NOT NULL, ts INTEGER NOT NULL, day TEXT NOT NULL,
  name TEXT NOT NULL, path TEXT, pl TEXT, visitor TEXT,
  ref TEXT, tag TEXT, country TEXT, city TEXT,
  device TEXT, browser TEXT, os TEXT, props TEXT
);
-- One index only: each extra index costs another D1 write per event.
-- ts last so realtime can range-scan the last few minutes.
CREATE INDEX events_site_day_name ON events (site_id, day, name, ts);

CREATE TABLE daily (
  site_id TEXT, day TEXT, metric TEXT, dim TEXT, value INTEGER,
  PRIMARY KEY (site_id, day, metric, dim)
);

-- All-sites sparklines read two metrics across every site at once.
CREATE INDEX daily_metric_day ON daily (metric, day);

CREATE TABLE salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);

-- Rows written today, so ingest can stop before D1's free daily limit.
CREATE TABLE usage (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  events INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_read INTEGER NOT NULL DEFAULT 0
);

-- Days whose raw events have been rolled up into daily.
CREATE TABLE rollups (
  site_id TEXT NOT NULL, day TEXT NOT NULL, done INTEGER NOT NULL,
  PRIMARY KEY (site_id, day)
);
CREATE INDEX rollups_day ON rollups (day);

INSERT INTO accounts (id, email, created) VALUES (1, NULL, unixepoch());
