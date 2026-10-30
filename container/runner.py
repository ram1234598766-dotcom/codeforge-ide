#!/usr/bin/env python3
import json
import os
import re
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import PurePosixPath

MAX_ENTRY_BYTES = 256 * 1024
MAX_TOTAL_BYTES = 1_500_000
MAX_FILES = 80
MAX_OUTPUT_BYTES = 16 * 1024
PROCESS_TIMEOUT_SECONDS = 10
RUNTIME_HOME = "/opt/codeforge-runtime"

BLOCKED_DIRS = {
    ".git", ".ssh", ".aws", ".azure", ".config", ".idea", ".vscode",
    "node_modules", "dist", "build", "coverage", ".next", ".nuxt",
    ".venv", "venv", "__pycache__", ".cache", ".turbo", "vendor",
}
BLOCKED_FILES = {
    ".npmrc", ".pypirc", ".netrc", "credentials", "credentials.json",
    "service-account.json", "id_rsa", "id_ed25519", "id_ecdsa",
}
ALLOWED_EXTENSIONS = {".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx", ".py"}

class RunFailure(Exception):
    def __init__(self, message, status="failed"):
        super().__init__(message)
        self.status = status

def safe_path(value):
    if not isinstance(value, str) or not value or len(value) > 500:
        return False
    if value.startswith("/") or "\\" in value:
        return False
    parts = value.split("/")
    if any(part in ("", ".", "..") for part in parts):
        return False
    for part in parts:
        lower = part.lower()
        if lower in BLOCKED_DIRS or lower in BLOCKED_FILES or lower.startswith(".env"):
            return False
        if re.search(r"\.(pem|key|p12|pfx|keystore|jks|mobileprovision)$", lower):
            return False
        if re.search(r"(^|[-_.])(secret|secrets|credential|credentials|private[-_.]?key)([-_.]|$)", lower):
            return False
    lowered = value.lower()
    return not lowered.startswith(("certs/", "certificates/"))

def limit_child():
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_OUTPUT_BYTES * 4, MAX_OUTPUT_BYTES * 4))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))

