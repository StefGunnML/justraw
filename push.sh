#!/bin/bash
cd /Users/stefangunnarsson/justraw
git add -A
git commit -m "fix: Add build-time database guard and stub API routes"
git push origin HEAD:main --force
