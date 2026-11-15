# Lokaler Codex-Orchestrator

Python 3 mit Standardbibliothek, POSIX (macOS/Linux), installierte und angemeldete
Codex CLI, Git, npm sowie bereits installierte Projektabhängigkeiten erforderlich.
Keine API-Integration, keine Installation zusätzlicher Abhängigkeiten.

## Interaktive Entwicklung

Im Projektverzeichnis einmal starten:

```sh
python3 -B scripts/orchestrator.py --interactive
```

Danach natürliche Entwicklungswünsche eingeben, den geprüften Stand im Browser ansehen
und Feedback für **denselben Entwurf** geben. Originaldateien werden erst nach `APPLY`
und einer zweiten exakten Bestätigung `APPLY` übernommen.

### Rollen und günstige Steuerung

Der Python-Orchestrator übernimmt Dateisuche, Freigaben, Budgets, Sandbox, Prüfungen und
Übernahme. Er arbeitet seriell und startet keine zusätzlichen Agenten innerhalb eines Workers.
Die Rollen werden durch gezielte Codex-CLI-Aufrufe umgesetzt:

- **Luna Low:** Koordination und eindeutig begrenzte lokale Umsetzung.
- **Luna Medium:** normale Komponenten- und Designentwicklung.
- **Sol Medium:** komplexe Logik, gekoppelte Zustände sowie bestehende Daten-/Sicherheitsrisiken.
- **Astra Low:** Technical Lead bei begründeter Eskalation; analysiert und delegiert konkrete
  Aufgaben an Luna/Sol, schreibt selbst keine Projektdateien.

Zuerst läuft eine lokale deterministische Suche. Ein kurzer Änderungswunsch mit genau
einem vorhandenen `src/`-Pfad oder einem eindeutigen Text kann direkt an Luna
Low gehen, beispielsweise `Entferne "Beispieltext"` oder `Hover in src/refinement.css sanfter`.
Auch `Entferne … den folgenden Text vollständig: … Erhalte …` wird lokal erkannt.
Die Textsuche prüft vollständige erfasste `src/`-Quelldateien (TS/TSX, CSS, JSON, Markdown),
vereinheitlicht Leerzeichen, Zeilenumbrüche und `<br>` und verlangt genau ein Vorkommen.
Statische `t("Schlüssel")`-/`tr("Schlüssel")`-Aufrufe aus `src/I18n.tsx` werden lokal
mit `src/translations.json` verbunden. Auch mehrere übersetzte Sätze innerhalb
eines zusammenhängenden JSX-Textbereichs (einschließlich `<br />`) werden erkannt.
So führt `Entferne „Die Orte, an die wir reisen. Und die Gefühle, die sie in uns wecken.“`
direkt zur verwendenden Komponente `src/Public.tsx`; der Katalog dient nur als
Lesekontext und erhält keine Schreibfreigabe. Mehrere Komponenten oder Vorkommen,
getrennte JSX-Bereiche, dynamische Ausdrücke und nicht unterstützte Aufrufsyntax
erhalten keinen automatischen Direktplan. Die Auflösung ersetzt keinen JSX-Parser.
Sie ist auf 2 MB je Datei und 8 MB insgesamt begrenzt; bei unvollständiger Suche,
mehreren Treffern oder unklarer Formulierung bleibt die begrenzte Planung zuständig.
Die direkte Aufgabe durchläuft dieselbe EXECUTE-Dateifreigabe, isolierte Ausführung,
Frontendtests, Build, Vorschau und ausdrückliche APPLY-Bestätigung wie geplante Aufgaben.
Risikoregeln haben Vorrang. Sonst plant Luna Low anhand begrenzter Ausschnitte.
Unveränderte Quelldateien werden innerhalb der Sitzung anhand ihres Inhalts-Hashes
wiederverwendet; identische Planungseingaben können den lokalen Sitzungscache nutzen.

