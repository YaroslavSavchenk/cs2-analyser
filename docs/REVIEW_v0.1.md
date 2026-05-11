# Code review — cs2-analyser v0.1

Scope: `analyzer/`, `src-tauri/`, `src/`, `.github/`. Cross-layer IPC conformance was the primary lens.

---

## 1. Executive summary

**Verdict: fix-first.** There is one **Blocker** that breaks the IPC contract end-to-end (frontend ↔ Rust argument-name casing for `cancel_analysis`), one **Blocker** in the release workflow that prevents the updater pubkey path from matching what's in `tauri.conf.json` (repo owner spelling mismatch in the updater endpoint), and one **High** correctness bug that suppresses real `result` payloads after the sidecar finishes. The rest are tractable Mediums/Lows. Architecturally the layers are well separated and the contract is mostly honoured; the bugs are concentrated at the seams.

---

## 2. Findings

### Blockers

#### B1. `cancel_analysis` invoke argument name is wrong on the frontend
- **File:** `src/lib/tauri.ts:230`
- The Tauri command `cancel_analysis(app, job_id: String)` expects the `job_id` parameter using Tauri's default snake_case argument convention (`job_id`). The frontend sends `{ jobId }`, which Tauri will deserialize as a missing field — every cancel call will throw `invalid args: missing field 'job_id'`. The Rust agent specifically flagged this. The contract doc (`docs/IPC_CONTRACT.md:46`) is explicit: `Args: { job_id: string }`.
- **Patch:**
  ```ts
  // src/lib/tauri.ts
  export async function cancelAnalysis(jobId: string): Promise<void> {
    if (isTauri()) {
  -   await tauriInvoke<void>("cancel_analysis", { jobId });
  +   await tauriInvoke<void>("cancel_analysis", { job_id: jobId });
      return;
    }
    cancelStubJob(jobId);
  }
  ```

