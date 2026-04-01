import os
import sys
import subprocess

worktree_backend = os.path.dirname(os.path.abspath(__file__))
os.chdir(worktree_backend)
sys.path.insert(0, worktree_backend)

# Use main repo venv python; fall back to current interpreter
main_venv_python = '/Users/arafrahman/Desktop/Fuel-Good/backend/venv/bin/python3'
python = main_venv_python if os.path.exists(main_venv_python) else sys.executable

os.environ['PYTHONPATH'] = worktree_backend

port = os.environ.get('PORT', '8000')

subprocess.run([
    python, '-m', 'uvicorn', 'app.main:app',
    '--reload', '--host', '0.0.0.0', '--port', port
], cwd=worktree_backend)
