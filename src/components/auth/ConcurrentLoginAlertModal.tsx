import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserVerifiedDevice } from '../../types';

interface ConcurrentLoginAlertModalProps {
  onOpenAccountSecurity?: () => void;
}

function formatViDateTime(iso?: string): string {
  if (!iso) return 'Vừa xong';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dt);
}

function DevicePlatformIcon({ platform }: { platform?: UserVerifiedDevice['platform'] }) {
  if (platform === 'mobile') return <Smartphone className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />;
  if (platform === 'tablet') return <Tablet className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />;
  return <Monitor className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" />;
}

export const ConcurrentLoginAlertModal: React.FC<ConcurrentLoginAlertModalProps> = ({
  onOpenAccountSecurity,
}) => {
  const {
    currentUser,
    isBanned,
    hasPasswordProvider,
    requiresTwoFactorVerification,
    pendingSmsMfaResolver,
    concurrentActiveDevices,
    currentDeviceTrusted,
    remoteRevokedNotice,
    dismissConcurrentLoginAlert,
    revokeConcurrentDeviceSession,
    clearRemoteRevokedNotice,
    sendPasswordReset,
    changeAccountPassword,
    linkEmailPassword,
    logout,
  } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<'prompt' | 'reset_panel'>('prompt');
  const [revokedSnapshot, setRevokedSnapshot] = useState<UserVerifiedDevice[]>([]);
  const [processingAction, setProcessingAction] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Direct inline password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // Reset local panel state if user logs out completely
  useEffect(() => {
    if (!currentUser) {
      setStep('prompt');
      setRevokedSnapshot([]);
      setResetEmailSent(false);
      setResetError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(false);
    }
  }, [currentUser]);

  // 1. Show forced-logout notice when this device was remotely kicked out
  if (remoteRevokedNotice) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 shadow-2xl overflow-hidden">
          <div className="p-5 bg-rose-700 text-white flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug">
                Phiên đăng nhập đã bị đăng xuất từ xa
              </h2>
              <p className="text-xs text-rose-100 mt-1 leading-relaxed">
                Chủ tài khoản đã xác nhận không phải thiết bị này thực hiện đăng nhập và yêu cầu đặt lại mật khẩu bảo mật.
              </p>
            </div>
          </div>
          <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300">
            <p className="leading-relaxed">
              Nếu đây là tài khoản của bạn, vui lòng kiểm tra lại mật khẩu hoặc liên hệ quản trị viên trạm y tế nếu nghi ngờ bị lộ thông tin đăng nhập.
            </p>
            <button
              type="button"
              onClick={clearRemoteRevokedNotice}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold text-sm transition cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Wait until user finishes 2FA / SMS MFA gates and is not banned
  const canShowPrompt = Boolean(
    currentUser &&
      !isBanned &&
      !requiresTwoFactorVerification &&
      !pendingSmsMfaResolver &&
      (concurrentActiveDevices.length > 0 || step === 'reset_panel')
  );

  if (!canShowPrompt || !currentUser) return null;

  const displayedDevices = step === 'reset_panel' ? revokedSnapshot : concurrentActiveDevices;

  const handleConfirmOwnDevices = async () => {
    await dismissConcurrentLoginAlert(concurrentActiveDevices);
    showToast(
      'success',
      currentDeviceTrusted ? 'Đã duyệt & xác nhận thiết bị hợp lệ' : 'Đã xác nhận phiên đăng nhập',
      currentDeviceTrusted
        ? 'Thiết bị này đã được lưu vào danh sách tin cậy và sẽ không cảnh báo lại.'
        : 'Hệ thống tiếp tục duy trì phiên làm việc trên các thiết bị của bạn.'
    );
  };

  const handleNotMeTriggerReset = async () => {
    const snapshot = [...concurrentActiveDevices];
    setRevokedSnapshot(snapshot);
    setStep('reset_panel');
    setProcessingAction(true);
    setResetError(null);
    setPasswordSaved(false);

    try {
      await Promise.all(snapshot.map((device) => revokeConcurrentDeviceSession(device)));
      showToast(
        'warning',
        'Đã ngắt kết nối thiết bị lạ',
        'Vui lòng đặt lại mật khẩu mới ngay để bảo vệ tài khoản.'
      );
    } catch (err: any) {
      setResetError(err?.message || 'Không thể thu hồi phiên thiết bị kia, vui lòng đổi mật khẩu ngay.');
    }

    if (currentUser.email) {
      setSendingResetEmail(true);
      try {
        await sendPasswordReset(currentUser.email);
        setResetEmailSent(true);
      } catch (err: any) {
        setResetError(
          err?.message || 'Không thể gửi email đặt lại mật khẩu tự động. Bạn có thể đổi mật khẩu trực tiếp bên dưới.'
        );
      } finally {
        setSendingResetEmail(false);
      }
    }

    setProcessingAction(false);
  };

  const handleResendPasswordResetEmail = async () => {
    if (!currentUser.email) return;
    setSendingResetEmail(true);
    setResetError(null);
    try {
      await sendPasswordReset(currentUser.email);
      setResetEmailSent(true);
      showToast('success', 'Đã gửi email đặt lại mật khẩu', `Kiểm tra hộp thư ${currentUser.email}`);
    } catch (err: any) {
      setResetError(err?.message || 'Không thể gửi email đặt lại mật khẩu.');
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleInlinePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (newPassword.length < 6) {
      setResetError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSavingPassword(true);
    try {
      if (hasPasswordProvider) {
        if (!currentPassword) {
          setResetError('Vui lòng nhập mật khẩu hiện tại để xác thực đổi mật khẩu.');
          setSavingPassword(false);
          return;
        }
        await changeAccountPassword(currentPassword, newPassword);
      } else {
        await linkEmailPassword(newPassword);
      }
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Đổi mật khẩu thành công!', 'Tài khoản của bạn đã được bảo vệ bằng mật khẩu mới.');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setResetError('Mật khẩu hiện tại không chính xác.');
      } else if (code === 'auth/requires-recent-login') {
        setResetError('Phiên đăng nhập đã cũ. Hãy dùng liên kết đặt lại mật khẩu gửi qua email hoặc đăng nhập lại.');
      } else {
        setResetError(err?.message || 'Không thể cập nhật mật khẩu.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCloseResetPanel = () => {
    setStep('prompt');
    setRevokedSnapshot([]);
    setResetError(null);
    setPasswordSaved(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="concurrent-login-alert-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div
          className={`p-5 text-white shrink-0 ${
            step === 'reset_panel'
              ? 'bg-gradient-to-r from-rose-700 to-rose-800'
              : 'bg-gradient-to-r from-amber-700 to-orange-700'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                {step === 'reset_panel' ? (
                  <KeyRound className="w-5 h-5 text-white" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-white/85">
                  Cảnh báo bảo mật tài khoản · {currentUser.email || 'Tài khoản đang hoạt động'}
                </p>
                <h2 id="concurrent-login-alert-title" className="text-base sm:text-lg font-extrabold leading-snug mt-0.5">
                  {step === 'reset_panel'
                    ? 'Đã ngắt thiết bị lạ — Đặt lại mật khẩu'
                    : 'Phát hiện đăng nhập cùng lúc trên 2 thiết bị'}
                </h2>
              </div>
            </div>

            {step === 'reset_panel' && (
              <button
                type="button"
                onClick={handleCloseResetPanel}
                aria-label="Đóng thông báo"
                className="min-w-[40px] min-h-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs sm:text-sm">
          {step === 'prompt' ? (
            <>
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 text-amber-950 dark:text-amber-100 leading-relaxed">
                <p className="font-bold text-sm">
                  Có phải bạn đang đăng nhập tài khoản này trên thiết bị khác cùng lúc không?
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-1">
                  Hệ thống ghi nhận tài khoản của bạn hiện đang mở phiên hoạt động song song trên thiết bị dưới đây:
                </p>
              </div>

              {/* Concurrent device list */}
              <div className="space-y-2.5">
                {displayedDevices.map((dev) => (
                  <div
                    key={dev.deviceId}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-start gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <DevicePlatformIcon platform={dev.platform} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {dev.deviceName || 'Thiết bị không xác định'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            dev.isTrusted
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {dev.isTrusted ? 'Đã duyệt' : 'Thiết bị lạ chưa duyệt'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span>{dev.os || 'Hệ điều hành khác'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{dev.browser || 'Trình duyệt'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Đăng nhập lúc {formatViDateTime(dev.sessionStartedAt || dev.lastHeartbeatAt || dev.lastActiveAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Nếu không phải bạn thực hiện, hãy chọn <strong>&ldquo;Không phải tôi — Đặt lại mật khẩu&rdquo;</strong> để hệ thống đăng xuất ngay thiết bị kia và gửi liên kết đặt lại mật khẩu.
              </p>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmOwnDevices}
                  disabled={processingAction}
                  className="min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Đúng, đây là tôi</span>
                </button>
                <button
                  type="button"
                  onClick={handleNotMeTriggerReset}
                  disabled={processingAction}
                  className="min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <span>{processingAction ? 'Đang xử lý...' : 'Không phải tôi · Đặt lại mật khẩu'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold text-sm">Đã thu hồi quyền truy cập của thiết bị khác</p>
                  <p className="mt-0.5">
                    {revokedSnapshot.length > 0
                      ? `Thiết bị "${revokedSnapshot.map((d) => d.deviceName).join(', ')}" sẽ bị đăng xuất tự động ngay lập tức.`
                      : 'Thiết bị lạ đã bị thu hồi phiên hoạt động.'}
                  </p>
                </div>
              </div>

              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              {/* Password reset email block */}
              {currentUser.email && (
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div className="text-xs flex-1">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {resetEmailSent
                          ? `Đã gửi liên kết đặt lại mật khẩu tới ${currentUser.email}`
                          : `Đặt lại mật khẩu qua email ${currentUser.email}`}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                        Kiểm tra hộp thư đến hoặc thư mục Spam để bấm vào liên kết đặt mật khẩu mới.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={sendingResetEmail}
                    onClick={handleResendPasswordResetEmail}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {sendingResetEmail ? 'Đang gửi email...' : resetEmailSent ? 'Gửi lại email đặt lại mật khẩu' : 'Gửi email đặt lại mật khẩu'}
                  </button>
                </div>
              )}

              {/* Direct inline password change */}
              {passwordSaved ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Mật khẩu mới đã được cập nhật thành công.</span>
                </div>
              ) : (
                <form
                  onSubmit={handleInlinePasswordUpdate}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-rose-600" />
                      <span>{hasPasswordProvider ? 'Đổi mật khẩu mới ngay tại đây' : 'Thiết lập mật khẩu bảo vệ tài khoản'}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowPasswords((v) => !v)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                    >
                      {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPasswords ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </div>

                  {hasPasswordProvider && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mật khẩu hiện tại *
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Nhập mật khẩu đang dùng..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mật khẩu mới (≥ 6 ký tự) *
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nhập mật khẩu mới..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Xác nhận mật khẩu mới *
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Nhập lại mật khẩu..."
                        className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{savingPassword ? 'Đang cập nhật mật khẩu...' : 'Lưu mật khẩu mới'}</span>
                  </button>
                </form>
              )}

              {/* Footer buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {onOpenAccountSecurity && (
                    <button
                      type="button"
                      onClick={() => {
                        handleCloseResetPanel();
                        onOpenAccountSecurity();
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs transition cursor-pointer"
                    >
                      Mở Bảo mật tài khoản
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseResetPanel();
                      void logout();
                    }}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất máy này</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCloseResetPanel}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
