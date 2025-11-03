import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Settings, Square, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import iconPng from "../assets/icon.png";

const TitleBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowTitle, setWindowTitle] = useState("Download Pro");
  const [appWindow, setAppWindow] = useState<any>(null);

  useEffect(() => {
    const initWindow = async () => {
      const window = await getCurrentWindow();
      setAppWindow(window);

      // 监听窗口状态变化
      const unlistenResize = await window.listen("tauri://resize", async () => {
        const maximized = await window.isMaximized();
        setIsMaximized(maximized);
      });

      // 监听标题变化
      const unlistenTitleChange = await window.listen(
        "tauri://window-title-changed",
        (event: any) => {
          setWindowTitle(event.payload || "Download Pro");
        }
      );

      // 初始化状态
      const maximized = await window.isMaximized();
      setIsMaximized(maximized);

      const title = await window.title();
      setWindowTitle(title || "Download Pro");

      return () => {
        unlistenResize();
        unlistenTitleChange();
      };
    };

    initWindow();
  }, []);

  const handleMinimize = () => {
    appWindow?.minimize();
  };

  const handleMaximize = () => {
    if (isMaximized) {
      appWindow?.unmaximize();
    } else {
      appWindow?.maximize();
    }
  };

  const handleClose = () => {
    appWindow?.close();
  };

  const clickSetting = () => {
      const gameDetailWindow = new WebviewWindow(`setting`, {
        url: `/setting`, // URL 在这里指定
        title: "设置",
        width: 700,
        height: 650,
        decorations: false,
        resizable: false,
        center: true,
      });

      gameDetailWindow.once('tauri://created', () => {
        console.log('设置创建成功');
      });

      gameDetailWindow.once("tauri://error", (e) => {
        console.error('窗口创建失败:', e);
      });

  };

  return (
    <div
      data-tauri-drag-region
      className="h-[48px] bg-white border-b border-[#E8E8E8] flex items-center justify-between px-6 select-none"
    >
      {/* 左侧：Logo 和标题 */}
      <div className="flex items-center gap-3" data-tauri-drag-region>
        {/* <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm"> */}
          <img src={iconPng} className="w-5 h-5 text-white" />
        {/* </div> */}
        <h1 className="font-medium bold text-[#262626] truncate max-w-48">
          {windowTitle}
        </h1>
      </div>

      {/* 中间：可拖拽区域 */}
      <div className="flex-1 h-full" data-tauri-drag-region></div>

      {/* 右侧：设置和窗口控制按钮 */}
      <div className="flex items-center gap-2">
        {/* 设置按钮 */}
        <div className="relative">
          <button
            onClick={clickSetting}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#1890FF] hover:bg-gray-50 transition-all duration-200 rounded-md"
            title="设置"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>

          {/* 设置下拉菜单 */}
          {/* {showSettings && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowSettings(false)}
              ></div>
              
              <div className="absolute right-0 mt-2 w-40 bg-white border border-[#E8E8E8] rounded-lg shadow-lg py-2 z-50">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full text-left px-4 py-2 text-sm text-[#262626] hover:bg-gray-50 transition-colors"
                >
                  设置
                </button>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full text-left px-4 py-2 text-sm text-[#262626] hover:bg-gray-50 transition-colors"
                >
                  主题切换
                </button>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full text-left px-4 py-2 text-sm text-[#262626] hover:bg-gray-50 transition-colors"
                >
                  帮助中心
                </button>
                <div className="my-1 border-t border-[#E8E8E8]"></div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full text-left px-4 py-2 text-sm text-[#262626] hover:bg-gray-50 transition-colors"
                >
                  关于应用
                </button>
              </div>
            </>
          )} */}
        </div>

        {/* 分隔线 */}
        <div className="w-px h-5 bg-[#E8E8E8] mx-1"></div>

        {/* 窗口控制按钮组 */}
        <div className="flex items-center gap-1">
          {/* 最小化 */}
          <button
            onClick={handleMinimize}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all duration-200 rounded-md group"
            title="最小化"
          >
            <Minus className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>

          {/* 最大化/还原 */}
          <button
            onClick={handleMaximize}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all duration-200 rounded-md group"
            title={isMaximized ? "还原" : "最大化"}
          >
            {isMaximized ? (
              <div className="relative w-4 h-4">
                <Square
                  className="w-3 h-3 absolute top-0.5 left-0.5"
                  strokeWidth={2}
                />
                <Square
                  className="w-3 h-3 absolute bottom-0 right-0"
                  strokeWidth={2}
                />
              </div>
            ) : (
              <Square
                className="w-4 h-4 group-hover:scale-110 transition-transform"
                strokeWidth={2}
              />
            )}
          </button>

          {/* 关闭 */}
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-white hover:bg-[#FF4D4F] transition-all duration-200 rounded-md group"
            title="关闭"
          >
            <X className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
