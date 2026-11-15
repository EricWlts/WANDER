"""Local coordination policy. No model calls and no implicit write authority."""
import ast
import json
from pathlib import Path
import re

MEMORY = 'PROJECT_MEMORY.json'
CATEGORIES = {'architecture', 'design', 'solution', 'error', 'preference'}


class Budgets:
    """Check every scope before consuming any call slot."""
    def __init__(self, *budgets):
        self.budgets = budgets

    def admit(self):
        for budget in self.budgets:
            budget.check()
        for budget in self.budgets:
            budget.admit()

    def record(self, usage):
        for budget in self.budgets:
            budget.record(usage)

    def report(self):
        return self.budgets[-1].report()

    def check_overrun(self):
        for budget in self.budgets:
            budget.check_overrun()


def memory(root, files, stop):
    if MEMORY not in files:
        return {'version': 1, 'entries': []}
    try:
        path = root / MEMORY
        if path.stat().st_size > 16000:
            raise ValueError('size')
        value = json.loads(path.read_text())
        if set(value) != {'version', 'entries'} or type(value['version']) is not int or value['version'] != 1 or type(value['entries']) is not list:
            raise ValueError('schema')
        if len(value['entries']) > 24:
            raise ValueError('entries')
        for entry in value['entries']:
            if (set(entry) != {'category', 'statement', 'evidence', 'confirmed_by'}
                    or entry['category'] not in CATEGORIES or entry['confirmed_by'] != 'user'
                    or any(type(entry[k]) is not str or not 0 < len(entry[k].strip()) <= 500
                           for k in ('statement', 'evidence'))):
                raise ValueError('unconfirmed entry')
        return value
    except (OSError, ValueError, TypeError, KeyError) as exc:
        raise stop('Projektgedächtnis ungültig; nur ausdrücklich bestätigte, belegte Einträge verwenden.') from exc


def negative_feedback(request):
    return bool(re.search(r'\b(nein|falsch|schlechter|unpassend|misslungen)\b|gefällt.*nicht|noch.*nicht|immer noch|funktioniert nicht|not working|still wrong|worse|don.t like', request, re.I))


def feedback_context(history):
    """Keep model context independent of accumulated worker reports and logs."""
    result = []
    for entry in history[-2:]:
        item = {k: entry[k][:500] for k in ('request', 'summary', 'error') if k in entry}
        item['attempts'] = [{k: attempt[k] for k in ('model', 'reasoning') if k in attempt}
                            | {'result': {k: attempt.get('result', {}).get(k, '')[:400]
                                          for k in ('status', 'summary')}}
                           for attempt in entry.get('attempts', [])[-2:]]
        result.append(item)
    return result


def escalation(request, flags=(), failures=0, negative=0):
    reasons = []
    if re.search(r'architektur|architecture|mehrbenutzer|multi.?user|cloud.?hosting|betriebsmodell|systemwechsel', request, re.I) or 'architecture' in flags:
        reasons.append('Architektur oder weitreichende Entscheidung')
    if 'unclear' in flags:
        reasons.append('Technische Unsicherheit nach begrenzter Nachanalyse')
    if failures >= 2:
        reasons.append('Mindestens zwei Fehler derselben Aufgabe')
    if negative >= 2:
        reasons.append('Mindestens zwei erfolglose Überarbeitungen nach negativem Feedback')
    return reasons


def text_literal(request):
    """Only explicit quoted text or the bounded 'folgenden Text: … Erhalte …' form."""
    quoted = re.findall(r'[„"\']([^„"“\']{3,1000})["“\']', request)
    if len(quoted) == 1:
        return quoted[0]
    match = re.search(r'folgenden\s+Text(?:\s+vollständig)?\s*:\s*(.+?)'
                      r'(?=\s+Erhalte\b|\Z)', request, re.I | re.S)
    return match[1].strip() if match and 3 <= len(match[1].strip()) <= 1000 else None


