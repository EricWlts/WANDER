"""Pure policy regressions; no CLI, model, network, or application mutations."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import orchestrator as o
import orchestrator_coordination as c
import orchestrator_planning as p


class CoordinationTests(unittest.TestCase):
    def test_budget_admission_is_atomic_across_scopes(self):
        first, last = p.Budget(3, 100, o.Stop), p.Budget(1, 100, o.Stop)
        last.admit()
        with self.assertRaises(o.Stop):
            c.Budgets(first, last).admit()
        self.assertEqual(first.calls, 0)

    def test_direct_plan_risks_and_ambiguity_keep_planning(self):
        dossier = {'snippets': {'src/App.tsx': 'Text', 'src/Other.tsx': 'Text'}}
        for request in ('Entferne "Text"', 'Entferne Recovery in src/App.tsx',
                        'Hover in src/App.tsx und src/Other.tsx', 'Entferne src/missing.tsx'):
            self.assertIsNone(c.direct_plan(request, dossier, o))
        result = c.direct_plan('Entferne "Text"', {'snippets': {'src/App.tsx': 'Text'}}, o)
        self.assertEqual(result['tasks'][0]['paths'], ['src/App.tsx'])

    def test_large_coupled_and_ordinary_refinement_do_not_trigger_astra(self):
        self.assertFalse(c.escalation('Etwas sanfter', ['large', 'coupled'], failures=1, negative=1))
        for args in ({'flags': ['unclear']}, {'flags': ['architecture']},
                     {'failures': 2}, {'negative': 2}):
            self.assertTrue(c.escalation('Aufgabe', **args))
        self.assertFalse(c.negative_feedback('Etwas langsamer'))
        self.assertTrue(c.negative_feedback('Gefällt mir nicht'))

    def test_memory_requires_explicit_confirmation_and_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            entry = {'category': 'preference', 'statement': 'Weniger Schatten',
                     'evidence': 'Explizite Nutzereingabe', 'confirmed_by': 'user'}
            def write(value):
                (root / c.MEMORY).write_text(json.dumps(value))
            write({'version': 1, 'entries': [entry]})
            self.assertEqual(c.memory(root, {c.MEMORY: 'hash'}, o.Stop)['entries'], [entry])
            for change in ({'confirmed_by': 'ai'}, {'evidence': ''}, {'category': 'guess'}):
                write({'version': 1, 'entries': [{**entry, **change}]})
                with self.assertRaises(o.Stop):
                    c.memory(root, {c.MEMORY: 'hash'}, o.Stop)
            write({'version': 1, 'entries': [entry] * 25})
            with self.assertRaises(o.Stop):
                c.memory(root, {c.MEMORY: 'hash'}, o.Stop)

    def test_context_reuses_source_reads_and_invalidates_changed_hash(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in o.RULES:
                (root / name).write_text('rules')
            (root / 'src').mkdir()
            source = root / 'src/App.tsx'
            source.write_text('hover first')
            files, cache = {'src/App.tsx': 'one'}, {}
            rt = SimpleNamespace(ROOT=root, RULES=o.RULES, Stop=o.Stop)
            original = Path.read_text
            reads = []
            def read(path, *a, **kw):
                if path == source:
                    reads.append(path)
                return original(path, *a, **kw)
            with patch.object(Path, 'read_text', read):
                p.analysis_context('hover', files, rt, cache)
                p.analysis_context('hover langsamer', files, rt, cache)
                self.assertEqual(len(reads), 1)
                source.write_text('hover changed')
                files['src/App.tsx'] = 'two'
                dossier = p.analysis_context('hover', files, rt, cache)
                self.assertEqual(len(reads), 2)
                self.assertIn('changed', dossier['snippets']['src/App.tsx'])


if __name__ == '__main__':
    unittest.main()
