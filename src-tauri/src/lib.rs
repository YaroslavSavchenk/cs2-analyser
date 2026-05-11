mod sidecar;
mod updater;

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager, RunEvent};
use tracing::{info, Level};

use crate::sidecar::SidecarManager;

#[tauri::command]
async fn analyze_demo(app: AppHandle, path: String, mode: String) -> Result<String, String> {
    if mode != "quick" && mode != "full" {
        return Err(format!("unsupported mode: {mode}"));
    }
    if mode == "full" {
        // v0.1 contract: full mode is not implemented yet.
        return Err("unsupported_mode: full mode is not implemented in v0.1".into());
    }

    let job_id = mint_job_id();
    info!(job_id = %job_id, demo = %path, mode = %mode, "starting analysis");

    sidecar::spawn_analyzer(app, job_id.clone(), path, mode)
        .await
        .map_err(|e| format!("spawn_failed: {e}"))?;

    Ok(job_id)
}

#[tauri::command]
async fn cancel_analysis(app: AppHandle, job_id: String) -> Result<(), String> {
    sidecar::cancel(&app, &job_id)
        .await
        .map_err(|e| e.to_string())
}

fn mint_job_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("job-{nanos:x}-{count:x}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_max_level(if cfg!(debug_assertions) { Level::DEBUG } else { Level::INFO })
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(SidecarManager::new())
        .invoke_handler(tauri::generate_handler![
            analyze_demo,
            cancel_analysis,
            updater::check_for_update,
            updater::install_update,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let manager = app_handle.state::<SidecarManager>();
                // Block here so children are terminated before exit completes.
                tauri::async_runtime::block_on(async move {
                    manager.kill_all().await;
                });
                info!("all sidecars terminated on exit");
            }
        });
}
