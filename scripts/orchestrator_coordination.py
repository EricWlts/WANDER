"""Local coordination policy. No model calls and no implicit write authority."""
import json
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


def direct_plan(request, dossier, runtime):
    """Conservative shortcut: explicit single source or unique literal text match."""
    if len(request) > 500 or escalation(request):
        return None
    try:
        if runtime.route(request) == runtime.SOL:
            return None
    except runtime.Stop:
        return None
    if not re.search(r'entfern|lösche|remove|delete|ersetz|replace|tippfehler|typo|hover', request, re.I):
        return None
    paths = re.findall(r'[\w./-]+\.(?:tsx?|css|md)', request)
    if not paths:
        literals = re.findall(r'[„"“\']([^„"“\']{3,80})["“\']', request)
        if len(literals) != 1:
            return None
        paths = [name for name, snippet in dossier['snippets'].items() if literals[0] in snippet]
    if len(set(paths)) != 1 or paths[0] not in dossier['snippets'] or not paths[0].startswith('src/'):
        return None
    return {'summary': request, 'existing': [], 'flags': [], 'tasks': [{
        'id': 'local', 'goal': request, 'paths': sorted(set(paths)), 'read_paths': [], 'depends_on': [],
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
