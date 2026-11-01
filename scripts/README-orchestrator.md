# Lokaler Codex-Orchestrator

Python 3 mit Standardbibliothek, POSIX (macOS/Linux), installierte und angemeldete
Codex CLI, Git, npm sowie bereits installierte Projektabhängigkeiten erforderlich.
Keine API-Integration, keine Installation zusätzlicher Abhängigkeiten.

## Automatische Analyse und Planung (erste sichere Ausbaustufe)

`--auto` nimmt eine natürliche Anforderung entgegen und erstellt einen überprüfbaren
Plan. **Diese Version startet im Auto-Modus keine Coding-Worker.** Sie implementiert
bewusst die sichere erste Stufe; automatische Ausführung ist noch nicht freigeschaltet.
Der bisherige manuelle Runner mit `--allow`, `--review` und `--apply` bleibt verfügbar.

Erster kostenloser Test, ohne Modellaufruf und ohne Schreibzugriffe:

```sh
python3 -B scripts/orchestrator.py "Analysiere T7 aus TASKS.md und plane die Umsetzung" --auto --dry-run
```

Ohne vorhandenen Cache zeigt Dry-Run die geplante Pipeline und `analysis_pending`.
Ein konkreter semantischer Plan kann ohne KI-Aufruf nicht vorweggenommen werden.
Mit Cache zeigt derselbe Befehl die bereits validierte Aufgabenliste und Worker-Prompts.
Um erstmals tatsächlich zu analysieren (kann Kontingent verbrauchen):

```sh
python3 -B scripts/orchestrator.py "Analysiere T7 aus TASKS.md und plane die Umsetzung" --auto --max-calls 2 --max-tokens 20000
```

Ablauf und Grenzen:

- Luna Low untersucht gezielt relevante Dateien in einer isolierten Kopie der sicheren,
  Git-erfassten Arbeitsdateien. Die Kopie enthält den Projektstand; Dateien werden nicht
  vollständig in den Prompt eingebettet. Unversionierte Dateien, Dependencies und durch
  den bestehenden Pfadfilter ausgeschlossene Dateien gehören nicht zur Analysequelle.
  Bestehende Funktionen, Risiken, Aufgaben, Pfade, Akzeptanz und Prüfungen werden als JSON
  ausgegeben und unabhängig von der CLI lokal streng validiert.
- Astra Low startet ausschließlich zur Planung, wenn die Analyse `architecture`, `large`
  oder `coupled` meldet, mehr als drei Aufgaben oder vier Zieldateien nennt oder die
  bestehende Architekturregel im Nutzerauftrag greift (z. B. Mehrbenutzer/Cloudhosting).
  Kleine lokale Aufgaben überspringen Astra. Maximal ein Astra-Aufruf, kein automatisches
  höheres Reasoning und kein Coding durch Astra. Modellverfügbarkeit wird nicht durch
  einen kostenpflichtigen Probeaufruf geprüft; ein Zugriffsfehler stoppt ohne Ersatzmodell.
- Die Aufgabe eines Workers wird deterministisch vorgeschlagen: Risikoregeln aus dem
  bisherigen Runner, `risky` oder `complex` → Sol Medium; `local` mit höchstens zwei
  Dateien bzw. bestehender Low-Regel → Luna Low; sonst Luna Medium. Modell und Begründung
  stehen pro Aufgabe im Bericht. Dies sind konservative Regeln, keine verlässliche
  semantische Risikobewertung. Die menschliche Prüfung bleibt erforderlich.
- Abhängigkeiten werden vorwärts aufgelöst; doppelte IDs, unbekannte Abhängigkeiten und
  Zyklen stoppen. Höchstens acht Arbeitspakete. Worker-Prompts enthalten Ziel, Dateien,
  Kriterien, Prüfungen, Randbedingungen und Abbruchregeln. Tests sind nur feste Kategorien
  (`frontend`, `build`, `backend`, `manual`), keine ausführbaren Agentenbefehle.
