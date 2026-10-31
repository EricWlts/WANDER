"""Offline tests: no real Codex calls, network or application edits."""
import argparse
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import orchestrator as o


class RoutingTests(unittest.TestCase):
    def test_low(self):
        for task in ("T4 Regressionstests", "T6 alive-Prüfung", "README Tippfehler", "Nur Tests ergänzen"):
            with self.subTest(task=task):
                self.assertEqual(o.route(task), ("gpt-6-luna", "low"))

    def test_medium_and_unknown(self):
        for task in ("T1 Ladefehler", "T2 Escape", "T3 ARIA", "T5 Save-Test", "Unbekannte lokale Änderung"):
            self.assertEqual(o.route(task), o.LUNA)

    def test_sol_and_risk_precedence(self):
        for task in ("T7", "Recovery prüfen", "Autosave ändern", "README erklärt published_data",
                     "Backend ändern backend/app.py", "Tests für CSRF", "Datenbankmigration"):
            self.assertEqual(o.route(task), o.SOL)

    def test_architecture_stops(self):
        for task in ("Astra", "Mehrbenutzerbetrieb", "Cloudhosting", "grundlegende Architektur ändern"):
            with self.assertRaises(o.Stop):
                o.route(task)


class SafetyTests(unittest.TestCase):
    def test_paths(self):
        self.assertEqual(o.safe_path("src/App.tsx"), "src/App.tsx")
        for path in ("../a", "/tmp/a", ".env.local", "x/.env", "secrets.json", ".git/config",
                     ".codex/config.toml", "credentials.json", "key.pem", ".instance/db", "."):
            with self.subTest(path=path), self.assertRaises(o.Stop):
                o.safe_path(path)

    def test_explicit_worker_settings(self):
        cmd = o.worker_command(Path("/workspace"), o.LUNA, Path("schema"), Path("answer"))
        self.assertIn("workspace-write", cmd)
        self.assertIn('model_reasoning_effort="medium"', cmd)
        self.assertIn("gpt-6-luna", cmd)
        self.assertIn("features.multi_agent=false", cmd)
        self.assertNotIn("--yolo", cmd)
        self.assertNotIn("danger-full-access", cmd)

    def test_backend_checks(self):
        self.assertEqual(len(o.check_plan(["src/App.tsx"])), 2)
        self.assertIn(["npm", "test"], o.check_plan(["backend/app.py"]))

    def test_unclear_answers_stop(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "answer.json"
            for content in ("not json", "null", '{}', '{"status":"complete","summary":""}',
                            '{"status":"unknown","summary":"unclear"}'):
                path.write_text(content)
                with self.subTest(content=content), self.assertRaises(o.Stop):
                    o.validate_answer(path)

    def test_symlinks_stop(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "link").symlink_to("/tmp")
            with self.assertRaises(o.Stop):
                o.snapshot(root)

    def test_node_modules_preserves_internal_relative_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source"
            target = root / "copy"
            (source / ".bin").mkdir(parents=True)
            (source / "typescript" / "bin").mkdir(parents=True)
            (source / "typescript" / "bin" / "tsc").write_text("#!/usr/bin/env node\n")
            (source / ".bin" / "tsc").symlink_to("../typescript/bin/tsc")

            o.copy_node_modules(source, target)

            copied_link = target / ".bin" / "tsc"
            self.assertTrue(copied_link.is_symlink())
            self.assertEqual(os.readlink(copied_link), "../typescript/bin/tsc")
            self.assertEqual(copied_link.resolve().read_text(), "#!/usr/bin/env node\n")

    def test_node_modules_rejects_symlinks_outside_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source"
            target = root / "copy"
            outside = root / "outside"
            source.mkdir()
            outside.write_text("outside")
            (source / "escape").symlink_to("../outside")

            with self.assertRaises(o.Stop):
                o.copy_node_modules(source, target)
            self.assertFalse(target.exists())

    def test_lock_prevents_second_runner(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            storage = root / "artifacts" / "orchestrator"
            storage.mkdir(parents=True)
            with (storage / "runner.lock").open("a") as lock:
                o.fcntl.flock(lock, o.fcntl.LOCK_EX | o.fcntl.LOCK_NB)
                with patch.object(o, "ROOT", root), patch.object(o.shutil, "which", return_value="found"), \
                        self.assertRaises(o.Stop):
                    o.execute(argparse.Namespace(), o.LUNA, [], "Rules")

    def test_noninteractive_sol_denied(self):
        with patch.object(sys.stdin, "isatty", return_value=False), self.assertRaises(o.Stop):
            o.confirm_sol()

    def test_dry_run_has_no_process_or_write(self):
        with patch.object(o, "execute", side_effect=AssertionError("execution")), \
                patch.object(subprocess, "Popen", side_effect=AssertionError("process")), \
                patch.object(Path, "write_text", side_effect=AssertionError("write")), \
                patch.object(Path, "mkdir", side_effect=AssertionError("mkdir")), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(o.main(["T2 Escape", "--allow", "src/App.tsx", "--dry-run"]), 0)
        self.assertTrue(json.loads(output.getvalue())["dry_run"])

    def test_timeout_kills_group_and_reaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(subprocess, "Popen") as popen, patch.object(o.os, "killpg") as kill:
                process = popen.return_value
                process.pid = 123
                process.communicate.side_effect = subprocess.TimeoutExpired("fake", 1)
                with self.assertRaises(o.Stop):
                    o.run_process(["fake"], Path(tmp), 1, Path(tmp) / "log")
                kill.assert_called_once_with(123, o.signal.SIGKILL)
                process.wait.assert_called_once()
                self.assertTrue(popen.call_args.kwargs["start_new_session"])

    def test_real_offline_child_timeout(self):
        # Spawn a local sleeping grandchild, never Codex. Its delayed write must not happen.
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            marker = root / "survived"
            child = "import time,pathlib; time.sleep(2); pathlib.Path(" + repr(str(marker)) + ").touch()"
            parent = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c'," + repr(child) + "]); time.sleep(20)"
            with self.assertRaises(o.Stop):
                o.run_process([sys.executable, "-c", parent], root, 0.1, root / "log")
            # A second local subprocess supplies the delay without starting any worker.
            subprocess.run([sys.executable, "-c", "import time; time.sleep(2.1)"], check=True)
            self.assertFalse(marker.exists())


class LifecycleTests(unittest.TestCase):
    def simulate(self, statuses, unexpected=False, check_failure=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in o.RULES:
                (root / name).write_text("Rules")
            (root / "target.txt").write_text("before")
            (root / "node_modules").mkdir()
            storage = root / "runs"
            storage.mkdir()
            answers = iter(statuses)
            calls = []

            def fake_run(command, **kwargs):
                if command[1] == "ls-files":
                    return subprocess.CompletedProcess(command, 0, ("\0".join((*o.RULES, "target.txt")) + "\0").encode())
                return subprocess.CompletedProcess(command, 0, b"")

            def fake_process(command, cwd, timeout, log, prompt=None):
                if command[0] == "codex":
                    calls.append(command)
                    (cwd / "target.txt").write_text("after " + str(len(calls)))
                    if unexpected:
                        (cwd / "surprise.txt").write_text("bad")
                    answer = Path(command[command.index("--output-last-message") + 1])
                    answer.write_text(json.dumps({"status": next(answers), "summary": "Offline test"}))
                return 1 if check_failure and command[0] == "npm" else 0

            args = argparse.Namespace(task="test", timeout=10)
            with patch.object(o, "ROOT", root), patch.object(subprocess, "run", side_effect=fake_run), \
                    patch.object(o, "run_process", side_effect=fake_process), \
                    patch.object(o, "confirm_sol") as confirm, \
                    contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                result = o.execute_locked(args, o.LUNA, ["target.txt"], "Rules", storage)
            report = json.loads(next(storage.glob("*/report.json")).read_text())
            self.assertEqual((root / "target.txt").read_text(), "before")
            return result, report, len(calls), confirm.call_count

    def test_success_is_review_only(self):
        result, report, calls, _ = self.simulate(["complete"])
        self.assertEqual((result, calls), (0, 1))
        self.assertEqual(report["status"], "ready_for_manual_review")
        self.assertEqual(len(report["checks"]), 2)

    def test_one_repair_one_escalation(self):
        result, report, calls, confirms = self.simulate(["needs_repair", "needs_sol", "complete"])
        self.assertEqual((result, calls, confirms), (0, 3, 1))
        self.assertEqual(report["calls"][-1]["model"], o.SOL[0])

    def test_repeated_repair_stops(self):
        self.assertEqual(self.simulate(["needs_repair", "needs_repair"])[:1], (1,))

    def test_repeated_escalation_stops(self):
        self.assertEqual(self.simulate(["needs_sol", "needs_sol"])[2], 2)

    def test_unexpected_change_stops(self):
        result, report, calls, _ = self.simulate(["complete"], unexpected=True)
        self.assertEqual((result, calls), (1, 1))
        self.assertEqual(report["checks"], [])

    def test_failed_check_stops_without_repair(self):
        result, report, calls, _ = self.simulate(["complete"], check_failure=True)
        self.assertEqual((result, calls), (1, 1))
        self.assertEqual(len(report["checks"]), 1)

    def test_blocked_stops(self):
        self.assertEqual(self.simulate(["blocked"])[0], 1)


if __name__ == "__main__":
    unittest.main()
