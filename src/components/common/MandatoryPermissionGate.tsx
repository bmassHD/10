import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Bell,
  ShieldAlert,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Hand,
  LogIn,
} from 'lucide-react';
import { LocationPermissionState } from '../../hooks/useUserPermissions';

interface MandatoryPermissionGateProps {
  locationStatus: LocationPermissionState;
  notificationStatus: NotificationPermission;
  locationSupported: boolean;
  notificationSupported: boolean;
  stationName?: string;
  onRequestAll: () => Promise<{
    locationGranted: boolean;
    notificationGranted: boolean;
    bothGranted: boolean;
  }>;
  onRequestLocation: () => Promise<{ lat: number; lng: number } | null>;
  onRequestNotification: () => Promise<boolean>;
  onOpenAuthModal: () => void;
}

const PULL_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 128;

export const MandatoryPermissionGate: React.FC<MandatoryPermissionGateProps> = ({
  locationStatus,
  notificationStatus,
  locationSupported,
  notificationSupported,
  stationName,
  onRequestAll,
  onRequestLocation,
  onRequestNotification,
  onOpenAuthModal,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const mouseStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef<number>(0);
  const autoRequestedRef = useRef<boolean>(false);

  const locationGranted = locationStatus === 'granted';
  const notificationGranted = notificationStatus === 'granted';

  useEffect(() => {
    if (autoRequestedRef.current) return;
    if (!locationGranted || !notificationGranted) {
      autoRequestedRef.current = true;
      if (locationStatus === 'prompt' || notificationStatus === 'default') {
        void onRequestAll();
      }
    }
  }, [locationGranted, notificationGranted, locationStatus, notificationStatus, onRequestAll]);

  const executeRequestAll = (fromSwipeDown: boolean) => {
    if (isRequesting) return;
    setIsRequesting(true);
    setRetryFeedback(null);

    const promise = onRequestAll();
    void promise
      .then((res) => {
        if (!res.bothGranted) {
          const missing: string[] = [];
          if (!res.locationGranted) missing.push('Vị trí');
          if (!res.notificationGranted) missing.push('Thông báo');
          const prefix = fromSwipeDown ? 'Đã kiểm tra lại sau khi vuốt xuống: ' : '';
          setRetryFeedback(
            `${prefix}Chưa được cấp quyền ${missing.join(' và ')}. Nếu đã chặn trước đó, hãy mở cài đặt trình duyệt (biểu tượng 🔒) để Cho phép, sau đó vuốt xuống lại.`
          );
        }
      })
      .finally(() => {
        setIsRequesting(false);
      });
  };

  const updatePull = (next: number) => {
    const clamped = Math.max(0, Math.min(MAX_PULL_DISTANCE, next));
    pullDistanceRef.current = clamped;
    setPullDistance(clamped);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRequesting) return;
    const scrollTop = containerRef.current?.scrollTop ?? window.scrollY ?? 0;
    if (scrollTop > 4) {
      touchStartYRef.current = null;
      return;
    }
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
    setIsPulling(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null || isRequesting) return;
    const currentY = e.touches[0]?.clientY ?? touchStartYRef.current;
    const delta = currentY - touchStartYRef.current;
    if (delta > 0) {
      updatePull(delta * 0.65);
    } else {
      updatePull(0);
    }
  };

  const handleTouchEnd = () => {
    if (touchStartYRef.current === null) return;
    const reachedThreshold = pullDistanceRef.current >= PULL_THRESHOLD;
    touchStartYRef.current = null;
    setIsPulling(false);
    updatePull(0);
    if (reachedThreshold) {
      executeRequestAll(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isRequesting || e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, label')) return;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 4) return;
    mouseStartYRef.current = e.clientY;
    setIsPulling(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mouseStartYRef.current === null || isRequesting) return;
    const delta = e.clientY - mouseStartYRef.current;
    if (delta > 0) {
      updatePull(delta * 0.65);
    } else {
      updatePull(0);
    }
  };

  const handleMouseUp = () => {
    if (mouseStartYRef.current === null) return;
    const reachedThreshold = pullDistanceRef.current >= PULL_THRESHOLD;
    mouseStartYRef.current = null;
    setIsPulling(false);
    updatePull(0);
    if (reachedThreshold) {
      executeRequestAll(true);
    }
  };

  const isReadyToRelease = pullDistance >= PULL_THRESHOLD;

  const renderStateBadge = (
    supported: boolean,
    status: 'granted' | 'denied' | 'prompt' | 'default',
    labelName: string
  ) => {
    if (!supported) return <span className="text-rose-600 font-semibold">{labelName}: Không hỗ trợ</span>;
    if (status === 'granted') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{labelName}: Đã bật</span>
        </span>
      );
    }
    if (status === 'denied') {
      return (
        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 font-bold">
          <XCircle className="w-3.5 h-3.5" />
          <span>{labelName}: Bị chặn</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-bold">
        <Clock className="w-3.5 h-3.5" />
        <span>{labelName}: Chưa bật</span>
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-y-contain bg-slate-900/90 backdrop-blur-md text-slate-100 flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="p-4 bg-gradient-to-r from-rose-700 to-rose-900 text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-rose-100/90 uppercase tracking-wide">
              {stationName || 'Trạm Y Tế'}
            </p>
            <h1 className="text-sm font-extrabold leading-snug">
              Yêu cầu bật Vị trí &amp; Thông báo
            </h1>
          </div>
        </div>

        {/* Pull feedback bar */}
        <div
          style={{
            height: isRequesting ? 40 : pullDistance > 0 ? Math.max(30, pullDistance) : 36,
          }}
          className={`w-full flex items-center justify-center gap-1.5 px-3 text-[11px] font-semibold transition-colors ${
            isPulling ? '' : 'transition-all duration-200'
          } ${
            isRequesting
              ? 'bg-emerald-700 text-white'
              : isReadyToRelease
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-b border-amber-200 dark:border-amber-900'
          }`}
        >
          {isRequesting ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Đang yêu cầu cấp quyền...</span>
            </>
          ) : isReadyToRelease ? (
            <>
              <ArrowDown className="w-3.5 h-3.5 rotate-180 shrink-0" />
              <span>Thả tay để yêu cầu ngay!</span>
            </>
          ) : (
            <>
              <ArrowDown className="w-3.5 h-3.5 animate-bounce shrink-0" />
              <span>↓ Vuốt xuống từ đầu màn hình để yêu cầu lại</span>
            </>
          )}
        </div>

        {/* Content body */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-around gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <MapPin className="w-4 h-4 text-rose-600" />
              {renderStateBadge(locationSupported, locationStatus, 'Vị trí')}
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div className="flex flex-col items-center gap-1">
              <Bell className="w-4 h-4 text-sky-600" />
              {renderStateBadge(notificationSupported, notificationStatus, 'Thông báo')}
            </div>
          </div>

          {retryFeedback && (
            <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium leading-relaxed bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
              {retryFeedback}
            </p>
          )}

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={isRequesting}
              onClick={() => executeRequestAll(false)}
              className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRequesting ? 'animate-spin' : ''}`} />
              <span>{isRequesting ? 'Đang yêu cầu...' : 'Cấp quyền Vị trí & Thông báo'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenAuthModal}
              className="w-full min-h-[40px] py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Đăng nhập hệ thống</span>
            </button>
          </div>

          <div className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-1 flex items-center justify-center gap-1">
            <Hand className="w-3 h-3" />
            <span>Mẹo: Bạn có thể vuốt xuống bất cứ lúc nào để gọi lại hộp thoại</span>
          </div>
        </div>
      </div>
    </div>
  );
};
