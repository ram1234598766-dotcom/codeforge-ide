CREATE TABLE IF NOT EXISTS code_runs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('succeeded','failed','timed_out','preview')),
  exit_code INTEGER,
  stdout TEXT NOT NULL DEFAULT '',
  stderr TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS code_runs_workspace_created_idx
ON code_runs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS code_runs_user_created_idx
ON code_runs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS code_run_limits (
  user_id TEXT NOT NULL,
  minute_bucket INTEGER NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, minute_bucket)
);
