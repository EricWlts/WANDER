# WANDER — Product-, UX- und Technikaudit

01.11.2026 · überprüfter Ausgangspunkt in [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md). Ergebnis: eine gestalterisch eigenständige, technisch ernsthaft ausgearbeitete lokale Fotojournal-App; der Schritt zum Premiumprodukt liegt vor allem in Führung, Lesbarkeit und verlässlicher visueller Kontinuität. Ein Komplettneubau ist nicht begründet.

## Evidenz und Prüfgrenzen

Kennzeichnung: **B** = im Browser beobachtet, **C** = im Code nachgewiesen, **T** = durch ausgeführten Test belegt, **S** = subjektives Designurteil, **U** = ungeprüft. Anbieterbehauptungen sind keine eigene Funktionsprüfung.

Die unveränderte Anwendung wurde in einer temporären Quellkopie gebaut und mit eigener SQLite-Datenbank/Demo-Reise auf `http://127.0.0.1:5184` geprüft. Bestehendes Backend 5001 und Vite 5173 wurden nicht für schreibende Tests verwendet oder beendet. Alle Browseränderungen betrafen Wegwerfdaten.

| Geprüft | Ergebnis und Reichweite |
| --- | --- |
| `npm run test:frontend` | **T:** 26 bestanden; Placement/Legacy-Fallbacks, Save-Merge bei lokalen Änderungen, Recoveryformen, ARIA-ID-Helfer, Menü-Escape und Bibliotheks-Leerzustand |
| `npm test` | **T:** 77 bestanden; u. a. Auth/CSRF, atomare Composition, Veröffentlichungsstände, Bildreferenzen, Upload/Retry, Medienprivatheit und Migrationserhalt |
| `npm run build` | **T:** TypeScript/Vite erfolgreich; CSS 136,68 kB / gzip 27,58 kB; JS 453,36 kB / gzip 141,97 kB. Dateigrößen, keine Ladezeitmessung |
| Start und Archiv | **B:** Start bei 1280 × 720 und 390 × 844, Archiv mobil mit Magazin-/Indexwechsel; Demo mit einer Reise |
| Navigation | **B:** mobiles Menü öffnen, Escape schließen, Fokus am Toggle; Routenwechsel; DE→EN am Neue-Reise-Einstieg |
| Story/Galerie | **B:** veröffentlichte Demo, After-Hours-Beispiel, Cover-Lightbox, rechter Pfeil 1→2, Escape mit Fokus zurück zum Auslöser; Bildreihe per End-Taste, globale Bewegungspause |
| Studio | **B:** Anmeldung am Wegwerfkonto, Bibliothek, Neuer-Reise-Ansicht, Editionen; Editor Desktop und direkter mobiler Einstieg, Vorschau-/Einstellungstab |
| Speicherung | **B:** Testtitel geändert → Autosave-Status → Neuladen → Titel und Hinweis auf unveröffentlichte Änderungen erhalten. **T/C:** Snapshot-Trennung im Backend. Browser-Veröffentlichen wurde nicht ausgelöst |
| Screenshots | [Start Desktop](docs/audit-2026-11-01/home-desktop.png), [Start Mobil](docs/audit-2026-11-01/home-mobile.png), [Archivfehler](docs/audit-2026-11-01/archive-mobile.png), [Editor Desktop](docs/audit-2026-11-01/editor-desktop.png), [Editor Mobil](docs/audit-2026-11-01/editor-mobile.png) |

Der Desktop-Editor-Screenshot erfasst wegen der Browser-Aufnahmefläche nur 1111 px Breite, obwohl die gemessene DOM-Breite 1280 px betrug und keinen horizontalen Dokumentüberlauf hatte. Der angeschnittene rechte Rand dieses Screenshots ist **kein belegter Editorfehler**.

**U:** echte Touch-/Trackpadgesten, iOS/Android, Bildschirmtastatur, Screenreader, OS-Reduced-Motion-Umschaltung, vollständige Upload-/Crop-/Recovery-/Publish-Flows im Browser, langsame/abgebrochene Requests, 20 Reisen/200 Fotos, 200 % Textzoom, Core Web Vitals und Frameprofil. Globale Bewegungspause ist geprüft; sie ersetzt die OS-Prüfung nicht. About/älterer Setup-Pfad wurden im Code lokalisiert, nicht vollständig visuell abgenommen. Keine Aussage vollständiger Barrierefreiheit oder Produktionsreife.

