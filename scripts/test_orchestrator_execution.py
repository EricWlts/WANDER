"""Offline execution safety tests: every worker and check is fake."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import orchestrator as o
import orchestrator_execution as e
import orchestrator_planning as p
from test_orchestrator_planning import plan, task


class ExecutionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'src').mkdir()
        (self.root / 'src/App.tsx').write_text('before')
        (self.root / 'src/Other.tsx').write_text('other')
        (self.root / 'node_modules').mkdir()
        for name in o.RULES:
            (self.root / name).write_text('rules')
        self.names = [*o.RULES, 'src/App.tsx', 'src/Other.tsx']
        self.calls, self.checks = [], []
        self.tokens, self.failure, self.result = 10, None, 'complete'
        self.out = io.StringIO()
        self.enter_context(patch.object(o, 'ROOT', self.root))
        self.enter_context(patch.object(o.subprocess, 'run', side_effect=self.git))
        self.enter_context(patch.object(o, 'run_process', side_effect=self.process))
        self.enter_context(patch.object(o.shutil, 'which', return_value='/fake'))
        self.enter_context(patch.object(p, 'check_cli'))
        self.enter_context(patch.object(o.sys.stdin, 'isatty', return_value=True))
        self.enter_context(patch('builtins.input', return_value='EXECUTE'))
        self.enter_context(contextlib.redirect_stdout(self.out))
        self.enter_context(contextlib.redirect_stderr(self.out))
        self.files = p.inventory(o)
        self.storage = self.root / 'artifacts/orchestrator'
        self.plan_id = e.save_plan(self.storage, 'Menü schließen', plan([
            task('B', depends_on=['A']), task('A')]), self.files, o)

    def enter_context(self, ctx):
        result = ctx.__enter__()
        self.addCleanup(ctx.__exit__, None, None, None)
        return result

    def git(self, command, **kwargs):
        data = ('\0'.join(self.names) + '\0').encode() if command[:2] == ['git', 'ls-files'] else b''
        return subprocess.CompletedProcess(command, 0, data)

    def process(self, command, cwd, timeout, log, prompt=None):
        if command[0] == 'codex':
            self.calls.append(command)
            self.assertIn('workspace-write', command)
            self.assertNotIn('--yolo', command)
            if self.failure == 'timeout':
                raise o.Stop('Timeout: codex')
            if self.failure == 'exit':
                return 1
            path = 'src/Other.tsx' if self.failure == 'unexpected' else 'src/App.tsx'
            with (cwd / path).open('a') as f:
                f.write(f'change {len(self.calls)}')
            if self.failure == 'original':
                (self.root / 'src/App.tsx').write_text('external')
            answer = Path(command[command.index('--output-last-message') + 1])
            answer.write_text('null' if self.failure == 'unclear' else json.dumps({
                'status': self.result, 'summary': 'done'}))
            log.write_text(json.dumps({'type': 'turn.completed', 'usage': {
                'input_tokens': self.tokens, 'cached_input_tokens': 2, 'output_tokens': 1}}))
        elif command[0] == 'npm':
            self.checks.append(command)
            if self.failure == 'test':
                return 1
            if self.failure == 'check_mutation':
                (cwd / 'src/App.tsx').write_text('test mutation')
        return 0

    def run_plan(self, *args):
        return o.main(['--execute-plan', self.plan_id, *args])

    def report(self):
        return json.loads(next(self.storage.glob('*exec-*/report.json')).read_text())

    def test_serial_dependencies_routing_and_review(self):
        self.assertEqual(self.run_plan(), 0)
        r = self.report()
        self.assertEqual(r['completed_tasks'], ['A', 'B'])
        self.assertEqual([c['task'] for c in r['calls']], ['A', 'B'])
        self.assertEqual(len(self.checks), 4)
        self.assertEqual(r['status'], 'ready_for_manual_review')
        self.assertEqual(r['write_approval'], ['src/App.tsx'])
        self.assertEqual(r['calls'][0]['model'], 'gpt-6-luna')
        self.assertEqual(r['calls'][0]['reasoning'], 'low')
        self.assertEqual(r['calls'][0]['usage']['uncached_input_tokens'], 8)
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')
        run = next(self.storage.glob('*exec-*/report.json')).parent
        o.review_run(run)
        self.assertEqual(len(r['manual_checks']), 2)

    def test_no_approval_no_workers_or_workspace(self):
        for tty, response in ((False, 'EXECUTE'), (True, 'no')):
            with patch.object(o.sys.stdin, 'isatty', return_value=tty), patch('builtins.input', return_value=response):
                self.assertEqual(self.run_plan(), 1)
        self.assertEqual(self.calls, [])
        self.assertFalse(list(self.storage.glob('*exec-*')))

    def test_dry_run_needs_no_confirmation(self):
        with patch('builtins.input', side_effect=AssertionError('confirmation')):
            self.assertEqual(self.run_plan('--dry-run'), 0)
        self.assertFalse(self.calls)

    def test_stale_and_tampered_plans_stop(self):
        (self.root / 'src/App.tsx').write_text('new')
        self.assertEqual(self.run_plan(), 1)
        (self.root / 'src/App.tsx').write_text('before')
        path = self.storage / self.plan_id / 'validated-plan.json'
        path.write_text(path.read_text().replace('Menü', 'Menu'))
        self.assertEqual(self.run_plan(), 1)
        self.assertFalse(self.calls)

    def test_changes_during_approval_revalidated(self):
        def approve(_):
            (self.root / 'src/App.tsx').write_text('new')
            return 'EXECUTE'
        with patch('builtins.input', side_effect=approve):
            self.assertEqual(self.run_plan(), 1)
        self.assertFalse(self.calls)

    def test_budget_overrun_stops_next_task(self):
        self.tokens = 21000
        self.assertEqual(self.run_plan(), 0)
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(self.report()['budget']['over_budget'])
        self.assertEqual(self.report()['budget']['overrun_tokens'], 1001)
        self.assertEqual(self.report()['status'], 'budget_exceeded_manual_review')
        self.assertEqual(self.report()['completed_tasks'], ['A'])
        self.assertEqual(self.report()['pending_tasks'], ['B'])
        self.assertEqual(len(self.checks), 2)
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')

    def test_unknown_usage_and_call_limit_stop_next_worker(self):
        with patch.object(o, 'usage_from_log', return_value={
                'total_tokens': 'unknown', 'input_tokens': 'unknown', 'output_tokens': 'unknown'}):
            self.assertEqual(self.run_plan(), 1)
        self.assertEqual(len(self.calls), 1)
        self.calls.clear()
        self.assertEqual(self.run_plan('--worker-calls', '1'), 1)
        self.assertEqual(len(self.calls), 1)

    def test_no_automatic_sol_escalation(self):
        self.result = 'needs_sol'
        self.assertEqual(self.run_plan(), 1)
        self.assertEqual(len(self.calls), 1)

    def test_repair_is_bounded(self):
        self.result = 'needs_repair'
        self.assertEqual(self.run_plan(), 1)
        self.assertEqual(len(self.calls), 2)

    def test_stopped_workers_failed_tests_and_unexpected_changes(self):
        for failure in ('timeout', 'exit', 'unclear', 'unexpected', 'test', 'check_mutation', 'original'):
            with self.subTest(failure=failure):
                self.failure = failure
                self.calls.clear()
                self.assertEqual(self.run_plan(), 1)
                self.assertEqual(len(self.calls), 1)

    def test_new_file_collision_and_changed_routing(self):
        self.plan_id = e.save_plan(self.storage, 'Menü', plan([task(paths=['src/New.tsx'])]), self.files, o)
        (self.root / 'src/New.tsx').write_text('untracked')
        self.assertEqual(self.run_plan(), 1)
        self.assertFalse(self.calls)
        with patch.object(p, 'decorate', return_value={}):
            self.assertEqual(self.run_plan('--dry-run'), 1)

    def test_symlinks_and_invalid_ids_are_rejected(self):
        for invalid in ('../x', '/tmp/x', 'old-run'):
            self.assertEqual(o.main(['--execute-plan', invalid]), 1)
        path = self.storage / self.plan_id / 'validated-plan.json'
        data = path.read_bytes()
        path.unlink()
        target = self.root / 'fake.json'
        target.write_bytes(data)
        path.symlink_to(target)
        self.assertEqual(self.run_plan(), 1)
        self.assertFalse(self.calls)

    def test_risk_in_read_paths_cannot_downgrade_model(self):
        value = plan([task(read_paths=['src/Other.tsx'], acceptance=['Recovery bleibt gültig'])])
        self.plan_id = e.save_plan(self.storage, 'Menü', value, self.files, o)
        _, proposed = e.load_plan(self.plan_id, o)
        self.assertEqual(proposed['tasks'][0]['model'], o.SOL[0])

    def test_future_task_file_is_not_current_write_permission(self):
        self.plan_id = e.save_plan(self.storage, 'Menü', plan([
            task('A'), task('B', depends_on=['A'], paths=['src/Other.tsx'])]), self.files, o)
        self.failure = 'unexpected'
        self.assertEqual(self.run_plan(), 1)
        self.assertEqual(len(self.calls), 1)

    def test_persisted_model_proposal_is_not_authoritative(self):
        path = self.storage / self.plan_id / 'validated-plan.json'
        payload = json.loads(path.read_text())
        payload['proposed']['tasks'][0]['model'] = 'gpt-6-astra'
        raw = e.encoded(payload)
        self.plan_id = 'validated-' + e.hashlib.sha256(raw).hexdigest()
        target = self.storage / self.plan_id
        target.mkdir()
        (target / 'validated-plan.json').write_bytes(raw)
        self.assertEqual(self.run_plan(), 1)
        self.assertFalse(self.calls)

    def test_architecture_and_unclear_plans_are_not_executable(self):
        for flag in ('unclear', 'architecture'):
            self.plan_id = e.save_plan(self.storage, 'Menü', plan(flags=[flag]), self.files, o)
            self.assertEqual(self.run_plan(), 1)
        self.assertFalse(self.calls)


if __name__ == '__main__':
    unittest.main()