- Pfade müssen kanonisch, relativ und sicher sein. Bestehende Lesepfade müssen im
  kopierten Git-Inventar vorkommen. Neue Zieldateien sind nur mit bekanntem Elternpfad
  und ausgewählter Quell-/Dokumentationsendung als Vorschlag erlaubt. Globs, Traversal,
  Secrets und unbekannte Lesedateien werden abgewiesen. **Kein Vorschlag wird zu einer
  Schreibfreigabe.** `--auto` lässt sich nicht mit `--allow` oder Review/Apply kombinieren.
- Beide Agenten nutzen `read-only`, keine Sandbox-Eskalation, keine weiteren Agenten,
  ignorierte Benutzerkonfiguration und Exec-Regeln sowie getrennte kurzlebige Sitzungen.
  Die bestehende CLI-Anmeldung bleibt erhalten. Hashprüfungen erkennen Änderungen an
  Kopie oder Original. Der gemeinsame Runner-Lock verhindert parallele echte Läufe.
  Sandbox und Hashprüfungen ersetzen keine zusätzliche Betriebssystemisolation gegen
  absichtlich bösartige Prozesse; ein nachträglicher Hashvergleich rollt nichts zurück.
- `--max-calls` (1–2, Standard 2) begrenzt Modellaufrufe pro Planung. `--max-tokens`
  (Standard 20000) stoppt **nach beobachtetem Verbrauch weitere Aufrufe**. Unbekannte
  Usage stoppt ebenfalls einen weiteren Aufruf. Ein einzelner CLI-Aufruf kann das Limit
  überschreiten; keine harte Token-, Euro- oder Kontingentgarantie. Cache-/Reasoning-Tokens
  werden nicht zusätzlich zu Input/Output doppelt gezählt.
- `report.json` protokolliert Phase, Modell, Reasoning und Input-, Cache-, Output-, Total-
  und Reasoning-Tokens, soweit geliefert; sonst `unknown`. Usage mehrerer CLI-Turns wird
  summiert. Budgetdaten bleiben auch bei Fehlern erhalten. Es gibt keine Kostenschätzung.
- Validierte Pläne werden nach exakter Anforderung, Hashes aller sicheren Git-Dateien und
  Planerversion gecacht. Gleicher Stand wiederholt keine Analyse. Änderungen an erfassten
  Dateien invalidieren den Cache; unversionierte Dateien werden weiterhin nicht berücksichtigt.
  Cachedateien stehen unter `artifacts/orchestrator/plan-<Hash>.json`, vollständige
  Planungsberichte unter `artifacts/orchestrator/<ID>/report.json`.
  Ein ungültiger Cache stoppt und muss manuell entfernt werden. Er ist eine lokale,
  vertrauenswürdige Laufzeitdatei, keine signierte Freigabe für Ausführung.
- `unclear` erzeugt `needs_clarification`; andere erfolgreiche Pläne `planning_only`.
  Planungsberichte können nicht über `--apply` übernommen werden. Ohne gültigen Plan,
  bei Prozessfehlern oder Budgetabbruch gibt es keinen Retry und keinen verwendbaren Cache.

Noch offen für die nächste Ausbaustufe: unabhängig geprüfte automatische Dateifreigaben,
serielle Coding-Ausführung mehrerer Arbeitspakete in einer gemeinsamen isolierten Kopie,
Testausführung pro Paket mit höchstens einem Reparaturversuch und budgetierte Sol-Eskalation.
Bis dahin Aufgaben einzeln prüfen und über den manuellen Runner mit explizitem `--allow`
ausführen. Dessen bisherige Grenzen gelten weiter, insbesondere Sol-Bestätigung und
sofortiger Stopp nach fehlgeschlagenen Tests. Es gibt keine automatische Übernahme,
keine Commits, Pushes oder Deployments.

## Manuell sicher beginnen

Im Projektverzeichnis, ausschließlich planen (keine KI-Aufrufe, keine Dateiänderungen):

```sh
python3 -B scripts/orchestrator.py "T2: Mobile Navigation mit Escape schließen" --allow src/App.tsx --dry-run
```

Dieses Beispiel dient dem Routingtest; T2 ist laut TASKS.md bereits erledigt.
Für echte Arbeit eine neue konkrete Aufgabe mit exakten erlaubten Dateipfaden wählen.
Mehrere Dateien über wiederholtes `--allow` angeben. Keine Verzeichnisfreigaben oder Globs.
Ohne `--dry-run` startet ein möglicherweise kostenpflichtiger Worker:

