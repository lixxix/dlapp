import UpdateDialog from "@/components/UpdateDialog";
import { getName, getVersion } from '@tauri-apps/api/app';
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, Update } from "@tauri-apps/plugin-updater";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface UpdateContextType {
  showUpdateDialog: (updateInfo: UpdateInfo) => void;
  hideUpdateDialog: () => void;
  checkUpdate: () => void;
  updateAvailable: boolean;
  currentVersion : string;  // 当前的版本号
  appName : string;
  updateInfo: UpdateInfo | null;
}

interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string;
}

interface ProgressInfo {
    contentLength: number;
    loaded: number;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [checked, setChecked] = useState(false);
  const [version, setVersion] = useState("");
  const [appName, setAppName] = useState("");
   
  // 使用 useRef 来存储已经显示过的更新版本信息，防止重复显示
  const shownUpdates = useRef<Set<string>>(new Set());

  const updateLoad = useRef<Update>(null);
  const progressRef = useRef<ProgressInfo>({ contentLength: 1, loaded: 0 });

  useEffect( () =>{
    getVersion().then((v) => {
      setVersion(v);
    })
    getName().then((name) => {
      setAppName(name);
    })
  },[])

  const showUpdateDialog = () => {
    // 检查是否已经显示过这个版本的更新
    const updateKey = `${updateLoad.current?.currentVersion}-${updateLoad.current?.version}`;
    if (shownUpdates.current.has(updateKey)) {
      return;
    }

    // 标记这个版本的更新已经显示过
    shownUpdates.current.add(updateKey);
    console.log(updateLoad.current)
    setUpdateInfo(updateLoad.current);
    setIsOpen(true);
  };

  const hideUpdateDialog = () => {
    setIsOpen(false);
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  const handleUpdate = async () => {
    setIsDownloading(true);
    try {
      await updateLoad.current?.downloadAndInstall(async (progress) => {
        console.log(JSON.stringify(progress));
        if (progress.event == "Started"){
            progressRef.current.contentLength = progress.data.contentLength || 1
            progressRef.current.loaded = 0
        } else if (progress.event == "Progress"){
            progressRef.current.loaded += progress.data.chunkLength    
            setDownloadProgress(Math.floor(progressRef.current.loaded / progressRef.current.contentLength * 100))
        } else {
          console.log(progress.event);
          await invoke("stop_aria2c");
        }
      });
      await relaunch();
    } catch (err) {
      console.log(err);
    }
  };

  const handleCancel = () => {
    hideUpdateDialog();
  };

  const checkUpdate = async () => {
    console.log("check update", checked)
    if (checked) {
      return;
    }
    setChecked(true);
    console.log("Checking for updates...")
    const update = await check();
    if (update) {
      updateLoad.current = update;
      showUpdateDialog();
    }
  };

  return (
    <UpdateContext.Provider
      value={{
        showUpdateDialog,
        hideUpdateDialog,
        checkUpdate,
        currentVersion: version,
        appName: appName,
        updateAvailable: isOpen,
        updateInfo,
      }}
    >
      {children}
      {updateInfo && (
        <UpdateDialog
          open={isOpen}
          onUpdate={handleUpdate}
          onCancel={handleCancel}
          version={updateInfo.version}
          currentVersion={updateInfo.currentVersion}
          releaseNotes={updateInfo.body}
          downloadProgress={downloadProgress}
          isDownloading={isDownloading}
        />
      )}
    </UpdateContext.Provider>
  );
};

export const useUpdate = () => {
  const context = useContext(UpdateContext);
  if (context === undefined) {
    throw new Error("useUpdate must be used within an UpdateProvider");
  }
  return context;
};
