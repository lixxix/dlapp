use crate::aria2c::download_manager::{Aria2cClient, DownloadFile, DownloadTask, PeerInfo};
use crate::config::settings::{DownloadSettings, NewTaskSettings};
use base64::Engine;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// Tauri命令：通过URL添加下载任务（支持设置）
#[tauri::command]
pub async fn add_download_url(
    urls: Vec<String>,
    settings_state: tauri::State<'_, Arc<Mutex<DownloadSettings>>>,
    task_settings: Option<NewTaskSettings>,
) -> Result<String, String> {
    let client = Aria2cClient::new();

    // 从全局设置和任务设置生成 aria2c 选项
    let options = {
        let global_settings = settings_state
            .lock()
            .map_err(|e| format!("无法获取设置锁: {}", e))?;
        global_settings.to_aria2c_options(task_settings.as_ref())
    };

    client.add_uri(urls, Some(options)).await
}

// Tauri命令：通过种子文件添加下载任务（支持设置）
#[tauri::command]
pub async fn add_download_torrent(
    torrent_path: String,
    settings_state: tauri::State<'_, Arc<Mutex<DownloadSettings>>>,
    task_settings: Option<NewTaskSettings>,
) -> Result<String, String> {
    let client = Aria2cClient::new();

    // 读取种子文件
    let torrent_data = tokio::fs::read(&torrent_path)
        .await
        .map_err(|e| format!("Failed to read torrent file: {}", e))?;

    // 从全局设置和任务设置生成 aria2c 选项
    let options = {
        let global_settings = settings_state
            .lock()
            .map_err(|e| format!("无法获取设置锁: {}", e))?;
        global_settings.to_aria2c_options(task_settings.as_ref())
    };

    client.add_torrent(torrent_data, None, Some(options)).await
}

// Tauri命令：通过Base64编码的种子内容添加下载任务（支持设置）
#[tauri::command]
pub async fn add_download_torrent_base64(
    torrent_base64: String,
    settings_state: tauri::State<'_, Arc<Mutex<DownloadSettings>>>,
    task_settings: Option<NewTaskSettings>,
) -> Result<String, String> {
    let client = Aria2cClient::new();

    println!("add base:{}", torrent_base64);
    // 解码Base64格式的种子内容
    let torrent_data = base64::engine::general_purpose::STANDARD
        .decode(&torrent_base64)
        .map_err(|e| format!("Failed to decode base64 torrent data: {}", e))?;

    // 从全局设置和任务设置生成 aria2c 选项
    let options = {
        let global_settings = settings_state
            .lock()
            .map_err(|e| format!("无法获取设置锁: {}", e))?;
        global_settings.to_aria2c_options(task_settings.as_ref())
    };

    client.add_torrent(torrent_data, None, Some(options)).await
}

// Tauri命令：通过磁力链接添加下载任务（支持设置）
#[tauri::command]
pub async fn add_download_magnet(
    magnet_link: String,
    settings_state: tauri::State<'_, Arc<Mutex<DownloadSettings>>>,
    task_settings: Option<NewTaskSettings>,
) -> Result<String, String> {
    let client = Aria2cClient::new();

    // 从全局设置和任务设置生成 aria2c 选项
    let options = {
        let global_settings = settings_state
            .lock()
            .map_err(|e| format!("无法获取设置锁: {}", e))?;
        global_settings.to_aria2c_options(task_settings.as_ref())
    };

    client.add_uri(vec![magnet_link], Some(options)).await
}

// Tauri命令：获取指定下载任务的状态
#[tauri::command]
pub async fn get_download_status(gid: String) -> Result<DownloadTask, String> {
    let client = Aria2cClient::new();
    client.get_download_status(&gid).await
}

// Tauri命令：使用aria2.tellStatus获取指定GID任务的详细信息（支持字段列表参数）
// 使用第二个参数指定要返回的字段列表，避免返回过多不必要的数据，提升性能
#[tauri::command]
pub async fn tell_status(
    gid: String,
    keys: Option<Vec<String>>,
) -> Result<serde_json::Value, String> {
    let client = Aria2cClient::new();
    client.tell_status(&gid, keys).await
}

// Tauri命令：获取所有活动下载任务
#[tauri::command]
pub async fn get_active_downloads() -> Result<Vec<DownloadTask>, String> {
    let client = Aria2cClient::new();
    client.get_active_downloads().await
}

