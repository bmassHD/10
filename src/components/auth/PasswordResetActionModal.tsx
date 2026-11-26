import React, { useState, useEffect } from 'react';
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useToast } from '../../contexts/ToastContext';
import { Lock, KeyRound, CheckCircle2, AlertCircle, ShieldCheck, Mail } from 'lucide-react';

interface PasswordResetActionModalProps {
  mode: string;
  oobCode: string;
  onCompleted: () => void;
}

export const PasswordResetActionModal: React.FC<PasswordResetActionModalProps> = ({
  mode,
  oobCode,
  onCompleted,
}) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState<string>('');
  const [loadingEmail, setLoadingEmail] = useState<boolean>(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function handleAction() {
      if (!oobCode) {
        setLoadingEmail(false);
        setVerifyError('Mã xác thực (oobCode) không hợp lệ hoặc đã hết hạn.');
        return;
      }

      try {
        if (mode === 'resetPassword') {
          const verifiedEmail = await verifyPasswordResetCode(auth, oobCode);
          if (mounted) {
            setEmail(verifiedEmail);
            setLoadingEmail(false);
          }
        } else if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode);
          if (mounted) {
            setSuccess(true);
            setLoadingEmail(false);
            showToast('success', 'Xác thực email thành công!');
          }
        } else {
          if (mounted) {
            setLoadingEmail(false);
            setVerifyError('Loại hành động không được hỗ trợ.');
          }
        }
      } catch (err: any) {
        console.error('Auth action error:', err);
        if (mounted) {
          setLoadingEmail(false);
          setVerifyError(
            err?.message || 'Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.'
          );
        }
      }
    }

    handleAction();
    return () => {
      mounted = false;
    };
  }, [mode, oobCode, showToast]);

  const handleSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Xác nhận mật khẩu không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      showToast('success', 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
      setTimeout(() => {
        onCompleted();
      }, 3000);
    } catch (err: any) {
      showToast('error', 'Không thể đặt lại mật khẩu', err?.message || 'Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md md:max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-700 p-6 text-white text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md mx-auto flex items-center justify-center text-white shadow-inner">
            {mode === 'verifyEmail' ? <Mail className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">
            {mode === 'verifyEmail' ? 'Xác Minh Email' : 'Đặt Lại Mật Khẩu Mới'}
          </h2>
          <p className="text-xs text-emerald-100">
            {mode === 'verifyEmail'
              ? 'Hệ thống xác thực bảo mật Trạm Y Tế'
              : 'Tạo mật khẩu mới cho tài khoản của bạn trên hệ thống riêng'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {loadingEmail ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Đang kiểm tra tính hợp lệ của liên kết...</p>
            </div>
          ) : verifyError ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs space-y-3 text-center">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="font-semibold">{verifyError}</p>
              <button
                type="button"
                onClick={onCompleted}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
              >
                Quay về trang chủ
              </button>
            </div>
          ) : success ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {mode === 'verifyEmail' ? 'Xác thực email thành công!' : 'Đặt lại mật khẩu thành công!'}
                </h3>
                <p className="text-xs text-slate-500">
                  {mode === 'verifyEmail'
                    ? 'Email của bạn đã được xác thực an toàn trên hệ thống.'
                    : 'Mật khẩu của bạn đã được cập nhật. Bạn có thể đăng nhập ngay bây giờ.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onCompleted}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow-md cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitReset} className="space-y-4">
              {email && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate">Tài khoản: <strong>{email}</strong></span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mật khẩu mới (tối thiểu 6 ký tự)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Xác nhận lại mật khẩu mới
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow-md cursor-pointer disabled:opacity-50 mt-2"
              >
                {submitting ? 'Đang cập nhật mật khẩu...' : 'Xác nhận đặt lại mật khẩu'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
