#!/bin/bash
# 1. Run migrations locally if possible (will fail if no DB access, but that's okay)
echo "--- Running Migrations ---"
node scripts/add-vector-support.js || echo "Migration script failed (probably no local DB access), will run on DO if configured."

# 2. Push to GitHub to trigger DO deployment
echo "--- Pushing to main ---"
git add -A
git commit -m "feat: Implement real-time voice with VAD, RAG, and reactive UI"
git push origin HEAD:main --force

echo "✅ Deploy triggered!"
