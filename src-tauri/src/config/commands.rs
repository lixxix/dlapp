use crate::config::settings::DownloadSettings;
use std::sync::{Arc, Mutex};
use serde::{Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct DiskInfo {
    pub total: f64,      // 总空间 (GB)
    pub used: f64,       // 已使用 (GB)
    pub free: f64,       // 剩余空间 (GB)
    pub mount_point: String, // 挂载点
}

/// 获取当前下载设置
#[tauri::command]
pub async fn get_download_settings(
    settings_state: tauri::State<'_, Arc<Mutex<DownloadSettings>>>,
) -> Result<DownloadSettings, String> {
    let settings = settings_state
        .lock()
        .map_err(|e| format!("无法获取设置锁: {}", e))?;
    Ok(settings.clone())
}

/// 更新全局下载设置
#[tauri::command]
pub async fn update_download_settings(
    settings_state: tauri::State<'_, Arc<Mutex<DownloadSettings>>>,
    default_download_dir: Option<String>,
    max_download_speed: Option<u64>,
    max_upload_speed: Option<u64>,
    max_concurrent_downloads: Option<u32>,
    max_connections_per_task: Option<u32>,
) -> Result<DownloadSettings, String> {
    let mut settings = settings_state
        .lock()
        .map_err(|e| format!("无法获取设置锁: {}", e))?;

    settings.update_global_settings(
        default_download_dir,
        max_download_speed,
        max_upload_speed,
        max_concurrent_downloads,
        max_connections_per_task,
    );

    settings.save()?;

    println!("下载设置已更新: {:?}", settings);
    Ok(settings.clone())
}

