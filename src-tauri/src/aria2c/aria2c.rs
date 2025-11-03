use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;


// 添加新的引用
use std::process::Command;

#[derive(Clone)]
pub struct Aria2cState {
    process: Arc<Mutex<Option<CommandChild>>>,
}

impl Aria2cState {
    pub fn new() -> Self {
        Self {
            process: Arc::new(Mutex::new(None)),
        }
    }

    // 添加一个新的辅助函数来检查系统中是否已经运行了aria2c
    fn is_aria2c_running() -> bool {
        let output = if cfg!(target_os = "windows") {
            Command::new("tasklist")
                .args(&["/FI", "IMAGENAME eq aria2c.exe"])
                .output()
        } else {
            Command::new("pgrep").arg("aria2c").output()
        };

        match output {
            Ok(output) => {
                if cfg!(target_os = "windows") {
                    // 在Windows上检查输出是否包含aria2c进程信息
                    String::from_utf8_lossy(&output.stdout).contains("aria2c.exe")
                } else {
                    // 在Unix系统上检查是否有进程ID返回
                    !output.stdout.is_empty()
                }
            }
            Err(_) => false,
        }
    }

    pub async fn start_aria2c(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        {
            let process_guard = self
                .process
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;

            // 如果进程已经在运行，则不再启动
            if process_guard.is_some() {
                return Ok(());
            }
        } // MutexGuard 在这里被释放

        // 检查系统中是否已经运行了aria2c进程
        if Self::is_aria2c_running() {
            println!("aria2c is already running on the system, skipping start");
            return Ok(());
        }


        let mut session_path = app_handle.path().app_data_dir().unwrap();

        session_path =  session_path.join("aria2c_session.txt");

        println!("Writing session file to: {}", session_path.display());

        if !Path::new(&session_path.display().to_string()).exists() {
            // 如果没有会话文件，则创建一个空的会话文件
            std::fs::File::create(&session_path.display().to_string())
                .map_err(|e| format!("Failed to create session file: {}", e))?;
        }

        let shell = app_handle.shell();

        // 启动aria2c进程，添加持久化参数
        let (_rx, child) = shell.sidecar("aria2c").unwrap()
            .args([
                "--enable-rpc",
                "--rpc-listen-all", 
                "--rpc-allow-origin-all",
                "--seed-ratio=1.0",
                "--seed-time=1",
                "--bt-tracker=\"udp://tracker.opentrackr.org:1337/announce,http://tracker.dler.org:6969/announce,udp://open.tracker.cl:1337/announce,udp://tracker.openbittorrent.com:80/announce\"",
                "--rpc-secret=game_app_secret_2024",
                format!("--save-session={}", session_path.display().to_string()).as_str(),
                format!("--input-file={}", session_path.display().to_string()).as_str(),
                "--continue=true",
                "--save-session-interval=10",
                "--auto-save-interval=1"
            ])
   
            .spawn()
            .map_err(|e| {
                format!("Failed to start aria2c: {}", e)
            })?;

        // 将进程保存到状态中
        {
            let mut process_guard = self
                .process
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            *process_guard = Some(child);
        }

        println!("aria2c started successfully with RPC enabled and session persistence");
        Ok(())
    }

    pub async fn stop_aria2c(&self) -> Result<(), String> {
        let child_option = {
            let mut process_guard = self
                .process
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {}", e))?;
            process_guard.take()
        };

        if let Some(child) = child_option {
            // 发送关闭信号给aria2c，让它保存会话
            let client = reqwest::Client::new();
            let shutdown_request = serde_json::json!({
                "jsonrpc": "2.0",
                "id": "shutdown",
                "method": "aria2.forceShutdown",
                "params": ["token:game_app_secret_2024"]
            });

            // 尝试发送关闭请求
            let _ = client
                .post("http://127.0.0.1:6800/jsonrpc")
                .json(&shutdown_request)
                .send()
                .await;

            // 等待一段时间让aria2c保存会话
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

            // 杀死进程
            if let Err(e) = child.kill() {
                println!("Warning: Failed to kill aria2c process: {}", e);
            }
            println!("aria2c process stopped");
        }
        Ok(())
    }
}

// Tauri命令函数
#[tauri::command]
pub async fn start_aria2c(
    state: tauri::State<'_, Aria2cState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    state.start_aria2c(app).await
}

#[tauri::command]
pub async fn stop_aria2c(state: tauri::State<'_, Aria2cState>) -> Result<(), String> {
    state.stop_aria2c().await
}

#[tauri::command]
pub async fn get_aria2c_info() -> Result<serde_json::Value, String> {
    let info = serde_json::json!({
        "rpc_url": "http://127.0.0.1:6800/jsonrpc",
        "rpc_secret": "game_app_secret_2024",
        "status": "Ready for connections",
        "persistence": "Enabled with session file"
    });
    Ok(info)
}
