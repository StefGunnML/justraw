import subprocess
import os
import json
import sys

def run_cmd(cmd):
    print(f"Executing: {cmd}")
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = process.communicate()
    if stdout: print(f"STDOUT: {stdout}")
    if stderr: print(f"STDERR: {stderr}")
    return process.returncode

def main():
    os.chdir('/Users/stefangunnarsson/justraw')
    
    # 1. Create develop branch if it doesn't exist
    run_cmd('git checkout -b develop || git checkout develop')
    
    # 2. Stage and commit
    run_cmd('git add -A')
    run_cmd('git commit -m "feat: Pierre is back with real-time voice, RAG, and robust builds"')
    
    # 3. Push to develop
    print("Pushing to develop branch...")
    ret = run_cmd('git push origin develop --force')
    if ret != 0:
        print("Push failed! Please check your git configuration.")
        return

    print("✅ Successfully pushed to develop!")

if __name__ == "__main__":
    main()
