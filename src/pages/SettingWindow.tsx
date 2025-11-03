import { Api } from "@/api/api";
import { DownloadSettings } from "@/store/storeTask";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { open } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  Check,
  Download,
  Folder,
  FolderOpen,
  Gauge,
  Link,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import pngIcon from "../assets/icon.png";

const SettingsWindow: React.FC = () => {
  const [autoStart, setAutoStart] = useState(false);
  const [loading, setLoading] = useState(false)
  const [localSettings, setLocalSettings] = useState<DownloadSettings>({
    default_download_dir: "",
    max_download_speed: 0,
    max_upload_speed: 0,
    max_concurrent_downloads: 5,
    max_connections_per_task: 16,
    continue_downloads: true,
  });

  // 关闭窗口
  const handleClose = async () => {
    const window = await getCurrentWindow();
    window.close();
  };

  // 设置开机自启动
  async function SetAutoStart(auto: boolean) {
    try {
      if (auto) {
        await enable();
      } else {
        await disable();
      }
      setAutoStart(auto);
    } catch (err) {
      console.error("设置开机自启动失败", err);
    }
  }

  // 保存设置
  const handleSaveSettings = async () => {
    try {

      setLoading(true)
      // 这里调用你的保存逻辑
      await Api.updateSettings(localSettings);

      const aria2Options: Record<string, string> = {};
      aria2Options["max-overall-download-limit"] =
        localSettings.max_download_speed.toString();
      aria2Options["max-overall-upload-limit"] =
        localSettings.max_upload_speed.toString();
      aria2Options["max-concurrent-downloads"] =
        localSettings.max_concurrent_downloads.toString();

      console.log("设置配置", aria2Options);
      await Api.updateGlobalOption(aria2Options);

      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      if (permissionGranted) {
        sendNotification({ title: "提示", body: "设置保存成功!" });
      }
    } catch (error) {
      console.error("保存设置失败:", error);
    } finally {
      setTimeout(()=>{
        setLoading(false)
      },800)
      // setLoading(false)
    }
  };

  // 选择文件夹
  const openFile = async () => {
    try {
      const dir = await open({
        multiple: false,
        directory: true,
      });
      if (dir) {
        setLocalSettings((prev:any) => ({
          ...prev,
          default_download_dir: dir,
        }));
      }
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

  // 初始化自启动状态
  useEffect(() => {
    const initAutoStart = async () => {
      try {
        const autoStartEnabled = await isEnabled();
        setAutoStart(autoStartEnabled);
      } catch (error) {
        console.error("Failed to load autostart status:", error);
      }
    };
    initAutoStart();

    Api.getSettings().then((settings) => {
      setLocalSettings(settings);
    });
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="w-full h-screen bg-white flex flex-col overflow-hidden"
    >
      {/* 标题栏 */}
      <div
        data-tauri-drag-region
        className="h-12 bg-white border-b border-[#E8E8E8] flex items-center justify-between px-4 flex-shrink-0"
      >
        <div className="flex items-center gap-2">
          <img src={pngIcon} className="w-5 h-5 text-white" />
          <h1 className="text-base font-medium text-[#262626]">设置</h1>
        </div>

        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-white hover:bg-[#FF4D4F] transition-all duration-200 rounded-md group"
          title="关闭"
        >
          <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">
          {/* 下载目录 */}
          <div className="bg-[#FAFAFA] rounded-lg p-4 border border-[#E8E8E8]">
            <label className="flex items-center text-sm font-medium text-[#262626] mb-3">
              <Folder className="w-4 h-4 mr-2 text-[#8C8C8C]" />
              默认下载目录
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localSettings.default_download_dir}
                onChange={(e) =>
                  setLocalSettings((prev:any) => ({
                    ...prev,
                    default_download_dir: e.target.value,
                  }))
                }
                placeholder="请选择下载文件夹"
                className="flex-grow h-9 px-3 text-sm border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF] bg-white"
              />
              <button
                onClick={openFile}
                className="px-4 h-9 bg-white border border-[#D9D9D9] rounded text-[#262626] hover:text-[#1890FF] hover:border-[#1890FF] transition-colors text-sm font-medium flex items-center gap-1.5"
              >
                <FolderOpen className="w-4 h-4" />
                浏览
              </button>
            </div>
          </div>

          {/* 速度限制 */}
          <div className="bg-[#FAFAFA] rounded-lg p-4 border border-[#E8E8E8]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-[#262626] mb-2">
                  <Download className="w-4 h-4 mr-2 text-[#8C8C8C]" />
                  最大下载速度
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={localSettings.max_download_speed}
                    onChange={(e) =>
                      setLocalSettings((prev:any) => ({
                        ...prev,
                        max_download_speed: Number(e.target.value) || 0,
                      }))
                    }
                    className="block w-full h-9 rounded border border-[#D9D9D9] bg-white px-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF]"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8C8C8C] text-xs">
                    B/s
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8C8C8C]">0 为不限制</p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-[#262626] mb-2">
                  <Gauge className="w-4 h-4 mr-2 text-[#8C8C8C]" />
                  最大上传速度
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={localSettings.max_upload_speed}
                    onChange={(e) =>
                      setLocalSettings((prev:any) => ({
                        ...prev,
                        max_upload_speed: Number(e.target.value) || 0,
                      }))
                    }
                    className="block w-full h-9 rounded border border-[#D9D9D9] bg-white px-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF]"
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8C8C8C] text-xs">
                    B/s
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8C8C8C]">0 为不限制</p>
              </div>
            </div>
          </div>

          {/* 并发设置 */}
          <div className="bg-[#FAFAFA] rounded-lg p-4 border border-[#E8E8E8]">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-[#262626] mb-2">
                  <Zap className="w-4 h-4 mr-2 text-[#8C8C8C]" />
                  最大并发下载数
                </label>
                <input
                  type="number"
                  min={1}
                  value={localSettings.max_concurrent_downloads}
                  onChange={(e) =>
                    setLocalSettings((prev:any) => ({
                      ...prev,
                      max_concurrent_downloads: Number(e.target.value) || 1,
                    }))
                  }
                  className="block w-full h-9 rounded border border-[#D9D9D9] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF]"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-[#262626] mb-2">
                  <Link className="w-4 h-4 mr-2 text-[#8C8C8C]" />
                  最大任务连接数
                </label>
                <input
                  type="number"
                  min={1}
                  value={localSettings.max_connections_per_task}
                  onChange={(e) =>
                    setLocalSettings((prev:any) => ({
                      ...prev,
                      max_connections_per_task: Number(e.target.value) || 1,
                    }))
                  }
                  className="block w-full h-9 rounded border border-[#D9D9D9] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#1890FF]"
                />
              </div>
            </div>
          </div>

          {/* 开机自启动 */}
          <div className="bg-[#FAFAFA] rounded-lg p-4 border border-[#E8E8E8]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-[#1890FF]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#262626]">
                    开机自动启动
                  </p>
                  <p className="text-xs text-[#8C8C8C] mt-0.5">
                    系统启动时自动运行应用
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoStart}
                  onChange={(e) => SetAutoStart(e.target.checked)}
                />
                <div className="w-11 h-6 bg-[#D9D9D9] rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-[#D9D9D9] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1890FF]"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 底部按钮区 */}
      <div className="h-16 border-t border-[#E8E8E8] flex items-center justify-center px-6 gap-3 flex-shrink-0 bg-[#FAFAFA]">
        <button
          onClick={handleSaveSettings}
          className="px-5 h-9 bg-[#1890FF] text-white rounded hover:bg-[#0c76d4] transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              保存中...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              保存设置
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SettingsWindow;
