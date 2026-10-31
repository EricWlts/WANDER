#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm ci
printf '\nWANDER is ready. Start with: npm start\n'
