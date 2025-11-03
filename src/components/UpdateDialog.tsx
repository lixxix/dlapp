import { AlertCircle, Download } from "lucide-react";
import { marked } from 'marked';
import React, { useEffect, useState } from "react";

interface UpdateDialogProps {
  open: boolean;
  onUpdate: () => void;
  onCancel: () => void;
  version: string;
  currentVersion: string;
  releaseNotes?: string;
  downloadProgress?: number;
  isDownloading?: boolean;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  onUpdate,
  onCancel,
  version,
  currentVersion,
  releaseNotes,
  downloadProgress = 0,
  isDownloading = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const convertMarkdownToHtml = (markdownText: string) => {
    if (!markdownText) return '';
    
    try {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
      
      return marked.parse(markdownText);
    } catch (error) {
      console.error('Markdown 转换错误:', error);
      return markdownText;
    }
  };

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 300);
    }
    console.log(releaseNotes);
  }, [open]);

  const handleCancel = () => {
    setIsVisible(false);
    setTimeout(() => onCancel(), 300);
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity duration-300 z-50 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleCancel}
      />

      {/* 弹窗内容 */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-lg shadow-xl border border-[#E8E8E8] overflow-hidden z-50 transition-all duration-300 ease-out ${
          isVisible
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95"
        }`}
      >
        {/* 顶部装饰条 */}
        {/* <div className="h-1 bg-[#1890FF]" /> */}

        <div className="p-6">
          {/* 标题区域 */}
          <div className="mb-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Download className="w-5 h-5 text-[#1890FF]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#262626]">发现新版本</h3>
                <p className="text-sm text-[#8C8C8C] mt-0.5">
                  v{currentVersion} → <span className="text-[#1890FF] font-medium">v{version}</span>
                </p>
              </div>
            </div>
          </div>

          {/* 更新内容 */}
          {releaseNotes && (
            <div className="mb-5">
              <h4 className="text-sm font-medium text-[#262626] mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#1890FF]" />
                更新内容
              </h4>
              <div className="bg-[#FAFAFA] rounded-lg p-4 max-h-48 overflow-y-auto border border-[#E8E8E8]">
                <div 
                  className="text-sm text-[#595959] prose prose-sm max-w-none [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1 [&>p]:my-2 [&>h1]:text-base [&>h1]:font-semibold [&>h1]:text-[#262626] [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:text-[#262626] [&>h3]:text-sm [&>h3]:font-medium [&>h3]:text-[#262626] [&>code]:bg-gray-100 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>code]:text-xs"
                  dangerouslySetInnerHTML={{ 
                    __html: convertMarkdownToHtml(releaseNotes)
                  }} 
                />
              </div>
            </div>
          )}

          {/* 下载进度 */}
          {isDownloading && (
            <div className="mb-5">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[#8C8C8C]">下载进度</span>
                <span className="text-[#1890FF] font-semibold">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-[#E8E8E8] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#1890FF] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-xs text-[#8C8C8C] mt-2 text-center">
                正在下载更新，请稍候...
              </p>
            </div>
          )}

          {/* 按钮区域 */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={isDownloading}
              className="flex-1 px-4 py-2.5 rounded text-sm font-medium text-[#262626] border border-[#D9D9D9] hover:text-[#1890FF] hover:border-[#1890FF] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[#262626] disabled:hover:border-[#D9D9D9]"
            >
              稍后提醒
            </button>
            <button
              onClick={onUpdate}
              disabled={isDownloading}
              className="flex-1 px-4 py-2.5 rounded text-sm font-medium text-white bg-[#1890FF] hover:bg-[#0c76d4] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#1890FF] shadow-sm"
            >
              {isDownloading ? "下载中..." : "立即更新"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateDialog;