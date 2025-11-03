import DownloadManager from "@/components/DownloadManager";
import { listen } from "@tauri-apps/api/event";
import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const Downloads: React.FC = () => {
  const [searchParams] = useSearchParams();
 
  useEffect(() => {
    let unli: any = null;

    listen("http-command", (evnent: any) => {
      console.log(evnent.payload, "接受到了内容");
      // 添加您的命令
    }).then((unlisten) => {
      unli = unlisten;
    });

    return () => {
      if (unli) {
        unli();
      } else {
        setTimeout(() => {
          if (unli) unli();
        }, 1000);
      }
    };
  }, []);


  useEffect(() => {
    console.log(searchParams.get("params"));
    let pp = searchParams.get("params");
    if (pp) {
    //  todo :添加您的命令
    }
  }, []);

  return (
    // 修改背景色为 Download Pro 风格
    <div className="h-[calc(100vh-48px)] flex flex-col bg-[#F8F9FA]">
      {/* 下载管理器 */}
      <DownloadManager />
    </div>
  );
};

export default Downloads;
