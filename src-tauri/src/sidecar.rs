use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex as StdMutex};

use anyhow::{anyhow, Context, Result};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone, Serialize)]
struct AnalysisError {
    job_id: String,
    kind: String,
    message: String,
}

#[derive(Default)]
pub struct SidecarManager {
    children: Arc<Mutex<HashMap<String, Child>>>,
    // Per-job flag set whenever a terminal event (result, error, cancelled)
    // is emitted. The post-wait block uses this to suppress a duplicate
    // sidecar_crashed when Python self-reports an error and exits 1.
    terminal_flags: Arc<StdMutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn insert(&self, job_id: String, child: Child) {
        self.children.lock().await.insert(job_id, child);
    }

    pub async fn remove(&self, job_id: &str) -> Option<Child> {
        self.children.lock().await.remove(job_id)
    }

    pub fn register_terminal_flag(&self, job_id: &str) {
        let mut map = self.terminal_flags.lock().expect("terminal_flags poisoned");
        map.entry(job_id.to_string())
            .or_insert_with(|| Arc::new(AtomicBool::new(false)));
    }

    pub fn mark_terminal(&self, job_id: &str) {
        if let Some(flag) = self
            .terminal_flags
            .lock()
            .expect("terminal_flags poisoned")
            .get(job_id)
        {
            flag.store(true, Ordering::SeqCst);
        }
    }

    pub fn is_terminal(&self, job_id: &str) -> bool {
        self.terminal_flags
            .lock()
            .expect("terminal_flags poisoned")
            .get(job_id)
            .map(|f| f.load(Ordering::SeqCst))
            .unwrap_or(false)
    }

    pub fn forget(&self, job_id: &str) {
        self.terminal_flags
            .lock()
            .expect("terminal_flags poisoned")
            .remove(job_id);
    }

    pub async fn kill(&self, job_id: &str) -> Result<bool> {
        let mut guard = self.children.lock().await;
        if let Some(mut child) = guard.remove(job_id) {
            child
                .start_kill()
                .with_context(|| format!("failed to kill sidecar for job {job_id}"))?;
            // Release the lock before awaiting so the stdout task can make
            // progress, then reap to avoid a zombie on Windows.
            drop(guard);
            let _ = child.wait().await;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    pub async fn kill_all(&self) {
        let mut guard = self.children.lock().await;
        for (job_id, mut child) in guard.drain() {
            if let Err(e) = child.start_kill() {
                warn!(job_id = %job_id, error = %e, "failed to kill sidecar on shutdown");
            }
            // Best-effort reap; we're shutting down anyway.
            let _ = child.wait().await;
        }
        self.terminal_flags
            .lock()
            .expect("terminal_flags poisoned")
            .clear();
    }
}

pub async fn spawn_analyzer(
    app: AppHandle,
    job_id: String,
    demo_path: String,
    mode: String,
) -> Result<()> {
    // v0.1: dev mode only. Production sidecar wiring is a TODO once the
    // PyInstaller-bundled analyzer binary exists.
    if !cfg!(debug_assertions) {
        // TODO(prod): swap to tauri_plugin_shell sidecar binary `analyzer`.
        warn!("production sidecar path not implemented; falling back to python3");
    }

    let mut command = Command::new("python3");
    command
        .arg("analyzer/main.py")
        .arg("--job-id")
        .arg(&job_id)
        .arg("--mode")
        .arg(&mode)
        .arg("--demo")
        .arg(&demo_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    let mut child = command
        .spawn()
        .with_context(|| format!("failed to spawn python3 analyzer for job {job_id}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| anyhow!("sidecar stdout was not captured"))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| anyhow!("sidecar stderr was not captured"))?;

    let manager_state = app.state::<SidecarManager>();
    manager_state.register_terminal_flag(&job_id);
    manager_state.insert(job_id.clone(), child).await;

    let app_for_stdout = app.clone();
    let job_id_for_stdout = job_id.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    if line.trim().is_empty() {
                        continue;
                    }
                    handle_sidecar_line(&app_for_stdout, &job_id_for_stdout, &line);
                }
                Ok(None) => break,
                Err(e) => {
                    error!(job_id = %job_id_for_stdout, error = %e, "sidecar stdout read error");
                    emit_terminal_error(
                        &app_for_stdout,
                        &job_id_for_stdout,
                        "sidecar_crashed",
                        &format!("stdout read error: {e}"),
                    );
                    break;
                }
            }
        }

        // Reap the child to capture exit status, then drop it from the manager.
        if let Some(mut child) = app_for_stdout
            .state::<SidecarManager>()
            .remove(&job_id_for_stdout)
            .await
        {
            match child.wait().await {
                Ok(status) if status.success() => {
                    debug!(job_id = %job_id_for_stdout, "sidecar exited cleanly");
                }
                Ok(status) => {
                    // Suppress a duplicate sidecar_crashed when the Python side
                    // already emitted a terminal error/result and exited non-zero.
                    if app_for_stdout
                        .state::<SidecarManager>()
                        .is_terminal(&job_id_for_stdout)
                    {
                        debug!(job_id = %job_id_for_stdout, code = ?status.code(), "sidecar exited non-zero after terminal event");
                    } else {
                        warn!(job_id = %job_id_for_stdout, code = ?status.code(), "sidecar exited with non-zero status");
                        emit_terminal_error(
                            &app_for_stdout,
                            &job_id_for_stdout,
                            "sidecar_crashed",
                            &format!("sidecar exited with status {:?}", status.code()),
                        );
                    }
                }
                Err(e) => {
                    error!(job_id = %job_id_for_stdout, error = %e, "failed to await sidecar exit");
                }
            }
        }

        // Clean up the terminal flag for this job.
        app_for_stdout
            .state::<SidecarManager>()
            .forget(&job_id_for_stdout);
    });

