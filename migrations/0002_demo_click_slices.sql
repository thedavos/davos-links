CREATE TABLE IF NOT EXISTS demo_click_slices (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  hour_utc INTEGER NOT NULL CHECK (hour_utc BETWEEN 0 AND 23),
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  human_clicks INTEGER NOT NULL DEFAULT 0 CHECK (human_clicks >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS demo_click_slices_scope_date_idx
  ON demo_click_slices(workspace_id, link_id, metric_date);
