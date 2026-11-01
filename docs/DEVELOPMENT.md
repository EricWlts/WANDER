# WANDER mit nativem Codex entwickeln

## Beauftragen, prüfen, übernehmen

1. WANDER in Codex öffnen und für alltägliche Arbeit einen neuen Chat mit **GPT-6 Luna / Medium** verwenden. Projektkonfigurationen werden nur in vertrauenswürdigen Projekten geladen; die Modellauswahl der App kann Vorrang haben. Ein bestehender Chat wechselt sein Modell nicht durch diese Datei.
2. Wunsch in eigenen Worten beschreiben, etwa: „Der Abstand unter dem Titel ist auf dem Handy zu groß. Bitte verkleinern und zuerst eine Vorschau zeigen.“ Codex hält Ziel und Abnahmefälle in `TASKS.md` fest und bearbeitet nur diesen Auftrag.
3. Codex erstellt oder verwendet einen isolierten nativen Worktree, implementiert und prüft den Entwurf. Es nennt Modellwahl/Eskalation kurz, öffnet die lokale Vorschau und zeigt relevante Änderungen im nativen Review. Bei UI-Arbeit Desktop und Mobil, DE/EN sowie betroffene Interaktionen kontrollieren.
4. Feedback im selben Chat geben: „Noch etwas weniger Abstand; Desktop bitte so lassen.“ Codex bearbeitet denselben Entwurf und prüft die betroffenen Stellen erneut.
5. Erst **„Diesen Stand übernehmen“** erlaubt die lokale Integration des zuletzt gezeigten, unveränderten Entwurfs. Vorher bleiben Änderungen im Worktree. Ein Commit, Push oder Deployment benötigt einen entsprechenden ausdrücklichen Auftrag. „Verwerfen“ betrifft nur den zugehörigen Entwurf.

Für diese Einrichtung werden nur Konfigurations- und Anweisungsdateien im bestehenden Checkout geändert. Die Isolation gilt für künftige Anwendungsänderungen. Die Freigaberegel ist eine Agentenanweisung, keine technisch erzwungene Merge-Sperre. Subagenten teilen grundsätzlich die Berechtigungen des Elternchats.

## Modellwahl und Kosten

| Arbeit | Modell | Reasoning |
| --- | --- | --- |
| Texte, kleine CSS-Korrektur, klar begrenzter Fix | `gpt-6-luna` | low; medium bei Logik |
| Gekoppelte Zustände, Save/Recovery, Auth, asynchrone Abläufe, komplexe Implementierung | `gpt-6.1-sol` | medium; high bei Bedarf |
| Architektur, wesentliche verbleibende Unsicherheit, zwei unterschiedliche gescheiterte Lösungsversuche | `gpt-6-astra` | zunächst low |

Das ist eine Routingregel nach Risiko, keine gemessene Kostenersparnis oder Preisgarantie. Der Hauptchat kostet ebenfalls: eine kleine Aufgabe direkt mit Luna bearbeiten; keine zusätzliche Planer-/Explorer-/Reviewer-Kette für Kleinigkeiten. Maximal ein Subagent gleichzeitig, keine Unterdelegation. Bestehende Ergebnisse weiterverwenden, Kontext auf relevante Dateien begrenzen und Prüfungen nur bei Bedarf wiederholen.

Native Werkzeuge übernehmen Start, Nachrichten, Warten und Unterbrechen. Modellwechsel beim Spawn explizit setzen; bei der hier verfügbaren `collaboration.spawn_agent`-Schnittstelle sind Modellüberschreibungen mit `fork_turns="none"` möglich. Deshalb ein kurzes eigenständiges Auftragsdossier samt Projektregeln mitgeben. Ein vollständiger History-Fork erbt Modell und Reasoning. Eigene Rollen-Dateien und ein zusätzlicher Orchestrator sind für diesen Ablauf nicht erforderlich.

Vor jedem Einsatz die tatsächlich angebotenen Modelle und Werkzeuge beachten. Ist ein Modell nicht verfügbar, die Grenze melden und eine passende verfügbare Alternative klären; nicht stillschweigend Astra wählen. Ein bestehender Astra-Hauptchat wird durch günstige Subagenten allein nicht kostengünstig. Architekturentscheidungen vor Umsetzung mit dem Nutzer abstimmen.

Für substanzielle Logikänderungen nach Abschluss des Workers einen unabhängigen Review-Subagenten mit Diff, Abnahmefällen und Testergebnissen beauftragen. Luna genügt bei begrenztem Risiko; Sol prüft komplexe/persistenzrelevante Änderungen. Reine Text-/kleine Stilkorrekturen brauchen nur einen gezielten Selbstcheck. Der native Review-Bereich macht den Diff für den Nutzer sichtbar.

## Vorschau und vorhandene Prüfungen

