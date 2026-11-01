# WANDER — direkt ausführbare Worker-Aufträge

Stand 01.11.2026. Dies sind **Vorschläge für spätere Einzelaufträge**. Nur den gewünschten vollständigen Textblock kopieren und das genannte Modell/Reasoning im neuen Chat wählen. Das Kopieren eines Prompts beauftragt dessen Entwurf, keine lokale Integration, keinen Commit/Push und kein Deployment.

Die Originalpfade sind Lesekontext; Änderungen am Anwendungscode erfolgen im verwalteten Draft. Die Strategiedokumente können dort fehlen, weil sie noch uncommitted sind. Nicht ungefragt kopieren/committen. Je Draft Basisrevision plus Dateihashes/Auftragsdiff festhalten. Bei aufeinanderfolgenden uncommitteten Aufgaben die Entwurfskette im Plan beachten; ein neuer Worktree von HEAD enthält lokal übernommene Vorgänger nicht. Abhängigkeiten und Gate-Freigaben aus dem [Plan](DEVELOPMENT_PLAN.md) prüfen, nicht aus historischen TASKS-Status ableiten. Aktuelle Toolverfügbarkeit vor Delegation prüfen; keine rekursiven Worker.

## W01 — Manuelle Bildreihe ohne automatische Verschiebung

```text
Auftrag W01 — Manuelle Bildreihe ohne automatische Verschiebung.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, low; zwei lokale Aufrufstellen, keine neue Zustandslogik.
Voraussetzung: aktueller Auditbefund A01 liegt vor. Keine andere Aufgabe starten.
Lies im Original /Users/ericwilts/Documents/WANDER nur AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md und PRODUCT_AUDIT.md/A01 als Kontext. Prüfe Gitstatus und angehängte Worktrees; verwende einen passenden isolierten Draft mit codex/-Branch. Fehlende notwendige ungesicherte Codeänderungen melden. Halte nur W01 mit Scope/Abnahme in TASKS.md fest.
Ziel: Eine manuelle horizontale Bildreihe darf sich ohne horizontale Nutzereingabe nicht verschieben, auch nicht nach erneutem vertikalem Scrollen.
Schreibscope: src/StoryExperience.tsx, nur PhotoRail und der useRailHint-Import; TASKS.md. Lies src/useRailHint.ts zur Bestätigung. Entferne Hookaufruf und unbenutzten Import. Den Hookbestand nicht löschen, keine anderen Komponenten ändern.
Design/Technik: freie Zwischenpositionen, angeschnittenes nächstes Bild, Mausziehen, Touch, Tastatur und Klickunterdrückung nach Drag erhalten. Filmstrip bleibt der getrennte automatische Modus. Keine Pfeile, Hinweise oder Snap-Regeln hinzufügen.
Abnahme: mit aktivierter Bewegung erstes Sichtbarwerden und Wiederbetreten der Reihe prüfen; scrollLeft bleibt ohne horizontale Eingabe unverändert. Nach manueller Zwischenposition und vertikalem Weiter-/Zurückscrollen bleibt sie erhalten. End/Home/Pfeile, Bildöffnen und Lightbox-Rückkehr funktionieren; Bewegung aus funktioniert ebenfalls.
Checks: npm run test:frontend und npm run build; sicher isolierte Browservorschau nach docs/DEVELOPMENT.md, Desktop/Mobil, DE/EN. Keine bedeutungslosen Tests für das bloße Entfernen eines Aufrufs schreiben. Native Reviewansicht öffnen und Scope selbst prüfen.
Grenzen/Eskalation: kein weiterer Motionumbau, keine Daten-/Backend-/Abhängigkeitsänderung. Unerwartete Kopplung an Drag oder Filmstrip konkret melden statt ausweiten.
Bericht: Draftpfad/-revision, genaue Vorschau-URL, Diff, Checks und tatsächlich geprüfte Browserfälle/offene Grenzen. Danach konkrete Übernahmefreigabe abwarten; nicht integrieren, committen, pushen oder deployen.
```

## W02 — Mobile Archivtitel ohne abgeschnittene Wörter

```text
Auftrag W02 — Mobile Archivtitel vollständig lesbar machen.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, low; begrenzte responsive Typografie. Nur bei belegtem Kaskaden-/Umbruchproblem auf medium erhöhen.
Voraussetzung: W01 geprüft und übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, DESIGN_GUIDELINES.md/Typografie und PRODUCT_AUDIT.md/A02. Gitstatus/Artefakte prüfen, isolierten codex/-Draft verwenden, nur W02 in TASKS.md führen. Notwendige fehlende ungesicherte Voraussetzungen melden.
Ziel: Der deutsche Archivtitel passt bei 320/390 px vollständig in den Inhaltsbereich; Serif, Kursive und Hierarchie bleiben erhalten.
Schreibscope: src/styles.css, ausschließlich mobiler .archive-heading-h1-Bereich und gegebenenfalls dessen lokale Umbruchregeln; TASKS.md. Alle Regeln für archive-heading in der CSS-Kaskade vorher suchen. src/Public.tsx und src/I18n.tsx nur lesen.
Lösung: Den mobilen 77-px-Festwert durch einen fließenden Maßstab ersetzen. Grobe Richtung der Guidelines 42–60 px mobil; tatsächliche Schriftmetriken mit „Entdeckungen.“ prüfen. Falls nötig lokales overflow-wrap als Sicherung für untrennbare Inhalte. Kein Abschneiden, Ellipsis, globales Wortzerlegen oder geänderter Reiseinhalt.
Abnahme: DE/EN bei 320/390/768/1280 px und 200 % Textzoom; ganzer Titel sichtbar, keine horizontale Seitenerweiterung, Abstand zum Intro/Toolbar stimmig. Desktopmaßstab bleibt erhalten. Magazin-/Indexwechsel und Sortierung funktionieren weiter.
Checks: npm run test:frontend, npm run build; exakte Draft-URL im nativen Browser, Screenshot plus H1-clientWidth/scrollWidth für den Fehlerfall; nativen Review öffnen, Selbstcheck. Keine neue Testabhängigkeit oder CSS-Snapshottests.
Grenzen: keine allgemeine Neugestaltung, keine übrigen Überschriften skalieren. Wenn eine andere Kaskadenregel das Ergebnis verhindert, konkret belegen und nur lokal korrigieren; breiten Konflikt melden.
Bericht: Vorher/nachher, Draftpfad/-revision, URL, Checks, Bildschirmgrößen und offene Abdeckung. Konkrete Freigabe abwarten; keine Integration, Commits, Pushes oder Deployments.
```