Eine technisch unklare Analyse erhält höchstens **eine** gezielte Luna-Nachanalyse mit
zusätzlichen lokal gesuchten Ausschnitten. Bleibt sie unklar, prüft Astra. Astra wird
außerdem bei Architektur-/weitreichenden Entscheidungen, zwei Fehlern derselben Aufgabe,
einem blockierten Worker bzw. `needs_sol` und beim zweiten ausdrücklich negativen
Feedback hinzugezogen. Normale Verfeinerungen wie „etwas langsamer“ zählen nicht negativ.
Die Erkennung negativer Formulierungen ist eine lokale Heuristik, kein semantischer Beweis;
klare Formulierungen wie „immer noch falsch“ werden erkannt.

Der Eskalationsbericht enthält das ursprüngliche Nutzerziel, aktuellen Wunsch, relevante
Dateiausschnitte, Regeln, bestätigtes Gedächtnis, gekürzte Lösungs-/Feedbackberichte
und konkrete offene Fragen. Im Modellkontext stehen nur die letzten zwei Runden mit
je höchstens zwei Versuchen, gekürzten Wünschen/Berichten (500 Zeichen) und
Ergebnistexten (400 Zeichen). Die Nachanalyse ersetzt die Quellausschnitte, statt
den ersten Kontext um einen zweiten vollständigen Suchkontext zu erweitern.
Gründe, Bericht und Delegation liegen unter
`planning-*/report.json`. Astra entscheidet keine fehlenden Produktanforderungen durch
Raten: verbleibendes `unclear` oder eine offene `architecture`-Entscheidung stoppt vor
jeder Schreibfreigabe. Eine Worker-Fehlerrunde erhält höchstens **eine** automatische
Astra-Delegation mit abschließendem Umsetzungsversuch. Je Aufgabe bleibt höchstens ein
explizit vom Worker angeforderter Reparaturversuch erlaubt; keine unendlichen Schleifen.

`EXECUTE` bestätigt erstmals die konkreten Zieldateien im isolierten Entwurf. Neue
Zieldateien benötigen eine weitere Freigabe. Agenten können diese Berechtigung nicht
erteilen oder erweitern. Manuelle CLI-Modi behalten ihre bisherigen strengeren
Architektursperren und Bestätigungen; die neue Teamkoordination gilt für `--interactive`.

### Browser, Feedback und Befehle

Nach jeder erfolgreichen Umsetzung laufen Tests und Build in einer separaten Prüfkopie.
**Vite Preview mit dem geprüften Produktionsbuild** bindet streng an `127.0.0.1` und einen
freien Port ungleich 5173. Der bestehende Vite-Server bleibt unberührt. Vor Feedback stoppt
nur der Vorschauprozess dieser Sitzung; anschließend erscheint die neue URL. Es gibt kein
HMR und **keinen Backendproxy**. Login, Datenbank, Upload und datenabhängige Ansichten sind
dort nicht vollständig prüfbar. Es wird kein Backend gestartet und keine Originaldatenbank
oder Medien kopiert. Browserprüfung bleibt manuell.

| Eingabe | Wirkung |
| --- | --- |
| Natürlicher Wunsch | Erste Aufgabe oder Feedback am selben Entwurf |
| `MULTILINE` | Mehrzeilige Eingabe beginnen; nur eine eigene Zeile `/SEND` sendet den gesamten Text als einen Auftrag |
| `/CANCEL` innerhalb MULTILINE | Gesamte Eingabe verwerfen; andere Befehle innerhalb des Blocks sind Text |
| `REMEMBER Kategorie ∣ Aussage ∣ Beleg` | Ausdrücklich bestätigten Gedächtniseintrag lokal im Entwurf ergänzen; im Terminal gewöhnliche senkrechte Striche `|` verwenden |
| `HELP` / `STATUS` | Befehle bzw. Entwurf, Modelle, Tests, getrennte Budgets, URL und Protokollpfad |
| `DIFF` | Geprüfte Änderungen gegenüber dem ursprünglichen Projektstand |
| `APPLY` | Integrität prüfen, Diff zeigen; erst zweite exakte Eingabe `APPLY` übernimmt Dateien und beendet Sitzung |
| `DISCARD` | Vorschau stoppen, Entwurfskopien löschen, Apply-Bericht ungültig machen; neue Aufgabe möglich |
| `EXIT` / `QUIT` | Ohne Übernahme beenden; Entwurf/Protokolle bleiben zum Review erhalten |
| Strg+D / Strg+C | Abbruch ohne automatische Übernahme; Vorschau wird beendet |
| `EXECUTE` | Nur bei Dateifreigabe; andere Antworten lehnen die Ausführung ab |

