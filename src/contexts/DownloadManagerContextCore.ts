
import { createContext, useContext } from 'react';

export interface DownloadManagerContextType {
    isConnected: boolean;
    isLoading: boolean;
    checkConnection: () => Promise<void>;
    loadDownloads: () => Promise<void>;
   
}

export const DownloadManagerContext = createContext<DownloadManagerContextType | undefined>(undefined);

export const useDownloadManager = () => {
    const context = useContext(DownloadManagerContext);
    if (context === undefined) {
        throw new Error('useDownloadManager must be used within a DownloadManagerProvider');
    }
    return context;
};
