# Lokaler Codex-Orchestrator

Python 3 mit Standardbibliothek, POSIX (macOS/Linux), installierte und angemeldete
Codex CLI, Git, npm sowie bereits installierte Projektabhängigkeiten erforderlich.
Keine API-Integration, keine Installation zusätzlicher Abhängigkeiten.

## Interaktive Entwicklung

Im Projektverzeichnis einmal starten:

```sh
python3 -B scripts/orchestrator.py --interactive
```

Danach beispielsweise `Mach den Hover der Fotokarten sanfter` eingeben. Die Sitzung
erstellt eine isolierte Kopie des aktuellen sicheren, Git-erfassten Projektstands
(einschließlich lokaler Änderungen). Luna Low erhält das kompakte Analysedossier und
ermittelt konkrete Zieldateien. Das Terminal zeigt Aufgaben, Modelle und Dateipfade.
`EXECUTE` bestätigt diese Dateien einmalig für den Entwurf; weitere Dateipfade brauchen
eine neue Bestätigung. `--allow` ist nicht erforderlich. Ohne diese Bestätigung läuft
kein Coding-Worker. Für Umsetzung gelten dieselben deterministischen Luna-/Sol-Regeln
wie bei `--execute-plan`; strategische Systementscheidungen dürfen Astra Low zur
Analyse verwenden, bleiben aber bis zur manuellen Klärung gesperrt.

Nach jeder Aufgabe laufen die vorhandenen Tests und der Build in der separaten
Prüfkopie. Danach startet **Vite Preview mit dem geprüften Produktionsbuild** auf
`127.0.0.1` und einem freien, streng gebundenen Port ungleich 5173. Die URL erscheint
im Terminal. Der vorhandene Vite-Server wird weder angesprochen noch beendet.
Vor Folgefeedback stoppt nur der Vorschauprozess dieser Sitzung; nach erfolgreicher
Prüfung startet er erneut, gegebenenfalls mit einer anderen URL. Browser neu öffnen
oder aktualisieren; es gibt kein HMR. Die Vorschau lädt keine Projekt-Vite-Konfiguration
und hat **keinen Backendproxy**: Login, gespeicherte Reisen, Upload und datenabhängige
Ansichten können hier nicht vollständig geprüft werden. Originaldatenbank und Medien
werden nicht kopiert. Es wird kein Backend gestartet.

Nach dem Betrachten einfach den nächsten Wunsch eingeben, zum Beispiel
`Etwas langsamer, aber den Schatten beibehalten`. Nur dieser neue Wunsch wird anhand
der aktuellen Entwurfsdateien und der letzten vier Feedbackzusammenfassungen geplant;
der erste Plan wird nicht erneut vollständig aufgestellt. Worker arbeiten weiter
an derselben Kopie. Tests bleiben vor der nächsten Vorschau verpflichtend.

| Eingabe | Wirkung |
| --- | --- |
| Natürlichsprachlicher Wunsch | Erste Aufgabe oder nächste Änderung am aktuellen Entwurf |
| `HELP` | Verfügbare Befehle anzeigen |
| `STATUS` | Zustand, Modelle in den Rundenprotokollen, Tests, Aufruf-/Tokenverbrauch, URL und Protokollpfad |
| `DIFF` | Geprüfte Änderungen gegenüber dem ursprünglichen Projektstand anzeigen |
| `APPLY` | Integrität und Originalstand prüfen, Diff anzeigen; erst eine **zweite exakte Eingabe `APPLY`** übernimmt die Dateien und beendet die Sitzung |
| `DISCARD` | Vorschau stoppen, beide Entwurfskopien löschen und Apply-Bericht ungültig machen; danach ist ein neuer Wunsch möglich |
| `EXIT` / `QUIT` | Vorschau stoppen und Sitzung ohne Übernahme beenden; Entwurf/Protokolle bleiben für manuelles Review/Apply erhalten |
| Strg+D / Strg+C | Sitzung abbrechen; keine automatische Übernahme, Vorschau wird beendet |
| `EXECUTE` | Nur als Antwort auf die Dateifreigabe; jede andere Antwort lehnt die Ausführung ab |

