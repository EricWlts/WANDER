"""Offline planning tests. Every model invocation is replaced by a local fake."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import orchestrator as o
import orchestrator_planning as p


def task(key="A", **kwargs):
    return {"id": key, "goal": "Escape schließen", "paths": ["src/App.tsx"],
            "read_paths": [], "depends_on": [], "acceptance": ["Escape schließt"],
            "checks": ["frontend", "build", "manual"], "complexity": "local", **kwargs}


def plan(tasks=None, flags=None):
    return {"summary": "Navigation anpassen", "existing": ["Menü vorhanden"],
            "flags": flags or [], "tasks": tasks if tasks is not None else [task()]}


FILES = {"src/App.tsx": "hash", "src/api.ts": "hash", **{n: "hash" for n in o.RULES}}


class ValidationTests(unittest.TestCase):
    def test_schema_and_topological_order(self):
        result = p.validate_plan(plan([task("B", depends_on=["A"]), task()]), FILES, o)
        self.assertEqual([t["id"] for t in result["tasks"]], ["A", "B"])

    def test_invalid_shapes_and_empty_contract_stop(self):
        bad = [None, [], {}, {**plan(), "extra": True}, plan([]), plan([task(acceptance=[])]),
               plan([task(checks=["rm -rf"])]), plan([task(complexity="unknown")]),
               plan([task(goal="")]), plan([task(paths=[])]), plan([task(id=22)])]
        for value in bad:
            with self.subTest(value=value), self.assertRaises(o.Stop):
                p.validate_plan(value, FILES, o)

    def test_paths_are_only_validated_proposals(self):
        for path in ("../escape.py", "/tmp/a", ".env", ".git/config", "src/*.tsx",
                     "src//App.tsx", "src/./App.tsx", "src/secret.json", "unknown/new.ts",
                     "src/directory", "src/a\\b.ts", "src/credentials.json"):
            with self.subTest(path=path), self.assertRaises(o.Stop):
                p.validate_plan(plan([task(paths=[path])]), FILES, o)
        result = p.validate_plan(plan([task(paths=["src/New.tsx"])]), FILES, o)
        self.assertEqual(result["tasks"][0]["paths"], ["src/New.tsx"])
        self.assertNotIn("allowed", result)
        with self.assertRaises(o.Stop):
            p.validate_plan(plan([task(read_paths=["src/New.tsx"])]), FILES, o)

    def test_dependency_failures(self):
        for tasks in ([task(), task()], [task(depends_on=["A"])],
                      [task(depends_on=["missing"])],
                      [task(depends_on=["B"]), task("B", depends_on=["A"])]):
            with self.subTest(tasks=tasks), self.assertRaises(o.Stop):
                p.validate_plan(plan(tasks), FILES, o)

    def test_routing_and_risk_precedence(self):
        self.assertEqual(p.routing(task(), "Menü schließen", o)[0], p.ANALYST)
        self.assertEqual(p.routing(task(complexity="normal"), "Menü schließen", o)[0], o.LUNA)
        self.assertEqual(p.routing(task(complexity="complex"), "Menü schließen", o)[0], o.SOL)
        self.assertEqual(p.routing(task(), "Recovery Tippfehler", o)[0], o.SOL)
        routed = p.decorate(plan(flags=["risky"]), "Menü schließen", o)
        self.assertEqual(routed["tasks"][0]["model"], o.SOL[0])
        self.assertIn("KEINE Schreibberechtigung", routed["tasks"][0]["worker_prompt"])

    def test_astra_triggers_only_for_planning(self):
        self.assertFalse(p.needs_astra(plan(), "Tippfehler", o))
        self.assertFalse(p.needs_astra(plan(), "CSS Hover ohne Astra", o))
        for flag in ("architecture",):
            self.assertFalse(p.needs_astra(plan(flags=[flag]), "Feature", o))
        self.assertTrue(p.needs_astra(plan(), "Mehrbenutzerbetrieb", o))
        self.assertFalse(p.needs_astra(plan([task(str(i)) for i in range(4)]), "Feature", o))
        self.assertFalse(p.needs_astra(plan(flags=["risky"]), "Recovery", o))

    def test_budget_limits_and_unknown_usage(self):
        budget = p.Budget(1, 10, o.Stop)
        budget.admit()
        with self.assertRaises(o.Stop):
            budget.admit()
        budget = p.Budget(2, 10, o.Stop)
        budget.record({"total_tokens": "unknown", "input_tokens": 6, "output_tokens": 4})
        with self.assertRaises(o.Stop):
            budget.admit()
        budget = p.Budget(2, 10, o.Stop)
        budget.record({"total_tokens": "unknown", "input_tokens": "unknown", "output_tokens": 4})
        with self.assertRaises(o.Stop):
            budget.admit()

    def test_auto_dry_run_never_starts_cli_or_writes(self):
        with patch.object(p, "inventory", return_value=FILES), \
                patch.object(o, "run_process", side_effect=AssertionError("worker")), \
                patch.object(p, "check_cli", side_effect=AssertionError("CLI")), \
                patch.object(Path, "write_text", side_effect=AssertionError("write")), \
                patch.object(Path, "mkdir", side_effect=AssertionError("mkdir")), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(o.main(["Änderung", "--auto", "--dry-run"]), 0)
        self.assertFalse(json.loads(output.getvalue())["coding_enabled"])

    def test_cli_errors_and_invalid_arguments_stop(self):
        for args in (["--max-calls", "0"], ["--max-tokens", "0"], ["--allow", "src/App.tsx"]):
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(o.main(["Änderung", "--auto", *args]), 1)
        with patch.object(p, "inventory", side_effect=subprocess.CalledProcessError(1, "git")), \
                contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(o.main(["Änderung", "--auto"]), 1)

    def test_cli_capability_check_does_not_call_model(self):
        with patch.object(p.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, b"--json")) as run:
            with self.assertRaisesRegex(o.Stop, "Option"):
                p.check_cli(o)
        self.assertEqual(run.call_args.args[0], ["codex", "exec", "--help"])

    def test_usage_sums_turns_and_handles_untrusted_log_values(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "usage.log"
            log.write_text('\n'.join(json.dumps(e) for e in (
                [], {"type": "turn.completed", "usage": {"input_tokens": 3, "output_tokens": 2}},
                {"type": "turn.completed", "usage": {"input_tokens": 7, "output_tokens": 4}},
                {"type": "response.completed", "usage": {"input_tokens": 100}})))
            usage = o.usage_from_log(log)
            self.assertEqual((usage["input_tokens"], usage["output_tokens"]), (10, 6))
            self.assertEqual(usage["reasoning_output_tokens"], "unknown")
            log.write_text('{"type":"turn.completed","usage":{"input_tokens":true,"output_tokens_details":null}}')
            self.assertEqual(o.usage_from_log(log)["input_tokens"], "unknown")

    def test_usage_derives_each_turn_total_without_double_counting_cache_or_responses(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / 'usage.log'
            log.write_text('\n'.join(json.dumps(event) for event in [
                {'type': 'turn.completed', 'usage': {'input_tokens': 65888, 'output_tokens': 404,
                    'cached_input_tokens': 40064, 'reasoning_output_tokens': 12}},
                {'type': 'response.completed', 'response': {'usage': {'total_tokens': 66292}}},
                {'type': 'turn.completed', 'usage': {'input_tokens': 5, 'output_tokens': 2,
                    'total_tokens': 7, 'input_tokens_details': {'cached_tokens': 3}}}]))
            usage = o.usage_from_log(log)
            self.assertEqual(usage['total_tokens'], 66299)
            self.assertEqual(usage['input_tokens'], 65893)
            self.assertEqual(usage['output_tokens'], 406)
            self.assertEqual(usage['cached_input_tokens'], 40067)
            self.assertEqual(usage['uncached_input_tokens'], 25826)
            self.assertEqual(usage['reasoning_output_tokens'], 'unknown')


class LifecycleTests(unittest.TestCase):
    def simulate(self, values, tokens=10, max_calls=2, mutate=False, code=0, changed_original=False, request="Menü schließen"):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "src").mkdir()
        (self.root / "src/App.tsx").write_text("before")
        for name in o.RULES:
            (self.root / name).write_text("Rules")
        names = [*o.RULES, "src/App.tsx"]
        self.commands = []
        answers = iter(values)

        def fake_run(command, **kwargs):
            if command[:2] == ["git", "ls-files"]:
                return subprocess.CompletedProcess(command, 0, ("\0".join(names) + "\0").encode())
            return subprocess.CompletedProcess(command, 0, b"")

        def fake_process(command, cwd, timeout, log, prompt=None):
            if command[0] != "codex":
                return 0
            self.commands.append(command)
            self.assertIn("read-only", command)
            self.assertNotIn("workspace-write", command)
            self.assertIn("--ignore-rules", command)
            answer = Path(command[command.index("--output-last-message") + 1])
            value = next(answers)
            answer.write_text(value if isinstance(value, str) else json.dumps(value))
            usage = {"input_tokens": tokens, "output_tokens": 0} if tokens is not None else {}
            log.write_text(json.dumps({"type": "turn.completed", "usage": usage}) + "\n")
            if mutate:
                (cwd / "context.json").write_text("unexpected")
            if changed_original:
                (self.root / "src/App.tsx").write_text("external")
            return code

        self.patches = [patch.object(o, "ROOT", self.root), patch.object(p.subprocess, "run", side_effect=fake_run),
                        patch.object(o, "run_process", side_effect=fake_process), patch.object(p, "check_cli")]
        for mock in self.patches:
            mock.start()
            self.addCleanup(mock.stop)
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            result = o.main([request, "--auto", "--max-calls", str(max_calls)])
        self.report = json.loads(next(self.root.glob("artifacts/orchestrator/*/report.json")).read_text())
        return result

    def test_small_plan_one_call_and_cache(self):
        self.assertEqual(self.simulate([plan()]), 0)
        self.assertEqual(len(self.commands), 1)
        self.assertEqual(self.report["write_permissions"], [])
        self.assertEqual(self.report["status"], "planning_only")
        self.assertEqual((self.root / "src/App.tsx").read_text(), "before")
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(o.main(["Menü schließen", "--auto", "--dry-run"]), 0)
        self.assertTrue(json.loads(output.getvalue())["cached"])
        self.assertEqual(len(self.commands), 1)
        (self.root / "src/App.tsx").write_text("changed")
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(o.main(["Menü schließen", "--auto", "--dry-run"]), 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "analysis_pending")
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(o.main(["Andere Anforderung", "--auto", "--dry-run"]), 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "analysis_pending")

    def test_astra_low_only_plans_and_retains_risks(self):
        self.assertEqual(self.simulate([plan(flags=["architecture", "risky"]), plan()], request="Mehrbenutzerbetrieb"), 0)
        self.assertEqual(len(self.commands), 2)
        self.assertIn("gpt-6-astra", self.commands[1])
        self.assertIn('model_reasoning_effort="low"', self.commands[1])
        self.assertEqual(self.report["plan"]["tasks"][0]["model"], o.SOL[0])
        self.assertEqual([c["phase"] for c in self.report["calls"]], ["analysis", "architecture"])

    def test_no_escalation_when_budget_or_unknown_usage(self):
        self.assertEqual(self.simulate([plan(flags=["architecture"])], max_calls=1, request="Mehrbenutzerbetrieb"), 1)
        self.assertEqual(len(self.commands), 1)
        self.assertEqual(self.report["status"], "stopped")

    def test_unknown_usage_prevents_astra(self):
        self.assertEqual(self.simulate([plan(flags=["architecture"])], tokens=None, request="Mehrbenutzerbetrieb"), 1)
        self.assertEqual(len(self.commands), 1)

    def test_token_limit_prevents_astra(self):
        self.assertEqual(self.simulate([plan(flags=["architecture"])], tokens=20000, request="Mehrbenutzerbetrieb"), 1)
        self.assertEqual(len(self.commands), 1)

    def test_bad_response_has_no_retry(self):
        self.assertEqual(self.simulate(["not json"]), 1)
        self.assertEqual(len(self.commands), 1)

    def test_modified_copy_stops(self):
        self.assertEqual(self.simulate([plan()], mutate=True), 1)
        self.assertIn("Projektkopie verändert", self.report["error"])

    def test_modified_original_stops(self):
        self.assertEqual(self.simulate([plan()], changed_original=True), 1)
        self.assertIn("Originalprojekt", self.report["error"])

    def test_process_error_stops_without_fallback(self):
        self.assertEqual(self.simulate([plan()], code=1), 1)
        self.assertEqual(len(self.commands), 1)

    def test_unclear_is_preserved_on_cache_hit(self):
        self.assertEqual(self.simulate([plan(flags=["unclear"])]), 0)
        self.assertEqual(self.report["status"], "needs_clarification")
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(o.main(["Menü schließen", "--auto"]), 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "needs_clarification")

    def test_planning_report_cannot_be_applied(self):
        self.assertEqual(self.simulate([plan()]), 0)
        run = next(self.root.glob("artifacts/orchestrator/*/report.json")).parent
        with self.assertRaises(o.Stop):
            o.review_run(run, apply=True)

    def test_invalid_cached_plan_is_rejected_without_new_call(self):
        self.assertEqual(self.simulate([plan()]), 0)
        cache = next(self.root.glob("artifacts/orchestrator/plan-*.json"))
        cache.write_text('{"plan": null}')
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(o.main(["Menü schließen", "--auto"]), 1)
        self.assertEqual(len(self.commands), 1)

    def test_context_is_bounded_and_analysis_workspace_has_no_source(self):
        self.assertEqual(self.simulate([plan()]), 0)
        workspace = next(self.root.glob('artifacts/orchestrator/*plan-*/workspace'))
        self.assertEqual([f.name for f in workspace.iterdir()], ['context.json'])
        dossier = json.loads((workspace / 'context.json').read_text())
        self.assertLessEqual(len(dossier['scanned_files']), 32)
        self.assertLessEqual(dossier['scanned_bytes'], 384000)
        self.assertLessEqual(len(dossier['snippets']), 6)
        self.assertTrue(all(len(s) <= 2000 for s in dossier['snippets'].values()))
        self.assertNotIn('TASKS.md', dossier['snippets'])

    def test_agent_flags_do_not_launch_astra_for_local_task(self):
        self.assertEqual(self.simulate([plan(flags=['large', 'coupled', 'architecture'])]), 0)
        self.assertEqual(len(self.commands), 1)

    def test_cache_plan_modification_rejected_without_call(self):
        self.assertEqual(self.simulate([plan()]), 0)
        cache = next(self.root.glob('artifacts/orchestrator/plan-*.json'))
        value = json.loads(cache.read_text())
        value['plan']['tasks'][0]['goal'] = 'anderes Ziel'
        cache.write_text(json.dumps(value))
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(o.main(['Menü schließen', '--auto']), 1)
        self.assertEqual(len(self.commands), 1)

    def test_lock_stops_parallel_planner(self):
        self.assertEqual(self.simulate([plan()]), 0)
        storage = self.root / "artifacts/orchestrator"
        with (storage / "runner.lock").open("a") as lock:
            o.fcntl.flock(lock, o.fcntl.LOCK_EX | o.fcntl.LOCK_NB)
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(o.main(["Andere Anforderung", "--auto"]), 1)
        self.assertEqual(len(self.commands), 1)


if __name__ == "__main__":
    unittest.main()
