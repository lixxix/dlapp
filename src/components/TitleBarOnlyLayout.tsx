import React from 'react';
import TitleBar from './TitleBar';

interface TitleBarOnlyLayoutProps {
  children?: React.ReactNode;
}

const TitleBarOnlyLayout: React.FC<TitleBarOnlyLayoutProps> = ({ children }) => {
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <TitleBar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default TitleBarOnlyLayout;