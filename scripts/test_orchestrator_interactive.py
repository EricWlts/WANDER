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
from test_orchestrator_coordination import wander_translation_fixture, WANDER_REQUEST


class InteractiveTests(unittest.TestCase):
    # Reuse only the local fake filesystem/process fixture, not its test cases.
    setUp = fixtures.ExecutionTests.setUp
    enter_context = fixtures.ExecutionTests.enter_context
    git = fixtures.ExecutionTests.git

    def process(self, command, cwd, timeout, log, prompt=None):
        if command[0] == 'codex' and not prompt.startswith('Eine Aufgabe'):
            self.analysis = getattr(self, 'analysis', []) + [prompt]
            answer = Path(command[command.index('--output-last-message') + 1])
            answer.write_text(json.dumps(getattr(self, 'analysis_plan', plan())))
            log.write_text(json.dumps({'type': 'turn.completed', 'usage': {
                'input_tokens': 3, 'output_tokens': 1, 'total_tokens': 4}}))
            return 0
        if command[0] == 'codex':
            self.worker_prompts = getattr(self, 'worker_prompts', []) + [prompt]
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
            if command[0] == 'codex' and prompt.startswith('Eine Aufgabe'):
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
            if command[0] == 'codex' and prompt.startswith('Eine Aufgabe'):
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

    def text_removal_fixture(self, translated=False):
        request = ('Entferne auf der Startseite den folgenden Text vollständig: '
                   'Die Orte, an die wir reisen. Und die Gefühle, die sie in uns wecken. '
                   'Erhalte das übrige Layout und alle anderen Texte.')
        fragment = 'Die Orte, an die wir reisen.\n    Und die Gefühle,\t die sie in uns wecken.'
        source = '<section><p>' + fragment + '</p><h2>Weitere Reisen</h2></section>'
        if translated:
            self.names.extend(wander_translation_fixture(self.root))
            source = (self.root / 'src/Public.tsx').read_text()
            start = source.rfind('<p>', 0, source.index('Not just the places we go.'))
            fragment = source[start:source.index('</p>', start) + len('</p>')]
            request = WANDER_REQUEST
        (self.root / 'src/Public.tsx').write_text(source)
        if not translated:
            self.names.append('src/Public.tsx')
        original = self.process

        def process(command, cwd, timeout, log, prompt=None):
            code = original(command, cwd, timeout, log, prompt)
            if command[0] == 'codex' and prompt.startswith('Eine Aufgabe'):
                self.assertEqual(cwd, s.workspace)
                self.assertIn('src/Public.tsx', prompt)
                self.assertEqual(s.allowed, {'src/Public.tsx'})
                self.assertIn('gpt-6-luna', command)
                (cwd / 'src/App.tsx').write_text('before')
                (cwd / 'src/Public.tsx').write_text(source.replace(fragment, ''))
            return code
        s = self.session()
        return s, request, source, process

    def test_real_translated_copy_skips_planner_and_preserves_safe_execution_flow(self):
        s, request, source, process = self.text_removal_fixture(translated=True)
        catalog = (self.root / 'src/translations.json').read_text()
        with patch.object(o, 'run_process', side_effect=process), \
                patch.object(s, 'start_preview') as preview, \
                patch.object(p, 'call_phase', side_effect=AssertionError('unexpected planner')):
            self.develop(s, request, answer='no')
            self.assertFalse(self.calls)
            self.assertFalse(s.allowed)
            s.develop(request, lambda _: 'EXECUTE')
        self.assertEqual(len(self.calls), 1)
        self.assertEqual((s.calls[0]['model'], s.calls[0]['reasoning']), ('gpt-6-luna', 'low'))
        self.assertEqual(s.allowed, {'src/Public.tsx'})
        self.assertEqual([c['command'] for c in s.checks],
                         [['npm', 'run', 'test:frontend'], ['npm', 'run', 'build']])
        preview.assert_called_once()
        self.assertEqual((self.root / 'src/Public.tsx').read_text(), source)
        self.assertNotIn('Not just the places we go.', (s.workspace / 'src/Public.tsx').read_text())
        self.assertEqual((s.workspace / 'src/translations.json').read_text(), catalog)
        self.assertEqual(s.calls[0]['context']['read_scope'], ['src/Public.tsx'])
        self.assertTrue(s.calls[0]['context']['localized'])
        self.assertLess(s.calls[0]['context']['prompt_chars'], 14000)
        prompt = self.worker_prompts[0]
        self.assertIn('Not just the places we go.', prompt)
        self.assertIn('But the way they make us feel.', prompt)
        self.assertIn('Die Orte, an die wir reisen.', prompt)
        self.assertIn('Und die Gefühle, die sie in uns wecken.', prompt)
        self.assertNotIn(catalog, prompt)
        self.assertIn('--ignore-rules', self.calls[0])
        self.assertLess(s.task_budget.tokens, s.task_budget.max_tokens)
        with self.assertRaises(o.Stop):
            s.apply(lambda _: 'yes')
        self.assertEqual((self.root / 'src/Public.tsx').read_text(), source)
        s.apply(lambda _: 'APPLY')
        self.assertNotIn('Not just the places we go.', (self.root / 'src/Public.tsx').read_text())
        self.assertEqual((self.root / 'src/translations.json').read_text(), catalog)

    def test_actual_text_removal_reaches_worker_checks_preview_and_safe_apply(self):
        s, request, source, process = self.text_removal_fixture()
        approvals = []
        def approve(prompt):
            self.assertFalse(self.calls)
            approvals.append(prompt)
            return 'EXECUTE'
        with patch.object(o, 'run_process', side_effect=process), \
                patch.object(s, 'start_preview') as preview, \
                patch.object(p, 'call_phase', side_effect=AssertionError('unexpected planner')):
            s.develop(request, approve)
        self.assertEqual(len(approvals), 1)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(s.calls[0]['reasoning'], 'low')
        self.assertEqual(s.allowed, {'src/Public.tsx'})
        self.assertEqual([c['command'] for c in s.checks],
                         [['npm', 'run', 'test:frontend'], ['npm', 'run', 'build']])
        preview.assert_called_once()
        self.assertEqual((self.root / 'src/Public.tsx').read_text(), source)
        self.assertEqual((s.workspace / 'src/Public.tsx').read_text(),
                         '<section><p></p><h2>Weitere Reisen</h2></section>')
        with self.assertRaises(o.Stop):
            s.apply(lambda _: 'yes')
        self.assertEqual((self.root / 'src/Public.tsx').read_text(), source)
        s.apply(lambda _: 'APPLY')
        self.assertNotIn('Die Orte', (self.root / 'src/Public.tsx').read_text())

    def test_actual_text_removal_denial_starts_no_worker_or_planner(self):
        s, request, source, process = self.text_removal_fixture()
        with patch.object(p, 'call_phase', side_effect=AssertionError('unexpected planner')):
            self.develop(s, request, answer='no')
        self.assertFalse(self.calls)
        self.assertFalse(s.allowed)
        self.assertEqual((s.workspace / 'src/Public.tsx').read_text(), source)

    def test_local_worker_context_excludes_full_tasks_and_keeps_nested_rules(self):
        (self.root / 'TASKS.md').write_text('UNRELATED_TASK_MARKER\n' * 10000)
        (self.root / 'src/AGENTS.md').write_text('Nested rule: preserve the compass.')
        self.names.append('src/AGENTS.md')
        s, request, source, process = self.text_removal_fixture(translated=True)
        with patch.object(o, 'run_process', side_effect=process):
            self.develop(s, request)
        prompt = self.worker_prompts[0]
        self.assertNotIn('UNRELATED_TASK_MARKER', prompt)
        self.assertEqual(prompt.count('Nested rule: preserve the compass.'), 1)
        self.assertNotIn((self.root / 'src/I18n.tsx').read_text(), prompt)
        self.assertLess(len(prompt), 14000)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(s.calls[0]['context']['read_scope'], ['src/Public.tsx'])

    def test_completed_worker_overrun_keeps_locally_checked_manual_review_only(self):
        s = self.session()
        self.tokens = 66291
        self.develop(s, 'Entferne Text in src/App.tsx')
        self.assertFalse(s.blocked)
        self.assertTrue(s.ready)
        self.assertTrue(s.budget_exceeded)
        self.assertEqual(len(self.checks), 2)
        self.assertEqual(s.task_budget.tokens, 66292)
        self.assertEqual(s.tokens.tokens, 66292)
        report = json.loads(s.report_bytes)
        self.assertEqual(report['status'], 'budget_exceeded_manual_review')
        self.assertTrue(report['budget_scopes']['task']['over_budget'])
        self.assertFalse(report['budget_scopes']['session']['over_budget'])
        self.assertEqual(report['calls'][0]['result']['status'], 'complete')
        self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')
        with self.assertRaises(o.Stop):
            self.develop(s, 'Entferne anderen Text in src/App.tsx')
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(hasattr(self, 'analysis'))
        self.assertIn('budgetüberschritten, manuell prüfbar', self.out.getvalue())
        with self.assertRaises(o.Stop):
            s.apply(lambda _: 'yes')
        s.verify()
        s.apply(lambda _: 'APPLY')
        self.assertIn('change', (self.root / 'src/App.tsx').read_text())

    def test_overrun_unapproved_file_is_locked_without_checks_or_review(self):
        s = self.session()
        self.tokens, self.failure = 21000, 'unexpected'
        with self.assertRaisesRegex(o.Stop, 'Integritätsfehler'):
            self.develop(s, 'Entferne Text in src/App.tsx')
        self.assertTrue(s.blocked)
        self.assertFalse(s.ready)
        self.assertFalse(self.checks)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual((self.root / 'src/Other.tsx').read_text(), 'other')
        with self.assertRaises(o.Stop):
            o.review_run(s.run, apply=True, input_fn=lambda _: 'APPLY')
        s.discard()
        self.assertFalse(s.workspace.exists())

    def test_overrun_without_complete_never_tests_repairs_or_escalates(self):
        for status in ('blocked', 'needs_repair', 'needs_sol'):
            with self.subTest(status=status):
                s = self.session()
                self.tokens, self.result = 21000, status
                before = len(self.calls)
                with self.assertRaisesRegex(o.Stop, 'wiederhergestellt'):
                    self.develop(s, 'Entferne Text in src/App.tsx')
                self.assertFalse(s.ready)
                self.assertFalse(s.blocked)
                self.assertFalse(self.checks)
                self.assertEqual(len(self.calls), before + 1)
                self.assertFalse(hasattr(self, 'analysis'))
                self.assertEqual((s.workspace / 'src/App.tsx').read_text(), 'before')
                with self.assertRaises(o.Stop):
                    self.develop(s, 'Anderer Wunsch')

    def test_overrun_failed_local_checks_restore_without_model_retry(self):
        s = self.session()
        self.tokens, self.failure = 21000, 'test'
        with self.assertRaisesRegex(o.Stop, 'wiederhergestellt'):
            self.develop(s, 'Entferne Text in src/App.tsx')
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(s.ready)
        self.assertEqual((s.workspace / 'src/App.tsx').read_text(), 'before')

    def test_overrun_exit_invalid_answer_and_no_change_do_not_become_success(self):
        original = self.process
        for failure in ('exit', 'answer', 'unchanged'):
            with self.subTest(failure=failure):
                s = self.session()
                self.tokens = 21000
                def process(command, cwd, timeout, log, prompt=None):
                    code = original(command, cwd, timeout, log, prompt)
                    if command[0] == 'codex':
                        if failure == 'exit':
                            return 1
                        if failure == 'answer':
                            Path(command[command.index('--output-last-message') + 1]).write_text('null')
                        if failure == 'unchanged':
                            (cwd / 'src/App.tsx').write_text('before')
                    return code
                with patch.object(o, 'run_process', side_effect=process), self.assertRaises(o.Stop):
                    self.develop(s, 'Entferne Text in src/App.tsx')
                self.assertFalse(s.ready)
                self.assertFalse(self.checks)
                self.assertEqual((self.root / 'src/App.tsx').read_text(), 'before')

    def test_overrun_review_preserves_hash_report_and_sandbox_controls(self):
        for location in ('workspace', 'check-workspace', 'report', 'original'):
            with self.subTest(location=location):
                s = self.session()
                self.tokens = 21000
                self.develop(s, 'Entferne Text in src/App.tsx')
                command = self.calls[-1]
                for flag in ('--ephemeral', '--ignore-user-config', 'workspace-write',
                             'features.multi_agent=false', 'sandbox_workspace_write.network_access=false',
                             'sandbox_workspace_write.exclude_slash_tmp=true'):
                    self.assertIn(flag, command)
                if location == 'report':
                    (s.run / 'report.json').write_text('{}')
                elif location == 'original':
                    (self.root / 'src/Other.tsx').write_text('external')
                else:
                    (s.run / location / 'src/App.tsx').write_text('tampered')
                with self.assertRaises(o.Stop):
                    s.apply(lambda _: 'APPLY')
                (self.root / 'src/Other.tsx').write_text('other')

    def test_completed_worker_can_exceed_session_limit_and_still_get_local_review(self):
        s = self.session(session_tokens=5)
        self.develop(s, 'Entferne Text in src/App.tsx')
        report = json.loads(s.report_bytes)
        self.assertTrue(report['budget_scopes']['session']['over_budget'])
        self.assertFalse(report['budget_scopes']['task']['over_budget'])
        self.assertTrue(s.ready)
        self.assertEqual(len(self.checks), 2)
        budgets = s.tokens, s.workers
        s.discard()
        replacement = i.Session(s.args, o, self.storage, budgets)
        with self.assertRaises(o.Stop):
            self.develop(replacement, 'Entferne Text in src/App.tsx')
        self.assertEqual(len(self.calls), 1)

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
        with patch.object(o, 'usage_from_log', return_value={
                'total_tokens': 21085, 'input_tokens': 20000, 'output_tokens': 1085}):
            with self.assertRaises(o.Stop):
                self.develop(s)
        self.assertFalse(s.blocked)
        self.assertEqual(s.tokens.tokens, 21085)
        self.assertEqual(len(self.analysis), 1)
        self.assertFalse(self.calls)
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
                elif prompt.startswith('Eine Aufgabe'):
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
            if command[0] == 'codex' and prompt.startswith('Eine Aufgabe'):
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
