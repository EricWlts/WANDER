# Entwicklungsaufgaben

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