## W03 — Sichere automatische Schriftfarbe

```text
Auftrag W03 — Automatische Schriftfarbe nach tatsächlichem Kontrast wählen.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, medium; reine begrenzte Farblogik mit sinnvollen Regressionstests.
Voraussetzung: W02 geprüft/übernommen. Lies im Original /Users/ericwilts/Documents/WANDER AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md/Dateninvarianten und PRODUCT_AUDIT.md/A03. Isolierter codex/-Draft nach Status-/Artefaktprüfung; nur W03 in TASKS.md.
Schreibscope: src/journalModel.ts/surfaceColors und kleine reine Kontrasthilfe; neu tests/surface-colors.test.ts; TASKS.md. src/JournalCanvas.tsx und src/EditorControls.tsx nur gezielt lesen.
Ziel: Für gültige erlaubte drei-/sechsstellige HEX-Hintergründe erfüllt die automatisch gewählte Schrift mindestens 4,5:1. Berechnung mit linearisierten sRGB-Werten und (Lhell+.05)/(Ldunkel+.05). Keine Grenzwertentscheidung aus gerundeten Anzeigen.
Technik/Design: surfaceColors-Signatur erhalten. Bisherige Markenfarbe erhalten, wenn sie 4,5 erfüllt; sonst andere Markenfarbe prüfen, dann neutralen Schwarz-/Weiß-Fallback. Quiet Atlas/After Hours sollen optisch unverändert bleiben. Exportiere eine kleine reine contrastRatio-Hilfe für spätere Inspectorhinweise. Explizite Benutzer-Textfarbe weder ändern noch speichern; keine Backend-/Schemaänderung.
Abnahme/Tests: #949494 erreicht mit gewähltem Fallback >=4,5 (bisher hell 2,722, dunkle Markenfarbe 4,495). Zusätzlich beide Editionsfarben, #000/#fff, farbige mittlere Flächen und #rgb/#rrggbb-Äquivalenz; Eingaben bleiben unverändert. Tests berechnen die Erwartung nachvollziehbar statt dieselbe Implementierung abzuschreiben.
Checks: Frontendtests/Build, im Wegwerfeditor Hintergrund ändern und öffentliche/iframe-Darstellung vergleichen. DE/EN, beide Editionen. Unabhängiger Luna/medium-Review nach Workerabschluss, keine Selbstfreigabe.
Grenzen/Eskalation: keine Palette neu erfinden, keine gewählten Farben blockieren. Falls gültige Eingabeformen oder Vererbung unklar sind, konkrete Beispiele an Sol geben.
Bericht: Kontrastpaare, Tests, Screenshots, Draftrevision/URL, Risiken. Freigabe abwarten; nicht integrieren, committen, pushen oder deployen.
```

## W04 — Präzision und gemeinsamer UI-Motionmaßstab

```text
Auftrag W04 — Kleines freigabefähiges Designfundament mit lesbarer UI.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, medium; begrenzter CSS-Pilot mit konkreter visueller Referenz.
Voraussetzung: Gate G0 bestanden; Nutzer bestätigt die vorgeschlagene Designrichtung. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md/CSS und DESIGN_GUIDELINES.md. Status/Artefakte prüfen, isolierten codex/-Draft nutzen und nur W04 in TASKS.md führen.
Schreibscope: src/refinement.css, src/journal.css, TASKS.md. src/styles.css/experience.css und src/Reveal.tsx nur für tatsächlich betroffene Regeln lesen.
Ziel: Ein begrenzter Pilot macht Metadaten, Controls und Bewegung konsistent: Start-Covermetadaten, Editorfeld-/Gruppenabstände sowie ein Button-/Dialogzustand. Semantische CSS-Variablen für UI-Dauern/Easing und Gruppierungsabstände aus den Guidelines einführen; nur diese Piloten darauf umstellen. Zusätzlich eine Start-/Storyreferenz gemäß DESIGN_GUIDELINES.md/Verbindliche gestalterische Handschrift mit vorhandenen Modulen und Wegwerfinhalten bei 390/1280 px in beiden Editionen zeigen. Dafür keine Templatefunktion oder neue Datenfelder entwickeln; vorhandenes Markup nutzen. Bild-/Textgewicht, Umbruch, optische Kanten und Kapitelpause im Bericht mit Screenshots als verbindliche Richtung für W05/W06/W09 festhalten.
Design: Instrument/Manrope und Editionsfarben erhalten; Komposition nur innerhalb des Referenzpiloten schärfen, übrige Seiten unverändert lassen. Bedeutungsvolle mobile Covermetadaten aus dem 6-px-Bereich auf lesbaren Maßstab bringen; Inputs mobil 16 px anstreben. Fokus sofort sichtbar, wichtige Touchflächen Ziel 44 px, keine starke Bildvergrößerung. Nutzerreview G1 vor Ausbreitung.
Technik: Importreihenfolge unverändert; kein globales transition:all. Autorenwerte/Reveal-Parameter und Backendgrenzen nicht verändern. Keine Autorenparameter am globalen Bewegungsschalter erklären; ihre Beschriftung am tatsächlichen Inspector-Control gehört zu W10. Keine neue Semantik oder Migration. Globaler Schalter und OS-Reduced-Motion deaktivieren neue räumliche Bewegung.
Abnahme: Pilot bei 390/1280 px, DE/EN, beiden Editionen; keine neue Überlagerung oder Fokusverschiebung. Bestehende Reveals, Parallax und Filmstrip unverändert funktionsfähig. Schnell wechselnde Hover-/Dialogzustände prüfen; konkrete neue Werte im Bericht begründen. Referenz zusätzlich mit langem Titel und ungünstigem Hochformat prüfen. Sichtbare Bildrequests und verfügbare Lade-/Layoutmessungen samt Viewport und Bedingungen als Ausgangsbasis dokumentieren; keine Zielwerte als gemessen ausgeben.
Checks: Frontendtests/Build, native Browser-/Reviewansicht und Vorher/nachher. OS-Reduced-Motion separat nachweisen oder offen lassen; nicht durch UI-Pause ersetzen.
Grenzen/Eskalation: keine CSS-Gesamtbereinigung. Benötigt der Pilot neue Save-/Motionlogik, stoppen und an Sol begrenzt eskalieren.
Bericht: Tokens/Selektoren, Screenshots, URL/Revision, Checks, offene Fälle; konkrete G1-/Übernahmefreigabe abwarten. Kein Commit/Push/Deployment/Integration.
```

