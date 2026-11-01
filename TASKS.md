# Entwicklungsaufgaben

### B04 — Sichere Arbeitsgrundlage vor W04 prüfen (01.11.2026)
- Auftrag/Scope: vollständigen Gitstatus und vorhandene Worktrees prüfen, W01–W03 gegen Übernahmenachweise abgleichen, notwendige Code-/Design-/Planungs-/Workflowdateien von historischer Orchestratorarbeit und lokalen Artefakten trennen; genauen lokalen Basis-Commit vorschlagen. W04 nicht beginnen.
- Abnahme: Frontendtests und Build des aktuellen Checkouts sowie einer temporären Quellkopie mit ausschließlich dem vorgeschlagenen Basisumfang; bestehende Dateien erhalten, keine Anwendungsänderung, kein Commit/Push/Deployment, keine Produktdaten oder Secrets kopieren.
- Ausgangspunkt: Originalcheckout `/Users/ericwilts/Documents/WANDER`, Branch `feature/agent-orchestration`, HEAD `c2b54b34e22310ebae92d984ec33e7ee87ed2156`; 17 geänderte versionierte und 13 unversionierte Dateien, Index leer, keine Konflikte. Keine angehängten Worktrees; vier weitere Git-Worktrees vorhanden und unverändert belassen.
- Empfohlener Basisumfang (20 Dateien): `src/StoryExperience.tsx`, `src/styles.css`, `src/journalModel.ts`, `tests/surface-colors.test.ts`, `TASKS.md`, `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, `.codex/config.toml`, `docs/DEVELOPMENT.md`, `PROJECT_OVERVIEW.md`, `PRODUCT_AUDIT.md`, `DESIGN_GUIDELINES.md`, `DEVELOPMENT_PLAN.md`, `AGENT_TASKS.md`, sowie die fünf PNG-Dateien in `docs/audit-2026-11-01/`. Historische Änderungen an zehn `scripts/`-Dateien bleiben separat uncommitted erhalten; lokale Daten, Abhängigkeiten, Buildausgaben und Artefakte gehören nicht in diesen Commit.
- Nachweise: Original und temporäre Quellkopie `/private/tmp/wander-w04-baseline-kp5lk9k0` (HEAD-Archiv plus genau diese 20 Dateien, lokale node_modules wiederverwendet) bestehen jeweils 31/31 Frontendtests und Produktionsbuild. JS-/CSS-Builddateien stimmen bytegleich überein. W01/W02-Gitblobhashes und W03-SHA-256 stimmen mit den dokumentierten Übernahmen überein; alle vier Anwendungs-/Testdateien sind bytegleich zum W03-Draft. Lokale Markdownlinks und `git diff --check` erfolgreich. Keine neue Browser-, Backend- oder Orchestratorprüfung; frühere Prüfungen bleiben historische Nachweise. Nur dieser TASKS-Eintrag wurde geändert, vorhandene git-sichtbare Dateien sonst hashgleich erhalten. Buildausgaben wurden regulär erneuert.
- Status: Vorbereitung abgeschlossen, kein Basis-Commit und kein neuer W04-Worktree angelegt; beide benötigen einen gesonderten ausdrücklichen Auftrag. Technisch vollständiger aktueller Anwendungs-/Planungsstand ist von sämtlichen ungesicherten historischen Werkzeugänderungen zu unterscheiden. Für einen wortwörtlich vollständigen Checkout-Snapshot müssten die zehn historischen scripts-Dateien separat geprüft/freigegeben und ebenfalls gesichert werden. Designrichtung/Zielpublikum/Referenzmotive bleiben vor dem W04-Start ausdrücklich zu bestätigen.

### W03 — Automatische Schriftfarbe nach Kontrast wählen (01.11.2026)
- Status / Modell: lokal übernommen nach ausdrücklicher Nutzerfreigabe / **GPT-6 Luna, medium**. Voraussetzung W02 geprüft und im Original übernommen.
- Draft: `/Users/ericwilts/.codex/worktrees/w03-contrast/WANDER`, Branch `codex/w03-contrast`, Ausgangsrevision `c2b54b34e22310ebae92d984ec33e7ee87ed2156`.
- Basis früherer übernommener Aufträge im Draft: W01 entfernt den Hookaufruf aus `src/StoryExperience.tsx` (SHA-1 `823ddbdcb2237726803aadd20e25f03b327885bf`); W02 ändert die mobile Titelregel in `src/styles.css` (SHA-1 `2733a536cdd5da4c6f7664e15b7d839e914e5bb0`). Beide gezielten Deltas stimmen mit dem Original überein und wurden nicht erneut übertragen.
- W03-Dateien (SHA-256): `src/journalModel.ts` `0673d059754012346e299ad5cf20e29f4b57a80e2489563abda470b7ce270186`; `tests/surface-colors.test.ts` `93ca829f659a31bbc9630cd87df218662b5af590e2b25cf8bf84e2782e68cd8f`.
- Scope W03: `src/journalModel.ts` (`surfaceColors` und reine Kontrasthilfe), neu `tests/surface-colors.test.ts` und dieser Eintrag. Keine Änderungen an Canvas, Editor, expliziten Benutzerfarben, Backend oder Schema.
- Ziel/Abnahme: Für erlaubte `#rgb`- und `#rrggbb`-Hintergründe automatische Schrift mit mindestens 4,5:1; Markenfarbe bevorzugen, wenn sie besteht, danach zweite Markenfarbe und erforderlichenfalls Schwarz/Weiß. Quiet Atlas und After Hours bleiben visuell unverändert.
- Kontrastpaare: Quiet Atlas `#26302B` auf `#ECEDEB` = 11.610:1; After Hours `#F2F3EF` auf `#20241F` = 14.129:1; bei `#949494` bleibt keine Markenfarbe ausreichend (`#26302B` = 4.495073:1, `#F2F3EF` = 2.721757:1), daher Schwarz = 6.922765:1. Weitere geprüfte Flächen: Schwarz/Weiß, `#704214` und `#3498DB`.
- Prüfungen im Draft: Frontendtests 31/31; Produktionsbuild und `git diff --check` erfolgreich. Isolierte Vite-/Backendvorschau `http://127.0.0.1:5181`; im W03-eigenen `.instance`-Testbestand `#949494` gesetzt und gespeichert. Editor-iframe und öffentliche Story zeigten dunkle Textfarbe auf Grau. Öffentliche Beispiele Quiet Atlas/After Hours in DE/EN geprüft; Screenshots visuell im Browser kontrolliert, nicht als Dateien gespeichert. Unabhängiger Luna/medium-Review: keine Findings.
- Prüfungen nach Übernahme im Original-Checkout: Frontendtests 31/31; Produktionsbuild und `git diff --check` erfolgreich.
- Übernahme: ausschließlich `src/journalModel.ts`, `tests/surface-colors.test.ts` und dieser W03-Eintrag aus dem geprüften Draft übertragen. Keine Commits, Pushes oder Deployments.