// Tauri命令：获取等待中的下载任务
#[tauri::command]
pub async fn get_waiting_downloads() -> Result<Vec<DownloadTask>, String> {
    let client = Aria2cClient::new();
    client.get_waiting_downloads().await
}

// Tauri命令：获取已停止的下载任务
#[tauri::command]
pub async fn get_stopped_downloads() -> Result<Vec<DownloadTask>, String> {
    let client = Aria2cClient::new();
    client.get_stopped_downloads().await
}

// Tauri命令：暂停下载任务
#[tauri::command]
pub async fn pause_download(gid: String) -> Result<String, String> {
    let client = Aria2cClient::new();
    client.pause_download(&gid).await
}

// Tauri命令：恢复下载任务
#[tauri::command]
pub async fn resume_download(gid: String) -> Result<String, String> {
    let client = Aria2cClient::new();
    client.unpause_download(&gid).await
}

// Tauri命令：重启下载任务
#[tauri::command]
pub async fn restart_download(gid: String) -> Result<String, String> {
    let client = Aria2cClient::new();

    // 先获取任务信息
    let task_info = client.get_download_status(&gid).await?;

    // 删除原任务
    let _ = client.remove_download(&gid).await;

    // 根据任务类型重新添加任务
    if let Some(ref files) = task_info.files.first() {
        if !files.uris.is_empty() {
            // URL下载任务
            let uris: Vec<String> = files.uris.iter().map(|uri| uri.uri.clone()).collect();
            let mut options = std::collections::HashMap::new();
            if let Some(ref dir) = task_info.dir {
                options.insert("dir".to_string(), dir.clone());
            }
            return client.add_uri(uris, Some(options)).await;
        }
    }

    // 如果无法重启，返回错误
    Err("无法重启任务，缺少必要的任务信息".to_string())
}

// Tauri命令：删除下载任务
#[tauri::command]
pub async fn remove_download(gid: String) -> Result<String, String> {
    let client = Aria2cClient::new();
    client.remove_download(&gid).await
}

// Tauri命令：清理已完成/错误/已删除的下载任务
#[tauri::command]
pub async fn purge_download_result() -> Result<String, String> {
    let client = Aria2cClient::new();
    client.purge_download_result().await
}

// Tauri命令：获取BT任务的伙伴信息
#[tauri::command]
pub async fn get_peers(gid: String) -> Result<Vec<PeerInfo>, String> {
    let client = Aria2cClient::new();
    client.get_peers(&gid).await
}

#[tauri::command]
pub async fn get_files(gid: String) -> Result<Vec<DownloadFile>, String> {
    let client = Aria2cClient::new();
    client.get_files(&gid).await
}

// Tauri命令：获取全局统计信息
#[tauri::command]
pub async fn get_download_stats() -> Result<serde_json::Value, String> {
    let client = Aria2cClient::new();
    client.get_global_stat().await
}

// Tauri命令：批量添加下载任务
#[tauri::command]
pub async fn add_batch_downloads(
    download_list: Vec<serde_json::Value>,
) -> Result<Vec<String>, String> {
    let client = Aria2cClient::new();
    let mut gids = Vec::new();

    for download_item in download_list {
        let download_type = download_item
            .get("type")
            .and_then(|v| v.as_str())
            .ok_or("Missing download type")?;

        let download_dir = download_item
            .get("dir")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let gid = match download_type {
            "url" => {
                let urls = download_item
                    .get("urls")
                    .and_then(|v| v.as_array())
                    .ok_or("Missing URLs for URL download")?
                    .iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>();

                if urls.is_empty() {
                    return Err("No valid URLs provided".to_string());
                }

                let mut options = HashMap::new();
                if let Some(dir) = download_dir {
                    options.insert("dir".to_string(), dir);
                }
                let options = if options.is_empty() {
                    None
                } else {
                    Some(options)
                };

                client.add_uri(urls, options).await?
            }
            "magnet" => {
                let magnet = download_item
                    .get("magnet")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing magnet link")?
                    .to_string();

                let mut options = HashMap::new();
                if let Some(dir) = download_dir {
                    options.insert("dir".to_string(), dir);
                }
                let options = if options.is_empty() {
                    None
                } else {
                    Some(options)
                };

                client.add_uri(vec![magnet], options).await?
            }
            "torrent" => {
                let torrent_path = download_item
                    .get("torrent_path")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing torrent file path")?;

                let torrent_data = tokio::fs::read(torrent_path)
                    .await
                    .map_err(|e| format!("Failed to read torrent file: {}", e))?;

                let mut options = HashMap::new();
                if let Some(dir) = download_dir {
                    options.insert("dir".to_string(), dir);
                }
                let options = if options.is_empty() {
                    None
                } else {
                    Some(options)
                };

                client.add_torrent(torrent_data, None, options).await?
            }
            _ => return Err(format!("Unsupported download type: {}", download_type)),
        };

        gids.push(gid);
    }

    Ok(gids)
}