## Qualitätsmatrix

Die Noten sind **vorläufige fachliche Einschätzungen**, keine objektive Messung. 1 = Kernaufgabe scheitert; 5 = bedienbar mit erheblichen Reibungen; 7 = kohärent mit erkennbaren Schwächen; 9 = durchgängig kuratiert, zuverlässig und in den vereinbarten Kernfällen geprüft; 10 = außergewöhnliche Referenzqualität mit breiter Validierung. Fehlende Prüfungen werden nicht als bestanden gewertet.

| Bereich | Gewicht | Ist | Beitrag | Begründung / Sicherheit | Ziel |
| --- | ---: | ---: | ---: | --- | ---: |
| Visuelle Qualität / Art Direction | 25 % | 7,8 | 1,95 | **B/S:** charaktervolle Serif, ruhige Palette und große Motive; Mikrotexte sehr klein, Langtitelbruch sichtbar. Mittlere Sicherheit | 9,2 |
| Motion / Interaktionsqualität | 20 % | 6,5 | 1,30 | **B/C/S:** reversible Reveals, Pause und brauchbare Lightboxkontrollen; Auto-Hint widerspricht manueller Kontrolle, kein koordinierter Routen-/Bildzustandsübergang. Framequalität ungeprüft | 9,0 |
| UX / intuitive Bedienbarkeit | 20 % | 6,8 | 1,36 | **B/S:** direkter Fotostart und Autosave gut; Produktnutzen auf Start implizit, Inspector priorisiert zu wenig, mobil viele Kontextwechsel. Keine Nutzertests | 9,0 |
| Storytelling / Bildpräsentation | 15 % | 7,8 | 1,17 | **B/C/S:** zwei Editionen, flexible Module und unabhängige Placements stark; Start wiederholt Motiv/Story, lange Geschichten brauchen Wegweiser. Kleiner Inhaltskorpus | 9,2 |
| Technische Qualität / Zuverlässigkeit | 10 % | 8,0 | 0,80 | **T/C/B:** transaktionales Speichern, Snapshot, Referenzschutz, Tests; große gekoppelte Komponenten, keine Clientkonfliktkontrolle. Gilt für lokalen Ein-Admin-Betrieb | 9,0 |
| Mobil / Performance / Accessibility | 10 % | 6,5 | 0,65 | **B/C:** eigenständige mobile Tabs und funktionierender Menüsupport; Überlauf und Kontrastdefekt belegt, echte Geräte/Performance/Assistenztechnik offen. Niedrige bis mittlere Sicherheit | 9,0 |
| **Gesamt** | **100 %** | | **7,23 ≈ 7,2/10** | **Provisorischer Auditwert, kein Releasezertifikat** | **9,08 ≈ 9,1** |

Formel: Summe aus Note × Gewicht. Das Zielprofil beschreibt die erforderliche Qualität; es ist keine Prognose garantierter Zugewinne. Kriterien für ≥ 9 und Nutzerfreigabe in [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md).

## Nachgewiesene Probleme

