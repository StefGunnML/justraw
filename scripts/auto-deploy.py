import subprocess
import os

def run_cmd(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(f"STDOUT: {result.stdout}")
    print(f"STDERR: {result.stderr}")
    return result.returncode

os.chdir('/Users/stefangunnarsson/justraw')
run_cmd('git add -A')
run_cmd('git commit -m "fix: Robust build-time guards and SSR protection for deployment"')
run_cmd('git push origin HEAD:main --force')