Sitzungsbefehle werden ohne Rücksicht auf Groß-/Kleinschreibung erkannt;
Bestätigungen müssen exakt `EXECUTE` beziehungsweise `APPLY` lauten. Nach erfolgreichem
Apply für weitere Aufgaben erneut starten. Es gibt kein automatisches Wiederaufnehmen
einer beendeten Sitzung. Protokolle bleiben auch nach DISCARD unter
`artifacts/orchestrator/<Sitzungs-ID>/`; diese lokalen Artefakte können Aufgabentexte
und Quellausschnitte enthalten. Manuelle CLI-Modi bleiben verfügbar.

Optional lassen sich die vorhandenen Limits beim Start setzen:

```sh
python3 -B scripts/orchestrator.py --interactive --max-tokens 20000 --worker-calls 8 --max-calls 2 --timeout 600
```

Das Tokenbudget gilt gemeinsam für Analyse, Astra und Coding über die **gesamte
Sitzung**, auch nach DISCARD. Insgesamt sind höchstens `--worker-calls + --max-calls`
Modellaufrufe erlaubt (Standard 10), davon höchstens `--worker-calls` Coding-Aufrufe
(Standard 8). Jede Feedbackplanung benötigt erneut einen Analyseaufruf; je Wunsch
bleibt das Planungslimit `--max-calls` (1–2) erhalten. Pro Aufgabe höchstens ein
ausdrücklich angeforderter Reparaturversuch; fehlgeschlagene Tests starten keine
Reparaturschleife. Unbekannte Tokenzahlen oder ausgeschöpfte Limits verhindern den
nächsten Modellaufruf. Ein einzelner laufender Aufruf kann das beobachtete Budget
überschreiten; dies ist **kein hartes Kostenlimit**. Es werden keine Preise geschätzt.

Unklare Pläne führen zu keiner Schreibfreigabe; der Wunsch kann präzisiert werden.
Fehlgeschlagene Umsetzung oder Integritätsfehler sperren den Entwurf: dann DISCARD
oder EXIT verwenden. Änderungen am Original, an der geprüften Kopie oder dem Bericht
werden vor Weiterarbeit/Apply abgelehnt. Auch nach der Apply-Bestätigung werden
Original- und Ergebnisstand nochmals geprüft. Hashes erkennen nachträgliche Änderungen
an bereits geänderten Dateien. Ein zweiter Orchestrator wird während der Sitzung per
Lock abgewiesen. Browserprüfung bleibt manuell. Pfad-/Hashkontrollen ergänzen die
bestehende CLI-Sandbox; sie ersetzen keine vollständige Isolation gegen bösartige
Prozesse mit denselben Betriebssystemrechten. Apply kopiert Dateien einzeln und ist
keine dateiübergreifende Transaktion. Keine Commits, Pushes oder Deployments.

## Automatische Planung und ausdrücklich freigegebene Ausführung

```sh
python3 -B scripts/orchestrator.py "Hover der Fotokarten in src/refinement.css sanfter abstimmen" --auto --dry-run
python3 -B scripts/orchestrator.py "Hover der Fotokarten in src/refinement.css sanfter abstimmen" --auto --max-tokens 20000
python3 -B scripts/orchestrator.py --execute-plan validated-<Hash> --dry-run
python3 -B scripts/orchestrator.py --execute-plan validated-<Hash> --worker-calls 8 --max-tokens 20000
```

`--auto` analysiert ausschließlich. Ein Cachetreffer benötigt keinen Modellaufruf;
ohne Cache zeigt Dry-Run `analysis_pending`. Ein erfolgreicher neuer Plan enthält
`plan_id` (`validated-` plus SHA-256). `--execute-plan` zeigt Ziele, Abhängigkeiten,
Modelle, Reasoning und **alle konkreten Zieldateien**. Erst die interaktive Eingabe
`EXECUTE` erteilt die zusammengefasste Schreibfreigabe für diese Dateien in der
isolierten Kopie. Es gibt keine Bestätigungs-Bypassoption. Sol ist dabei ausdrücklich
mit aufgeführt; im manuellen Einzelmodus bleibt die separate SOL-Bestätigung erhalten.