| ID | Befund, Reproduktion und Beleg | Bedeutung / nächste Aufgabe |
| --- | --- | --- |
| A01 | **B/C:** Bei aktivierter Bewegung After-Hours-Beispiel öffnen, nur vertikal zur ersten Bildreihe wechseln. Ohne horizontale Eingabe wurde `scrollLeft: 36`, `data-hint-state: active` gemessen (Reihenbreite 1054, Inhalt 1211 px). `PhotoRail` ruft `useRailHint` auf (`src/StoryExperience.tsx:249`); der Hook schreibt bis 36 px und kann sich nach vertikaler Eingabe erneut aktivieren (`src/useRailHint.ts:37–68`). README verspricht ausdrücklich keine künstliche Hinweisbewegung | Nutzer verliert die vollständige Kontrolle über die manuelle Reihe. Kleine Änderung mit hohem Interaktionsnutzen: **W01** |
| A02 | **B/C:** `/archive`, DE, 390 × 844. Überschrift „voller Entdeckungen.“ ragt rechts hinaus. Gemessen: H1 346 px breit, Inhalt 376 px, Schrift 77 px; mobiler Festwert in `src/styles.css:2358`. [Screenshot](docs/audit-2026-11-01/archive-mobile.png) | Primärer Inhalt abgeschnitten. Responsive Typografie statt Verstecken: **W02** |
| A03 | **C:** `surfaceColors('#949494')` liefert `#F2F3EF` (`src/journalModel.ts:17`). Nach WCAG-Luminanzformel Kontrast **2,722:1**; auch unter 3:1 für großen Text. Die alternative bestehende dunkle Markenfarbe erreicht hier nur **4,495:1**, also knapp unter 4,5 ohne Rundung | Automatische Lesbarkeit ist bei erlaubten Benutzerfarben nicht sichergestellt. Berechnen und neutralen Fallback erlauben: **W03**. [Kontrastanforderung](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |

Keine dieser drei Stellen wurde im Audit korrigiert. Alle sind direkt nachprüfbar; keine spekulative Fehlerliste.

## Produktbewertung nach Nutzerweg

| Bereich | Bewahren | Qualitätslücke und Art der Aussage | Entscheidung |
| --- | --- | --- | --- |
| Erste Wahrnehmung | ruhige Grau-/Olivwelt, Serif/Kursive, Wortmarke, großes Cover | **S/B:** emotional und hochwertiger als ein Standardblog; der sichtbare Einstieg erklärt kaum, dass Besucher eigene Fotojournale gestalten können. **C:** auf Mobil entfällt `intro-aside`; dadurch noch weniger Erklärung. Cover und Selected Story verwenden dieselbe neueste Reise | Erst Produktnutzen und zwei Einstiege klar machen, Bildidentität behalten: W05 |
| Archiv | Magazin/Index, Sortierung, Bild-/Metadatenhierarchie | **B:** beide Ansichten funktionieren mit einer Reise. **U:** viele Reisen und lange eigene Titel. **S:** ein bewusstes Sammlungsraster und ruhigere Metadaten würden stärker kuratieren | A02 zuerst, Sammlungsfeinschliff später: W02/W05 |
| Story | gemeinsamer Renderer, Quelle/Placement getrennt, zwei Editionen, Originalansicht | **S/C:** großer Ausdrucksspielraum; Ausgaben brauchen einheitliche Kapitelorientierung. **U:** Rhythmus über sehr lange und heterogene reale Inhalte | leichte Kapitelnavigation aus vorhandenen Daten, keine Umsortierung: W06 |
| Galerie / Lightbox | native Dialoge, Fokus-Rückgabe, Historyeintrag, Tastatur, freie Reihe ohne Snap | **B:** einfacher Tastaturfall funktioniert. **C:** Bildwechsel ersetzt `img src`, kein koordiniertes Decode-/Nachbar-Preload-/Übergangsmodell; Ladefläche kann bis zum neuen Bildinhalt leer wirken. Schnelle Wechsel/Netzfehler **U**, daher Risiko statt behauptetem Defekt | A01 beheben, danach begrenzte Zustandsverbesserung: W01/W07 |
| Neue Reise | Fotos zuerst, Edition als reversibler Startpunkt, kein Entwurf vor erstem Upload | **B/S:** sinnvoller Ansatz; bei 390 px stehen zwei große Editionskarten vor der Uploadaktion. Der Weg von Foto zu komponierter Geschichte bleibt wenig erklärt | Einstieg neu gewichten, keine Pflichtformulare oder neue Erstellungs-API: W09 |
| Editor | direkte Auswahl, gemeinsamer Renderer, Miniatur aus derselben Wandlogik, feine Bildkontrolle | **B/S:** mächtig, aber wie eine Sammlung gleichwertiger Einstellungen. Globale/Modul-/Placement-Wirkung braucht stärkere Sprache und Gruppierung. Mobil fehlt gleichzeitige Sicht auf Ergebnis und Einstellungen | Modulwahl/Inspector gezielt überarbeiten, Shell und Datenmodell erhalten: W09/W10 |
| Speichern / Veröffentlichung | gut unterscheidbare Status, 850-ms-Autosave, Recovery, atomare Composition | **B/T:** Titelspeicherung/Reload und Snapshotmechanik belegt. **C:** Veröffentlichen ruft direkt `save(true)` auf. **S:** ruhige Abschlusskontrolle würde Vertrauen erhöhen; kein belegter Save-Defekt | kleine Preflightansicht vor Veröffentlichung; keine zweite Save-State-Maschine: W11 |
| Mobil | eigener Menüpfad und drei Editorbereiche, 390-px-Vorschau | **B:** grundsätzlich verwendbar. **S:** Status/Toolbar belegen viel Platz, globaler Bewegungsschalter sitzt nahe den Arbeitsflächen. Überdeckung bei Tastatur/Safe Area **U** | W02/W04/W10; echte Geräte als Gate |

## Technische Risiken, Wartbarkeit und Optionen

- **R01 — konkurrierende Clients (C/U):** Kein Versionsfeld oder Konfliktvergleich im Composition-Vertrag. Zwei Tabs können auf unterschiedlichen Gesamtständen arbeiten. Kein beobachteter Datenverlust; vor Mehrbenutzerbetrieb zwingend A1 entscheiden. Die Premium-Roadmap behauptet keinen Kollaborationsschutz.
- **R02 — asynchrone Bildwechsel (C/U):** PhotoViewer besitzt kein explizites Fehler-/Decode-/Preload-Modell. `Picture` hält `loaded` als lokalen Zustand und setzt ihn bei Quellewechsel nicht ausdrücklich zurück. Das ist ein zu prüfender Bildersetzungsfall, kein bereits reproduzierter Flash. W07 begrenzt sich auf den Viewer; andere Bildfälle im finalen Gate gezielt prüfen.
- **R03 — Preview-/Scroll-Semantik (C):** `duration` beeinflusst Scrollglättung, `delay` wird für Preview-Playback als CSS-Verzögerung genutzt. Derselbe Regler bedeutet also keine universelle Zeitverzögerung. Erst beschriften/erklären, keine Migration gespeicherter Animationen: W04.
- **M01 — CSS-Kaskade (C):** fünf globale Stylesheets, rund 9.300 Zeilen, wiederholte Regeln und späte Overrides; z. B. `home-intro` in mehreren Dateien. Wartungs- und Regressionsrisiko, kein Beweis für schlechte Laufzeit. Semantische Tokens und zwei kleine Pilotbereiche genügen zuerst: W04.
- **M02 — Verantwortungsdichte (C):** `ModularEditor.tsx` 2086 Zeilen, `StoryExperience.tsx` 879, aktiver älterer Setup-Pfad 1544. Nicht nach Zeilenanzahl zerlegen; UI-Änderungen lokal halten, Logik nur bei tatsächlicher Wiederverwendung auslagern.
- **M03 — Testgrenze (C/T):** reine Frontendlogik und breite Backendfälle, aber keine installierte DOM-/E2E-Umgebung. Native Browserfälle protokollieren; keine Behauptung, dass 103 Tests Fokus, Renderparität oder Gesten absichern. Keine neue Testabhängigkeit als Nebenwirkung.
- **O01 — initiales Laden (C):** App importiert Studio/Editor über statische Routenimporte mit. Ein JS-Einstieg von 453,36 kB ist kein gemessener Performancefehler. Gezieltes Lazy Loading des Studiobereichs ist plausibel; Nutzen vor/nachher messen: W12.
- **O02 — Medienkosten (C/U):** responsive WebP-Varianten, feste Dimensionen und Lazy Loading sind vorhanden; einzelne 2200er Demoassets liegen im MB-Bereich. Tatsächliche Auswahl/Requests und LCP sind ungeprüft. Keine pauschale Neuencodierung oder Behauptung schlechter Web Vitals.

Kein Anlass für neuen Store, neues CSS-Framework, neue Datenbank oder Austausch des Editors. Servervalidierung, CSRF, Snapshot und referenzbewusste Löschung sind hochwertige vorhandene Entscheidungen. Sie sind für das aktuelle lokale Betriebsmodell sinnvoll; das ist keine Sicherheitsprüfung für öffentliches Hosting.

## Vergleich mit Referenzprodukten

Alle sechs vorgegebenen Websites wurden im nativen Browser erreicht. Desktop-Ansichten und ausgewählte mobile Ausschnitte wurden betrachtet; keine Konten angelegt, keine bezahlten/automatischen Erstellungsläufe, keine Anbieter-Editoren praktisch getestet. Web-Textabruf scheiterte für Readymag mit 403 und ARK mit Timeout; der native Browser funktionierte. Live-Seiten hatten teilweise andere Texte als der Suchindex; direkte Beobachtung hat Vorrang.

| Referenz / tatsächlich untersuchte Ansicht | Direkt beobachtet | Anbieterbehauptung / ungeprüft | Interpretation für WANDER |
| --- | --- | --- | --- |
| [MIRA](https://mirastories.app/de), [öffentlicher Reiseessay](https://mirastories.app/de/studio-mira/drei-wochen-ein-rucksack-drnd7FTS), Desktop und mobil | klare Ergebnisbeschreibung, sichtbarer Erstellen-/Demo-Einstieg, Kapitelübersicht mit Bildkacheln, wechselnde Bild-/Textgruppen | automatische Auswahl, Schreiben und Erstellungsgeschwindigkeit nur Anbieterangaben; Bearbeitungsprozess nicht getestet | Ergebnis früh zeigen und den nächsten Schritt erklären; kuratierte Startkomposition. Keine KI-Automation ungefragt nachbauen |
| [Exposure](https://exposure.co/), [Lappland & Lofoten](https://jonasjacobsson.exposure.co/lappland-lofoten-part2), Desktop/mobiler Essay | Titelbild, klare Autorenschaft, lange gut abgegrenzte Textpassagen, große Bildabschnitte, zurückhaltende Leseroberfläche | Komfort des Editors, Responsive-Versprechen und Uploadkapazität nicht praktisch geprüft | Autor und Geschichte führen, Werkzeugoberfläche zurücknehmen; Textpausen statt Daueranimation |
| [Readymag](https://readymag.com/), Start und Beispiele, Desktop/mobil | collageartige Präsentation, starke Typografiekontraste, wechselnde Kompositionen, mobile horizontale Beispielausschnitte; ein Medienelement meldete fehlende Wiedergabe | freies Gestalten und Editorqualität nicht durch eigenes Erstellen überprüft | gestalterische Vielfalt durch kleine bewährte Kompositionen anbieten; WANDER braucht dafür keinen freien Pixelcanvas |
| [Semplice](https://www.semplice.com/), Hero und Editorabbildung, Desktop/mobiler Inhaltsausschnitt | selbstbewusste Typografieskala, dominante Farbfelder, groß gezeigtes Ergebnis, kontextbezogene Werkzeuge in der Editorabbildung | Grid-/Drag-and-drop-/Animationsbedienung sind Anbieterbeschreibung bzw. Demonstration, kein eigener Bediennachweis | Werkzeuge um die gewählte Aufgabe ordnen; Ergebnis bleibt der Mittelpunkt. Nicht die gelbe Markenwelt übernehmen |
| [Apple MacBook Pro](https://www.apple.com/de/macbook-pro/), verlinkte [Produktdetailseite](https://www.apple.com/de/macbook-pro/proled-xdr-display/), Hero/Highlights, Desktop/mobil | prägnante Titelhierarchie, isoliertes Produktmotiv, anhaftende Lokalnavigation, sichtbare Sequenz-/Wiedergabekontrollen | einige Scroll-/Medienabschnitte erschienen im Test schwarz bzw. unvollständig. Framepacing, vollständige Choreografie und Reduce-Motion-Qualität nicht verifiziert | Fokus und Zustandskontinuität übernehmen; keine angeblich gemessenen Apple-Easings und keine leeren Scrollstrecken reproduzieren |
| [ARK Journal](https://www.ark-journal.com/), [Artikel](https://www.ark-journal.com/double-take-the-house-that-halldor-gunnlogsson-built-twice/), Desktop/mobiler Textausschnitt | großzügige Ränder, ruhige Bildfelder, zurückhaltende Serif, feine Trennlinien, redaktionelle Bild-/Textspalten | Artikelbilder luden teilweise unvollständig; mobile Betrachtung nur Ausschnitt, keine vollständige Navigation-/Accessibility-Prüfung | Vertrauen in Fotografie, sparsame Metadaten und bewusstes Weißraumverhältnis. Große Leerflächen müssen auch inhaltlich tragen |

Diese Referenzen sind ein Prinzipienvergleich, kein belastbares Ranking ihrer Gesamtprodukte. WANDERs eigenständige Mischung: kontrollierte Präzision + intime Editorial-Fotografie, ergänzt um wenige filmische Übergänge.

## Umfang der empfohlenen Veränderung

| Kategorie | Entscheidung | Gewinn / Aufwand / Risiko |
| --- | --- | --- |
| Bereits besonders gut | gemeinsamer Renderer, nicht destruktive Bildverwendung, Save-/Publish-Trennung, native Dialogbasis erhalten | hoher Wert; Austausch hätte hohen Aufwand und unnötiges Datenrisiko |
| Präzises Feintuning | Umbruch, Kontrast, Metadatengröße, Ausrichtung, Touchflächen, gemeinsame Motiontokens | sichtbar/bedienbar hoher Gewinn; kleiner bis mittlerer Aufwand, geringes Risiko bei engem Scope |
| Größere Überarbeitung | Inspectorpriorisierung, mobile Auswahlkontinuität, Lightbox-Ladezustände, Veröffentlichungsabschluss | hoher UX-Gewinn; mittlerer Aufwand, bei Zustandslogik mittleres Risiko → Sol |
| Voraussichtlich bessere neue Lösung | geführte Kompositionswahl anstelle gleichgewichtiger Modulliste; klarer Leser-/Gestalter-Einstieg anstelle rein atmosphärischer Produktkommunikation | hoher erwarteter Nutzen; M-Aufwand mit vorhandenen Modulen, keine Modellmigration. Erst Nutzersicht freigeben |

Die fünf größten Hebel: robuste Lesbarkeit; klare Leser-/Gestalterwege; kontrollierte Bild-/Routenübergänge; aufgabenbezogener Editor; kuratierter Storyrhythmus. Die ausführbare Kette samt Freigaben steht ausschließlich im [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md), die Worker-Prompts im [AGENT_TASKS.md](AGENT_TASKS.md).

## Projektregeln: gezielte Verbesserungsvorschläge

`AGENTS.md` bleibt unverändert. Die Regeln passen grundsätzlich zu einem sicheren inkrementellen Vorgehen. Drei mögliche spätere Klarstellungen:

1. Erhalt der visuellen Identität als Standard formulieren, ausdrücklich freigegebene Redesignaufgaben ausnehmen. Der aktuelle strategische Auftrag darf schwache Entscheidungen infrage stellen, autorisiert aber keinen Umbau.
2. Für reine Audit-/Dokumentationsaufträge Originalcheckout und Ergebnisdokumente ausdrücklich erlauben; Anwendungsänderungen weiterhin nur im freigegebenen Worktree. So wird kein unnötiger Integrationsschritt für bloße Analyse erzeugt.
3. Laufzeitangaben datieren statt als feste Fähigkeiten behandeln: `docs/DEVELOPMENT.md` nennt vier Laufplätze, diese Sitzung bietet zwei einschließlich Hauptagent. Die strengere Projektgrenze von einem Subagenten bleibt passend. Historisch offenes T7 ist schon implementiert; Status später gezielt berichtigen, keinen Doppelauftrag erzeugen.

Jetzt keine Regeländerung, keine alten Aufgaben bereinigt, kein Python-Orchestrator ausgeführt. Strategieunterlagen sind beratend; bestehende Sicherheits-/Freigaberegeln haben weiterhin Vorrang.