### W02 — Mobile Archivtitel vollständig lesbar machen (01.11.2026)
- Status / Modell: übernommen / **GPT-6 Luna, low**. Voraussetzung W01 geprüft und übernommen.
- Draft: `/Users/ericwilts/.codex/worktrees/w02-archive-title/WANDER`, Ausgangscommit `c2b54b34e22310ebae92d984ec33e7ee87ed2156`; geprüft im detached HEAD.
- Scope: ausschließlich mobile `.archive-heading h1`-Regel in `src/styles.css` und dieser Eintrag. DE/EN-Texte/Markup unverändert.
- Ziel/Abnahme: Titel passt bei 320/390 px vollständig in den Inhaltsbereich; 768/1280 px und Desktopmaßstab bleiben erhalten. Serif, Kursivschrift und Hierarchie bleiben bestehen; kein Abschneiden oder horizontales Seitenoverflow. Magazin/Indexwechsel und Sortierung unverändert bedienbar.
- Lösung: mobiler Festwert 77 px durch `clamp(42px, 15vw, 60px)` ersetzt; lokales `overflow-wrap: anywhere` schützt lange untrennbare Inhalte.
- Checks im Draft: `npm run test:frontend` 26/26; `npm run build` erfolgreich; `git diff --check` erfolgreich. Im nativen Chrome unter `http://127.0.0.1:5175/archive` DE/EN bei 320/390/768/1280 px gemessen: Dokumentbreite entspricht Viewport, H1 `clientWidth` entspricht `scrollWidth` (320: 276 px, 390: 346 px, 768: 703 px, 1280: 1172 px). Schriftgrößen: 48/58.5/80/115.2 px. Bei 200 % Browserzoom und 320 px blieb DE/EN vollständig sichtbar; Umbruch nur zwischen Wörtern. Magazin→Index wechselte wie erwartet; Sortieroption „Älteste zuerst“ wurde auswählbar. Der Bestand enthält eine Reise, daher war keine sichtbare Änderung der Kartenreihenfolge möglich. Kein Screenshot als Datei gespeichert; Screenshot und Messungen im Browser geprüft.
- Übernahme: ausschließlich der geprüfte CSS-Hunk und dieser W02-Status in den Original-Checkout übertragen. Keine Commits, Pushes oder Deployments.