Die Ausführung verwendet vorhandene Worker-Kommandos, Sandbox, Prozessgruppen-Abbruch,
Pfadprüfungen und Projekt-Snapshots. Sie verarbeitet maximal acht Aufgaben seriell in
Abhängigkeitsreihenfolge. Pro Aufgabe höchstens zwei Aufrufe (Start und ein explizit
angeforderter Reparaturversuch), insgesamt `--worker-calls` (1–16, Standard 8).
`needs_sol`, `blocked`, Prozessfehler, Timeout, unklare Ergebnisse und unerwartete
Dateien stoppen sofort. Es gibt keine automatische Modell-Eskalation. Die gespeicherten
Modellvorschläge werden vor Ausführung durch den aktuellen deterministischen Router
neu berechnet und verglichen. Risikoregeln berücksichtigen auch Lesepfade und Kriterien:
Daten-/Sicherheitsrisiken oder komplexe Aufgaben → Sol Medium; lokale begrenzte Aufgaben
→ Luna Low; sonst Luna Medium. Ein Agentenvorschlag allein erteilt keine Schreibrechte.

Nach jedem abgeschlossenen Arbeitspaket laufen mindestens `npm run test:frontend` und
`npm run build`, bei Backend-/Manifeständerungen oder ausdrücklich geplantem Backendcheck
zusätzlich `npm test`. Prüfungen laufen in einer separaten Quellkopie mit kopierten
vorhandenen Dependencies. Coding-Worker erhalten keine Dependencies oder generierten
Prüfausgaben. Es werden keine Pakete installiert. Fehlende Dependencies, veränderte
Prüfquellen und fehlgeschlagene Prüfungen stoppen; kein automatischer Test-Reparaturloop.
Manuelle Browserprüfungen bleiben im Bericht ausdrücklich `pending`.

Ergebnisse liegen unter `artifacts/orchestrator/<Ausführungs-ID>/workspace`, der Bericht
unter `report.json`. Nur erfolgreiche Läufe erhalten `ready_for_manual_review`.
Danach wie bisher `--review <Ausführungs-ID>` und ausdrücklich manuell `--apply` verwenden.
Originaldateien werden durch Planung/Ausführung nicht geändert. Es gibt keine automatischen
Commits, Pushes, Deployments oder Übernahmen.

### Kostenbefund und Kontextbegrenzung

Der lokale Lauf `20261101-111641-plan-e5370dcb` meldete **77.976 beobachtete Token**:
77.157 Input (52.480 gecacht, **24.677 ungecacht**) und 819 Output. Das Log zeigt drei
Toolrunden: Dateisuche, vollständige Regeln einschließlich TASKS.md plus breite CSS-Suche
(27.036 Ausgabezeichen), danach weitere Ausschnitte (5.270 Zeichen). Wiederholt
übertragener Kontext zählt erneut als Input, auch wenn Teile gecacht sind. Low-Reasoning
verhindert das nicht. Das Log weist den Anteil des CLI-Grundkontexts nicht separat aus;
eine genauere Ursachenaufteilung ist deshalb nicht belegt. Es gab keinen Astra-Aufruf.
Das bisherige Budget war bereits eine Zulassungsprüfung **zwischen** CLI-Aufrufen;
der erste Aufruf konnte das Limit überschreiten.

