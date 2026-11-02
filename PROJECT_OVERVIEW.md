# WANDER — geprüfte Projektübersicht

Stand: 02.11.2026 (W13 ergänzt; Ausgangsaudit vom 01.11.2026 unten erhalten). Einstieg für spätere Worker; Befunde und Grenzen: [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md), Reihenfolge: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). Diese Übersicht ersetzt weder `AGENTS.md` noch `ARCHITECTURE.md`.

## Geprüfte Ausgangslage

- Original: `/Users/ericwilts/Documents/WANDER`, Branch `feature/agent-orchestration`, HEAD `c2b54b34e22310ebae92d984ec33e7ee87ed2156`.
- Anwendungscode beim Audit unverändert gegenüber HEAD. Bereits vorhandene ungesicherte Workflow-/Orchestrator-Änderungen und `.codex/`/`docs/` wurden erhalten. Keine angehängten oder weiteren Git-Worktrees beim Start.
- Auditkopie: `/private/tmp/wander-master-audit-20261101`. Kopiert wurden nur `src`, `backend`, `public`, `tests` und Build-Konfigurationen; vorhandene Laufzeiten wurden wiederverwendet. Keine Originaldatenbank, Uploadsammlung oder Original-Secrets kopiert.
- Produktionsbuild und beide Testsuiten liefen in dieser Kopie. Browser: `http://127.0.0.1:5184`, ausschließlich Demo-/Wegwerfdaten. Das ist eine temporäre lokale Auditadresse, kein Hosting und kein Anwendungsentwurf zur Übernahme.
- Die fünf neuen Strategiedokumente und der P1-Eintrag sind das Ergebnis dieses Auftrags. Anwendungsänderungen benötigen anschließend einen eigenen isolierten Entwurf und ausdrückliche Übernahmefreigabe.
- Die temporäre Auditvorschau wurde nach der Prüfung beendet; Screenshots bleiben im Repository. Bereits laufende Originalprozesse blieben unangetastet.

## Tatsächliches System

| Schicht | Bestand und Verantwortung |
| --- | --- |
| Frontend | React 19, TypeScript mit `strict`/Unused-Prüfungen, React Router 7, Vite 8; genaue deklarierten Versionen in `package.json`, Auflösung in `package-lock.json` |
| Einstieg | `src/main.tsx`: StrictMode → Sprache → Bewegung → BrowserRouter → App |
| App | `src/App.tsx`: Routen, Authzustand, Benachrichtigungen, Header/Footer, Scroll-Rücksetzung; öffentliche Bereiche direkt geladen, Studioexporte seit W12 über gemeinsame React.lazy-Grenze mit lokalem Lade-/Fehlerzustand |
| Öffentlich | `src/Public.tsx`: Start, Archiv, About; `src/StoryExperience.tsx`: Editionen, StoryLoader, Tagesgalerie, PhotoRail, Filmstrip, PhotoViewer |
| Studio | `src/Studio.tsx`: Guard, Login, Bibliothek; `src/NewJournal.tsx`: Edition und Upload vor dem Editor |
| Gestaltung | `src/ModularEditor.tsx`: lokaler Entwurf, Auswahl, Autosave, Recovery, Veröffentlichung, iframe-Vorschau und UI-Orchestrierung |
| Gemeinsame Darstellung | `src/JournalCanvas.tsx`, `src/PhotoWall.tsx`; öffentliche Reise und Editorvorschau verwenden denselben Renderer |
| Kleine Editorkomponenten | `EditorControls.tsx`, `ModuleSettings.tsx`, `ModulePhotographs.tsx`, `ImageControls.tsx`, `EditorDialogs.tsx`, `Upload.tsx` unter `src/` |
| Reine Datenlogik | `src/journalModel.ts`, `src/recoveryModel.ts`, `src/types.ts`; kleine Bibliotheks-/ARIA-/Menühelfer daneben |
| Motion | `src/Motion.tsx`, `Reveal.tsx`, `revealMath.ts`, `viewport.ts`, `MotionControl.tsx`, `useRailHint.ts` |
| API | `src/api.ts`: `/api`, Same-Origin-Cookies, CSRF, übersetzte Fehler; Upload per XHR mit echtem Übertragungsfortschritt und stabilem Retry-Schlüssel |
| Backend | `backend/app.py`: Flask-Factory, Validierung, Composition, Auth und Medien; `models.py`: SQLAlchemy; SQLite lokal; Pillow für Bildaufbereitung |
| Bestandspflege | `backend/migrations.py`: additive Schemaergänzungen mit vorheriger SQLite-Sicherung; `photo_references.py`: Referenzbereinigung |
| Nebenpfade | `/studio/:slug/setup` verwendet `src/StoryStudio.tsx`. `src/JourneyBuilder.tsx` ist vorhanden, ohne gefundenen Import in `src`; das allein rechtfertigt keine Löschung |