Befehle sind unabhängig von Groß-/Kleinschreibung; die Freigaben `EXECUTE`, `APPLY`
und Blockabschluss `/SEND` sind exakt. Für mehrzeiliges Einfügen zuerst `MULTILINE`
eingeben. Maximal 12.000 Zeichen je Wunsch; übergroße Blöcke werden bis `/SEND` oder
`/CANCEL` verworfen, damit Restzeilen keine Folgeaufträge auslösen.

### Aufgaben- und Sitzungsbudgets, Fehlerbehandlung

```sh
python3 -B scripts/orchestrator.py --interactive --max-tokens 20000 --session-tokens 120000 --session-calls 40 --worker-calls 8 --max-calls 2 --timeout 600
```

`--max-tokens` gilt in der interaktiven Sitzung **je Nutzerauftrag**, gemeinsam für
Planung, Astra und Umsetzung einschließlich automatischer Wiederaufnahme. Ein neuer
Wunsch erhält ein neues Aufgabenbudget, sofern die Sitzung nicht nach einer
Worker-Budgetüberschreitung gesperrt ist. `--max-calls` begrenzt Luna-Planung (1–2),
zusätzlich höchstens ein Astra-Aufruf je Planung; `--worker-calls` begrenzt alle
Coding-Aufrufe des Nutzerauftrags einschließlich Reparatur/Delegation (1–16).

`--session-tokens` und `--session-calls` begrenzen die gesamte Sitzung, auch nach
Fehlern oder DISCARD. Standard: 120.000 beobachtete Token und 40 Modellaufrufe.
Ein einzelner Analyseaufruf mit beispielsweise 20.360 Token beendet beim Standardbudget
weitere Modellarbeit dieses Auftrags, sperrt aber nicht die Sitzung, solange das
Gesamtbudget reicht. Bei echtem Gesamtlimit sind weitere Modellaufrufe gesperrt;
STATUS, DIFF, APPLY eines zuvor geprüften Stands und DISCARD bleiben möglich.
Unbekannte Usage stoppt sicher weitere Modellaufrufe der Sitzung. Die Limits sind
Zulassungsprüfungen **zwischen** Aufrufen: ein laufender Aufruf kann sie überschreiten.
Es gibt kein garantiertes hartes Kostenlimit und keine unbelegte Preisschätzung.

Überschreitet ein Worker ein Aufgaben- oder Sitzungsbudget, starten in dieser Sitzung
keine weiteren Modelle, auch keine Reparatur, Folgeaufgabe oder Astra-Eskalation.
Die Sperre bleibt nach DISCARD erhalten; neue Modellarbeit erfordert einen neuen
CLI-Start. Nur bei Exitcode 0, gültigem `complete`, tatsächlicher freigegebener Änderung
und bestandenen Integritäts-/Sandboxkontrollen prüft Python den Kandidaten noch lokal
mit Tests und Produktionsbuild. Erfolgreiche Ergebnisse erhalten den Status
`budget_exceeded_manual_review` (Anzeige: „budgetüberschritten, manuell prüfbar“).
Bei mehreren Planaufgaben endet der Lauf nach dieser lokal geprüften Aufgabe;
`completed_tasks` und `pending_tasks` kennzeichnen den tatsächlich erreichten Umfang.
DIFF und das explizit bestätigte APPLY bleiben mit denselben Hash-, Originalstand-,
Dateifreigabe- und Manipulationskontrollen möglich. Es gibt keine automatische Übernahme.
Ohne erfolgreichen Abschluss oder bei fehlgeschlagenen Tests wird der vorherige Stand
wiederhergestellt; unsichere Änderungen sperren den Entwurf weiterhin vollständig.

