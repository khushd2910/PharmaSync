import os
from pathlib import Path

root = Path('d:/Pharmasync')
ignore_dirs = {'python-service/venv', 'node_modules', '.git'}
for path in root.rglob('*'):
    if not path.is_file():
        continue
    rel = path.relative_to(root).as_posix()
    if any(part in ignore_dirs for part in Path(rel).parts):
        continue
    try:
        text = path.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue
    if 'Flask' in text or 'flask' in text:
        print(rel)
