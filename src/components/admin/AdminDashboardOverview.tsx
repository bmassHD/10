import React, { useState, useEffect } from 'react';
import {
  Activity,
  Users,
  MessageSquare,
  Star,
  Syringe,
  PartyPopper,
  Briefcase,
  CalendarClock,
  ShieldCheck,
  Server,
  Wifi,
  Wrench,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { SystemSettings, UserProfile, FeedbackItem, StationEvent, WorkSchedule, BusinessTrip } from '../../types';
import {
  getUserProfiles,
  getFeedbackList,
  getBusinessTrips,
} from '../../services/firebaseService';

interface AdminDashboardOverviewProps {
  settings: SystemSettings;
  users?: UserProfile[];
  feedbackList?: FeedbackItem[];
  events?: StationEvent[];
  workSchedules?: WorkSchedule[];
}

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({
  settings,
  users = [],
  feedbackList = [],
  events = [],
  workSchedules = [],
}) => {
  const [profiles, setProfiles] = useState<UserProfile[]>(users);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(feedbackList);
  const [businessTrips, setBusinessTrips] = useState<BusinessTrip[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadStats() {
      if (users.length > 0 && feedbackList.length > 0) return;
      setLoading(true);
      try {
        const [uRes, fRes, bRes] = await Promise.all([
          users.length > 0 ? Promise.resolve(users) : getUserProfiles(),
          feedbackList.length > 0 ? Promise.resolve(feedbackList) : getFeedbackList(),
          getBusinessTrips(),
        ]);
        if (mounted) {
          if (uRes.length > 0) setProfiles(uRes);
          if (fRes.length > 0) setFeedbacks(fRes);
          setBusinessTrips(bRes);
        }
      } catch (err) {
        console.error('Error loading dashboard metrics:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadStats();
    return () => {
      mounted = false;
    };
  }, [users, feedbackList]);

  // Metrics calculations
  const totalUsers = profiles.length;
  const adminCount = profiles.filter(p => p.role === 'admin' || p.role === 'super_admin' || p.accountType === 'admin').length;
  const staffCount = profiles.filter(p => ['doctor', 'nurse', 'communicator', 'staff', 'leadership'].includes(p.role) || p.accountType === 'employee').length;
  const citizenCount = totalUsers - adminCount - staffCount;

  const totalFeedback = feedbacks.length;
  const newFeedback = feedbacks.filter(f => f.status === 'new').length;
  const processingFeedback = feedbacks.filter(f => f.status === 'processing').length;
  const resolvedFeedback = feedbacks.filter(f => f.status === 'resolved').length;

  const activeEvents = events.filter(e => e.isActive !== false).length;
  const activeTrips = businessTrips.length;

  const wifiRestricted = Boolean(settings.wifiIpRestriction?.enabled);
  const maintenanceActive = Boolean(settings.maintenanceMode);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800 p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-100 text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>Trung tâm Điều hành &amp; Thống kê Quản trị</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Admin Dashboard Tổng Quan
          </h1>
          <p className="text-sm text-emerald-100 max-w-2xl">
            Tổng hợp toàn bộ chỉ số hoạt động, nhân sự, phản ánh công dân, lịch công tác và trạng thái bảo mật của Cổng thông tin điện tử.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-xs">
          <Server className="w-4 h-4 text-emerald-300" />
          <div>
            <div className="font-bold">Trạng thái hệ thống</div>
            <div className="text-emerald-200 text-[11px]">
              {maintenanceModeSummary(maintenanceActive, wifiRestricted)}
            </div>
          </div>
        </div>
      </div>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng tài khoản
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {totalUsers}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {adminCount} Quản trị · {staffCount} Nhân sự
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {citizenCount} tài khoản công dân đăng ký
          </div>
        </div>

        {/* Feedback Statistics */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Phản ánh &amp; Kiến nghị
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {totalFeedback}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {newFeedback} mới chưa xử lý
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {processingFeedback} đang xử lý · {resolvedFeedback} đã hoàn tất
          </div>
        </div>

        {/* Active Events & Schedules */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Sự kiện &amp; Tiêm chủng
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/70 text-purple-600 flex items-center justify-center">
              <PartyPopper className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {activeEvents}
            </span>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              {settings.vaccinationSchedules?.length || 0} lịch tiêm
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Sự kiện y tế &amp; lễ kỷ niệm hoạt động
          </div>
        </div>

        {/* Business Trips */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lịch công tác ngoài đơn vị
            </span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/70 text-teal-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {activeTrips}
            </span>
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
              Cán bộ đi công tác
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            Đã đăng ký trên lịch công tác
          </div>
        </div>
      </div>

      {/* Security & System Controls Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
              <Wrench className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Chế độ Bảo trì Tổng</h3>
              <p className="text-[11px] text-slate-500">Trạng thái khóa trang chủ</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">Trạng thái hiện tại:</span>
            <span
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                maintenanceActive
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {maintenanceActive ? 'Đang bật Bảo trì' : 'Đang hoạt động bình thường'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600">
              <Wifi className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Giới hạn IP / WiFi Nội bộ</h3>
              <p className="text-[11px] text-slate-500">Chặn truy cập ngoài mạng</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">Trạng thái hiện tại:</span>
            <span
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                wifiRestricted
                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {wifiRestricted ? `Đang bật (${settings.wifiIpRestriction?.allowedIps?.length || 0} dải IP)` : 'Đã tắt'}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sao lưu GitHub &amp; DB</h3>
              <p className="text-[11px] text-slate-500">Bảo vệ dữ liệu hệ thống</p>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">Cấu hình GitHub:</span>
            <span
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                settings.githubConfig?.token && settings.githubConfig?.repo
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {settings.githubConfig?.token && settings.githubConfig?.repo ? 'Đã kết nối Repo' : 'Chưa thiết lập'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

function maintenanceModeSummary(maintenance: boolean, wifi: boolean): string {
  if (maintenance && wifi) return 'Đang bảo trì & Giới hạn WiFi';
  if (maintenance) return 'Đang bật chế độ Bảo trì';
  if (wifi) return 'Đang giới hạn WiFi nội bộ';
  return 'Hoạt động ổn định (Online)';
}