Gewöhnliche Worker-/Prozessfehler und fehlgeschlagene Tests stellen den letzten
geprüften Stand samt Apply-Bericht wieder her. Ein neuer Wunsch ist bei verbleibendem
Budget möglich. Fehlerrunden bleiben in `round-*.json` und Prozesslogs nachvollziehbar.
Unerlaubte Dateien, veränderte Testquellen, Symlinks oder Änderungen am Original sind
Integritätsfehler und sperren weiterhin den Entwurf: DISCARD oder EXIT verwenden.
Eine sichere Rücksetzung kann niemals ungeprüfte Änderungen zur Übernahme freigeben.

### Kompaktes Projektgedächtnis

`AGENTS.md` und `ARCHITECTURE.md` bleiben die primären Regeln. Ergänzend enthält
`PROJECT_MEMORY.json` höchstens 24 knappe Einträge zu `architecture`, `design`, `solution`,
`error` oder `preference`. Die Datei gehört in die Versionskontrolle; wie alle
Projektquellen muss sie für spätere Sitzungen Git-erfasst sein. Sie startet leer.

Beispiel (die Eingabe selbst bestätigt Aussage und Beleg ausdrücklich):

```text
REMEMBER preference | Bei Karten weniger Schatten verwenden | Vom Nutzer mit dieser Eingabe ausdrücklich bestätigt
```

Der Befehl ergänzt den Eintrag deterministisch ohne Modellaufruf, verlangt dieselbe
Dateifreigabe und Prüfungen wie jede Änderung und wird erst durch APPLY dauerhaft.
Modelle dürfen diese Datei nicht ändern, auch nicht im manuellen Worker-Modus. Nur
Einträge mit Kategorie, kurzer Aussage, Beleg und `confirmed_by: user` werden geladen.
Der Orchestrator kann die Wahrheit eines Nutzerbelegs nicht eigenständig beweisen;
`REMEMBER` ist die ausdrückliche menschliche Bestätigung. Kein automatisches Lernen aus
KI-Aussagen oder Gesprächsprotokollen. Bei voller Datei manuell konsolidieren. Technische
Fehlerrunden bleiben lokale Laufzeitberichte und werden nicht automatisch zu Projektwissen.

Protokolle liegen unter `artifacts/orchestrator/<Sitzungs-ID>/` und können Aufgabentexte
und Quellausschnitte enthalten. Kein automatisches Wiederaufnehmen beendeter Sitzungen.
Original, Entwurf, Prüfquellen und Apply-Bericht werden vor Weiterarbeit/Übernahme sowie
nach der Bestätigung erneut geprüft. Ein Lock verhindert parallele echte Läufe.
Hash-/Pfadkontrollen ergänzen die CLI-Sandbox; sie ersetzen keine Betriebssystemisolation
gegen bösartige Prozesse mit denselben Rechten. Apply kopiert Dateien einzeln und ist
keine dateiübergreifende Transaktion. Keine Commits, Pushes, Installationen oder Deployments.

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
weiterer Modellaufruf zugelassen. Ein bereits erfolgreich abgeschlossener Coding-Aufruf
darf nach der Überschreitung ausschließlich noch lokal geprüft werden (siehe oben).
Unvollständige oder unsichere Ergebnisse werden nicht zur Übernahme freigegeben.
`budget_scopes` zeigt Worker-, Aufgaben- und Sitzungswerte getrennt; eine Überschreitung
des Aufgabenbudgets bleibt sichtbar, auch wenn das Sitzungsbudget noch ausreicht.
`model_calls_stopped` kennzeichnet die zusätzliche Sitzungssperre.
**Ein einzelner Aufruf
kann das Budget überschreiten. Es gibt keine garantierte harte Token- oder Kostengrenze.**
Der Bericht zeigt `over_budget`, `overrun_tokens`, `limit_reached`, `hard_cost_limit: false`,
Aufrufzahlen sowie Input-, Cache-, ungecachte Input-, Output-, Total- und Reasoning-Token
pro Aufruf. Fehlende Werte bleiben `unknown`. Eine Preis-/Euro-Schätzung erfolgt nicht.

