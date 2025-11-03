import { DownloadSettings, DownloadTask } from '@/store/storeTask';
import { invoke } from '@tauri-apps/api/core';

// API响应基础接口
export interface BaseResponse<T> {
  code: number;
  data: T;
}

// 下载统计信息接口
export interface DownloadStats {
  numActive?: string;        // 活动下载任务数
  numWaiting?: string;       // 等待下载任务数
  numStopped?: string;       // 已停止下载任务数
  numStoppedTotal?: string;  // 历史停止任务总数
  downloadSpeed?: string;    // 全局下载速度 (B/s)
  uploadSpeed?: string;      // 全局上传速度 (B/s)
}

// 下载游戏种子请求参数
export interface DownloadGameParams {
  id: number;
  torrent: string;
  version: string;
}

// 下载游戏种子响应
export interface DownloadGameResponse {
  code: number;
  buf: string;  //base64 
  error?: string;
}

// 错误响应接口
export interface ErrorResponse {
  code: number;
  error: string;
}

export class Api {

  // Tauri 后端: 调用 Tauri 接口获取下载统计
  static async getDownloadStats(): Promise<DownloadStats> {
    try {
      const result = await invoke<any>('get_download_stats');
      return {
        numActive: result.numActive || '0',
        numWaiting: result.numWaiting || '0',
        numStopped: result.numStopped || '0',
        numStoppedTotal: result.numStoppedTotal || '0',
        downloadSpeed: result.downloadSpeed || '0',
        uploadSpeed: result.uploadSpeed || '0'
      };
    } catch (error) {
      console.error('获取下载统计失败:', error);
      return {
        numActive: '0',
        numWaiting: '0',
        numStopped: '0',
        downloadSpeed: '0',
        uploadSpeed: '0'
      };
    }
  }

  static async getSettings(): Promise<DownloadSettings> {
    return await invoke<DownloadSettings>("get_download_settings");
  }

  static async updateSettings(newSettings: DownloadSettings) {
    try {
      await invoke<DownloadSettings>(
        'update_download_settings',
        {
          defaultDownloadDir: newSettings.default_download_dir,
          maxDownloadSpeed: newSettings.max_download_speed,
          maxUploadSpeed: newSettings.max_upload_speed,
          maxConcurrentDownloads: newSettings.max_concurrent_downloads,
          maxConnectionsPerTask: newSettings.max_connections_per_task,
        }
      );

    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  static async updateGlobalOption(options: Record<string, string>) {
    try {
      await invoke('change_global_option', { options });
    } catch (error) {
      console.error('Failed to update global option:', error);
      throw error;
    }
  } 
   
  static async tellStatus(gid:string, keys?:string[]) {
    return await invoke<DownloadTask>('tell_status', { gid, keys });
  }

  static async tellPath(gid :string) {
      try {
        let value = await invoke<any[]>("get_files", { gid: gid });
        if (value.length == 1) {
          let path = value[0].path; //这个是觉得目录
          return path;
        } else {

          let path = value[0].path;
          // 提取文件夹路径（去除文件名）
          const pathParts = path.split(/[/\\]/);
          // 移除最后一个元素（文件名），保留文件夹路径
          pathParts.pop();
          const dirPath = pathParts.join('/');
          return dirPath;
        }
      }catch(err){
        console.error(err);
      }
    };
}