### W01 — Manuelle Bildreihe ohne automatische Verschiebung (01.11.2026)
- Status / Modell: übernommen / **GPT-6 Luna, low**. Voraussetzung: Auditbefund A01 bestätigt.
- Draft: `/Users/ericwilts/.codex/worktrees/w01/WANDER`, Branch `codex/w01`, Ausgangscommit `c2b54b34e22310ebae92d984ec33e7ee87ed2156`. Übernahme nach ausdrücklicher Freigabe; übrige ungesicherte Originaländerungen erhalten.
- Scope: nur `PhotoRail` und `useRailHint`-Import in `src/StoryExperience.tsx`, plus dieser Eintrag. `src/useRailHint.ts` nur gelesen und nicht gelöscht.
- Ergebnis: Hookimport und Hookaufruf aus `PhotoRail` entfernt. Mausziehen, Touchverhalten, Tastatur, Klickunterdrückung nach Drag, angeschnittenes Folgebild, freie Zwischenpositionen und getrennt laufender Filmstrip unverändert.
- Checks: Frontendtests 26/26 und Produktionsbuild erfolgreich. Isolierte Vite-Vorschau `/inspiration/after-hours`; Desktop DE sowie Mobil EN geprüft. Mobil: erste Sichtbarkeit nach vertikalem Eintritt blieb visuell unverändert; manuelle Drag-Zwischenposition blieb nach vertikalem Weg-/Zurückscrollen erhalten; Home/End/Pfeile, Bildöffnung, Escape-Rückkehr und Bewegung aus geprüft. Browser bot keine direkte DOM-Messung von `scrollLeft`; kein echtes Mobilgerät/Touchgerät. `git diff --check` erfolgreich.
- Übernahme: nur W01-Diff integriert; keine Commits, Pushes oder Deployments.

### P2 — Abschließende strategische Qualitätsprüfung (01.11.2026)
- Auftrag: bestehende fünf Auditdokumente kritisch auf Premium-Ambition, Designkonkretion, Abhängigkeiten, Modellkosten und ausführbare Worker-Prompts prüfen; kein erneutes Repository-Audit.
- Scope: gezielte Verbesserungen in `DEVELOPMENT_PLAN.md`, `DESIGN_GUIDELINES.md`, `AGENT_TASKS.md`; diesen Auftrag in `TASKS.md` dokumentieren. Ausgangsaudit und Projektübersicht als Evidenz erhalten.
- Ausgangspunkt: Originalcheckout `/Users/ericwilts/Documents/WANDER`, HEAD `c2b54b34e22310ebae92d984ec33e7ee87ed2156`; vorhandene ungesicherte Dateien erhalten. Reine Dokumentarbeit, kein Anwendungsentwurf.
- Akzeptanz: konsistente 13 Einzelaufträge, begründete visuelle Verbesserungen und klare Zuständigkeiten, belastbare Freigaben/Abhängigkeiten, risikoangemessene Modelle; Umsetzungsreife, erster Auftrag, Restrisiken und Nutzerentscheidungen benennen.
- Prüfung: Dokumentkonsistenz, lokale Verweise, Task-/Modellzuordnung und Änderungsumfang; keine neuen Laufzeitbehauptungen. Keine Subagenten, Anwendungscodeänderungen, Commits oder Deployments.
- Status: abgeschlossen. Drei Strategiedokumente gezielt geschärft: verbindliche Bild-/Storyreferenz, Rolloutzuständigkeiten, Zustands-/Routengrenzen, uncommittete Entwurfskette; W02 Luna/low und W13 Luna/medium mit gezielter Sol-Eskalation. 13 Pakete erhalten.
- Nachweise: Aufgaben-/Modellkonsistenz, lokale Links, Markdown/Whitespace und `git diff --check` erfolgreich. Ausgangsaudit/Projektübersicht bytegleich, alte TASKS-Einträge und übrige versionierte Dateien unverändert. Kein neuer Build, Laufzeit- oder Browsernachweis bei dieser reinen Dokumentänderung. Plan schrittweise beauftragbar; zuerst W01, vor W04 Zielpublikum/Designrichtung/Referenzmotive bestätigen.

