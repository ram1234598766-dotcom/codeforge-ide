CREATE TABLE IF NOT EXISTS code_change_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_content TEXT NOT NULL,
  original_hash TEXT NOT NULL,
  proposed_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_code_change_requests_owner_status
  ON code_change_requests(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_code_change_requests_workspace
  ON code_change_requests(workspace_id, status, created_at DESC);
