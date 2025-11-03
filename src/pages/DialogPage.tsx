import { getCurrentWindow } from "@tauri-apps/api/window";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const DialogPage: React.FC = () => {
  const location = useLocation();
  const [dialogType, setDialogType] = useState<string>("");
  const [dialogInfo, setDialogInfo] = useState<string>("");
  const [appWindow, setAppWindow] = useState<any>(null);
  // 解析URL参数
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const type = searchParams.get("type") || "";
    const info = searchParams.get("info") || "";

    setDialogType(type);
    setDialogInfo(info);
  }, [location.search]);

  // 根据参数执行不同操作
  useEffect(() => {
    const initWindow = async () => {
      const window = await getCurrentWindow();
      setAppWindow(window);
    };

    initWindow();
  }, [dialogType, dialogInfo]);
  const handleClose = () => {
    appWindow?.close();
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        data-tauri-drag-region
        className="h-12 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-white/10 flex items-center justify-between px-4 select-none relative overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-500/10 to-blue-500/10"></div>
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-2xl"></div>
        </div>

        <div className="flex-1 h-full" data-tauri-drag-region></div>

        <div className="flex items-center items-end space-x-1 relative z-10">
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            className="group w-12 h-8 flex items-center justify-center text-white/70 hover:text-white hover:bg-red-500 transition-all duration-200 rounded-md"
            title="关闭"
          >
            <X className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">对话框</h2>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-medium text-gray-800 mb-2">参数信息</h3>
            <div className="space-y-2 text-sm">
              <div className="flex">
                <span className="font-medium text-gray-600 w-20">类型:</span>
                <span className="text-gray-800">{dialogType || "未指定"}</span>
              </div>
              <div className="flex">
                <span className="font-medium text-gray-600 w-20">信息:</span>
                <span className="text-gray-800">{dialogInfo || "未指定"}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
            <h3 className="font-medium text-gray-800 mb-2">操作说明</h3>
            <p className="text-sm text-gray-600">
              此页面会根据URL参数自动执行相应操作。参数格式:
              type=类型&info=信息内容
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DialogPage;