### P1 — Master-Audit und Premium-Produktstrategie (01.11.2026)
- Aktueller Auftrag: Repository und zentrale Produktpfade selbst prüfen, erreichbare Referenzen untersuchen, ein begründetes Premium-Zielbild und eine kostenoptimierte Umsetzungskette mit eigenständigen Worker-Prompts erstellen. Keine anderen offenen Aufgaben starten.
- Umfang: neue `PROJECT_OVERVIEW.md`, `DESIGN_GUIDELINES.md`, `PRODUCT_AUDIT.md`, `DEVELOPMENT_PLAN.md`, `AGENT_TASKS.md`; nur diesen Auftrag in `TASKS.md` ergänzen. Anwendungscode, Daten, Abhängigkeiten und bestehende ungesicherte Änderungen bleiben erhalten.
- Ausgangspunkt: `/Users/ericwilts/Documents/WANDER`, `feature/agent-orchestration`, Commit `c2b54b34e22310ebae92d984ec33e7ee87ed2156`, vorhandene ungesicherte Workflow-/Orchestrator-Dokumentation; keine angehängten Worktrees. Reines Dokumentationsaudit im aktuellen Checkout; für spätere Anwendungsänderungen gilt die Worktree-/Freigaberegel.
- Akzeptanz: nachgewiesene Fehler, Risiken, subjektive Urteile und ungeprüfte Punkte unterscheiden; Referenzmatrix, gewichtete Qualitätsmatrix, Motion-System, priorisierte Phasen mit Gates und vollständig ausführbare Aufgabenprompts liefern; keine vorgetäuschte 9/10 oder Browserabdeckung.
- Prüfungen: vorhandene Frontend-/Backendtests und Build; Browser mit isolierten Wegwerfdaten, soweit sicher möglich; Dokumentpfade, Aufgabenabhängigkeiten, Scope und Git-Diff prüfen. Kein Commit, Push, Deployment oder Implementierungsversuch.
- Status: Audit abgeschlossen; alle fünf Dokumente und fünf Browserbelege erstellt. Vorläufiger gewichteter Istwert 7,23 ≈ 7,2/10; Zielprofil 9,08, keine zugesicherte Zielerreichung. 13 sequenzielle Worker-Aufträge plus zurückgestellter Architekturauftrag, technische Gates und vier gestalterische Reviews definiert. Keine Umsetzung gestartet.
- Nachweise: sichere Quellkopie unter `/private/tmp/wander-master-audit-20261101`, eigene Demo-/Wegwerfdaten; 26 Frontendtests, 77 Backendtests und Produktionsbuild erfolgreich. Zentrale Desktop-/Mobilpfade sowie sechs Referenzseiten im nativen Browser geprüft; Grenzen und Bildausschnitte in `PRODUCT_AUDIT.md`. Nachgewiesen: automatische 36-px-Bewegung der manuellen Reihe, mobiler Archivtitelüberlauf, unzureichender automatischer Kontrast bei mittlerem Grau. Echte Geräte, Screenreader, vollständige Fehler-/Recovery-/Publish-Browserfälle und Laufzeitperformance bleiben offen. Dokument-/Pfad-/Diffprüfung abgeschlossen; bestehende Anwendungs- und Workflowdateien unverändert erhalten.
- Ergebnisdateien: `PROJECT_OVERVIEW.md`, `DESIGN_GUIDELINES.md`, `PRODUCT_AUDIT.md`, `DEVELOPMENT_PLAN.md`, `AGENT_TASKS.md`; Belege in `docs/audit-2026-11-01/`. Ältere Statusangaben unten bleiben historisch; insbesondere T7 nicht nochmals beauftragen, der Validator ist bereits implementiert.

