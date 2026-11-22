import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Shield,
  ShieldCheck,
  BellRing,
  PartyPopper,
  LayoutGrid,
  Syringe,
  CalendarClock,
  Briefcase,
  Building,
  Network,
  FileText,
  MapPin,
  Hospital,
  Globe,
  MessageSquare,
  Star,
  Users,
  Database,
  FolderGit2,
  Wrench,
  CreditCard,
  Sparkles,
  Activity,
  Lock,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Sun,
  Moon,
  RotateCw,
  LogOut,
  ExternalLink,
  Building2,
  Search,
  Clock,
  FolderOpen,
  Trash2,
  Ticket,
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { StationLogo } from '../common/StationLogo';
import { UserAvatar } from '../common/UserAvatar';

export type AdminSubTab =
  | 'dashboard'
  | 'notifications'
  | 'events_setup'
  | 'apps_setup'
  | 'vaccination_setup'
  | 'work_holiday_setup'
  | 'business_trip_setup'
  | 'station_setup'
  | 'org_personnel'
  | 'functions_duties'
  | 'map_locations'
  | 'nearby_facilities'
  | 'footer_links'
  | 'feedback'
  | 'ratings'
  | 'users'
  | 'referral_codes'
  | 'org_accounts'
  | 'backup'
  | 'github_storage'
  | 'audit'
  | 'system_control'
  | 'bhxh_api'
  | 'ai_automation'
  | 'diagnostics'
  | 'firebase_config';

export interface AdminNavItem {
  id: AdminSubTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badgeCount?: number;
  keywords?: string[];
}

export interface AdminNavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AdminNavItem[];
}

export function buildAdminNavGroups(counts?: {
  newFeedback?: number;
  disputedMigrations?: number;
  ratingsCount?: number;
}): AdminNavGroup[] {
  return [
    {
      id: 'dashboard_group',
      title: 'Tổng quan hệ thống',
      icon: LayoutGrid,
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard Thống kê',
          shortLabel: 'Dashboard',
          icon: LayoutGrid,
          keywords: ['dashboard', 'thống kê', 'tổng quan', 'analytics', 'metrics', 'tổng hợp'],
        },
      ],
    },
    {
      id: 'operations',
      title: 'Điều hành & Công dân',
      icon: Activity,
      items: [
        {
          id: 'feedback',
          label: 'Xử lý Phản ánh',
          shortLabel: 'Phản ánh',
          icon: MessageSquare,
          badgeCount: counts?.newFeedback,
          keywords: ['phản ánh', 'kiến nghị', 'góp ý', 'khiếu nại', 'công dân', 'trả lời'],
        },
        {
          id: 'notifications',
          label: 'Thông báo',
          shortLabel: 'Thông báo',
          icon: BellRing,
          keywords: ['thông báo', 'popup', 'banner', 'khẩn', 'gửi thông báo', 'tiêm chủng'],
        },
        {
          id: 'ratings',
          label: 'Đánh giá',
          shortLabel: 'Đánh giá',
          icon: Star,
          badgeCount: counts?.ratingsCount,
          keywords: ['đánh giá', 'sao', 'nhận xét', 'hài lòng', 'rating'],
        },
      ],
    },
    {
      id: 'schedules',
      title: 'Lịch',
      icon: CalendarClock,
      items: [
        {
          id: 'work_holiday_setup',
          label: 'Lịch Trực, Làm việc & Lễ',
          shortLabel: 'Lịch trực & Lễ',
          icon: CalendarClock,
          keywords: ['lịch trực', 'chấm công', 'giờ làm việc', 'nghỉ lễ', 'ca trực', 'nhân sự'],
        },
        {
          id: 'business_trip_setup',
          label: 'Lịch & Cấu hình Công tác',
          shortLabel: 'Lịch công tác',
          icon: Briefcase,
          keywords: ['công tác', 'lịch công tác', 'cán bộ', 'địa điểm', 'cấu hình công tác'],
        },
        {
          id: 'vaccination_setup',
          label: 'Lịch Tiêm chủng',
          shortLabel: 'Tiêm chủng',
          icon: Syringe,
          keywords: ['tiêm chủng', 'vaccine', 'vắc-xin', 'mở rộng', 'điểm tiêm'],
        },
        {
          id: 'events_setup',
          label: 'Sự kiện & Ngày lễ',
          shortLabel: 'Sự kiện',
          icon: PartyPopper,
          keywords: ['sự kiện', 'ngày lễ', 'pháo giấy', 'import excel', 'chúc mừng'],
        },
      ],
    },
    {
      id: 'organization',
      title: 'Tổ chức, Địa bàn & Tiện ích',
      icon: Building2,
      items: [
        {
          id: 'station_setup',
          label: 'Thông tin Đơn vị & Cấp cứu',
          shortLabel: 'Thông tin trạm',
          icon: Building,
          keywords: ['tên trạm', 'địa chỉ', 'hotline', 'cấp cứu', 'số điện thoại', 'logo'],
        },
        {
          id: 'org_personnel',
          label: 'Sơ đồ Tổ chức',
          shortLabel: 'Nhân sự',
          icon: Network,
          keywords: ['sơ đồ tổ chức', 'nhân sự', 'khoa phòng', 'bác sĩ', 'trưởng trạm'],
        },
        {
          id: 'map_locations',
          label: 'Bản đồ',
          shortLabel: 'Bản đồ',
          icon: MapPin,
          keywords: ['bản đồ', 'tọa độ', 'gps', 'điểm trạm', 'trụ sở chính', 'dịch bệnh', 'sốt xuất huyết', 'khoanh vùng', 'ca bệnh'],
        },
        {
          id: 'nearby_facilities',
          label: 'Cơ sở Y tế lân cận',
          shortLabel: 'CSYT lân cận',
          icon: Hospital,
          adminOnly: true,
          keywords: ['bệnh viện', 'phòng khám', 'cơ sở y tế', 'lân cận', 'duyệt'],
        },
        {
          id: 'functions_duties',
          label: 'Chức năng - Nhiệm vụ',
          shortLabel: 'Chức năng',
          icon: FileText,
          keywords: ['chức năng', 'nhiệm vụ', 'giới thiệu', 'quy chế'],
        },
        {
          id: 'apps_setup',
          label: 'Menu Ứng dụng',
          shortLabel: 'Ứng dụng',
          icon: LayoutGrid,
          adminOnly: true,
          keywords: ['ứng dụng', 'app', 'import', 'excel', 'danh mục', 'vneid', 'logo'],
        },
        {
          id: 'footer_links',
          label: 'Footer & Liên kết',
          shortLabel: 'Footer',
          icon: Globe,
          keywords: ['footer', 'chân trang', 'liên kết', 'mạng xã hội', 'zalo', 'facebook'],
        },
      ],
    },
    {
      id: 'citizens_users',
      title: 'Tài khoản',
      icon: Users,
      items: [
        {
          id: 'users',
          label: 'Tài khoản, Phân quyền',
          shortLabel: 'Tài khoản',
          icon: Users,
          badgeCount: counts?.disputedMigrations,
          keywords: ['tài khoản', 'người dùng', 'user', 'phân quyền', 'di trú', 'khóa', 'xác minh'],
        },
        {
          id: 'referral_codes',
          label: 'Link & Mã Giới Thiệu',
          shortLabel: 'Link & Mã giới thiệu',
          icon: Ticket,
          adminOnly: true,
          keywords: [
            'mã giới thiệu',
            'link giới thiệu',
            'liên kết mời',
            'super admin',
            'admin',
            'cán bộ',
            'referral',
            'invite',
          ],
        },
        {
          id: 'org_accounts',
          label: 'Tài khoản Doanh nghiệp',
          shortLabel: 'Tổ chức & DN',
          icon: Building2,
          adminOnly: true,
          keywords: ['doanh nghiệp', 'tổ chức', 'trường học', 'cơ quan', 'mã giới thiệu'],
        },
        {
          id: 'system_control',
          label: 'Bảo trì, Quyền & Chặn Tab',
          shortLabel: 'Điều khiển',
          icon: Wrench,
          adminOnly: true,
          keywords: [
            'bảo trì',
            'chặn tab',
            'ẩn tab',
            'quyền truy cập',
            'giới hạn thiết bị',
            'tra cứu cccd',
            'cccd',
            'bảo mật dữ liệu',
            'dữ liệu dân cư',
            'bản đồ dịch bệnh',
            'dịch bệnh',
            'sốt xuất huyết',
          ],
        },
      ],
    },
    {
      id: 'backup_storage',
      title: 'Sao lưu, Lưu trữ',
      icon: Database,
      items: [
        {
          id: 'backup',
          label: 'Sao lưu & Di trú Firebase',
          shortLabel: 'Sao lưu',
          icon: Database,
          adminOnly: true,
          keywords: ['sao lưu', 'backup', 'khôi phục', 'restore', 'di trú', 'firebase', 'github'],
        },
        {
          id: 'github_storage',
          label: 'GitHub PAT',
          shortLabel: 'GitHub PAT',
          icon: FolderGit2,
          adminOnly: true,
          keywords: ['github', 'pat', 'token', 'kho tệp', 'lưu trữ', 'repo'],
        },
        {
          id: 'audit',
          label: 'Nhật ký',
          shortLabel: 'Kiểm toán',
          icon: Shield,
          adminOnly: true,
          keywords: ['nhật ký', 'kiểm toán', 'audit', 'log', 'lịch sử thao tác'],
        },
      ],
    },
    {
      id: 'system_tech',
      title: 'Tích hợp API',
      icon: ShieldCheck,
      items: [
        {
          id: 'ai_automation',
          label: 'Agent AI',
          shortLabel: 'Agent AI',
          icon: Sparkles,
          adminOnly: true,
          keywords: ['ai', 'gemini', 'agent', 'api key', 'tự động', 'tin tức'],
        },
        {
          id: 'bhxh_api',
          label: 'Kết nối API BHXH',
          shortLabel: 'API BHXH',
          icon: CreditCard,
          adminOnly: true,
          keywords: ['bhxh', 'bhyt', 'bảo hiểm y tế', 'cổng giám định'],
        },
        {
          id: 'diagnostics',
          label: 'Vercel',
          shortLabel: 'Chẩn đoán',
          icon: Activity,
          adminOnly: true,
          keywords: ['chẩn đoán', 'vercel', 'rss', 'diagnostics', 'lỗi', 'hệ thống'],
        },
        {
          id: 'firebase_config',
          label: 'Cấu hình Firebase',
          shortLabel: 'Firebase Config',
          icon: Lock,
          adminOnly: true,
          keywords: ['firebase', 'cấu hình', 'project id', 'database'],
        },
      ],
    },
  ];
}

