import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Crosshair,
  MapPin,
  Loader2,
  Radar,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  MousePointerClick,
} from 'lucide-react';
import {
  EpidemicCase,
  EpidemicCaseStatus,
  EpidemicDiseaseType,
} from '../../types';
import {
  EPIDEMIC_DISEASE_OPTIONS,
  EPIDEMIC_RADIUS_PRESETS,
  EPIDEMIC_STATUS_META,
  getEpidemicDiseaseConfig,
} from '../../constants/epidemicDiseases';
import { DataJsonProvince } from '../common/WardSelector';
import {
  formatVietnamFullAddress,
  loadVietnamAdminUnits,
  normalizeVnAdminText,
  reverseGeocodeCoordinates,
} from '../../utils/vietnamAddressMatcher';
import { getVietnamTodayKey, logAuditEvent, saveEpidemicCase } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface EpidemicCaseModalProps {
  isOpen: boolean;
  initialCase?: EpidemicCase | null;
  draftState?: Partial<EpidemicCase> | null;
  pickedCoords?: { lat: number; lng: number } | null;
  stationDefaultAddress?: string;
  allowMapPick?: boolean;
  onRequestMapPick?: (draft: Partial<EpidemicCase>) => void;
  onClose: () => void;
  onSaved?: (saved: EpidemicCase) => void;
}