### N1 — Nativer Codex-Entwicklungsworkflow (01.11.2026)
- Auftrag: bestehende Struktur und installierte Codex-Funktionen prüfen; kostensparende native Delegation, Browserfeedback und ausdrückliche Übernahmefreigabe einrichten. Keine Produktaufgabe T7/A1 starten.
- Dateien: `AGENTS.md`, `.codex/config.toml`, `docs/DEVELOPMENT.md`, Einstieg in `README.md` und historischer Hinweis in `ARCHITECTURE.md`. Anwendungscode und vorhandene Orchestrator-Arbeit erhalten.
- Status: Konfiguration eingerichtet; Validierung siehe `docs/DEVELOPMENT.md`. Kein echter Subagent für Probeaufgaben, kein Commit/Push/Deployment.
- Akzeptanz: Luna als günstiger Standard, Sol für komplexe Implementierung, Astra nur bei begründeter Eskalation; ein Worker gleichzeitig; isolierter Entwurf → Checks/Review → Browserfeedback → ausdrückliche Freigabe → lokale Übernahme. Grenzen der Freigabe und Modellwahl offen dokumentieren.

Planungsstand: 31.10.2026. Analyse abgeschlossen; nachfolgende Aufgaben sind Vorschläge und **noch nicht umgesetzt**. Empfohlene Reihenfolge: T6 → T4 → T2 → T1 → T3 → T5 → T7; jeweils nur eine Aufgabe beauftragen. Keine neuen Produktfunktionen oder Abhängigkeiten erforderlich.

Ausgangsprüfung: F erfolgreich (6 Tests), Backend erfolgreich (77 Tests), B erfolgreich. Keine Browserprüfung durchgeführt; UI-Befunde stammen aus gezielter Codeinspektion.

**Modelle:** GPT-6 Luna für klar vorgegebene lokale Änderungen, Sol für gekoppelte Zustände, Astra ausschließlich für grundlegende Architekturentscheidungen. Dies ist eine Zuordnung nach Aufgabenrisiko, kein Modellbenchmark.

**Prüfkürzel:** F = `npm run test:frontend`, B = `npm run build`, A = `npm run test:all`. Für UI-Aufgaben zusätzlich die genannten Browserfälle in DE/EN durchführen. Fehlt die Browserumgebung, Prüfung ausdrücklich offen melden. Bei Fehlschlägen nur direkt verursachte Fehler beheben. Tests, die einen bestehenden Defekt zeigen, nicht durch geänderte Erwartungen grün machen.

### T1 — Bibliotheksfehler von leerem Bestand unterscheiden
- Status / Modell: erledigt / **LUNA_MEDIUM**. Unabhängig.
- Dateien: `src/Studio.tsx` (`StudioLibrary`), ggf. `src/translations.json`.
- Befund/Ziel: Nach fehlgeschlagenem Laden erscheinen derzeit Fehler und Erstbenutzer-Leerzustand gleichzeitig. Lade-, Fehler- und Leerzustand eindeutig machen; Wiederholen mit vorhandenen Button-Klassen anbieten.
- Akzeptanz: `load` setzt Fehler zurück und Ladezustand; während Laden kein Leerzustand; nach Fehler keine Aufforderung zur ersten Reise; Wiederholen lädt erneut; erfolgreicher leerer Bestand zeigt bisherigen Leerzustand; bestehende Reisen bleiben unverändert.
- Prüfungen: F, B; Browser: Anfrage `/api/journeys` blockieren → Fehler → freigeben/Wiederholen; zusätzlich leere und gefüllte Bibliothek.

### T2 — Mobile Navigation mit Escape schließen
- Status / Modell: erledigt / **LUNA_MEDIUM**. Unabhängig.
- Dateien: `src/App.tsx` (`Header`).
- Befund/Ziel: Menü besitzt einen Toggle und schließt beim Routenwechsel, aber keinen Escape-Handler. Nur bei offenem Menü Escape behandeln und Fokus zum Toggle zurückgeben; Listener aufräumen.
- Akzeptanz: Escape schließt und fokussiert Toggle; `aria-expanded` stimmt; erneut öffnen und Routenwechsel funktionieren; geschlossene Navigation fängt Escape nicht ab; Styling unverändert.
- Prüfungen: F, B; Browser bei 390 px per Tastatur öffnen/schließen und Link folgen; Desktopnavigation bei 1200 px prüfen.