const ADMIN_SEARCH_HISTORY_KEY = 'tyt_admin_search_history_v1';

interface AdminSearchHistoryEntry {
  id: string;
  kind: 'item' | 'category';
  label: string;
  subLabel?: string;
  query: string;
  tabId: AdminSubTab;
  groupId: string;
  timestamp: number;
}

function normalizeViSearch(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadAdminSearchHistory(): AdminSearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(ADMIN_SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

interface AdminShellProps {
  settings: SystemSettings;
  activeSubTab: AdminSubTab;
  onSelectSubTab: (tab: AdminSubTab) => void;
  onExitAdmin: () => void;
  onRefreshData: () => void;
  counts?: {
    newFeedback?: number;
    disputedMigrations?: number;
    ratingsCount?: number;
  };
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  settings,
  activeSubTab,
  onSelectSubTab,
  onExitAdmin,
  onRefreshData,
  counts,
  children,
}) => {
  const { currentUser, userProfile, isPrimaryAdmin, isSuperAdmin, isAdmin, logout } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<{
    label: string;
    badge?: string | number;
    top: number;
    left: number;
    isDanger?: boolean;
  } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Quick search bar + search history state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<AdminSearchHistoryEntry[]>(loadAdminSearchHistory);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!sidebarCollapsed) {
      setHoveredNav(null);
    }
  }, [sidebarCollapsed]);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const saved = localStorage.getItem('tyt_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try {
      localStorage.setItem('tyt_theme', isDarkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [isDarkMode]);

  const groups = useMemo(() => {
    const raw = buildAdminNavGroups(counts);
    return raw
      .map(g => ({
        ...g,
        items: g.items.filter(item => !item.adminOnly || isAdmin),
      }))
      .filter(g => g.items.length > 0);
  }, [counts, isAdmin]);

  const activeGroup = useMemo(
    () => groups.find(g => g.items.some(i => i.id === activeSubTab)) || groups[0],
    [groups, activeSubTab]
  );

  const activeItem = useMemo(
    () => activeGroup?.items.find(i => i.id === activeSubTab) || activeGroup?.items[0],
    [activeGroup, activeSubTab]
  );

  const colorSidebarEnabled = Boolean(settings.sidebarColors?.adminEnabled);

  const adminGroupColorMap: Record<
    string,
    {
      headerIdle: string;
      headerActive: string;
      borderLeft: string;
      activeItem: string;
      hoverItem: string;
      itemIcon: string;
      groupIcon: string;
    }
  > = {
    dashboard_group: {
      headerIdle:
        'text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/25 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/45',
      headerActive:
        'text-emerald-900 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/60 ring-1 ring-emerald-200/80 dark:ring-emerald-800/60',
      borderLeft: 'border-emerald-300 dark:border-emerald-800',
      activeItem: 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:text-emerald-900 dark:hover:text-emerald-200',
      itemIcon: 'text-emerald-600 dark:text-emerald-400',
      groupIcon: 'text-emerald-600 dark:text-emerald-400',
    },
    operations: {
      headerIdle:
        'text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/25 hover:bg-blue-100/70 dark:hover:bg-blue-950/45',
      headerActive:
        'text-blue-900 dark:text-blue-200 bg-blue-100/90 dark:bg-blue-950/60 ring-1 ring-blue-200/80 dark:ring-blue-800/60',
      borderLeft: 'border-blue-300 dark:border-blue-800',
      activeItem: 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 hover:text-blue-900 dark:hover:text-blue-200',
      itemIcon: 'text-blue-600 dark:text-blue-400',
      groupIcon: 'text-blue-600 dark:text-blue-400',
    },
    schedules: {
      headerIdle:
        'text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/25 hover:bg-amber-100/70 dark:hover:bg-amber-950/45',
      headerActive:
        'text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-950/60 ring-1 ring-amber-200/80 dark:ring-amber-800/60',
      borderLeft: 'border-amber-300 dark:border-amber-800',
      activeItem: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 hover:text-amber-900 dark:hover:text-amber-200',
      itemIcon: 'text-amber-600 dark:text-amber-400',
      groupIcon: 'text-amber-600 dark:text-amber-400',
    },
    organization: {
      headerIdle:
        'text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/25 hover:bg-teal-100/70 dark:hover:bg-teal-950/45',
      headerActive:
        'text-teal-900 dark:text-teal-200 bg-teal-100/90 dark:bg-teal-950/60 ring-1 ring-teal-200/80 dark:ring-teal-800/60',
      borderLeft: 'border-teal-300 dark:border-teal-800',
      activeItem: 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-teal-50/80 dark:hover:bg-teal-950/40 hover:text-teal-900 dark:hover:text-teal-200',
      itemIcon: 'text-teal-600 dark:text-teal-400',
      groupIcon: 'text-teal-600 dark:text-teal-400',
    },
    citizens_users: {
      headerIdle:
        'text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-950/25 hover:bg-violet-100/70 dark:hover:bg-violet-950/45',
      headerActive:
        'text-violet-900 dark:text-violet-200 bg-violet-100/90 dark:bg-violet-950/60 ring-1 ring-violet-200/80 dark:ring-violet-800/60',
      borderLeft: 'border-violet-300 dark:border-violet-800',
      activeItem: 'bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-violet-50/80 dark:hover:bg-violet-950/40 hover:text-violet-900 dark:hover:text-violet-200',
      itemIcon: 'text-violet-600 dark:text-violet-400',
      groupIcon: 'text-violet-600 dark:text-violet-400',
    },
    backup_storage: {
      headerIdle:
        'text-cyan-700 dark:text-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/25 hover:bg-cyan-100/70 dark:hover:bg-cyan-950/45',
      headerActive:
        'text-cyan-900 dark:text-cyan-200 bg-cyan-100/90 dark:bg-cyan-950/60 ring-1 ring-cyan-200/80 dark:ring-cyan-800/60',
      borderLeft: 'border-cyan-300 dark:border-cyan-800',
      activeItem: 'bg-gradient-to-r from-cyan-600 to-sky-700 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-cyan-50/80 dark:hover:bg-cyan-950/40 hover:text-cyan-900 dark:hover:text-cyan-200',
      itemIcon: 'text-cyan-600 dark:text-cyan-400',
      groupIcon: 'text-cyan-600 dark:text-cyan-400',
    },
    system_tech: {
      headerIdle:
        'text-rose-700 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/25 hover:bg-rose-100/70 dark:hover:bg-rose-950/45',
      headerActive:
        'text-rose-900 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-950/60 ring-1 ring-rose-200/80 dark:ring-rose-800/60',
      borderLeft: 'border-rose-300 dark:border-rose-800',
      activeItem: 'bg-gradient-to-r from-rose-600 to-pink-700 text-white shadow-xs font-bold',
      hoverItem:
        'text-slate-700 dark:text-slate-300 hover:bg-rose-50/80 dark:hover:bg-rose-950/40 hover:text-rose-900 dark:hover:text-rose-200',
      itemIcon: 'text-rose-600 dark:text-rose-400',
      groupIcon: 'text-rose-600 dark:text-rose-400',
    },
  };

  // Exclusive accordion open state: only active group open by default
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (activeGroup) initial[activeGroup.id] = true;
    return initial;
  });

  useEffect(() => {
    if (activeGroup) {
      setOpenGroups({ [activeGroup.id]: true });
    }
  }, [activeGroup?.id]);

  // Close search dropdown on outside click & handle Ctrl+K shortcut
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === 'Escape' && searchFocused) {
        setSearchFocused(false);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleGlobalKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleGlobalKey);
    };
  }, [searchFocused]);

  const searchResults = useMemo(() => {
    const qNorm = normalizeViSearch(searchQuery);
    if (!qNorm) return { categories: [] as AdminNavGroup[], items: [] as Array<{ item: AdminNavItem; group: AdminNavGroup }> };

    const matchingCategories = groups.filter(g => normalizeViSearch(g.title).includes(qNorm));
    const matchingItems: Array<{ item: AdminNavItem; group: AdminNavGroup }> = [];
    groups.forEach(group => {
      group.items.forEach(item => {
        const haystack = normalizeViSearch(
          [item.label, item.shortLabel, group.title, ...(item.keywords || [])].join(' ')
        );
        if (haystack.includes(qNorm)) {
          matchingItems.push({ item, group });
        }
      });
    });
    return { categories: matchingCategories, items: matchingItems };
  }, [groups, searchQuery]);

  const pushSearchHistory = (entry: Omit<AdminSearchHistoryEntry, 'id' | 'timestamp'>) => {
    setSearchHistory(prev => {
      const filtered = prev.filter(
        h => !(h.kind === entry.kind && h.tabId === entry.tabId && h.groupId === entry.groupId)
      );
      const next: AdminSearchHistoryEntry[] = [
        { ...entry, id: `${entry.kind}_${entry.tabId}_${Date.now()}`, timestamp: Date.now() },
        ...filtered,
      ].slice(0, 8);
      try {
        localStorage.setItem(ADMIN_SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const removeSearchHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      try {
        localStorage.setItem(ADMIN_SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const clearAllSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(ADMIN_SEARCH_HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => (prev[id] ? {} : { [id]: true }));
  };

  const handleSelectItem = (tabId: AdminSubTab) => {
    onSelectSubTab(tabId);
    setMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpFromSearch = (
    tabId: AdminSubTab,
    groupId: string,
    kind: 'item' | 'category',
    label: string,
    subLabel?: string
  ) => {
    setOpenGroups({ [groupId]: true });
    pushSearchHistory({
      kind,
      label,
      subLabel,
      query: searchQuery.trim() || label,
      tabId,
      groupId,
    });
    setSearchFocused(false);
    setSearchQuery('');
    handleSelectItem(tabId);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefreshData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const roleBadgeLabel =
    isSuperAdmin || isPrimaryAdmin ? 'Super Admin' : isAdmin ? 'Quản trị viên' : 'Cán bộ';

  const isDesktopCollapsed = sidebarCollapsed;

  const renderSidebarBody = (isMobile = false) => {
    const collapsed = isDesktopCollapsed && !isMobile;

    return (
      <div className="flex flex-col h-full">
        {/* Admin Brand Header */}
        <div
          className={`h-16 ${
            collapsed ? 'px-3 justify-center' : 'px-4 justify-between'
          } border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0 bg-slate-900 text-white`}
        >
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1 rounded-xl bg-white shrink-0">
                  <StationLogo size={32} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold tracking-wide uppercase text-emerald-400 truncate">
                    Hệ Thống Quản Trị
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {settings.stationName && !settings.stationName.includes('Chưa cấu hình')
                      ? settings.stationName
                      : 'Cổng Thông Tin Y Tế'}
                  </div>
                </div>
              </div>

              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                  aria-label="Đóng menu quản trị"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                  title="Thu gọn thanh bên"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              onMouseEnter={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredNav({
                  label: 'Mở rộng Sidebar',
                  top: rect.top + rect.height / 2,
                  left: rect.right + 12,
                });
              }}
              onMouseLeave={() => setHoveredNav(null)}
              className="mx-auto p-2 rounded-xl bg-slate-800 text-emerald-400 hover:bg-slate-700 hover:text-emerald-300 transition shadow-xs cursor-pointer"
              aria-label="Mở rộng Sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Back to Public Portal Quick Switch */}
        <div
          className={`${
            collapsed ? 'px-2.5 py-2.5' : 'p-3'
          } border-b border-slate-200 dark:border-slate-800 bg-emerald-50/70 dark:bg-emerald-950/30`}
        >
          <button
            type="button"
            onClick={() => {
              setHoveredNav(null);
              setMobileDrawerOpen(false);
              onExitAdmin();
            }}
            onMouseEnter={e => {
              if (!collapsed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredNav({
                label: 'Về Cổng Công Khai',
                top: rect.top + rect.height / 2,
                left: rect.right + 12,
              });
            }}
            onMouseLeave={() => setHoveredNav(null)}
            onFocus={e => {
              if (!collapsed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredNav({
                label: 'Về Cổng Công Khai',
                top: rect.top + rect.height / 2,
                left: rect.right + 12,
              });
            }}
            onBlur={() => setHoveredNav(null)}
            className={`w-full min-h-[40px] ${
              collapsed ? 'px-2 justify-center' : 'px-3 justify-between'
            } py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs`}
            title={!collapsed ? 'Chuyển sang Trang Công Khai (Trang bình thường)' : undefined}
            aria-label="Về Cổng Công Khai"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <ArrowLeft className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate whitespace-nowrap">Về Cổng Công Khai</span>}
            </span>
            {!collapsed && <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-75" />}
          </button>
        </div>

        {/* Grouped Admin Navigation */}
        <nav
          aria-label="Điều hướng Quản trị viên"
          onScroll={() => setHoveredNav(null)}
          className={`flex-1 overflow-y-auto px-2.5 py-4 ${
            collapsed ? 'no-scrollbar overflow-x-hidden space-y-2' : 'space-y-2.5'
          }`}
        >
          {groups.map((group, gIdx) => {
            const GroupIcon = group.icon;
            const isGroupOpen = collapsed ? true : Boolean(openGroups[group.id]);
            const hasActive = group.items.some(it => it.id === activeSubTab);
            const palette = colorSidebarEnabled ? adminGroupColorMap[group.id] : undefined;

            return (
              <div key={group.id} className="space-y-1">
                {collapsed && gIdx > 0 && (
                  <div className="mx-2 my-1.5 h-px bg-slate-200/80 dark:bg-slate-800" />
                )}

                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isGroupOpen}
                    className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-wider transition cursor-pointer ${
                      palette
                        ? hasActive || isGroupOpen
                          ? palette.headerActive
                          : palette.headerIdle
                        : hasActive
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {GroupIcon && (
                        <GroupIcon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            palette ? palette.groupIcon : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                      )}
                      <span className="truncate text-left">{group.title}</span>
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        isGroupOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}

                {isGroupOpen && (
                  <div
                    className={
                      collapsed
                        ? 'space-y-1'
                        : palette
                        ? `space-y-1 pl-1.5 ml-2 border-l ${palette.borderLeft}`
                        : 'space-y-1 pl-0.5'
                    }
                  >
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const isActive = item.id === activeSubTab;
                      const badgeText =
                        typeof item.badgeCount === 'number' && item.badgeCount > 0
                          ? item.badgeCount
                          : undefined;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setHoveredNav(null);
                            handleSelectItem(item.id);
                          }}
                          onMouseEnter={e => {
                            if (!collapsed) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredNav({
                              label: item.label,
                              badge: badgeText,
                              top: rect.top + rect.height / 2,
                              left: rect.right + 12,
                            });
                          }}
                          onMouseLeave={() => setHoveredNav(null)}
                          onFocus={e => {
                            if (!collapsed) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredNav({
                              label: item.label,
                              badge: badgeText,
                              top: rect.top + rect.height / 2,
                              left: rect.right + 12,
                            });
                          }}
                          onBlur={() => setHoveredNav(null)}
                          title={!collapsed ? item.label : undefined}
                          aria-label={item.label}
                          className={`w-full min-h-[40px] ${
                            collapsed ? 'justify-center px-2' : 'justify-between px-3'
                          } py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                            isActive
                              ? palette
                                ? palette.activeItem
                                : 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs font-bold'
                              : palette
                              ? palette.hoverItem
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                isActive
                                  ? palette
                                    ? 'text-white'
                                    : 'text-emerald-400 dark:text-white'
                                  : palette
                                  ? palette.itemIcon
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            />
                            {!collapsed && (
                              <span className="truncate text-left">{item.shortLabel}</span>
                            )}
                          </span>
                          {!collapsed && badgeText !== undefined && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums shrink-0 ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {badgeText}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Bottom User Footer */}
        {currentUser && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 shrink-0">
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
              {!collapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar
                    src={userProfile?.avatarUrl || currentUser.photoURL}
                    name={userProfile?.displayName || currentUser.email || 'Admin'}
                    size={34}
                    isPrimaryAdmin={isPrimaryAdmin || isSuperAdmin}
                    rounded="xl"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {userProfile?.displayName || currentUser.email}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      {roleBadgeLabel}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => void logout()}
                onMouseEnter={e => {
                  if (!collapsed) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredNav({
                    label: 'Đăng xuất',
                    top: rect.top + rect.height / 2,
                    left: rect.right + 12,
                    isDanger: true,
                  });
                }}
                onMouseLeave={() => setHoveredNav(null)}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer shrink-0"
                title={!collapsed ? 'Đăng xuất' : undefined}
                aria-label="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Dedicated Admin Sidebar */}
      <aside
        className={`hidden lg:flex flex-col sticky top-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 transition-all duration-300 z-30 select-none shadow-xs ${
          sidebarCollapsed ? 'w-16' : 'w-72'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) setMobileDrawerOpen(false);
          }}
        >
          <aside className="w-[288px] max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}

      {/* Main Standalone Admin Viewport */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-clip">
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-2.5 space-y-2 md:space-y-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 md:flex-initial md:max-w-[260px] lg:max-w-[300px]">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                aria-label="Mở menu quản trị"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {activeGroup?.icon ? (
                    <activeGroup.icon className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{activeGroup?.title || 'Bảng Quản Trị'}</span>
                </div>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                  {activeItem?.label || 'Quản Trị Hệ Thống'}
                </h1>
              </div>
            </div>

            {/* Quick Search Bar (Functions & Categories + History) */}
            <div ref={searchBoxRef} className="relative hidden md:block flex-1 max-w-md mx-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setSearchFocused(true);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchResults.items.length > 0) {
                        const first = searchResults.items[0];
                        handleJumpFromSearch(
                          first.item.id,
                          first.group.id,
                          'item',
                          first.item.label,
                          first.group.title
                        );
                      } else if (searchResults.categories.length > 0) {
                        const cat = searchResults.categories[0];
                        if (cat.items[0]) {
                          handleJumpFromSearch(
                            cat.items[0].id,
                            cat.id,
                            'category',
                            cat.title,
                            `${cat.items.length} chức năng`
                          );
                        }
                      }
                    }
                  }}
                  placeholder="Tìm nhanh chức năng, danh mục... (Ctrl+K)"
                  className="w-full pl-9 pr-14 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white dark:focus:bg-slate-800 transition"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Xóa từ khóa"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    Ctrl+K
                  </kbd>
                )}
              </div>

              {/* Search Dropdown */}
              {searchFocused && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden z-50 max-h-[70vh] flex flex-col">
                  <div className="overflow-y-auto p-2.5 space-y-3">
                    {!searchQuery.trim() ? (
                      <>
                        {searchHistory.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Lịch sử tìm kiếm gần đây</span>
                              </span>
                              <button
                                type="button"
                                onClick={clearAllSearchHistory}
                                className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline normal-case font-semibold cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa lịch sử</span>
                              </button>
                            </div>
                            <div className="space-y-0.5">
                              {searchHistory.map(h => (
                                <div
                                  key={h.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() =>
                                    handleJumpFromSearch(h.tabId, h.groupId, h.kind, h.label, h.subLabel)
                                  }
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleJumpFromSearch(h.tabId, h.groupId, h.kind, h.label, h.subLabel);
                                    }
                                  }}
                                  className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                      {h.label}
                                    </span>
                                    {h.subLabel && (
                                      <span className="text-[11px] text-slate-400 truncate">
                                        · {h.subLabel}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={e => removeSearchHistoryItem(h.id, e)}
                                    title="Xóa khỏi lịch sử"
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 opacity-70 group-hover:opacity-100 cursor-pointer shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Danh mục quản trị ({groups.length})
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 px-1">
                            {groups.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  if (cat.items[0]) {
                                    handleJumpFromSearch(
                                      cat.items[0].id,
                                      cat.id,
                                      'category',
                                      cat.title,
                                      `${cat.items.length} chức năng`
                                    );
                                  }
                                }}
                                className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/70 text-left transition cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {cat.icon && (
                                    <cat.icon className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  )}
                                  <span className="truncate">{cat.title}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  {cat.items.length} chức năng
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : searchResults.categories.length === 0 && searchResults.items.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Không tìm thấy chức năng hoặc danh mục phù hợp với &quot;{searchQuery}&quot;
                      </div>
                    ) : (
                      <>
                        {searchResults.categories.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              Danh mục ({searchResults.categories.length})
                            </div>
                            {searchResults.categories.map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  if (cat.items[0]) {
                                    handleJumpFromSearch(
                                      cat.items[0].id,
                                      cat.id,
                                      'category',
                                      cat.title,
                                      `${cat.items.length} chức năng`
                                    );
                                  }
                                }}
                                className="w-full px-2.5 py-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-2 text-xs text-left cursor-pointer"
                              >
                                <span className="inline-flex items-center gap-2 min-w-0 font-bold text-slate-900 dark:text-white">
                                  <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span className="truncate">{cat.title}</span>
                                </span>
                                <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                                  {cat.items.length} mục
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {searchResults.items.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Chức năng ({searchResults.items.length})
                            </div>
                            {searchResults.items.map(({ item, group }) => {
                              const Icon = item.icon;
                              const isCurrent = item.id === activeSubTab;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    handleJumpFromSearch(
                                      item.id,
                                      group.id,
                                      'item',
                                      item.label,
                                      group.title
                                    )
                                  }
                                  className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-xs text-left cursor-pointer transition ${
                                    isCurrent
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-2.5 min-w-0">
                                    <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span className="min-w-0">
                                      <span className="font-bold block truncate">{item.label}</span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        {group.title}
                                      </span>
                                    </span>
                                  </span>
                                  {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold tabular-nums shrink-0">
                                      {item.badgeCount}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onExitAdmin}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Trang công khai</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDarkMode(v => !v)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title={isDarkMode ? 'Giao diện sáng' : 'Giao diện tối'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className={`p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ${
                  isRefreshing ? 'animate-spin text-emerald-600' : ''
                }`}
                title="Làm mới dữ liệu quản trị"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Quick Search Input Row */}
          <div className="md:hidden relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="Tìm nhanh chức năng, danh mục..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {searchFocused && (searchQuery.trim() || searchHistory.length > 0) && (
              <div className="mt-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-2 space-y-1 max-h-64 overflow-y-auto">
                {!searchQuery.trim() ? (
                  <>
                    <div className="px-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
                      <span>Tìm kiếm gần đây</span>
                      <button type="button" onClick={clearAllSearchHistory} className="text-rose-600 normal-case">
                        Xóa
                      </button>
                    </div>
                    {searchHistory.map(h => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => handleJumpFromSearch(h.tabId, h.groupId, h.kind, h.label, h.subLabel)}
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-xs text-left"
                      >
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">{h.label}</span>
                      </button>
                    ))}
                  </>
                ) : (
                  searchResults.items.map(({ item, group }) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          handleJumpFromSearch(item.id, group.id, 'item', item.label, group.title)
                        }
                        className="w-full px-2.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-xs text-left"
                      >
                        <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold truncate">{item.label}</div>
                          <div className="text-[10px] text-slate-400 truncate">{group.title}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 w-full max-w-[1440px] mx-auto space-y-5">
          {children}
        </main>
      </div>

      {/* Portaled Hover Label Tooltip for Collapsed Desktop Admin Sidebar */}
      {sidebarCollapsed &&
        hoveredNav &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: hoveredNav.top, left: hoveredNav.left }}
            className="fixed -translate-y-1/2 z-[90] pointer-events-none hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold shadow-xl border border-slate-700/80 whitespace-nowrap"
          >
            <span
              aria-hidden="true"
              className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-slate-900 dark:bg-slate-800 border-l border-b border-slate-700/80"
            />
            <span className="relative z-10">{hoveredNav.label}</span>
            {hoveredNav.badge !== undefined && (
              <span
                className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ${
                  hoveredNav.isDanger ? 'bg-rose-500/25 text-rose-200' : 'bg-rose-500/25 text-rose-200'
                }`}
              >
                {hoveredNav.badge}
              </span>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
