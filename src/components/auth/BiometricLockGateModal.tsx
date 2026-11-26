import React, { useState, useEffect, useRef } from 'react';
import {
  Fingerprint,
  ScanFace,
  ShieldCheck,
  LogOut,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserAvatar } from '../common/UserAvatar';

interface BiometricLockGateModalProps {
  onLockStateChange?: (locked: boolean) => void;
}

const SESSION_UNLOCK_PREFIX = 'tyt_bio_session_unlocked_v1_';
const BACKGROUND_LOCK_THRESHOLD_MS = 30_000;

function readSessionUnlocked(uid: string): boolean {
  try {
    return sessionStorage.getItem(`${SESSION_UNLOCK_PREFIX}${uid}`) === '1';
  } catch {
    return false;
  }
}

export function markBiometricSessionUnlocked(uid: string): void {
  try {
    sessionStorage.setItem(`${SESSION_UNLOCK_PREFIX}${uid}`, '1');
  } catch {
    // ignore storage restrictions
  }
}

export function clearBiometricSessionUnlocked(uid?: string): void {
  try {
    if (uid) {
      sessionStorage.removeItem(`${SESSION_UNLOCK_PREFIX}${uid}`);
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_UNLOCK_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

export const BiometricLockGateModal: React.FC<BiometricLockGateModalProps> = ({
  onLockStateChange,
}) => {
  const {
    currentUser,
    userProfile,
    loading,
    isBanned,
    requiresTwoFactorVerification,
    pendingSmsMfaResolver,
    biometricEnvironment,
    biometricMeta,
    verifyBiometricUnlockForPwa,
    logout,
  } = useAuth();
  const { showToast } = useToast();

  const [isLocked, setIsLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevUidRef = useRef<string | null>(null);
  const authSettledWithoutUserRef = useRef<boolean>(false);
  const hiddenAtMsRef = useRef<number | null>(null);

  const lockFeatureReady = Boolean(
    currentUser &&
      !loading &&
      !isBanned &&
      !requiresTwoFactorVerification &&
      !pendingSmsMfaResolver &&
      biometricEnvironment?.available &&
      biometricMeta?.appLockEnabled &&
      biometricMeta?.uid === currentUser.uid &&
      biometricMeta?.credentialId
  );

  // Track whether user was signed out before authenticating interactively in this tab
  useEffect(() => {
    if (!loading && !currentUser) {
      authSettledWithoutUserRef.current = true;
      prevUidRef.current = null;
      setIsLocked(false);
      setError(null);
      clearBiometricSessionUnlocked();
    }
  }, [loading, currentUser]);

  useEffect(() => {
    if (!lockFeatureReady || !currentUser) {
      if (!currentUser || !biometricMeta?.appLockEnabled) {
        setIsLocked(false);
      }
      return;
    }

    // If user just signed in interactively in this tab, keep session unlocked without double prompt
    if (authSettledWithoutUserRef.current && prevUidRef.current !== currentUser.uid) {
      authSettledWithoutUserRef.current = false;
      prevUidRef.current = currentUser.uid;
      markBiometricSessionUnlocked(currentUser.uid);
      setIsLocked(false);
      return;
    }

    prevUidRef.current = currentUser.uid;
    if (!readSessionUnlocked(currentUser.uid)) {
      setIsLocked(true);
    }
  }, [lockFeatureReady, currentUser, biometricMeta?.appLockEnabled]);

  // Lock again after PWA is hidden/backgrounded >= 30s
  useEffect(() => {
    if (!lockFeatureReady || !currentUser) return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtMsRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const hiddenAt = hiddenAtMsRef.current;
        hiddenAtMsRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt >= BACKGROUND_LOCK_THRESHOLD_MS) {
          clearBiometricSessionUnlocked(currentUser.uid);
          setError(null);
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [lockFeatureReady, currentUser]);

  useEffect(() => {
    onLockStateChange?.(isLocked && lockFeatureReady);
  }, [isLocked, lockFeatureReady, onLockStateChange]);

  if (!isLocked || !lockFeatureReady || !currentUser) {
    return null;
  }

  const bioLabel = biometricEnvironment?.shortLabel || biometricMeta?.label || 'Face ID / Touch ID';
  const isAppleFace = /face id/i.test(bioLabel);
  const displayName =
    userProfile?.displayName || currentUser.displayName || biometricMeta?.displayName || 'Thành viên';
  const avatarUrl = userProfile?.avatarUrl || currentUser.photoURL || '';

  const handleUnlock = async () => {
    setError(null);
    setVerifying(true);
    try {
      const res = await verifyBiometricUnlockForPwa();
      markBiometricSessionUnlocked(currentUser.uid);
      setIsLocked(false);
      showToast(
        'success',
        `Đã mở khóa bằng ${bioLabel}`,
        res.offlineFallback ? 'Đã xác thực sinh trắc học ngoại tuyến trên thiết bị.' : undefined
      );
    } catch (err: any) {
      setError(err?.message || `Không thể xác thực ${bioLabel}. Vui lòng thử lại.`);
    } finally {
      setVerifying(false);
    }
  };

  const handleSwitchAccount = async () => {
    clearBiometricSessionUnlocked(currentUser.uid);
    setIsLocked(false);
    await logout();
  };

  return (
    <div
      className="fixed inset-0 z-[10120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="biometric-lock-title"
    >
      <div className="w-full max-w-sm md:max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-5 text-center space-y-3 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md">
            {isAppleFace ? (
              <ScanFace className="w-7 h-7" />
            ) : (
              <Fingerprint className="w-7 h-7" />
            )}
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Lock className="w-3.5 h-3.5" />
              <span>{biometricEnvironment?.isStandalonePwa ? 'Khóa bảo mật PWA' : 'Khóa bảo mật ứng dụng'}</span>
            </div>
            <h2
              id="biometric-lock-title"
              className="text-lg font-extrabold text-slate-900 dark:text-white"
            >
              Xác thực {bioLabel}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Vui lòng xác minh danh tính trên thiết bị để tiếp tục truy cập phiên đăng nhập.
            </p>
          </div>

          <div className="mx-auto max-w-xs p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3 text-left">
            <UserAvatar name={displayName} src={avatarUrl} size={40} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {biometricMeta?.emailMasked || currentUser.email || 'Tài khoản đã xác thực'}
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            disabled={verifying}
            onClick={() => void handleUnlock()}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            {isAppleFace ? (
              <ScanFace className="w-4.5 h-4.5 shrink-0" />
            ) : (
              <Fingerprint className="w-4.5 h-4.5 shrink-0" />
            )}
            <span>{verifying ? 'Đang xác thực...' : `Mở khóa bằng ${bioLabel}`}</span>
          </button>

          <button
            type="button"
            disabled={verifying}
            onClick={() => void handleSwitchAccount()}
            className="w-full min-h-[44px] px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất để dùng mật khẩu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
