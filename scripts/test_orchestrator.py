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

    def test_documentation_tasks_low_but_risk_terms_still_sol(self):
        for task in ("Dokumentation aktualisieren", "README: Installation beschreiben", "README korrigiert"):
            self.assertEqual(o.route(task), ("gpt-6-luna", "low"))

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

    def test_usage_parser_reports_unknown_or_structured_counts(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "worker.log"
            self.assertEqual(o.usage_from_log(log)["input_tokens"], "unknown")
            log.write_text('{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":7,"total_tokens":19,"input_tokens_details":{"cached_tokens":3}}}\n')
            self.assertEqual(o.usage_from_log(log), {"input_tokens": 12, "output_tokens": 7,
                "total_tokens": 19, "cached_input_tokens": 3, "reasoning_output_tokens": "unknown"})

    def test_review_apply_and_conflicts_use_only_approved_temporary_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = root / "original"
            run = root / "run"
            (original / "docs").mkdir(parents=True)
            (run / "workspace" / "docs").mkdir(parents=True)
            source, candidate = original / "docs" / "guide.md", run / "workspace" / "docs" / "guide.md"
            source.write_text("before\n")
            candidate.write_text("after\n")
            base = {"docs/guide.md": __import__("hashlib").sha256(b"before\n").hexdigest()}
            (run / "report.json").write_text(json.dumps({"status": "ready_for_manual_review",
                "allowed": ["docs/guide.md"], "files": ["docs/guide.md"], "base_hashes": base}))
            with patch.object(o, "ROOT", original), contextlib.redirect_stdout(io.StringIO()) as output:
                o.review_run(run)
            self.assertIn("-before", output.getvalue())
            with patch.object(o, "ROOT", original):
                o.review_run(run, apply=True, input_fn=lambda _: "APPLY")
            self.assertEqual(source.read_text(), "after\n")
            source.write_text("changed elsewhere\n")
            with patch.object(o, "ROOT", original), self.assertRaisesRegex(o.Stop, "Konflikt"):
                o.review_run(run, apply=True)

    def test_review_ignores_internal_dependency_symlinks_but_checks_project_delta(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, run = Path(tmp) / "original", Path(tmp) / "run"
            workspace = run / "workspace"
            (root / "docs").mkdir(parents=True)
            (workspace / "docs").mkdir(parents=True)
            source, candidate = root / "docs/a.txt", workspace / "docs/a.txt"
            source.write_text("before")
            candidate.write_text("after")
            (workspace / "node_modules/.bin").mkdir(parents=True)
            (workspace / "node_modules/pkg").mkdir()
            (workspace / "node_modules/pkg/tool").write_text("tool")
            (workspace / "node_modules/.bin/tool").symlink_to("../pkg/tool")
            base = {"docs/a.txt": __import__("hashlib").sha256(b"before").hexdigest()}
            (run / "report.json").write_text(json.dumps({"status": "ready_for_manual_review",
                "allowed": ["docs/a.txt"], "files": ["docs/a.txt"], "base_hashes": base}))
            with patch.object(o, "ROOT", root):
                o.review_run(run)
                (workspace / "unexpected.txt").write_text("surprise")
                with self.assertRaisesRegex(o.Stop, "unerwartet verändert"):
                    o.review_run(run)

    def test_review_rejects_old_incomplete_reports(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, run = Path(tmp) / "original", Path(tmp) / "run"
            root.mkdir()
            (run / "workspace").mkdir(parents=True)
            for report in (
                {"status": "ready_for_manual_review", "files": ["a.txt"], "base_hashes": {"a.txt": "0" * 64}},
                {"status": "ready_for_manual_review", "allowed": ["a.txt"], "files": ["a.txt"]},
            ):
                (run / "report.json").write_text(json.dumps(report))
                with patch.object(o, "ROOT", root), self.assertRaises(o.Stop):
                    o.review_run(run)

    def test_review_rejects_changed_original_before_display_or_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, run = Path(tmp) / "original", Path(tmp) / "run"
            (root / "a.txt").parent.mkdir(parents=True)
            (run / "workspace").mkdir(parents=True)
            (root / "a.txt").write_text("changed")
            (run / "workspace/a.txt").write_text("worker")
            base = {"a.txt": __import__("hashlib").sha256(b"before").hexdigest()}
            (run / "report.json").write_text(json.dumps({"status": "ready_for_manual_review",
                "allowed": ["a.txt"], "files": ["a.txt"], "base_hashes": base}))
            with patch.object(o, "ROOT", root), self.assertRaisesRegex(o.Stop, "Konflikt"):
                o.review_run(run)

    def test_apply_still_rejects_symlink_in_approved_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, run = Path(tmp) / "original", Path(tmp) / "run"
            root.mkdir()
            outside = Path(tmp) / "outside"
            outside.write_text("before")
            (root / "a.txt").symlink_to(outside)
            (run / "workspace").mkdir(parents=True)
            (run / "workspace/a.txt").write_text("after")
            base = {"a.txt": __import__("hashlib").sha256(b"before").hexdigest()}
            (run / "report.json").write_text(json.dumps({"status": "ready_for_manual_review",
                "allowed": ["a.txt"], "files": ["a.txt"], "base_hashes": base}))
            with patch.object(o, "ROOT", root), self.assertRaisesRegex(o.Stop, "Symlink im Übernahmepfad"):
                o.review_run(run, apply=True, input_fn=lambda _: "APPLY")

    def test_review_rejects_unapproved_file_and_requires_exact_confirmation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root, run = Path(tmp) / "original", Path(tmp) / "run"
            root.mkdir()
            (run / "workspace").mkdir(parents=True)
            (run / "workspace" / "a.txt").write_text("new")
            (run / "report.json").write_text(json.dumps({"status": "ready_for_manual_review",
                "allowed": ["a.txt"], "files": ["a.txt"], "base_hashes": {}}))
            with patch.object(o, "ROOT", root), self.assertRaises(o.Stop):
                o.review_run(run, selected=["other.txt"])
            with patch.object(o, "ROOT", root), self.assertRaises(o.Stop):
                o.review_run(run, apply=True, input_fn=lambda _: "no")
            self.assertFalse((root / "a.txt").exists())

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
    def simulate(self, statuses, unexpected=False, check_failure=False, ds_store_during_check=False):
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
                elif ds_store_during_check:
                    (cwd / ".DS_Store").write_text("Finder metadata")
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

    def test_ds_store_created_by_check_is_ignored_and_not_copied_to_original(self):
        result, report, calls, _ = self.simulate(["complete"], ds_store_during_check=True)
        self.assertEqual((result, calls), (0, 1))
        self.assertEqual(report["status"], "ready_for_manual_review")
        self.assertEqual(report["files"], ["target.txt"])

    def test_unallowed_file_change_still_stops(self):
        result, report, calls, _ = self.simulate(["complete"], unexpected=True)
        self.assertEqual((result, calls), (1, 1))
        self.assertIn("Unerwartete Dateiänderungen: surprise.txt", report["error"])

    def test_failed_check_stops_without_repair(self):
        result, report, calls, _ = self.simulate(["complete"], check_failure=True)
        self.assertEqual((result, calls), (1, 1))
        self.assertEqual(len(report["checks"]), 1)

    def test_blocked_stops(self):
        self.assertEqual(self.simulate(["blocked"])[0], 1)


if __name__ == "__main__":
    unittest.main()
