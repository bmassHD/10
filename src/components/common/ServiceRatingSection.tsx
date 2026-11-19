import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Star, MessageSquareHeart, Send, CheckCircle2, Sparkles, Trash2, Clock } from 'lucide-react';
import { db } from '../../firebase/config';
import { ServiceRating, ServiceRatingCategory } from '../../types';
import {
  SERVICE_RATING_CATEGORY_LABELS,
  submitServiceRating,
  deleteServiceRating,
} from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UserAvatar } from './UserAvatar';

interface ServiceRatingSectionProps {
  currentView: string;
}

const CATEGORY_OPTIONS: ServiceRatingCategory[] = [
  'giao_dien',
  'thai_do',
  'chuyen_mon',
  'tien_ich',
];

const STAR_LABELS: Record<number, string> = {
  1: 'Chưa hài lòng',
  2: 'Cần cải thiện',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
};

function maskReviewerName(rawName?: string): string {
  const clean = (rawName || '').trim();
  if (!clean) return 'Người dân';
  const lower = clean.toLowerCase();
  if (lower === 'người dân' || lower === 'ẩn danh' || lower === 'khách') {
    return clean;
  }

  if (clean.includes('@')) {
    const [local, domain] = clean.split('@');
    const safeLocal =
      local.length <= 2
        ? `${local[0] || '*'}*`
        : `${local.slice(0, 2)}${'*'.repeat(Math.min(4, local.length - 2))}`;
    return `${safeLocal}@${domain || '***'}`;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  return words
    .map(word => {
      if (word.length <= 1) return word;
      if (word.length <= 3) return `${word[0]}${'*'.repeat(word.length - 1)}`;
      return `${word.slice(0, 2)}${'*'.repeat(Math.min(4, word.length - 2))}`;
    })
    .join(' ');
}

function formatReviewDateTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleString('vi-VN');
  }
}

