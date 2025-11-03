import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DownloadTask } from "@/store/storeTask";
import { remove } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  Archive,
  File,
  FileText,
  FileVideo,
  FolderOpen,
  Pause,
  Play,
  X,
} from "lucide-react";
import React, { memo, useMemo } from "react";

interface DownloadTaskItemProps {
  task: DownloadTask;
  onPause: (gid: string) => void;
  onResume: (gid: string) => void;
  onRemove: (gid: string) => void;
}

const DownloadTaskItem: React.FC<DownloadTaskItemProps> = memo(
  ({ task, onPause, onResume, onRemove }) => {


    const [display, setDisplay] = React.useState("");

    const displayName = useMemo(() => {
      if (!task.path) {
        return task.gid;
      }
      
      const p = task.path.substring(task.dir.length+1);
      const parts = p.split(/[/\\]/);
      // 过滤掉空字符串，获取路径的第一个部分（dir之后的第一个路径段）
      const filteredParts = parts.filter(part => part.length > 0);
      const pathName = filteredParts.length > 0 ? filteredParts[0] : p;
      setDisplay(pathName)
      return pathName;
    }, [task.path]);

    const handleRemove = async () => {
      onRemove(task.gid);
      if (task.status != "complete") {
        try {
          await remove(task.dir + "/" + display, {recursive:true})
        } catch(err) {
           console.error(err)
        }
      }
    }
    

    const handleOpenFolder = async () => {
      try {
        if (task.path) {
          await revealItemInDir(task.dir  + "/" +  display);
        }
      } catch (error) {
        console.error("Failed to open folder:", error);
      }
    };

    const formatBytes = (bytes: string | undefined): string => {
      if (!bytes) return "0 B";
      const num = parseInt(bytes);
      if (num === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(num) / Math.log(k));
      return parseFloat((num / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const formatSpeed = (speed: string | undefined): string => {
      if (!speed) return "0 B/s";
      return formatBytes(speed) + "/s";
    };

    const getProgress = (): number => {
      if (!task.totalLength || !task.completedLength) {
        if (task.status === "active") return 0.1;
        return 0;
      }
      const total = parseInt(task.totalLength);
      const completed = parseInt(task.completedLength);
      if (isNaN(total) || isNaN(completed) || total === 0) {
        if (task.status === "active") return completed > 0 ? 1.0 : 0.1;
        return 0;
      }
      return (completed / total) * 100;
    };

    const getStatusText = (): string => {
      const statusMap: { [key: string]: string } = {
        active: "正在下载",
        paused: "已暂停",
        waiting: "等待中",
        error: "下载失败",
        complete: "已完成",
        removed: "已移除",
      };

      
      if (
        task.status == "active" 
      ) {
        return "下载中";
      } else if (
        task.status == "active" &&
        task.totalLength == task.completedLength
      ) {
        return "即将完成";
      }
      return statusMap[task.status] || task.status;
    };

    const getStatusBadgeClass = (): string => {
      const classMap: { [key: string]: string } = {
        active: "bg-blue-50 text-[#1890FF]",
        paused: "bg-gray-100 text-[#8C8C8C]",
        waiting: "bg-blue-50 text-[#1890FF]",
        error: "bg-red-50 text-[#FF4D4F]",
        complete: "bg-green-50 text-[#52C41A]",
        removed: "bg-gray-100 text-[#8C8C8C]",
      };
      return classMap[task.status] || "bg-gray-100 text-[#8C8C8C]";
    };

    const getFileIcon = () => {
      const ext = displayName.split(".").pop()?.toLowerCase();

      if (["mp4", "avi", "mkv", "mov", "wmv"].includes(ext || "")) {
        return <FileVideo className="w-9 h-9 text-[#8C8C8C]" />;
      } else if (["pdf", "doc", "docx", "txt"].includes(ext || "")) {
        return <FileText className="w-9 h-9 text-[#8C8C8C]" />;
      } else if (["zip", "rar", "7z", "tar", "gz"].includes(ext || "")) {
        return <Archive className="w-9 h-9 text-[#8C8C8C]" />;
      }
      return <File className="w-9 h-9 text-[#8C8C8C]" />;
    };

    const isGettingMetadata = (): boolean => {
      const progress = getProgress();
      return (
        task.status === "active" &&
        progress < 1 &&
        (!task.totalLength || task.totalLength === "0")
      );
    };

    const progress = getProgress();
    const progressBarColor =
      task.status === "error"
        ? "#FF4D4F"
        : task.status === "complete"
        ? "#52C41A"
        : "#1890FF";

    return (
      <div className="bg-white border border-[#E8E8E8] rounded-lg p-4 shadow-sm hover:shadow transition-shadow mb-2">
        <div className="flex items-center justify-between gap-4">
          {/* 左侧：文件图标和信息 */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* 文件图标 */}
            <div className="flex-shrink-0">{getFileIcon()}</div>

            {/* 文件名和状态 */}
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="font-medium text-[#262626] truncate cursor-help mb-1">
                    {displayName}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="p-2 bg-gray-900 rounded text-white text-sm">
                    {displayName}
                  </div>
                </TooltipContent>
              </Tooltip>
              <span
                className={`inline-block text-xs px-2.5 py-1 rounded-full ${getStatusBadgeClass()}`}
              >
                {getStatusText()}
              </span>
              {task.errorMessage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-xs text-[#FF4D4F] truncate cursor-help mt-1">
                      {task.errorMessage}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="p-2 bg-gray-900 rounded text-white text-sm max-w-xs">
                      {task.errorMessage}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* 中间：进度信息 */}
          <div className="flex items-center gap-8">
            {/* 圆形进度 */}
            <div className="flex-shrink-0">
              <div className="relative w-[60px] h-[60px]">
                <svg className="w-[60px] h-[60px] transform -rotate-90">
                  {/* 背景圆环 */}
                  <circle
                    cx="30"
                    cy="30"
                    r="26"
                    stroke="#E8E8E8"
                    strokeWidth="5"
                    fill="none"
                  />
                  {/* 进度圆环 */}
                  <circle
                    cx="30"
                    cy="30"
                    r="26"
                    stroke={progressBarColor}
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${
                      2 * Math.PI * 26 * (1 - progress / 100)
                    }`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.3s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-semibold text-[#262626]">
                    {isGettingMetadata() ? "..." : `${progress.toFixed(0)}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* 下载信息 */}
            <div className="text-sm text-[#8C8C8C] min-w-[140px]">
              {task.status === "active" ? (
                <>
                  <div className="mb-0.5">
                    速度:{" "}
                    <span className="text-[#262626] font-medium">
                      {formatSpeed(task.downloadSpeed)}
                    </span>
                  </div>
                  <div>
                    {formatBytes(task.completedLength)}/
                    {formatBytes(task.totalLength)}
                  </div>
                </>
              ) : task.status === "complete" ? (
                <>
                  <div className="mb-0.5">
                    <span className="text-[#262626]">完成</span>
                  </div>
                  <div>
                    {formatBytes(task.totalLength)}/
                    {formatBytes(task.totalLength)}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-0.5">
                    速度: <span className="text-[#262626]">0 KB/s</span>
                  </div>
                  <div>
                    {formatBytes(task.completedLength)}/
                    {formatBytes(task.totalLength)}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-2 flex-shrink-0 justify-end w-40">
            {task.status === "active" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onPause(task.gid)}
                    className="p-2 hover:bg-yellow-50 rounded transition-colors"
                  >
                    <Pause className="w-5 h-5 text-[#FAAD14]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="p-1 bg-gray-900 rounded text-white text-xs">
                    暂停
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            {(task.status === "paused" || task.status === "waiting") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onResume(task.gid)}
                    className="p-2 hover:bg-green-50 rounded transition-colors"
                  >
                    <Play className="w-5 h-5 text-[#52C41A]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="p-1 bg-gray-900 rounded text-white text-xs">
                    继续
                  </div>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleOpenFolder}
                  className="p-2 hover:bg-gray-50 rounded transition-colors"
                >
                  <FolderOpen className="w-5 h-5 text-[#8C8C8C] hover:text-[#1890FF]" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="p-1 bg-gray-900 rounded text-white text-xs">
                  打开文件夹
                </div>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRemove}
                  className="p-2 hover:bg-red-50 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-[#8C8C8C] hover:text-[#FF4D4F]" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="p-1 bg-gray-900 rounded text-white text-xs">
                  删除
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // 自定义比较函数：返回true跳过渲染，返回false重新渲染
    return (
      prevProps.task.gid === nextProps.task.gid &&
      prevProps.task.status === nextProps.task.status &&
      prevProps.task.completedLength === nextProps.task.completedLength &&
      prevProps.task.downloadSpeed === nextProps.task.downloadSpeed &&
      prevProps.task.totalLength === nextProps.task.totalLength &&
      prevProps.task.errorMessage === nextProps.task.errorMessage &&
      prevProps.task.path === nextProps.task.path
    );
  }
);

DownloadTaskItem.displayName = "DownloadTaskItem";

export default DownloadTaskItem;
