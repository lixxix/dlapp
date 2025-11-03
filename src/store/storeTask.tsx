import { Api } from "@/api/api";
import { store } from "@/lib/utils";
import { create } from "zustand";
export interface DownloadFile {
  index: string;
  path: string;
  length: string;
  completed_length: string;
  selected: string;
}
export interface DownloadSettings {
  default_download_dir: string;
  max_download_speed: number;
  max_upload_speed: number;
  max_concurrent_downloads: number;
  max_connections_per_task: number;
  continue_downloads: boolean;
}
export interface DownloadTask {
  path: string; // 路径
  gid: string;
  status: string;
  totalLength?: string;
  completedLength?: string;
  downloadSpeed?: string;
  uploadSpeed?: string;
  dir: string;
  files: DownloadFile[];
  errorCode?: string;
  errorMessage?: string;
  bittorrent?: any;

}

interface TaskState {
  tasks: DownloadTask[];
  setTasks: (tasks: DownloadTask[]) => void;
  addTask: (task: DownloadTask) => void;
  removeTask: (gid:string) => void;

  getTask: (gid: string) => DownloadTask | undefined;
  getTaskPath: (gid: string) => string;
  setTargetStatus: (gid: string, status: string) => void;

  updateStatus: () => void; // 更新状态
}

const useTasks = create<TaskState>((set, get) => ({
  tasks: [],
  setTasks: (tasks: DownloadTask[]) => set({    
    tasks
  }),
  addTask: (task: DownloadTask) => set({ tasks: [...get().tasks, task] }),
  removeTask: (gid: string) =>
    set({ tasks: get().tasks.filter((t) => t.gid !== gid) }),
  getTask: (gid: string) => get().tasks.find((t) => t.gid === gid),
  getTaskPath: (gid: string) => {
    let task = get().tasks.find((t) => t.gid === gid);
    if (task) {
      return task.path || task.gid;
    } else {
      return "";
    }
  },
  setTargetStatus: (gid: string, status: string) => {
    set({
      tasks: get().tasks.map((t) =>
        t.gid === gid ? { ...t, status } : t
      ),
    });
  },
  updateStatus: async () => {
    const tasks = get().tasks;
    const activeTasks = tasks.filter(task => task.status === "active");
    
    if (activeTasks.length === 0) return;

    try {
      // 批量更新，避免多次触发状态更新
      const updates = await Promise.all(
        activeTasks.map(async (task) => {
          try {
            const taskUpdates: Partial<DownloadTask> = {};
            
            if (!task.path) {
              taskUpdates.path = await Api.tellPath(task.gid);
              if (!taskUpdates.path) {
                store.set(task.gid, taskUpdates.path)
              }
            }

            const status = await Api.tellStatus(task.gid, [
              "status",
              "downloadSpeed",
              "uploadSpeed",
              "completedLength",
            ]);
            
            return { gid: task.gid, updates: { ...taskUpdates, ...status } };
          } catch (error) {
            console.error(`Failed to update task ${task.gid}:`, error);
            return { gid: task.gid, updates: {} };
          }
        })
      );

      // 一次性更新所有任务
      set({
        tasks: get().tasks.map((t) => {
          const update = updates.find(u => u.gid === t.gid);
          return update && Object.keys(update.updates).length > 0 ? { ...t, ...update.updates } : t;
        }),
      });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  },
}));

export { useTasks };

