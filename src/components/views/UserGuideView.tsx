import React, { useState, useMemo } from 'react';
import {
  Compass,
  Search,
  CreditCard,
  CalendarClock,
  Syringe,
  FileText,
  MessageSquare,
  LayoutGrid,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Play,
  Bookmark,
  Users,
} from 'lucide-react';
import { useUserGuide, USER_GUIDE_TOPICS } from '../../contexts/UserGuideContext';

interface UserGuideViewProps {
  onSelectTab: (tab: string) => void;
}

export const UserGuideView: React.FC<UserGuideViewProps> = ({ onSelectTab }) => {
  const { startTour } = useUserGuide();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredTopics = useMemo(() => {
    return USER_GUIDE_TOPICS.filter(t => {
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [searchQuery, selectedCategory]);

  const getTopicIcon = (iconName?: string) => {
    switch (iconName) {
      case 'CreditCard':
        return <CreditCard className="w-6 h-6 text-emerald-600" />;
      case 'CalendarClock':
        return <CalendarClock className="w-6 h-6 text-rose-600" />;
      case 'Syringe':
        return <Syringe className="w-6 h-6 text-blue-600" />;
      case 'FileText':
        return <FileText className="w-6 h-6 text-purple-600" />;
      case 'MessageSquare':
        return <MessageSquare className="w-6 h-6 text-teal-600" />;
      case 'LayoutGrid':
        return <LayoutGrid className="w-6 h-6 text-amber-600" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-6 h-6 text-rose-600" />;
      default:
        return <HelpCircle className="w-6 h-6 text-emerald-600" />;
    }
  };

  const handleStartTopicTour = (topicId: string, targetTab: string) => {
    startTour(topicId, onSelectTab);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24">
      {/* Hero Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-linear-to-br from-emerald-900 via-teal-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              <Compass className="w-3.5 h-3.5" />
              <span>Chế Độ Hướng Dẫn Tương Tác Trực Quan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Hướng Dẫn Sử Dụng Cổng Thông Tin Điện Tử
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Dành cho công dân, bệnh nhân và cán bộ y tế mới tiếp cận hệ thống. Chọn bất kỳ nội dung nào bên dưới, hệ thống sẽ tự động đưa bạn đến đúng trang, làm nổi bật từng nút bấm/ô nhập liệu và hướng dẫn bạn thực hành trực tiếp.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-2xl font-black font-mono block">
                {USER_GUIDE_TOPICS.length}
              </span>
              <span className="text-[11px] text-emerald-200 font-semibold">Chủ đề thực hành</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm chủ đề hướng dẫn (BHYT, lịch trực, tiêm chủng)..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('citizen')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedCategory === 'citizen'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Công dân &amp; Người bệnh
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('medical')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedCategory === 'medical'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Dịch vụ &amp; Y tế cơ sở
          </button>
        </div>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {filteredTopics.map((topic, index) => (
          <div
            key={topic.id}
            className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-5 group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 group-hover:scale-105 transition-transform shrink-0">
                  {getTopicIcon(topic.iconName)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {topic.steps.length} bước thực hành
                  </span>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                    {topic.badge}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                  {topic.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {topic.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Lộ trình thao tác:
                </span>
                <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1 list-none pl-0">
                  {topic.steps.map((st, sIdx) => (
                    <li key={st.id} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {sIdx + 1}
                      </span>
                      <span className="line-clamp-1">{st.title}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStartTopicTour(topic.id, topic.targetTab)}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 group-hover:bg-emerald-500"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Bắt Đầu Hướng Dẫn Từng Bước</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
