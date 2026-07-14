PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  time_zone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hourly_link_metrics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  metric_hour TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  bot_clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
  UNIQUE (link_id, metric_hour)
);

CREATE INDEX IF NOT EXISTS hourly_link_metrics_workspace_hour_idx
  ON hourly_link_metrics(workspace_id, metric_hour);

CREATE INDEX IF NOT EXISTS hourly_link_metrics_link_hour_idx
  ON hourly_link_metrics(link_id, metric_hour);

CREATE TABLE IF NOT EXISTS analytics_hourly_coverage (
  workspace_id TEXT PRIMARY KEY,
  starts_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO analytics_hourly_coverage (workspace_id, starts_at, created_at)
VALUES (
  'wsp_default',
  strftime('%Y-%m-%dT00:00:00.000Z', 'now', '+1 day'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);
