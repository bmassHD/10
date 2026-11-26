import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crop,
  Maximize2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type ImageCropMode = 'avatar' | 'cover';

export interface ImageCropResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  mode: ImageCropMode;
  fileName?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (result: ImageCropResult) => Promise<void> | void;
}

interface CoverPreset {
  id: string;
  label: string;
  ratio: number;
}

const COVER_PRESETS: CoverPreset[] = [
  { id: '16:5', label: '16:5 · Chuẩn trang chủ', ratio: 16 / 5 },
  { id: '3:1', label: '3:1 · Banner ngang', ratio: 3 / 1 },
  { id: '16:9', label: '16:9 · Rộng', ratio: 16 / 9 },
];

const DEFAULT_COVER_RATIO = 16 / 5;

function rotateImageDataUrl(src: string, degrees: 90 | -90): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight || img.height;
      canvas.height = img.naturalWidth || img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Trình duyệt không hỗ trợ xử lý ảnh.'));
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        reject(new Error('Ảnh từ liên kết ngoài không cho phép chỉnh sửa trực tiếp do bảo mật CORS. Vui lòng tải ảnh về máy rồi tải lên.'));
      }
    };
    img.onerror = () => reject(new Error('Không thể xoay ảnh này.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), mimeType, quality);
  });
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  mode,
  isSubmitting = false,
  onCancel,
  onConfirm,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originOffsetX: number;
    originOffsetY: number;
  } | null>(null);

  const [workingSrc, setWorkingSrc] = useState<string | null>(imageSrc);
  const [usedProxyFallback, setUsedProxyFallback] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 560,
    height: 340,
  });
  const [aspectRatio, setAspectRatio] = useState<number>(
    mode === 'avatar' ? 1 : DEFAULT_COVER_RATIO
  );
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  // Sync incoming image & reset crop state whenever modal opens or imageSrc changes
  useEffect(() => {
    if (!isOpen) return;
    setWorkingSrc(imageSrc);
    setUsedProxyFallback(false);
    setNaturalSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLoadError(null);
    setAspectRatio(mode === 'avatar' ? 1 : DEFAULT_COVER_RATIO);
  }, [isOpen, imageSrc, mode]);

  // Observe stage container dimensions for responsive, exact frame sizing
  useEffect(() => {
    if (!isOpen || !stageRef.current) return;
    const el = stageRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  // Escape key cancels when not busy
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !processing && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, processing, isSubmitting, onCancel]);

  // Compute exact crop frame pixel dimensions inside stage with comfortable margin
  const frameSize = useMemo(() => {
    const padX = mode === 'avatar' ? 48 : 32;
    const padY = 40;
    const availW = Math.max(180, stageSize.width - padX);
    const availH = Math.max(140, stageSize.height - padY);

    let w = availW;
    let h = w / aspectRatio;
    if (h > availH) {
      h = availH;
      w = h * aspectRatio;
    }
    return {
      width: Math.max(80, Math.round(w)),
      height: Math.max(60, Math.round(h)),
    };
  }, [stageSize, aspectRatio, mode]);

  // Scale so at zoom = 1 the image covers the crop frame completely
  const baseScale = useMemo(() => {
    if (!naturalSize) return 1;
    return Math.max(
      frameSize.width / naturalSize.width,
      frameSize.height / naturalSize.height
    );
  }, [naturalSize, frameSize]);

  const displayScale = baseScale * zoom;
  const dispW = naturalSize ? naturalSize.width * displayScale : 0;
  const dispH = naturalSize ? naturalSize.height * displayScale : 0;

  const clampOffset = useCallback(
    (nextX: number, nextY: number, targetZoom = zoom) => {
      if (!naturalSize) return { x: 0, y: 0 };
      const scale = baseScale * targetZoom;
      const w = naturalSize.width * scale;
      const h = naturalSize.height * scale;
      const maxX = Math.max(0, (w - frameSize.width) / 2);
      const maxY = Math.max(0, (h - frameSize.height) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, nextX)),
        y: Math.min(maxY, Math.max(-maxY, nextY)),
      };
    },
    [naturalSize, baseScale, frameSize, zoom]
  );

  // Re-clamp offset whenever frame ratio, natural size, or zoom changes
  useEffect(() => {
    setOffset(prev => clampOffset(prev.x, prev.y, zoom));
  }, [clampOffset, zoom]);

  const handleZoomChange = useCallback(
    (nextZoom: number) => {
      const clampedZoom = Math.min(4, Math.max(1, Number(nextZoom.toFixed(2))));
      setZoom(clampedZoom);
      setOffset(prev => clampOffset(prev.x, prev.y, clampedZoom));
    },
    [clampOffset]
  );

  // Non-passive wheel zoom listener so wheel zooming doesn't scroll background page
  useEffect(() => {
    const el = stageRef.current;
    if (!isOpen || !el) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (!naturalSize) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      setZoom(prevZoom => {
        const next = Math.min(4, Math.max(1, Number((prevZoom + delta).toFixed(2))));
        setOffset(prevOff => clampOffset(prevOff.x, prevOff.y, next));
        return next;
      });
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, [isOpen, naturalSize, clampOffset]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || processing || isSubmitting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originOffsetX: offset.x,
      originOffsetY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setOffset(clampOffset(drag.originOffsetX + dx, drag.originOffsetY + dy));
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleRotate = async () => {
    if (!workingSrc || processing || isSubmitting) return;
    setProcessing(true);
    setLoadError(null);
    try {
      const rotated = await rotateImageDataUrl(workingSrc, 90);
      setWorkingSrc(rotated);
      setNaturalSize(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } catch (err: any) {
      setLoadError(err?.message || 'Không thể xoay ảnh.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleConfirmCrop = async () => {
    if (!imgRef.current || !naturalSize || processing || isSubmitting) return;
    setProcessing(true);
    setLoadError(null);
    try {
      const img = imgRef.current;
      // Compute exact source rect inside natural image pixels
      const cropDispX = (dispW - frameSize.width) / 2 - offset.x;
      const cropDispY = (dispH - frameSize.height) / 2 - offset.y;

      const sx = Math.max(0, Math.min(naturalSize.width - 1, cropDispX / displayScale));
      const sy = Math.max(0, Math.min(naturalSize.height - 1, cropDispY / displayScale));
      const sw = Math.max(
        1,
        Math.min(naturalSize.width - sx, frameSize.width / displayScale)
      );
      const sh = Math.max(
        1,
        Math.min(naturalSize.height - sy, frameSize.height / displayScale)
      );

      const outW =
        mode === 'avatar'
          ? 320
          : Math.min(1440, Math.max(960, Math.round(sw)));
      const outH =
        mode === 'avatar'
          ? 320
          : Math.max(1, Math.round(outW / aspectRatio));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Trình duyệt không hỗ trợ xuất ảnh cắt.');
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      let dataUrl = '';
      let blob: Blob | null = null;

      try {
        if (mode === 'avatar') {
          dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
        } else {
          dataUrl = canvas.toDataURL('image/webp', 0.86);
          let mimeType = 'image/webp';
          let quality = 0.86;
          if (!dataUrl.startsWith('data:image/webp') || dataUrl.length > 350000) {
            mimeType = 'image/jpeg';
            quality = 0.84;
            dataUrl = canvas.toDataURL(mimeType, quality);
          }
          if (dataUrl.length > 390000) {
            mimeType = 'image/jpeg';
            quality = 0.7;
            dataUrl = canvas.toDataURL(mimeType, quality);
          }
          if (dataUrl.length > 460000) {
            mimeType = 'image/jpeg';
            quality = 0.56;
            dataUrl = canvas.toDataURL(mimeType, quality);
          }
          blob = await canvasToBlob(canvas, mimeType, quality);
        }
      } catch {
        throw new Error(
          'Ảnh từ đường dẫn ngoài không cho phép cắt trực tiếp do bảo mật trình duyệt (CORS). Vui lòng tải ảnh về máy rồi tải lên.'
        );
      }

      if (!blob) {
        throw new Error('Không thể tạo tệp ảnh sau khi cắt.');
      }

      await onConfirm({
        blob,
        dataUrl,
        width: outW,
        height: outH,
      });
    } catch (err: any) {
      setLoadError(err?.message || 'Không thể cắt ảnh. Vui lòng thử lại.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen || !workingSrc) return null;

  const isBusy = processing || isSubmitting;
  const isCrossOriginHttp = /^https?:\/\//i.test(workingSrc);

  return (
    <div
      className="fixed inset-0 z-[1200] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-crop-modal-title"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Crop className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3
                id="image-crop-modal-title"
                className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate"
              >
                {mode === 'avatar'
                  ? 'Cắt ảnh đại diện (1:1)'
                  : 'Cắt ảnh bìa Trang chủ Trạm Y tế'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {mode === 'avatar'
                  ? 'Kéo để căn giữa khuôn mặt hoặc biểu tượng vào khung vuông'
                  : 'Kéo vị trí và thu phóng để căn khung ảnh bìa đẹp nhất trên trang chủ'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            aria-label="Đóng khung cắt ảnh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cover Aspect Ratio Presets */}
        {mode === 'cover' && (
          <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tỉ lệ khung cắt:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {COVER_PRESETS.map(preset => {
                const active = Math.abs(aspectRatio - preset.ratio) < 0.01;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setAspectRatio(preset.ratio)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Interactive Crop Stage */}
        <div
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          className="relative w-full h-[280px] sm:h-[360px] bg-slate-950 overflow-hidden flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing shrink-0"
        >
          <img
            ref={imgRef}
            src={workingSrc}
            alt="Ảnh đang căn cắt"
            draggable={false}
            referrerPolicy="no-referrer"
            crossOrigin={isCrossOriginHttp ? 'anonymous' : undefined}
            onLoad={e => {
              const target = e.currentTarget;
              const nw = target.naturalWidth;
              const nh = target.naturalHeight;
              if (nw > 0 && nh > 0) {
                setNaturalSize({ width: nw, height: nh });
                setLoadError(null);
              }
            }}
            onError={() => {
              if (
                !usedProxyFallback &&
                workingSrc &&
                /^https?:\/\//i.test(workingSrc) &&
                !workingSrc.includes('/api/image-proxy?')
              ) {
                setUsedProxyFallback(true);
                setNaturalSize(null);
                setWorkingSrc(`/api/image-proxy?url=${encodeURIComponent(workingSrc)}`);
                return;
              }
              setLoadError(
                'Không thể nạp ảnh này để cắt (liên kết lỗi hoặc không truy cập được). Vui lòng tải ảnh về máy rồi chọn lại.'
              );
            }}
            style={
              naturalSize
                ? {
                    width: `${dispW}px`,
                    height: `${dispH}px`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
                  }
                : { opacity: 0 }
            }
            className="pointer-events-none select-none will-change-transform"
          />

          {/* Dimmed Backdrop + Crisp Crop Window */}
          {naturalSize && (
            <div
              style={{
                width: `${frameSize.width}px`,
                height: `${frameSize.height}px`,
                boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.68)',
              }}
              className={`pointer-events-none absolute border-2 border-white/95 ${
                mode === 'avatar' ? 'rounded-2xl' : 'rounded-xl'
              }`}
            >
              {/* Circular guide inside square avatar crop */}
              {mode === 'avatar' && (
                <div className="absolute inset-0 rounded-full border border-dashed border-white/60" />
              )}
              {/* Rule-of-thirds gridlines */}
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
            </div>
          )}

          {!naturalSize && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-300">
              Đang nạp ảnh vào khung cắt...
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-4 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          {loadError && (
            <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-700 dark:text-rose-300">
              {loadError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2.5 flex-1">
              <button
                type="button"
                disabled={isBusy || zoom <= 1}
                onClick={() => handleZoomChange(zoom - 0.15)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.02}
                value={zoom}
                disabled={isBusy || !naturalSize}
                onChange={e => handleZoomChange(Number(e.target.value))}
                aria-label="Mức thu phóng ảnh"
                className="flex-1 accent-emerald-600 cursor-pointer"
              />
              <button
                type="button"
                disabled={isBusy || zoom >= 4}
                onClick={() => handleZoomChange(zoom + 0.15)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 w-11 text-right tabular-nums">
                {zoom.toFixed(1)}x
              </span>
            </div>

            {/* Rotate & Reset */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isBusy || !naturalSize}
                onClick={handleRotate}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Xoay 90°</span>
              </button>
              <button
                type="button"
                disabled={isBusy || !naturalSize}
                onClick={handleReset}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isBusy}
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isBusy || !naturalSize || Boolean(loadError)}
              onClick={handleConfirmCrop}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>
                {isBusy
                  ? 'Đang xử lý ảnh...'
                  : mode === 'avatar'
                  ? 'Cắt & Lưu ảnh đại diện'
                  : 'Cắt & Áp dụng ảnh bìa'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
