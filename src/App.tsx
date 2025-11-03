import { useEffect } from "react";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";

import NoSidebarLayout from "./components/NoSidebarLayout";
import TitleBar from "./components/TitleBar";
import { DownloadManagerProvider } from "./contexts/DownloadManagerContext";

import { UpdateProvider, useUpdate } from "./contexts/UpdateContext";

import Downloads from "./pages/Downloads";

import SettingsWindow from "./pages/SettingWindow";

function MainLayoutWithProviders({ children }: { children: React.ReactNode }) {
  return <DownloadManagerProvider>{children}</DownloadManagerProvider>;
}

// 创建一个包装组件来使用 useUpdate hook
const AppContent = () => {
  const { checkUpdate } = useUpdate();

  useEffect(() => {
    console.log(window.location.pathname)
    // 判断当前路由是否是 game-detail
    const isMainRouter = window.location.pathname === "/";
    if (isMainRouter) {
      checkUpdate();
    }
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <Routes>
        {/* 不需要 TitleBar 和 Sidebar 的路由 */}
        <Route
          path="/setting"
          element={
            <NoSidebarLayout>
              <SettingsWindow />
            </NoSidebarLayout>
          }
        />

        {/* 需要 TitleBar 和 Sidebar 的路由 */}
        <Route
          path="/*"
          element={
            <MainLayoutWithProviders>
              <TitleBar />
              {/* <div className="flex flex-1 overflow-hidden"> */}
              <main className="overflow-auto">
                <Routes>
                  <Route path="/" element={<Downloads />} />
                </Routes>
              </main>
              {/* </div> */}
            </MainLayoutWithProviders>
          }
        />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <Router>
      <UpdateProvider>
        <AppContent />
      </UpdateProvider>
    </Router>
  );
}

export default App;