### T3 — Vorhandene ARIA-Verknüpfungen in Field erhalten
- Status / Modell: erledigt / **LUNA_MEDIUM**. Unabhängig.
- Dateien: `src/components.tsx` (`Field`); Aufrufstellen nur gezielt lesen.
- Befund/Ziel: `cloneElement` überschreibt `aria-labelledby` und `aria-describedby` des Kindes. Vorhandene ID-Token mit generierter Label-/Hint-ID kombinieren, Duplikate entfernen; ohne Hint vorhandene Beschreibung erhalten.
- Akzeptanz: Eigene Control-ID bleibt erhalten; Label ist weiter verknüpft; bestehende Beschreibungen gehen weder mit noch ohne Hint verloren; kein `undefined` im Attribut; bisherige Aufrufer bleiben visuell gleich.
- Prüfungen: F, B; Browser/DOM mit temporären, nicht eingecheckten Beispielen: eigene ARIA-IDs, mit/ohne Hint, ohne eigene ARIA-IDs; Accessibility-Name und -Beschreibung kontrollieren.

### T4 — Regressionstests für Placement-Fallbacks ergänzen
- Status / Modell: erledigt / **LUNA_LOW**. Unabhängig; ausschließlich Tests ändern.
- Dateien: `tests/editor-model.test.ts`; lesen: `src/journalModel.ts`, `src/types.ts`.
- Ziel: Bisher nicht explizit abgesicherte Kompatibilitätsregeln für `placementsFor`, `modulePhotos`, `rootPhotos` festhalten.
- Akzeptanz: Tests belegen: explizit leere Placements unterdrücken Legacy-Zuordnung; fehlende Fotoquelle wird übersprungen; Edits-Priorität Quelle < `photo_edits` < Placement; explizit leerer Filmstrip unterdrückt `filmstrip_ids`. Eingabedaten bleiben unverändert. Wiederverwendung bestehender Fixtures, kein DOM.
- Prüfungen: F, B. Falls Verhalten abweicht, Defekt separat melden; Produktionscode bleibt außerhalb dieser Aufgabe.

### T5 — Regressionstests für Änderungen während Save ergänzen
- Status / Modell: erledigt / **LUNA_MEDIUM**. Unabhängig; ausschließlich Tests ändern.
- Dateien: `tests/editor-model.test.ts`; lesen: `src/journalModel.ts` (`mergeSavedJourney`).
- Ziel: Bestehenden Save-Test um Verlustschutz für Reihenfolge und Löschung erweitern.
- Akzeptanz: Getrennte Fälle: während Save gelöschtes Modul bleibt gelöscht; lokale Umordnung bleibt erhalten; temporäre IDs und Elternreferenzen werden trotzdem korrekt zugeordnet; neu hinzugefügtes Modul bleibt erhalten; Serverflag `has_unpublished_changes` wird übernommen; Eingaben unverändert. Serverantwort folgt dabei der Reihenfolge des abgeschickten Standes.
- Prüfungen: F, B. Keine Änderung am Merge-Verfahren; abweichende Ergebnisse an Sol melden.

### T6 — Späte Ladefehler des Editors ignorieren
- Status / Modell: erledigt / **LUNA_LOW**. Unabhängig.
- Dateien: `src/ModularEditor.tsx`, ausschließlich Lade-Effect mit Abhängigkeit `[slug]`; Referenz: `StoryLoader` in `src/StoryExperience.tsx`.
- Befund/Ziel: Erfolg prüft bereits `alive`, Fehler setzt Zustand ohne Prüfung. Dieselbe `alive`-Prüfung im Fehlerpfad ergänzen; keine weitere Zustandsbereinigung oder Save-Änderung.
- Akzeptanz: Nach Effect-Cleanup darf eine alte abgelehnte Anfrage keinen Fehler setzen; Fehler der aktiven Anfrage werden weiter angezeigt; Erfolgsverhalten unverändert.
- Prüfungen: F, B; Browser: verzögerte fehlschlagende Ladeanfrage, vor Antwort Route verlassen; außerdem aktiven Ladefehler und erfolgreichen Einstieg prüfen.

