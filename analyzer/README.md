# analyzer

Python sidecar for `cs2-analyser`. Parses `.dem` files via `demoparser2` and emits NDJSON to stdout per `docs/IPC_CONTRACT.md`.

## Setup (local dev)

```bash
cd analyzer
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run locally

```bash
python -m analyzer.main --job-id test-1 --mode quick --demo /path/to/match.dem
```

Stdout is NDJSON. Stderr carries logs. Exit code `0` on success, `1` on error.

## Build the standalone binary

The release binary is produced in CI (Windows runner). Local equivalent:

```bash
pyinstaller --onefile --name analyzer analyzer/main.py
```

The Tauri orchestrator spawns the resulting `dist/analyzer(.exe)` as a sidecar.
