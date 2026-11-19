import React, { useState, useEffect, useRef } from 'react';
import { useUserGuide } from '../../contexts/UserGuideContext';
import { X, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Compass } from 'lucide-react';

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export const SpotlightTourOverlay: React.FC = () => {
  const {
    activeTour,
    currentStepIndex,
    currentStep,
    isTourActive,
    nextStep,
    prevStep,
    stopTour,
  } = useUserGuide();

  const [rect, setRect] = useState<ElementRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<'top' | 'bottom' | 'center'>('bottom');
  const [hasInteractedThisStep, setHasInteractedThisStep] = useState(false);
  const highlightedElemRef = useRef<HTMLElement | null>(null);

  // Locate target DOM element
  useEffect(() => {
    if (!isTourActive || !currentStep) {
      setRect(null);
      return;
    }

    setHasInteractedThisStep(false);

    let retryCount = 0;
    const maxRetries = 15;

    const findAndMeasure = () => {
      const elem = document.querySelector<HTMLElement>(`[data-tour-id="${currentStep.targetTourId}"]`);
      if (elem) {
        highlightedElemRef.current = elem;
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const clientRect = elem.getBoundingClientRect();
        setRect({
          top: clientRect.top,
          left: clientRect.left,
          width: clientRect.width,
          height: clientRect.height,
          bottom: clientRect.bottom,
          right: clientRect.right,
        });

        // Determine tooltip placement based on screen position
        const windowHeight = window.innerHeight;
        if (clientRect.bottom + 220 < windowHeight) {
          setTooltipPos('bottom');
        } else if (clientRect.top > 220) {
          setTooltipPos('top');
        } else {
          setTooltipPos('center');
        }
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(findAndMeasure, 120);
      } else {
        // Fallback to center if element not found in DOM
        setRect(null);
        setTooltipPos('center');
      }
    };

    findAndMeasure();

    const handleUpdate = () => {
      if (highlightedElemRef.current) {
        const clientRect = highlightedElemRef.current.getBoundingClientRect();
        setRect({
          top: clientRect.top,
          left: clientRect.left,
          width: clientRect.width,
          height: clientRect.height,
          bottom: clientRect.bottom,
          right: clientRect.right,
        });
      }
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isTourActive, currentStep, currentStepIndex]);

  // Attach event listener to detect user's actual action (Click or Input)
  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    const elem = highlightedElemRef.current;
    if (!elem) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const handleUserInteraction = (event: Event) => {
      if (hasInteractedThisStep) return;

      if (currentStep.actionType === 'input') {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        const val = target?.value || '';
        if (val.trim().length > 0) {
          setHasInteractedThisStep(true);
          timeoutId = setTimeout(() => {
            nextStep();
          }, 450);
        }
      } else {
        // Click action
        setHasInteractedThisStep(true);
        timeoutId = setTimeout(() => {
          nextStep();
        }, 350);
      }
    };

    if (currentStep.actionType === 'input') {
      elem.addEventListener('input', handleUserInteraction);
      elem.addEventListener('change', handleUserInteraction);
    } else {
      elem.addEventListener('click', handleUserInteraction, { capture: true });
    }

    // Support keyboard escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopTour();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (elem) {
        elem.removeEventListener('input', handleUserInteraction);
        elem.removeEventListener('change', handleUserInteraction);
        elem.removeEventListener('click', handleUserInteraction, { capture: true });
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTourActive, currentStep, hasInteractedThisStep, nextStep, stopTour]);

  if (!isTourActive || !activeTour || !currentStep) return null;

  const totalSteps = activeTour.steps.length;
  const padding = 6;

  return (
    <div className="fixed inset-0 z-9999 overflow-hidden pointer-events-none select-none">
      {/* SVG Backdrop with Transparent Cutout Hole around target element */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            {/* White covers whole screen (visible backdrop) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight hole (transparent window to real element) */}
            {rect && (
              <rect
                x={Math.max(0, rect.left - padding)}
                y={Math.max(0, rect.top - padding)}
                width={rect.width + padding * 2}
                height={rect.height + padding * 2}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Dimmed backdrop layer with cutout mask */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Target Element Highlight Box with Pulsing Glow */}
      {rect && (
        <div
          style={{
            position: 'absolute',
            top: `${Math.max(0, rect.top - padding)}px`,
            left: `${Math.max(0, rect.left - padding)}px`,
            width: `${rect.width + padding * 2}px`,
            height: `${rect.height + padding * 2}px`,
          }}
          className="rounded-2xl border-2 border-amber-400 shadow-2xl ring-4 ring-amber-400/40 pointer-events-none transition-all duration-300 animate-pulse"
        />
      )}

      {/* Interactive Tooltip Card */}
      <div
        className="pointer-events-auto transition-all duration-300"
        style={
          rect && tooltipPos === 'bottom'
            ? {
                position: 'absolute',
                top: `${Math.min(window.innerHeight - 240, rect.bottom + 16)}px`,
                left: `${Math.max(16, Math.min(window.innerWidth - 360, rect.left))}px`,
                maxWidth: '380px',
              }
            : rect && tooltipPos === 'top'
            ? {
                position: 'absolute',
                bottom: `${window.innerHeight - rect.top + 16}px`,
                left: `${Math.max(16, Math.min(window.innerWidth - 360, rect.left))}px`,
                maxWidth: '380px',
              }
            : {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: '420px',
                width: 'calc(100% - 32px)',
              }
        }
      >
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-400 dark:border-amber-500 text-slate-900 dark:text-white shadow-2xl space-y-3 relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 shrink-0">
                <Compass className="w-4 h-4 animate-spin-slow" />
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  Hướng Dẫn Thực Hành ({currentStepIndex + 1}/{totalSteps})
                </span>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                  {currentStep.title}
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={stopTour}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Kết thúc hướng dẫn (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Interactive Instruction Text */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-950 dark:text-amber-100 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {currentStep.actionType === 'input'
                  ? '👉 Thao tác yêu cầu: Hãy nhập thử nội dung'
                  : '👉 Thao tác yêu cầu: Hãy bấm thử vào nút này'}
              </span>
            </div>
            <p className="font-medium text-xs">
              {currentStep.instruction}
            </p>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Quay lại</span>
                </button>
              )}
              <button
                type="button"
                onClick={stopTour}
                className="px-2.5 py-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] font-semibold cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 transition cursor-pointer shadow-md"
            >
              <span>{currentStepIndex < totalSteps - 1 ? 'Tiếp tục' : 'Hoàn tất'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