- Vite ist bereits vorhanden; keine neue Browser- oder Testabhängigkeit nötig. Aus dem Entwurfsverzeichnis `npm run dev -- --port 5174` aufrufen, sofern der Port frei ist. Bei Belegung einen anderen freien Port wählen, keine fremden Prozesse beenden. Die genaue URL nennen und mit dem nativen Browser öffnen. Änderungen erscheinen über Vite unmittelbar. Laufende Prozesse und Worktree dem Auftrag zuordnen.
- Ein neuer Worktree enthält keine ignorierten Abhängigkeiten. Vorhandene lokale Laufzeiten/Abhängigkeiten nach Möglichkeit wiederverwenden; keine Paketversionen oder Lockfiles nebenbei ändern. Fehlt eine Voraussetzung, konkret melden.
- Vite leitet `/api` und `/media` standardmäßig an Port 5001 weiter. **Eine Worktree-Vorschau isoliert nicht automatisch die Datenbank.** Ohne eigenes Testbackend nur öffentliche, nicht schreibende Oberflächen prüfen. Studio-Editor, Autosave, Upload und Veröffentlichung nicht gegen den echten Datenbestand ausprobieren.
- Für schreibende Browserfälle eine getrennte Vorschau mit Wegwerf-Testdaten vorbereiten. Das bestehende Backend bindet `.instance` relativ an seine Quellkopie. Daher muss der Backendprozess zur isolierten Quellkopie gehören; nie `.instance`, Uploads oder Secrets des Originals kopieren/verknüpfen. Keine vorhandenen Umgebungsvariablen verändern. Falls ohne Konfigurations-/Anwendungserweiterung keine sichere Testvorschau möglich ist, den Browserfall offen melden und den nötigen Folgeauftrag beschreiben. Diese Einrichtung startet bewusst kein Backend.
- `npm start` startet die vorhandene lokale App mit Frontend und Backend; es ist kein isolierter Abnahmemodus. Der Starthelfer `scripts/dev.py` ist kein Modell-Orchestrator, wird aber nicht zur isolierten Datenprüfung verwendet.
- Frontendänderungen: `npm run test:frontend` und `npm run build`. Backend-/Persistenzänderungen: zusätzlich `npm test` (oder zusammen `npm run test:all`). Keine Lint- oder DOM-Testumgebung vorhanden. Browserprüfung separat belegen, fehlende Abdeckung offen lassen. Nur direkt verursachte Fehler beheben.

Worktrees starten vom gewählten Commit, nicht von ungesicherten Änderungen im ursprünglichen Checkout. Codex prüft vorher den Git-Status und benennt fehlende Voraussetzungen. Keine automatische Sicherungs- oder Sammel-Commits. Nach Freigabe nur den geprüften Auftragsdiff lokal integrieren, auf zwischenzeitliche Änderungen prüfen und bei Konflikten stoppen.

## Geprüfte Installation und Grenzen

Stand der Inspektion: 01.11.2026.

- Desktop-App: **26.917.71314**, Build **10954**; eingebetteter Kern: **0.155.0-alpha.16.4** unter `/Applications/Codex.app/Contents/Resources/codex`.
- Separat installierte CLI: **0.166.0**. Beide melden `multi_agent` als stabil und aktiviert; `step_model_switching` ist nicht aktiviert. Auf automatisches Routing des Hauptmodells wird daher nicht gebaut.
- Die aktuelle Chat-Schnittstelle bietet `spawn_agent`, `followup_task`, `send_message`, `wait_agent`, `interrupt_agent` und `list_agents`, einschließlich expliziter Modelle `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra`. Vier Laufplätze einschließlich Hauptagent sind in dieser Sitzung verfügbar; die Projektregel nutzt höchstens einen Worker.
- Der gebündelte Modellkatalog beider Installationen enthält Luna und Astra mit `low`/`medium`/`high`; die separate CLI enthält auch `gpt-6.1-sol`. Der ältere Desktop-Bundlekatalog allein belegt Sol 6.1 nicht; die aktuelle Chat-Werkzeugbeschreibung bietet es ausdrücklich an. Kontozugriff und erfolgreiche Modellinferenz sind ohne echten Modellaufruf nicht vollständig testbar.
- `.codex/config.toml` setzt Luna/Medium für neue Sitzungen und Luna/Low als Subagenten-Standard. Explizite Spawn-Einstellungen wählen Sol/Astra nach den Regeln in `AGENTS.md`. Keine Änderung an globalen Einstellungen, Berechtigungen, Secrets oder Umgebungsvariablen.
- Konfigurationsprüfung und Projektchecks: siehe abschließenden Prüfvermerk unten. Es werden keine Subagenten oder kostenpflichtigen Modell-Probeaufgaben gestartet.

Offizielle Referenzen: [Subagenten, Modellvererbung und Konfiguration](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Konfigurationsreferenz](https://learn.chatgpt.com/docs/config-file/config-reference). Die tatsächlich installierte Version und die aktuelle Werkzeugoberfläche haben Vorrang vor neueren Dokumentationsbeispielen.

## Prüfvermerk zur Einrichtung

- Erfolgreich: Beide installierten Kerne mit `--strict-config` gestartet und über die native App-Server-Schnittstelle `config/read` geprüft. Beide laden die Projekt-Konfiguration aus diesem WANDER-Ordner und lösen Luna/Medium, aktivierte Agenten, maximal einen Subagenten und Luna/Low als Subagenten-Standard korrekt auf. Die Prüfprozesse wurden anschließend beendet; temporäre Laufzeitdaten lagen außerhalb des Projekts.
- Erfolgreich: TOML-Struktur, lokale Dokumentationslinks, Erhalt des vorherigen Inhalts in `ARCHITECTURE.md`/`TASKS.md`, `git diff --check`, alle **26 Frontendtests**, TypeScript-/Vite-Produktionsbuild.
- Kein Anwendungscode geändert, keine Abhängigkeit hinzugefügt, kein Python-Orchestrator ausgeführt, kein Modellaufruf/Probe-Subagent gestartet, kein Commit/Push/Deployment. Bestehende ungesicherte Orchestrator-Änderungen bleiben erhalten.
- Nicht durchgeführt: echte Modellinferenz, Delegation, Browserinteraktion oder Übernahme eines Anwendungsdiffs. Diese Fälle werden beim ersten tatsächlichen Entwicklungsauftrag geprüft; die Konfigurationsprüfung allein belegt keine vollständige Ausführung. Backendtests wurden bei dieser reinen Konfigurations-/Dokumentationsänderung nicht erneut ausgeführt.
