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


CREATE TABLE IF NOT EXISTS search_watches (
  id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  query TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'ANY',
  country_label TEXT NOT NULL DEFAULT 'Anywhere / not sure',
  hours_per_week INTEGER NOT NULL DEFAULT 20,
  work_types TEXT NOT NULL DEFAULT 'contract,part-time,gig',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_checked_at TEXT,
  last_match_at TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_error TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_search_watches_client_updated
  ON search_watches(client_hash, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_watches_enabled_checked
  ON search_watches(enabled, last_checked_at);

CREATE TABLE IF NOT EXISTS watch_matches (
  watch_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  viewed_at TEXT,
  PRIMARY KEY (watch_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_matches_watch_seen
  ON watch_matches(watch_id, first_seen_at DESC);

CREATE TABLE IF NOT EXISTS application_pipeline (
  client_hash TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'saved',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (client_hash, item_id)
);

CREATE INDEX IF NOT EXISTS idx_application_pipeline_client_status_updated
  ON application_pipeline(client_hash, status, updated_at DESC);
