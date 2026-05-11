use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use tracing::{error, info};

#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum UpdateCheckResult {
    NotAvailable {
        available: bool,
    },
    Available {
        available: bool,
        version: String,
        notes: String,
        date: String,
    },
}

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let updater = app
        .updater()
        .map_err(|e| format!("failed to build updater: {e}"))?;

    match updater.check().await {
        Ok(Some(update)) => {
            info!(version = %update.version, "update available");
            Ok(UpdateCheckResult::Available {
                available: true,
                version: update.version.clone(),
                notes: update.body.clone().unwrap_or_default(),
                date: update
                    .date
                    .map(|d| d.to_string())
                    .unwrap_or_default(),
            })
        }
        Ok(None) => {
            info!("no update available");
            Ok(UpdateCheckResult::NotAvailable { available: false })
        }
        Err(e) => {
            error!(error = %e, "updater check failed");
            Err(format!("updater check failed: {e}"))
        }
    }
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    let updater = app
        .updater()
        .map_err(|e| format!("failed to build updater: {e}"))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("updater check failed: {e}"))?
        .ok_or_else(|| "no update available to install".to_string())?;

    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| format!("failed to install update: {e}"))?;

    info!("update installed; restarting");
    app.restart();
    // unreachable: AppHandle::restart() returns ! - it replaces the process.
}