## W05 — Klarer Produktnutzen und kuratierter öffentlicher Einstieg

```text
Auftrag W05 — Leser- und Gestalterweg auf Start/Archiv klären.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, medium; Umsetzung der bestätigten G1-Komposition ohne neue Stilfindung.
Voraussetzung: Gate G1 freigegeben/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md, DESIGN_GUIDELINES.md/Leitidee und PRODUCT_AUDIT.md/Produktbewertung. Status/Artefakte prüfen, codex/-Draft, nur W05 in TASKS.md.
Schreibscope: src/Public.tsx/Home und Archive, src/refinement.css, src/translations.json; TASKS.md. Header/Footer, API und Storyrenderer nicht umbauen.
Ziel/Design: Die in G1 bestätigte Zielgruppe und Komposition umsetzen: ein dominantes Motiv, asymmetrischer Bild-/Titelblock auf Desktop, klare semantische Stapelung mobil. Bestehende Schrift/Palette erhalten; Bildgewicht und Hierarchie dürfen deutlich verbessert werden. Ein primärer Leserweg und ein nachgeordneter Studiozugang über /studio; im lokalen Ein-Admin-Modell nicht jeden Besucher zur vermeintlichen Kontoerstellung auffordern. Auch mobil muss der Nutzen sichtbar bleiben. Eine zur bestätigten Zielgruppe passende kurze Aussage genügt, für die persönliche Reiseausgabe etwa „Reisen in Fotografien und Geschichten“; keine zusätzlichen Verkaufsabschnitte.
Reduziere die gleichgewichtige Wiederholung derselben neuesten Reise: Cover bleibt Hauptmotiv, nachfolgende Auswahl zeigt ergänzenden Kontext oder weitere reale Reisen, ohne neue Daten anzunehmen. Archiv erhält gemäß Guidelines in der Magazinansicht einen gewichteten Auftakt und ruhigere Folgegruppen, lesbare Metadaten und gemeinsame Bild-/Textkanten; Index und Sortierung bleiben erhalten. G1-Tokens auf diese Flächen übernehmen. Vorhandene Bildmaße/Verhältnisse reservieren; Hauptmotiv-Request sowie Bildladefehler/Quellenwechsel prüfen. Keine neuen Downloadserien oder Komponenten-Rewrites.
Abnahme: 0/1/20 Wegwerfreisen, sehr lange Titel/Untertitel, Hoch-/Quercover, DE/EN bei 390/1280 px. Kein leeres Layoutloch, keine erfundene Vielfalt, kein abgeschnittener Titel. Daten-/Ladefehler weiterhin verständlich. Nutzer kann Angebot und beide nächsten Schritte erklären und G2 visuell freigeben.
Checks: Frontendtests/Build; native Browserprüfung mit identischen Vorher/nachher-Inhalten und Reviewpanel. Kein neuer UI-Test für reine Text-/Stiländerungen erforderlich.
Grenzen: keine Behauptung von AI, Export, Accounts oder weltweit erreichbarem Hosting. Keine neuen Reisen/Uploads außerhalb Wegwerfdaten, keine gespeicherten Inhalte ändern. Bei notwendigem Datenmodellwechsel an Sol melden.
Bericht: Screenshots, Inhaltsfälle, URL/Revision, Checks und offene Grenzen. G2-/Übernahmefreigabe abwarten; nicht integrieren, committen, pushen oder deployen.
```

## W06 — Storyrhythmus und Kapitelorientierung

