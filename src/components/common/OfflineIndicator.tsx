import React from 'react';
import { WifiOff, Siren } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  const handleOpenOfflineEmergency = () => {
    window.location.hash = '#ngoai-tuyen';
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-amber-600 dark:bg-amber-700 p-4 text-xs font-bold text-white shadow-2xl animate-in fade-in border-2 border-amber-400">
      <div className="flex items-center gap-2.5">
        <WifiOff className="w-5 h-5 shrink-0 animate-bounce text-amber-200" />
        <span>Mất kết nối Internet (Không có Wi-Fi/5G). Ứng dụng đang hoạt động ở chế độ Ngoại tuyến.</span>
      </div>
      <button
        onClick={handleOpenOfflineEmergency}
        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white text-slate-950 font-black hover:bg-rose-50 hover:text-rose-700 transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
      >
        <Siren className="w-4 h-4 text-rose-600 animate-pulse" />
        <span>Mở Trung Tâm Cấp Cứu (SOS)</span>
      </button>
    </div>
  );
};
