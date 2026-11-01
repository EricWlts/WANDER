# WANDER — Premium-Designrichtung

Strategischer Vorschlag, 01.11.2026. Keine bereits freigegebene Neugestaltung. Grundlage: [Audit](PRODUCT_AUDIT.md); Ausführung und Freigabepunkte: [Plan](DEVELOPMENT_PLAN.md).

## Leitidee: eine persönliche Reiseausgabe

WANDER soll sich wie eine sorgfältig herausgegebene Reiseausgabe anfühlen: Bilder führen, Worte geben Bedeutung, Werkzeuge treten im richtigen Moment hinzu. Präzision zeigt sich in Ausrichtung, verlässlichen Zuständen und Reaktionsqualität. Editorial zeigt sich in Typografie, Bildrhythmus und Pausen. Filmische Mittel markieren ausgewählte Schlüsselmomente.

Die bestehende Wortmarke, Instrument Serif, Manrope, das helle Grau und dunkle Oliv bleiben die Basis. Kein neuer Look durch andere Fonts, Goldakzente, dekorative Glasflächen oder mehr Effekte. Kein Anspruch auf Apple-Kopie. Die eigene Persönlichkeit kommt aus der fotografischen Intimität und den zwei kombinierbaren Editionen.

## Verbindliche gestalterische Handschrift

Das Ziel ist mehr als saubere Controls: **eine Reiseausgabe mit bewusst wechselnder Bilddichte und wiedererkennbarer redaktioneller Ordnung**. Die Marke bleibt, die Hierarchie und Komposition dürfen sich im freigegebenen W05-/W06-Scope deutlich verändern. Apple-artige Präzision bedeutet unmittelbare Rückmeldung und stabile Zustände; Luxury Editorial bedeutet sorgfältige Bildauswahl und optische Ausrichtung; Cinematic Storytelling bedeutet wenige nachvollziehbare Szenenwechsel. Ein zusätzlicher Effekt allein ist kein Qualitätsgewinn.

- **Auftakt (W05):** ein Hauptmotiv, ein klarer Titelblock und eine kurze Nutzenaussage. Desktop: asymmetrische Gewichtung etwa 7:5 für Bild und Text innerhalb bestehender Container; Mobil: Titel/Nutzen und Handlung vor oder unmittelbar am Bild, kein künstlicher Vollbild-Leerraum. Ein primärer Leseweg, ein nachgeordneter Studiozugang. Keine öffentliche Kontoerstellung suggerieren.
- **Sammlung (W05):** in der Magazinansicht ein dominanter Auftakt, danach ruhigere wiederkehrende Gruppen mit gemeinsamen Textkanten. Der Index bleibt kompakt. Bei einer Reise ein Hauptauftritt plus ergänzender Kontext statt einer zweiten gleich großen Coverkarte; bei null Reisen ein ehrlicher Einstieg. Reihenfolge und Sortierentscheidung bleiben erhalten.
- **Story (W06):** vorhandenes Cover → kurze Eröffnung → Bildsequenz → Detail/Textpause → ruhiger Abschluss als Referenzrhythmus prüfen. Quiet Atlas betont Luft und zusammengehörige Bild-/Captionkanten; After Hours dichtere Bildpräsenz und dunkle Ruheflächen. Kein neues Theme und keine automatische Neuordnung. Fehlt Inhalt für einen Takt, entfällt er ohne Leerblock.
- **Filmische Akzente (W07/W08):** Bildwechsel und Coverübergang sind die zwei bevorzugten Schlüsselmomente. Im übrigen Lesefluss bleibt Fotografie ruhig. Vorhandene Autorenanimationen bleiben kompatibel; die neue UI fügt keine dauernde Choreografie hinzu.

