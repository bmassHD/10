import React, { useState, useEffect, useMemo } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  LogOut,
  Trash2,
  Pencil,
  QrCode,
  MonitorSmartphone,
  Clock,
  ShieldCheck,
  Fingerprint,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserVerifiedDevice } from '../../types';

interface LoggedInDevicesPanelProps {
  onOpenQrScanner?: () => void;
}

const ACTIVE_SESSION_WINDOW_MS = 3 * 60 * 1000;

function formatMethodLabel(method?: UserVerifiedDevice['verificationMethod']): string {
  switch (method) {
    case 'biometric':
      return 'Face ID / Touch ID';
    case 'qr':
      return 'Quét QR';
    case 'google':
      return 'Google';
    case 'zalo':
      return 'Zalo';
    case 'sms_mfa':
      return 'SMS 2FA';
    case 'sms_otp':
      return 'SMS OTP';
    case 'totp_2fa':
      return '2FA App';
    case 'password':
      return 'Mật khẩu';
    default:
      return 'Trình duyệt';
  }
}

function formatPlatformLabel(platform?: UserVerifiedDevice['platform']): string {
  switch (platform) {
    case 'mobile':
      return 'Mobile';
    case 'tablet':
      return 'Tablet';
    default:
      return 'PC';
  }
}

