import json
import os
import tempfile
import unittest

import runner


class RunnerPathTests(unittest.TestCase):
    def test_private_and_generated_files_are_rejected(self):
        for path in [".env", ".env.local", ".git/config", "node_modules/react/index.js", "certs/private.pem"]:
            self.assertFalse(runner.safe_path(path), path)

    def test_normal_source_and_project_manifest_are_allowed(self):
        self.assertTrue(runner.safe_path("src/App.tsx"))
        self.assertTrue(runner.safe_path("package.json"))

    def test_project_writer_never_writes_outside_project_root(self):
        payload = {
            "entryPath": "src/main.js",
            "files": [
                {"path": "src/main.js", "content": "console.log('safe')"},
                {"path": "../escape.txt", "content": "no"},
            ],
        }
        with tempfile.TemporaryDirectory() as project:
            self.assertEqual(runner.write_project(payload, project), "src/main.js")
            self.assertTrue(os.path.isfile(os.path.join(project, "src", "main.js")))
            self.assertFalse(os.path.exists(os.path.join(os.path.dirname(project), "escape.txt")))


if __name__ == "__main__":
    unittest.main()