**G1-Referenz:** Mit denselben freigegebenen bzw. vorhandenen Demomotiven eine konkrete Komposition bei 390 und 1280 px und eine kurze Storysequenz in beiden Editionen zeigen. W04 nutzt vorhandene Module und Wegwerfdaten, keine neue Templatefunktion. Festhalten: Bild-/Textgewicht, Umbruch, optische Kanten, Ausschnitt, Kapitelabstand und ruhender Motionzustand. Diese eine bestätigte Richtung wird zur visuellen Referenz für W05/W06/W09; keine erneute Stilfindung pro Worker. Ein schwaches Motivset kann kein CSS in Premiumfotografie verwandeln. Zusätzlich einen unvorteilhaften Inhaltsfall prüfen, damit die Gestaltung auch außerhalb der Referenz trägt.

## Typografie und Maßstab

| Rolle | Zielbereich, als Ausgangspunkt für visuelle Freigabe |
| --- | --- |
| Display | Instrument Serif 64–112 px Desktop, 42–60 px Mobil; optisch prüfen, lange Wörter dürfen den Rahmen nie verlassen |
| Storytitel | 48–100 px Desktop, 36–56 px Mobil; vorhandene explizite Autorgrößen bleiben gespeichert, Darstellung muss trotzdem umbrechen können |
| Zwischenüberschrift | 30–48 px Desktop, 26–36 px Mobil; Wort- und Zeilenabstände statt bloßer Vergrößerung nutzen |
| Lesetext | 18–22 px, Zeilenhöhe etwa 1,5–1,7; meist 45–68 Zeichen pro Zeile, sehr lange Passagen linksbündig |
| Bedienoberfläche | Manrope 13–15 px, Eingabefelder mobil möglichst 16 px; Informationen/Handlungsbeschriftungen nicht in winzigen Versalien verstecken |
| Metadaten | 12–13 px, mobil im Regelfall mindestens 12 px; visuelle Dekoration darf kleiner sein, bedeutungstragende Angaben nicht |

Das sind Rollen, keine pauschale Umskalierung aller bestehenden Inhalte. Serif-Kursive sparsam als inhaltliche Betonung; nicht jedes zweite Wort kursiv. UI-Labels in Satzschreibung, Versalien für kurze redaktionelle Wegweiser. Für lange deutsche Wörter responsive Größe plus kontrollierte Umbrüche; niemals mit `overflow: hidden` den Fehler verdecken. 320/390/768/1280 px und 200 % Textvergrößerung prüfen. Display-Zeilenhöhe als Startwert 0,98–1,08, Storytitel 1,05–1,15; Unterlängen und Kursive dürfen nicht kollidieren. Keine festen Zeilenumbrüche für beliebige Nutzertitel. Desktop-Asymmetrie wird mobil in semantischer Lesereihenfolge gestapelt, nicht nur verkleinert. Rund um betroffene Breakpoints zusätzlich ±1 px prüfen; 760 px ist insbesondere für den Editor relevant.

## Abstände, Raster, Oberflächen

- Skala 4/8/12/16/24/32/48/64/96 px als gemeinsame Ausgangsreihe; 4/8 für zusammengehörige Controls, 16/24 innerhalb einer Gruppe, 32/48 zwischen Gruppen, 64/96 als Kapitelpause. Größere Pausen nur bei nachvollziehbarem Motivwechsel.
- Öffentliche Seiten: bestehende fließende Gutters beibehalten, mobil etwa 20–24 px. Ein gedachtes 12-Spalten-Raster auf Desktop, 4 Spalten auf Mobil dient der Ausrichtung; kein neues Rasterframework nötig. Bildpaare und asymmetrische Kompositionen erhalten gemeinsame Kanten.
- Studio: drei klare Bereiche auf Desktop, mobil die vorhandenen drei Arbeitsbereiche. Primäre Handlung, Auswahl und Speicherzustand bleiben auffindbar. Auswahlwechsel darf Fokus und Leseposition nicht willkürlich zurücksetzen.
- Quiet Atlas: `#ECEDEB` mit `#26302B`, helle Panelabstufungen aus dem Bestand. After Hours: `#20241F` mit `#F2F3EF`. Oliv als sparsamer Akzent; Linien sind Struktur, keine dauernde Umrahmung jeder Fläche.
- Benutzerfarben bleiben frei. Automatische Schriftfarbe muss per tatsächlichem Kontrast gewählt werden; falls die Markenfarben nicht genügen, neutraler Schwarz-/Weiß-Fallback. Explizite Textfarben niemals stillschweigend überschreiben; unzureichenden Kontrast verständlich anzeigen.

