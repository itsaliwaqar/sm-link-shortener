-- Initial schema for sm-link-shortener

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' | 'member'
  created_at INTEGER NOT NULL
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_folders_parent ON folders(parent_id);

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL REFERENCES domains(id),
  slug TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT,
  slug_type TEXT NOT NULL DEFAULT 'random', -- 'random' | 'custom'
  created_by TEXT NOT NULL REFERENCES users(id),
  total_clicks INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(domain_id, slug)
);
CREATE INDEX idx_links_folder ON links(folder_id);
CREATE INDEX idx_links_domain ON links(domain_id);
CREATE INDEX idx_links_created_by ON links(created_by);
CREATE INDEX idx_links_created_at ON links(created_at);

-- Tracks which hashed visitors have hit a given link, for all-time unique counting.
CREATE TABLE link_visitors (
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (link_id, visitor_hash)
);

-- Individual click events, for time-series analytics and breakdowns.
CREATE TABLE clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  is_unique INTEGER NOT NULL DEFAULT 0,
  country TEXT,
  referrer TEXT,
  referrer_host TEXT,
  device TEXT,
  browser TEXT,
  os TEXT
);
CREATE INDEX idx_clicks_link_ts ON clicks(link_id, ts);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
