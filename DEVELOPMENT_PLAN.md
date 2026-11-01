# WANDER — ausführbarer Entwicklungsplan

01.11.2026 · Planungsauftrag abgeschlossen, **keine Implementierung beauftragt**. Evidenz: [PRODUCT_AUDIT.md](PRODUCT_AUDIT.md). Gestaltung: [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md). Eigenständige Aufträge: [AGENT_TASKS.md](AGENT_TASKS.md).

## Ergebnis der strategischen Prüfung

Der ursprüngliche Plan ist eine gute Zuverlässigkeits- und UX-Roadmap, aber noch kein ausreichender Nachweis außergewöhnlicher Gestaltung. Die größte Lücke war eine ausführbare Art Direction: W05 beschränkte sich weitgehend auf Text/CTA, W06 auf Navigation, W04 blieb ein isolierter Pilot. Die überarbeitete Fassung ergänzt eine gemeinsame visuelle Referenz, verbindliche Kompositionsregeln und deren Rollout innerhalb derselben 13 Pakete. Kein Komplettumbau und keine neue Architektur sind aus den Dokumenten begründbar.

**Bereit zur schrittweisen Beauftragung**, sobald der Nutzer den jeweiligen Auftrag startet. W01–W03 brauchen keine neue Markenentscheidung. Vor W04 müssen Zielpublikum und Designrichtung feststehen; G1 bestätigt die konkrete Bild-/Typokomposition vor der breiteren Umsetzung. Das 9/10-Ziel bleibt eine zu belegende Qualität, keine Zusage. Diese Prüfung ist dokumentbasiert; technische Risiken aus dem Ausgangsaudit wurden nicht erneut im Code verifiziert.

## Priorität und Arbeitsweise

Zuerst drei nachgewiesene Reibungen beseitigen, danach Präzision und Produktführung auf vorhandener Architektur ausbauen. Sichtbare Verbesserungen müssen nicht auf einen Gesamtrefactor warten. Save-/Publish-Verträge und Benutzerinhalte bleiben die feste Grenze.

S = kleine lokale Aufgabe; M = begrenzter Bereich mit mehreren Zuständen/Ansichten; L = gekoppelte Interaktion mit intensiver Prüfung. Das sind relative Größen, keine Stunden-, Token- oder Preiszusagen. Gewinn und Risiko sind fachliche Erwartungen vor Umsetzung. Die Reihenfolge berücksichtigt Nutzerrelevanz und Abhängigkeiten, nicht einen scheinpräzisen ROI-Score.

