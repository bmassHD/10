import React from 'react';
import { Home, Compass, MapPin, Calendar, ShieldAlert, ArrowLeft, Stethoscope, Search, PhoneCall } from 'lucide-react';
import { SystemSettings } from '../../types';
import { StationLogo } from '../common/StationLogo';

interface NotFoundViewProps {
  settings: SystemSettings;
  setCurrentView: (view: string, query?: string) => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ settings, setCurrentView }) => {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-in fade-in">
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden text-center p-6 sm:p-10 space-y-6">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center justify-center space-y-3">
          <StationLogo size={72} className="mx-auto" />
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Mã lỗi 404 · Không tìm thấy trang</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Trang bạn yêu cầu không tồn tại hoặc đã được di chuyển
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Đường dẫn có thể đã thay đổi hoặc không chính xác trên Cổng Thông Tin {settings.stationName || 'Trạm Y Tế'}.
            </p>
          </div>
        </div>

        {/* Action Grid (Symmetrical 2x2 or responsive links) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setCurrentView('portal')}
            className="min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Quay về Trang chủ</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('map')}
            className="min-h-[48px] px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Bản đồ & Cơ sở y tế</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('duty')}
            className="min-h-[48px] px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Lịch trực 24/7</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('vaccination')}
            className="min-h-[48px] px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Stethoscope className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Tra cứu Lịch tiêm chủng</span>
          </button>
        </div>

        {/* Emergency Hotline Footer */}
        <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Cần hỗ trợ y tế khẩn cấp?
              </div>
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Hotline trực cấp cứu 24/7 tại trạm sẵn sàng hỗ trợ mọi lúc.
              </div>
            </div>
          </div>
          {settings.hotline && (
            <a
              href={`tel:${settings.hotline}`}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition whitespace-nowrap shadow-xs"
            >
              <span>Gọi {settings.hotline}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