Der Planer erhält jetzt ein kompaktes strukturiertes Dossier anstelle einer vollständigen
Projektkopie zur Exploration: AGENTS.md/ARCHITECTURE.md (je höchstens 7.000 Zeichen), nur
ausdrücklich referenzierte TASKS.md-Einträge (höchstens 4.000 Zeichen), Dateiinventar und
höchstens sechs relevante Quellausschnitte (je 2.000 Zeichen). Die lokale Suche priorisiert
explizite Pfade und CSS bei entsprechenden Anforderungen; sie liest höchstens 32 geeignete
Dateien und 384.000 Quellbytes. Sie überspringt große Dateien und Lockfiles. Vollständige
Hashes aller sicheren Git-Dateien bleiben für Standprüfung und Cache nötig. Fehlende
Evidenz muss `unclear` ergeben; explizite Dateipfade in der Anforderung verbessern die Auswahl.
Ein kleinerer Kontext kann deshalb häufiger eine manuelle Präzisierung erfordern.

Der Prompt verlangt eine Antwort ohne Tools, Tests, Netzwerk oder weitere Agenten.
Das ist keine providerseitige Sperre sämtlicher Toolaufrufe. Die vorhandene Read-only-Sandbox
bleibt aktiv. Astra Low startet ausschließlich, wenn die deterministische Architekturregel
im Benutzerauftrag greift. Umfang, Abhängigkeiten und Agentenflags starten Astra nicht.
Architektur-/unklare Pläne sind von der automatischen Coding-Ausführung ausgeschlossen.

`--max-tokens` (Standard 20.000) gilt je Planung bzw. gesondertem Ausführungslauf und zählt
beobachteten Input einschließlich Cache plus Output. Cache-/Reasoning-Teilwerte werden
nicht zusätzlich gezählt. Bei unbekannter Usage oder ausgeschöpftem Budget wird kein
weiterer Modellaufruf zugelassen; lokale Tests können noch laufen. **Ein einzelner Aufruf
kann das Budget überschreiten. Es gibt keine garantierte harte Token- oder Kostengrenze.**
Der Bericht zeigt `over_budget`, `overrun_tokens`, `limit_reached`, `hard_cost_limit: false`,
Aufrufzahlen sowie Input-, Cache-, ungecachte Input-, Output-, Total- und Reasoning-Token
pro Aufruf. Fehlende Werte bleiben `unknown`. Eine Preis-/Euro-Schätzung erfolgt nicht.

### Cache, Gültigkeit und Manipulationsschutz

Der bestehende Cache unter `plan-<Hash>.json` bleibt an Planerversion, exakte Anforderung
und Hashes aller sicheren Git-Arbeitsdateien gebunden. Erfolgreiche Pläne werden zusätzlich
unter `<plan_id>/validated-plan.json` gespeichert. Die vollständige Inhaltsadresse bindet
Version, Anforderung, Basis-Hashes, validierten Plan und Modellvorschläge. Beim Laden werden
Hash, Schema, sichere Pfade, Abhängigkeiten, aktuelle Projekt-Hashes und Routing geprüft;
nach der Bestätigung folgt dieselbe Prüfung erneut. Bereits vorhandene unversionierte
neue Zieldateien werden abgelehnt. Ein Cachetreffer wird mit dem gespeicherten Plan
verglichen. Geänderte Regeln/Projektdateien invalidieren den Plan. Unversionierte Dateien
gehören weiterhin nicht zum Basisinventar. Neue Dateikollisionen werden separat geprüft.

Alte Planberichte aus Version 1 besitzen keinen solchen ausführbaren Beleg und müssen
erneut geplant werden. Ungültige Caches stoppen ohne kostenpflichtigen Ersatzaufruf.
Die Inhaltsadresse erkennt Manipulation unter derselben ID; sie ist **keine Signatur oder
Authentifizierung gegen jemanden mit vollständigem Schreibzugriff auf Laufzeitverzeichnis
und gewählte IDs**. Laufzeitdaten lokal schützen und die angezeigten Ziele prüfen. Sandbox
und nachträgliche Hashprüfungen ersetzen keine zusätzliche Betriebssystemisolation gegen
absichtlich bösartige Prozesse. Der gemeinsame Lock verhindert parallele echte Läufe.

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
python3 -B -c 'from pathlib import Path; [compile(p.read_text(), str(p), "exec") for p in Path("scripts").glob("*orchestrator*.py")]'
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