#### B2. Updater endpoint repo owner mismatch will 404 every update check
- **File:** `src-tauri/tauri.conf.json:49` vs `docs/SECURITY.md:46`, `README` references
- `tauri.conf.json` points at `github.com/YaroslavSavchenk/cs2-analyser` (no trailing `o`). The actual GitHub handle per `CLAUDE.md:11` is `YaroslavSavchenk` — wait, CLAUDE.md spells it `YaroslavSavchenk` too. But the `release.yml` CI workflow uses `${{ github.repository }}` which will be whatever the actual repo path is. SECURITY.md uses `YaroslavSavchenk`. **CLAUDE.md `YaroslavSavchenk` and tauri.conf.json `YaroslavSavchenk` both look like truncations of `YaroslavSavchenko`** (the user's email is `savasavchenko1312@gmail.com`). Either way, the static `endpoints` URL in `tauri.conf.json` must match the actual GitHub repo path exactly, otherwise `updater.check()` always returns `None`. Confirm the canonical GitHub username with the user before shipping, then update **both** `tauri.conf.json` and `docs/SECURITY.md:46` / `.github/workflows/README.md` to the same string.
- **Patch (placeholder — confirm the real handle first):**
  ```jsonc
  // src-tauri/tauri.conf.json
  "endpoints": [
  - "https://github.com/YaroslavSavchenk/cs2-analyser/releases/latest/download/latest.json"
  + "https://github.com/<verified-github-handle>/cs2-analyser/releases/latest/download/latest.json"
  ]
  ```

---

### High

#### H1. `analysis:result` payload is silently followed by a spurious `analysis:error` on the sidecar's clean exit
- **File:** `src-tauri/src/sidecar.rs:136-147`
- After stdout EOF, the orchestrator waits on the child. On Windows, when a process is killed with `start_kill()` (the cancel path), `wait()` returns `Ok(status)` with `status.success() == false`. But the same code runs on **normal completion**: there's a race where the child can exit *before* the manager's `remove()` call inside the stdout task, so the `remove()` returns `Some(child)`, and we then emit `sidecar_crashed` even though the result line was already emitted. More damaging: on cancellation the user sees the legitimate `cancelled` error *and then* a second `sidecar_crashed` error overwrite it in the store. The store's `fail()` keeps the last one, so the UI shows `sidecar_crashed` instead of `cancelled`.
- **Patch:** track whether we already emitted a terminal event (result or error) and gate the post-exit error on that:
  ```rust
  // sidecar.rs — add to SidecarManager
  use std::sync::atomic::{AtomicBool, Ordering};

  // Track terminal events per job. Reset/cleared on remove.
  #[derive(Default)]
  pub struct SidecarManager {
      children: Arc<Mutex<HashMap<String, Child>>>,
      terminal_emitted: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
  }

  impl SidecarManager {
      pub async fn mark_terminal(&self, job_id: &str) -> bool {
          let map = self.terminal_emitted.lock().await;
          if let Some(flag) = map.get(job_id) {
              !flag.swap(true, Ordering::SeqCst)
          } else {
              false
          }
      }
      pub async fn register_terminal_flag(&self, job_id: &str) -> Arc<AtomicBool> {
          let mut map = self.terminal_emitted.lock().await;
          map.entry(job_id.to_string())
              .or_insert_with(|| Arc::new(AtomicBool::new(false)))
              .clone()
      }
      pub async fn forget(&self, job_id: &str) {
          self.terminal_emitted.lock().await.remove(job_id);
      }
  }
  ```
  Then in `spawn_analyzer`, register the flag, set it inside `handle_sidecar_line` whenever we emit `result` or `error` (and in `cancel`), and in the post-wait block only emit `sidecar_crashed` if the flag is still false:
  ```rust
  // pseudo-diff
  let flag = app_for_stdout.state::<SidecarManager>()
      .register_terminal_flag(&job_id_for_stdout).await;
  // ... after wait, before emit_error("sidecar_crashed", ...):
  if !flag.swap(true, Ordering::SeqCst) {
      // only emit if no terminal event was sent yet
      emit_error(&app_for_stdout, &job_id_for_stdout, "sidecar_crashed", ...);
  }
  ```
  Simpler alternative if the above is too invasive for v0.1: in the post-wait block, **also** check `status.code() == Some(0)` and *do not* emit any error on `Some(1)` either — trust that the Python side already emitted an `{"event":"error",...}` line because `main.py:170` always does, and a non-zero exit without a prior error line is genuinely a sidecar crash. The race still exists for cancellation though, so the flag approach is preferred.

#### H2. `install_update` is annotated to return `()` but its body never returns — won't compile cleanly on all toolchains
- **File:** `src-tauri/src/updater.rs:50-69`
- The function signature is `pub async fn install_update(app: AppHandle) -> Result<(), String>` but the only terminator is `app.restart()`, which on Tauri 2.x returns `!` (never). The function compiles today, but if the Tauri API ever changes `restart()`'s return type the call site silently breaks. More importantly, the docstring in `docs/IPC_CONTRACT.md:40` says the process is replaced — but `app.restart()` returns control on some platforms during the brief window before the new process takes over, and the caller (`UpdateBanner.tsx:34`) waits on the promise inside a `try/finally`. The promise will *never* resolve (the process is replaced first), but if `restart()` does return for any reason, the `Ok(())` is unreachable.
- **Patch:** make the never-return explicit so the contract is honest:
  ```rust
  // updater.rs:51
  - pub async fn install_update(app: AppHandle) -> Result<(), String> {
  + pub async fn install_update(app: AppHandle) -> Result<(), String> {
        let updater = app
            .updater()
            .map_err(|e| format!("failed to build updater: {e}"))?;
        let update = updater
            .check().await
            .map_err(|e| format!("updater check failed: {e}"))?
            .ok_or_else(|| "no update available to install".to_string())?;
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| format!("failed to install update: {e}"))?;
        info!("update installed; restarting");
        app.restart();
  +   // unreachable: app.restart() replaces the process
    }
  ```
  And on the frontend, do not `await` `installUpdate()` inside a `finally` that flips a spinner off (`UpdateBanner.tsx:32-36`) — if the restart succeeds the `finally` is never reached, which is fine; but if it errors, the user has no indication. Surface the error:
  ```ts
  // src/components/UpdateBanner.tsx:30-37
  const onInstall = async () => {
    setInstalling(true);
    try {
      await installUpdate();
    } catch (e) {
      console.error("install_update failed", e);
      setInstalling(false);
    }
  };
  ```

#### H3. Python `_get_col` will raise `KeyError` on `demoparser2` dict rows that lack the named column
- **File:** `analyzer/main.py:32-36`
- `_get_col` does `if name in row and row[name] is not None`. For a pandas `to_dict(orient="records")` row this works (it's a plain `dict`), but `demoparser2` is known to return rows where missing columns are present-as-`None` rather than absent. That's fine. However, `_build_kill_event` calls `_get_col(row, "weapon")` etc. without normalizing the column-naming convention used by newer `demoparser2` releases (`weapon` vs `weapon_name`), and `victim_name` is not actually a column the parser emits — it emits `user_name`. The fallback chain `_get_col(row, "user_name", "victim_name")` is reasonable, but `headshot` may also be exposed as `hitgroup` (1 == headshot) on some versions. For v0.1 this is acceptable for a happy-path demo, but the v0.2 hardening should add `hitgroup`-aware detection.
- **Patch (minimal v0.1 hardening):**
  ```python
  # analyzer/main.py:55
  - headshot = bool(_get_col(row, "headshot") or False)
  + headshot_raw = _get_col(row, "headshot", "hitgroup")
  + headshot = bool(headshot_raw) if isinstance(headshot_raw, bool) else headshot_raw == 1
  ```

#### H4. Capability `shell:default` is broad — and the Rust orchestrator does not use it at runtime
- **File:** `src-tauri/capabilities/default.json:11` and `src-tauri/src/lib.rs:58`
- The `tauri-plugin-shell` is initialized but `sidecar.rs` spawns Python via `tokio::process::Command` directly (line 74), not via the shell plugin. The `shell:default` permission allows the frontend to invoke shell commands — which is unnecessary for v0.1 and broadens the attack surface for any future XSS-from-`dangerouslySetInnerHTML` regression. Remove both the plugin init and the capability until the production sidecar wiring switches to `tauri-plugin-shell`'s scoped sidecar API (the TODO at `sidecar.rs:70`).
- **Patch:**
  ```jsonc
  // src-tauri/capabilities/default.json
  "permissions": [
    "core:default",
    "opener:default",
    "dialog:default",
    "dialog:allow-open",
  - "shell:default",
    "updater:default",
    "process:default",
    "process:allow-restart"
  ]
  ```
  And in `lib.rs:58`, drop `.plugin(tauri_plugin_shell::init())` plus the dependency in `Cargo.toml:28` until it's actually used. (Leave the TODO comment so the v0.2 wiring is obvious.)

---

### Medium

#### M1. Sidecar production path falls back to `python3` instead of erroring out
- **File:** `src-tauri/src/sidecar.rs:69-72`
- In release builds (`cfg!(debug_assertions) == false`), the code logs a warning and proceeds to spawn `python3` — which won't exist on a Windows install where the user didn't pre-install Python. This violates the "no fake/placeholder" hard rule (`CLAUDE.md:69`): the UI will hang on "Parsing" until the spawn errors out as `program not found`. Fail fast with a clear error event.
- **Patch:**
  ```rust
  // sidecar.rs:67-73
  - if !cfg!(debug_assertions) {
  -     // TODO(prod): swap to tauri_plugin_shell sidecar binary `analyzer`.
  -     warn!("production sidecar path not implemented; falling back to python3");
  - }
  + #[cfg(not(debug_assertions))]
  + {
  +     return Err(anyhow!(
  +         "production sidecar not yet wired (PyInstaller binary path TODO); \
  +          run the dev build until v0.1.1"
  +     ));
  + }
  ```
  This surfaces as `spawn_failed: production sidecar not yet wired ...` in the UI, which is honest.

#### M2. `start_kill()` does not wait for the child to actually die; subsequent `wait()` happens in the stdout task and can race
- **File:** `src-tauri/src/sidecar.rs:39-49`
- `start_kill()` sends `SIGTERM`/`TerminateProcess` and returns immediately. The child is already removed from the map, but the stdout-draining task still holds the `child` indirectly (no — it doesn't, the child was moved into the map; after `remove()` the child is gone). The stdout task then tries `app.state::<SidecarManager>().remove(...)` again at line 131 and gets `None`, so it doesn't reap. On Windows, the killed process becomes a zombie. Reap inside `kill()`:
- **Patch:**
  ```rust
  // sidecar.rs:39-49
  pub async fn kill(&self, job_id: &str) -> Result<bool> {
      let mut guard = self.children.lock().await;
      if let Some(mut child) = guard.remove(job_id) {
          child.start_kill()
              .with_context(|| format!("failed to kill sidecar for job {job_id}"))?;
          // Reap to avoid a zombie; ignore the status (it's a SIGKILL).
          drop(guard); // release the lock before awaiting
          let _ = child.wait().await;
          Ok(true)
      } else {
          Ok(false)
      }
  }
  ```

#### M3. `UpdateCheckResult` Rust enum is `untagged` but emits `available: true/false` — works, but `notes`/`date` will be empty strings instead of being absent on the negative branch
- **File:** `src-tauri/src/updater.rs:6-18`
- The serde shape matches the TS union if and only if the negative branch is `{ available: false }`. With `#[serde(untagged)]`, that's what's produced — fine. However, the `Available` branch produces `date: ""` when `update.date` is `None`, and the TS contract types `date: string` (not optional). Empty string is at least defensible. Lower-priority cosmetic: the `notes: ""` and `date: ""` could be more truthful as `null` (and the TS type updated). Acceptable for v0.1.

#### M4. `mint_job_id` uses nanos-since-epoch cast to `u64` and a process-local counter — collisions across app restarts are vanishingly rare, but the function name implies uniqueness
- **File:** `src-tauri/src/lib.rs:39-47`
- The `nanos as u64` truncation is a 2554-year wraparound — irrelevant. The atomic counter resets per process. Two concurrent jobs spawned within the same nanosecond on a single boot can theoretically collide because the counter and the nanos are concatenated, not combined. Practically fine, but if you want to be paranoid:
- **Patch:** just use `uuid`:
  ```rust
  // Cargo.toml dep: uuid = { version = "1", features = ["v4"] }
  fn mint_job_id() -> String {
      format!("job-{}", uuid::Uuid::new_v4())
  }
  ```

#### M5. `useEffect` deps for the analysis event wiring re-subscribe on every store callback identity change
- **File:** `src/App.tsx:373-383`
- `setProgress`, `finish`, `fail` are zustand-provided functions and are stable across renders, so this works. But if a future contributor swaps zustand for `useReducer`, the subscription will re-mount on every render and miss events between unsubscribe and re-listen. Tighten the dep:
- **Patch:** subscribe only on `jobId`, and read the latest handlers via a ref:
  ```ts
  // src/App.tsx — minimal change:
  useEffect(() => {
    if (!jobId) return;
    const unsubscribe = onAnalysisEvent(jobId, {
      onProgress: (e) => useAnalysisStore.getState().setProgress(e.percent, e.stage, e.message),
      onResult: (e) => useAnalysisStore.getState().finish(e),
      onError: (e) => useAnalysisStore.getState().fail(e),
    });
    return () => { unsubscribe(); };
  }, [jobId]);
  ```
  This guarantees one-subscription-per-job regardless of state-lib identity behaviour.

#### M6. `onAnalysisEvent` listens by event name globally and filters by `job_id`; if a stale listener from an aborted previous job is still resolving its `tauriListen` promise after unsubscribe, it leaks
- **File:** `src/lib/tauri.ts:251-303`
- `void tauriListen(...).then(u => unsubs.push(u))` is a use-after-unsubscribe hazard: if the caller unsubscribes before the promise resolves, the resolved `UnlistenFn` is pushed into `unsubs` but never invoked. This leaves a dangling Tauri listener that will fire for the next job. Track an `aborted` flag:
- **Patch:**
  ```ts
  // src/lib/tauri.ts:255-292
  export function onAnalysisEvent(jobId: string, handlers: AnalysisEventHandlers): () => void {
    const unsubs: Array<UnlistenFn | (() => void)> = [];
    let aborted = false;

    const trackAsync = (p: Promise<UnlistenFn>) => {
      p.then((u) => {
        if (aborted) {
          try { u(); } catch { /* noop */ }
        } else {
          unsubs.push(u);
        }
      });
    };

    // ... wireProgress/wireResult/wireError unchanged ...

    if (isTauri()) {
      trackAsync(tauriListen<AnalysisProgress>("analysis:progress", (e) => wireProgress(e.payload)));
      trackAsync(tauriListen<AnalysisResult>("analysis:result", (e) => wireResult(e.payload)));
      trackAsync(tauriListen<AnalysisError>("analysis:error", (e) => wireError(e.payload)));
    } else { /* stub listeners unchanged */ }

    return () => {
      aborted = true;
      for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    };
  }
  ```

#### M7. Bundle size: three.js ships in the main chunk
- **File:** `vite.config.ts`
- The 1.2 MB JS bundle is dominated by `three` + `@react-three/fiber`. With Vite, split with `build.rollupOptions.output.manualChunks`. Also lazy-load `HeroModel` so the welcome screen renders before three.js parses.
- **Patch (vite.config.ts):**
  ```ts
  export default defineConfig(async () => ({
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            three: ["three", "@react-three/fiber", "@react-three/drei"],
            radix: [
              "@radix-ui/react-dialog",
              "@radix-ui/react-tabs",
              "@radix-ui/react-progress",
              "@radix-ui/react-separator",
              "@radix-ui/react-slot",
            ],
          },
        },
      },
    },
    // ... rest unchanged
  }));
  ```
  And in `App.tsx`, lazy-load the hero:
  ```ts
  import { lazy, Suspense } from "react";
  const HeroModel = lazy(() =>
    import("./components/HeroModel").then((m) => ({ default: m.HeroModel })),
  );
  // <Suspense fallback={<FallbackSilhouette/>}> ... </Suspense>
  ```

#### M8. `tailwindcss-animate` is in `devDependencies` but never imported
- **File:** `package.json:48`
- The project uses Tailwind v4 (CSS-first `@theme`), not v3 + `tailwind.config.ts`, so `tailwindcss-animate` cannot register itself. Remove to keep `pnpm install` lean.
- **Patch:**
  ```diff
  // package.json devDependencies
  - "tailwindcss-animate": "^1.0.7",
  ```

#### M9. CSS uses arbitrary classes like `border-cs-t/12`, `border-cs-orange/45` — Tailwind v4 accepts these but some are not standard increments
- **File:** `src/components/ui/Badge.tsx:21,22`, `src/components/UpdateBanner.tsx:46,48`
- Tailwind v4 supports arbitrary alpha (`/12`, `/45`) without ceremony — these compile. Not a finding, just verified clean.

#### M10. `requirements.txt` pins `pyinstaller` even though it is only needed in CI
- **File:** `analyzer/requirements.txt:3`
- PyInstaller is a build dep, not a runtime dep. Bundling it into the runtime venv on a dev machine is harmless but pollutes `pip install` time. Split it out.
- **Patch (analyzer/requirements.txt):**
  ```
  demoparser2>=0.30.0
  requests>=2.31.0
  ```
  And in `.github/workflows/release.yml:67-68`, install pyinstaller explicitly:
  ```yaml
  - name: Install Python analyzer dependencies
    run: |
      pip install -r analyzer/requirements.txt
      pip install pyinstaller>=6.3.0
  ```

---

### Low

#### L1. CSP is null
- **File:** `src-tauri/tauri.conf.json:27`
- Flagged in the brief as a v0.2 todo — acknowledged. Add a `// TODO(v0.2): tighten CSP` comment in code or doc.

#### L2. `pnpm` version pinning is loose
- **File:** `.github/workflows/{ci,release}.yml`
- Both workflows use `pnpm/action-setup@v4` with `version: 10`. Pin to a minor (`version: 10.5.0`) to avoid surprise lockfile-format changes.

#### L3. Dependabot opens up to 10 PRs per ecosystem — noisy for a solo dev
- **File:** `.github/dependabot.yml`
- Drop to `open-pull-requests-limit: 5` (or 3) per ecosystem to keep weekly review tractable.

#### L4. `WebGL probe` allocates a real canvas on every component mount
- **File:** `src/components/HeroModel.tsx:261-273`
- `useState` initializer runs once per mount, which is fine, but if `HeroModel` ever unmounts and remounts (e.g. when the analysis state toggles back to idle), a fresh canvas is created and immediately discarded. Move the probe to a module-level memo:
- **Patch:**
  ```ts
  // src/components/HeroModel.tsx — top of file
  let _webglProbeCache: boolean | null = null;
  function detectWebgl(): boolean {
    if (_webglProbeCache !== null) return _webglProbeCache;
    if (typeof document === "undefined") return (_webglProbeCache = false);
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      _webglProbeCache = !!gl;
    } catch {
      _webglProbeCache = false;
    }
    return _webglProbeCache;
  }
  // then: const [webglOk, setWebglOk] = useState<boolean>(detectWebgl);
  ```

#### L5. `lucide-react` is pinned at `^1.14.0` — the **modern** `lucide-react` major is `0.4xx` series
- **File:** `package.json:34`
- `lucide-react@1.14.0` is a real published version from 2021 (a pre-v0 reset by the author), and it does include all the icons the code imports (verified in `node_modules`). It still works, but it's missing several years of icon additions and TypeScript improvements. Plan to migrate to `lucide-react@^0.460.0` (the current "modern" line) in v0.2 — the icon names are identical, no code changes needed.

#### L6. Footer claims "windows" even in dev on Linux/WSL
- **File:** `src/App.tsx:441`
- Cosmetic. Either gate on `isTauri()` + a future platform helper, or change to `local · tauri 2`.

#### L7. `Math.round(progress)` in `App.tsx:282` drops decimals for the percentage label — fine
- Verified clean.

#### L8. `tauri-plugin-opener` is initialized but unused
- **File:** `src-tauri/src/lib.rs:56`, `Cargo.toml:22`, `capabilities/default.json:7`
- Nothing in the frontend calls `opener:*`. Remove the plugin, the dep, and the permission to keep the surface minimal — same rationale as H4.

#### L9. `requests` 2.31+ is fine, but with the Ollama client stubbed it's a 5 MB import for nothing
- **File:** `analyzer/requirements.txt:2`, `analyzer/ollama_client.py:3`
- Acceptable for v0.1 since the dep is in the PyInstaller bundle anyway. Note as cleanup if `OllamaClient` is gated behind v0.3.

#### L10. `mode` arg is passed but always "quick" — full mode rejected twice
- **File:** `src-tauri/src/lib.rs:14-20` and `analyzer/main.py:155-157`
- Both layers reject `full` independently. That's belt-and-braces, which is fine. The Rust rejection emits a thrown `invoke` rejection (good), but the error string `"unsupported_mode: full mode..."` is not parsed by the frontend (`App.tsx:393`) into an `AnalysisErrorKind`. The frontend converts every thrown error to `kind: "spawn_failed"`. Either parse the prefix, or have the Rust side return a structured error. Low priority because the Mode tab disables `full` in the UI.

---

## 3. Cross-layer contract drift

| Place | Contract says | Code does | Verdict |
|---|---|---|---|
| `cancel_analysis` args | `{ job_id: string }` | Frontend sends `{ jobId }` | **Blocker B1** |
| `analysis:result` payload `job_id` | required | Rust `sidecar.rs:210-216` injects `job_id` correctly | OK |
| `analysis:progress` payload | `stage`, `percent`, optional `message` | Python emits exactly that; Rust forwards; frontend parses — OK | OK |
| `analysis:error` kinds | `"spawn_failed" \| "parse_failed" \| "sidecar_crashed" \| "cancelled" \| "unsupported_mode"` | Python emits `parse_failed`, `unsupported_mode`; Rust emits `cancelled`, `sidecar_crashed`; `analyze_demo` returns a string error for spawn failures, frontend manually constructs `spawn_failed` on `App.tsx:393` | OK in aggregate, but L10 above |
| `result` event types | `kill` and `death` | Python emits both correctly (suicide demoted to `death`) | OK |
| Sidecar CLI flags | `--job-id`, `--mode`, `--demo` | Rust spawns with those three; Python parses them; argparse `--job-id` ↔ `args.job_id` (argparse auto-translates dashes to underscores) | OK |
| Updater endpoint URL | matches GitHub release path | possibly wrong owner spelling | **Blocker B2** |

No other drift detected.

---

## 4. Optimisation opportunities

- **Three.js code splitting:** see M7. Expected drop ~600-700 KB from the initial chunk.
- **Lazy-import `@tauri-apps/plugin-dialog`:** already done at the call site (`tauri.ts:307`) — verified clean.
- **Cargo release profile:** add to `src-tauri/Cargo.toml`:
  ```toml
  [profile.release]
  lto = "thin"
  codegen-units = 1
  strip = "symbols"
  panic = "abort"
  ```
  Cuts MSI binary by 30-40% with negligible build-time increase for a small app.
- **PyInstaller `--strip --noupx`** (already excludes UPX by default; `--strip` shaves a few MB on Linux but is no-op on Windows MSVC — leave as-is).
- **Wait-free progress emission:** `serde_json::from_str` then `payload.clone()` in `sidecar.rs:200,211` copies the whole result payload. For large demos with thousands of kills, this is a few MB copied once. Acceptable.
- **Tailwind v4** correctly emits one CSS file via the `@tailwindcss/vite` plugin. Verified.

---

## 5. Things explicitly verified clean

- IPC contract `analysis:progress` and `analysis:result` shapes (Python → Rust → Frontend) match end-to-end.
- No `dangerouslySetInnerHTML` / `innerHTML` use anywhere in `src/` — React's default escaping handles user-controlled strings (player names, weapons, messages).
- `tauri.conf.json` pubkey matches `.tauri/cs2-analyser.key.pub` byte-for-byte.
- Window settings: `title: "CS2 Analyser"`, `width: 1280`, `height: 800`, `theme: "Dark"` — matches brief.
- Secrets in `release.yml` are passed via `env:` blocks only (lines 78-80), never interpolated into `run:` strings.
- All third-party GitHub Actions are pinned to a major: `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache@v2`, `actions/setup-python@v5`, `softprops/action-gh-release@v2`.
- `pnpm install --frozen-lockfile` used in both `ci.yml:33` and `release.yml:50`.
- Artefact upload globs match Tauri's bundle output (`*.msi`, `*.msi.zip`, `*.msi.zip.sig`, NSIS counterparts) and the workflow uses `fail_on_unmatched_files: true` so missing artefacts will fail loudly.
- `latest.json` manifest shape matches Tauri 2.x updater spec (`version`, `notes`, `pub_date`, `platforms["windows-x86_64"].{signature,url}`).
- PyInstaller output `analyzer-x86_64-pc-windows-msvc.exe` placed in `src-tauri/binaries/` matches Tauri's `externalBin` naming convention — though `tauri.conf.json` does not yet declare `bundle.externalBin: ["binaries/analyzer"]`; flagged in M1 / TODO at `sidecar.rs:70`.
- `.gitignore` covers `.tauri/`, `.env*`, `*.key`, `*.pem`, `*.pfx`, `secrets/` per `docs/SECURITY.md`.
- React 19 patterns: function components throughout, no class components, no obsolete `forwardRef`. Hooks rules followed (no conditional `useEffect`/`useState`).
- `requestAnimationFrame` is managed entirely by `@react-three/fiber` via `useFrame`; canvas unmount disposes the WebGL context automatically. The `useMatcap` `useEffect` cleanup disposes all materials on unmount — verified clean. No rAF leak.
- WebGL probe at `HeroModel.tsx:261-273` falls back to the SVG silhouette correctly.
- TypeScript strict mode is enabled (`tsconfig.json:18`); the few `as AnalysisProgress` casts in `tauri.ts:283,287,290` are inside a closure that already filters by `job_id` and is sourced from a typed `tauriListen<T>` — acceptable.
- Radix `Dialog.Root` handles focus trap and ESC dismissal automatically; close button has `aria-label="Close"`. Settings button has `aria-label="Settings"`. Verified.
- No unused Rust imports detected (`Manager`, `Emitter`, `AppHandle`, `Stdio`, all in use).
- `kill_on_drop(true)` set at `sidecar.rs:85` so panics in the orchestrator don't orphan Python.
- Python `main.py` always emits exactly one of `error` or `result+done` before returning — error paths checked: `unsupported_mode` (line 156), missing file (line 160), exception (line 170). All emit a single `event:error` line.
- `tauri.conf.json` correctly references `productName: "CS2 Analyser"`, `version: "0.1.0"`, `identifier: "com.cs2analyser.app"`.
- `dependabot.yml` covers npm, cargo, github-actions, and pip — all four ecosystems present.

---

## 6. Post-review actions (resolution log)

| Finding | Status | Resolved in |
|---|---|---|
| B1 — cancel arg snake_case | Fixed | `fix(ipc): cancel arg name, terminal-event flag, listener leak, kill reap` |
| B2 — updater endpoint owner spelling | **Verified clean** — the canonical GitHub handle is `YaroslavSavchenk` (truncated form of Savchenko), confirmed via `gh api /repos/YaroslavSavchenk/cs2-analyser`. No code change. | n/a |
| H1 — terminal flag for sidecar races | Fixed (added per-job `AtomicBool` to `SidecarManager`) | same commit as B1 |
| H2 — `install_update` honesty + error surface | Fixed | `fix(updater): unreachable comment after restart and surface install errors` |
| H3 — `hitgroup` fallback | Fixed | `fix(analyzer): hitgroup fallback for headshot detection` |
| H4 — drop `tauri-plugin-shell` | Fixed | `refactor(security): drop unused tauri-plugin-shell and tauri-plugin-opener` |
| M1 — production sidecar fail-fast | Fixed | `fix(sidecar): fail fast in release builds instead of silent python3 fallback` |
| M2 — reap after `start_kill` | Fixed | same commit as B1 |
| M6 — listener leak on abort | Fixed | same commit as B1 |
| M7 — three.js chunk split + lazy hero | Fixed (main bundle dropped from 1.2 MB to ~65 KB) | `perf(ui): split three.js into lazy chunk and cache WebGL probe` |
| M8 — drop `tailwindcss-animate` | Fixed | `chore: drop tailwindcss-animate, isolate pyinstaller, lower dependabot limit` |
| M10 — isolate `pyinstaller` to CI | Fixed | same commit as M8 |
| L3 — dependabot PR limit | Fixed (10 → 5) | same commit as M8 |
| L4 — cache WebGL probe | Fixed | same commit as M7 |
| L8 — drop `tauri-plugin-opener` | Fixed | same commit as H4 |

Deferred (acceptable for v0.1, not blockers):
- M3 negative-branch nullability, M4 paranoid `uuid` for job IDs, M5 effect-dep tightening, M9 arbitrary alpha classes (verified clean), L1 CSP (v0.2 todo), L2 pnpm pinning, L5 lucide-react migration (v0.2), L6 footer text, L7 (verified clean), L9 `requests` weight, L10 mode-error parsing.