| ID | Ergebnis / Nutzen | Modell / Reasoning | Gewinn / Nutzerrelevanz | Aufwand | Risiko | Startbedingung in der empfohlenen Reihenfolge |
| --- | --- | --- | --- | --- | --- | --- |
| W01 | Manuelle Bildreihe bleibt an ihrem Ort | `gpt-6-luna` / low | hoch für Kontrolle, unmittelbar sichtbar | S | gering | Auditkontext verfügbar |
| W02 | Mobile Überschriften vollständig lesbar | `gpt-6-luna` / low | hoch, primärer Inhalt | S | gering | W01 technisch geprüft |
| W03 | Automatische Textfarbe erfüllt Kontrastziel | `gpt-6-luna` / medium | hoch, alle Benutzerfarben | S | gering–mittel | W02 geprüft |
| W04 | Visuelle Referenz und gemeinsame Maßstäbe für Typografie/UI-Motion | `gpt-6-luna` / medium | hoch, übergreifende Präzision | M | mittel: CSS-Kaskade | Gate G0; Designrichtung bestätigen |
| W05 | Start und Archiv erhalten eigenständige Bildhierarchie und klare Nutzerwege | `gpt-6-luna` / medium | sehr hoch, Ersteindruck/Orientierung | M | gering–mittel | Gate G1 |
| W06 | Storyrhythmus und Kapitelorientierung aus vorhandenen Modulen | `gpt-6-luna` / medium | mittel–hoch, lange Geschichten | M | gering–mittel | Gate G2 |
| W07 | Lightbox wechselt Bilder geladen, stabil und unterbrechbar | `gpt-6.1-sol` / medium | sehr hoch, fotografischer Kern | M–L | mittel: Async/History | W06 geprüft, Motionvorgaben G1 |
| W08 | Cover-zu-Story-Wechsel mit nachvollziehbarer Kontinuität | `gpt-6.1-sol` / medium | hoch, emotionale Verbindung | M | mittel: Routen/Laden/Scroll | W07 geprüft |
| W09 | Fotoeinstieg und Modulwahl vermitteln einen einfachen nächsten Schritt | `gpt-6-luna` / medium | sehr hoch, Erstgestaltung | M | gering–mittel: UI in großem Editor | Gate G3 |
| W10 | Inspector priorisiert Aufgaben und hält mobilen Auswahlkontext | `gpt-6.1-sol` / medium | sehr hoch, tägliche Gestaltung | M–L | mittel: Auswahl/iframe/Fokus | W09 geprüft |
| W11 | Veröffentlichung mit klarer Abschlusskontrolle | `gpt-6.1-sol` / medium | hoch, Vertrauen und Fehlervermeidung | M | mittel: Savezustände | W10 geprüft |
| W12 | Öffentlicher Einstieg lädt Studiocode erst bei Bedarf | `gpt-6.1-sol` / medium | mittel; tatsächlicher Gewinn messen | M | mittel: Routen/Importzyklen | Gate G4 |
| W13 | Gesamtabnahme mit belegter Neubewertung | `gpt-6-luna` / medium | erforderlich für belastbares Qualitätsurteil | M | gering, nur Prüfung/Dokumentation | W12 geprüft |
| A1 | Späteres Betriebsmodell entscheiden | `gpt-6-astra` / zunächst low | erforderlich vor geändertem Betriebs-/Konfliktmodell | eigene Entscheidung | hoch bei Implementierung | **separater ausdrücklicher Produktauftrag**, nicht Teil der Kette |

**Reihenfolge ist nicht gleich technische Abhängigkeit:** W01–W03 sind voneinander unabhängig; ihre Reihenfolge begrenzt nur parallele Arbeit. W07 benötigt W06 technisch nicht. W04 liefert die bestätigte visuelle Referenz für W05/W06/W09 und Motionmaßstäbe für W07/W08; W03 liefert die Kontrasthilfe für W10. W08 hängt an bestehendem Router/Scroll/History, nicht an einer neuen Lightbox-API. W09 und W10 bearbeiten getrennte UI-Bereiche desselben Editors; W11 schützt dessen Savegrenze. W12 muss die aus W08 geänderte Routendarstellung erhalten. Die vorgeschlagene serielle Reihenfolge bleibt der Standard; kein Worker startet automatisch den Nachfolger.

W01–W03 sind die günstigsten belastbaren Sofortverbesserungen. W04/W05 haben den größten breiten visuellen Effekt. W07/W10 rechtfertigen Sol wegen Zustandskopplung und Regressionskosten. Kein teurer zusätzlicher Planer für jedes CSS-Paket.

## Phasen und verbindliche Gates

### Phase 0 — belegte Reibungen: W01 → W02 → W03

**G0:** Frontendtests/Build grün, Kontrastfälle getestet; Bildreihe ohne Auto-Verschiebung und Archiv bei 320/390 px kontrolliert. Desktop/DE/EN erhalten. Jede konkrete Änderung als Entwurf prüfen und freigeben, bevor sie integriert wird. Kein Neuaufrollen bereits erledigter T1–T7.

### Phase 1 — Designfundament: W04

