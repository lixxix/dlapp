import { Api } from "@/api/api";
import { DownloadManagerContext } from "@/contexts/DownloadManagerContextCore";
import { DownloadTask, useTasks } from "@/store/storeTask";
import { invoke } from "@tauri-apps/api/core";
import { exists } from "@tauri-apps/plugin-fs";
import React, { useCallback, useEffect, useRef, useState } from "react";

// Provider组件props类型
interface DownloadManagerProviderProps {
  children: React.ReactNode;
}

// Provider组件
export const DownloadManagerProvider: React.FC<
  DownloadManagerProviderProps
> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);
  const tasks = useTasks();

  // 设置刷新间隔
  const setRefreshInterval = (interval: number) => {
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }

    refreshInterval.current = setInterval(() => {
      if (isConnected) {
        loadDownloads();
      }
    }, interval);
  };

  // 检查连接状态
  const checkConnection = useCallback(async () => {
    try {
      const connected = await invoke<boolean>("test_aria2c_connection");
      setIsConnected(connected);
    } catch (error) {
      console.error("Failed to check connection:", error);
      setIsConnected(false);
    }
  }, []);

  // 加载下载任务
  const loadDownloads = useCallback(async () => {
    try {
      setIsLoading(true);
      const active_downloads = await invoke<DownloadTask[]>(
        "get_active_downloads"
      );
      const wait_downloads = await invoke<DownloadTask[]>(
        "get_waiting_downloads"
      );
      const stop_downloads = await invoke<DownloadTask[]>(
        "get_stopped_downloads"
      );

      for (let i = 0; i < stop_downloads.length; i++) {
        if (stop_downloads[i].status === "removed") {
          invoke("remove_download", { gid: stop_downloads[i].gid });
          stop_downloads.splice(i, 1);
          i--;
        }
      }

      // 合并所有下载任务
      let combinedDownloads = [
        ...active_downloads,
        ...wait_downloads,
        ...stop_downloads,
      ];
      let remove_gid: string[] = [];

      for (let i = 0; i < combinedDownloads.length; i++) {
        let unit = tasks.getTask(combinedDownloads[i].gid);
        if (unit) {
          if (unit.path) {
            combinedDownloads[i].path = unit.path;
            if (combinedDownloads[i].status == "complete") {
              let ex = await exists(combinedDownloads[i].path);
              if (!ex) {
                await invoke("remove_download", {
                  gid: combinedDownloads[i].gid,
                });
                remove_gid.push(combinedDownloads[i].gid);
              }
            }
          } else {
            combinedDownloads[i].path = await Api.tellPath(
              combinedDownloads[i].gid
            );
          }
        }
      }
      for (let i = 0; i < remove_gid.length; i++) {
        combinedDownloads = combinedDownloads.filter(
          (item) => item.gid !== remove_gid[i]
        );
      }

      tasks.setTasks(combinedDownloads);
    } catch (error) {
      console.error("Failed to load downloads:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化
  useEffect(() => {
    checkConnection();
    loadDownloads();

    setRefreshInterval(2000); // 默认2秒刷新一次

    // 监听页面切换事件
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [checkConnection, loadDownloads]);

  return (
    <DownloadManagerContext.Provider
      value={{
        isConnected,
        isLoading,
        checkConnection,
        loadDownloads,
      }}
    >
      {children}
    </DownloadManagerContext.Provider>
  );
};