def normalize_text(text):
    # A line break element separates visible words just like source whitespace.
    return ' '.join(re.sub(r'<br\s*/?>', ' ', text, flags=re.I).split())


def translated_text_count(literal, name, source, catalog, evidence=None):
    """Resolve static WANDER t/tr calls in a contiguous JSX text run.

    Other tags and dynamic expressions remain boundaries: unrelated paragraphs,
    attributes or conditional text must not become a seemingly unique match.
    Unsupported syntax deliberately keeps the normal planning fallback.
    """
    imports = re.findall(r'import\s*\{([^}]+)\}\s*from\s*[\'\"]([^\'\"]+)[\'\"]', source)
    helpers = set()
    for bindings, module in imports:
        if module.startswith('.') and (Path(name).parent / module).as_posix() == 'src/I18n':
            helpers.update(binding.strip() for binding in bindings.split(',')
                           if binding.strip() in {'t', 'tr'})
    if not helpers:
        return 0
    string = r'''(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')'''
    call = re.compile(r'\{\s*(?:' + '|'.join(sorted(helpers)) + r')\(\s*('
                      + string + r')\s*\)\s*\}')

    def replace(match):
        try:
            token = match[1]
            key = json.loads(token) if token.startswith('"') else ast.literal_eval(token)
            value = catalog.get(key)
            # Do not interpret translation contents as JSX structure.
            return value if isinstance(value, str) and not re.search(r'[<>{}]', value) else match[0]
        except (ValueError, SyntaxError):
            return match[0]

    count, needle = 0, normalize_text(literal)
    for match in re.finditer(r'>((?:[^<>]|<br\s*/?>)*)<', source, re.I):
        run = re.sub(r'<br\s*/?>', ' ', match[1], flags=re.I)
        rendered = call.sub(replace, run)
        if re.search(r'[{}]', rendered):
            continue
        # Raw source occurrences are counted by the caller already. Add only
        # occurrences revealed by translation, including mixed literal/call text.
        revealed = max(0, normalize_text(rendered).count(needle) - normalize_text(run).count(needle))
        count += revealed
        if revealed and evidence is not None:
            keys = []
            for token in call.findall(run):
                keys.append(json.loads(token) if token.startswith('"') else ast.literal_eval(token))
            evidence.append({'offset': match.start(1), 'rendered': normalize_text(rendered),
                             'translations': {key: catalog[key] for key in keys if key in catalog}})
    return count


def worker_context(task, root, files, runtime, cache=None):
    """Bounded local evidence, including resolved keys; never send whole catalogs/logs."""
    if task['complexity'] != 'local' or len(task['paths']) != 1 or task['read_paths']:
        return None
    name = task['paths'][0]
    if name not in files:
        return None
    def read(path):
        key = (path, files[path])
        if cache is not None and key in cache:
            return cache[key]
        text = (root / path).read_text()
        if cache is not None:
            cache[key] = text
        return text

    source = read(name)
    literal = text_literal(task['goal'])
    evidence = []
    if literal:
        if Path(name).suffix == '.tsx' and 'src/translations.json' in files:
            try:
                catalog = json.loads(read('src/translations.json'))
                if not isinstance(catalog, dict):
                    raise ValueError('catalog')
            except ValueError as exc:
                raise runtime.Stop('Übersetzungskatalog ungültig; Kontext nicht zuverlässig.') from exc
            translated_text_count(literal, name, source, catalog, evidence)
        pattern = r'(?:\s|<br\s*/?>)+'.join(re.escape(word) for word in literal.split())
        evidence.extend({'offset': m.start()} for m in re.finditer(pattern, source, re.I))
    offset = evidence[0]['offset'] if evidence else 0
    line = source.count('\n', 0, offset)
    lines = source.splitlines()
    start, end = max(0, line - 8), min(len(lines), line + 12)
    snippet = '\n'.join(f'{n + 1}: {lines[n]}' for n in range(start, end))[:6000]
    result = {'path': name, 'start_line': start + 1, 'snippet': snippet,
            'matches': [{k: v for k, v in item.items() if k != 'offset'} for item in evidence[:3]],
            'read_scope': [name], 'max_snippet_chars': 6000}
    if len(json.dumps(result, ensure_ascii=False)) > 10000:
        raise runtime.Stop('Lokalisierte Evidenz zu umfangreich; Auftrag eingrenzen.')
    return result


