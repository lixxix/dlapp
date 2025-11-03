pub mod aria2c;
pub mod command_shell;
pub mod download_commands;
pub mod download_manager;

pub use aria2c::{get_aria2c_info, start_aria2c, stop_aria2c, Aria2cState};
pub use command_shell::tell_torrent_info;
pub use download_commands::*;
// 注意：我们只导出需要的项，避免未使用的导入警告