```text
Auftrag W06 — Redaktionellen Storyrhythmus und ruhige Kapitelübersicht umsetzen.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, medium; bestätigte Präsentationsregeln und kleine datenabgeleitete UI.
Voraussetzung: Gate G2 freigegeben/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md/Renderer und DESIGN_GUIDELINES.md/Storyrhythmus. Status/Artefakte prüfen, isolierter codex/-Draft, W06 in TASKS.md.
Schreibscope: src/JournalCanvas.tsx und src/journal.css, TASKS.md. src/StoryExperience.tsx und src/viewport.ts gezielt lesen.
Ziel: Die G1-Storyreferenz auf Standardabstände, Textmaß und Caption-/Bildkanten im gemeinsamen Renderer übertragen; Unterschiede Quiet Atlas/After Hours nach Guidelines erhalten. Vorhandene explizite Autorenwerte, Modulreihenfolge und Inhalte haben Vorrang; Keine Module erzeugen, keine Pflichtdramaturgie oder neuen gespeicherten Presets einführen. Kurze und lange Story auch ohne Bewegung vollständig prüfen. Ab zwei vorhandenen root-Tag-/Kapitelmodulen eine zurückhaltende einklappbare Übersicht nach dem Cover vor dem Hauptinhalt anbieten. Nur vorhandene Module und ihre Lesereihenfolge nutzen; Links auf die vorhandenen canvas-module-ID-Ziele. Auf Mobil standardmäßig kompakt, auf Desktop ebenfalls keine konkurrierende Hauptnavigation. Titel/Datum reichen, keine neuen Bilddownloads.
Technik: Im gemeinsamen Renderer umsetzen; Besucheransicht und Besuchervorschau bleiben gleich. Im Bearbeitungsmodus keine konkurrierenden Auswahlaktionen. Bei Tages-Einzelansicht keine überflüssige Übersicht. IDs, Elternreferenzen und Modulreihenfolge nicht verändern. Native Anker/Details bevorzugen; iframe-Dokument bei Fokus/Scroll berücksichtigen. Kein eigener Scrollspy oder neuer Store. Die Übersicht darf keine zusätzliche Lightbox-History erzeugen; Hash-/Router-/Scrollverhalten und Fokus im jeweiligen Dokument gezielt prüfen. Falls bestehende IDs im konkreten Modus nicht nutzbar sind, Abweichung belegen statt Zielnamen raten.
Abnahme: 0/1/12 Kapitel, verschachtelte Unterbausteine, lange Titel, beide Editionen, DE/EN, 390/1280 px. Jeder Link erreicht das richtige Kapitel, Fokus sichtbar; Browser-Zurück, bestehende ?day-Galerie und Lightbox bleiben nutzbar. Reduced Motion führt ohne räumliche Scrollanimation zum Ziel.
Checks: Frontendtests/Build, Browser public und iframe-Besuchervorschau, native Reviewansicht. Bei substanzieller Logik unabhängigen Luna-Review veranlassen; keine Selbstfreigabe.
Grenzen/Eskalation: keine Umsortierung, keine neuen Pflichtmodule, keine Migration. Unklare iframe-History-/Fokuskopplung begrenzt an Sol geben.
Bericht: Screenshots, Link-/Fokusfälle, URL/Revision, Checks, offene Fälle. Übernahmefreigabe abwarten; keine Integration/Commits/Pushes/Deployments.
```

## W07 — Verlässliche Lightbox-Bildwechsel

```text
Auftrag W07 — Geladene, unterbrechbare Lightbox-Bildwechsel.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6.1-sol, medium; gekoppelte Async-, Gesten- und Historyzustände.
Voraussetzung: W06 geprüft/übernommen, G1-Motionvorgaben gültig. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md, DESIGN_GUIDELINES.md/Motion und PRODUCT_AUDIT.md/R02. Isolierter codex/-Draft nach Status/Artefakten, nur W07 in TASKS.md.
Schreibscope: src/StoryExperience.tsx/PhotoViewer, Lightboxregeln in src/experience.css und src/journal.css; bei nötiger reiner Index-/Requestlogik neu src/photoViewerModel.ts und tests/photo-viewer-model.test.ts (begründet optional); TASKS.md. Modal in src/components.tsx und sequenceIndex in src/journalModel.ts zunächst nur lesen.
Ziel: Bei Bildwechsel bleibt das bisherige Motiv sichtbar, bis das letzte angeforderte Bild geladen/dekodiert ist; dann ruhige Opacityüberblendung gemäß Guidelines. Fehlerzustand mit Wiederholen/Weiterwechsel statt leerer Bildfläche. Beim ersten Öffnen ohne Vorgängerbild dimensionsstabile Lade-/Fehlerfläche. Angeforderter Index und sichtbarer Index getrennt; Bild, Caption, Alternativtext und sichtbarer Zähler wechseln gemeinsam erst nach erfolgreichem Decode. Lade-/Fehlerhinweis benennt das angeforderte Ziel separat. Höchstens direkte Nachbarn des aktuellen Ziels vorbereiten, veraltete Ergebnisse ignorieren und Cache begrenzen; keine gesamte Vollauflösungssammlung laden.
Technik: Jede Eingabe aktualisiert den Zielindex korrekt, veraltete Load-/Decodeantworten dürfen nicht gewinnen. Beim Schließen bereinigen. Quelle versus Placement und vorhandene Sequenz erhalten; keine Änderung an Quelldateien/Crops. Wheel-Gestenlock, Touchschwellen, Pfeile, Escape, history.back und Modal-Fokusrückgabe erhalten. Reduced Motion zeigt das fertige Ziel ohne räumliche Animation.
Abnahme: zehn schnelle Pfeile, Gegenrichtung während Decode, Schließen während Laden, Bildfehler/Retry, 1/2/20 Motive, wiederholte Quellen, beide Editionen, DE/EN, Mobil/Desktop. Caption/Zähler und Bild müssen dieselbe definierte Anzeige repräsentieren; keine verspäteten Sprünge und kein leerer Zwischenframe bei langsamen Requests. Wiederholtes Öffnen/Schließen und schnelles Navigieren dürfen keine unbegrenzt wachsenden Requests/Bildreferenzen hinterlassen; verfügbare Frame-/Requestbelege mit G1 vergleichen.
Checks: relevante reine Tests nur für neue Logik, Frontendtests/Build; native Browserfälle, Gesten soweit verfügbar, fehlende echte Touchabdeckung offen; unabhängiger Sol/medium-Review plus natives Reviewpanel.
Grenzen/Eskalation: keine neue Bibliothek, globales Modal-Rewrite oder Routerumbau. Grundlegende Konflikte oder zwei verschiedene Fehlversuche als begrenzte Frage an Astra geben.
Bericht: Zustandsmodell kurz, Race-/Fehlerfälle, URL/Revision, Screenshots und Checks. Konkrete Freigabe abwarten; keine Integration, Commits, Pushes oder Deployments.
```

## W08 — Kontinuität vom Cover zur Geschichte

