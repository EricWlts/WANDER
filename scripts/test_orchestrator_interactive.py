"""Interactive workflow tests: model processes and Vite are mocked."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import orchestrator as o
import orchestrator_execution as e
import orchestrator_interactive as i
import orchestrator_planning as p
import test_orchestrator_execution as fixtures
from test_orchestrator_planning import plan, task


class InteractiveTests(unittest.TestCase):
    # Reuse only the local fake filesystem/process fixture, not its test cases.
    setUp = fixtures.ExecutionTests.setUp
    enter_context = fixtures.ExecutionTests.enter_context
    git = fixtures.ExecutionTests.git

    def process(self, command, cwd, timeout, log, prompt=None):
        if command[0] == 'codex' and '--ignore-rules' in command:
            self.analysis = getattr(self, 'analysis', []) + [prompt]
            answer = Path(command[command.index('--output-last-message') + 1])
            answer.write_text(json.dumps(getattr(self, 'analysis_plan', plan())))
            log.write_text(json.dumps({'type': 'turn.completed', 'usage': {
                'input_tokens': 3, 'output_tokens': 1, 'total_tokens': 4}}))
            return 0
        return fixtures.ExecutionTests.process(self, command, cwd, timeout, log, prompt)

    def session(self, **kwargs):
        args = SimpleNamespace(timeout=10, worker_calls=8, max_calls=2, max_tokens=20000, **kwargs)
        return i.Session(args, o, self.storage)

    def develop(self, session, text='Menü schließen', answer='EXECUTE'):
        with patch.object(i.Session, 'start_preview'):
            session.develop(text, lambda _: answer)

    def test_feedback_reuses_draft_and_approval_and_aggregates_usage(self):
        s = self.session()
        self.develop(s)
        self.assertTrue(s.ready)
        first = (s.workspace / 'src/App.tsx').read_text()
        with patch.object(i.Session, 'start_preview'):
            s.develop('Noch sanfter', lambda _: self.fail('duplicate approval'))
        self.assertTrue((s.workspace / 'src/App.tsx').read_text().startswith(first))
        self.assertEqual(len(self.analysis), 2)
        self.assertIn('Noch sanfter', self.analysis[1])
        self.assertIn('recent_feedback', self.analysis[1])
        self.assertEqual(s.tokens.calls, 4)
        self.assertEqual(s.tokens.tokens, 30)
        self.assertEqual(len(s.calls), 4)
        self.assertEqual(len(s.checks), 4)
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')
        s.verify()

    def test_new_paths_need_approval_and_denial_preserves_draft(self):
        s = self.session()
        self.develop(s)
        before = dict(s.expected)
        self.analysis_plan = plan([task(paths=['src/Other.tsx'])])
        self.develop(s, 'Andere Datei', answer='no')
        self.assertEqual(s.expected, before)
        self.assertEqual(len(self.calls), 1)
        self.assertNotIn('src/Other.tsx', s.allowed)
        s.verify()

    def test_new_file_then_feedback_and_deletion(self):
        s = self.session()
        self.analysis_plan = plan([task(paths=['src/New.tsx'])])
        original = self.process

        def process(command, cwd, timeout, log, prompt=None):
            if command[0] == 'codex' and '--ignore-rules' not in command:
                # Keep the fake contract target aligned with the new-file plan.
                code = original(command, cwd, timeout, log, prompt)
                (cwd / 'src/App.tsx').write_text('before')
                (cwd / 'src/New.tsx').write_text('new')
                return code
            return original(command, cwd, timeout, log, prompt)
        with patch.object(o, 'run_process', side_effect=process):
            self.develop(s)
        self.assertIn('src/New.tsx', s.expected)
        self.analysis_plan = plan([task(paths=['src/New.tsx'])])

        def remove(command, cwd, timeout, log, prompt=None):
            code = original(command, cwd, timeout, log, prompt)
            if command[0] == 'codex' and '--ignore-rules' not in command:
                (cwd / 'src/App.tsx').write_text('before')
                (cwd / 'src/New.tsx').unlink()
            return code
        with patch.object(o, 'run_process', side_effect=remove):
            self.develop(s, 'Neue Datei wieder entfernen')
        self.assertNotIn('src/New.tsx', s.expected)
        s.verify()

    def test_tampered_draft_checkcopy_report_and_original_stop(self):
        for location in ('workspace', 'check-workspace', 'report', 'original'):
            with self.subTest(location=location):
                s = self.session()
                self.develop(s)
                if location == 'report':
                    (s.run / 'report.json').write_text('{}')
                elif location == 'original':
                    (self.root / 'src/Other.tsx').write_text('external')
                else:
                    (s.run / location / 'src/App.tsx').write_text('tampered')
                with self.assertRaises(o.Stop):
                    s.apply(lambda _: 'APPLY')
                (self.root / 'src/Other.tsx').write_text('other')

    def test_apply_revalidates_after_confirmation(self):
        s = self.session()
        self.develop(s)

        def confirm(_):
            (self.root / 'src/Other.tsx').write_text('external')
            return 'APPLY'
        with self.assertRaises(o.Stop):
            s.apply(confirm)
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')

    def test_manual_review_rejects_changed_content_in_same_result_file(self):
        s = self.session()
        self.develop(s)
        (s.workspace / 'src/App.tsx').write_text('different unreviewed content')
        with self.assertRaisesRegex(o.Stop, 'nach der Prüfung verändert'):
            o.review_run(s.run, apply=True, input_fn=lambda _: 'APPLY')

    def test_result_changed_during_apply_confirmation_is_rejected(self):
        s = self.session()
        self.develop(s)

        def confirm(_):
            (s.workspace / 'src/App.tsx').write_text('late mutation')
            return 'APPLY'
        with self.assertRaises(o.Stop):
            o.review_run(s.run, apply=True, input_fn=confirm)
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')

    def test_workspace_symlink_is_rejected(self):
        s = self.session()
        self.develop(s)
        target = s.run / 'moved-workspace'
        s.workspace.rename(target)
        s.workspace.symlink_to(target, target_is_directory=True)
        with self.assertRaisesRegex(o.Stop, 'Symlink'):
            s.verify()
        with self.assertRaises(o.Stop):
            s.discard()
        self.assertTrue(target.is_dir())

    def test_apply_requires_second_exact_confirmation(self):
        s = self.session()
        self.develop(s)
        with self.assertRaises(o.Stop):
            s.apply(lambda _: 'yes')
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')
        s.apply(lambda _: 'APPLY')
        self.assertIn('change', (self.root / 'src/App.tsx').read_text())

    def test_discard_removes_copies_invalidates_report_and_keeps_original(self):
        s = self.session()
        self.develop(s)
        s.discard()
        self.assertFalse(s.workspace.exists())
        self.assertFalse((s.run / 'check-workspace').exists())
        with self.assertRaises(o.Stop):
            o.review_run(s.run, apply=True, input_fn=lambda _: 'APPLY')
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')

    def test_unclear_and_architecture_stop_without_workers(self):
        s = self.session()
        self.analysis_plan = plan(flags=['unclear'])
        with self.assertRaises(o.Stop):
            self.develop(s)
        self.assertEqual(len(self.analysis), 3)  # Luna, one followup, Astra; no workers.
        self.assertEqual(self.calls, [])
        self.analysis_plan = plan(flags=['architecture'])
        with self.assertRaises(o.Stop):
            self.develop(s, 'Mehrbenutzerbetrieb')
        self.assertEqual(self.calls, [])
        self.assertEqual(s.tokens.calls, 4)

    def test_failed_checks_restore_draft_and_allow_next_request(self):
        s = self.session()
        self.failure = 'test'
        with self.assertRaisesRegex(o.Stop, 'wiederhergestellt'):
            self.develop(s)
        self.assertFalse(s.blocked)
        self.assertEqual((s.workspace / 'src/App.tsx').read_text(), 'before')
        self.assertEqual(len(self.calls), 1)
        with self.assertRaises(o.Stop):
            s.apply(lambda _: 'APPLY')
        self.failure = None
        self.develop(s, 'Neuer Wunsch')
        self.assertTrue(s.ready)
        s.verify()

    def test_unknown_usage_prevents_next_model_call(self):
        s = self.session()
        with patch.object(o, 'usage_from_log', return_value={
                'total_tokens': 'unknown', 'input_tokens': 'unknown', 'output_tokens': 'unknown'}):
            with self.assertRaises(o.Stop):
                self.develop(s)
        self.assertEqual(len(self.analysis), 1)
        self.assertEqual(self.calls, [])

    def test_unapproved_file_and_worker_repair_limit(self):
        s = self.session()
        self.failure = 'unexpected'
        with self.assertRaises(o.Stop):
            self.develop(s)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual((self.root / 'src/Other.tsx').read_text(), 'other')
        s.discard()
        s = self.session()
        self.failure = None
        self.result = 'needs_repair'
        self.calls.clear()
        with self.assertRaises(o.Stop):
            self.develop(s)
        self.assertEqual(len(self.calls), 4)  # Two attempts, one Astra delegation, two final attempts.
        self.assertFalse(s.blocked)
        self.assertEqual(len([c for c in s.calls if c.get("phase") == "astra"]), 1)

    def test_session_budget_not_reset_by_feedback_or_discard(self):
        s = self.session()
        s.tokens.max_calls = 2
        self.develop(s)
        with self.assertRaises(o.Stop):
            self.develop(s, 'Weiter')
        self.assertEqual(len(self.calls), 1)
        budgets = s.tokens, s.workers
        s.discard()
        replacement = i.Session(s.args, o, self.storage, budgets)
        with self.assertRaises(o.Stop):
            self.develop(replacement)
        self.assertEqual(len(self.calls), 1)

    def test_terminal_commands_and_no_implicit_apply(self):
        s = self.session()
        inputs = iter(['HELP', 'STATUS', 'ein Wunsch', 'STATUS', 'DIFF', 'EXIT'])
        with patch.object(i, 'Session', return_value=s), patch.object(s, 'develop') as develop, \
                patch.object(s, 'stop_preview') as stop, patch.object(o, 'review_run') as review:
            self.assertEqual(i.interactive(s.args, o, lambda _: next(inputs)), 0)
        develop.assert_called_once()
        review.assert_called_once_with(s.run)
        stop.assert_called_once()

    def test_preview_uses_separate_port_strict_binding_and_no_project_config(self):
        s = self.session()
        self.develop(s)
        check = s.run / 'check-workspace'
        (check / 'node_modules/vite/bin').mkdir(parents=True)
        (check / 'node_modules/vite/bin/vite.js').write_text('fake')
        (check / 'dist').mkdir()
        (check / 'dist/index.html').write_text('build')
        sock = Mock()
        sock.__enter__ = Mock(return_value=sock)
        sock.__exit__ = Mock(return_value=False)
        sock.getsockname.return_value = ('127.0.0.1', 54321)
        process = Mock(pid=12345)
        process.poll.return_value = None
        response = Mock()
        response.__enter__ = Mock(return_value=SimpleNamespace(status=200))
        response.__exit__ = Mock(return_value=False)
        with patch.object(i.socket, 'socket', return_value=sock), \
                patch.object(i.subprocess, 'Popen', return_value=process) as popen, \
                patch.object(i.urllib.request, 'urlopen', return_value=response), \
                patch.object(i.os, 'killpg') as kill:
            s.start_preview()
            self.assertEqual(s.preview_url, 'http://127.0.0.1:54321/')
            command = popen.call_args.args[0]
            self.assertIn('preview', command)
            self.assertNotIn('5173', command)
            config = (s.run / 'preview.config.mjs').read_text()
            self.assertIn('"strictPort": true', config)
            self.assertNotIn('proxy', config)
            s.stop_preview()
            kill.assert_called_once_with(12345, i.signal.SIGKILL)

    def test_direct_local_request_avoids_analysis(self):
        s = self.session()
        self.develop(s, 'Entferne Text in src/App.tsx')
        self.assertFalse(hasattr(self, 'analysis'))
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(s.calls[0]['reasoning'], 'low')

    def test_followup_can_resolve_uncertainty_without_astra(self):
        s = self.session()
        answers = iter([plan(flags=['unclear']), plan()])
        with patch.object(p, 'call_phase', side_effect=lambda *a: next(answers)) as call:
            self.develop(s)
        self.assertEqual([c.args[0] for c in call.call_args_list], ['analysis', 'followup'])
        self.assertTrue(s.ready)

    def test_architecture_astra_delegates_complex_work_to_sol(self):
        s = self.session()
        self.analysis_plan = plan([task(complexity='complex')])
        self.develop(s, 'Architektur der Navigation prüfen')
        self.assertEqual(len(self.analysis), 1)
        self.assertIn('Technical Lead', self.analysis[0])
        self.assertIn(o.SOL[0], self.calls[0])
        brief = json.loads(next(s.run.glob('planning-*/report.json')).read_text())
        self.assertIn('user_goal', brief['escalation_brief'])
        self.assertTrue(brief['astra_reasons'])

    def test_second_negative_feedback_escalates_same_draft(self):
        s = self.session()
        self.develop(s)
        self.develop(s, 'Nein, der Schatten ist falsch')
        self.develop(s, 'Immer noch falsch, weniger Schatten')
        self.assertEqual(len([c for c in s.calls if c.get('phase') == 'astra']), 1)
        self.assertIn('attempts_and_feedback', self.analysis[-1])
        self.assertTrue(s.ready)

    def test_task_overrun_does_not_exhaust_session(self):
        s = self.session()
        original = o.usage_from_log
        with patch.object(o, 'usage_from_log', return_value={
                'total_tokens': 20360, 'input_tokens': 20000, 'output_tokens': 360}):
            with self.assertRaises(o.Stop):
                self.develop(s)
        self.assertFalse(s.blocked)
        self.assertEqual(s.tokens.tokens, 20360)
        self.develop(s, 'Neuer begrenzter Wunsch')
        self.assertTrue(s.ready)
        self.assertLess(s.tokens.tokens, s.tokens.max_tokens)

    def test_real_session_limit_stops_next_call_even_after_discard(self):
        s = self.session()
        s.tokens.max_tokens = 15
        self.develop(s)
        with self.assertRaises(o.Stop):
            self.develop(s, 'Nochmals')
        self.assertEqual(len(self.calls), 1)
        budgets = s.tokens, s.workers
        s.discard()
        replacement = i.Session(s.args, o, self.storage, budgets)
        with self.assertRaises(o.Stop):
            self.develop(replacement)

    def test_failed_feedback_restores_previous_reviewable_report(self):
        s = self.session()
        self.develop(s)
        before, report = dict(s.expected), s.report_bytes
        self.failure = 'test'
        with self.assertRaises(o.Stop):
            self.develop(s, 'Neue Anpassung')
        self.assertTrue(s.ready)
        self.assertEqual(s.expected, before)
        self.assertEqual((s.run / 'report.json').read_bytes(), report)
        s.verify()
        s.apply(lambda _: 'APPLY')

    def test_test_mutation_remains_integrity_failure(self):
        s = self.session()
        self.failure = 'check_mutation'
        with self.assertRaisesRegex(o.Stop, 'Integritätsfehler'):
            self.develop(s)
        self.assertTrue(s.blocked)

    def test_remember_is_local_explicit_and_apply_only(self):
        s = self.session()
        self.develop(s, 'REMEMBER preference | Weniger Schatten | Explizit vom Nutzer in dieser Eingabe bestätigt')
        self.assertFalse(self.calls)
        self.assertFalse(hasattr(self, 'analysis'))
        self.assertFalse((self.root / 'PROJECT_MEMORY.json').exists())
        data = json.loads((s.workspace / 'PROJECT_MEMORY.json').read_text())
        self.assertEqual(data['entries'][0]['confirmed_by'], 'user')
        self.assertEqual(len(s.checks), 2)
        s.apply(lambda _: 'APPLY')
        self.assertEqual(json.loads((self.root / 'PROJECT_MEMORY.json').read_text()), data)

    def test_multiline_is_one_request_and_commands_are_literal_inside(self):
        s = self.session()
        inputs = iter(['MULTILINE', 'Hover ändern', 'APPLY', 'Zweite Zeile', '/SEND', 'EXIT'])
        with patch.object(i, 'Session', return_value=s), patch.object(s, 'develop') as develop:
            i.interactive(s.args, o, lambda _: next(inputs))
        self.assertEqual(develop.call_args.args[0], 'Hover ändern\nAPPLY\nZweite Zeile')
        self.assertFalse(self.calls)

    def test_multiline_cancel_and_oversize_drain(self):
        import orchestrator_coordination as c
        inputs = iter(['text', '/CANCEL'])
        self.assertEqual(c.multiline(lambda _: next(inputs), o.Stop), '')
        inputs = iter(['x' * 12001, 'APPLY', '/SEND', 'next'])
        with self.assertRaises(o.Stop):
            c.multiline(lambda _: next(inputs), o.Stop)
        self.assertEqual(next(inputs), 'next')

    def test_blocked_worker_gets_one_astra_delegation_to_sol(self):
        s = self.session()
        original = self.process
        def process(command, cwd, timeout, log, prompt=None):
            if command[0] == 'codex':
                if '--ignore-rules' in command and 'Technical Lead' in prompt:
                    self.analysis_plan = plan([task(complexity='complex')])
                elif '--ignore-rules' not in command:
                    self.result = 'blocked' if not self.calls else 'complete'
            return original(command, cwd, timeout, log, prompt)
        with patch.object(o, 'run_process', side_effect=process):
            self.develop(s)
        self.assertEqual(len(self.calls), 2)
        self.assertIn(o.SOL[0], self.calls[-1])
        self.assertEqual(len([c for c in s.calls if c.get('phase') == 'astra']), 1)
        self.assertTrue(s.ready)

    def test_timeout_with_unexpected_previously_allowed_file_locks(self):
        s = self.session()
        s.allowed.add('src/Other.tsx')
        original = self.process
        def process(command, cwd, timeout, log, prompt=None):
            if command[0] == 'codex' and '--ignore-rules' not in command:
                (cwd / 'src/Other.tsx').write_text('unexpected during timeout')
                raise o.Stop('Timeout')
            return original(command, cwd, timeout, log, prompt)
        with patch.object(o, 'run_process', side_effect=process), self.assertRaises(o.Stop):
            self.develop(s)
        self.assertTrue(s.blocked)

    def test_failed_test_with_source_mutation_still_locks(self):
        s = self.session()
        original = self.process
        def process(command, cwd, timeout, log, prompt=None):
            if command[0] == 'npm':
                (cwd / 'src/App.tsx').write_text('modified by failing test')
                return 1
            return original(command, cwd, timeout, log, prompt)
        with patch.object(o, 'run_process', side_effect=process), self.assertRaises(o.Stop):
            self.develop(s)
        self.assertTrue(s.blocked)

    def test_single_command_in_multiline_cannot_exit_or_apply(self):
        s = self.session()
        inputs = iter(['MULTILINE', 'APPLY', '/SEND', 'EXIT'])
        with patch.object(i, 'Session', return_value=s), patch.object(s, 'develop') as develop, \
                patch.object(s, 'apply', side_effect=AssertionError('implicit apply')):
            i.interactive(s.args, o, lambda _: next(inputs))
        develop.assert_called_once()
        self.assertEqual(develop.call_args.args[0], 'APPLY')
        self.assertTrue(develop.call_args.kwargs['literal'])

    def test_models_cannot_write_confirmed_memory(self):
        s = self.session()
        self.analysis_plan = plan([task(paths=['PROJECT_MEMORY.json'])])
        with self.assertRaises(o.Stop):
            self.develop(s, 'Merke dir etwas automatisch')
        self.assertFalse(self.calls)
        self.assertFalse((s.workspace / 'PROJECT_MEMORY.json').exists())
        self.assertEqual(o.main(['Gedächtnis ändern', '--allow', 'PROJECT_MEMORY.json', '--dry-run']), 1)

    def test_cli_validation_without_workers(self):
        for flags in (['--auto'], ['--dry-run'], ['task'], ['--allow', 'src/App.tsx'],
                      ['--timeout', '0'], ['--worker-calls', '17'], ['--max-calls', '3']):
            self.assertEqual(o.main(['--interactive', *flags]), 1)
        with patch.object(o.sys.stdin, 'isatty', return_value=False):
            self.assertEqual(o.main(['--interactive']), 1)
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main()