## Fotografie und Storyrhythmus

Ein Titelmotiv, eine kurze Eröffnung, eine Bildsequenz, ein Detail, eine Textpause und ein ruhiger Abschluss ergeben einen verlässlichen Anfang. Diese Dramaturgie nutzt vorhandene Module. Sie ist eine Empfehlung, keine Umordnung existierender Reisen.

- Ein dominantes Bild pro erzählerischem Abschnitt. Mehrere gleich große Raster direkt nacheinander nur mit inhaltlichem Grund. Details und Landschaften dürfen unterschiedliche Präsenz erhalten.
- Bildpaar: Beziehung zwischen Motiven; Fotowand: Überblick; horizontale Reihe: selbstbestimmtes Entdecken; Filmstrip: optionaler atmosphärischer Nebenakzent. Die manuelle Reihe bewegt sich ausschließlich durch den Nutzer.
- Zuschnitt folgt dem Motiv. Hochformate werden nicht allein für Gleichförmigkeit abgeschnitten. Jede Verwendung behält eigenen Fokus und Zoom. Lightbox zeigt die Quelle in voller Ansicht; die inszenierte Verwendung bleibt beim Schließen erhalten.
- Caption, Alternativbeschreibung und sichtbarer Bildtitel sind getrennte Funktionen. Keine Dateinamen als Erzählung. Bildfehler benötigen eine stabile, verständliche Ersatzansicht.
- Auf der Startseite nicht dasselbe Titelmotiv mehrfach gleich prominent wiederholen, wenn ein anderer Abschnitt bereits denselben Einstieg erfüllt. Bei nur einer Reise keine künstliche Vielfalt behaupten.

## Zustandsdetails und Zuständigkeit

| Detail | Verbindliche Abnahme / Eigentümer |
| --- | --- |
| UI-Präzision | W04 setzt nur Pilot und gemeinsame Tokens. W05/W06/W09/W10 wenden sie auf ihre Flächen an; W13 prüft verbleibende Inkonsistenzen. Kein stillschweigend unvollständiger Rollout. |
| Bildrahmen | W05/W06 halten Platz anhand vorhandener Bildmaße/Verhältnisse frei. Hauptmotiv nicht beiläufig lazy laden; tatsächlichen Request prüfen. Caption steht unter dem zugehörigen Bild, wichtige Schrift nicht ungeschützt auf wechselnden Motiven. |
| Bildzustände | W07 verantwortet Lightbox inklusive erstem Öffnen, W08 nur Routen-/Coverzustand. Bei W05/W06 einen Quellenwechsel an bestehenden Picture-Verwendungen prüfen; belegte Fehler außerhalb des jeweiligen Scopes separat melden, nicht bis W13 übersehen. |
| Auswahl und Motionbeschriftung | W10 erklärt Reise/Modul/Placement sowie Dauer als Scrollglättung und Verzögerung als Vorschauparameter am tatsächlichen Inspector-Control. Der globale Pauseschalter bekommt diese Autorenparameter nicht zugeschrieben. |
| Publizieren | W11 unterscheidet Fotoquellen von Bildverwendungen, benennt die aktuell geprüfte lokale Fassung und verlinkt nach bestätigtem Erfolg die Besucherversion über die vorhandene Route. Keine Erfolgsmeldung vor Serverbestätigung. |

## Motion-System

