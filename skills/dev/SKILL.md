---
name: dev
description: Execute code by calling the code_execution tool with Python code. The PreToolUse hook intercepts code_execution calls, runs the Python via python3, and returns stdout/stderr/exit_code as the result. Use for all code execution, file operations, running scripts, and hypothesis testing.
allowed-tools: Bash,code_execution
---

# Code Execution with dev

Use the `code_execution` tool with Python code. The hook intercepts the call, executes the Python locally, and returns the result as a deny reason formatted as:

```
[CODE EXECUTION RESULT]
stdout: <output>
stderr: <errors>
exit_code: <N>
```

## Run code inline

```python
# File operations
import os, json
print(json.dumps(os.listdir('.')))

# Read a file
with open('package.json') as f:
    print(f.read())

# Write a file
with open('out.json', 'w') as f:
    import json
    json.dump({'ok': True}, f, indent=2)

# Stat / exists
import os
print(os.path.exists('file.txt'), os.path.getsize('.'))

# HTTP requests
import urllib.request
resp = urllib.request.urlopen('https://example.com')
print(resp.read()[:200])

# Run subprocess
import subprocess
r = subprocess.run(['node', '--version'], capture_output=True, text=True)
print(r.stdout)
```

## Rules

- Each run under 15 seconds
- Pack every related hypothesis into one run — never one idea per run
- No persistent temp files; if a temp file is needed, delete it in the same code
- Use `code_execution` tool for all execution; Bash only for git/npm publish/docker
