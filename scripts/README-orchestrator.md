# Lokaler Codex-Orchestrator

Python 3 mit Standardbibliothek, POSIX (macOS/Linux), installierte und angemeldete
Codex CLI, Git, npm sowie bereits installierte Projektabhängigkeiten erforderlich.
Keine API-Integration, keine Installation zusätzlicher Abhängigkeiten.

## Sicher beginnen

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

- Kein KI-Routing: Architektur-/Astra-/Mehrbenutzer-/Cloudhosting-Aufträge stoppen.
  Recovery, Autosave, Merge, gekoppelte Zustände, Composition, Veröffentlichung,
  Auth/CSRF, Datenbank/Migration und Backendpfade → `gpt-6.1-sol / medium`.
  T4/T6, Tippfehler, README/Dokumentation oder ausdrücklich lokale Testergänzungen
  → `gpt-6-luna / low`. Einfache README- und Dokumentationsaufgaben erhalten ebenfalls
  `gpt-6-luna / low`. Übrige Aufgaben → `gpt-6-luna / medium`.
  Risikoregeln haben Vorrang. Diese Heuristik ist keine semantische Sicherheitsanalyse;
  Aufgabe und Dry-Run-Plan manuell prüfen.
- Sol erfordert vor jedem Aufruf interaktiv die Eingabe `SOL`, auch bei direktem
  Routing. Keine Bestätigungs-Bypassoption. Astra wird niemals gestartet.
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
python3 -B -c 'from pathlib import Path; [compile(p.read_text(), str(p), "exec") for p in (Path("scripts/orchestrator.py"), Path("scripts/test_orchestrator.py"))]'
python3 -B -m unittest discover -s scripts -p 'test_orchestrator.py' -v
```

Die Tests verwenden Mocks und lokale Python-Schlafprozesse zur Timeoutprüfung;
sie starten keine Codex-Worker und verursachen keine Modellaufrufe.

CLI-Referenz: [Offizielle OpenAI-Dokumentation](https://learn.chatgpt.com/docs/developer-commands).
Die verwendeten Flags wurden zusätzlich mit der installierten `codex exec --help`
geprüft. Verfügbarkeit der Modellnamen hängt von der lokalen Codex-Anmeldung ab;
ein nicht verfügbares Modell stoppt den Lauf, ohne automatischen Ersatz.
