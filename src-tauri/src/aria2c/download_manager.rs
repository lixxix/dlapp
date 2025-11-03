use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, vec};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadTask {
    pub gid: String,
    pub status: String,
    #[serde(rename = "totalLength")]
    pub total_length: Option<String>,
    #[serde(rename = "completedLength")]
    pub completed_length: Option<String>,
    #[serde(rename = "downloadSpeed")]
    pub download_speed: Option<String>,
    #[serde(rename = "uploadSpeed")]
    pub upload_speed: Option<String>,
    pub dir: Option<String>,
    pub files: Vec<DownloadFile>,
    #[serde(rename = "errorCode")]
    pub error_code: Option<String>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    pub bittorrent: Option<BitTorrentInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadFile {
    pub index: String,
    pub path: String,
    pub length: String,
    #[serde(rename = "completedLength")]
    pub completed_length: String,
    pub selected: String,
    pub uris: Vec<FileUri>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileUri {
    pub uri: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitTorrentInfo {
    pub announce_list: Option<Vec<Vec<String>>>,
    pub comment: Option<String>,
    pub creation_date: Option<i64>,
    pub mode: Option<String>,
    pub info: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: String,
    pub method: String,
    pub params: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
}

/// 定义Peer信息结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    #[serde(rename = "peerId")]
    pub peer_id: String,
    pub ip: String,
    pub port: String,
    pub bitfield: String,
    #[serde(rename = "amChoking")]
    pub am_choking: bool,
    #[serde(rename = "peerChoking")]
    pub peer_choking: bool,
    #[serde(rename = "downloadSpeed")]
    pub download_speed: String,
    #[serde(rename = "uploadSpeed")]
    pub upload_speed: String,
    pub seeder: bool,
}

pub struct Aria2cClient {
    client: reqwest::Client,
    rpc_url: String,
    rpc_secret: String,
}

impl Aria2cClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            rpc_url: "http://127.0.0.1:6800/jsonrpc".to_string(),
            rpc_secret: "game_app_secret_2024".to_string(),
        }
    }

    async fn make_rpc_call(
        &self,
        method: &str,
        params: Vec<serde_json::Value>,
    ) -> Result<serde_json::Value, String> {
        let mut rpc_params = vec![serde_json::Value::String(format!(
            "token:{}",
            self.rpc_secret
        ))];
        rpc_params.extend(params);

        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: chrono::Utc::now().timestamp().to_string(),
            method: method.to_string(),
            params: rpc_params,
        };

        let response = self
            .client
            .post(&self.rpc_url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to get response text: {}", e))?;

        let rpc_response: JsonRpcResponse = serde_json::from_str(&response_text).map_err(|e| {
            format!(
                "Failed to parse JSON response: {} - 响应内容: {}",
                e, response_text
            )
        })?;

        if let Some(error) = rpc_response.error {
            return Err(format!(
                "RPC error: {} (code: {})",
                error.message, error.code
            ));
        }

        rpc_response
            .result
            .ok_or_else(|| "No result in response".to_string())
    }

    pub async fn add_uri(
        &self,
        uris: Vec<String>,
        options: Option<HashMap<String, String>>,
    ) -> Result<String, String> {
        let mut params = vec![serde_json::Value::Array(
            uris.into_iter().map(serde_json::Value::String).collect(),
        )];

        if let Some(opts) = options {
            params.push(serde_json::Value::Object(
                opts.into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect(),
            ));
        }

        let result = self.make_rpc_call("aria2.addUri", params).await?;

        result
            .as_str()
            .ok_or_else(|| "Invalid GID returned".to_string())
            .map(|s| s.to_string())
    }

    pub async fn add_torrent(
        &self,
        torrent_data: Vec<u8>,
        uris: Option<Vec<String>>,
        options: Option<HashMap<String, String>>,
    ) -> Result<String, String> {
        let torrent_base64 = base64::engine::general_purpose::STANDARD.encode(&torrent_data);

        let mut params = vec![serde_json::Value::String(torrent_base64)];

        if let Some(uri_list) = uris {
            params.push(serde_json::Value::Array(
                uri_list
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            ));
        } else {
            params.push(serde_json::Value::Array(vec![]));
        }

        if let Some(opts) = options {
            params.push(serde_json::Value::Object(
                opts.into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect(),
            ));
        }

        let result = self.make_rpc_call("aria2.addTorrent", params).await?;

        result
            .as_str()
            .ok_or_else(|| "Invalid GID returned".to_string())
            .map(|s| s.to_string())
    }

    // 解析任务数据的辅助方法
    async fn parse_task_data(&self, task_data: serde_json::Value) -> Result<DownloadTask, String> {
        // 手动解析以应对不同的字段名和缺失字段
        let gid = task_data
            .get("gid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let status = task_data
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string();

        let total_length = task_data
            .get("totalLength")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let completed_length = task_data
            .get("completedLength")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let download_speed = task_data
            .get("downloadSpeed")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let upload_speed = task_data
            .get("uploadSpeed")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let dir = task_data
            .get("dir")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let error_code = task_data
            .get("errorCode")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let error_message = task_data
            .get("errorMessage")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // 解析文件信息
        let files = task_data
            .get("files")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|file_obj| {
                        let index = file_obj.get("index")?.as_str()?.to_string();
                        let path = file_obj.get("path")?.as_str()?.to_string();
                        let length = file_obj.get("length")?.as_str()?.to_string();
                        let completed_length =
                            file_obj.get("completedLength")?.as_str()?.to_string();
                        let selected = file_obj.get("selected")?.as_str()?.to_string();

                        let uris = file_obj
                            .get("uris")
                            .and_then(|v| v.as_array())
                            .map(|uri_arr| {
                                uri_arr
                                    .iter()
                                    .filter_map(|uri_obj| {
                                        let uri = uri_obj.get("uri")?.as_str()?.to_string();
                                        let status = uri_obj.get("status")?.as_str()?.to_string();
                                        Some(FileUri { uri, status })
                                    })
                                    .collect()
                            })
                            .unwrap_or_default();

                        Some(DownloadFile {
                            index,
                            path,
                            length,
                            completed_length,
                            selected,
                            uris,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        // 尝试解析bittorrent信息
        let bittorrent = task_data
            .get("bittorrent")
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        Ok(DownloadTask {
            gid,
            status,
            total_length,
            completed_length,
            download_speed,
            upload_speed,
            dir,
            files,
            error_code,
            error_message,
            bittorrent,
        })
    }

    pub async fn get_download_status(&self, gid: &str) -> Result<DownloadTask, String> {
        let params = vec![serde_json::Value::String(gid.to_string())];
        let result = self.make_rpc_call("aria2.tellStatus", params).await?;

        self.parse_task_data(result).await
    }

    /// 使用aria2.tellStatus获取指定GID任务的详细信息
    /// 支持指定字段列表参数，仅返回指定的字段以优化性能
    /// 
    /// # 参数
    /// - `gid`: 下载任务的GID
    /// - `keys`: 要返回的字段列表（象此指就是一个文串数组、详细）。
    ///   示例：["gid", "status", "totalLength", "completedLength", "downloadSpeed", "files"]
    ///   常用字段：gid, status, totalLength, completedLength, downloadSpeed, uploadSpeed, dir, files, errorCode, errorMessage, bittorrent
    pub async fn tell_status(
        &self,
        gid: &str,
        keys: Option<Vec<String>>,
    ) -> Result<serde_json::Value, String> {
        let mut params = vec![serde_json::Value::String(gid.to_string())];

        // 如果指定了字段列表，会传递给aria2.tellStatus作为第二个参数
        if let Some(field_list) = keys {
            let keys_array = serde_json::Value::Array(
                field_list
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            );
            params.push(keys_array);
        }

        self.make_rpc_call("aria2.tellStatus", params).await
    }  

    
    pub async fn get_active_downloads(&self) -> Result<Vec<DownloadTask>, String> {
        let query_item = json!([
            "gid",
            "status",
            "totalLength",
            "completedLength",
            "downloadSpeed",
            "totalLength",
            "dir",
            "errorCode",
            // "bittorrent",
            "errorMessage"
        ]);
        let result = self
            .make_rpc_call("aria2.tellActive", vec![query_item])
            .await?;

        let tasks = result.as_array().ok_or("Expected array of tasks")?;

        let mut download_tasks = Vec::new();

        for task_data in tasks {
            match self.parse_task_data(task_data.clone()).await {
                Ok(task) => download_tasks.push(task),
                Err(e) => {
                    println!("跳过解析失败的任务: {}", e);
                }
            }
        }

        Ok(download_tasks)
    }

    pub async fn get_waiting_downloads(&self) -> Result<Vec<DownloadTask>, String> {
        let query_item = json!([
            "gid",
            "status",
            "totalLength",
            "completedLength",
            "downloadSpeed",
            "totalLength",
            "dir",
            "errorCode",
            // "bittorrent",
            "errorMessage"
        ]);
        let result = self
            .make_rpc_call(
                "aria2.tellWaiting",
                vec![
                    serde_json::Value::Number(serde_json::Number::from(0)),
                    serde_json::Value::Number(serde_json::Number::from(100)),
                    query_item,
                ],
            )
            .await?;

        let tasks = result.as_array().ok_or("Expected array of tasks")?;

        let mut download_tasks = Vec::new();

        for task_data in tasks {
            match self.parse_task_data(task_data.clone()).await {
                Ok(task) => download_tasks.push(task),
                Err(e) => {
                    println!("跳过解析失败的等待任务: {}", e);
                }
            }
        }

        Ok(download_tasks)
    }

    pub async fn get_stopped_downloads(&self) -> Result<Vec<DownloadTask>, String> {
        let query_item = json!([
            "gid",
            "status",
            "totalLength",
            "completedLength",
            "downloadSpeed",
            "totalLength",
            "dir",
            "errorCode",
            // "bittorrent",
            "errorMessage"
        ]);
        let result = self
            .make_rpc_call(
                "aria2.tellStopped",
                vec![
                    serde_json::Value::Number(serde_json::Number::from(0)),
                    serde_json::Value::Number(serde_json::Number::from(100)),
                    query_item,
                ],
            )
            .await?;

        let tasks = result.as_array().ok_or("Expected array of tasks")?;

        let mut download_tasks = Vec::new();

        for task_data in tasks {
            match self.parse_task_data(task_data.clone()).await {
                Ok(task) => download_tasks.push(task),
                Err(e) => {
                    println!("跳过解析失败的停止任务: {}", e);
                }
            }
        }

        Ok(download_tasks)
    }

    pub async fn pause_download(&self, gid: &str) -> Result<String, String> {
        let params = vec![serde_json::Value::String(gid.to_string())];
        let result = self.make_rpc_call("aria2.forcePause", params).await?;

        result
            .as_str()
            .ok_or_else(|| "Invalid response".to_string())
            .map(|s| s.to_string())
    }

    pub async fn unpause_download(&self, gid: &str) -> Result<String, String> {
        let params = vec![serde_json::Value::String(gid.to_string())];
        let result = self.make_rpc_call("aria2.unpause", params).await?;

        result
            .as_str()
            .ok_or_else(|| "Invalid response".to_string())
            .map(|s| s.to_string())
    }

    pub async fn remove_download(&self, gid: &str) -> Result<String, String> {
        // 首先尝试使用 aria2.remove (用于活动或等待中的任务)
        println!("删除任务: {}", gid);
        let params = vec![serde_json::Value::String(gid.to_string())];
        match self
            .make_rpc_call("aria2.forceRemove", params.clone())
            .await
        {
            Ok(result) => result
                .as_str()
                .ok_or_else(|| "Invalid response".to_string())
                .map(|s| s.to_string()),
            Err(_) => {
                // 如果 aria2.remove 失败，尝试使用 aria2.removeDownloadResult (用于已完成的任务)
                match self
                    .make_rpc_call("aria2.removeDownloadResult", params)
                    .await
                {
                    Ok(result) => result
                        .as_str()
                        .ok_or_else(|| "Invalid response".to_string())
                        .map(|s| s.to_string()),
                    Err(e) => Err(e),
                }
            }
        }
    }

    /// 清理已完成/错误/已删除的下载任务
    pub async fn purge_download_result(&self) -> Result<String, String> {
        let result = self
            .make_rpc_call("aria2.purgeDownloadResult", vec![])
            .await?;

        result
            .as_str()
            .ok_or_else(|| "Invalid response".to_string())
            .map(|s| s.to_string())
    }

    /// 获取BT任务的伙伴信息
    /// 获取任务的文件列表
    pub async fn get_files(&self, gid: &str) -> Result<Vec<DownloadFile>, String> {
        let params = vec![serde_json::Value::String(gid.to_string())];
        let result = self.make_rpc_call("aria2.getFiles", params).await?;

        let files = result.as_array().ok_or("Expected array of files")?;

        let mut download_files = Vec::new();

        for file_data in files {
            let index = file_data
                .get("index")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let path = file_data
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let length = file_data
                .get("length")
                .and_then(|v| v.as_str())
                .unwrap_or("0")
                .to_string();
            let completed_length = file_data
                .get("completedLength")
                .and_then(|v| v.as_str())
                .unwrap_or("0")
                .to_string();
            let selected = file_data
                .get("selected")
                .and_then(|v| v.as_str())
                .unwrap_or("true")
                .to_string();

            let uris = file_data
                .get("uris")
                .and_then(|v| v.as_array())
                .map(|uri_arr| {
                    uri_arr
                        .iter()
                        .filter_map(|uri_obj| {
                            let uri = uri_obj.get("uri")?.as_str()?.to_string();
                            let status = uri_obj.get("status")?.as_str()?.to_string();
                            Some(FileUri { uri, status })
                        })
                        .collect()
                })
                .unwrap_or_default();

            download_files.push(DownloadFile {
                index,
                path,
                length,
                completed_length,
                selected,
                uris,
            });
        }

        Ok(download_files)
    }

    pub async fn get_peers(&self, gid: &str) -> Result<Vec<PeerInfo>, String> {
        let params = vec![serde_json::Value::String(gid.to_string())];
        let result = self.make_rpc_call("aria2.getPeers", params).await?;

        // 解析伙伴信息
        let peers = result.as_array().ok_or("Expected array of peers")?;

        let mut peer_infos = Vec::new();

        for peer_data in peers {
            let peer_info = PeerInfo {
                peer_id: peer_data
                    .get("peerId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                ip: peer_data
                    .get("ip")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                port: peer_data
                    .get("port")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                bitfield: peer_data
                    .get("bitfield")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                am_choking: peer_data
                    .get("amChoking")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                peer_choking: peer_data
                    .get("peerChoking")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                download_speed: peer_data
                    .get("downloadSpeed")
                    .and_then(|v| v.as_str())
                    .unwrap_or("0")
                    .to_string(),
                upload_speed: peer_data
                    .get("uploadSpeed")
                    .and_then(|v| v.as_str())
                    .unwrap_or("0")
                    .to_string(),
                seeder: peer_data
                    .get("seeder")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
            };

            peer_infos.push(peer_info);
        }

        Ok(peer_infos)
    }

    pub async fn get_global_stat(&self) -> Result<serde_json::Value, String> {
        self.make_rpc_call("aria2.getGlobalStat", vec![]).await
    }

    /// 获取全局选项
    pub async fn get_global_option(&self) -> Result<HashMap<String, String>, String> {
        let result = self.make_rpc_call("aria2.getGlobalOption", vec![]).await?;

        // 将返回的JSON对象转换为HashMap<String, String>
        let options_map = result
            .as_object()
            .ok_or("Expected object as global options result")?
            .iter()
            .filter_map(|(key, value)| {
                // 将每个值转换为字符串
                value.as_str().map(|s| (key.clone(), s.to_string()))
            })
            .collect();

        Ok(options_map)
    }

    /// 更改全局选项
    pub async fn change_global_option(
        &self,
        options: HashMap<String, String>,
    ) -> Result<(), String> {
        // 将 HashMap 转换为 JSON 对象
        println!("options: {:?}", options);
        let options_obj: serde_json::Value = serde_json::Value::Object(
            options
                .into_iter()
                .map(|(k, v)| (k, serde_json::Value::String(v)))
                .collect(),
        );

        let params = vec![options_obj];
        self.make_rpc_call("aria2.changeGlobalOption", params)
            .await?;
        Ok(())
    }
}
