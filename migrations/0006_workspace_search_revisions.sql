CREATE TABLE IF NOT EXISTS workspace_revisions (
  workspace_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO workspace_revisions(workspace_id, revision)
SELECT id, 0 FROM workspaces;