function formatDateTimeVi(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const LoggedInDevicesPanel: React.FC<LoggedInDevicesPanelProps> = ({
  onOpenQrScanner,
}) => {
  const {
    currentUser,
    verifiedDevices,
    currentDeviceId,
    currentDeviceTrusted,
    approveTrustedDevice,
    revokeConcurrentDeviceSession,
    renameVerifiedDevice,
    removeVerifiedDevice,
    logout,
  } = useAuth();
  const { showToast } = useToast();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const enrichedDevices = useMemo(() => {
    return verifiedDevices
      .map((dev) => {
        const isCurrent = dev.deviceId === currentDeviceId;
        const isForceRevoked = Boolean(
          dev.forceLogoutSessionId &&
            dev.activeSessionId &&
            dev.forceLogoutSessionId === dev.activeSessionId
        );
        const heartbeatFresh =
          typeof dev.lastHeartbeatMs === 'number' &&
          nowMs - dev.lastHeartbeatMs <= ACTIVE_SESSION_WINDOW_MS;
        const isActiveSession =
          isCurrent ||
          (dev.isSessionActive === true && !isForceRevoked && heartbeatFresh);
        return {
          dev,
          isCurrent,
          isActiveSession,
        };
      })
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        if (a.isActiveSession !== b.isActiveSession) return a.isActiveSession ? -1 : 1;
        return (b.dev.lastActiveAt || '').localeCompare(a.dev.lastActiveAt || '');
      });
  }, [verifiedDevices, currentDeviceId, nowMs]);

  const filteredDevices = useMemo(() => {
    if (filterMode === 'active') return enrichedDevices.filter((item) => item.isActiveSession);
    if (filterMode === 'inactive') return enrichedDevices.filter((item) => !item.isActiveSession);
    return enrichedDevices;
  }, [enrichedDevices, filterMode]);

  if (!currentUser) return null;

  const activeCount = enrichedDevices.filter((item) => item.isActiveSession).length;

  const handleOpenScanner = () => {
    if (onOpenQrScanner) {
      onOpenQrScanner();
    } else {
      window.dispatchEvent(new CustomEvent('tyt:open-qr-scanner'));
    }
  };

  const handleSignOutDevice = async (dev: UserVerifiedDevice, isCurrent: boolean) => {
    setRevokingId(dev.deviceId);
    try {
      if (isCurrent) {
        await logout();
        showToast('info', 'Đã đăng xuất khỏi thiết bị này');
      } else {
        await revokeConcurrentDeviceSession(dev);
        showToast(
          'success',
          'Đã đăng xuất thiết bị từ xa',
          `Phiên trên ${dev.deviceName} đã bị thu hồi.`
        );
      }
    } catch (err: any) {
      showToast('error', 'Không thể đăng xuất thiết bị', err?.message || 'Vui lòng thử lại.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleSaveRename = async (deviceId: string) => {
    const clean = renameValue.trim();
    if (!clean) {
      setEditingDeviceId(null);
      return;
    }
    try {
      await renameVerifiedDevice(deviceId, clean);
      setEditingDeviceId(null);
      showToast('success', 'Đã đổi tên thiết bị');
    } catch (err: any) {
      showToast('error', 'Không thể đổi tên', err?.message);
    }
  };

  const handleRemoveDeviceHistory = async (deviceId: string) => {
    setRemovingId(deviceId);
    try {
      await removeVerifiedDevice(deviceId);
      showToast('success', 'Đã xóa khỏi lịch sử');
    } catch (err: any) {
      showToast('error', 'Không thể xóa', err?.message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleApproveDevice = async (dev: UserVerifiedDevice) => {
    try {
      await approveTrustedDevice(dev.deviceId);
      showToast('success', `Đã duyệt thiết bị ${dev.deviceName}`, 'Thiết bị này sẽ không gây cảnh báo đăng nhập lại.');
    } catch (err: any) {
      showToast('error', 'Không thể duyệt thiết bị', err?.message);
    }
  };

  return (
    <div
      data-section-title="Thiết bị đã đăng nhập"
      className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded(v => !v)}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
        >
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
            <MonitorSmartphone className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition">
                Thiết bị đã đăng nhập
              </h2>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isExpanded ? 'rotate-180 text-emerald-600' : ''
                }`}
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {activeCount} đang hoạt động · Tổng {enrichedDevices.length} thiết bị
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as any)}
            className="min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            title="Lọc trạng thái thiết bị"
          >
            <option value="all">Tất cả ({enrichedDevices.length})</option>
            <option value="active">Đang hoạt động ({activeCount})</option>
            <option value="inactive">Đã đăng xuất ({enrichedDevices.length - activeCount})</option>
          </select>

          {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768 ? (
            <button
              type="button"
              onClick={handleOpenScanner}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Quét QR</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setIsExpanded(v => !v)}
            className="min-h-[38px] w-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
            aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Devices List with Dropdown Accordion Collapse */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          {filteredDevices.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
              {filterMode === 'active'
                ? 'Không có phiên nào đang hoạt động.'
                : filterMode === 'inactive'
                ? 'Không có thiết bị nào đã đăng xuất.'
                : 'Chưa ghi nhận thiết bị nào.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredDevices.map(({ dev, isCurrent, isActiveSession }) => {
            const isEditing = editingDeviceId === dev.deviceId;
            const isRevoking = revokingId === dev.deviceId;
            const isRemoving = removingId === dev.deviceId;
            const DeviceIcon =
              dev.platform === 'mobile'
                ? Smartphone
                : dev.platform === 'tablet'
                ? Tablet
                : Laptop;

            return (
              <div key={dev.deviceId} className="p-3 sm:px-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Icon + Name + Badges */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isActiveSession
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <DeviceIcon className="w-4.5 h-4.5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {dev.deviceName}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                            Máy này
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isActiveSession
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isActiveSession ? 'Hoạt động' : 'Đã kết thúc'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
                            dev.isTrusted
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>{dev.isTrusted ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                        <span>{formatPlatformLabel(dev.platform)}</span>
                        {dev.browser && <span>· {dev.browser}</span>}
                        <span>· {formatMethodLabel(dev.verificationMethod)}</span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDateTimeVi(dev.lastActiveAt)}</span>
                        </span>
                        {dev.biometricEnabled && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Fingerprint className="w-3 h-3" />
                            <span>Sinh trắc</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isCurrent && !dev.isTrusted && currentDeviceTrusted && (
                      <button
                        type="button"
                        onClick={() => void handleApproveDevice(dev)}
                        className="min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        title="Duyệt thiết bị này vào danh sách tin cậy"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">Duyệt</span>
                      </button>
                    )}
                    {isActiveSession && (
                      <button
                        type="button"
                        disabled={isRevoking}
                        onClick={() => void handleSignOutDevice(dev, isCurrent)}
                        className="min-h-[36px] px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-60"
                        title={isCurrent ? 'Đăng xuất máy này' : 'Đăng xuất thiết bị này'}
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">
                          {isCurrent ? 'Đăng xuất' : 'Thu hồi'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingDeviceId(isEditing ? null : dev.deviceId);
                        setRenameValue(dev.deviceName);
                      }}
                      title="Đổi tên"
                      aria-label="Đổi tên thiết bị"
                      className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {!isCurrent && (
                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={() => void handleRemoveDeviceHistory(dev.deviceId)}
                        title="Xóa lịch sử"
                        aria-label="Xóa thiết bị khỏi lịch sử"
                        className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center cursor-pointer disabled:opacity-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="Tên gợi nhớ mới..."
                      className="flex-1 min-h-[36px] px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveRename(dev.deviceId)}
                      className="min-h-[36px] px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDeviceId(null)}
                      className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
