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
}));

export { useTasks };