    let job_id_for_stderr = job_id.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            debug!(job_id = %job_id_for_stderr, "[analyzer stderr] {}", line);
        }
    });

    Ok(())
}

fn handle_sidecar_line(app: &AppHandle, job_id: &str, line: &str) {
    let value: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => {
            warn!(job_id = %job_id, error = %e, raw = %line, "failed to parse sidecar line as JSON");
            return;
        }
    };

    let event_kind = value.get("event").and_then(|v| v.as_str()).unwrap_or("");

    match event_kind {
        "progress" => emit_progress(app, job_id, &value),
        "result" => emit_terminal_result(app, job_id, &value),
        "error" => {
            let kind = value
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("sidecar_crashed");
            let message = value
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown error");
            emit_terminal_error(app, job_id, kind, message);
        }
        other => {
            warn!(job_id = %job_id, event = %other, "unknown sidecar event kind");
        }
    }
}

fn emit_progress(app: &AppHandle, job_id: &str, value: &Value) {
    let mut payload = value.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.remove("event");
        obj.insert("job_id".into(), Value::String(job_id.to_string()));
    }
    if let Err(e) = app.emit("analysis:progress", payload) {
        error!(job_id = %job_id, error = %e, "failed to emit analysis:progress");
    }
}

fn emit_terminal_result(app: &AppHandle, job_id: &str, value: &Value) {
    // Mark terminal BEFORE emitting so the post-wait race observes the flag.
    app.state::<SidecarManager>().mark_terminal(job_id);

    let mut payload = value.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.remove("event");
        obj.insert("job_id".into(), Value::String(job_id.to_string()));
    }
    if let Err(e) = app.emit("analysis:result", payload) {
        error!(job_id = %job_id, error = %e, "failed to emit analysis:result");
    } else {
        info!(job_id = %job_id, "analysis result emitted");
    }
}

fn emit_terminal_error(app: &AppHandle, job_id: &str, kind: &str, message: &str) {
    app.state::<SidecarManager>().mark_terminal(job_id);

    let payload = AnalysisError {
        job_id: job_id.to_string(),
        kind: kind.to_string(),
        message: message.to_string(),
    };
    if let Err(e) = app.emit("analysis:error", &payload) {
        error!(job_id = %job_id, error = %e, "failed to emit analysis:error");
    }
}

pub async fn cancel(app: &AppHandle, job_id: &str) -> Result<()> {
    let manager = app.state::<SidecarManager>();
    // Set terminal first so the stdout-task's post-wait block doesn't
    // race with us and emit sidecar_crashed.
    manager.mark_terminal(job_id);
    let killed = manager.kill(job_id).await?;
    if killed {
        emit_terminal_error(app, job_id, "cancelled", "analysis cancelled by user");
        Ok(())
    } else {
        Err(anyhow!("no running job with id {job_id}"))
    }
}
