#!/usr/bin/env python3
"""Exercise the production D1 additive migrations against disposable SQLite data."""

from pathlib import Path
import sqlite3
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = (
    "migrations/0005_code_change_requests.sql",
    "migrations/0006_workspace_search_revisions.sql",
)


class D1MigrationSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix="codeforge-d1-fixture-")
        self.connection = sqlite3.connect(Path(self.temp_dir.name) / "fixture.sqlite")
        self.connection.execute("PRAGMA foreign_keys = ON")
        self.connection.executescript(
            """
            CREATE TABLE workspaces (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL
            );
            CREATE TABLE workspace_files (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );
            INSERT INTO workspaces(id, user_id, name)
            VALUES ('fixture-workspace-1', 'fixture-user', 'Existing workspace');
            INSERT INTO workspace_files(id, workspace_id, file_path, content)
            VALUES ('fixture-file-1', 'fixture-workspace-1', 'src/main.ts', 'keep this file');
            """
        )

    def tearDown(self):
        self.connection.close()
        self.temp_dir.cleanup()

    def apply_migrations(self):
        for relative_path in MIGRATIONS:
            sql = (ROOT / relative_path).read_text(encoding="utf-8")
            self.connection.executescript(sql)

    def test_migrations_are_rerunnable_without_losing_existing_data_or_revision_progress(self):
        self.apply_migrations()
        self.connection.execute(
            """INSERT INTO code_change_requests
               (id, user_id, workspace_id, file_path, original_content, original_hash, proposed_content)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("fixture-request-1", "fixture-user", "fixture-workspace-1", "src/main.ts", "before", "sha256:before", "after"),
        )
        self.connection.execute(
            "UPDATE workspace_revisions SET revision = 7 WHERE workspace_id = ?",
            ("fixture-workspace-1",),
        )
        self.connection.execute(
            "INSERT INTO workspaces(id, user_id, name) VALUES (?, ?, ?)",
            ("fixture-workspace-2", "fixture-user", "Created after first migration"),
        )
        self.connection.execute(
            "INSERT INTO workspace_files(id, workspace_id, file_path, content) VALUES (?, ?, ?, ?)",
            ("fixture-file-2", "fixture-workspace-2", "README.md", "new workspace data"),
        )
        self.connection.commit()

        self.apply_migrations()

        workspaces = self.connection.execute(
            "SELECT id, name FROM workspaces ORDER BY id"
        ).fetchall()
        self.assertEqual(
            workspaces,
            [
                ("fixture-workspace-1", "Existing workspace"),
                ("fixture-workspace-2", "Created after first migration"),
            ],
        )
        files = self.connection.execute(
            "SELECT id, content FROM workspace_files ORDER BY id"
        ).fetchall()
        self.assertEqual(
            files,
            [
                ("fixture-file-1", "keep this file"),
                ("fixture-file-2", "new workspace data"),
            ],
        )
        request = self.connection.execute(
            "SELECT id, original_content, original_hash, proposed_content, status FROM code_change_requests WHERE id = ?",
            ("fixture-request-1",),
        ).fetchone()
        self.assertEqual(
            request,
            ("fixture-request-1", "before", "sha256:before", "after", "pending"),
        )
        revisions = self.connection.execute(
            "SELECT workspace_id, revision FROM workspace_revisions ORDER BY workspace_id"
        ).fetchall()
        self.assertEqual(
            revisions,
            [("fixture-workspace-1", 7), ("fixture-workspace-2", 0)],
        )

    def test_migrations_create_expected_indexes(self):
        self.apply_migrations()
        indexes = {
            row[0]
            for row in self.connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'index'"
            ).fetchall()
        }
        self.assertTrue(
            {
                "idx_code_change_requests_owner_status",
                "idx_code_change_requests_workspace",
            }.issubset(indexes)
        )

    def test_workspace_foreign_keys_cascade_only_the_selected_fixture_workspace(self):
        self.connection.execute(
            "INSERT INTO workspaces(id, user_id, name) VALUES (?, ?, ?)",
            ("fixture-workspace-2", "fixture-user", "Unrelated fixture workspace"),
        )
        self.connection.execute(
            "INSERT INTO workspace_files(id, workspace_id, file_path, content) VALUES (?, ?, ?, ?)",
            ("fixture-file-2", "fixture-workspace-2", "README.md", "preserve unrelated fixture"),
        )
        self.apply_migrations()
        self.connection.execute(
            """INSERT INTO code_change_requests
               (id, user_id, workspace_id, file_path, original_content, original_hash, proposed_content)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            ("fixture-request-cascade", "fixture-user", "fixture-workspace-1", "src/main.ts", "before", "sha256:before", "after"),
        )
        self.connection.execute(
            "DELETE FROM workspaces WHERE id = ?", ("fixture-workspace-1",)
        )
        self.connection.commit()
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM code_change_requests WHERE id = ?",
                ("fixture-request-cascade",),
            ).fetchone()[0],
            0,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM workspace_revisions WHERE workspace_id = ?",
                ("fixture-workspace-1",),
            ).fetchone()[0],
            0,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM workspace_files WHERE workspace_id = ?",
                ("fixture-workspace-1",),
            ).fetchone()[0],
            0,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM workspaces WHERE id = ?",
                ("fixture-workspace-2",),
            ).fetchone()[0],
            1,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM workspace_files WHERE id = ?",
                ("fixture-file-2",),
            ).fetchone()[0],
            1,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT COUNT(*) FROM workspace_revisions WHERE workspace_id = ?",
                ("fixture-workspace-2",),
            ).fetchone()[0],
            1,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
