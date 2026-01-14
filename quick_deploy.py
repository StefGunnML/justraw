#!/usr/bin/env python3
import subprocess
import os

os.chdir('/Users/stefangunnarsson/justraw')
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m', 'fix: Add Node.js runtime and type safety for Gemini integration'], check=True)
subprocess.run(['git', 'push', 'origin', 'HEAD:main'], check=True)
print("✅ Deployed!")
