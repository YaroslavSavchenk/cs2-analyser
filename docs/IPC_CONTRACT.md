# IPC contract — frontend ⇄ Rust ⇄ Python

This document is the single source of truth for the inter-process communication contract. The frontend, the Rust orchestrator, and the Python sidecar must all agree on these shapes.

---

## Frontend → Rust (Tauri `invoke`)

### `analyze_demo`

Spawn the Python analyzer on a `.dem` file.

**Args:**
```ts
type AnalyzeDemoArgs = {
  path: string;             // absolute path to .dem file
  mode: "quick" | "full";   // "full" not implemented in v0.1 — backend returns error
};
```

**Returns:** `string` — a `job_id` that the frontend uses to correlate progress/result events.

Errors are surfaced both as a thrown `invoke` rejection (immediate failures: bad path, sidecar can't spawn) and as an `analysis:error` event (mid-flight failures: parse error, sidecar crash).

### `check_for_update`

Trigger the Tauri updater plugin and report what was found.

**Returns:**
```ts
type UpdateCheckResult =
  | { available: false }
  | { available: true; version: string; notes: string; date: string };
```

### `install_update`

Download and install the pending update, then restart the app.

**Returns:** `void` (the app process is replaced).

### `cancel_analysis`

Cancel a running analysis job by ID. Kills the Python sidecar for that job.

**Args:** `{ job_id: string }`

---

## Rust → Frontend (Tauri events)

All events carry the `job_id` so the frontend can route them to the right view.

### `analysis:progress`
```ts
type AnalysisProgress = {
  job_id: string;
  stage: "parsing" | "extracting" | "analyzing" | "finalizing";
  percent: number;           // 0..100
  message?: string;
};
```

### `analysis:result`
Final structured result. Emitted exactly once per job at the end.

```ts
type AnalysisResult = {
  job_id: string;
  mode: "quick" | "full";
  map: string;
  match_started_at: string;  // ISO 8601
  duration_seconds: number;
  rounds: number;
  events: Array<KillEvent | DeathEvent>;
};

type KillEvent = {
  type: "kill";
  round: number;
  tick: number;
  attacker: { name: string; steam_id: string };
  victim:   { name: string; steam_id: string };
  weapon: string;
  headshot: boolean;
};

type DeathEvent = {
  type: "death";
  round: number;
  tick: number;
  victim:   { name: string; steam_id: string };
  killer?:  { name: string; steam_id: string };   // absent if suicide / world
  weapon?: string;
};
```

### `analysis:error`
```ts
type AnalysisError = {
  job_id: string;
  kind: "spawn_failed" | "parse_failed" | "sidecar_crashed" | "cancelled" | "unsupported_mode";
  message: string;
};
```

---

## Rust ⇄ Python sidecar (stdin/stdout NDJSON)

The Rust orchestrator spawns the Python analyzer with:

```
analyzer.exe --job-id <uuid> --mode quick --demo /abs/path/to.dem
```

The sidecar writes **one JSON object per line** to stdout. Each line is one of:

```jsonc
// progress
{"event":"progress","stage":"parsing","percent":12,"message":"reading header"}

// final result (exactly one of these, last line before exit)
{"event":"result","mode":"quick","map":"de_mirage","match_started_at":"...","duration_seconds":2412,"rounds":24,"events":[...]}

// error (mutually exclusive with `result`)
{"event":"error","kind":"parse_failed","message":"..."}
```

Stderr is reserved for debug logs and is ignored by the Rust parser (forwarded to the tracing log).

The sidecar exits with code `0` on success and `1` on error.
