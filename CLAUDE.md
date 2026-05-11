# CLAUDE.md — project context for AI assistants

This file is the canonical context for any AI assistant (Claude Code or otherwise) working on this repository. Read it fully before making any changes.

---

## What this project is

`cs2-analyser` is a **Windows desktop application** that analyzes Counter-Strike 2 demo files (`.dem`) and provides AI-powered feedback on player performance. All compute is **local** — no cloud APIs, no telemetry.

The developer is the **sole author**: Yaroslav Savchenko (savasavchenko1312@gmail.com, GitHub `YaroslavSavchenk`). Treat them as technically competent but new to Tauri and Rust specifically.

### Dev machine

- Windows 11 host with WSL2 Ubuntu for development.
- NVIDIA RTX 5070 (12 GB VRAM) — sized to run Qwen2.5-VL 7B locally.

### Distribution

- MSI installer via GitHub Releases.
- The 5 GB vision model is **never** bundled — it is downloaded by the user on first run via Ollama.

---

## Architecture (four layers)

| Layer | Language | Path | Responsibility |
|---|---|---|---|
| 1. UI | TypeScript + React | `src/` | File picker, mode selector, progress, timeline view |
| 2. Orchestrator | Rust (Tauri 2.x) | `src-tauri/` | Spawns Python + Ollama sidecars, IPC, lifecycle |
| 3. Analyzer | Python (PyInstaller-bundled) | `analyzer/` | Demo parsing via `demoparser2`, moment detection, Ollama HTTP client |
| 4. LLM | Ollama (Go binary, bundled as-is) | `resources/` (not committed) | Hosts Qwen2.5-VL 7B on `localhost:11434` |

The Rust orchestrator and Python sidecar communicate over **stdin/stdout with line-delimited JSON (NDJSON)**. Python streams progress events; Rust forwards them to the frontend via Tauri events.

---

## Branch policy — STRICT

| Branch | Purpose | How code lands |
|---|---|---|
| `main` | Production. Tagged releases only. | PR from `staging`. |
| `staging` | Testing. Feature-complete but unverified. | PR from `dev`. |
| `dev` | Active development. **Default branch.** | All commits land here first. |

**Hard rules:**

- **NEVER commit directly to `main` or `staging`.**
- **NEVER force-push to `main` or `staging`.**
- `dev` → `staging` and `staging` → `main` must go through PRs.
- Tagged releases (`v0.1.0`, etc.) come from `main`.

**Commit practice:**

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`.
- One logical change per commit. Commit after every completed feature or bug fix.
- Push immediately after every commit and every merge.
- Commit messages in English.

---

## Hard rules — DO NOT

- **DO NOT** add cloud API integrations (OpenAI, Anthropic, Google, etc.) — even as fallbacks.
- **DO NOT** add telemetry, analytics, or crash reporters without asking first.
- **DO NOT** bundle the 5 GB vision model in the MSI. It is downloaded on first run.
- **DO NOT** use Electron. We chose Tauri specifically for bundle size.
- **DO NOT** add features outside the current milestone's scope.
- **DO NOT** generate fake or placeholder data that pretends a feature works when it does not. If a piece of the pipeline is stubbed, the UI must indicate it.
- **DO NOT** commit `.dem` files, large binaries, or anything in `resources/` to git.

---

## Tech stack and preferences

- **Rust** edition 2021 (or 2024 once stable; whatever Tauri 2.x scaffolds with).
- **Tauri 2.x** — never Tauri 1.x.
- **Node 20+** for the frontend toolchain.
- **Python 3.11+** for the sidecar.
- **React 18+** with TypeScript **strict mode**.
- **UI library:** `shadcn/ui` or `radix-ui` only. **NOT** Material UI, NOT Chakra.
- **State management:** start with built-in React hooks. Add Zustand only when prop drilling becomes painful — not preemptively.
- **Package manager:** `pnpm` (not npm, not yarn).

### Design — CS2 visual language

- **Production-grade visual quality.** Avoid the generic AI default look (no blue-purple gradients, no rounded-blob hero illustrations).
- **CS2-themed dark palette.** Charcoal/near-black backgrounds (`#0d0e10`, `#15171b`), orange-gold primary accent (`#fe6e2c` / `#f5a623`), muted CT-blue secondary (`#5e98d9`), high-contrast off-white text.
- **Hero element.** Front page features a 3D operator model (CC0/CC-BY asset, NOT actual Valve/CS2 assets — copyright) rendered with `react-three-fiber` with a subtle idle animation.
- **Tone.** Professional analysis tool, not consumer app. Dense with information, never cluttered. Sharp corners over rounded blobs.
- **Stack.** `shadcn/ui` (built on Radix) + Tailwind with a custom palette in `tailwind.config.ts`.

---

## Current milestone — v0.1

**Goal:** prove the pipeline works end-to-end with quick-scan mode, on a polished CS2-themed UI shell, with auto-update wired in.

1. UI shows a "Select demo file" button on a CS2-themed welcome screen with the 3D operator hero.
2. User picks a `.dem` file.
3. Rust spawns the Python analyzer with the file path.
4. Python parses the demo and returns a JSON list of kills/deaths with round numbers.
5. UI displays the result.
6. The Tauri updater plugin is configured and a "Check for updates" affordance exists.

**Not in v0.1:** Ollama integration, vision LLM, CS2 process control, audio analysis, map awareness.

The Ollama client is stubbed (`analyzer/ollama_client.py`) — interface only, not wired into anything. This is a deliberate placeholder for v0.3.

---

## Future scope — documented, NOT to build now

- CS2 process control (launching, console commands, POV screenshots).
- Ollama / Qwen2.5-VL integration.
- Map-aware positioning analysis.
- Audio analysis (footsteps, voice comms via Whisper).
- Match share-code download from Steam.
- Code signing for MSI (Windows Authenticode certificate).

---

## How to work in this repo

- Confirm any ambiguity with the user **before** writing code.
- After each completed task, commit and push to `dev` immediately.
- After each milestone (v0.1, v0.2, …), ask the user whether to open a PR `dev` → `staging`.
- Show the file structure before writing implementation code if scaffolding has changed.
- Verify the project builds locally before reporting a task as done. If you cannot build (e.g. missing system deps), say so explicitly rather than claiming success.
- Use multiple agents (parallel sub-agents) for independent work where possible — installation, doc writing, independent file scaffolding.