```sh
python3 -B scripts/orchestrator.py "Konkrete neue lokale Aufgabe" --allow src/BetroffeneDatei.tsx --timeout 600
```

Nur in Git erfasste, gegenwärtige Arbeitsdateien werden kopiert, einschließlich lokaler
Änderungen. Neue Quelldateien vorher selbst in Git erfassen oder später ausdrücklich
als neue Zieldateien freigeben. Vorhandene unversionierte Dateien werden nicht kopiert.
Secrets, `.env*`, lokale Daten, Upload-Artefakte und Codex-Konfiguration sind ausgeschlossen.
AGENTS.md, ARCHITECTURE.md und TASKS.md müssen vorhanden und in Git erfasst sein.

## Regeln und Grenzen

- Im manuellen Modus kein KI-Routing: Architektur-/Astra-/Mehrbenutzer-/Cloudhosting-Aufträge stoppen.
  Recovery, Autosave, Merge, gekoppelte Zustände, Composition, Veröffentlichung,
  Auth/CSRF, Datenbank/Migration und Backendpfade → `gpt-6.1-sol / medium`.
  T4/T6, Tippfehler, README/Dokumentation oder ausdrücklich lokale Testergänzungen
  → `gpt-6-luna / low`. Einfache README- und Dokumentationsaufgaben erhalten ebenfalls
  `gpt-6-luna / low`. Übrige Aufgaben → `gpt-6-luna / medium`.
  Risikoregeln haben Vorrang. Diese Heuristik ist keine semantische Sicherheitsanalyse;
  Aufgabe und Dry-Run-Plan manuell prüfen.
- Sol erfordert vor jedem Aufruf interaktiv die Eingabe `SOL`, auch bei direktem
  Routing. Keine Bestätigungs-Bypassoption. Im manuellen Modus wird Astra niemals gestartet.
- Ein systemweiter Dateilock pro Projekt verhindert parallele Orchestratorläufe.
  Höchstens drei serielle Workeraufrufe: Start, insgesamt ein Reparaturversuch und
  eine Eskalation an Sol. Nur eindeutige strukturierte Workerantworten
  `needs_repair`/`needs_sol` erlauben diese Fortsetzungen. `blocked`, unklare Ergebnisse,
  Prozessfehler, unerwartete Dateien oder fehlgeschlagene Prüfungen stoppen sofort.
- Timeout standardmäßig 600 Sekunden **pro Prozessaufruf**, einstellbar 1–3600.
  Bei Timeout und Abbruch wird die POSIX-Prozessgruppe inklusive ihrer Kindprozesse
  mit SIGKILL beendet, auch wenn der Elternprozess schon beendet ist. Absichtlich aus
  der Prozessgruppe ausbrechende Prozesse erfordern zusätzliche Betriebssystemisolation.
  Dateikopien und interaktive Bestätigung zählen nicht zum Prozesstimeout.
  **Timeouts und Aufruflimits sind keine garantierten Token- oder Kostenlimits.**
- Worker verwenden `codex exec`, `workspace-write`, explizites Modell/Reasoning,
  deaktivierte Multi-Agent-Funktion, keine Netzfreigabe für Shellbefehle, keine
  Sandbox-Eskalation und keine zusätzliche Schreibfreigabe. Benutzereinstellungen
  werden ignoriert; CLI-Anmeldung bleibt erforderlich. Keine automatischen Commits,
  Pushes, Deployments oder Übernahmen. Kein `--yolo` oder unsicherer Sandboxmodus.
- Jeder Lauf liegt unter `artifacts/orchestrator/<Lauf-ID>/workspace`, innerhalb
  des Projekts, mit eigenem leeren Git-Verzeichnis. Es entstehen keine Git-Commits.
  Der Worker bekommt nur diese Kopie. Pfadfilter und Hashprüfungen stoppen bei
  unerwarteten Änderungen; sie ersetzen keine Betriebssystem-Sandbox gegen bösartige
  Prozesse. Die globale Codex-Anmeldung/CLI-Laufzeit kann eigene Verwaltungsdaten führen.
