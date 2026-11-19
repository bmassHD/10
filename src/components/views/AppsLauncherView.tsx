import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutGrid,
  Star,
  Search,
  ExternalLink,
  Settings,
  X,
  FolderHeart,
  Globe,
} from 'lucide-react';
import { PortalAppItem, SystemSettings } from '../../types';
import { resolvePortalAppCategories } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getBalancedMobileGridClass, getBalancedMobileItemSpan } from '../../utils/mobileGrid';

interface AppsLauncherViewProps {
  settings: SystemSettings;
  onOpenAdminAppsSetup?: () => void;
}

const FAVORITE_APPS_STORAGE_KEY = 'tyt_favorite_portal_apps_v1';

const ICON_FALLBACK_GRADIENTS = [
  'from-emerald-600 to-teal-700',
  'from-sky-600 to-blue-700',
  'from-indigo-600 to-slate-800',
  'from-amber-600 to-orange-700',
  'from-rose-600 to-pink-700',
  'from-cyan-600 to-teal-800',
];

function getAppInitials(name: string): string {
  const clean = String(name || '').trim();
  if (!clean) return 'APP';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getGradientForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ICON_FALLBACK_GRADIENTS[hash % ICON_FALLBACK_GRADIENTS.length];
}

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function loadFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITE_APPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

interface AppTileProps {
  app: PortalAppItem;
  isFavorite: boolean;
  onToggleFavorite: (app: PortalAppItem, e: React.MouseEvent) => void;
}

const AppTile: React.FC<AppTileProps> = ({ app, isFavorite, onToggleFavorite }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [app.logoUrl]);

  const showLogoImg = Boolean(app.logoUrl && !imgFailed);
  const domainLabel = getDomainLabel(app.url);

  return (
    <div className="group relative flex flex-col items-center">
      <div className="relative">
        <a
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${app.name} (${domainLabel})`}
          className="flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-[24px]"
        >
          <div
            className={`w-[68px] h-[68px] sm:w-[76px] sm:h-[76px] rounded-[22px] sm:rounded-[24px] flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95 shadow-sm border ${
              showLogoImg
                ? 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700 p-2'
                : `bg-gradient-to-br ${getGradientForId(app.id)} border-transparent text-white`
            }`}
          >
            {showLogoImg ? (
              <img
                src={app.logoUrl}
                alt={app.name}
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-contain rounded-[14px]"
              />
            ) : (
              <span className="text-lg sm:text-xl font-extrabold tracking-tight select-none">
                {getAppInitials(app.name)}
              </span>
            )}
          </div>
        </a>

        {/* Corner Favorite Star Toggle (Independent 32x32px target) */}
        <button
          type="button"
          onClick={e => onToggleFavorite(app, e)}
          aria-label={isFavorite ? `Bỏ ${app.name} khỏi yêu thích` : `Thêm ${app.name} vào yêu thích`}
          title={isFavorite ? 'Bỏ khỏi mục yêu thích' : 'Thêm vào mục yêu thích'}
          className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs border ${
            isFavorite
              ? 'bg-amber-400 border-amber-500 text-slate-950 scale-100 opacity-100'
              : 'bg-white/95 dark:bg-slate-800/95 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-amber-500 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-slate-950' : ''}`} />
        </button>
      </div>

      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 w-full max-w-[104px] text-center space-y-0.5 focus:outline-none"
      >
        <div className="text-xs sm:text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
          {app.name}
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate inline-flex items-center justify-center gap-0.5 max-w-full">
          <span className="truncate">{domainLabel}</span>
          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </a>
    </div>
  );
};

