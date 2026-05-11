# cs2-analyser

> Desktop app that analyzes Counter-Strike 2 demo files (`.dem`) and gives AI-powered feedback on player performance — positioning, map awareness, utility usage, and decision-making.

**Status:** early development (pre-v0.1). The pipeline is being scaffolded; only the "quick scan" mode is in scope for the first milestone.

All compute runs locally on the user's machine. No cloud APIs, no telemetry, no paid services. The app auto-updates from GitHub Releases.

---

## How it works

Four layers, each in its appropriate language:

| Layer | Language | Role |
|---|---|---|
| **UI** | TypeScript + React (Tauri frontend) | File picker, mode selection, progress, timeline of results |
| **Orchestrator** | Rust (Tauri backend) | Spawns Python + Ollama sidecars, IPC, file I/O, auto-update |
| **Analyzer** | Python sidecar (bundled with PyInstaller) | Demo parsing (`demoparser2`), moment detection, Ollama HTTP calls |
| **LLM** | Ollama binary (bundled as-is) | Hosts Qwen2.5-VL 7B vision model on `localhost:11434` |

### Analysis modes

- **Quick scan** — parse demo only, extract kills/deaths/basic stats. No LLM. ~5 s per match.
- **Full analysis** — demo parse + moment detection + vision LLM analysis of key moments + map-awareness assessment. ~5–15 min per match. *Not implemented in v0.1.*

---

## Repository structure

```
cs2-analyser/
├── src-tauri/           # Rust backend (Tauri 2.x)
├── src/                 # React + TypeScript frontend
├── analyzer/            # Python sidecar
│   ├── main.py
│   ├── moments.py
│   ├── ollama_client.py # stubbed connection template
│   └── requirements.txt
├── resources/           # Bundled binaries (Ollama, analyzer.exe) — not in git
├── .github/workflows/   # CI/CD (Windows MSI build + update manifest)
├── docs/
├── CLAUDE.md            # Project context for AI assistants
├── LICENSE              # MIT
└── README.md
```

---

## Branch policy (STRICT)

| Branch | Purpose | How code lands |
|---|---|---|
| `main` | Production. Tagged releases only. | PR from `staging` after release sign-off. |
| `staging` | Testing. Feature-complete but unverified. | PR from `dev` when a milestone is ready. |
| `dev` | Active development. | All work goes here first. **Default branch.** |

- ALL development commits go to `dev` first.
- Never commit directly to `main` or `staging`.
- Never force-push to `main` or `staging`.
- [Conventional Commits](https://www.conventionalcommits.org/) format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`.

---

## Auto-update

The desktop app uses the Tauri 2.x updater plugin. On launch (and via a manual "Check for updates" button) it polls a signed JSON manifest published with every GitHub Release. If a newer version is available, the user is prompted to download and apply it.

- Manifest URL: `https://github.com/YaroslavSavchenk/cs2-analyser/releases/latest/download/latest.json`
- Releases are signed with a Tauri-generated key; the public key ships with the app, the private key lives as a GitHub Actions secret.
- The `release.yml` workflow builds the MSI on a Windows runner, generates the manifest, and uploads both to the release.

---

## Design

CS2-themed dark UI. Charcoal/navy backgrounds, orange-gold accent for primary actions, muted CT-blue secondary. Built with `shadcn/ui` on Radix + Tailwind. The welcome screen features a 3D operator model (CC0 asset) rendered with `react-three-fiber`.

---

## Development setup

> **Production target is Windows 10/11.** Windows MSI bundling runs in CI on a Windows runner. You can develop and iterate on Linux/WSL2 (Linux build of Tauri), but the shipped artefact is always built on Windows.

### Prerequisites

- **Rust** — stable (1.95+ tested). Install via [rustup](https://rustup.rs).
- **Node** — 20 LTS or newer. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm).
- **pnpm** — `npm install -g pnpm`.
- **Python** — 3.11+ (3.12 tested).
- **Tauri 2.x platform prerequisites** — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

### Linux / WSL2 system packages

If you're developing on Linux or in WSL2 on Windows 11, install Tauri 2.x's native build prerequisites once:

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  librsvg2-dev \
  libayatana-appindicator3-dev \
  libssl-dev \
  libsoup-3.0-dev \
  libdbus-1-dev \
  libxdo-dev \
  pkg-config \
  build-essential
```

On Windows 11 WSL2, the dev window renders directly on the Windows desktop via WSLg with GPU acceleration — no extra display setup is needed. The shipped MSI is always built on a `windows-latest` runner in CI (`.github/workflows/release.yml`); the WSL/Linux build is purely for dev iteration.

The first `pnpm tauri dev` after a fresh clone compiles ~600 Rust crates and takes 5–10 minutes. Subsequent rebuilds use the incremental cache and finish in seconds.

### First-time setup

```bash
# Frontend deps
pnpm install

# Python analyzer deps (in a venv)
cd analyzer
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### Run in development

```bash
pnpm tauri dev
```

This starts the Vite dev server, builds the Rust backend in debug mode, and opens the desktop window with hot-reload for the frontend.

### Build a release binary

```bash
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/`. The Windows MSI is produced by the GitHub Actions workflow under `.github/workflows/release.yml`.

---

## Roadmap

- **v0.1** — quick-scan pipeline end-to-end + auto-updater + CS2-themed UI shell.
- **v0.2** — moment detection algorithms (clutches, peeks, deaths) producing structured events.
- **v0.3** — Ollama integration; Qwen2.5-VL 7B feedback on key moments.
- **v0.4** — CS2 process control: launch CS2, drive console, capture POV screenshots.
- **v0.5+** — map-aware positioning, audio analysis (Whisper), match share-code lookup, code signing.

---

## License

MIT — see [LICENSE](./LICENSE).
