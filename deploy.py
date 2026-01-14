#!/usr/bin/env python3
import subprocess
import os
os.chdir('/Users/stefangunnarsson/justraw')
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', 'commit', '-m', 'fix: Clean Gemini integration - removed debug code, stable model'], check=True)
subprocess.run(['git', 'push', 'origin', 'HEAD:main', '--force'], check=True)
print("✅ Deployed!")
