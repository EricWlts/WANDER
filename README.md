# WANDER

Ein lokal ausführbares Fotojournal mit React, TypeScript, Vite, Flask, SQLAlchemy und SQLite. Neutrales Hellgrau, atmosphärische dunkle Flächen, Instrument Serif und Manrope bilden das Gestaltungssystem; eigene Bilder und Texte bleiben von der Oberflächensprache unabhängig.

## Start

Voraussetzungen: Python ab 3.11 und Node.js ab 22.12.

```sh
sh setup.sh
npm start
```

[WANDER öffnen](http://127.0.0.1:5173). Frontend: Port 5173, Backend: Port 5001, jeweils nur auf dem lokalen Rechner. Beide Prozesse enden mit Strg+C. Nach Änderungen am Python-Backend neu starten. Der gebaute Stand kann mit `npm run backend` auch allein auf Port 5001 ausgeliefert werden.

Das zufällige Studio-Passwort erscheint nur beim allerersten Start im Terminal. Ein bestehendes Passwort wird durch das Update nicht verändert. Zurücksetzen:

```sh
.venv/bin/python -m flask --app backend.app:create_app reset-password
```

Das neue Passwort wird verdeckt abgefragt; mindestens zwölf Zeichen. `.env.example` dokumentiert optionale Variablen. `.env` wird nicht automatisch geladen.

## Reisen gestalten

1. **Mein Studio → Neue Reise:** Edition als Startpunkt wählen und Fotos hochladen. Erst beim Upload entsteht ein privater Entwurf. Anschließend „Deine Reise gestalten“ öffnen.
2. **Direkt in der Vorschau auswählen:** Ein Bild öffnet Zuschnitt und Bilddetails; Überschriften und Modulflächen öffnen ihre passenden Einstellungen. Links stehen die Module, rechts die Einstellungen. Auf kleinen Geräten wechseln die drei unteren Schaltflächen zwischen Modulen, Vorschau und Einstellungen.
3. **Module hinzufügen:** Tag/Kapitel, Titelbild, Einzelbild, Bildpaar/Gruppe, manuelle horizontale Bildreihe, laufender Fotostreifen, Fotowand, Text oder Zitat. Neue Module können auch innerhalb eines Tages liegen. Pfeile ändern die Lesereihenfolge; Duplizieren verwendet dieselben Fotos. Entfernen eines Moduls erhält seine Ausgangsfotos. Die Fotosammlung bietet Upload, Bildbearbeitung und eine eigene Reihenfolge.
4. **Gestaltung kombinieren:** Quiet Atlas verbindet neutrales Hellgrau mit offenen Kompositionen und ins Titelbild integrierter Schrift. After Hours verwendet dunkle Flächen und filmische Bildflächen. Jedes Modul kann die Reiseedition übernehmen oder ausdrücklich eine andere Edition nutzen. Reise und Module besitzen Farbvorschläge, Farbwähler, HEX-Eingabe und Rücksetzung; die Standardschriftfarbe passt sich dem Hintergrund an.
5. **Layouts anpassen:** Bildformat, Abstände, Spalten, Zeilen, Spaltenversatz und Typografie sind einstellbar. Fotowände bieten editierbare Plus-/Minus-Felder für 1–8 Spalten und 1–12 Zeilen pro Gruppe sowie eine echte Live-Miniatur. Zusätzliche Fotos beginnen eine weitere Rastergruppe; die letzte Zeile darf unvollständig sein. Negative Abstände erzeugen Überlagerungen, positive und negative Versätze verändern mittlere oder einzelne Spalten. Fokussierte Fotos rücken nach vorne. Mobile Spalten übernehmen höchstens zwei Desktopspalten; Versätze entfallen auf kleinen Bildschirmen. Leere mobile Abstandsfelder übernehmen die Desktopwerte; eigene mobile Werte überschreiben diese Vererbung.
6. **Bilder bearbeiten:** Originalformat, freies Seitenverhältnis, 1:1, 3:2, 4:3, 4:5 und 16:9. Ziehen verschiebt den Ausschnitt, Klicken setzt den Fokus; Schieberegler ermöglichen dieselben Änderungen per Tastatur. Vollständige Darstellung, flächenfüllender Zuschnitt, Zoom und Zurücksetzen sind verfügbar. Jede Verwendung desselben Bildes besitzt einen eigenen Ausschnitt. „Bild auswählen“ ersetzt sie durch ein vorhandenes Foto; „Neues Bild hochladen“ ergänzt genau einen Sammlungseintrag. Der sichtbare Zurück-Button und Browser-Zurück führen zur Fotowand zurück. Bearbeitung aus der Fotosammlung setzt die allgemeinen Bildwerte. Titel sind standardmäßig aus. „Titel anzeigen“ aktiviert sie ausdrücklich; alternative Beschreibungen bleiben davon unabhängig. Neue Uploads übernehmen keinen Dateinamen als Bildtitel.
7. **Text und Bewegung:** Position links/mittig/rechts/volle Breite und Textausrichtung sind getrennt. Vier Schriftgrößenvorgaben, Zeilenbreite, Schriftstil und Textfarbe sind direkt verfügbar; Feineinstellungen bleiben aufklappbar. Neue Textmodule sind statisch. Aktivierte Reveals blenden um die Bildschirmmitte kontinuierlich in beiden Scrollrichtungen ein und aus. Der Reiseschalter deaktiviert alle Textanimationen, ohne ihre individuellen Einstellungen zu löschen. Bildmodule bieten Einblenden, vier Richtungen, Zoom und gegebenenfalls Parallax. Dauer, Verzögerung und Intensität liegen unter den erweiterten Einstellungen. Die Systemeinstellung für reduzierte Bewegung und der gespeicherte Bewegungsschalter werden beachtet.
8. **Prüfen und speichern:** Desktopvorschau mit 1200 Pixeln und Mobilvorschau mit 390 Pixeln verwenden dieselbe Darstellung wie die Reiseseite und skalieren in den verfügbaren Platz. Die Besuchervorschau entfernt Auswahlrahmen und Bearbeitungsflächen. Änderungen werden nach kurzer Eingabepause automatisch als privater Arbeitsstand gespeichert; während einer laufenden Speicherung vorgenommene Änderungen werden anschließend übernommen. Der Status nennt offene, gespeicherte und unveröffentlichte Änderungen. Speicherfehler bieten einen erneuten Versuch, lokale Wiederherstellung schützt ungesicherte Änderungen beim Neuladen. „Veröffentlichen“ aktualisiert ausdrücklich die öffentliche Version.

DE/EN oben in der Navigation wechselt die gesamte primäre Oberfläche und speichert die Auswahl lokal. Datumsangaben folgen dieser Wahl; persönliche Reiseinhalte werden nicht übersetzt.

## Galerien und Uploads

- Die manuelle Bildreihe unterstützt Trackpad, Touch, Mausziehen und Tastatur. Sie bleibt frei an jeder Zwischenposition stehen, ohne Scroll-Snapping oder künstliche Hinweisbewegung. Scrollbalken, Hover-Pfeil und Scroll-Hinweis entfallen. Eine angeschnittene nächste Fotografie vermittelt die horizontale Fortsetzung. Jedes Bild öffnet seine eigene Position in der Lightbox, auch bei wiederholten Motiven.
- Der laufende Fotostreifen hält beim Darüberfahren nicht an. Ein kleiner zugänglicher Pausenschalter sowie der globale Bewegungsschalter steuern ihn. Außerhalb des Sichtbereichs und in inaktiven Tabs wird pausiert. Reduzierte Bewegung erzeugt eine statisch scrollbar nutzbare Folge.
- Die Lightbox unterstützt Pfeile, Tastatur, horizontales Trackpad und Touch-Wischen. Eine Geste wechselt höchstens ein Bild; das nächste Bild wird erst nach einer Ruhephase freigegeben. Browser-Zurück schließt zuerst die Lightbox. Dialoge stellen Fokus und Seitenposition wieder her; die Bildreihe bleibt montiert und behält ihre Position.
- Uploads zeigen Dateiname, „Bild X von Y“, echten Übertragungsfortschritt und anschließend eine unbestimmte Aktivitätsanzeige für die Bildaufbereitung. Es gibt keine erfundenen Verarbeitungsprozente oder Restzeit. Fehler erscheinen pro Bild und lassen sich einzeln wiederholen. Uploadschlüssel verhindern doppelte Einträge bei Wiederholung derselben Anfrage.
- Uploads direkt im gespeicherten Tag erscheinen in der zentralen Sammlung und sind diesem Tag zugeordnet. Auch eine ausdrückliche Bildauswahl des Tages wird erweitert. Ein neuer Tag wird vor dem direkten Upload gespeichert.

## Architektur und Datenbestand

| Bereich | Verantwortung |
| --- | --- |
| `App.tsx`, `Studio.tsx` | Navigation, Anmeldung, Zugriffsschutz und Reisebibliothek |
| `NewJournal.tsx` | Fotoorientierter Einstieg mit privatem Entwurf |
| `ModularEditor.tsx` | Arbeitsstand, Auswahl, Seitenvorschau und Einstellungsbereiche |
| `JournalCanvas.tsx` | Gemeinsame Darstellung für Editor, Besucher und Tagesansicht |
| `journalModel.ts`, `PhotoWall.tsx` | Bildverwendungen, speichersichere Zusammenführung und gemeinsame Fotowand-Geometrie |
| `EditorControls.tsx`, `ModuleSettings.tsx`, `ModulePhotographs.tsx` | Farben, Zahlenfelder, Typografie, Wandvorschau und Bildverwendungen |
| `ImageControls.tsx`, `Upload.tsx` | Bildausschnitt, Bildmetadaten und Uploadwarteschlange |
| `Motion.tsx`, `Reveal.tsx`, `MotionControl.tsx` | Bewegungseinstellungen, Parallax und reduzierte Bewegung |
| `StoryExperience.tsx` | Editionen, Bildreihen, Fotostreifen, Lightbox und Tagesgalerie |
| `I18n.tsx`, `translations.json` | Sprachwahl, Übersetzungen und Fehlermeldungen |
| `journal.css`, `refinement.css` | Gemeinsame Gestaltungsregeln, neutrale Farbwerte und responsive Editoransichten |
| `backend/app.py` | API, Validierung, atomare Kompositionsspeicherung und Veröffentlichungsstände |
| `backend/models.py`, `backend/migrations.py` | Datenmodell und additive Migration mit vorheriger Sicherung |

Eine Reise besitzt geordnete `Chapter`-Module und eine zentrale `Photo`-Sammlung. Vorhandene `chapter_id`- und `layout.photo_ids`-Zuordnungen bleiben gültig. Neue Bildverwendungen stehen in `layout.placements`: Jede hat eine stabile eigene ID, eine `photo_id` und optionale Anzeigeeinstellungen. Dasselbe Foto kann dadurch mehrfach mit verschiedenen Ausschnitten vorkommen, ohne weitere Dateien anzulegen. `layout.parent_id` ordnet Module einem Tag zu. JSON-Einstellungen speichern Layouts und Farben; `Photo.edits` enthält allgemeine Bildwerte. `Journey.published_data` hält den zuletzt ausdrücklich veröffentlichten Stand.

`PATCH /api/journeys/:id/composition` validiert und speichert Reise, Module, Reihenfolge und Bildbearbeitungen in einer Datenbanktransaktion. Ungültige Änderungen werden vollständig zurückgerollt. Bestehende CRUD-, Upload- und Medienrouten bleiben verfügbar. Anmeldung, CSRF-Prüfung, Entwurfszugriff und lokale Dateispeicherung werden weiterverwendet.

Die Migration ergänzt nur Spalten. Vor einer Änderung an einer bestehenden SQLite-Datenbank entsteht eine transaktionale Sicherung in `.instance/backups/`. Die Demo wird weiterhin nur bei einer neu angelegten Datenbank eingefügt. Bestehende Reisen, Bilddateien, Texte, Zuordnungen und Reihenfolgen werden beim Update nicht umgeschrieben.

## Routen

| Route | Inhalt |
| --- | --- |
| `/`, `/archive`, `/about` | Journal, Archiv und Informationen |
| `/inspiration` | Vergleich der Editionen mit identischem Beispielbild und Titel; mobil umschaltbar |
| `/inspiration/:id` | Vorhandene fiktive Referenzessays |
| `/journeys/:slug` | Besucherseite des veröffentlichten Standes; für angemeldete Nutzer auch private Entwürfe |
| `/studio` | Anmeldung und Reisebibliothek |
| `/studio/new` | Neue Reise, Fotos zuerst |
| `/studio/:slug`, `/studio/:slug/edit` | Direkter modularer Editor |
| `/studio/:slug/setup` | Erhaltener älterer geführter Ablauf |

## Bilddateien und Zugriff

JPEG, PNG und WebP bis 128 MiB und 100 Megapixel werden geprüft, nach EXIF-Orientierung und gegebenenfalls sRGB-Konvertierung normalisiert und ohne private EXIF/GPS-Metadaten gespeichert. Die verlustfreie Vollauflösungskopie ist keine bytegleiche Archivierung der hochgeladenen Datei. Anzeigevarianten bis 640, 1280, 2200 und 3840 Pixel sind optimierte WebP-Dateien; es wird nicht hochskaliert. Das Layout speichert Ausschnitte ausschließlich als Einstellungen und verändert diese Bilddateien nicht.

Medien liegen außerhalb des öffentlichen Frontends. Entwürfe und neue noch unveröffentlichte Medien sind nicht öffentlich abrufbar. Ein veröffentlichter Link ist keine private Freigabe. Mitgelieferte Bildquellen und Schriftlizenzen stehen in `ASSETS.md` und auf der About-Seite.

## Prüfungen und Grenzen

```sh
npm run test:all
npm run build
```

Tests verwenden eigene Datenbanken und Uploadverzeichnisse. Den Abnahmeumfang und verbleibende Grenzen dokumentiert [IMPLEMENTATION.md](IMPLEMENTATION.md).

WANDER bleibt eine lokale App mit einem Administrator. Cloudhosting, Mehrbenutzerkonten, Bildexport mit eingebranntem Zuschnitt und private Freigabelinks gehören nicht zu dieser Umsetzung. Für Hosting sind unter anderem HTTPS, ein Produktionsserver, dauerhafte Uploadspeicherung und Backups erforderlich.
