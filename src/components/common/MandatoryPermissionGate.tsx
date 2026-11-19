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
  Settings2,
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

  // Attempt one automatic prompt on initial arrival when permissions are still at default/prompt
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

    // Trigger synchronously inside the caller's gesture stack so browsers honor user activation
    const promise = onRequestAll();
    void promise
      .then((res) => {
        if (!res.bothGranted) {
          const missing: string[] = [];
          if (!res.locationGranted) missing.push('Vị trí');
          if (!res.notificationGranted) missing.push('Thông báo');
          const prefix = fromSwipeDown ? 'Đã kiểm tra lại sau khi vuốt xuống: ' : '';
          setRetryFeedback(
            `${prefix}Chưa được cấp quyền ${missing.join(' và ')}. Nếu trình duyệt đã chặn trước đó, hãy mở Cài đặt trang web (biểu tượng ổ khóa 🔒 cạnh thanh địa chỉ) để chuyển sang "Cho phép", sau đó vuốt xuống lại.`
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

  // Touch handlers for mobile/tablet swipe-down
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
      // Smooth rubber-band damping
      const damped = delta * 0.65;
      updatePull(damped);
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

  // Mouse drag handlers for desktop pull-down parity
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

  const renderPermissionStateText = (
    supported: boolean,
    status: 'granted' | 'denied' | 'prompt' | 'default'
  ) => {
    if (!supported) {
      return {
        label: 'Trình duyệt không hỗ trợ',
        tone: 'text-rose-700 dark:text-rose-300',
        Icon: XCircle,
      };
    }
    if (status === 'granted') {
      return {
        label: 'Đã cho phép',
        tone: 'text-emerald-700 dark:text-emerald-300',
        Icon: CheckCircle2,
      };
    }
    if (status === 'denied') {
      return {
        label: 'Đang bị chặn',
        tone: 'text-rose-700 dark:text-rose-300',
        Icon: XCircle,
      };
    }
    return {
      label: 'Chưa cấp quyền',
      tone: 'text-amber-700 dark:text-amber-300',
      Icon: Clock,
    };
  };

  const locMeta = renderPermissionStateText(locationSupported, locationStatus);
  const notifMeta = renderPermissionStateText(notificationSupported, notificationStatus);

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
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-y-contain bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none"
    >
      {/* Pull-down live feedback banner */}
      <div
        style={{
          height: isRequesting ? 54 : pullDistance > 0 ? Math.max(36, pullDistance) : 44,
        }}
        className={`w-full flex items-center justify-center gap-2 px-4 text-xs font-semibold transition-colors ${
          isPulling ? '' : 'transition-all duration-200'
        } ${
          isRequesting
            ? 'bg-emerald-700 text-white'
            : isReadyToRelease
            ? 'bg-emerald-600 text-white'
            : 'bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
        }`}
      >
        {isRequesting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Đang gửi yêu cầu cấp quyền Vị trí &amp; Thông báo...</span>
          </>
        ) : isReadyToRelease ? (
          <>
            <ArrowDown className="w-4 h-4 rotate-180 transition-transform shrink-0" />
            <span>Thả tay ngay để hệ thống yêu cầu truy cập lại!</span>
          </>
        ) : (
          <>
            <ArrowDown className="w-4 h-4 animate-bounce shrink-0" />
            <span>Vuốt xuống từ trên màn hình để yêu cầu cấp quyền truy cập lại</span>
          </>
        )}
      </div>

      {/* Main blocked access card */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${Math.round(pullDistance * 0.25)}px)` : undefined,
        }}
        className={`min-h-[calc(100vh-44px)] flex items-center justify-center p-4 sm:p-6 ${
          isPulling ? '' : 'transition-transform duration-200'
        }`}
      >
        <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/70 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-rose-700 via-rose-800 to-slate-900 text-white">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-rose-100/90">
                  {stationName || 'Cổng Thông Tin Điện Tử Trạm Y Tế'}
                </p>
                <h1 className="text-lg sm:text-xl font-extrabold leading-snug mt-0.5">
                  Cấm truy cập hệ thống khi chưa bật Vị trí &amp; Thông báo
                </h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-rose-50/95 mt-3 leading-relaxed">
              Truy cập <strong>Vị trí</strong> và <strong>Thông báo</strong> là yêu cầu bảo mật &amp; phục vụ y tế khẩn cấp quan trọng. Khi bạn cho phép đủ cả 2 quyền này, toàn bộ hệ thống sẽ mở và hoạt động bình thường.
            </p>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
            {/* Swipe-down visual guide */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Hand className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                  Hướng dẫn vuốt xuống để yêu cầu lại quyền truy cập
                </p>
                <p className="text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                  Đặt tay ở phần trên màn hình và <strong>vuốt thẳng xuống dưới</strong> (hoặc kéo xuống trên máy tính), hệ thống sẽ tự động gọi lại hộp thoại xin quyền <strong>Vị trí</strong> &amp; <strong>Thông báo</strong>.
                </p>
              </div>
            </div>

            {/* 2 Required Permissions Status */}
            <div className="space-y-2.5">
              {/* 1. Location */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  locationGranted
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      locationGranted
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      1. Quyền truy cập Vị trí (GPS)
                    </div>
                    <div className={`text-xs font-semibold inline-flex items-center gap-1 mt-0.5 ${locMeta.tone}`}>
                      <locMeta.Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{locMeta.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      Định vị điểm trạm gần nhất, tiêm chủng &amp; bản đồ cấp cứu.
                    </p>
                  </div>
                </div>
                {!locationGranted && (
                  <button
                    type="button"
                    disabled={isRequesting}
                    onClick={() => {
                      setIsRequesting(true);
                      void onRequestLocation().finally(() => setIsRequesting(false));
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-xs shrink-0 transition cursor-pointer disabled:opacity-60"
                  >
                    Bật Vị trí
                  </button>
                )}
              </div>

              {/* 2. Notification */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  notificationGranted
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      notificationGranted
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      2. Quyền nhận Thông báo
                    </div>
                    <div className={`text-xs font-semibold inline-flex items-center gap-1 mt-0.5 ${notifMeta.tone}`}>
                      <notifMeta.Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{notifMeta.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      Nhận cảnh báo y tế, lịch trực, tiêm chủng &amp; cảnh báo bảo mật.
                    </p>
                  </div>
                </div>
                {!notificationGranted && (
                  <button
                    type="button"
                    disabled={isRequesting}
                    onClick={() => {
                      setIsRequesting(true);
                      void onRequestNotification().finally(() => setIsRequesting(false));
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-xs shrink-0 transition cursor-pointer disabled:opacity-60"
                  >
                    Bật Thông báo
                  </button>
                )}
              </div>
            </div>

            {/* Diagnostic / Site Settings instructions when denied */}
            {(retryFeedback || locationStatus === 'denied' || notificationStatus === 'denied') && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>Cách mở lại nếu bạn đã từng chọn &ldquo;Chặn / Từ chối&rdquo;</span>
                </div>
                {retryFeedback && (
                  <p className="leading-relaxed font-medium">{retryFeedback}</p>
                )}
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                  <li>Chạm vào biểu tượng <strong>Ổ khóa (🔒)</strong> hoặc <strong>Cài đặt trang web</strong> cạnh thanh địa chỉ trình duyệt.</li>
                  <li>Chuyển cả <strong>Vị trí (Location)</strong> và <strong>Thông báo (Notifications)</strong> sang <strong>Cho phép (Allow)</strong>.</li>
                  <li>Quay lại màn hình này và <strong>vuốt xuống</strong> để hệ thống kiểm tra &amp; mở khóa ngay.</li>
                </ol>
                {!notificationSupported && (
                  <p className="text-[11px] font-semibold pt-1 border-t border-rose-200/70 dark:border-rose-800/60">
                    Lưu ý trên iPhone/iPad (Safari): Hãy bấm nút Chia sẻ → &ldquo;Thêm vào Màn hình chính (Add to Home Screen)&rdquo; và mở ứng dụng từ màn hình chính để bật Thông báo.
                  </p>
                )}
              </div>
            )}

            {/* Primary action button */}
            <button
              type="button"
              disabled={isRequesting}
              onClick={() => executeRequestAll(false)}
              className="w-full min-h-[46px] py-3 px-4 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
              <span>
                {isRequesting
                  ? 'Đang yêu cầu cấp quyền...'
                  : 'Yêu cầu cấp cả 2 quyền Vị trí & Thông báo'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
