import React, { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Calendar,
  MapPin,
  Plus,
  Search,
  UserCheck,
  Users,
  Clock,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  Network,
  Building2,
} from 'lucide-react';
import { BusinessTrip, OrgChartConfig, SystemSettings, UserProfile } from '../../types';
import {
  getBusinessTrips,
  saveBusinessTripToFirestore,
  deleteBusinessTripFromFirestore,
  getUserProfiles,
  getSystemSettings,
  getVietnamTodayKey,
} from '../../services/firebaseService';
import { normalizeTextNoDiacritics } from '../../services/orgPersonnelSyncService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface OrgStaffOption {
  id: string;
  fullName: string;
  position: string;
  professionalTitle?: string;
  unitId: string;
  unitName: string;
  unitOrder: number;
  phone?: string;
  linkedUid?: string;
  isLegacyFallback?: boolean;
}

function formatUnitLabel(name: string, index: number): string {
  const trimmed = name.trim();
  if (!trimmed) return `Khoa/Phòng #${index + 1}`;
  if (/^\d+\s*[.\-_:]/.test(trimmed)) return trimmed;
  return `${index + 1}. ${trimmed}`;
}

interface BusinessTripViewProps {
  userProfiles?: UserProfile[];
  settings?: SystemSettings;
}

export const BusinessTripView: React.FC<BusinessTripViewProps> = ({
  userProfiles = [],
  settings,
}) => {
  const { isAdmin, currentUser } = useAuth();
  const { showToast } = useToast();
  const tripConfig = settings?.businessTripConfig;

  const [trips, setTrips] = useState<BusinessTrip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'upcoming'>(
    tripConfig?.defaultFilter || 'active'
  );

  useEffect(() => {
    if (tripConfig?.defaultFilter) {
      setFilterTab(tripConfig.defaultFilter);
    }
  }, [tripConfig?.defaultFilter]);

  // Modal / Form state for Admin
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [staffUnitFilter, setStaffUnitFilter] = useState<string>('all');
  const [legacySelectedStaff, setLegacySelectedStaff] = useState<OrgStaffOption[]>([]);
  const [destination, setDestination] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getVietnamTodayKey());
  const [endDate, setEndDate] = useState<string>(getVietnamTodayKey());
  const [content, setContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [allProfiles, setAllProfiles] = useState<UserProfile[]>(userProfiles);
  const [fallbackOrgChart, setFallbackOrgChart] = useState<OrgChartConfig | undefined>(
    settings?.orgChart
  );

  useEffect(() => {
    if (settings?.orgChart) {
      setFallbackOrgChart(settings.orgChart);
    }
  }, [settings?.orgChart]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [fetchedTrips, fetchedProfiles, fetchedSettings] = await Promise.all([
          getBusinessTrips(),
          userProfiles.length > 0 ? Promise.resolve(userProfiles) : getUserProfiles(),
          settings?.orgChart ? Promise.resolve(null) : getSystemSettings(),
        ]);
        if (mounted) {
          setTrips(fetchedTrips);
          if (fetchedProfiles.length > 0) {
            setAllProfiles(fetchedProfiles);
          }
          if (fetchedSettings?.orgChart) {
            setFallbackOrgChart(fetchedSettings.orgChart);
          }
        }
      } catch (err) {
        console.error('Error loading business trips:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [userProfiles, settings?.orgChart]);

  const effectiveOrgChart: OrgChartConfig = useMemo(() => {
    const raw = settings?.orgChart || fallbackOrgChart;
    return {
      director: raw?.director,
      deputyDirectors: Array.isArray(raw?.deputyDirectors) ? raw.deputyDirectors : [],
      departments: Array.isArray(raw?.departments) ? raw.departments : [],
      updatedAt: raw?.updatedAt,
    };
  }, [settings?.orgChart, fallbackOrgChart]);

  const orgChartStaffOptions: OrgStaffOption[] = useMemo(() => {
    const options: OrgStaffOption[] = [];
    const seenIds = new Set<string>();

    const pushUniqueOption = (opt: OrgStaffOption) => {
      let candidateId = opt.id;
      let suffix = 2;
      while (seenIds.has(candidateId)) {
        candidateId = `${opt.id}_${suffix}`;
        suffix += 1;
      }
      seenIds.add(candidateId);
      options.push({ ...opt, id: candidateId });
    };

    if (effectiveOrgChart.director?.fullName?.trim()) {
      const m = effectiveOrgChart.director;
      pushUniqueOption({
        id: m.id || 'director',
        fullName: m.fullName.trim(),
        position: m.position?.trim() || 'Giám đốc',
        professionalTitle: m.professionalTitle?.trim(),
        unitId: 'leadership',
        unitName: 'Ban Giám đốc',
        unitOrder: 0,
        phone: m.phone?.trim(),
        linkedUid: m.linkedUid,
      });
    }

    effectiveOrgChart.deputyDirectors.forEach((dd, idx) => {
      if (!dd.fullName?.trim()) return;
      pushUniqueOption({
        id: dd.id || `dd_${idx}`,
        fullName: dd.fullName.trim(),
        position: dd.position?.trim() || 'Phó Giám đốc',
        professionalTitle: dd.professionalTitle?.trim(),
        unitId: 'leadership',
        unitName: 'Ban Giám đốc',
        unitOrder: 0,
        phone: dd.phone?.trim(),
        linkedUid: dd.linkedUid,
      });
    });

    effectiveOrgChart.departments.forEach((dept, deptIdx) => {
      const deptLabel = formatUnitLabel(dept.name || '', deptIdx);
      const unitOrder = deptIdx + 1;

      if (dept.head?.fullName?.trim()) {
        const m = dept.head;
        pushUniqueOption({
          id: m.id || `head_${dept.id}`,
          fullName: m.fullName.trim(),
          position: m.position?.trim() || 'Trưởng khoa/phòng',
          professionalTitle: m.professionalTitle?.trim(),
          unitId: dept.id,
          unitName: deptLabel,
          unitOrder,
          phone: m.phone?.trim(),
          linkedUid: m.linkedUid,
        });
      }

      (dept.deputies || []).forEach((dep, depIdx) => {
        if (!dep.fullName?.trim()) return;
        pushUniqueOption({
          id: dep.id || `dep_${dept.id}_${depIdx}`,
          fullName: dep.fullName.trim(),
          position: dep.position?.trim() || 'Phó khoa/phòng',
          professionalTitle: dep.professionalTitle?.trim(),
          unitId: dept.id,
          unitName: deptLabel,
          unitOrder,
          phone: dep.phone?.trim(),
          linkedUid: dep.linkedUid,
        });
      });

      (dept.staff || []).forEach((st, stIdx) => {
        if (!st.fullName?.trim()) return;
        pushUniqueOption({
          id: st.id || `st_${dept.id}_${stIdx}`,
          fullName: st.fullName.trim(),
          position: st.position?.trim() || 'Nhân viên',
          professionalTitle: st.professionalTitle?.trim(),
          unitId: dept.id,
          unitName: deptLabel,
          unitOrder,
          phone: st.phone?.trim(),
          linkedUid: st.linkedUid,
        });
      });
    });

    return options;
  }, [effectiveOrgChart]);

  const selectableStaffOptions: OrgStaffOption[] = useMemo(() => {
    if (legacySelectedStaff.length === 0) return orgChartStaffOptions;
    const existingIds = new Set(orgChartStaffOptions.map((o) => o.id));
    return [
      ...orgChartStaffOptions,
      ...legacySelectedStaff.filter((l) => !existingIds.has(l.id)),
    ];
  }, [orgChartStaffOptions, legacySelectedStaff]);

  const unitFilterChoices = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; order: number }>();
    selectableStaffOptions.forEach((opt) => {
      const existing = map.get(opt.unitId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(opt.unitId, {
          id: opt.unitId,
          name: opt.unitName,
          count: 1,
          order: opt.unitOrder,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [selectableStaffOptions]);

  const groupedFilteredStaff = useMemo(() => {
    const queryNorm = normalizeTextNoDiacritics(staffSearchQuery);
    const queryLower = staffSearchQuery.trim().toLowerCase();

    const filtered = selectableStaffOptions.filter((opt) => {
      if (staffUnitFilter !== 'all' && opt.unitId !== staffUnitFilter) return false;
      if (!queryLower) return true;
      const hayRaw = `${opt.fullName} ${opt.position} ${opt.professionalTitle || ''} ${opt.unitName} ${opt.phone || ''}`.toLowerCase();
      if (hayRaw.includes(queryLower)) return true;
      if (queryNorm && normalizeTextNoDiacritics(hayRaw).includes(queryNorm)) return true;
      return false;
    });

    const groups = new Map<string, { unitId: string; unitName: string; unitOrder: number; members: OrgStaffOption[] }>();
    filtered.forEach((opt) => {
      const existing = groups.get(opt.unitId);
      if (existing) {
        existing.members.push(opt);
      } else {
        groups.set(opt.unitId, {
          unitId: opt.unitId,
          unitName: opt.unitName,
          unitOrder: opt.unitOrder,
          members: [opt],
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.unitOrder - b.unitOrder);
  }, [selectableStaffOptions, staffSearchQuery, staffUnitFilter]);

  const todayKey = getVietnamTodayKey();

  const filteredTrips = useMemo(() => {
    return trips
      .filter((trip) => {
        const matchesQuery =
          !searchQuery ||
          trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trip.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trip.staffNames.some((name) => name.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesQuery) return false;

        const isCurrentlyActive = trip.startDate <= todayKey && trip.endDate >= todayKey;
        const isUpcoming = trip.startDate > todayKey;
        const isPast = trip.endDate < todayKey;

        if (!isAdmin && tripConfig?.hidePastForCitizens && isPast) return false;
        if (filterTab === 'active') return isCurrentlyActive;
        if (filterTab === 'upcoming') return isUpcoming;
        return true;
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [trips, searchQuery, filterTab, todayKey, isAdmin, tripConfig?.hidePastForCitizens]);

  const handleOpenAddModal = () => {
    setEditingTripId(null);
    setSelectedStaffIds([]);
    setLegacySelectedStaff([]);
    setStaffSearchQuery('');
    setStaffUnitFilter('all');
    setDestination('');
    setStartDate(todayKey);
    setEndDate(todayKey);
    setContent('');
    setShowModal(true);
  };

  const handleOpenEditModal = (trip: BusinessTrip) => {
    const rawIds = trip.staffIds || [];
    const rawNames = trip.staffNames || [];
    const resolvedIds: string[] = [];
    const fallbackItems: OrgStaffOption[] = [];

    rawIds.forEach((savedId, idx) => {
      const savedName = rawNames[idx] || '';
      const matched =
        orgChartStaffOptions.find((o) => o.id === savedId) ||
        orgChartStaffOptions.find((o) => o.linkedUid && o.linkedUid === savedId) ||
        (savedName
          ? orgChartStaffOptions.find(
              (o) => normalizeTextNoDiacritics(o.fullName) === normalizeTextNoDiacritics(savedName)
            )
          : undefined);

      if (matched) {
        if (!resolvedIds.includes(matched.id)) {
          resolvedIds.push(matched.id);
        }
      } else {
        const legacyProfile = allProfiles.find((p) => p.uid === savedId);
        const fallbackName = savedName || legacyProfile?.displayName || legacyProfile?.email || savedId;
        if (!resolvedIds.includes(savedId)) {
          resolvedIds.push(savedId);
          fallbackItems.push({
            id: savedId,
            fullName: fallbackName,
            position: legacyProfile?.department || 'Nhân sự đã chọn trước đây',
            unitId: 'legacy_other',
            unitName: 'Ngoài Sơ đồ tổ chức hiện tại',
            unitOrder: 9999,
            isLegacyFallback: true,
          });
        }
      }
    });

    setEditingTripId(trip.id);
    setLegacySelectedStaff(fallbackItems);
    setSelectedStaffIds(resolvedIds);
    setStaffSearchQuery('');
    setStaffUnitFilter('all');
    setDestination(trip.destination || '');
    setStartDate(trip.startDate || todayKey);
    setEndDate(trip.endDate || todayKey);
    setContent(trip.content || '');
    setShowModal(true);
  };

  const handleToggleStaffId = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleUnitStaff = (members: OrgStaffOption[]) => {
    const memberIds = members.map((m) => m.id);
    const allSelected = memberIds.length > 0 && memberIds.every((id) => selectedStaffIds.includes(id));
    if (allSelected) {
      const idSet = new Set(memberIds);
      setSelectedStaffIds((prev) => prev.filter((id) => !idSet.has(id)));
    } else {
      setSelectedStaffIds((prev) => {
        const next = new Set(prev);
        memberIds.forEach((id) => next.add(id));
        return Array.from(next);
      });
    }
  };

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStaffIds.length === 0) {
      showToast('error', 'Vui lòng chọn ít nhất một nhân sự đi công tác');
      return;
    }
    if (!destination.trim()) {
      showToast('error', 'Vui lòng nhập nơi công tác');
      return;
    }
    if (!content.trim()) {
      showToast('error', 'Vui lòng nhập nội dung công tác');
      return;
    }
    if (startDate > endDate) {
      showToast('error', 'Ngày bắt đầu không được lớn hơn ngày kết thúc');
      return;
    }

    setSubmitting(true);
    try {
      const staffNames = selectedStaffIds
        .map((id) => {
          const opt = selectableStaffOptions.find((x) => x.id === id);
          if (opt) return opt.fullName;
          const p = allProfiles.find((x) => x.uid === id);
          return p?.displayName || p?.email || id;
        })
        .filter(Boolean);

      const tripId = editingTripId || `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTrip: BusinessTrip = {
        id: tripId,
        staffIds: selectedStaffIds,
        staffNames,
        destination: destination.trim(),
        startDate,
        endDate,
        content: content.trim(),
        createdAt: editingTripId
          ? trips.find((t) => t.id === editingTripId)?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.uid,
      };

      await saveBusinessTripToFirestore(newTrip);
      const updated = await getBusinessTrips();
      setTrips(updated);
      setShowModal(false);
      showToast('success', editingTripId ? 'Đã cập nhật lịch công tác' : 'Đã thêm lịch công tác thành công');
    } catch (err: any) {
      showToast('error', 'Không thể lưu lịch công tác', err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch công tác này không?')) return;
    try {
      await deleteBusinessTripFromFirestore(tripId);
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
      showToast('success', 'Đã xóa lịch công tác');
    } catch (err: any) {
      showToast('error', 'Không thể xóa lịch công tác', err?.message);
    }
  };

  if (tripConfig?.enabled === false && !isAdmin) {
    return (
      <div className="max-w-lg mx-auto py-16 px-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
          <Briefcase className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Mục Lịch Công Tác Tạm Ẩn
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Quản trị viên hiện đang tạm tắt hiển thị công khai Lịch công tác cán bộ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800 p-6 md:p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-100 text-xs font-semibold">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Chương trình công tác & Cán bộ vắng mặt</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {tripConfig?.sectionTitle?.trim() || 'Lịch Công Tác Cán Bộ Y Tế'}
            </h1>
            <p className="text-sm text-emerald-100 max-w-2xl">
              {tripConfig?.sectionSubtitle?.trim() ||
                'Cập nhật danh sách cán bộ, nhân viên y tế đang và sắp tham gia công tác bên ngoài đơn vị, đảm bảo nắm bắt thông tin điều hành 24/7.'}
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-2xl bg-white text-emerald-900 font-bold text-xs md:text-sm hover:bg-emerald-50 transition shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              <span>Thêm lịch công tác</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setFilterTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Đang công tác hôm nay
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('upcoming')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === 'upcoming'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Sắp tới
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất cả lịch
          </button>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo nhân sự, nơi, nội dung..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Trips Grid / List */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs">Đang tải lịch công tác...</div>
      ) : filteredTrips.length === 0 ? (
        <div className="py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Không có nhân sự nào đang đi công tác</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {filterTab === 'active'
              ? 'Hiện tại không có cán bộ y tế nào có lịch trình công tác ngoài đơn vị trong ngày hôm nay.'
              : 'Chưa ghi nhận lịch công tác nào phù hợp với bộ lọc.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map((trip) => {
            const isActiveToday = trip.startDate <= todayKey && trip.endDate >= todayKey;
            const isUpcoming = trip.startDate > todayKey;

            return (
              <div
                key={trip.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        isActiveToday
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : isUpcoming
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isActiveToday ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đang công tác</span>
                        </>
                      ) : isUpcoming ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Sắp tới</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đã kết thúc</span>
                        </>
                      )}
                    </span>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(trip)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                          title="Sửa lịch công tác"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrip(trip.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>{trip.destination}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Từ {trip.startDate} đến {trip.endDate}
                      </span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {trip.content}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Nhân sự tham gia ({trip.staffNames?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {trip.staffNames?.map((name, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                      >
                        <UserCheck className="w-3 h-3 text-emerald-600" />
                        <span>{name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4.5 h-4.5 text-emerald-600" />
                <span>{editingTripId ? 'Sửa lịch công tác' : 'Thêm lịch công tác mới'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrip} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Select Personnel from Sơ đồ tổ chức */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chọn nhân sự đi công tác (Sơ đồ tổ chức) <span className="text-rose-500">*</span></span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                      Đã chọn: {selectedStaffIds.length}
                    </span>
                    {selectedStaffIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedStaffIds([])}
                        className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected Staff Chips */}
                {selectedStaffIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                    {selectedStaffIds.map((id) => {
                      const opt = selectableStaffOptions.find((x) => x.id === id);
                      const label = opt?.fullName || id;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700 shadow-2xs"
                        >
                          <span>{label}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleStaffId(id)}
                            className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Bỏ chọn"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search & Department Filter */}
                {selectableStaffOptions.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên, chức vụ..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <select
                      value={staffUnitFilter}
                      onChange={(e) => setStaffUnitFilter(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="all">
                        Tất cả khoa/phòng ({selectableStaffOptions.length})
                      </option>
                      {unitFilterChoices.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.count})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Grouped Org Chart Personnel List */}
                <div className="max-h-56 overflow-y-auto p-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2.5">
                  {selectableStaffOptions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Chưa có nhân sự trong Sơ đồ tổ chức.
                      </p>
                      <p className="text-[11px]">
                        Vui lòng thêm cán bộ tại mục Sơ đồ tổ chức / Nhân lực khoa phòng trước khi tạo lịch công tác.
                      </p>
                    </div>
                  ) : groupedFilteredStaff.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      Không tìm thấy nhân sự phù hợp trong Sơ đồ tổ chức.
                    </div>
                  ) : (
                    groupedFilteredStaff.map((group) => {
                      const allUnitSelected =
                        group.members.length > 0 &&
                        group.members.every((m) => selectedStaffIds.includes(m.id));
                      return (
                        <div key={group.unitId} className="space-y-1">
                          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700/70">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{group.unitName}</span>
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                ({group.members.length})
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleUnitStaff(group.members)}
                              className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                            >
                              {allUnitSelected ? 'Bỏ chọn đơn vị' : 'Chọn cả đơn vị'}
                            </button>
                          </div>

                          <div className="space-y-1">
                            {group.members.map((opt) => {
                              const isChecked = selectedStaffIds.includes(opt.id);
                              const subtitle = [opt.position, opt.professionalTitle]
                                .filter(Boolean)
                                .join(' · ');
                              return (
                                <label
                                  key={opt.id}
                                  className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition text-xs ${
                                    isChecked
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-slate-900 dark:text-white'
                                      : 'hover:bg-white dark:hover:bg-slate-800 border border-transparent text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleStaffId(opt.id)}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold truncate">{opt.fullName}</div>
                                    {subtitle && (
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {subtitle}
                                      </div>
                                    )}
                                  </div>
                                  {opt.phone && (
                                    <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">
                                      {opt.phone}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nơi công tác <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="VD: Sở Y tế tỉnh / Bệnh viện Đa khoa Tỉnh..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Từ ngày <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Đến ngày <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nội dung công tác <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung, kế hoạch công tác cụ thể..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : editingTripId ? 'Cập nhật lịch' : 'Thêm lịch công tác'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