**G1 — erste gestalterische Freigabe:** eine konkrete Start-/Storyreferenz gemäß „Verbindliche gestalterische Handschrift“ der Guidelines mit denselben Motiven bei 390/1280 px und in beiden Editionen zeigen; dazu Typografie-/Abstandspilot, Control, Dialog und Bildhover. Vorhandene Module/Wegwerfdaten reichen, kein Templatesystem. Nutzer bestätigt Bildhierarchie, Storyrhythmus und Lesbarkeit bei erhaltener Palette/Schrift. Ein schwieriger Inhaltsfall verhindert eine nur für Demobilder tragfähige Freigabe. Verfügbare Bildrequest-/Lade-/Layoutmessungen und Aufnahmebedingungen als Basis festhalten; fehlende Messungen benennen. Bestehende Autoren-Reveals bleiben kompatibel. Bei abweichendem Geschmack nur den Pilot nachbessern, keine flächige Anwendung vor Bestätigung.

### Phase 2 — öffentliche Präsentation: W05

**G2 — Ersteindruck und Sammlung:** Desktop/Mobil in DE/EN, 0/1/20 Reisen, lange Titel und beide Archivansichten. Nutzer kann nach zehn Sekunden erklären, was WANDER ermöglicht, und Lese-/Gestaltungseinstieg unterscheiden. Das ist ein qualitatives Interviewziel, kein bereits gemessener Usabilitywert. Atmosphäre und Motivwirkung werden gegen die G1-Referenz ausdrücklich freigegeben. Öffentliches Leserangebot und administrativer Studiozugang bleiben unterscheidbar; keine Registrierung versprechen. W05 übernimmt die freigegebenen UI-Maßstäbe auf seinen Flächen.

### Phase 3 — Story und visuelle Kontinuität: W06 → W07 → W08

**G3 — Fotografie-/Motionreview:** beide Editionen, 1/12 Kapitel, wiederholtes Bild mit mehreren Placements, Hoch-/Querformat, Bildfehler, langsames Bildladen, zehn schnelle Pfeilaktionen, Escape und Browser-Zurück, Öffnen/Schließen während Laden. Globale Pause und OS-Reduced-Motion. Nutzer beurteilt Wechseltempo, Bildruhe und Rückkehrgefühl. Keine großen Warteanimationen zwischen Routen. Zusätzlich die kurze Referenzstory und eine lange inhaltsreiche Story vollständig ansehen: Kapitelabstände, Bild-/Textgewicht und Schluss müssen auch ohne Animation überzeugen. W06 verändert nur Standarddarstellung und Navigation, niemals Autorinhalte oder explizite Layoutwerte.

### Phase 4 — Gestaltungsprozess: W09 → W10 → W11

**G4 — vollständige kleine Gestaltungsaufgabe:** mit ausschließlich Wegwerfdaten Fotos hinzufügen → Titel/Edition → Text und Bildpaar → Placement zuschneiden → Desktop-/Mobilansicht → Autosave/Reload → Veröffentlichungskontrolle. Netzfehler/Retry und vorhandene Recovery zusätzlich prüfen. Vor Publish bleibt der Besuchersnapshot unverändert. Neue und vorhandene Reisen müssen gleichwertig bearbeitbar bleiben. Nutzer bewertet Verständlichkeit und Kontrollgefühl; Sol prüft Zustand/Persistenz unabhängig.

### Phase 5 — gezieltes Ladeverhalten: W12

**G5:** vorher/nachher initial geladene öffentliche JS-Menge messen, Editor erst bei Studioaufruf laden, direkte Studio-URL/Chunkfehler/Route-Zurück prüfen. Erster Storyinhalt und Studio dürfen durch Suspense nicht flackern oder zurückspringen. Performance ohne vorhandene Messmöglichkeit ausdrücklich offen halten; keine künstliche Lighthouse-Note.

### Phase 6 — Endabnahme: W13

**G6:** sechs gewichtete Kategorien erneut anhand derselben Inhalte bewerten. Pflichtmatrix Desktop/Mobil, DE/EN, beide Editionen, Reduced Motion, Fokus, Netzwerkfehler, Save/Restore/Publish und Datenkompatibilität. Reale Geräte, Screenreader und Leistungsprofil zählen als eigene Nachweise. Ungeprüfte Pflichtfälle bleiben offen. ≥ 9/10 erst nach Produktfreigabe; keine Hochrechnung aus fertigen Tasks. Zielprofil 9,08 und Mindestbereich 8,5 aus den Guidelines, keine offenen kritischen Daten-/Privatheits-/Bedienfehler.

