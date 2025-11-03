import { Api, DownloadStats } from "@/api/api";
import { useDownloadManager } from "@/contexts/DownloadManagerContextCore";
import { store } from "@/lib/utils";
import { useTasks } from "@/store/storeTask";
import { invoke } from "@tauri-apps/api/core";
import { listen, TauriEvent } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import {
  Activity,
  AlertCircle,
  CheckCheck,
  Download,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import DownloadTaskItem from "./DownloadTaskItem";

const DownloadManager: React.FC = () => {
  const { isConnected, loadDownloads ,checkConnection} = useDownloadManager();

  const tasks = useTasks();

  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [newTaskUrl, setNewTaskUrl] = useState("");
  const [selectedDownloadDir, setSelectedDownloadDir] = useState("");

  const [downloadStats, setDownloadStats] = useState<DownloadStats | null>(
    null
  );

  const torrentFileSetup = async (torrent: string[]) => {
    for (let i = 0; i < torrent.length; i++) {
      if (torrent[i].endsWith(".torrent")) {
        setShowAddTaskDialog(true);
        setNewTaskUrl(torrent[i]);

        return;
      } else {
        toast.error(`不支持的文件类型：${torrent[i]}`);
      }
    }
  };

  useEffect(() => {
    let unlisten: any = null;

    listen(TauriEvent.DRAG_DROP, (e: any) => {
      torrentFileSetup(e.payload.paths);
    }).then((u) => (unlisten = u));

    return () => {
      if (!unlisten) {
        setTimeout(() => {
          if (unlisten) unlisten();
        }, 1000);
      } else {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    loadDownloadStats();

    Api.getSettings().then((settings) => {
      setSelectedDownloadDir(settings.default_download_dir);
    });
    // 定时更新下载统计 (每2秒更新一次)
    const timer = setInterval(() => {
      loadDownloadStats();
    }, 2000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // 加载下载统计
  const loadDownloadStats = async () => {
    try {
      const stats = await Api.getDownloadStats();
      setDownloadStats(stats);
    } catch (error) {
      console.error("加载下载统计失败:", error);
    }
  };

  // 计算活动下载任务数
  const getActiveDownloadCount = (): number => {
    return tasks.tasks.filter((task) => task.status === "active").length;
  };

  // 计算已完成下载任务数
  const getCompletedDownloadCount = (): number => {
    return tasks.tasks.filter((task) => task.status === "complete").length;
  };

  // 格式化速度 (B/s 转换为 KB/s 或 MB/s)
  const formatSpeed = (speedStr: string): string => {
    try {
      const speed = parseInt(speedStr) || 0;
      if (speed === 0) return "0 KB/s";
      if (speed < 1024) return `${speed.toFixed(2)} B/s`;
      if (speed < 1024 * 1024) return `${(speed / 1024).toFixed(2)} KB/s`;
      return `${(speed / 1024 / 1024).toFixed(2)} MB/s`;
    } catch {
      return "0 KB/s";
    }
  };

  // 添加任务处理函数
  const handleAddTask = async () => {
    setShowAddTaskDialog(true);
    setSelectedDownloadDir(selectedDownloadDir);
  };

  // 选择下载目录
  const handleSelectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        title: "选择下载目录",
      });
      if (selected) {
        setSelectedDownloadDir(selected as string);
      }
    } catch (error) {
      console.error("选择目录失败:", error);
      toast.error("选择目录失败");
    }
  };

  const handlePauseDownload = useCallback(
    async (gid: string) => {
      try {
        // 立即更新期望状态
        // expectedStates.current[gid] = "paused";
        console.log("pause", gid);
        // 更新UI显示期望状态
        let result = await invoke("pause_download", { gid });
        if (result == gid) {
          tasks.setTargetStatus(gid, "paused");
        }
      } catch (error) {
        console.error("Failed to pause download:", error);
        // 如果命令执行失败，移除期望状态
      }
      loadDownloads();
    },
    [tasks]
  );

  const handleResumeDownload = useCallback(
    async (gid: string) => {
      try {
        // 立即更新期望状态

        console.log("resume", gid);

        // 发送恢复命令到 aria2c
        let result = await invoke("resume_download", { gid });
        if (result == gid) {
          // 如果命令执行失败，移除期望状态

          // 重新加载状态以恢复实际状态
          tasks.setTargetStatus(gid, "active");
          loadDownloads();
        }
      } catch (error) {
        console.error("Failed to resume download:", error);
        // 如果命令执行失败，移除期望状态

        // 重新加载状态以恢复实际状态
        loadDownloads();
      }
    },
    [tasks]
  );

  const handleRemoveDownload = useCallback(
    async (gid: string) => {
      try {
        // 立即更新期望状态

        await invoke("remove_download", { gid });
        loadDownloads();
      } catch (error) {
        console.error("Failed to remove download:", error);
        // 如果命令执行失败，移除期望状态

        // 重新加载状态以恢复实际状态
        loadDownloads();
      }
    },
    [tasks]
  );

  // 添加全部开始功能
  const handleStartAll = async () => {
    try {
      const activeTasks = tasks.tasks.filter(
        (task) => task.status !== "active"
      );

      // 发送恢复命令到 aria2c
      for (const task of activeTasks) {
        try {
          await invoke("resume_download", { gid: task.gid });
          tasks.setTargetStatus(task.gid, "active");
        } catch (error) {
          console.error(`Failed to resume download ${task.gid}:`, error);
        }
      }

      // 重新加载状态以同步实际状态
      setTimeout(loadDownloads, 100);
    } catch (error) {
      console.error("Failed to start all downloads:", error);
      loadDownloads();
    }
  };

  // 添加全部暂停功能
  const handlePauseAll = async () => {
    try {
      const activeTasks = tasks.tasks.filter(
        (task) => task.status === "active"
      );

      // 发送暂停命令到 aria2c
      for (const task of activeTasks) {
        try {
          await invoke("pause_download", { gid: task.gid });
          tasks.setTargetStatus(task.gid, "paused");
        } catch (error) {
          console.error(`Failed to pause download ${task.gid}:`, error);
        }
      }
      loadDownloads();
      // 重新加载状态以同步实际状态
      // setTimeout(loadDownloads, 100);
    } catch (error) {
      console.error("Failed to pause all downloads:", error);
      loadDownloads();
    }
  };

  // 添加清理完成任务功能
  const handleClearCompleted = async () => {
    try {
      const completedTasks = tasks.tasks.filter(
        (task) => task.status === "complete" || task.status === "error"
      );

      for (const task of completedTasks) {
        try {
          await invoke("remove_download", { gid: task.gid });
          tasks.removeTask(task.gid);
        } catch (error) {
          console.error(`Failed to remove download ${task.gid}:`, error);
        }
      }

      await store.save();
      // 重新加载任务列表
      // loadDownloads();
    } catch (error) {
      console.error("Failed to clear completed downloads:", error);
      // loadDownloads();
    }
    loadDownloads();
  };

  const startAria2c = async () => {
    try {
      await invoke("start_aria2c");
      setTimeout(async ()=>{
        await checkConnection();    
      },500)
    } catch (err) {
      // console.error(err)
      toast.error("启动Aria2c服务失败" + ":" + err);
    }
  };

  // 计算任务统计
  const activeCount = tasks.tasks.filter(
    (task) => task.status === "active"
  ).length;
  const pausedCount = tasks.tasks.filter(
    (task) => task.status === "paused"
  ).length;
  const completeCount = tasks.tasks.filter(
    (task) => task.status === "complete" || task.status === "error"
  ).length;

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F8F9FA]">
        <div className="bg-white rounded-lg p-8 border border-[#E8E8E8] shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-[#FF4D4F]" />
          </div>
          <h3 className="text-xl font-semibold text-[#262626] mb-2">
            无法连接到 Aria2c
          </h3>
          <p className="text-[#8C8C8C] mb-6">请确保 Aria2c 正在运行</p>
          <button
            onClick={startAria2c}
            className="bg-[#1890FF] hover:bg-[#0c76d4] text-white font-medium px-6 py-3 rounded transition-colors"
          >
            启动Aria2c下载器
          </button>
        </div>
      </div>
    );
  }

  const handleSubmitTask = async () => {
    if (!newTaskUrl.trim()) {
      toast.error("请输入下载链接");
      return;
    }

    try {
      // 使用选中的目录或默认目录
      const downloadDir = selectedDownloadDir;

      // 判断是 magnet 链接还是 URL
      const isMagnet = newTaskUrl.trim().toLowerCase().startsWith("magnet:");

      if (isMagnet) {
        // 磁力链接
        await invoke("add_download_magnet_simple", {
          magnetLink: newTaskUrl,
          downloadDir: downloadDir,
        });
        console.log("添加磁力任务:", newTaskUrl);
      } else {
        // 判断是否是 HTTP/HTTPS 地址
        const isHttpUrl =
          newTaskUrl.trim().toLowerCase().startsWith("http://") ||
          newTaskUrl.trim().toLowerCase().startsWith("https://");
        if (isHttpUrl) {
          // HTTP/HTTPS URL
          await invoke("add_download_url_simple", {
            urls: [newTaskUrl],
            downloadDir: downloadDir,
          });
          console.log("添加URL任务:", newTaskUrl);
        } else {
          let ex = await exists(newTaskUrl);
          if (!ex) {
            toast.error("不符合条件，无法下载");
          } else {
            await invoke("add_download_torrent_simple", {
              torrentPath: newTaskUrl,
              downloadDir: downloadDir,
            });
            console.log("添加文件任务:", newTaskUrl);
          }
        }
      }

      toast.success("任务添加成功");
      setNewTaskUrl("");
      setShowAddTaskDialog(false);
      loadDownloads();
    } catch (error) {
      console.error("添加任务失败:", error);
      toast.error("添加任务失败: " + error);
    }
  };

  return (
    <div className="flex flex-col overflow-y-auto">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* 增加一起操作的功能 */}
          {showAddTaskDialog && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-10"
              onClick={() => setShowAddTaskDialog(false)}
            >
              <div
                className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-[#262626] mb-4">
                  添加下载任务
                </h3>
                <textarea
                  rows={4}
                  value={newTaskUrl}
                  onChange={(e) => setNewTaskUrl(e.target.value)}
                  placeholder="请输入下载链接（HTTP/HTTPS/磁力链接）"
                  className="w-full px-4 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF] text-sm mb-4"
                  onKeyUp={(e) => e.key === "Enter" && handleSubmitTask()}
                />
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={selectedDownloadDir}
                    placeholder="选择下载目录（可选）"
                    readOnly
                    className="flex-1 px-4 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF] text-sm bg-[#FAFAFA]"
                  />
                  <button
                    onClick={handleSelectDirectory}
                    className="px-4 py-2 border border-[#D9D9D9] rounded text-[#262626] hover:text-[#1890FF] hover:border-[#1890FF] transition-colors text-sm font-medium whitespace-nowrap"
                  >
                    浏览
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowAddTaskDialog(false);
                    }}
                    className="px-4 py-2 border border-[#D9D9D9] rounded text-[#262626] hover:text-[#1890FF] hover:border-[#1890FF] transition-colors text-sm"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitTask}
                    className="px-4 py-2 bg-[#1890FF] hover:bg-[#0c76d4] text-white rounded transition-colors text-sm font-medium"
                  >
                    确定
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-4 border border-[#E8E8E8] shadow-sm mb-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* 左侧：主要操作按钮 */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleStartAll}
                  disabled={activeCount === tasks.tasks.length}
                  className="flex items-center gap-2 bg-[#52C41A] hover:bg-[#3da00f] disabled:bg-[#686868] disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded transition-colors text-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>全部开始</span>
                </button>

                <button
                  onClick={handlePauseAll}
                  disabled={pausedCount === tasks.tasks.length}
                  className="flex items-center gap-2 bg-[#FAAD14] hover:bg-[#d48806] disabled:bg-[#686868] disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded transition-colors text-sm"
                >
                  <Pause className="w-4 h-4" />
                  <span>全部暂停</span>
                </button>

                <button
                  onClick={handleClearCompleted}
                  disabled={completeCount === 0}
                  className="flex items-center gap-2 bg-[#1890FF] hover:bg-[#0c76d4] disabled:bg-[#686868] disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded transition-colors text-sm"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>清理完成</span>
                </button>
              </div>

              {/* 右侧：添加任务按钮 */}
              <div>
                <button
                  onClick={handleAddTask}
                  className="flex items-center gap-2 bg-[#1890FF] hover:bg-[#0c76d4] text-white font-medium px-4 py-2 rounded transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加任务</span>
                </button>
              </div>
            </div>
          </div>

          {tasks.tasks.length > 0 ? (
            tasks.tasks.map((task) => (
              <DownloadTaskItem
                key={task.gid}
                task={task}
                onPause={handlePauseDownload}
                onResume={handleResumeDownload}
                onRemove={handleRemoveDownload}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-12 gap-3">
              <div className="bg-white rounded-lg px-8 border border-[#E8E8E8] shadow-sm max-w-md w-full text-center p-8">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="w-8 h-8 text-[#1890FF]" />
                </div>
                <h3 className="text-xl font-semibold text-[#262626] mb-2">
                  暂无下载任务
                </h3>
                <p className="text-[#8C8C8C] mb-6">
                  当前没有正在进行的下载任务
                </p>
                <div className="bg-[#FAFAFA] rounded-lg p-4 text-left border border-[#E8E8E8]">
                  <h4 className="text-[#262626] font-medium mb-3 text-sm">
                    使用提示
                  </h4>
                  <ul className="text-[#8C8C8C] text-sm space-y-2">
                    <li className="flex items-start">
                      <span className="text-[#1890FF] mr-2">•</span>
                      <span>使用添加任务填写下载地址或者磁力链接进行下载</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#1890FF] mr-2">•</span>
                      <span>拖拽种子文件即可开启下载任务</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#1890FF] mr-2">•</span>
                      <span>可以在设置中调整下载相关配置</span>
                    </li>
                       <li className="flex items-start">
                      <span className="text-[#1890FF] mr-2">•</span>
                      <span>更多功能敬请期待</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部状态栏 - 固定 */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-white border-t border-[#E8E8E8] px-6  flex items-center">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#1890FF]" />
              <span className="text-[#8C8C8C]">进行中：</span>
              <span className="text-[#262626] font-semibold">
                {getActiveDownloadCount()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-[#52C41A]" />
              <span className="text-[#8C8C8C]">已完成：</span>
              <span className="text-[#262626] font-semibold">
                {getCompletedDownloadCount()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {getActiveDownloadCount() > 0 ? (
              <>
                <Activity className="w-4 h-4 text-[#1890FF]" />
                <span className="text-[#8C8C8C]">总下载速度：</span>
                <span className="text-[#1890FF] font-semibold font-mono">
                  {formatSpeed(downloadStats?.downloadSpeed || "0")}
                </span>
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 text-[#8C8C8C]" />
                <span className="text-[#8C8C8C]">空闲</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadManager;