// Tauri命令：测试aria2c连接并获取详细信息
#[tauri::command]
pub async fn test_aria2c_connection_detailed() -> Result<serde_json::Value, String> {
    let client = Aria2cClient::new();

    // 首先测试基本连接
    let global_stat = match client.get_global_stat().await {
        Ok(stat) => stat,
        Err(e) => {
            return Ok(serde_json::json!({
                "connected": false,
                "error": e,
                "rpc_url": "http://127.0.0.1:6800/jsonrpc",
                "rpc_secret": "game_app_secret_2024"
            }));
        }
    };

    // 获取活动任务
    let active_tasks = client.get_active_downloads().await.unwrap_or_default();
    let waiting_tasks = client.get_waiting_downloads().await.unwrap_or_default();
    let stopped_tasks = client.get_stopped_downloads().await.unwrap_or_default();

    Ok(serde_json::json!({
        "connected": true,
        "global_stat": global_stat,
        "task_counts": {
            "active": active_tasks.len(),
            "waiting": waiting_tasks.len(),
            "stopped": stopped_tasks.len()
        },
        "active_tasks": active_tasks,
        "waiting_tasks": waiting_tasks,
        "recent_stopped": stopped_tasks.iter().take(3).collect::<Vec<_>>()
    }))
}

// Tauri命令：测试aria2c连接
#[tauri::command]
pub async fn test_aria2c_connection() -> Result<bool, String> {
    let client = Aria2cClient::new();
    match client.get_global_stat().await {
        Ok(_) => Ok(true),
        Err(e) => {
            if e.contains("Connection refused") || e.contains("HTTP request failed") {
                Ok(false)
            } else {
                Err(e)
            }
        }
    }
}

// 兼容性命令：简化的下载添加（保持向后兼容）
#[tauri::command]
pub async fn add_download_url_simple(
    urls: Vec<String>,
    download_dir: Option<String>,
) -> Result<String, String> {
    let client = Aria2cClient::new();
    let mut options = HashMap::new();
    if let Some(dir) = download_dir {
        options.insert("dir".to_string(), dir);
    }

    let options = if options.is_empty() {
        None
    } else {
        Some(options)
    };

    client.add_uri(urls, options).await
}

#[tauri::command]
pub async fn add_download_torrent_simple(
    torrent_path: String,
    download_dir: Option<String>,
) -> Result<String, String> {
    let client = Aria2cClient::new();
    let torrent_data = tokio::fs::read(&torrent_path)
        .await
        .map_err(|e| format!("Failed to read torrent file: {}", e))?;

    let mut options = HashMap::new();
    if let Some(dir) = download_dir {
        options.insert("dir".to_string(), dir);
    }

    let options = if options.is_empty() {
        None
    } else {
        Some(options)
    };

    client.add_torrent(torrent_data, None, options).await
}

#[tauri::command]
pub async fn add_download_magnet_simple(
    magnet_link: String,
    download_dir: Option<String>,
) -> Result<String, String> {
    let client = Aria2cClient::new();

    let mut options = HashMap::new();
    if let Some(dir) = download_dir {
        options.insert("dir".to_string(), dir);
    }

    let options = if options.is_empty() {
        None
    } else {
        Some(options)
    };

    client.add_uri(vec![magnet_link], options).await
}

// Tauri命令：获取全局选项
#[tauri::command]
pub async fn get_global_options() -> Result<HashMap<String, String>, String> {
    let client = Aria2cClient::new();
    client.get_global_option().await
}

// Tauri命令：更改全局选项
#[tauri::command]
pub async fn change_global_option(options: HashMap<String, String>) -> Result<(), String> {
    let client = Aria2cClient::new();
    println!("change_global_option: {:?}", options);
    client.change_global_option(options).await
}
