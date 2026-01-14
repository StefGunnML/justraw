#!/bin/bash
cd /Users/stefangunnarsson/justraw
git add -A
git commit -m "fix: Remove unnecessary server.js and Procfile for standard Next.js deployment"
git push origin HEAD:main
