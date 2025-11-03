use tauri::Runtime;

use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn tell_torrent_info<R: Runtime>(
    app: tauri::AppHandle<R>,
    torrent: String,
) -> Result<String, String> {
    //   println!("tell_torrent_info");
    let shell = app.shell();
    let sider = shell.sidecar("aria2c").unwrap();

    let output = sider
        .arg("-S")
        .arg(torrent)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let result = String::from_utf8_lossy(&output.stdout);
    Ok(result.to_string())
}
