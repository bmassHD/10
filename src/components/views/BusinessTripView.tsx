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
} from 'lucide-react';
import { BusinessTrip, UserProfile } from '../../types';
import {
  getBusinessTrips,
  saveBusinessTripToFirestore,
  deleteBusinessTripFromFirestore,
  getUserProfiles,
  getVietnamTodayKey,
} from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface BusinessTripViewProps {
  userProfiles?: UserProfile[];
}

export const BusinessTripView: React.FC<BusinessTripViewProps> = ({ userProfiles = [] }) => {
  const { isAdmin, currentUser } = useAuth();
  const { showToast } = useToast();

  const [trips, setTrips] = useState<BusinessTrip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'upcoming'>('active');

  // Modal / Form state for Admin
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [destination, setDestination] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getVietnamTodayKey());
  const [endDate, setEndDate] = useState<string>(getVietnamTodayKey());
  const [content, setContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [allProfiles, setAllProfiles] = useState<UserProfile[]>(userProfiles);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [fetchedTrips, fetchedProfiles] = await Promise.all([
          getBusinessTrips(),
          userProfiles.length > 0 ? Promise.resolve(userProfiles) : getUserProfiles(),
        ]);
        if (mounted) {
          setTrips(fetchedTrips);
          if (fetchedProfiles.length > 0) {
            setAllProfiles(fetchedProfiles);
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
  }, [userProfiles]);

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

        if (filterTab === 'active') return isCurrentlyActive;
        if (filterTab === 'upcoming') return isUpcoming;
        return true;
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [trips, searchQuery, filterTab, todayKey]);

  const handleOpenAddModal = () => {
    setEditingTripId(null);
    setSelectedStaffIds([]);
    setDestination('');
    setStartDate(todayKey);
    setEndDate(todayKey);
    setContent('');
    setShowModal(true);
  };

  const handleOpenEditModal = (trip: BusinessTrip) => {
    setEditingTripId(trip.id);
    setSelectedStaffIds(trip.staffIds || []);
    setDestination(trip.destination || '');
    setStartDate(trip.startDate || todayKey);
    setEndDate(trip.endDate || todayKey);
    setContent(trip.content || '');
    setShowModal(true);
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
        .map((uid) => {
          const p = allProfiles.find((x) => x.uid === uid);
          return p?.displayName || p?.email || uid;
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
              Lịch Công Tác Cán Bộ Y Tế
            </h1>
            <p className="text-sm text-emerald-100 max-w-2xl">
              Cập nhật danh sách cán bộ, nhân viên y tế đang và sắp tham gia công tác bên ngoài đơn vị, đảm bảo nắm bắt thông tin điều hành 24/7.
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
              {/* Select Personnel */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chọn nhân sự đi công tác <span className="text-rose-500">*</span>
                </label>
                <div className="max-h-48 overflow-y-auto p-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-1">
                  {allProfiles.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">Chưa có nhân sự trong hệ thống.</div>
                  ) : (
                    allProfiles.map((p) => {
                      const id = p.uid;
                      const name = p.displayName || p.email || id;
                      const isChecked = selectedStaffIds.includes(id);
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition text-xs text-slate-800 dark:text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStaffIds([...selectedStaffIds, id]);
                              } else {
                                setSelectedStaffIds(selectedStaffIds.filter((x) => x !== id));
                              }
                            }}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium">{name}</span>
                          {p.department && (
                            <span className="ml-auto text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                              {p.department}
                            </span>
                          )}
                        </label>
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