Motion erklärt Ursache und räumliche Beziehung. Eingaben wirken sofort; Animation darf anschließend Orientierung schaffen. Keine Scrollsperren, vorgefertigten Warteketten oder Bewegung auf einer manuellen Bildreihe. Körpertext bleibt standardmäßig statisch.

| Kategorie | Dauer / Distanz als Startwert | Begründung und Regel |
| --- | --- | --- |
| Direktes Feedback | 100–160 ms, meist Farbe/Opacity | Fokus, Pressed, kleiner Hover sollen die Eingabe sofort bestätigen; Fokus selbst ohne Verzögerung sichtbar |
| Kleine UI-Zustände | 160–240 ms, 0–6 px | Details, Auswahl und kurze Hinweise benötigen wenig räumliche Strecke |
| Overlay/Lightbox | Eintritt 240–360 ms, Austritt 160–240 ms, 0–12 px | Eintritt etabliert Kontext; Rückkehr wartet kürzer. Bildmotiv muss nicht durch den ganzen Bildschirm fliegen |
| Bildwechsel | 180–280 ms, primär Opacity | Das neue Bild wird nach Decode über das bisherige gelegt. Keine leere schwarze Zwischenphase, keine Scale-Pulse bei jedem Tastendruck |
| Cover → Story | 300–450 ms, wenn die Bildbeziehung tatsächlich nachvollziehbar bleibt | Ein identisches Motiv kann Kontinuität tragen. Ohne sichere Zuordnung direkt navigieren; Text und Controls nicht als ganze Seite zoomen |
| Autoren-Reveals | vorhandene gespeicherte Werte zunächst erhalten | Scrollfortschritt ist keine normale Zeitachse. Dauer, Glättung und Preview-Verzögerung müssen korrekt beschrieben werden |

Easing-Vorschlag: `cubic-bezier(.2,.8,.2,1)` für Eintritt/kleine räumliche Bewegung; `cubic-bezier(.4,0,1,1)` für kurze Austritte; `linear` für kontinuierliche Bewegung und direkte Fortschrittskopplung. Keine elastischen Überschwinger. Die Werte sind eine konsistente Ausgangshypothese, keine aus Apple gemessenen Kurven; vor flächiger Anwendung mit einem Button, einem Overlay und einem Bildwechsel freigeben.

Transform-Regeln: UI normalerweise Translation ≤ 12 px; Hoverbild maximal etwa 1,025 im Standard. Eigene vorhandene Bild-Zoomwerte bleiben gültig. Opacity von Text im Lesebereich 1. Keine Blur-Animation ganzer Fotoflächen, keine animierten Layoutmaße auf langen Seiten. `will-change` nur temporär auf tatsächlich bewegten Elementen.

Unterbrechung: neueste Eingabe gewinnt; Zielindex wird aus jeder Eingabe berechnet, angezeigt wird nur das letzte passende, fertig geladene Bild. Keine unendliche Queue. W07 hält angeforderte und sichtbare Bildposition getrennt: Bild, Caption, Alternativtext und sichtbarer Zähler beziehen sich bis zum erfolgreichen Wechsel auf dasselbe sichtbare Motiv. Ein Lade-/Fehlerhinweis benennt das angeforderte Ziel getrennt; beim ersten Öffnen ohne Vorgängerbild steht eine dimensionsstabile Lade-/Fehlerfläche. Geschlossene Dialoge erhalten keine späten Ladeupdates. Schnelles Vor/Zurück, 10 Pfeiltasten, Richtungswechsel beim Scrollen, Schließen während Decode und Resize während Übergang gehören zur Abnahme.

Bestehende Semantik: `Reveal.tsx` berechnet reversible Sichtbarkeit; `duration` beeinflusst u. a. Glättung, `delay` wird im CSS für `data-motion="preview"` verwendet. Diese gespeicherten Felder nicht beiläufig auf neue UI-Dauern abbilden. Zunächst im Inspector erklären, bevor ein späterer eigener Auftrag die Autoren-Motion grundlegend ändert.