export const EpidemicCaseModal: React.FC<EpidemicCaseModalProps> = ({
  isOpen,
  initialCase = null,
  draftState = null,
  pickedCoords = null,
  stationDefaultAddress = '',
  allowMapPick = false,
  onRequestMapPick,
  onClose,
  onSaved,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [provinces, setProvinces] = useState<DataJsonProvince[]>([]);
  const [loadingAdminUnits, setLoadingAdminUnits] = useState(true);

  const [diseaseType, setDiseaseType] = useState<EpidemicDiseaseType>('sot_xuat_huyet');
  const [caseLabel, setCaseLabel] = useState('');
  const [latStr, setLatStr] = useState('');
  const [lngStr, setLngStr] = useState('');
  const [specificAddress, setSpecificAddress] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [provinceName, setProvinceName] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [wardName, setWardName] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(200);
  const [status, setStatus] = useState<EpidemicCaseStatus>('active');
  const [recordedDate, setRecordedDate] = useState<string>(getVietnamTodayKey());
  const [notes, setNotes] = useState('');

  const [locatingGps, setLocatingGps] = useState(false);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadVietnamAdminUnits().then(list => {
      if (!active) return;
      setProvinces(list);
      setLoadingAdminUnits(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const currentProvince = useMemo(() => {
    if (provinceCode) {
      const byCode = provinces.find(p => p.province_code === provinceCode);
      if (byCode) return byCode;
    }
    if (provinceName) {
      const norm = normalizeVnAdminText(provinceName);
      return provinces.find(
        p =>
          normalizeVnAdminText(p.name) === norm ||
          normalizeVnAdminText(p.short_name || '') === norm
      );
    }
    return undefined;
  }, [provinces, provinceCode, provinceName]);

  const wardsInProvince = useMemo(() => currentProvince?.wards || [], [currentProvince]);

  const applyReverseGeocode = async (lat: number, lng: number) => {
    setGeocodingAddress(true);
    setGeoMessage('Đang tự động lấy địa chỉ cụ thể, Phường/Xã, Tỉnh/TP từ vị trí...');
    try {
      const res = await reverseGeocodeCoordinates(lat, lng);
      if (res.specificAddress) {
        setSpecificAddress(res.specificAddress);
      }
      if (res.provinceCode) {
        setProvinceCode(res.provinceCode);
      }
      if (res.provinceName) {
        setProvinceName(res.provinceName);
      }
      if (res.wardCode) {
        setWardCode(res.wardCode);
      }
      if (res.wardName) {
        setWardName(res.wardName);
      }
      if (res.wardName || res.provinceName) {
        setGeoMessage(
          `Đã lấy tự động địa chỉ: ${res.fullAddress || `${res.wardName}, ${res.provinceName}`}`
        );
      } else {
        setGeoMessage(
          'Đã ghi nhận tọa độ GPS. Vui lòng kiểm tra và chọn bổ sung Phường/Xã, Tỉnh/TP bên dưới.'
        );
      }
    } catch {
      setGeoMessage('Chưa tự động tra được tên đường/phường. Vui lòng chọn Phường/Xã & Tỉnh/TP.');
    } finally {
      setGeocodingAddress(false);
    }
  };

  // Initialize form whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    const source = draftState || initialCase;
    if (source) {
      setDiseaseType((source.diseaseType as EpidemicDiseaseType) || 'sot_xuat_huyet');
      setCaseLabel(source.caseLabel || '');
      setLatStr(typeof source.lat === 'number' && !Number.isNaN(source.lat) ? String(source.lat) : '');
      setLngStr(typeof source.lng === 'number' && !Number.isNaN(source.lng) ? String(source.lng) : '');
      setSpecificAddress(source.specificAddress || '');
      setProvinceCode(source.provinceCode || '');
      setProvinceName(source.provinceName || '');
      setWardCode(source.wardCode || '');
      setWardName(source.wardName || '');
      setRadiusMeters(
        typeof source.radiusMeters === 'number' && source.radiusMeters >= 10
          ? source.radiusMeters
          : getEpidemicDiseaseConfig(source.diseaseType).defaultRadiusMeters
      );
      setStatus((source.status as EpidemicCaseStatus) || 'active');
      setRecordedDate(source.recordedDate || getVietnamTodayKey());
      setNotes(source.notes || '');
      setGeoMessage(null);
    } else {
      setDiseaseType('sot_xuat_huyet');
      setCaseLabel('');
      setLatStr('');
      setLngStr('');
      setSpecificAddress('');
      setProvinceCode('');
      setProvinceName('');
      setWardCode('');
      setWardName('');
      setRadiusMeters(200);
      setStatus('active');
      setRecordedDate(getVietnamTodayKey());
      setNotes('');
      setGeoMessage(null);
    }

    if (pickedCoords && Number.isFinite(pickedCoords.lat) && Number.isFinite(pickedCoords.lng)) {
      const fixedLat = Number(pickedCoords.lat.toFixed(6));
      const fixedLng = Number(pickedCoords.lng.toFixed(6));
      setLatStr(String(fixedLat));
      setLngStr(String(fixedLng));
      void applyReverseGeocode(fixedLat, fixedLng);
    }
  }, [isOpen, initialCase, draftState, pickedCoords]);

  // If no province is chosen yet and stationDefaultAddress gives a hint, keep ready for dropdown
  useEffect(() => {
    if (!isOpen || provinces.length === 0 || provinceCode || provinceName || !stationDefaultAddress) {
      return;
    }
    const normHint = normalizeVnAdminText(stationDefaultAddress);
    const matched = provinces.find(p => {
      const full = normalizeVnAdminText(p.name);
      const short = normalizeVnAdminText(p.short_name || p.name);
      return (full && normHint.includes(full)) || (short && normHint.includes(short));
    });
    if (matched) {
      setProvinceCode(matched.province_code);
      setProvinceName(matched.name);
    }
  }, [isOpen, provinces, provinceCode, provinceName, stationDefaultAddress]);

  const handleAcquireCurrentGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('error', 'Thiết bị không hỗ trợ định vị GPS.');
      return;
    }
    setLocatingGps(true);
    setGeoMessage('Đang lấy tọa độ GPS chính xác tại nhà ca bệnh...');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setLatStr(String(lat));
        setLngStr(String(lng));
        setLocatingGps(false);
        void applyReverseGeocode(lat, lng);
      },
      err => {
        setLocatingGps(false);
        const msg =
          err.code === 1
            ? 'Trình duyệt từ chối quyền Vị trí. Vui lòng cấp quyền GPS hoặc dùng nút "Chấm trên bản đồ".'
            : 'Không lấy được tín hiệu GPS tại đây. Vui lòng thử lại hoặc chấm trực tiếp trên bản đồ.';
        setGeoMessage(msg);
        showToast('warning', 'Chưa lấy được GPS', msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleManualReverseGeocode = () => {
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('error', 'Vui lòng nhập Vĩ độ (Lat) và Kinh độ (Lng) hợp lệ trước khi tra địa chỉ.');
      return;
    }
    void applyReverseGeocode(lat, lng);
  };

  const handleProvinceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setProvinceCode(code);
    setWardCode('');
    setWardName('');
    const found = provinces.find(p => p.province_code === code);
    setProvinceName(found ? found.name : '');
  };

  const handleWardSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setWardCode(code);
    const found = wardsInProvince.find(w => w.ward_code === code);
    setWardName(found ? found.name : '');
  };

  const previewFullAddress = useMemo(
    () => formatVietnamFullAddress(specificAddress, wardName, provinceName),
    [specificAddress, wardName, provinceName]
  );

  const handleTriggerMapPick = () => {
    if (!onRequestMapPick) return;
    const lat = Number(latStr);
    const lng = Number(lngStr);
    onRequestMapPick({
      ...(initialCase || {}),
      diseaseType,
      caseLabel,
      ...(Number.isFinite(lat) ? { lat } : {}),
      ...(Number.isFinite(lng) ? { lng } : {}),
      specificAddress,
      provinceCode,
      provinceName,
      wardCode,
      wardName,
      radiusMeters,
      status,
      recordedDate,
      notes,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      showToast('error', 'Vui lòng đăng nhập tài khoản cán bộ y tế hoặc quản trị viên.');
      return;
    }

    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      showToast('error', 'Thiếu tọa độ vị trí nhà ca bệnh', 'Hãy bấm "Lấy GPS tại nhà Ca bệnh" hoặc chấm trên bản đồ.');
      return;
    }

    const cleanWard = wardName.trim();
    const cleanProvince = provinceName.trim();
    if (!cleanWard || !cleanProvince) {
      showToast('error', 'Vui lòng chọn đầy đủ Tỉnh/Thành phố và Phường/Xã.');
      return;
    }

    const radius = Math.round(Number(radiusMeters));
    if (!Number.isFinite(radius) || radius < 10 || radius > 50000) {
      showToast('error', 'Khoảng cách khoanh vùng phải từ 10 m đến 50.000 m.');
      return;
    }

    const nowIso = new Date().toISOString();
    const isEditing = Boolean(initialCase?.id);
    const caseId =
      initialCase?.id ||
      `epi_${diseaseType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const resolvedSpecific = specificAddress.trim() || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const resolvedFull = formatVietnamFullAddress(resolvedSpecific, cleanWard, cleanProvince);

    const payload: EpidemicCase = {
      id: caseId,
      diseaseType,
      caseLabel: caseLabel.trim() || undefined,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      specificAddress: resolvedSpecific,
      wardCode: wardCode || undefined,
      wardName: cleanWard,
      provinceCode: provinceCode || undefined,
      provinceName: cleanProvince,
      fullAddress: resolvedFull,
      radiusMeters: radius,
      status,
      recordedDate: recordedDate || getVietnamTodayKey(),
      notes: notes.trim() || undefined,
      reportedByUid: initialCase?.reportedByUid || currentUser.uid,
      reportedByName:
        initialCase?.reportedByName || userProfile?.displayName || currentUser.email || 'Cán bộ Y tế',
      reportedByRole: initialCase?.reportedByRole || userProfile?.role || 'staff',
      createdAt: initialCase?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    setSaving(true);
    try {
      await saveEpidemicCase(payload);
      await logAuditEvent(
        isEditing ? 'Cập nhật điểm dịch bệnh' : 'Đánh dấu ca lây bệnh & khoanh vùng',
        'Bản đồ dịch bệnh',
        `${getEpidemicDiseaseConfig(diseaseType).label} · Bán kính ${radius}m · ${resolvedFull} (${payload.lat}, ${payload.lng})`,
        {
          uid: currentUser.uid,
          name: userProfile?.displayName || currentUser.email || 'Cán bộ Y tế',
        }
      );
      showToast(
        'success',
        isEditing ? 'Đã cập nhật điểm khoanh vùng dịch bệnh' : 'Đã đánh dấu ca bệnh & hiển thị vùng khoanh lên bản đồ'
      );
      if (onSaved) onSaved(payload);
      onClose();
    } catch (err: any) {
      showToast('error', 'Lưu điểm dịch bệnh thất bại', err?.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2.5 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
              <Radar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-tight">
                {initialCase ? 'Cập Nhật Ca Bệnh & Vùng Khoanh' : 'Đánh Dấu Vị Trí Ca Lây Bệnh Tại Nhà'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lấy tọa độ tại nhà ca bệnh, tự động nhận diện địa chỉ &amp; thiết lập bán kính khoanh vùng (mét).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Disease Selection & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Loại dịch bệnh *
              </label>
              <select
                value={diseaseType}
                onChange={e => {
                  const nextType = e.target.value as EpidemicDiseaseType;
                  setDiseaseType(nextType);
                  if (!initialCase) {
                    setRadiusMeters(getEpidemicDiseaseConfig(nextType).defaultRadiusMeters);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {EPIDEMIC_DISEASE_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Trạng thái xử lý ổ dịch *
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as EpidemicCaseStatus)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                {(Object.keys(EPIDEMIC_STATUS_META) as EpidemicCaseStatus[]).map(st => (
                  <option key={st} value={st}>
                    {EPIDEMIC_STATUS_META[st].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Coordinates Acquisition Box */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Tọa độ vị trí tại nhà Ca bệnh *</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAcquireCurrentGps}
                  disabled={locatingGps || geocodingAddress}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  {locatingGps ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="w-3.5 h-3.5" />
                  )}
                  <span>{locatingGps ? 'Đang lấy GPS...' : 'Lấy GPS tại nhà Ca bệnh'}</span>
                </button>

                {allowMapPick && onRequestMapPick && (
                  <button
                    type="button"
                    onClick={handleTriggerMapPick}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>Chấm trên bản đồ</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vĩ độ (Latitude) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latStr}
                  onChange={e => setLatStr(e.target.value)}
                  placeholder="10.751600"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kinh độ (Longitude) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lngStr}
                  onChange={e => setLngStr(e.target.value)}
                  placeholder="106.702400"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={handleManualReverseGeocode}
                disabled={geocodingAddress || !latStr || !lngStr}
                className="min-h-[36px] px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {geocodingAddress ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Lấy địa chỉ tự động</span>
              </button>
            </div>

            {geoMessage && (
              <div className="text-[11px] font-medium text-rose-800 dark:text-rose-200 bg-white/80 dark:bg-slate-900/70 px-3 py-2 rounded-xl border border-rose-200/70 dark:border-rose-800/60 flex items-center gap-1.5">
                {geocodingAddress ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                )}
                <span>{geoMessage}</span>
              </div>
            )}
          </div>

          {/* 3. Auto-filled Structured Address */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              Địa chỉ ca bệnh (tự động điền từ vị trí · có thể chỉnh lại nếu cần)
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Địa chỉ cụ thể (Số nhà, đường, tổ/ấp/khu phố) *
              </label>
              <input
                type="text"
                required
                value={specificAddress}
                onChange={e => setSpecificAddress(e.target.value)}
                placeholder="VD: Số 24 hẻm 15 đường Nguyễn Thị Thập, Khu phố 2"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tỉnh / Thành phố *
                </label>
                {provinces.length > 0 ? (
                  <select
                    required
                    disabled={loadingAdminUnits}
                    value={currentProvince?.province_code || provinceCode}
                    onChange={handleProvinceSelect}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">
                      {loadingAdminUnits ? 'Đang tải danh mục Tỉnh/TP...' : '-- Chọn Tỉnh / Thành phố --'}
                    </option>
                    {provinces.map(p => (
                      <option key={p.province_code} value={p.province_code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={provinceName}
                    onChange={e => setProvinceName(e.target.value)}
                    placeholder="Tỉnh / Thành phố"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phường / Xã *
                </label>
                {provinces.length > 0 && wardsInProvince.length > 0 ? (
                  <select
                    required={!wardName}
                    value={wardCode}
                    onChange={handleWardSelect}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">
                      {wardName && !wardCode
                        ? `${wardName} (chọn để chuẩn hóa)`
                        : `-- Chọn Phường / Xã (${wardsInProvince.length}) --`}
                    </option>
                    {wardsInProvince.map(w => (
                      <option key={w.ward_code} value={w.ward_code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={wardName}
                    onChange={e => setWardName(e.target.value)}
                    placeholder="Phường / Xã / Thị trấn"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                )}
              </div>
            </div>

            {previewFullAddress && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-400">Địa chỉ đầy đủ hiển thị: </span>
                <strong className="text-slate-900 dark:text-white">{previewFullAddress}</strong>
              </div>
            )}
          </div>

          {/* 4. Containment Radius (Meters) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="font-bold text-amber-950 dark:text-amber-200">
                Khoảng cách khoanh vùng ổ dịch (đơn vị: mét) *
              </label>
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 tabular-nums">
                Bán kính: {radiusMeters} m · Đường kính: {radiusMeters * 2} m
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {EPIDEMIC_RADIUS_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRadiusMeters(preset)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer tabular-nums ${
                    radiusMeters === preset
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-amber-200 dark:border-amber-800 hover:border-rose-400'
                  }`}
                >
                  {preset} m
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={50000}
                step={10}
                required
                value={radiusMeters}
                onChange={e => setRadiusMeters(Math.max(10, Math.min(50000, Number(e.target.value) || 0)))}
                className="w-36 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-bold text-sm text-rose-700 dark:text-rose-300 tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">mét (m)</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
                (Khuyến nghị Sốt xuất huyết: 200 m quanh nhà ca bệnh)
              </span>
            </div>
          </div>

          {/* 5. Case Label, Date & Vector Control Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mã / Nhãn ổ dịch (không ghi tên bệnh nhân)
              </label>
              <input
                type="text"
                value={caseLabel}
                onChange={e => setCaseLabel(e.target.value)}
                placeholder="VD: Ca SXH - Khu phố 2 / Tổ 5"
                maxLength={128}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ngày ghi nhận ca bệnh *
              </label>
              <input
                type="date"
                required
                value={recordedDate}
                onChange={e => setRecordedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú chuyên môn &amp; biện pháp xử lý (diệt lăng quăng, phun hóa chất...)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VD: Đã khảo sát chỉ số lăng quăng quanh bán kính 200m, hướng dẫn hộ gia đình lật úp dụng cụ chứa nước và lên lịch phun hóa chất..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Bảo mật thông tin người bệnh: Không nhập họ tên thật, số CCCD hoặc số điện thoại cá nhân của bệnh nhân vào bản đồ khoanh vùng công khai.
            </span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving || geocodingAddress}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm inline-flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
              <span>
                {saving
                  ? 'Đang lưu...'
                  : initialCase
                  ? 'Cập nhật vùng khoanh'
                  : 'Lưu & Hiện lên Bản đồ'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
