import React from 'react';

interface NoSidebarLayoutProps {
  children?: React.ReactNode;
}

const NoSidebarLayout: React.FC<NoSidebarLayoutProps> = ({ children }) => {
  return (
    <div 
      data-tauri-drag-region
      className="flex h-screen w-full"
    >
      <main 
        data-tauri-drag-region
        className="flex-1 overflow-auto"
      >
        {children}
      </main>
    </div>
  );
};

export default NoSidebarLayout;