export const ServiceRatingSection: React.FC<ServiceRatingSectionProps> = ({
  currentView,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const { showToast, showConfirm } = useToast();

  const [ratings, setRatings] = useState<ServiceRating[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [category, setCategory] = useState<ServiceRatingCategory>('giao_dien');
  const [reviewerName, setReviewerName] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedThisSession, setSubmittedThisSession] = useState(false);

  useEffect(() => {
    if (userProfile?.displayName && !reviewerName) {
      setReviewerName(userProfile.displayName);
    } else if (currentUser?.displayName && !reviewerName) {
      setReviewerName(currentUser.displayName);
    }
  }, [userProfile?.displayName, currentUser?.displayName, reviewerName]);

  useEffect(() => {
    const q = query(collection(db, 'serviceRatings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => {
        setRatings(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceRating)));
      },
      () => {
        // Fallback silently if empty or transient read error
      }
    );
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const total = ratings.length;
    if (total === 0) {
      return {
        total: 0,
        average: 0,
        fiveStarRate: 0,
      };
    }
    const sum = ratings.reduce((acc, item) => acc + (Number(item.score) || 0), 0);
    const fiveCount = ratings.filter(r => r.score === 5).length;
    return {
      total,
      average: Math.round((sum / total) * 10) / 10,
      fiveStarRate: Math.round((fiveCount / total) * 100),
    };
  }, [ratings]);

  const publicReviews = useMemo(
    () => ratings.filter(r => Boolean(r.comment?.trim())),
    [ratings]
  );

  const visibleReviews = useMemo(() => publicReviews.slice(0, 10), [publicReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStars < 1 || selectedStars > 5) {
      showToast('warning', 'Vui lòng chọn số sao đánh giá (1–5 sao)');
      return;
    }

    setSubmitting(true);
    try {
      await submitServiceRating({
        score: selectedStars as 1 | 2 | 3 | 4 | 5,
        category,
        comment: comment.trim() || undefined,
        raterName:
          reviewerName.trim() ||
          userProfile?.displayName ||
          currentUser?.displayName ||
          'Người dân',
        raterAvatarUrl: userProfile?.avatarUrl || currentUser?.photoURL || undefined,
        uid: currentUser?.uid,
        pageView: currentView || 'portal',
      });
      setComment('');
      setSubmittedThisSession(true);
      showToast(
        'success',
        'Cảm ơn đánh giá của bạn!',
        `Đã ghi nhận ${selectedStars}/5 sao cho ${SERVICE_RATING_CATEGORY_LABELS[category]}.`
      );
    } catch (err: any) {
      showToast('error', 'Không thể gửi đánh giá', err?.message || 'Vui lòng thử lại sau.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = (rev: ServiceRating) => {
    const masked = maskReviewerName(rev.raterName);
    showConfirm({
      title: 'Xóa đánh giá này?',
      message: `Xóa nhận xét ${rev.score} sao của "${masked}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa đánh giá',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        setDeletingId(rev.id);
        try {
          await deleteServiceRating(rev.id);
          showToast('success', 'Đã xóa đánh giá');
        } catch (err: any) {
          showToast('error', 'Không thể xóa đánh giá', err?.message || 'Vui lòng thử lại sau.');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const activeStarDisplay = hoverStars || selectedStars;

  return (
    <section
      aria-label="Đánh giá trải nghiệm và chất lượng dịch vụ"
      className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800"
    >
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* Left: Summary + Star Picker Form */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <MessageSquareHeart className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Đánh Giá Trải Nghiệm &amp; Dịch Vụ Y Tế
                  </h3>
                  <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Ý kiến của người dân giúp Trạm Y tế nâng cao chất lượng phục vụ hằng ngày.
                  </p>
                </div>
              </div>

              {stats.total > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 shrink-0">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {stats.average.toFixed(1)}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    ({stats.total} lượt)
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Interactive Star Bar */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(starVal => {
                    const isFilled = starVal <= activeStarDisplay;
                    return (
                      <button
                        key={starVal}
                        type="button"
                        onMouseEnter={() => setHoverStars(starVal)}
                        onMouseLeave={() => setHoverStars(0)}
                        onClick={() => setSelectedStars(starVal)}
                        aria-label={`Chọn ${starVal} sao`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition cursor-pointer active:scale-95"
                      >
                        <Star
                          className={`w-7 h-7 transition-transform ${
                            isFilled
                              ? 'text-amber-500 fill-amber-400 scale-105'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                  {activeStarDisplay}/5 sao · {STAR_LABELS[activeStarDisplay]}
                </span>
              </div>

              {/* Category Picker (4 symmetrical options: 2x2 on mobile, 4 cols on sm+) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CATEGORY_OPTIONS.map(catKey => {
                  const active = category === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer text-center ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {SERVICE_RATING_CATEGORY_LABELS[catKey]}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <input
                  type="text"
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  placeholder="Tên của bạn (tùy chọn)"
                  maxLength={80}
                  className="sm:col-span-4 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="text"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Nhận xét thêm về dịch vụ, trải nghiệm..."
                  maxLength={350}
                  className="sm:col-span-8 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {submittedThisSession ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Đã ghi nhận đánh giá của bạn.</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Đánh giá được tổng hợp minh bạch để cải thiện cổng dịch vụ công.
                  </span>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60 whitespace-nowrap shadow-xs"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>{submitting ? 'Đang gửi...' : 'Gửi đánh giá'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Recent Public Reviews / Aggregate */}
          <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Nhận Xét Gần Đây ({visibleReviews.length}
                  {publicReviews.length > 10 ? `/${publicReviews.length}` : ''})
                </span>
              </div>
              {stats.total > 0 && (
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {stats.fiveStarRate}% đánh giá 5★
                </span>
              )}
            </div>

            {publicReviews.length === 0 ? (
              <div className="h-[320px] flex flex-col items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500 space-y-1 px-4">
                <p className="font-semibold text-slate-500 dark:text-slate-400">
                  {stats.total > 0
                    ? `Đã có ${stats.total} lượt chấm điểm sao.`
                    : 'Chưa có nhận xét nào. Hãy là người đầu tiên đánh giá!'}
                </p>
              </div>
            ) : (
              <div className="h-[320px] overflow-y-auto pr-1.5 space-y-2.5 overscroll-contain">
                {visibleReviews.map(rev => {
                  const isOwnReview = Boolean(currentUser?.uid && rev.uid && rev.uid === currentUser.uid);
                  const canDelete = Boolean(isAdmin || isOwnReview);
                  const maskedName = maskReviewerName(rev.raterName);
                  const formattedTime = formatReviewDateTime(rev.updatedAt || rev.createdAt);

                  return (
                    <div
                      key={rev.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={rev.raterAvatarUrl}
                            name={rev.raterName || 'Người dân'}
                            size={34}
                            rounded="full"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {maskedName}
                              </span>
                              {isOwnReview && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                              {SERVICE_RATING_CATEGORY_LABELS[rev.category] || 'Trải nghiệm'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className="inline-flex items-center gap-0.5 text-amber-500 font-bold tabular-nums"
                            aria-label={`${rev.score} trên 5 sao`}
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < rev.score
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-300 dark:text-slate-700'
                                }`}
                              />
                            ))}
                          </span>

                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === rev.id}
                              onClick={() => handleDeleteReview(rev)}
                              title={isAdmin ? 'Xóa đánh giá (Quản trị)' : 'Xóa đánh giá của bạn'}
                              aria-label="Xóa đánh giá"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {rev.comment && (
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed break-words pl-[44px]">
                          {rev.comment}
                        </p>
                      )}

                      {formattedTime && (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{formattedTime}</span>
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
    </section>
  );
};