```text
Auftrag W08 — Cover und Story beim Navigieren visuell verbinden.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6.1-sol, medium; Routing, Laden, Scroll und Browserfähigkeiten.
Voraussetzung: W07 geprüft/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md und DESIGN_GUIDELINES.md/Motion. Status/Artefakte prüfen, isolierter codex/-Draft; nur W08 in TASKS.md.
Schreibscope: src/Public.tsx/Coverlink, src/StoryExperience.tsx/StoryLoader, src/App.tsx/Scroll nur soweit nötig, src/experience.css; TASKS.md. Keine API-/Persistenzänderung.
Ziel: Beim Klick auf das öffentliche Startcover bleibt der Bildzusammenhang während des Storyladens erkennbar. Übergebe höchstens vorübergehenden UI-Linkzustand für genau Zielslug/Cover; verwende ihn als dimensionsstabilen Ladeplatzhalter. Routerwechsel und Eingaben warten nicht auf Animation oder Netzwerk.
Design/Technik: Optional native View-Transition als progressive Verbesserung, nur nach Prüfung der vorhandenen Router-/Browser-API; sonst direktes Navigieren mit demselben stabilen Coverplatzhalter. Kein globaler Seitencrossfade, keine neue Routenarchitektur, kein Ganzseitenzoom. Zielinhalt ersetzt den Platzhalter erst nach passender Antwort. Direkte URL und fremde/fehlende Linkstatewerte brauchen bisherigen funktionalen Loader/Fehlerzustand. Keine privaten Daten im öffentlichen UI-Zustand. Identität umfasst Zielslug und öffentliches Cover; unterschiedliche Ausschnitte/Seitenverhältnisse nicht als identischen fliegenden Bildausschnitt vortäuschen. Bei Abweichung stabiler Platzhalter ohne räumliches Morphing. Fokus nur bei tatsächlichem Seitenwechsel sinnvoll setzen; Back/Forward, Hashziele und Lightbox-Schließen behalten ihre vorhandene Rückkehrsemantik. W08 besitzt den Routenfallback, W12 darf ihn später nicht durch einen globalen Suspense-Fallback verdecken.
Abnahme: Cover→Story bei schnellem/langsamem/fehlgeschlagenem Laden, zweite Navigation vor Antwort, Back/Forward, Reload/Direktlink, gleicher Slug, Anker, Lightbox-History und Scrollposition. Bei Reduced Motion direkter Zustandswechsel, Inhalt bleibt jederzeit erreichbar. Beide Editionen und 390/1280 px.
Checks: Frontendtests/Build, native Browser-/Reviewansicht; unabhängiger Sol/medium-Review. Nachweise zu unterstützter Enhancementvariante und Fallback getrennt melden; keine Erfolgsaussage aus bloßem CSS.
Grenzen/Eskalation: Keine Auth-, Save-, Daten- oder Paketänderung. Ist die gewünschte Verbindung ohne größere Routerarchitektur nicht zuverlässig erreichbar, begrenzte Astra-Entscheidung mit Belegen vor Umbau anfordern.
Bericht: URL/Revision, Vorher/nachher und G3-Motionfälle, Checks und fehlende Abdeckung. G3-/Übernahmefreigabe abwarten; nicht integrieren, committen, pushen oder deployen.
```

## W09 — Einfacher Fotoeinstieg und verständliche Modulwahl

```text
Auftrag W09 — Einen klaren nächsten Gestaltungsschritt vermitteln.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, medium; UI-Führung ohne neue Datenlogik.
Voraussetzung: Gate G3 freigegeben/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md und DESIGN_GUIDELINES.md/Storyrhythmus. Status/Artefakte prüfen, isolierter codex/-Draft, nur W09 in TASKS.md.
Schreibscope: src/NewJournal.tsx, src/ModularEditor.tsx ausschließlich Modulpicker-Markup, src/refinement.css; TASKS.md. src/JournalCanvas.tsx/moduleNames und Upload.tsx lesen. Save-, add- und ensureJourney-Implementierung nicht verändern.
Ziel: Upload ist auf Mobil früh auffindbar; Edition bleibt ein leicht verständlicher Startpunkt. Kurze Folge „Fotos hinzufügen → Geschichte gestalten → prüfen und veröffentlichen“ ohne Pflichtwizard. Vor dem Upload entsteht weiterhin kein Entwurf.
Modulpicker: vorhandene Typen nach Absicht ordnen: Erzählen (Tag, Text, Zitat), Bilder zeigen (Einzelbild, Paar, Wand, Galerie, Cover), Sequenzen (manuelle Reihe, bewegter Filmstrip). Je Gruppe einen knappen Nutzen erklären; statische vorhandene Schemata nutzen, keine neuen Bildassets. Je Bildtyp ein kurzer Einsatzhinweis aus der G1-Storyreferenz (Paar = Beziehung, Wand = Überblick, Reihe = Entdecken); keine automatische Kompositionsgenerierung. G1-Control-/Abstandsmaßstäbe auf diese Flächen übernehmen. Alle bisherigen Modularten und Funktionen erhalten, keine automatische Generierung oder Umsortierung.
Abnahme: neuer Nutzer findet bei 390 px Upload ohne zwei bildschirmfüllende Editionskarten davor; beide Editionen weiter wählbar. Busy-/Upload-/Retryzustände und der Weg zum Editor bleiben unverändert. Alle Modularten mit Tastatur wählbar, Schließen/Fokus korrekt, DE/EN und Desktop prüfen. Gespeicherte Reisen unverändert.
Checks: Frontendtests/Build, nur Wegwerfbackend für Upload-/Editorfälle; native Browser-/Reviewansicht. Bei substanzieller Auswahl-/Zustandsänderung unabhängigen Luna-Review ergänzen.
Grenzen/Eskalation: keine neuen Templates/Datenfelder oder Pflichtschritte, kein Eingriff in Uploadqueue oder Moduledefaults. Sol hinzuziehen, wenn Verhalten statt Markup geändert werden müsste.
Bericht: Einstieg/Picker vorher-nachher, URL/Revision, geprüfte Aktionen, Checks und Grenzen. Übernahmefreigabe abwarten; keine Integration, Commits, Pushes oder Deployments.
```

## W10 — Aufgabenbezogener Inspector und mobiler Kontext

