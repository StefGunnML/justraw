#!/usr/bin/env python3
import subprocess
import os

os.chdir('/Users/stefangunnarsson/justraw')

# Add all changes
subprocess.run(['git', 'add', '-A'], check=True)

# Commit
subprocess.run(['git', 'commit', '-m', 'fix: Clean deployment - remove server.js and Procfile'], check=True)

# Push
subprocess.run(['git', 'push', 'origin', 'HEAD:main'], check=True)

print("✅ Deployment triggered successfully!")
