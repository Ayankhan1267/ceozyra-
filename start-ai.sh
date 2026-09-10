#!/bin/bash
cd /var/www/zyra/apps/ai
export PORT=${PORT:-8020}
exec .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8020 --app-dir src --workers 2