```text
Auftrag W10 — Inspector priorisieren und Auswahlkontext erhalten.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6.1-sol, medium; gekoppelte Auswahl, Tabs, iframe und Fokus.
Voraussetzung: W09 geprüft/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md/iframe und DESIGN_GUIDELINES.md. Status/Artefakte prüfen, isolierter codex/-Draft, nur W10 in TASKS.md.
Schreibscope: src/ModularEditor.tsx nur Auswahl-/Tab-/Inspector-UI, src/ModuleSettings.tsx, src/ImageControls.tsx, src/journal.css; bei Farbhinweis oder Motionbeschriftung nötigenfalls src/EditorControls.tsx bzw. src/MotionControl.tsx nur falls dort das betreffende Autoren-Control liegt; TASKS.md. journalModel-Kontrasthilfe und vorhandene Bildrückkehr-/Historylogik lesen.
Ziel: Im Inspector zuerst Inhalt, danach Layout/Typografie, zuletzt Bewegung/Feindetails. Vorhandene Details-Elemente und Controls wiederverwenden; keine neue Einstellungsarchitektur. Die G1-Control-/Abstandsmaßstäbe auf den Inspector anwenden. An den tatsächlichen Autoren-Motionfeldern knapp erklären: Dauer wirkt bei Scrollbewegung als Glättung, Verzögerung auf die Wiedergabevorschau; gespeicherte Semantik nicht ändern. Jede Ansicht sagt deutlich „Reise“, „dieses Modul“ oder „diese Bildverwendung“ und zeigt Vererbung/Rücksetzung verständlich.
Mobile: gewähltes Modul/Bild beim Wechsel zwischen Module/Vorschau/Einstellungen erhalten; klare Auswahlbezeichnung und Rückkehr zur passenden Stelle. Eingabefokus bleibt beim Tippen/Sliderziehen stabil. Toolbar und Hauptaktionen auch mit Safe Area/Bildschirmtastatur erreichbar. Globalen Bewegungsschalter nur bei tatsächlich gemessener Überdeckung lokal platzieren.
Farbe: bei expliziter zu kontrastarmer Textfarbe passiven verständlichen Hinweis mit berechnetem Verhältnis anzeigen; keine Benutzerfarbe überschreiben/blockieren. Automatische Farben kommen aus W03.
Abnahme: Text, Bildpaar, Wand, wiederholte Quelle mit eigenem Placement, geerbte/individuelle Farben; Desktop/390 px, DE/EN, beide Editionen, Tastatur und echte Mobil-Tastatur soweit verfügbar. Crop-Rückkehr, vorhandene Browser-Zurück-Semantik und Previewparität bleiben erhalten. Savepayload/Revision/Recovery unverändert.
Checks: Frontendtests/Build, gezielte sinnvolle Tests nur für neue reine Zustandslogik; isolierte Browserfälle und unabhängiger Sol/medium-Review, natives Reviewpanel.
Grenzen/Eskalation: kein Umbau der Save-State-Maschine und kein Editorkomponentensplit auf Vorrat. Architekturfrage oder zwei unterschiedliche Fehlversuche begrenzt an Astra geben.
Bericht: Gruppierung, Fokus-/Tabfälle, URL/Revision, Screenshots, Checks, echte Geräte offen benennen. Freigabe abwarten; keine Integration/Commits/Pushes/Deployments.
```

## W11 — Verständlicher Veröffentlichungsabschluss

```text
Auftrag W11 — Kurze Abschlusskontrolle vor dem Veröffentlichen.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6.1-sol, medium; Savezustände und Snapshotgrenze schützen.
Voraussetzung: W10 geprüft/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md/Save und DESIGN_GUIDELINES.md. Status/Artefakte prüfen, isolierter codex/-Draft, W11 in TASKS.md.
Schreibscope: src/ModularEditor.tsx/Publishaktion und kleine Präsentationsanpassung in src/EditorDialogs.tsx bzw. src/journal.css; TASKS.md. api.ts, journalModel.ts und backend/app.py/Composition sowie vorhandene Snapshottests nur lesen.
Ziel: Klick auf Veröffentlichen öffnet eine kurze native Modal-Abschlusskontrolle: Reisetitel, Foto-/Modulumfang und verständlicher Unterschied zwischen privatem Speichern und Besucherversion. Fotoquellen und Bildverwendungen nicht als denselben Zähler ausgeben; vorhandene Daten ohne neue Persistenz zusammenfassen. Nach bestätigtem Erfolg einen klaren Zugang zur vorhandenen öffentlichen Besucherversion anbieten. Eine bestätigende Aktion ruft exakt den bestehenden save(true)-Pfad auf. Kein zweiter Speichermechanismus.
Technik/Design: Abbrechen verändert nichts. Titel/Zusammenfassung stammen aus dem aktuellen lokalen Stand, nicht aus einer alten Kopie. Ändert sich der lokale Stand während der Kontrolle (z. B. durch abgeschlossenen Upload), Zusammenfassung aktualisieren und erneut prüfen lassen, nicht still eine andere Fassung veröffentlichen. Nutzereingaben während eines Publishrequests müssen wie bisher als unveröffentlichte Änderungen erhalten bleiben; Erfolg nicht als Veröffentlichung späterer Eingaben beschriften. Bei Save/Upload/busy Veröffentlichung weiter sperren; Doppelklick darf keinen zweiten Request erzeugen. Erfolg nur nach erfolgreicher Serverantwort; Fehler und Retry bleiben nachvollziehbar. Keine erfundenen Cloud-/Privatfreigabeversprechen. Recovery, Revision, IDs und published_data-Vertrag erhalten.
Abnahme nur mit Wegwerfdaten: privater Erstentwurf, veröffentlichte Reise mit Änderungen, laufender Autosave/Upload, Fehler/Retry, Abbrechen, zweimal schnell bestätigen, Reload und angemeldeter/abgemeldeter Besuchersnapshot. Vor Bestätigung bleibt bisherige Veröffentlichung unverändert. Modal-Fokus/Escape, 390/1280 px und DE/EN.
Checks: npm run test:all und npm run build; vorhandene Backend-Snapshottests beibehalten. Neue reine UI-Zustandslogik nur bei sinnvollem Testansatz testen, keine DOM-Bibliothek installieren. Native Browser-/Reviewansicht und unabhängiger Sol/medium-Review.
Grenzen/Eskalation: keine Backendmigration, Konten, Versionshistorie oder Publish-API-Änderung. Bei nicht zuverlässig schützbarer paralleler Saveaktion konkrete Zustandsfolge an Astra vor Architekturumbau melden.
Bericht: G4-End-to-End-Nachweise, URL/Revision, Screenshots, Checks, Risiken. G4-/Übernahmefreigabe abwarten; nicht integrieren, committen, pushen oder deployen.
```

