CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT 'Independent',
  description TEXT NOT NULL,
  skills TEXT NOT NULL DEFAULT '',
  work_type TEXT NOT NULL DEFAULT 'Contract',
  location_scope TEXT NOT NULL DEFAULT 'Worldwide',
  contact TEXT NOT NULL,
  budget TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_posts_status_created_at
  ON posts(status, created_at DESC);


CREATE TABLE IF NOT EXISTS post_events (
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_events_fingerprint_created_at
  ON post_events(fingerprint, created_at DESC);