Reduced Motion: Systempräferenz und gespeicherter globaler Schalter haben Vorrang. Keine Parallax, automatische Reihen, verschiebenden Routeübergänge oder verpflichtenden Einblendungen; Inhalt sofort sichtbar. Statische Filmstripfolge bleibt horizontal bedienbar. Kurzes Zustandsfeedback kann ohne Bewegung erfolgen. Browser-Systempräferenz zusätzlich zum UI-Schalter testen.

Performance: nur sichtbare Ziele aktualisieren, Messungen und Schreibzugriffe pro Frame bündeln, bei inaktiven Tabs pausieren; nach Unmount Observer/Listener/Requests bereinigen. 60-Hz-Ziel heißt etwa 16,7 ms pro Frame, ist aber erst durch Messung zu bestätigen. Keine neue Bibliothek ohne genehmigten Nutzen. Bereits G1 hält für denselben Inhalt Viewport, Bildrequests und verfügbare Lade-/Layoutmessungen als Basis fest; W07/W08 prüfen zusätzlich begrenzte Vorladearbeit und Frameverhalten. W12 optimiert erst später JS-Imports und ersetzt diese frühe Bild-/Motionprüfung nicht.

## Mobile und Accessibility

- Mobile hat einen eigenen Lese- und Gestaltungspfad. Keine Hoverabhängigkeit, horizontale Gesten dürfen vertikales Scrollen nicht übernehmen. Navigation und Dialoge per Touch und Tastatur, mit Rückgabe des Fokus.
- Wichtige Touchflächen als Produktziel mindestens 44 × 44 CSS-px; WCAG 2.2 AA verlangt für 2.5.8 grundsätzlich 24 × 24 px oder zulässige Abstands-/andere Ausnahmen. Die beiden Regeln nicht gleichsetzen. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- Textkontrast mindestens 4,5:1, großer Text mindestens 3:1; Bildhintergründe für Text gesondert prüfen. Fokus und relevante UI-Grenzen ebenfalls sichtbar gestalten. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Semantische Überschriften, eindeutige Namen, `aria-live` nur für relevante Zustände, keine Daueransage jedes Uploadprozents. Dialoge halten Fokus im aktiven Kontext. `Field`-ARIA-Zusammenführung erhalten.
- Tastaturbedienung, 200 % Textzoom, 320 px, lange Titel, Displaynotch/Safe Area und Bildschirmtastatur gehören zur Abnahme. Emulierte Breite ersetzt kein echtes iPhone/Android und keinen Screenreader.
- Performance-Zielwerte: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Feldbewertung am 75. Perzentil getrennt für Desktop/Mobil; lokale Labortests sind nur Näherung. Keine Telemetrie als Nebenwirkung hinzufügen. [Web Vitals](https://web.dev/articles/vitals)

## Was 9/10 bedeutet

Der gewichtete Wert aus dem Audit muss mindestens 9 erreichen; kein Bereich soll unter 8,5 liegen. Zusätzlich: keine offenen Datenverlust-/Privatheitsfehler, keine abgeschnittenen primären Inhalte, keine unzugänglichen Kernaktionen und keine ungeklärten Pflichtprüfungen im vereinbarten Releaseumfang. Eine hohe Durchschnittsnote überstimmt diese Grenzen nicht.

Visuelle Freigabe erfolgt anhand gleicher Inhalte vor/nach Änderung. Der Nutzer bewertet Eleganz, Typografierhythmus, Bildwirkung, Bewegung und Verständlichkeit. Zehn Sekunden Ersteindruck, danach ein vollständiger Storydurchlauf und eine kleine Gestaltungsaufgabe. Keine subjektive Bewertung als Messwert ausgeben. Bei wesentlicher ungeklärter Unsicherheit oder zwei unterschiedlichen gescheiterten Lösungsversuchen einen begrenzten Astra-Auftrag nutzen; reines Geschmacksfeedback zuerst konkretisieren.