## Freigabe und wenig Koordinationsaufwand

- **Vor Beginn:** einen einzelnen Worker beauftragen. Empfehlung: W01; die vorliegende Strategieprüfung startet ihn nicht.
- **Vor W04:** Zielpublikum bestätigen: persönliche Reiseausgabe für Leser mit administrativem Studiozugang (Empfehlung) oder demonstriertes Gestaltungsprodukt. Letzteres bleibt ohne Registrierung/Mehrbenutzerversprechen. Bestehende Marke und zwei Editionen erhalten, stärkere Kompositionshierarchie erlauben; repräsentative eigene Motive bereitstellen oder vorhandene Demomotive als Referenz bestätigen. Ein Mehrbenutzer-/Hostingwunsch löst separat A1 aus.
- **Vor G6:** verbindliche Zielgeräte/Browser und die Person für reale Touch-/Screenreaderprüfung festhalten. Nicht verfügbare Nachweise offen lassen; Umfang nicht nachträglich zur Erreichung einer Note verkleinern.
- **Später gestalterisch:** G1 Fundament, G2 Ersteindruck, G3 Bewegung/Bildgefühl, G4 Editor. Technische Nachweise jeweils vorher fertigstellen, damit nur ein konkreter Stand zur Beurteilung vorliegt.
- **Jede Anwendungsaufgabe:** drafting → checking → awaiting feedback → approved → integrated gemäß `AGENTS.md`. Visuelle Phasengates ergänzen die konkrete Übernahmefreigabe. Eine allgemeine Zustimmung zum Plan, ein grüner Build oder Schweigen erlaubt keine lokale Integration.
- Bei Feedback denselben Draft verwenden. Neue Änderungen machen eine frühere Freigabe ungültig. Erst „Diesen Stand übernehmen“ integriert genau den geprüften Stand; kein Commit/Push/Deployment eingeschlossen.
- Die neuen Dokumente sind noch uncommitted. Worker lesen sie über die im Prompt genannten Originalpfade als **schreibgeschützten Kontext**. Nicht ungefragt in einen Worktree kopieren oder committen. Fehlen für die Anwendung notwendige ungesicherte Codeänderungen, stoppen; ein älterer Commit darf sie nicht stillschweigend ersetzen.
- **Entwurfskette ohne Zwangscommit:** Ein neuer Worktree vom unveränderten HEAD enthält zuvor nur lokal übernommene W-Aufgaben nicht. Deshalb einen geeigneten bestehenden Draft mit denselben geprüften Änderungen für den nächsten ausdrücklich beauftragten Task fortführen, wenn Original und Draft bezüglich dieser Änderungen übereinstimmen. Je W-ID Basisrevision **plus Dateihashes/Auftragsdiff** im aktuellen TASKS-Eintrag festhalten; HEAD allein identifiziert uncommittete Arbeit nicht. Frühere freigegebene Deltas gelten als Basis, Review/Integration betreffen nur das neue Delta. Fehlt die Basis oder weicht sie ab, stoppen und den gezielten Übertragungsweg klären; keinen älteren Stand testen oder Nutzerarbeit automatisch committen.
- Nach zwei unterschiedlichen erfolglosen Lösungsversuchen oder einer konkret belegten wesentlichen Unsicherheit: ein begrenzter Astra-Auftrag mit Screenshots, Delta und konkreter Streitfrage. Keine weiteren Varianten auf Verdacht. Reines Geschmacksfeedback erfordert zunächst eine präzisere Zielvorgabe, nicht automatisch ein teureres Modell.

## Modell- und Reviewstrategie

Die aktuelle native Schnittstelle bietet `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra` mit low/medium und weiteren Stufen. Verwendet werden hier zunächst nur low/medium. Ein Spawn mit Modellüberschreibung verlangt `fork_turns="none"`; dann Regeln, Scope und Akzeptanzfälle kompakt mitgeben. Maximal ein Subagent, keine Unterdelegation. Die Sitzung bietet zwei gleichzeitige Plätze einschließlich Hauptagent.