## W12 — Studiocode bedarfsgerecht laden

```text
Auftrag W12 — Öffentlichen Einstieg ohne vorzeitigen Editorimport laden.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Originaldokumente sind Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6.1-sol, medium; Routen, Importzyklen und Ladezustände.
Voraussetzung: Gate G4 freigegeben/übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md und PRODUCT_AUDIT.md/O01. Status/Artefakte prüfen, isolierter codex/-Draft, nur W12 in TASKS.md.
Schreibscope: src/App.tsx (Lazy-Grenzen, lokaler Lade-/Fehlerfallback), nötigenfalls src/Studio.tsx ausschließlich Import-/Exportgrenzen; TASKS.md. package.json, main.tsx und bestehende Routenübergänge aus W08 lesen. Kein neuer Router oder Buildplugin.
Ziel: Studio/NewJournal/Editor werden über React.lazy/Suspense erst bei Studioaufruf geladen. Öffentliche Story-/Galerieansichten bleiben verfügbar. Vor Änderung initial geladene öffentliche JS-Bytes und Buildchunks aufnehmen, nachher dieselbe Produktionsroute vergleichen; bloße Chunkanzahl ist kein Erfolgsnachweis.
Technik/Design: Guard/Authkontext und vorhandene Routen/Deep Links erhalten. Ladefallback hält den Inhaltsrahmen stabil und nutzt vorhandene PageState-Sprache; Chunkfehler erhalten einen lokalen Fehlerfallback mit verständlicher Wiederholmöglichkeit; Suspense allein behandelt Fehler nicht. Ein verworfener React.lazy-Import wird nicht durch bloßes Rerendern erneut angefragt: konkreten Wiederholungsweg (gegebenenfalls bewusstes Neuladen mit Hinweis auf lokale Entwürfe) prüfen. Keine neue globale Fehlerarchitektur. Bestehende App/useApp-Importzyklen gezielt prüfen. Cover-/Storykontinuität darf nicht durch Suspense ersetzt werden. Browser-Zurück und Anker weiter korrekt.
Abnahme: Start/Archiv/Story initial ohne Editorchunk; Studio nach Navigation und direkter URL, /studio/new, /studio/:slug, /edit und /setup funktionieren. Langsames/fehlgeschlagenes Chunkladen, Authfehler, DE/EN und Mobil/Desktop. Keine Änderung an Speichern, Inhalten oder CSS-Importreihenfolge. Keine Performancezielerreichung behaupten, die nicht gemessen wurde.
Checks: Frontendtests/Build, native Produktionsbrowserprüfung mit Requests/Chunks soweit Werkzeug unterstützt; unabhängiger Sol/medium-Review und natives Reviewpanel. Sind Laufzeitmessungen nicht möglich, Bundleevidenz getrennt und verbleibende LCP/INP/CLS offen berichten.
Grenzen/Eskalation: keine umfassende Import-/Storezerlegung, Medien-Neucodierung oder Abhängigkeiten. Wenn zyklische Kopplung eine größere Architekturänderung verlangt, begrenzten Astra-Vorschlag vor Umsetzung vorlegen.
Bericht: vorher/nachher Bytes, getestete Routen und Fehlerfälle, URL/Revision/Checks. G5-/Übernahmefreigabe abwarten; keine Integration/Commits/Pushes/Deployments.
```

