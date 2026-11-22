import React from 'react';
import { ArrowLeft, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { LoggedInDevicesPanel } from '../account/LoggedInDevicesPanel';
import { SystemSettings } from '../../types';

interface LoggedInDevicesViewProps {
  settings: SystemSettings;
  setCurrentView: (view: string) => void;
}

export const LoggedInDevicesView: React.FC<LoggedInDevicesViewProps> = ({
  setCurrentView,
}) => {
  const handleBack = () => {
    window.location.hash = '#tai-khoan';
    setCurrentView('account');
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6 animate-in fade-in duration-200">
      {/* Top Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-400 transition cursor-pointer shrink-0"
            title="Quay lại tài khoản"
            aria-label="Quay lại tài khoản"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Bảo mật &amp; Phiên đăng nhập</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
              Quản Lý Thiết Bị Đã Đăng Nhập
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleBack}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Cài đặt Tài khoản</span>
        </button>
      </div>

      {/* Main Devices Panel Container */}
      <LoggedInDevicesPanel
        onOpenQrScanner={() => {
          window.dispatchEvent(new CustomEvent('tyt:open-qr-scanner'));
        }}
      />
    </div>
  );
};
