"""Pure policy regressions; no CLI, model, network, or application mutations."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import orchestrator as o
import orchestrator_coordination as c
import orchestrator_planning as p


WANDER_ROOT = Path(__file__).resolve().parents[1]
WANDER_TEXT = 'Die Orte, an die wir reisen. Und die Gefühle, die sie in uns wecken.'
WANDER_REQUEST = 'Entferne auf der Startseite den Text „' + WANDER_TEXT + '“.'


def wander_translation_fixture(root):
    """Copy real application sources into an isolated offline test workspace."""
    files = {}
    for name in ('src/Public.tsx', 'src/translations.json', 'src/I18n.tsx'):
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text((WANDER_ROOT / name).read_text())
        files[name] = hashlib.sha256(target.read_bytes()).hexdigest()
    return files


class CoordinationTests(unittest.TestCase):
    def test_real_wander_translations_resolve_combined_and_single_visible_copy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = wander_translation_fixture(root)
            for literal in (WANDER_TEXT, 'Die Orte, an die wir reisen.',
                            'Und die Gefühle, die sie in uns wecken.'):
                with self.subTest(literal=literal):
                    result = c.direct_plan('Entferne „' + literal + '“', {}, o,
                                           root=root, files=files)
                    self.assertEqual(result['tasks'][0]['paths'], ['src/Public.tsx'])
                    self.assertEqual(result['tasks'][0]['read_paths'], [])
                    task = p.decorate(p.validate_plan(result, files, o), literal, o)['tasks'][0]
                    self.assertEqual((task['model'], task['reasoning']), ('gpt-6-luna', 'low'))

    def test_translation_ambiguity_in_same_or_other_component_never_selects_file(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = wander_translation_fixture(root)
            source = (root / 'src/Public.tsx').read_text()
            for name in ('src/Other.tsx', 'src/Public.tsx'):
                with self.subTest(name=name):
                    (root / name).write_text(source if name.endswith('Other.tsx') else source + source)
                    inventory = {**files, name: 'changed'}
                    self.assertIsNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=inventory))
                    (root / name).write_text(source)

    def test_catalog_alone_invalid_catalog_and_separate_jsx_runs_keep_planning(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = wander_translation_fixture(root)
            prefix = 'import { tr } from "./I18n";\n'
            first = '{tr("Not just the places we go.")}'
            second = '{tr("But the way they make us feel.")}'
            for source in ('export const unrelated = 1;',
                           prefix + '<><p>' + first + '</p><p>' + second + '</p></>',
                           prefix + '<p>' + first + '{dynamic}' + second + '</p>',
                           '<p>' + first + '<br />' + second + '</p>'):
                (root / 'src/Public.tsx').write_text(source)
                self.assertIsNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=files))
            (root / 'src/Public.tsx').write_text((WANDER_ROOT / 'src/Public.tsx').read_text())
            for catalog in ('{', '[]'):
                (root / 'src/translations.json').write_text(catalog)
                self.assertIsNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=files))

    def test_raw_and_translated_occurrences_are_both_counted(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = wander_translation_fixture(root)
            source = root / 'src/Public.tsx'
            source.write_text(source.read_text() + '\nconst copy = "' + WANDER_TEXT + '";')
            self.assertIsNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=files))

    def test_translation_cache_tracks_catalog_and_component_hashes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            files = wander_translation_fixture(root)
            cache = {}
            self.assertIsNotNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=files, cache=cache))
            catalog = root / 'src/translations.json'
            catalog.write_text('{}')
            files['src/translations.json'] = 'new-catalog'
            self.assertIsNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=files, cache=cache))
            catalog.write_text(json.dumps({'key': WANDER_TEXT}))
            files['src/translations.json'] = 'another-catalog'
            source = root / 'src/Public.tsx'
            source.write_text("import { t } from './I18n';\nconst view = <p>{t('key')}</p>;")
            files['src/Public.tsx'] = 'new-source'
            self.assertIsNotNone(c.direct_plan(WANDER_REQUEST, {}, o, root=root, files=files, cache=cache))

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

    def test_full_source_search_handles_long_multiline_literal_and_ambiguity(self):
        literal = 'Die Orte, an die wir reisen. Und die Gefühle, die sie in uns wecken.'
        request = 'Entferne den folgenden Text vollständig: ' + literal + ' Erhalte das Layout.'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'src').mkdir()
            path = root / 'src/Public.tsx'
            path.write_text('unrelated\n' * 1500 + literal.replace('. Und', '.<br />\n Und'))
            files = {'src/Public.tsx': 'one'}
            result = c.direct_plan(request, {}, o, root=root, files=files, cache={})
            self.assertEqual(result['tasks'][0]['paths'], ['src/Public.tsx'])
            for text in (literal + '\n' + literal, 'missing'):
                path.write_text(text)
                self.assertIsNone(c.direct_plan(request, {}, o, root=root, files=files, cache={}))
            path.write_text(literal)
            (root / 'src/Other.json').write_text(json.dumps(literal, ensure_ascii=False))
            files['src/Other.json'] = 'two'
            self.assertIsNone(c.direct_plan(request, {}, o, root=root, files=files, cache={}))

    def test_text_literal_preserves_sentences_and_replacement_quotes_stay_ambiguous(self):
        self.assertEqual(c.text_literal('Entferne „Mehrzeiliger\n Text.“'), 'Mehrzeiliger\n Text.')
        self.assertIsNone(c.text_literal('Ersetze "alter Text" durch "neuen Text"'))

    def test_incomplete_source_scan_never_claims_uniqueness(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'src').mkdir()
            (root / 'src/App.tsx').write_text('Unique text')
            (root / 'src/Large.tsx').write_text(' ' * 2000001)
            self.assertIsNone(c.direct_plan('Entferne "Unique text"', {}, o, root=root,
                                           files={'src/App.tsx': 'a', 'src/Large.tsx': 'b'}))

    def test_feedback_context_has_fixed_round_attempt_and_text_bounds(self):
        history = [{'request': 'r' * 12000, 'error': 'e' * 5000,
                    'attempts': [{'result': {'status': 'blocked', 'summary': 's' * 10000}}] * 16}] * 40
        context = c.feedback_context(history)
        self.assertEqual(len(context), 2)
        self.assertEqual(len(context[0]['attempts']), 2)
        self.assertEqual(len(context[0]['request']), 500)
        self.assertEqual(len(context[0]['attempts'][0]['result']['summary']), 400)
        self.assertLess(len(json.dumps(context)), 4500)

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
