-- Accounts for cloud mode (MODE=cloud). Account 1 stays the self-hosted owner.

ALTER TABLE accounts ADD COLUMN password_hash TEXT;
-- Bumped on password change so every older session stops working.
ALTER TABLE accounts ADD COLUMN session_gen INTEGER NOT NULL DEFAULT 0;

-- Per-account daily counters; written only in cloud mode.
CREATE TABLE account_usage (
  account_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  events INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_read INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, day)
);

CREATE INDEX sites_account ON sites (account_id);
