# Architektur — WANDER

## System und Einstiegspunkte
- Lokales Fotojournal für einen Administrator: React 19, TypeScript, Vite 8, React Router 7; Flask/SQLAlchemy/SQLite als Backend. Versionen und Befehle: `package.json`.
- `src/main.tsx`: StrictMode → LanguageProvider → MotionProvider → BrowserRouter → App. Zustand über Hooks, Context und Props; kein zentraler Store.
- `src/App.tsx`: Routen, Authentifizierungsstatus, Benachrichtigungen, Header/Footer. `src/Studio.tsx`: Login/Guard und Reisebibliothek. Der Guard ersetzt keine serverseitige Zugriffskontrolle.

| Bereich | Zuständigkeit / zuerst lesen |
|---|---|
| Öffentliche Seiten | `Public.tsx`: Start, Archiv, About; `StoryExperience.tsx`: Editionen, StoryLoader, Galerien/Lightbox |
| Neuer Entwurf | `NewJournal.tsx`; Einstieg `/studio/new` |
| Aktiver Editor | `ModularEditor.tsx`; `/studio/:slug` und `/studio/:slug/edit` |
| Gemeinsamer Renderer | `JournalCanvas.tsx`, `PhotoWall.tsx`; Besucher und Editorvorschau teilen Darstellung |
| Editor-Bausteine | `EditorControls.tsx`, `ModuleSettings.tsx`, `ModulePhotographs.tsx`, `ImageControls.tsx`, `EditorDialogs.tsx`, `Upload.tsx` |
| Datenlogik | `types.ts`: Verträge; `journalModel.ts`: Bildverwendungen, Farben, Versätze und Save-Merge |
| Bewegung | `Motion.tsx`, `Reveal.tsx`, `revealMath.ts`, `viewport.ts`, `useRailHint.ts` |
| Bestehender Nebenpfad | `StoryStudio.tsx` über `/studio/:slug/setup`; `JourneyBuilder.tsx` derzeit ohne gefundenen Import in `src` — nicht pauschal löschen |
| Server | `backend/app.py`: API/Validierung/Medien; `models.py`, `migrations.py`, `photo_references.py`: Persistenz und Referenzen |

Dateiangaben in der Tabelle liegen unter `src/`, sofern nicht anders angegeben.

## Datenfluss und unveränderliche Regeln
- `Journey` besitzt geordnete `Chapter`-Module und zentrale `Photo`-Quelldatensätze. `layout.parent_id` verschachtelt Module unter einem Tag.
- `ImagePlacement.id` identifiziert eine Bildverwendung, `photo_id` die Quelle. Wiederholte Quellen behalten eigene Reihenfolge und Zuschnitte. Keine Mediendateien zum Duplizieren eines Moduls kopieren.
- `journalModel.ts` erhält Legacy-Zuordnungen (`chapter_id`, `photo_ids`, `photo_edits`, `filmstrip_ids`). Ein explizites leeres Placement-Array bedeutet leer, nicht automatisch Legacy-Fallback. Edits: Quelle → alte Modulwerte → Placement.
- Editor: lokaler Arbeitsstand, Autosave nach 850 ms, laufende Änderungen über Revision/Refs und `mergeSavedJourney` erhalten; temporäre Modul-IDs werden nach Speicherung zugeordnet. Wiederherstellung unter `wander-recovery-<id>`.
- `PATCH /api/journeys/:id/composition` speichert atomar. Speichern und Veröffentlichen sind getrennt; `published_data` schützt die letzte Veröffentlichung. Änderungen daran benötigen Sol und Backendtests.
- `api.ts` kapselt `/api`, Same-Origin-Cookies, CSRF und übersetzte Fehler; Upload per XHR für echten Fortschritt und stabile Retry-Schlüssel. Bestehende Zugriffs- und Medienregeln beibehalten.
- Editorvorschau nutzt ein skaliertes iframe (Desktop 1200 / Mobil 390). Koordinaten, Fokus und Bewegung müssen im passenden Dokument funktionieren; `viewport.ts` berücksichtigen.

## Design- und Codekonventionen
- Redaktionelle Bildgestaltung, Instrument Serif für Akzente und Manrope für Oberfläche; lokale Fonts, Lucide-Icons, bestehende Komponenten (`Field`, `Modal`, `Picture`) wiederverwenden.
- Globale CSS-Kaskade in dieser Reihenfolge: `styles.css` → `builder.css` → `experience.css` → `journal.css` → `refinement.css`. Letzte Datei überschreibt u. a. Basistokens. Reihenfolge nicht verändern; vor Änderungen gezielt alle Regeln des betroffenen Selektors suchen.
- Quiet Atlas: `#ECEDEB`; After Hours: `#20241F`. Vorhandene Variablen und `surfaceColors` nutzen. Responsive Regeln sind verteilt; 760 px ist eine wichtige Editorgrenze, kein universeller Breakpoint.
- Funktionale TSX-Komponenten, benannte Exporte, typisierte Props, unveränderliche Datenupdates; vorhandenen Stil übernehmen. TypeScript ist strikt, unbenutzte Variablen/Parameter sind Fehler.
- UI-Texte über `t`/`tr` aus `I18n.tsx`, deutsche Texte in `translations.json` oder explizit als zweites Argument. `useLocale` für reaktive Sprachwahl; persönliche Inhalte nicht übersetzen.
- Tastatur, zugängliche Namen, Fokus-Rückgabe, DE/EN, globale Bewegungspause und `prefers-reduced-motion` erhalten. Keine Änderungen an Animationen als beiläufige Bereinigung.

## Grenzen und Prüfungen
- Entwicklung: Vite `127.0.0.1:5173`, Proxy `/api` und `/media` zum Backend (Standard `127.0.0.1:5001`). Kein Cloud-/Mehrbenutzersystem. Keine neuen Abhängigkeiten ohne Zustimmung.
- Keine Secrets, Umgebungsvariablen, `.instance`-Daten oder Uploads ändern; keine Migration, Veröffentlichung oder Push als Nebenwirkung einer Frontendaufgabe.
- `npm run test:frontend`: Node-Test-Runner mit TS-Type-Stripping, reine Logiktests in `tests/*.test.ts`; keine DOM-/Browser-Testumgebung. Tests importieren TS-Dateien mit `.ts`; deren transitive Imports beachten.
- `npm run build`: TypeScript + Vite; `tests/` gehört derzeit nicht zum TypeScript-Build. `npm test`: isolierte Backendtests; `npm run test:all` kombiniert beide Testsuiten. Kein Lint-Script vorhanden.
- UI-Änderungen zusätzlich manuell im Browser prüfen; Build/Logiktests belegen weder Darstellung noch Interaktion. Keine Testbibliothek nebenbei installieren.
- Pro Auftrag nur den zugewiesenen Eintrag aus `TASKS.md` und dessen Dateien lesen. Bei größerem Scope stoppen und an Sol übergeben; Systemwechsel zuerst mit Astra entscheiden. Keine präventive Großzerlegung der großen Editor-/CSS-Dateien.