Die [offizielle Modellübersicht](https://developers.openai.com/api/docs/models) ordnet Luna effizienten begrenzten Aufgaben, Sol komplexer Arbeit und Astra anspruchsvollsten Aufgaben zu. Das stützt die grobe Rollenwahl; die konkrete WANDER-Zuordnung ist eine Risikoeinschätzung, kein Modellvergleichstest oder Kostenversprechen. App-Verfügbarkeit aus der tatsächlichen Tool-Schnittstelle prüfen, keine CLI-Schalter erfinden. Die Nutzung des teuren Hauptchats wird durch günstige Worker allein nicht billig: Routineaufgaben in einem frischen Luna-Chat beginnen.

W02 beginnt mit low: klar abgegrenzte Typografiekorrektur; medium erst bei belegtem Kaskaden-/Umbruchproblem. W04–W06 bleiben Luna/medium, weil die konkrete Referenz und Kompositionsregeln die offene Designarbeit begrenzen. W07/W08/W10/W11 und auch W12 bleiben Sol/medium: insbesondere Lazy-Loading mit Fehlerwiederholung und Importzyklen ist keine bloße Importtextänderung. W13 sammelt und bewertet vorhandene Belege mit Luna/medium; ungeklärte Async-/Persistenzbefunde gehen als einzelne Frage an Sol, nicht als erneutes Gesamtaudit. Keine feste Einsparquote ohne Verbrauchsmessung.

W01/W02/W04/W05 und rein darstellende Teile von W06/W09: gezielter Selbstcheck ausreichend, solange keine substanzielle Zustandslogik hinzugefügt wird. W03 als Logikänderung unabhängig durch Luna/medium prüfen. W07/W08/W10/W11/W12 nach Workerabschluss unabhängig durch Sol/medium prüfen. Keine Wiederholung der ganzen Untersuchung: Reviewer erhält nur Diff, relevante Invarianten, Screenshots und vorhandene Ergebnisse. Wird W06/W09 logisch substanziell, zusätzlich Luna-Review; bei iframe-/asynchroner Kopplung an Sol eskalieren.

Pro Übergabe nur W-ID, aktuelle Basis, relevante Guideline-Abschnitte, bestätigte Referenz und Abnahmefälle liefern. Nach Abschluss eine knappe Ergebnisliste in TASKS.md statt wachsender Chat-Zusammenfassungen; vorhandene Prüfbelege nur bei passender Revision wiederverwenden. Neue globale Prüfketten sind kein Ersatz für die lokale Browserabnahme.

Der Worker schlägt keine eigene Freigabe vor, startet keine nächste Aufgabe und führt keinen Merge durch. Ein Review ist keine Produktfreigabe. Astra bleibt für Architektur, ungeklärte wesentliche Zielkonflikte und wiederholtes Scheitern reserviert.

## Bewusst zurückgestellt

Mehrbenutzerkonten, Cloudhosting, private Freigabelinks, Export/PDF, AI-Kuration, Kollaboration und umfassendes Undo/Versionssystem. Diese Funktionen sind nicht nötig, um die bestehende lokale Lese-/Gestaltungserfahrung deutlich zu verbessern. Sie sind auch nicht durch eine visuelle 9/10 abgedeckt. Auch zuverlässig gleichzeitiges Bearbeiten in zwei lokalen Tabs ist nicht zugesichert und löst bei ausdrücklichem Auftrag A1 aus. Vor einem öffentlich nutzbaren eigenständigen Produkt ist A1 mit separater Implementierungsplanung erforderlich; dafür reicht ein Redesign nicht aus.

Der erste konkrete Auftrag ist **W01 an `gpt-6-luna` mit low**. Den vollständigen W01-Block aus `AGENT_TASKS.md` kopieren; keine anderen Aufgaben in demselben Lauf starten.