def run_process(argv, cwd, timeout=PROCESS_TIMEOUT_SECONDS):
    started = time.monotonic()
    with tempfile.TemporaryFile() as stdout_file, tempfile.TemporaryFile() as stderr_file:
        process = subprocess.Popen(
            argv,
            cwd=cwd,
            env={
                "PATH": "/opt/codeforge-runtime/node_modules/.bin:/usr/local/bin:/usr/bin:/bin",
                "HOME": cwd,
                "TMPDIR": cwd,
                "PYTHONIOENCODING": "utf-8",
                "NODE_PATH": os.path.join(RUNTIME_HOME, "node_modules"),
                "CI": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=stdout_file,
            stderr=stderr_file,
            start_new_session=True,
            preexec_fn=limit_child,
        )
        try:
            exit_code = process.wait(timeout=timeout)
            timed_out = False
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
            exit_code = None
            timed_out = True
        stdout_file.seek(0)
        stderr_file.seek(0)
        stdout = stdout_file.read(MAX_OUTPUT_BYTES).decode("utf-8", "replace")
        stderr = stderr_file.read(MAX_OUTPUT_BYTES).decode("utf-8", "replace")
        duration_ms = int((time.monotonic() - started) * 1000)
        if timed_out:
            raise RunFailure("Execution timed out after 10 seconds.", "timed_out")
        if os.path.getsize(stdout_file.name) > MAX_OUTPUT_BYTES or os.path.getsize(stderr_file.name) > MAX_OUTPUT_BYTES:
            stdout += "\n[output truncated]"
        return exit_code, stdout, stderr, duration_ms

def write_project(payload, project_dir):
    entry_path = payload.get("entryPath")
    files = payload.get("files")
    if not isinstance(entry_path, str) or not safe_path(entry_path):
        raise RunFailure("Invalid entry file path.")
    if not isinstance(files, list) or len(files) > MAX_FILES:
        raise RunFailure("Runnable workspace file limit exceeded.")
    seen = set()
    total_bytes = 0
    entry_found = False
    for item in files:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        content = item.get("content")
        if not isinstance(path, str) or not safe_path(path) or not isinstance(content, str):
            continue
        if path in seen:
            raise RunFailure("Duplicate source file paths are not allowed.")
        seen.add(path)
        encoded = content.encode("utf-8")
        total_bytes += len(encoded)
        if total_bytes > MAX_TOTAL_BYTES:
            raise RunFailure("Runnable workspace content must be 1.5 MB or smaller.")
        destination = os.path.realpath(os.path.join(project_dir, path))
        if not destination.startswith(os.path.realpath(project_dir) + os.sep):
            raise RunFailure("Invalid workspace file path.")
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        with open(destination, "wb") as handle:
            handle.write(encoded)
        if path == entry_path:
            entry_found = True
    if not entry_found:
        raise RunFailure("The selected file is not included in the runnable workspace.")
    node_modules = os.path.join(RUNTIME_HOME, "node_modules")
    target = os.path.join(project_dir, "node_modules")
    if os.path.exists(node_modules) and not os.path.exists(target):
        os.symlink(node_modules, target, target_is_directory=True)
    return entry_path

def make_react_preview(entry_path, project_dir):
    entry = "./" + entry_path.replace("\\", "/")
    generated = """import React from 'react';
import { createRoot } from 'react-dom/client';
import * as UserModule from %s;
const App = UserModule.default || UserModule.App;
const target = document.getElementById('root');
if (!target) throw new Error('Preview root element is missing.');
if (typeof App !== 'function') throw new Error('React preview requires a default component export or a named App component.');
createRoot(target).render(React.createElement(App));
""" % json.dumps(entry)
    entry_file = os.path.join(project_dir, "__codeforge_preview_entry.jsx")
    with open(entry_file, "w", encoding="utf-8") as handle:
        handle.write(generated)
    bundle_path = os.path.join(project_dir, "__codeforge_preview.js")
    code, stdout, stderr, duration = run_process(
        [
            os.path.join(RUNTIME_HOME, "node_modules", ".bin", "esbuild"),
            entry_file,
            "--bundle",
            "--platform=browser",
            "--format=iife",
            "--target=es2022",
            "--jsx=automatic",
            "--outfile=" + bundle_path,
        ],
        project_dir,
        timeout=8,
    )
    if code != 0:
        raise RunFailure(stderr or stdout or "Could not build the React preview.")
    with open(bundle_path, "r", encoding="utf-8") as handle:
        bundle = handle.read()[:1_500_000]
    css_path = os.path.join(project_dir, "__codeforge_preview.css")
    css = ""
    if os.path.isfile(css_path):
        with open(css_path, "r", encoding="utf-8") as handle:
            css = handle.read()[:100_000]
    html = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>" + css + "</style></head><body><div id=\"root\"></div><script>" + bundle.replace("</script", "<\\/script") + "</script></body></html>"
    return html, duration

def main():
    try:
        raw = sys.stdin.read(2_000_000)
        payload = json.loads(raw)
        entry_path = payload.get("entryPath")
        language = payload.get("language")
        if not isinstance(entry_path, str) or not isinstance(language, str):
            raise RunFailure("Invalid run request.")
        extension = PurePosixPath(entry_path).suffix.lower()
        with tempfile.TemporaryDirectory(prefix="codeforge-") as project_dir:
            write_project(payload, project_dir)
            if language == "react":
                preview_html, duration_ms = make_react_preview(entry_path, project_dir)
                result = {
                    "status": "succeeded",
                    "exitCode": 0,
                    "stdout": "React preview compiled successfully.",
                    "stderr": "",
                    "durationMs": duration_ms,
                    "previewHtml": preview_html,
                }
            else:
                full_path = os.path.join(project_dir, entry_path)
                if language == "javascript":
                    run_path = full_path
                    if extension == ".js":
                        with open(full_path, "rb") as handle:
                            first = handle.read(200_000).decode("utf-8", "replace")
                        if re.search(r"^\s*(import\s|export\s)", first, re.MULTILINE):
                            run_path = full_path + ".mjs"
                            shutil.copyfile(full_path, run_path)
                    command = ["node", run_path]
                elif language == "typescript":
                    command = [os.path.join(RUNTIME_HOME, "node_modules", ".bin", "tsx"), full_path]
                elif language == "python":
                    command = ["python3", "-B", full_path]
                else:
                    raise RunFailure("Unsupported execution language.")
                exit_code, stdout, stderr, duration_ms = run_process(command, project_dir)
                result = {
                    "status": "succeeded" if exit_code == 0 else "failed",
                    "exitCode": exit_code,
                    "stdout": stdout,
                    "stderr": stderr,
                    "durationMs": duration_ms,
                }
    except RunFailure as error:
        result = {
            "status": error.status,
            "exitCode": None,
            "stdout": "",
            "stderr": str(error),
            "durationMs": 0,
        }
    except Exception:
        result = {
            "status": "failed",
            "exitCode": None,
            "stdout": "",
            "stderr": "The isolated execution runner encountered an internal error.",
            "durationMs": 0,
        }
    sys.stdout.write(json.dumps(result, separators=(",", ":")))
    sys.stdout.flush()

if __name__ == "__main__":
    main()