- Projekt-Snapshots und Basis-Hashes lassen `.git` vollständig aus; tatsächliche
  Projektdateien unterliegen weiter den strengen Pfad-, Symlink- und Hashprüfungen.
- Nach erfolgreichem Workerabschluss werden vorhandene `node_modules` und bei Bedarf
  `.venv` in die Kopie kopiert (zusätzlicher Speicherbedarf). Symlinks in `.venv`
  werden beim Kopieren dereferenziert; es werden keine Symlinks zum Original angelegt
  und keine Pakete installiert. Vor `npm test` prüft der Orchestrator den kopierten
  Python-Interpreter und pytest. Ist die Umgebung nicht lauffähig oder unvollständig,
  stoppt er mit einer verständlichen Meldung; `.venv` muss dann im Originalprojekt
  kontrolliert neu erstellt werden. Dort laufen immer `npm run test:frontend` und
  `npm run build`; bei Backend- oder Paketmanifeständerungen zusätzlich `npm test`.
  Generierte Build-/Cachedateien werden bei der anschließenden Integritätsprüfung
  ausgenommen. Tests können temporäre Betriebssystemdateien erzeugen.
- Das JSON-Protokoll `report.json` enthält Modell, Reasoning, Prüfungen, Dateiliste,
  Ergebnis, Basis-Hashes und Token-Nutzungsdaten pro Workeraufruf. Nicht gelieferte
  Nutzungswerte stehen als `unknown`; es werden keine Kosten geschätzt. Vollständige
  Prozessausgaben stehen in separaten Logs. Es gibt keine automatischen Commits oder Pushes.
  Browser-/UI-Prüfungen bleiben manuell; grüne Logiktests und Builds ersetzen sie nicht.

## Review und Übernahme

Nach einem erfolgreichen Lauf zeigt Review den Diff zwischen Original und isolierter
Kopie. Die Lauf-ID steht im Pfad des Ergebnisprotokolls:

```sh
python3 -B scripts/orchestrator.py --review 20261031-120000-ab12cd34
```

Optional begrenzt `--file` Review auf eine im Lauf freigegebene und geänderte Datei;
die Option kann wiederholt werden. Übernahme zeigt denselben Diff und verlangt danach
die exakte Eingabe `APPLY`:

```sh
python3 -B scripts/orchestrator.py --apply 20261031-120000-ab12cd34
python3 -B scripts/orchestrator.py --apply 20261031-120000-ab12cd34 --file docs/guide.md
```

Vor der Bestätigung prüft der Befehl, dass die Projektkopie unverändert ist und jede
Originaldatei noch dem beim Lauf gespeicherten Basis-Hash entspricht. Konflikte,
unerwartete Änderungen, nicht erlaubte Dateien und nicht interaktive Aufrufe stoppen.
Neue Dateien werden angelegt, im Lauf gelöschte Dateien entfernt. Review/Apply führen
keine Git-Aktion aus.

## Offline prüfen

```sh
python3 -B -c 'from pathlib import Path; [compile(p.read_text(), str(p), "exec") for p in (Path("scripts/orchestrator.py"), Path("scripts/test_orchestrator.py"), Path("scripts/orchestrator_planning.py"), Path("scripts/test_orchestrator_planning.py"))]'
python3 -B -m unittest discover -s scripts -p 'test_orchestrator*.py' -v
```

Die Tests verwenden Mocks und lokale Python-Schlafprozesse zur Timeoutprüfung;
sie starten keine Codex-Worker und verursachen keine Modellaufrufe.

CLI-Referenz: [Offizielle OpenAI-Dokumentation](https://learn.chatgpt.com/docs/developer-commands).
Die verwendeten Flags wurden zusätzlich mit der installierten `codex exec --help`
geprüft. Verfügbarkeit der Modellnamen hängt von der lokalen Codex-Anmeldung ab;
ein nicht verfügbares Modell stoppt den Lauf, ohne automatischen Ersatz.

Modell-IDs: [Offizielle Modellübersicht](https://developers.openai.com/api/docs/models).
CLI 0.166.0 wurde lokal über `codex --help` und `codex exec --help` geprüft;
der Auto-Modus prüft benötigte Exec-Flags vor echten Planungsaufrufen erneut.
