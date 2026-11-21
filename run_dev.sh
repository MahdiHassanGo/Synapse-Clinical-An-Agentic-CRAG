#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== Synapse Clinical Copilot: Starting Backend & Frontend ==="

# Trap to kill both background processes on exit (Ctrl+C)
cleanup() {
  echo ""
  echo "Shutting down Synapse Clinical Copilot..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start FastAPI Backend (Port 8000)
source .venv/bin/activate
echo "-> Starting FastAPI Backend on http://localhost:8000 ..."
python3 -m uvicorn app.api.main:app --app-dir backend --port 8000 --reload &

# Wait for backend to be ready
until curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; do
  sleep 0.5
done
echo "✓ Backend is live at http://localhost:8000"

# 2. Start Next.js Frontend (Port 3000)
echo "-> Starting Next.js Frontend on http://localhost:3000 ..."
cd frontend
bun run dev &

echo "✓ Synapse Clinical Copilot running at: http://localhost:3000"
echo "Press [CTRL+C] to stop both servers."

wait