def local_text_sources(literal, root, files, cache):
    """Search complete source texts, never infer uniqueness from clipped snippets.

    Refuse the shortcut if the bounded scan cannot cover every eligible source.
    The inventory and workspace are verified by the caller before execution.
    """
    matches, sources, size = {}, {}, 0
    cache = {} if cache is None else cache
    for name in sorted(files):
        if not name.startswith('src/') or Path(name).suffix not in {'.ts', '.tsx', '.css', '.json', '.md'}:
            continue
        path = root / name
        length = path.stat().st_size
        size += length
        if length > 2000000 or size > 8000000:
            return {}
        key = (name, files[name])
        text = cache.get(key)
        if text is None:
            text = path.read_text(errors='replace')
            cache[key] = text
        sources[name] = text
    try:
        catalog = json.loads(sources.get('src/translations.json', '{}'))
        if not isinstance(catalog, dict):
            return {}
    except ValueError:
        return {}
    for name, text in sources.items():
        # The catalog is evidence, not the component to edit for visible copy.
        if name == 'src/translations.json':
            continue
        count = normalize_text(text).count(normalize_text(literal))
        if Path(name).suffix == '.tsx':
            count += translated_text_count(literal, name, text, catalog)
        if count:
            matches[name] = count
    return matches


def direct_plan(request, dossier, runtime, *, root=None, files=None, cache=None):
    """Conservative shortcut: explicit single source or unique literal text match."""
    if len(request) > 1800 or escalation(request):
        return None
    try:
        if runtime.route(request) == runtime.SOL:
            return None
    except runtime.Stop:
        return None
    if not re.search(r'entfern|lösche|remove|delete|ersetz|replace|tippfehler|typo|hover', request, re.I):
        return None
    paths = re.findall(r'[\w./-]+\.(?:tsx?|css|md)', request)
    read_paths = []
    if not paths:
        literal = text_literal(request)
        if literal is None or len(normalize_text(literal)) < 3:
            return None
        if root is not None:
            matches = local_text_sources(literal, root, files, cache)
        else:
            matches = {n: normalize_text(s).count(normalize_text(literal))
                       for n, s in dossier['snippets'].items()}
        if sum(matches.values()) != 1:
            return None
        paths = [n for n, count in matches.items() if count]
    known = files if root is not None else dossier['snippets']
    if len(set(paths)) != 1 or paths[0] not in known or not paths[0].startswith('src/'):
        return None
    return {'summary': request, 'existing': [], 'flags': [], 'tasks': [{
        'id': 'local', 'goal': request, 'paths': sorted(set(paths)),
        'read_paths': read_paths, 'depends_on': [],
        'acceptance': [request, 'Bestehendes Design und Verhalten außerhalb des Wunsches erhalten'],
        'checks': ['frontend', 'build', 'manual'], 'complexity': 'local'}]}


def multiline(read, stop):
    lines, size = [], 0
    while True:
        line = read('... ')
        if line == '/SEND':
            return '\n'.join(lines)
        if line == '/CANCEL':
            return ''
        size += len(line) + 1
        if size > 12000:
            # Drain the paste so its remaining lines cannot become new jobs.
            while line not in {'/SEND', '/CANCEL'}:
                line = read('... ')
            raise stop('Mehrzeiliger Wunsch zu lang (maximal 12000 Zeichen); verworfen.')
        lines.append(line)