Fachliche Grundlage für W12: [React lazy: gecachter Ladeaufruf und Fehlerübergabe an Error Boundaries](https://react.dev/reference/react/lazy). Die vorhandenen benannten Exporte beim Lazy-Import passend abbilden; kein pauschaler Exportumbau.

## W13 — Abschließendes Qualitätsaudit

```text
Auftrag W13 — Übernommenen Premiumstand unabhängig neu bewerten.
Arbeitsgrundlage: Lies zusätzlich /Users/ericwilts/Documents/WANDER/ARCHITECTURE.md sowie /Users/ericwilts/Documents/WANDER/DEVELOPMENT_PLAN.md für diesen W-Auftrag, Gates und Entwurfskette. Nur bei diesem Dokumentationsauftrag dürfen die unten ausdrücklich genannten Originaldokumente ergänzt werden; sonst sind sie Lesekontext. TASKS.md nur für den aktuellen Auftrag ändern; ungesicherte Voraufgaben erhalten.
Modell: gpt-6-luna, medium; vorhandene Nachweise sammeln und begrenzt neu prüfen. Ungeklärte Async-/Persistenzbefunde als einzelne Frage an Sol/medium eskalieren; kein zweites Gesamtaudit und kein automatischer Astra-Review.
Voraussetzung: W01–W12 und Gates G0–G5 nachweislich geprüft und übernommen. Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md, PRODUCT_AUDIT.md, DESIGN_GUIDELINES.md und DEVELOPMENT_PLAN.md/G6. Status/Artefakte und tatsächlich geprüfte Revision festhalten; nur W13 in TASKS.md.
Schreibscope: PRODUCT_AUDIT.md als datierter neuer Abschnitt mit erhaltenem Ausgangsaudit, PROJECT_OVERVIEW.md nur nachgewiesene Änderungen, DEVELOPMENT_PLAN.md nur Aufgaben-/Gate-Ergebnis und TASKS.md. Keine Anwendung ändern. Für reine Auditdokumentation ist kein Anwendungsmerge erforderlich; vorhandene Änderungen anderer Aufgaben erhalten.
Ziel: dieselben sechs Gewichtungen und Inhalte neu bewerten. Ist/Soll, objektive Nachweise, subjektive Urteile und fehlende Prüfungen trennen. Keine Task-Erledigung in Qualitätsnoten umrechnen. Gegen die bestätigte G1-Referenz zusätzlich prüfen: erkennbare WANDER-Handschrift, Bildhierarchie, Storyrhythmus ohne Motion und konsistenter Tokenrollout; reine Fehlerfreiheit genügt nicht für Premium. Belegte Bildzustandsprobleme außerhalb W07/W08 nicht als erledigt behandeln.
Checks: npm run test:all, npm run build in sicherer Quellkopie; native Browsermatrix aus G6 mit Wegwerfdaten. Desktop/Mobil, DE/EN, beide Editionen, lange Titel, 0/1/20 Reisen, wiederholte Placements, globale Pause/OS-Reduced-Motion, Keyboard/Fokus, Fehler/Retry, Crop/Save/Recovery/Publish. Echte Geräte, Screenreader, Performanceprofil separat nachweisen oder offen lassen. Vorhandene Ergebnisse bei unverändertem Stand nutzen, keine sinnlose Testwiederholung.
Abnahme: gewichtete Rechnung korrekt, keine offenen kritischen Daten-/Privatheits-/Bedienfehler, kein Bereich <8,5 für das 9/10-Ziel. Fehlende Pflichtfälle blockieren das Qualitätsversprechen. Nutzer bewertet konkret Eleganz, Rhythmus, Bewegung und Editorverständnis anhand des gezeigten Stands; erst dann G6 freigeben.
Grenzen/Eskalation: keine stillen Reparaturen, neue Dependencies, Commits, Pushes, Deployments. Wenn Ziel verfehlt, maximal drei priorisierte nächste Einzelaufträge mit Evidenz vorschlagen; bei wesentlicher ungeklärter Unsicherheit oder zwei unterschiedlichen gescheiterten Lösungsversuchen eine begrenzte Astra-Frage, keinen erneuten Komplettscan.
Bericht: fünf wichtigste verbleibende Lücken, Scores/Rechnung, Revisions-/Prüfbelege, Screenshots/URL, offene Produktfreigaben. Keine scheinbare Produktions- oder Mehrbenutzerreife aus dem lokalen Audit ableiten.
```

## A1 — Separater späterer Architekturauftrag

```text
Auftrag A1 — Betriebsmodell für ein geändertes Betriebs- oder Konfliktmodell entscheiden.
Modell: gpt-6-astra, zunächst low; ausdrücklich strategische Architekturentscheidung, keine Implementierung.
Voraussetzung: Der Nutzer beauftragt öffentlich nutzbares Hosting, Mehrbenutzerkonten oder zuverlässig gleichzeitiges Bearbeiten derselben Reise ausdrücklich. Auch zwei lokale Tabs können eine Konfliktentscheidung erfordern; die Premium-Roadmap löst das nicht. Eine Zustimmung zum Premiumdesign allein genügt nicht. Vorher nicht starten.
Lies /Users/ericwilts/Documents/WANDER/AGENTS.md, docs/DEVELOPMENT.md, PROJECT_OVERVIEW.md/Sensible Grenzen und PRODUCT_AUDIT.md/R01; danach gezielt backend/models.py, backend/app.py/Auth/Composition/Medien, backend/migrations.py, src/api.ts und Save/Recovery in src/ModularEditor.tsx. Keine weitere Delegation.
Ziel: bestätigtes Betriebs-, Eigentümer-, Zugriffs-, Konflikt-, Medien-, Backup- und Veröffentlichungsmodell mit kleinstmöglichem tragfähigem Migrationspfad. Offene zentrale Produktparameter gesammelt klären, nachdem bestehende Belege ausgewertet sind. Keine Nutzerantwort erfinden.
Schreibscope: neu docs/adr/001-operating-model.md; ARCHITECTURE.md/TASKS.md nur nach ausdrücklicher Entscheidungsfreigabe anpassen. Anwendung/Secrets/Umgebungsvariablen unverändert.
Anforderungen: Bestand und alle Placement-/Legacy-/Snapshotregeln erhalten. Optionen und Tradeoffs für Mandantentrennung, Sessions/CSRF, konkurrierende Saves, langlebige Medien und Wiederherstellung prüfen. Keine Stackmodernisierung ohne belegten Nutzen. Private Freigabe, AI und Export nur aufnehmen, wenn eigens beauftragt.
Abnahme: Anforderungen, Alternativen, begründete Entscheidung, Risiken, Rückweg, Datenmigration und spätere messbare Isolations-/Konflikttests dokumentiert; kleine Sol-Umsetzungsaufträge erst nach Nutzerfreigabe ableiten. Architekturentscheidungen vor Code diskutieren.
Checks: Pfade, Konsistenz mit aktuellem Auth-/Medien-/Composition-Vertrag und bestehendem Datenbestand; kein Backendstart gegen Originaldaten. Keine Sicherheitseigenschaft als bereits umgesetzt darstellen.
Bericht: Entscheidungsvorlage, Aufwand/Risiko, offene Nutzerentscheidungen. Nicht implementieren, integrieren, committen, pushen oder deployen.
```

## Reviewübergabe nach substanzieller Logikänderung

Der koordinierende Chat beauftragt nach Workerabschluss genau einen unabhängigen nativen Reviewer mit Modell aus `DEVELOPMENT_PLAN.md`. Mitgeben: W-ID, exakter Draftpfad und Basisrevision, freigegebener Dateiscope, vollständiger Taskdiff, Akzeptanzfälle, Testergebnisse/Screenshots und offene Fälle. Auftrag: nur nachgewiesene Regressionen, Scopeverletzungen und relevante Testlücken melden; nicht schreiben, nicht selbst freigeben, keine zweite Delegation. Anschließend nur betroffene Checks erneut ausführen. Dieser Reviewauftrag ersetzt keinen der Einzelprompts und autorisiert keine neue Produktaufgabe.