export const AppsLauncherView: React.FC<AppsLauncherViewProps> = ({
  settings,
  onOpenAdminAppsSetup,
}) => {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavoriteIds);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const allActiveApps = useMemo(() => {
    const raw = Array.isArray(settings.portalApps) ? settings.portalApps : [];
    return raw
      .filter(app => app && app.isActive !== false && app.name && app.url)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  }, [settings.portalApps]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const categories = useMemo(
    () =>
      resolvePortalAppCategories({
        portalApps: allActiveApps,
        portalAppCategories: settings.portalAppCategories,
      }),
    [allActiveApps, settings.portalAppCategories]
  );

  const handleToggleFavorite = (app: PortalAppItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteIds(prev => {
      const exists = prev.includes(app.id);
      const next = exists ? prev.filter(id => id !== app.id) : [app.id, ...prev];
      try {
        localStorage.setItem(FAVORITE_APPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      showToast(
        exists ? 'info' : 'success',
        exists ? `Đã bỏ "${app.name}" khỏi Yêu thích` : `Đã thêm "${app.name}" vào Yêu thích`
      );
      return next;
    });
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (app: PortalAppItem) => {
    if (!normalizedQuery) return true;
    return (
      app.name.toLowerCase().includes(normalizedQuery) ||
      (app.category || '').toLowerCase().includes(normalizedQuery) ||
      getDomainLabel(app.url).toLowerCase().includes(normalizedQuery)
    );
  };

  const favoriteApps = useMemo(
    () => allActiveApps.filter(app => favoriteSet.has(app.id) && matchesSearch(app)),
    [allActiveApps, favoriteSet, normalizedQuery]
  );

  const filteredApps = useMemo(() => {
    return allActiveApps.filter(app => {
      if (!matchesSearch(app)) return false;
      if (activeFilter === 'favorites') return favoriteSet.has(app.id);
      if (activeFilter !== 'all') {
        const appCat = (app.category || '').trim() || 'Khác';
        return appCat === activeFilter;
      }
      return true;
    });
  }, [allActiveApps, activeFilter, favoriteSet, normalizedQuery]);

  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6 animate-in fade-in duration-200">
      {/* Header & Search */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
              <LayoutGrid className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Ứng Dụng Y Tế &amp; Tiện Ích Số
              </h1>
              <p className="hidden sm:block text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Chạm biểu tượng để mở nhanh dịch vụ y tế, cổng công dân hoặc ghim ứng dụng vào mục yêu thích
              </p>
            </div>
          </div>

          {isAdmin && onOpenAdminAppsSetup && (
            <button
              type="button"
              onClick={onOpenAdminAppsSetup}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 min-h-[44px]"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Cấu hình Ứng dụng</span>
            </button>
          )}
        </div>

        {/* Search & Filter Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm tên ứng dụng hoặc đường dẫn..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {(() => {
            const totalFilters = 2 + categories.length;
            return (
              <div className={`${getBalancedMobileGridClass(totalFilters)} p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80`}>
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`${getBalancedMobileItemSpan(0, totalFilters)} min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer text-center ${
                    activeFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Tất cả ({allActiveApps.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('favorites')}
                  className={`${getBalancedMobileItemSpan(1, totalFilters)} min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    activeFilter === 'favorites'
                      ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 shrink-0 ${favoriteApps.length > 0 ? 'fill-amber-400 text-amber-500' : ''}`} />
                  <span>Yêu thích ({allActiveApps.filter(a => favoriteSet.has(a.id)).length})</span>
                </button>
                {categories.map((cat, idx) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveFilter(cat)}
                    className={`${getBalancedMobileItemSpan(2 + idx, totalFilters)} min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer text-center truncate ${
                      activeFilter === cat
                        ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Favorites Dock Section (visible when user has favorites and filter is 'all') */}
      {activeFilter === 'all' && favoriteApps.length > 0 && (
        <section className="p-6 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FolderHeart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Ứng dụng yêu thích của bạn
              </h2>
            </div>
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300 tabular-nums">
              {favoriteApps.length} đã ghim
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-6">
            {favoriteApps.map(app => (
              <AppTile
                key={`fav-${app.id}`}
                app={app}
                isFavorite={true}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {/* Main App Launcher Grid */}
      <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {activeFilter === 'favorites'
                ? 'Danh sách Ứng dụng Yêu thích'
                : activeFilter === 'all'
                ? 'Kho Ứng dụng Trạm Y Tế'
                : activeFilter}
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {filteredApps.length} ứng dụng
          </span>
        </div>

        {filteredApps.length === 0 ? (
          <div className="py-12 text-center space-y-3 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              {activeFilter === 'favorites' ? (
                <Star className="w-7 h-7" />
              ) : (
                <LayoutGrid className="w-7 h-7" />
              )}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activeFilter === 'favorites'
                ? 'Chưa có ứng dụng yêu thích nào'
                : allActiveApps.length === 0
                ? 'Chưa có ứng dụng nào được cấu hình'
                : 'Không tìm thấy ứng dụng phù hợp'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {activeFilter === 'favorites'
                ? 'Nhấn biểu tượng ngôi sao ở góc trên mỗi ứng dụng để ghim vào mục yêu thích cho lần truy cập sau.'
                : allActiveApps.length === 0
                ? isAdmin
                  ? 'Nhấn "Cấu hình Ứng dụng" để thêm tên, link và tự động lấy logo từ website.'
                  : 'Quản trị viên đang cập nhật danh sách các ứng dụng và cổng dịch vụ y tế.'
                : 'Thử từ khóa khác hoặc chuyển về bộ lọc Tất cả.'}
            </p>
            {activeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                Xem tất cả ứng dụng
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-7 pt-1">
            {filteredApps.map(app => (
              <AppTile
                key={app.id}
                app={app}
                isFavorite={favoriteSet.has(app.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
