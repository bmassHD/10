import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Monitor,
  ShieldCheck,
  Upload,
  KeyRound,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface MobileQrScannerModalProps {
  isOpen: boolean;
  initialSessionId?: string;
  initialPairCode?: string;
  onClose: () => void;
}

interface InspectedPcSession {
  sessionId: string;
  pairCode: string;
  expiresAt: number;
  pcDevice: {
    deviceName: string;
    platform: string;
    os: string;
    browser: string;
    requestedAt: string;
  };
}

function parseQrPayloadText(rawText: string): { sessionId?: string; pairCode?: string } | null {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed, window.location.origin);
    const sid = parsedUrl.searchParams.get('qrLogin')?.trim();
    const code = parsedUrl.searchParams.get('qrCode')?.trim().toUpperCase();
    if (sid || code) {
      return { sessionId: sid || undefined, pairCode: code || undefined };
    }
  } catch {
    // not a URL -> inspect raw formats
  }

  if (trimmed.startsWith('qr_')) {
    return { sessionId: trimmed };
  }
  const cleanCode = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanCode.length >= 6 && cleanCode.length <= 10) {
    return { pairCode: cleanCode };
  }
  return null;
}

export const MobileQrScannerModal: React.FC<MobileQrScannerModalProps> = ({
  isOpen,
  initialSessionId = '',
  initialPairCode = '',
  onClose,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [deciding, setDeciding] = useState<'approve' | 'reject' | null>(null);
  const [inspectedSession, setInspectedSession] = useState<InspectedPcSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedDecision, setCompletedDecision] = useState<'approved' | 'rejected' | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scanBusyRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const handleInspectTarget = useCallback(
    async (target: { sessionId?: string; pairCode?: string }) => {
      if (!currentUser) {
        setErrorMsg('Bạn cần đăng nhập trên điện thoại trước khi xác nhận mã QR.');
        return;
      }
      if (!target.sessionId && !target.pairCode) return;

      scanBusyRef.current = true;
      setInspecting(true);
      setErrorMsg(null);

      try {
        const idToken = await currentUser.getIdToken(true);
        const resp = await fetch('/api/auth/qr/inspect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(target),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data?.ok || !data?.sessionId) {
          throw new Error(data?.error || 'Không tìm thấy yêu cầu đăng nhập QR hợp lệ.');
        }

        stopCamera();
        setInspectedSession({
          sessionId: data.sessionId,
          pairCode: data.pairCode,
          expiresAt: Number(data.expiresAt) || Date.now() + 180_000,
          pcDevice: data.pcDevice,
        });
      } catch (err: any) {
        setErrorMsg(err?.message || 'Không thể kiểm tra mã QR.');
      } finally {
        setInspecting(false);
        scanBusyRef.current = false;
      }
    },
    [currentUser, stopCamera]
  );

  // Start rear camera when modal opens in scan mode
  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ mở camera trực tiếp. Hãy tải ảnh mã QR hoặc nhập mã 6 ký tự.');
      return;
    }

    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        'Chưa được cấp quyền Camera trên trình duyệt. Bạn có thể chọn ảnh chụp mã QR hoặc nhập mã 6 ký tự bên dưới.'
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setInspectedSession(null);
      setCompletedDecision(null);
      setErrorMsg(null);
      setManualCode('');
      return;
    }

    if (initialSessionId || initialPairCode) {
      void handleInspectTarget({
        sessionId: initialSessionId || undefined,
        pairCode: initialPairCode || undefined,
      });
    } else if (currentUser) {
      void startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, initialSessionId, initialPairCode, currentUser, startCamera, stopCamera, handleInspectTarget]);

  // Continuous QR frame scanner while cameraActive && !inspectedSession && !completedDecision
  useEffect(() => {
    if (!isOpen || !cameraActive || inspectedSession || completedDecision) return;

    const timer = window.setInterval(() => {
      if (scanBusyRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        const parsed = parseQrPayloadText(code.data);
        if (parsed) {
          void handleInspectTarget(parsed);
        }
      }
    }, 150);

    return () => window.clearInterval(timer);
  }, [isOpen, cameraActive, inspectedSession, completedDecision, handleInspectTarget]);

  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);

    try {
      const bitmapUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setErrorMsg('Không thể đọc dữ liệu ảnh mã QR.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const decoded = jsQR(imageData.data, img.width, img.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (!decoded?.data) {
            setErrorMsg('Không tìm thấy mã QR hợp lệ trong ảnh đã chọn.');
            return;
          }
          const parsed = parseQrPayloadText(decoded.data);
          if (!parsed) {
            setErrorMsg('Mã QR trong ảnh không thuộc hệ thống đăng nhập Trạm Y Tế.');
            return;
          }
          void handleInspectTarget(parsed);
        } finally {
          URL.revokeObjectURL(bitmapUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(bitmapUrl);
        setErrorMsg('Không thể mở tệp ảnh đã chọn.');
      };
      img.src = bitmapUrl;
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApproveOrReject = async (decision: 'approve' | 'reject') => {
    if (!currentUser || !inspectedSession) return;
    setDeciding(decision);
    setErrorMsg(null);

    try {
      const idToken = await currentUser.getIdToken(true);
      const resp = await fetch('/api/auth/qr/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sessionId: inspectedSession.sessionId,
          pairCode: inspectedSession.pairCode,
          decision,
          ...(decision === 'approve' ? { refreshToken: currentUser.refreshToken } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || 'Không thể xử lý yêu cầu xác nhận QR.');
      }

      if (decision === 'approve') {
        setCompletedDecision('approved');
        showToast(
          'success',
          'Đã cho phép đăng nhập trên PC',
          `Thiết bị ${inspectedSession.pcDevice.deviceName} đã được đăng nhập bằng tài khoản của bạn.`
        );
      } else {
        setCompletedDecision('rejected');
        showToast('info', 'Đã từ chối yêu cầu đăng nhập QR');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể xác nhận đăng nhập QR.');
    } finally {
      setDeciding(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10065] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Quét mã QR đăng nhập PC
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentUser
                  ? `Tài khoản: ${userProfile?.displayName || currentUser.displayName || currentUser.email}`
                  : 'Cần đăng nhập trên điện thoại trước'}
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

        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!currentUser ? (
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center space-y-3">
              <LogIn className="w-8 h-8 text-amber-600 mx-auto" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                Thiết bị này chưa đăng nhập tài khoản
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Vui lòng đăng nhập trên điện thoại trước, sau đó quét mã QR để cấp quyền đăng nhập cho máy tính.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                Đóng để đăng nhập
              </button>
            </div>
          ) : completedDecision ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-3">
              {completedDecision === 'approved' ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Đã cho phép đăng nhập PC
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Máy tính sẽ tự động chuyển sang trạng thái đã đăng nhập bằng tài khoản của bạn trong giây lát. Bạn có thể quản lý hoặc đăng xuất từ xa tại mục <strong>Thiết bị đã đăng nhập</strong>.
                  </p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
                  <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Đã từ chối đăng nhập
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Yêu cầu đăng nhập QR trên máy tính đã bị hủy an toàn.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          ) : inspectedSession ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Yêu cầu đăng nhập máy tính
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                      {inspectedSession.pcDevice.deviceName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {inspectedSession.pcDevice.os} · {inspectedSession.pcDevice.browser} · Mã #{inspectedSession.pairCode}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Chỉ bấm <strong>Cho phép đăng nhập</strong> nếu chính bạn đang thao tác trên máy tính này.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={Boolean(deciding)}
                  onClick={() => void handleApproveOrReject('reject')}
                  className="min-h-[46px] px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {deciding === 'reject' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <X className="w-4 h-4 shrink-0" />
                  )}
                  <span>{deciding === 'reject' ? 'Đang từ chối...' : 'Từ chối'}</span>
                </button>

                <button
                  type="button"
                  disabled={Boolean(deciding)}
                  onClick={() => void handleApproveOrReject('approve')}
                  className="min-h-[46px] px-3 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs whitespace-nowrap"
                >
                  {deciding === 'approve' ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{deciding === 'approve' ? 'Đang xác nhận...' : 'Cho phép'}</span>
                </button>
              </div>

              <button
                type="button"
                disabled={Boolean(deciding)}
                onClick={() => {
                  setInspectedSession(null);
                  void startCamera();
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer transition"
              >
                Quét lại mã QR khác
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Camera Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 aspect-square max-h-[280px] mx-auto w-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-44 h-44 rounded-2xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                  </div>
                )}

                {inspecting && (
                  <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center gap-2 text-white text-xs font-semibold">
                    <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                    <span>Đang đọc thông tin phiên PC...</span>
                  </div>
                )}

                {!cameraActive && !inspecting && (
                  <div className="p-5 text-center space-y-2.5 text-slate-300">
                    <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs leading-relaxed">
                      {cameraError || 'Đang khởi động camera quét mã QR...'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 mx-auto cursor-pointer whitespace-nowrap"
                    >
                      Bật lại Camera
                    </button>
                  </div>
                )}
              </div>

              {/* Upload QR Photo + Manual Pair Code Fallback */}
              <div className="space-y-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleQrImageUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chọn ảnh chụp mã QR từ máy</span>
                </button>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const parsed = parseQrPayloadText(manualCode);
                    if (!parsed) {
                      setErrorMsg('Vui lòng nhập đủ mã ghép đôi 6 ký tự hiển thị trên PC.');
                      return;
                    }
                    void handleInspectTarget(parsed);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      maxLength={10}
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder="Hoặc nhập mã 6 ký tự trên PC"
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono uppercase text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inspecting || manualCode.trim().length < 6}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    Xác nhận
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