Der Worker-Lauf `20261101-150813-session-5b234976` hatte einen gültigen `complete`-Abschluss,
aber 65.888 Input- und 404 Output-Token (= 66.292, darin 40.064 gecachte Input-Token).
Ein Toolaufruf las AGENTS.md, ARCHITECTURE.md, TASKS.md, Public.tsx, den vollständigen
Übersetzungskatalog und I18n.tsx. Die Budgetprüfung lief vor der Ergebnisauswertung und
verwarf deshalb auch die erfolgreiche Änderung. Es gab einen Worker-Aufruf; die Logs
belegen keine doppelte Zählung. CLI-Grundkontext und wiederverarbeitete Toolkontexte
lassen sich aus den aggregierten Nutzungswerten nicht getrennt beziffern.

Für lokale Aufgaben in genau einer Datei ohne zusätzliche Lesepfade übergibt Python
jetzt die lokalisierte Evidenz: Zielpfad, Zeilennummern, maximal 6.000 Zeichen um den
Treffer sowie tatsächlich verwendete Übersetzungsschlüssel und Werte (gesamte Evidenz
maximal 10.000 Zeichen). Bereits lokal gelesene Quellen werden über ihre Hashes gecacht.
Der Worker erhält die verbindlichen AGENTS-/Architekturregeln einmal im Prompt
(einschließlich zutreffender untergeordneter AGENTS.md, insgesamt maximal 16.000 Zeichen)
und nur ausdrücklich referenzierte TASKS-Einträge. `--ignore-rules` verhindert zusätzliche
automatische Regelkontexte; der Prompt untersagt redundante Dateiabrufe, breite
Projektanalyse, vollständige Kataloge und große Logs. Nur gezielte Nachbarzeilen der
Zieldatei dürfen bei Bedarf gelesen werden; fehlender Kontext bedeutet `blocked`.
Diese Lesevorgabe ist eine Promptbegrenzung, keine zusätzliche Dateilesesandbox.
Die vorhandene Schreibsandbox bleibt aktiv. Frische ephemere CLI-Aufrufe übernehmen
keine alten Codex-Threads; Tests und Build bleiben zentral in Python. `calls[].context`
protokolliert Promptzeichenzahl, lokalen Kontextmodus und Lesebereich. Zeichen sind
keine gemessenen Token; nur CLI-Nutzungsereignisse zählen zum Tokenbudget.

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
Die Budgetregressionen prüfen den begrenzten Kontext bei realen WANDER-Übersetzungsschlüsseln,
lokales Review nach erfolgreichem Budgetüberlauf, Abbruch bei unerlaubten Dateien,
fehlenden/ungültigen Abschlüssen und fehlschlagenden Tests sowie unveränderte APPLY-,
Hash-, Sandbox- und Dateifreigabekontrollen. Mock-Tokenwerte belegen die Budgetlogik,
keine reale Verbrauchsprognose. Produktionsprüfung zusätzlich: `npm run build`.

CLI-Referenz: [Offizielle OpenAI-Dokumentation](https://learn.chatgpt.com/docs/developer-commands).
Die verwendeten Flags wurden zusätzlich mit der installierten `codex exec --help`
geprüft. Verfügbarkeit der Modellnamen hängt von der lokalen Codex-Anmeldung ab;
ein nicht verfügbares Modell stoppt den Lauf, ohne automatischen Ersatz.

Modell-IDs: [Offizielle Modellübersicht](https://developers.openai.com/api/docs/models).
CLI 0.166.0 wurde lokal über `codex --help` und `codex exec --help` geprüft;
der Auto-Modus prüft benötigte Exec-Flags vor echten Planungsaufrufen erneut.