Kein zentraler Store, keine zusätzliche Motion-Bibliothek, keine DOM-Testbibliothek. Kein Mehrbenutzer-/Mandantenmodell: `Admin` besitzt ein Passwort, Reisen haben keinen Kontobesitzer. Die aktuelle Architektur ist ein lokales Produkt für einen Administrator.

## Datenfluss und Invarianten

1. Besucher laden Liste und Story mit `public=1`; eingeloggte Studioansichten laden den aktuellen Entwurf. `JourneyStory` verwendet ausdrücklich den öffentlichen Snapshot.
2. `Journey` besitzt geordnete `Chapter`-Module und zentrale `Photo`-Quellen. `layout.parent_id` bildet genau eine Tages-Unterebene ab; Backendvalidierung verhindert ungültige Eltern.
3. Eine `ImagePlacement.id` identifiziert die Verwendung, `photo_id` die Quelle. Wiederholungen haben eigene Reihenfolge und Zuschnitte. Quelle → Legacy-Modulwerte → Placement ist die Edits-Priorität. Ein explizites leeres Array bleibt leer. Quelldateien werden beim Duplizieren nicht kopiert.
4. Editoränderungen erhöhen eine lokale Revision. Nach 850 ms Eingabepause folgt atomare Composition-Speicherung. Änderungen während eines Requests bleiben über `mergeSavedJourney` erhalten; temporäre negative Modul-IDs werden zugeordnet. Reihenfolgenabbildung basiert auf der Serverreihenfolge des abgeschickten Standes.
5. `PATCH /api/journeys/:id/composition` validiert Reise, Module, Bildreihenfolge und Edits gemeinsam und committed einmal. `publish: true` aktualisiert zusätzlich `published_data`; ein normaler Save ändert die letzte Veröffentlichung nicht.
6. Recovery liegt unter `wander-recovery-<id>` in Local-/SessionStorage. `isRecoveryJourney` prüft Formen und Zyklen vor manueller Übernahme. T7 ist trotz historisch offenem Status bereits implementiert und getestet.
7. Die Vorschau rendert per React-Portal in ein skaliertes iframe: Desktop 1200 × 900, Mobil 390 × 844. Styles, Sprache und Motionzustand werden gespiegelt. Koordinaten/Fokus gehören gegebenenfalls zum iframe-Dokument, nicht zum äußeren Fenster.

## Sensible Grenzen

- Keine Save-/Merge-/Upload-/Recovery-Änderung als Nebenwirkung von Styling. Änderungen dort benötigen Sol und eine unabhängige Prüfung.
- Ein gleichzeitiger zweiter Editor/Tab wird nicht durch eine serverseitige Versionsprüfung abgesichert. Lokale Revisionen schützen Änderungen während eines Requests, aber keine konkurrierenden Clients. Das ist eine Betriebsgrenze, kein durch dieses Audit belegter Datenverlust.
- Authguard ist UI-Komfort; Schreibschutz und Medienprüfung liegen auf dem Server. CSRF, Entwurfsprivatheit und Snapshot-Trennung erhalten.
- Originale werden nach EXIF-Orientierung und Farbraumnormalisierung als verlustfreie Kopie gespeichert; keine bytegleiche Archivierung. Anzeigevarianten: bis 640/1280/2200/3840 px, nicht hochskalieren. Zuschnitte sind Metadaten.
- Keine Original-`.instance`, Uploads, Umgebungsvariablen oder Secrets für Tests anfassen. Die Factory erzeugt `.instance` schon vor Config-Overrides: bloß eine andere Datenbank-URL ist daher keine vollständige Isolation.
- API-Typen sind TS-Verträge; `api<T>` validiert Antworten nicht zur Laufzeit. Backendvalidierung und Recoveryprüfung bleiben die vorhandenen Schutzschichten.

## Gestaltung und CSS

`src/main.tsx` lädt verbindlich: `styles.css` → `builder.css` → `experience.css` → `journal.css` → `refinement.css`. Zusammen rund 9.300 Zeilen CSS, mit wiederholten Selektoren und überschriebenen Basistokens. Vor einer Änderung alle betroffenen Regeln suchen, die Importreihenfolge erhalten und nur den zuständigen Bereich anfassen. Kein präventives CSS-Rewrite.

Instrument Serif/Italic für redaktionelle Akzente, Manrope für UI. Quiet Atlas `#ECEDEB`, After Hours `#20241F`. Lokale Fonts, Lucide-Icons, bestehende `Picture`, `Field`, `Modal` weiterverwenden. Neue UI-Texte über `t`/`tr`, deutsche Übersetzung im Katalog oder zweiten Argument; `useLocale` für reaktive Wahl. Eigene Reiseinhalte bleiben unverändert.

## Verifikation und sichere Wiederholung

