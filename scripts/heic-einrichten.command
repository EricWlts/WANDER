#!/bin/bash
# WANDER: HEIC-Unterstützung installieren und Backend-Tests ausführen
cd "$(dirname "$0")/.." || exit 1
echo "▸ Installiere pillow-heif in .venv …"
.venv/bin/python -m pip install "pillow-heif>=1.0.0" || { echo "✗ Installation fehlgeschlagen"; read -n1 -p "Taste drücken …"; exit 1; }
echo
echo "▸ Prüfe HEIC-Unterstützung …"
.venv/bin/python -c "from pillow_heif import register_heif_opener; register_heif_opener(); print('✓ HEIC wird unterstützt')"
echo
echo "▸ Backend-Tests (npm test) …"
.venv/bin/python -m pytest backend/tests -q
echo
echo "Fertig. Jetzt im WANDER-Terminal das Backend neu starten: Ctrl+C, dann npm start"
read -n1 -p "Taste drücken zum Schließen …"
