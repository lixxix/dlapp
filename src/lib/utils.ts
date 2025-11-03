import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Store } from '@tauri-apps/plugin-store';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const store = await Store.load('store.bin');

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 创建并打开一个对话框窗口
 * @param type 对话框类型
 * @param info 对话框信息
 * @param width 窗口宽度，默认400
 * @param height 窗口高度，默认300
 */
export async function openDialogWindow(
  type: string, 
  info: string, 
  width: number = 500, 
  height: number = 400
) {
  try {
    // 生成唯一的窗口标签
    const label = `dialog-${Date.now()}`;
    
    // 创建新的Webview窗口
    const dialogWindow = new WebviewWindow(label, {
      url: `/dialog?type=${encodeURIComponent(type)}&info=${encodeURIComponent(info)}`,
      title: "对话框",
      width: width,
      height: height,
      resizable: false,
      decorations: false, // 无边框窗口
      center: true,
      transparent: true, // 透明背景
    });

    // 监听窗口创建事件
    dialogWindow.once('tauri://created', () => {
      console.log('对话框窗口创建成功');
    });

    // 监听窗口错误事件
    dialogWindow.once("tauri://error", (e) => {
      console.error('对话框窗口创建失败:', e);
    });

    return dialogWindow;
  } catch (error) {
    console.error('创建对话框窗口时出错:', error);
    throw error;
  }
}