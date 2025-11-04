mod aria2c;
mod config;
use crate::aria2c::{
    add_batch_downloads, add_download_magnet, add_download_magnet_simple, add_download_torrent,
    add_download_torrent_base64, add_download_torrent_simple, add_download_url,
    add_download_url_simple, change_global_option, get_active_downloads, get_download_stats,
    get_download_status, get_files, get_global_options, get_peers, get_stopped_downloads,
    get_waiting_downloads, pause_download, purge_download_result, remove_download,
    restart_download, resume_download, tell_status, tell_torrent_info, test_aria2c_connection,
    test_aria2c_connection_detailed,
};

use crate::aria2c::{get_aria2c_info, start_aria2c, stop_aria2c, Aria2cState};
use crate::config::commands::{ get_download_settings, update_download_settings};
use crate::config::settings::DownloadSettings;
use rouille::Response;
use std::env;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::tray::TrayIconEvent;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

fn start_http_server(app_handle: tauri::AppHandle) {
    rouille::start_server("127.0.0.1:6567", move |request| {
        println!("Received request: {} {}", request.method(), request.url());

        match (request.method(), request.url().as_ref()) {
            ("GET", "/health") => Response::text("Server is running"),

            ("POST", "/message") => {
                // 解析 JSON 消息
                let input_data: Result<serde_json::Value, _> = rouille::input::json_input(request);

                match input_data {
                    Ok(message) => {
                        // 发送消息到前端
                        let app_handle_clone = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            app_handle_clone
                                .emit("http-message", message)
                                .expect("failed to emit event");
                        });

                        Response::json(&serde_json::json!({
                            "status": "success",
                            "message": "Message sent to frontend"
                        }))
                    }
                    Err(_) => Response::json(&serde_json::json!({
                        "status": "error",
                        "message": "Invalid JSON"
                    }))
                    .with_status_code(400),
                }
            }

            ("POST", "/command") => {
                // 处理其他命令
                let input_data: Result<serde_json::Value, _> = rouille::input::json_input(request);

                match input_data {
                    Ok(data) => {
                        let app_handle_clone = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            app_handle_clone
                                .emit("http-command", &data)
                                .expect("failed to emit event");
                        });

                        Response::json(&serde_json::json!({
                            "status": "success"
                        }))
                    }
                    Err(_) => Response::text("Invalid JSON").with_status_code(400),
                }
            }

            _ => Response::text("Not found").with_status_code(404),
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 运行参数检测， url 启动的模式。
    let aria2c_state = Aria2cState::new();
    let args: Vec<String> = env::args().collect();
    // let mut params = "dlapp://open=44970-exit-the-abyss_20250709.torrent".to_string();
    // let mut params = "dlapp://?open=49619-pigface_20250919.torrent".to_string();
    let mut params = "".to_string();
    if args.len() > 1 {
        params = args[1].clone();
    }
    // 初始化设置状态
    let settings_state: Arc<Mutex<DownloadSettings>> =
        Arc::new(Mutex::new(DownloadSettings::load().unwrap_or_else(|e| {
            eprintln!("Failed to load settings, using default: {}", e);
            DownloadSettings::default()
        })));

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(aria2c_state.clone())
        .manage(settings_state.clone())
        .invoke_handler(tauri::generate_handler![
            // Aria2c 命令
            start_aria2c,
            stop_aria2c,
            get_aria2c_info,
            add_download_url,
            add_download_torrent,
            add_download_torrent_base64,
            add_download_magnet,
            get_download_status,
            get_active_downloads,
            get_waiting_downloads,
            get_stopped_downloads,
            pause_download,
            resume_download,
            restart_download,
            remove_download,
            purge_download_result,
            get_peers,
            get_files,
            get_download_stats,
            add_batch_downloads,
            test_aria2c_connection,
            test_aria2c_connection_detailed,
            tell_status,
            // 兼容性命令
            add_download_url_simple,
            add_download_torrent_simple,
            add_download_magnet_simple,
            // 全局选项命令
            change_global_option,
            get_global_options,
            // 设置命令
            get_download_settings,
            update_download_settings,
            // 主动命令
            tell_torrent_info,

        ])
        .on_window_event( move |app, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if app.label() == "main" {
                    app.hide().unwrap();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .setup(move |app| {
            // 在setup阶段启动aria2c，这时已经有了tokio运行时
            let aria2c_state_clone = aria2c_state.clone();
            let settings_state_clone = settings_state.clone();

            let app_handle = app.handle().clone();
            thread::spawn(move || {
                start_http_server(app_handle);
            });

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = aria2c_state_clone.start_aria2c(app_handle).await {
                    eprintln!("Failed to start aria2c on startup: {}", e);
                }

                // 获取全局设置并发送到aria2c
                if let Ok(settings) = settings_state_clone.lock() {
                    let global_config = settings.get_global_aria2c_config();
                    if !global_config.is_empty() {
                        let global_config_clone = global_config.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = change_global_option(global_config_clone).await {
                                eprintln!("Failed to send global config to aria2c: {}", e);
                            } else {
                                println!(
                                    "Successfully sent global config to aria2c: {:?}",
                                    global_config
                                );
                            }
                        });
                    }
                }
            });

            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show_windown = MenuItem::with_id(app, "show_window", "显示", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_windown, &quit_i])?;

            let main_window = app.get_webview("main").unwrap();
            // main_window.open_devtools();
            main_window
                .eval(&format!("window.location.href = '/?params={}'", params))
                .unwrap();

            // 创建托盘图标并添加菜单
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|app, event| match event {
                    TrayIconEvent::DoubleClick { id, .. } => {
                        println!("tray icon was clicked {:?}", id);
                        if let Some(main) = app.app_handle().get_window("main") {
                            println!("has main window");
                            if main.is_minimized().unwrap() {
                                main.unminimize().unwrap();
                            } else {
                                main.show().unwrap();
                                main.set_focus().unwrap();
                            }
                        }
                    }
                    _ => {}
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        println!("Quit menu item clicked, stopping aria2c...");
        
                        // 先停止 aria2c
                        let app_handle = app.app_handle().clone();
                        tauri::async_runtime::block_on(async move {
                            let state = app_handle.state::<Aria2cState>();
                            if let Err(e) = state.inner().stop_aria2c().await {
                                eprintln!("Failed to stop aria2c: {}", e);
                            } else {
                                println!("aria2c stopped successfully");
                            }
                        });
                        
                        // 等待一小段时间确保 aria2c 完全停止
                        thread::sleep(std::time::Duration::from_millis(500));
                        // 关闭所有窗口
                        for (_, window) in app.windows().iter() {
                            let _ = window.close();
                        }
                        
                        // 退出应用
                        app.exit(0);
                    }
                    "show_window" => {
                        println!("show_window menu item was clicked");
                        if let Some(main) = app.get_window("main") {
                            println!("has main window");
                            if main.is_minimized().unwrap() {
                                main.unminimize().unwrap();
                            } else {
                                main.show().unwrap();
                                main.set_focus().unwrap();
                            }
                        }
                    }
                    _ => {
                        println!("menu item {:?} not handled", event.id);
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