### T7 — Wiederherstellungsdaten vor Übernahme prüfen
- Status / Modell: offen / **Sol**. Nach T4/T5 empfohlen.
- Dateien: `src/ModularEditor.tsx` (Recovery lesen/übernehmen), neu `src/recoveryModel.ts`, neu `tests/recovery-model.test.ts`; lesen: `src/types.ts`.
- Befund/Ziel: Recovery prüft derzeit nur JSON und Reise-ID. Kleinen reinen Validator für die anschließend benötigten Datenformen einführen; bestehendes Speicherformat und Schlüssel beibehalten. Vor Implementierung Übernahmepfad gezielt prüfen.
- Akzeptanz: `null`, Arrays als Wurzel, falsche ID, fehlende/falsch typisierte Pflichtfelder und unbrauchbare Modul-/Fotolisten werden ignoriert; gültige aktuelle und gültige Legacy-Daten bleiben wiederherstellbar. Keine automatische Servermutation, kein Löschen anderer Reiseentwürfe; kein vollständiges neues Schemasystem. Falls Legacy-Kompatibilität nicht zuverlässig abgrenzbar ist, stoppen und konkrete offene Felder melden.
- Prüfungen: neue Logiktests für gültige/ungültige Daten und Legacy-Optionen, A, B; Browser: gültigen Entwurf wiederherstellen, kaputte Recovery ignorieren, Neuladen ohne Recovery. Nur isolierte Testdaten verwenden.

### A1 — Architekturentscheidung bei neuem Betriebsmodell (zurückgestellt)
- Status / Modell: **nicht starten ohne Produktauftrag / Astra**. Kein aktueller Umbau nötig.
- Auslöser: Mehrbenutzerbetrieb, Cloudhosting oder gleichzeitiges Bearbeiten derselben Reise wird ausdrücklich beauftragt.
- Dateien: neu `docs/adr/001-operating-model.md`, danach `ARCHITECTURE.md`/`TASKS.md`; gezielt lesen: `backend/app.py`, `backend/models.py`, `backend/migrations.py`, `src/api.ts`, Save/Recovery in `src/ModularEditor.tsx`.
- Ziel: Betriebs-, Zugriffs-, Speicher- und Konfliktmodell entscheiden, bevor Sol Implementierungsaufgaben zerlegt.
- Akzeptanz: bestätigte Anforderungen, Alternativen, begründete Entscheidung, Datenmigration/Rückweg und messbare Sicherheits-/Konsistenzanforderungen dokumentiert; keine Implementierung oder Infrastrukturänderung in diesem Auftrag.
- Prüfungen: Entscheidung gegen Auth/CSRF, Medienzugriff, atomare Composition und Veröffentlichungsstände prüfen; bei reiner Dokumentation Pfad-/Konsistenzprüfung, später A/B und konkrete Integrationstests in Folgeaufgaben festlegen.

### O1 — Intelligente Koordination des bestehenden Python-Orchestrators
- Status: umgesetzt; expliziter Nutzerauftrag vom 01.11.2026, unabhängig von T7/A1. Keine Änderungen am Anwendungscode.
- Dateien: `scripts/orchestrator*.py`, zugehörige Offline-Tests, `scripts/README-orchestrator.md`, `PROJECT_MEMORY.json`, Architekturhinweis.
- Umfang: lokale Kontextsuche und Cache, günstiger direkter Worker, begrenzte Nachanalyse/Astra-Delegation, belegtes bestätigtes Gedächtnis, getrennte Aufgaben-/Sitzungsbudgets, MULTILINE und sichere Rücksetzung bei gewöhnlichen Fehlern. Manuelle Modi, isolierte Vorschau, Dateifreigaben und ausdrückliches APPLY erhalten.
- Prüfung erfolgreich: 117 Orchestrator-Tests ohne Modellaufrufe, 26 Frontendtests, 77 Backendtests, Produktionsbuild und Python-Syntaxprüfung. Echte Modellqualität und Browserinteraktion bleiben außerhalb der Offlineprüfung.
