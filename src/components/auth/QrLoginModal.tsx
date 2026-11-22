import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Monitor,
  Copy,
  Check,
  Clock,
} from 'lucide-react';
import { useAuth, QrAuthHandoffBundle } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { detectCurrentDeviceMeta } from '../../utils/verifiedIdentity';

interface QrLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type QrFlowStatus = 'creating' | 'pending' | 'scanned' | 'approved' | 'rejected' | 'expired' | 'error';

export const QrLoginModal: React.FC<QrLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signInWithQrHandoff } = useAuth();
  const { showToast } = useToast();

  const [sessionId, setSessionId] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pollSecret, setPollSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, setStatus] = useState<QrFlowStatus>('creating');
  const [scannerHint, setScannerHint] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const signingInRef = useRef(false);

  const createNewSession = useCallback(async () => {
    setStatus('creating');
    setErrorMessage(null);
    setScannerHint('');
    setQrDataUrl('');
    signingInRef.current = false;

    try {
      const meta = detectCurrentDeviceMeta();
      const resp = await fetch('/api/auth/qr/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: meta.deviceName,
          platform: meta.platform,
          os: meta.os,
          browser: meta.browser,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok || !data?.sessionId || !data?.pollSecret) {
        throw new Error(data?.error || 'Không thể khởi tạo mã QR đăng nhập.');
      }

      const qrUrl =
        data.qrUrl ||
        `${window.location.origin}/?qrLogin=${encodeURIComponent(data.sessionId)}&qrCode=${encodeURIComponent(data.pairCode)}#tai-khoan`;

      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      setSessionId(data.sessionId);
      setPairCode(data.pairCode);
      setPollSecret(data.pollSecret);
      setExpiresAt(Number(data.expiresAt) || Date.now() + 180_000);
      setNowMs(Date.now());
      setQrDataUrl(dataUrl);
      setStatus('pending');
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.message || 'Không thể tạo mã QR. Vui lòng thử lại.');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void createNewSession();
  }, [isOpen, createNewSession]);

  // Countdown tick every second
  useEffect(() => {
    if (!isOpen || (status !== 'pending' && status !== 'scanned')) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, status]);

  // Poll QR status every 1.6s
  useEffect(() => {
    if (!isOpen || !sessionId || !pollSecret) return;
    if (status !== 'pending' && status !== 'scanned') return;

    let cancelled = false;

    const pollOnce = async () => {
      if (cancelled || signingInRef.current) return;
      try {
        const resp = await fetch('/api/auth/qr/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, pollSecret }),
        });
        const data = await resp.json().catch(() => ({}));
        if (cancelled) return;
        if (!resp.ok || !data?.ok) return;

        if (data.status === 'scanned') {
          setStatus('scanned');
          if (data.scannerHint) {
            setScannerHint(String(data.scannerHint));
          }
        } else if (data.status === 'rejected') {
          setStatus('rejected');
        } else if (data.status === 'expired') {
          setStatus('expired');
        } else if (data.status === 'approved' && data.authBundle) {
          signingInRef.current = true;
          setStatus('approved');
          try {
            await signInWithQrHandoff(data.authBundle as QrAuthHandoffBundle);
            if (!cancelled) {
              showToast(
                'success',
                'Đăng nhập bằng mã QR thành công',
                'Tài khoản đã được đồng bộ từ điện thoại sang máy tính này.'
              );
              onSuccess?.();
              onClose();
            }
          } catch (handoffErr: any) {
            signingInRef.current = false;
            if (!cancelled) {
              setStatus('error');
              setErrorMessage(
                handoffErr?.message || 'Không thể hoàn tất đăng nhập trên trình duyệt này.'
              );
            }
          }
        }
      } catch {
        // Silent retry on temporary network hiccup
      }
    };

    const interval = window.setInterval(() => {
      void pollOnce();
    }, 1600);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, sessionId, pollSecret, status, signInWithQrHandoff, showToast, onClose, onSuccess]);

  if (!isOpen) return null;

  const remainingSec = Math.max(0, Math.ceil((expiresAt - nowMs) / 1000));
  const minPart = String(Math.floor(remainingSec / 60)).padStart(2, '0');
  const secPart = String(remainingSec % 60).padStart(2, '0');

  const handleCopyCode = async () => {
    if (!pairCode) return;
    try {
      await navigator.clipboard.writeText(pairCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  return (
    <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Đăng nhập PC bằng mã QR
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Quét từ điện thoại đã đăng nhập để vào nhanh không cần mật khẩu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* QR Card */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-5 flex flex-col items-center text-center space-y-3">
            {status === 'creating' ? (
              <div className="w-[220px] h-[220px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                <span>Đang tạo mã QR bảo mật...</span>
              </div>
            ) : status === 'approved' ? (
              <div className="w-[220px] h-[220px] rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center gap-2.5 px-4">
                <CheckCircle2 className="w-11 h-11 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Đã xác nhận từ điện thoại
                </span>
                <span className="text-xs text-emerald-700 dark:text-emerald-300">
                  Đang tự động chuyển trạng thái đăng nhập...
                </span>
              </div>
            ) : status === 'expired' || status === 'rejected' || status === 'error' ? (
              <div className="w-[220px] h-[220px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-3 px-4">
                <AlertCircle className="w-9 h-9 text-rose-600 shrink-0" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed">
                  {status === 'rejected'
                    ? 'Yêu cầu đăng nhập đã bị từ chối trên điện thoại.'
                    : status === 'expired'
                    ? 'Mã QR đã hết hiệu lực sau 3 phút.'
                    : errorMessage || 'Đã xảy ra lỗi khởi tạo mã QR.'}
                </div>
                <button
                  type="button"
                  onClick={() => void createNewSession()}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>Tạo mã QR mới</span>
                </button>
              </div>
            ) : (
              <>
                <div className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="Mã QR đăng nhập trên máy tính"
                      className="w-[216px] h-[216px] rounded-xl block"
                    />
                  )}
                </div>

                {/* Symmetrical 2-Column Countdown + Refresh Strip */}
                <div className="grid grid-cols-2 gap-2.5 w-full text-xs">
                  <div className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold tabular-nums flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Còn {minPart}:{secPart}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void createNewSession()}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap transition"
                    title="Làm mới mã QR"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Tạo mã mới</span>
                  </button>
                </div>

                {/* Manual Pair Code Fallback */}
                <div className="w-full pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Mã ghép đôi dự phòng:
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="min-h-[36px] inline-flex items-center justify-center gap-2 px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 font-mono font-black text-sm tracking-widest text-slate-900 dark:text-white cursor-pointer tabular-nums transition shrink-0"
                    title="Sao chép mã 6 ký tự"
                  >
                    <span>{pairCode}</span>
                    {copiedCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Live Status Banner */}
          {status === 'scanned' ? (
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  Đã quét mã từ {scannerHint || 'điện thoại của bạn'}
                </div>
                <div className="mt-0.5">
                  Hãy nhấn <strong>“Cho phép đăng nhập”</strong> trên màn hình điện thoại để hoàn tất.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Bước 1:</strong> Mở ứng dụng trên điện thoại đã đăng nhập, nhấn <strong>Quét mã QR</strong>.
                </div>
              </div>
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-start gap-2">
                <Monitor className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>Bước 2:</strong> Quét QR hoặc nhập mã 6 ký tự, bấm <strong>Cho phép</strong> để vào ngay.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
