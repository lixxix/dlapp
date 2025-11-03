use dirs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// 下载设置配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadSettings {
    /// 默认下载目录
    pub default_download_dir: String,
    /// 全局下载速度限制 (bytes/s, 0表示无限制)
    pub max_download_speed: u64,
    /// 全局上传速度限制 (bytes/s, 0表示无限制)
    pub max_upload_speed: u64,
    /// 最大活动任务数量
    pub max_concurrent_downloads: u32,
    /// 每个任务的最大连接数
    pub max_connections_per_task: u32,
    /// 任务级别的自定义设置
    pub task_settings: HashMap<String, TaskSettings>,
}

/// 单个任务的设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskSettings {
    /// 任务专用下载目录
    pub download_dir: Option<String>,
    /// 任务专用下载速度限制
    pub max_download_speed: Option<u64>,
    /// 任务专用上传速度限制
    pub max_upload_speed: Option<u64>,
    /// 任务专用连接数
    pub max_connections: Option<u32>,
}

/// 新建下载任务的设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTaskSettings {
    /// 下载目录
    pub download_dir: Option<String>,
    /// 下载速度限制
    pub max_download_speed: Option<u64>,
    /// 上传速度限制
    pub max_upload_speed: Option<u64>,
    /// 连接数限制
    pub max_connections: Option<u32>,
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            default_download_dir: dirs::download_dir()
                .unwrap_or_else(|| PathBuf::from("./downloads"))
                .to_string_lossy()
                .to_string(),
            max_download_speed: 0, // 无限制
            max_upload_speed: 0,   // 无限制
            max_concurrent_downloads: 5,
            max_connections_per_task: 16,
            task_settings: HashMap::new(),
        }
    }
}

impl DownloadSettings {
    /// 获取配置文件路径
    pub fn get_config_path() -> Result<PathBuf, String> {
        let app_data_dir = dirs::data_dir().ok_or("无法获取应用数据目录")?;

        let config_dir = app_data_dir.join("com.lixxix.dlapp");

        // 确保目录存在
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| format!("无法创建配置目录: {}", e))?;
        }

        Ok(config_dir.join("download_settings.json"))
    }

    /// 从文件加载配置
    pub fn load() -> Result<Self, String> {
        let config_path = Self::get_config_path()?;
        println!("conig path : {}", config_path.display());

        if !config_path.exists() {
            // 如果配置文件不存在，返回默认配置并保存
            let default_settings = Self::default();
            default_settings.save()?;
            return Ok(default_settings);
        }

        let content =
            fs::read_to_string(&config_path).map_err(|e| format!("无法读取配置文件: {}", e))?;
        println!("config path : {}", content);  
        let settings: Self =
            serde_json::from_str(&content).map_err(|e| format!("配置文件格式错误: {}", e))?;

        Ok(settings)
    }

    /// 保存配置到文件
    pub fn save(&self) -> Result<(), String> {
        let config_path = Self::get_config_path()?;

        let content =
            serde_json::to_string_pretty(self).map_err(|e| format!("序列化配置失败: {}", e))?;

        fs::write(&config_path, content).map_err(|e| format!("保存配置文件失败: {}", e))?;

        Ok(())
    }

    /// 更新全局设置
    pub fn update_global_settings(
        &mut self,
        default_download_dir: Option<String>,
        max_download_speed: Option<u64>,
        max_upload_speed: Option<u64>,
        max_concurrent_downloads: Option<u32>,
        max_connections_per_task: Option<u32>,
    ) {
        if let Some(dir) = default_download_dir {
            self.default_download_dir = dir;
        }
        if let Some(speed) = max_download_speed {
            self.max_download_speed = speed;
        }
        if let Some(speed) = max_upload_speed {
            self.max_upload_speed = speed;
        }
        if let Some(concurrent) = max_concurrent_downloads {
            self.max_concurrent_downloads = concurrent;
        }
        if let Some(connections) = max_connections_per_task {
            self.max_connections_per_task = connections;
        }
    }

    /// 为 aria2c 生成选项
    pub fn to_aria2c_options(
        &self,
        task_settings: Option<&NewTaskSettings>,
    ) -> HashMap<String, String> {
        let mut options = HashMap::new();

        // 设置下载目录
        let download_dir = task_settings
            .and_then(|ts| ts.download_dir.as_ref())
            .unwrap_or(&self.default_download_dir);
        options.insert("dir".to_string(), download_dir.clone());

        // 设置速度限制
        let max_download_speed = task_settings
            .and_then(|ts| ts.max_download_speed)
            .unwrap_or(self.max_download_speed);
        if max_download_speed > 0 {
            options.insert(
                "max-download-limit".to_string(),
                max_download_speed.to_string(),
            );
        }

        let max_upload_speed = task_settings
            .and_then(|ts| ts.max_upload_speed)
            .unwrap_or(self.max_upload_speed);
        if max_upload_speed > 0 {
            options.insert("max-upload-limit".to_string(), max_upload_speed.to_string());
        }

        // 设置连接数
        let max_connections = task_settings
            .and_then(|ts| ts.max_connections)
            .unwrap_or(self.max_connections_per_task);
        options.insert(
            "max-connection-per-server".to_string(),
            max_connections.to_string(),
        );
        options.insert("split".to_string(), max_connections.to_string());

        // 自动文件重命名
        options.insert("auto-file-renaming".to_string(), "true".to_string());

        options
    }

    /// 获取全局 aria2c 配置
    pub fn get_global_aria2c_config(&self) -> HashMap<String, String> {
        let mut config = HashMap::new();

        if self.max_download_speed > 0 {
            config.insert(
                "max-overall-download-limit".to_string(),
                self.max_download_speed.to_string(),
            );
        }

        if self.max_upload_speed > 0 {
            config.insert(
                "max-overall-upload-limit".to_string(),
                self.max_upload_speed.to_string(),
            );
        }

        config.insert(
            "max-concurrent-downloads".to_string(),
            self.max_concurrent_downloads.to_string(),
        );

        config
    }
}