W13 auf `89a04da…`: `npm run test:frontend`: 43 reine Logiktests erfolgreich. `npm test`: 77 Backendtests erfolgreich. `npm run build`: TypeScript + Vite erfolgreich. Kein Lint-Script. `tests/` liegt außerhalb des TS-Builds; Node-Testlauf ersetzt dort keinen Typecheck. Browser/Assistenztechnik werden durch die Logiktests nicht abgedeckt.

Für spätere Abnahmen:

1. Gitstatus/Artefakte lesen; geeigneten verwalteten Worktree mit `codex/`-Branch wiederverwenden/erstellen. Benötigte ungesicherte Änderungen fehlen im Worktree? Abhängigkeit melden; keine Sicherungscommits erfinden.
2. Aus diesem Entwurf die vorhandenen Checks ausführen. Für schreibende Browserfälle nur `backend/` und `public/` in ein neues temporäres Verzeichnis kopieren. Dort die vorhandene Factory mit `TESTING=True`, eigener temporärer SQLite-Datei, eigenem Uploadpfad und `SEED_DEMO=True` aufrufen; dort ausschließlich ein Wegwerf-Testkonto erzeugen. Keine Original-`.instance` verknüpfen.
3. Vite aus dem Entwurf auf einem freien Loopback-Port starten. `/api` und `/media` müssen auf das Wegwerfbackend zeigen; die bestehende Standardkonfiguration zeigt auf 5001 und reicht dafür nicht. Ohne Umgebungsvariablenänderung eine temporäre Vite-Konfiguration außerhalb des Repos mit explizitem Draft-Root und Proxy verwenden; keine Projektkonfiguration überschreiben. Falls das Werkzeug dies nicht sicher ermöglicht, schreibende Browserfälle als offen melden.
4. Mit Backend-ROOT, Prozessarbeitsverzeichnis und `/api/health`/Demo-Inhalt den tatsächlich verwendeten Entwurf und Testbestand nachweisen. Keine Annahme, dass ein Worktree allein Daten isoliert.
5. Zu prüfende Inhalte: beide Editionen, 0/1/20 Reisen, lange DE-/EN-Titel, Hoch-/Querformate, wiederholte Quellen mit unterschiedlichen Placements, verschachtelte Tage, langsame/fehlerhafte Requests. Reale Touch-/Screenreader- und Performancefälle separat protokollieren.
6. Nur eigene Prozesse beenden, keine fremden Ports freiräumen. Ergebnis mit genauer URL, Revision, Screenshots und offenen Fällen übergeben. Freigabe/Integration nach `docs/DEVELOPMENT.md`.

Im Audit wurde statt einer Vite-UI-Änderungsabnahme der frisch gebaute, unveränderte Produktionsstand direkt vom isolierten Flask-Backend auf 5184 ausgeliefert. Das genügt zur Bestandsinspektion, ersetzt später aber nicht den vereinbarten Vite-Entwurfsworkflow.


## W13-Nachtrag — 02.11.2026

- Tatsächlich geprüfter Produktstand: `89a04da783b6f2f76e5934fc86834bf0a0666eaa`, W01–W12 lokal integriert. G0–G5 durch die Aufgabenbelege dokumentiert; G6 bleibt offen. Der Abschnitt „Geprüfte Ausgangslage“ beschreibt ausdrücklich das historische P1-Audit.
- Reine Dokumentationsprüfung: keine neue Anwendungsversion, kein Commit/Push/Deployment. Tests/Build aus `/private/tmp/wander-w13-audit-20261102`; eigene SQLite-Testdaten und Uploadablage. Originaldaten/Secrets sowie zehn scripts-Änderungen erhalten.
- Aktuell 43 Frontend- und 77 Backendtests bestanden, Produktionsbuild erfolgreich. Öffentliches JS 354.722 Byte, Studiochunk 114.398 Byte erst bei Studioaufruf.
- Native Browser: 1280×900 / 390×844 Chrome sowie tatsächliche 319×674 CSS-px im Codex-Browser. Neue LCP-/INP-/CLS-Laborstichproben im Abschlussabschnitt von `PRODUCT_AUDIT.md`; kein Feld-/Geräteversprechen.
- Belegt offen: Langtitel sprengt mobilen Archivindex (319→507 px), Indexdatum 7 px, intermittierender Studio-CLS 0,150; gemeinsamer Picture-Quellenwechsel bleibt Code-Risiko. Editorhashes entsprechen W11, gezieltes Save/Reload/Publish erneut bestätigt; Crop/Upload/Recovery aus unveränderten W10/W11-Nachweisen übernommen.
- Fachliche Neubewertung 8,345 ≈ 8,3/10, 9/10 nicht erreicht. Vollständige Ergebnisse, fünf Lücken, Messgrenzen, Screenshots und maximal drei nächste Einzelaufträge: [W13-Abschlussaudit](PRODUCT_AUDIT.md#w13--abschlussaudit-vom-02112026). Echte Geräte, Screenreader und abschließendes G6-Nutzerurteil offen.
