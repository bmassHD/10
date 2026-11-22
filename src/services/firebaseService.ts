import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { initializeApp as initSecondaryApp, deleteApp as deleteSecondaryApp } from 'firebase/app';
import { getAuth as getSecondaryAuth, createUserWithEmailAndPassword, signOut as signSecondaryOut } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { db, auth, firebaseConfig } from '../firebase/config';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import {
  isFirestoreWriteQuotaExceeded,
  markFirestoreWriteQuotaExceededIfMatch,
} from '../utils/firestoreQuotaGuard';
import {
  SystemSettings,
  Post,
  Announcement,
  TargetedNotification,
  ServiceItem,
  Appointment,
  FeedbackItem,
  FeedbackAttachment,
  StaffTask,
  WorkSchedule,
  BusinessTrip,
  DocumentItem,
  AuditLog,
  UserProfile,
  EmergencyContact,
  VaccinationScheduleItem,
  PushSubscriptionRecord,
  NearbyFacility,
  NearbyFacilityEditPayload,
  RescueSignal,
  StationEvent,
  WeeklyWorkDayConfig,
  WorkScheduleConfig,
  HolidayScheduleItem,
  ReferralCodeItem,
  ReferralIssuerTier,
  UserReferralLink,
  ReferralTrackingItem,
  ReferralTrackingSteps,
  RoleType,
  AttendanceRecord,
  AttendanceStatus,
  RolePermissionPolicy,
  RolePermissionsConfig,
  StoreItem,
  StoreItemCategory,
  StoreOrder,
  StoreOrderStatus,
  ServiceRating,
  ServiceRatingCategory,
  LegacyUserSnapshot,
  UserMigrationClaim,
} from '../types';
import { getOrCreateDeviceId } from './systemNotificationService';

// Utility to strip all undefined fields recursively (including inside arrays) before sending to Firestore
export function cleanDataForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item =>
        item !== null && typeof item === 'object'
          ? cleanDataForFirestore(item)
          : item
      );
  }
  if (typeof data === 'object') {
    if (data instanceof Date) {
      return data;
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (value !== null && typeof value === 'object') {
          result[key] = cleanDataForFirestore(value);
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
  return data;
}

// Empty default skeleton when station settings have not yet been configured by Admin
export const emptySystemSettings: SystemSettings = {
  stationName: '',
  parentUnitName: '',
  subTitle: '',
  address: '',
  hotline: '',
  emergencyPhone: '',
  emergencyNote: '',
  emergencyContacts: [],
  email: '',
  workingHours: '',
  leaderName: '',
  bannerNotice: '',
  bannerNoticeEnabled: false,
  vaccinationBannerEnabled: true,
  vaccinationBannerNote: '',
  version: 'v3.0.0 (Bản Chính Thức)',
  highlightImages: [],
  vaccinationSchedules: [],
  holidaySchedules: [],
  startupPopup: {
    enabled: true,
    noticeType: 'general',
    title: 'Thông báo từ Trạm Y Tế',
    message: '',
    includeTopVaccination: false,
    ctaView: 'none',
    ctaLabel: '',
    frequency: 'per_session',
  },
  vaccinationPopup: {
    enabled: true,
    title: 'Thông Báo Tiêm Chủng',
    message: '',
    ctaLabel: 'Xem lịch tiêm chủng',
    frequency: 'per_session',
  },
  orgChart: {
    deputyDirectors: [],
    departments: [],
  },
  appBacSiChoMoiNha: {
    enabled: true,
    androidUrl: 'https://play.google.com/store/apps/details?id=vn.gov.moh.bacsichomoinha1',
    iosUrl: 'https://apps.apple.com/vn/app/b%C3%A1c-s%C4%A9-cho-m%E1%BB%8Di-nh%C3%A0/id6453760139',
    guideText: 'Khám chữa bệnh từ xa cùng Bác sĩ Trạm Y tế',
  },
  modulesEnabled: {
    nonCommunicableDiseases: true,
    immunizationManagement: true,
    maternalChildHealth: true,
    elderlyCare: true,
    epidemicPrevention: true,
    schoolHealth: true,
    googleCalendarSync: false,
  },
  socialLinks: {
    facebook: '',
    zalo: '',
    tiktok: '',
    youtube: '',
  },
  maintenanceMode: false,
  maintenanceMessage:
    'Hệ thống Cổng thông tin điện tử Trạm Y tế đang được bảo trì, nâng cấp định kỳ. Quý người dân cần hỗ trợ y tế khẩn cấp vui lòng liên hệ trực tiếp số Cấp cứu 24/7 bên dưới.',
  wifiIpRestriction: {
    enabled: false,
    allowedIps: [],
    message: 'Hệ thống Cổng thông tin điện tử chỉ cho phép truy cập từ mạng WiFi nội bộ của Trạm Y Tế. Vui lòng kết nối đúng mạng nội bộ để tiếp tục.',
  },
  hiddenTabs: [],
  tabMaintenance: {},
  editorialBoard: '',
  responsiblePerson: '',
  copyrightText: '',
  softwareTeamContact: {
    enabled: true,
    teamName: '',
    roleLabel: '',
    personName: '',
    phone: '',
    email: '',
    zaloUrl: '',
    facebookUrl: '',
    websiteUrl: '',
    supportHours: '',
    note: '',
  },
  autoBackupGithubEnabled: true,
  accessControl: {
    rules: {},
    customMessage:
      'Hiện tại hệ thống đang tạm hạn chế truy cập trên loại thiết bị hoặc trình duyệt bạn đang sử dụng. Vui lòng chuyển sang thiết bị/trình duyệt được hỗ trợ hoặc liên hệ Trạm Y tế qua số Cấp cứu 24/7 bên dưới.',
    exemptAdmins: true,
  },
  bhxhApi: {
    enabled: false,
    baseUrl: 'https://egw.baohiemxahoi.gov.vn',
    lookupEndpoint: 'KQNhanLichSuKCB2024',
    defaultMaCskcb: '',
    usernameMasked: '',
    hasCredentials: false,
    hasOfficerInfo: false,
    autoLookupFacilityName: true,
    showHistoryKcb: true,
  },
};

export interface SidebarTabDefinition {
  id: string;
  label: string;
  hash: string;
  group: 'CỔNG THÔNG TIN ĐIỆN TỬ' | 'TIỆN ÍCH DÂN CƯ';
}

export const CONTROLLABLE_SIDEBAR_TABS: SidebarTabDefinition[] = [
  { id: 'portal', label: 'Trang chủ & Giới thiệu', hash: '#trang-chu', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'org_chart', label: 'Sơ đồ tổ chức', hash: '#so-do-to-chuc', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'personnel_directory', label: 'Nhân lực & Khoa phòng', hash: '#nhan-luc-khoa-phong', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'vaccination', label: 'Lịch tiêm chủng', hash: '#lich-tiem-chung', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'events', label: 'Sự kiện', hash: '#su-kien', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'business_trip', label: 'Lịch công tác', hash: '#lich-cong-tac', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'duty', label: 'Lịch trực 24/7 & Làm việc', hash: '#lich-truc', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'map', label: 'Bản đồ & Định vị trạm', hash: '#ban-do', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'nearby_facilities', label: 'Cơ sở Y tế lân cận', hash: '#co-so-y-te-lan-can', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'rescue', label: 'Bản đồ Cứu hộ cứu nạn', hash: '#cuu-ho-cuu-nan', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'offline_emergency', label: 'Cấp cứu Ngoại tuyến (SOS)', hash: '#ngoai-tuyen', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'news', label: 'Tin tức & Media', hash: '#tin-tuc', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'documents', label: 'Văn bản & Biểu mẫu', hash: '#van-ban', group: 'CỔNG THÔNG TIN ĐIỆN TỬ' },
  { id: 'bhyt_lookup', label: 'Tra cứu thông tin BHYT', hash: '#tra-cuu-bhyt', group: 'TIỆN ÍCH DÂN CƯ' },
  { id: 'apps', label: 'Ứng dụng', hash: '#ung-dung', group: 'TIỆN ÍCH DÂN CƯ' },
  { id: 'telehealth', label: 'Bác sĩ cho mọi nhà', hash: '#bac-si-cho-moi-nha', group: 'TIỆN ÍCH DÂN CƯ' },
  { id: 'feedback_tracking', label: 'Phản ánh', hash: '#phan-anh', group: 'TIỆN ÍCH DÂN CƯ' },
];

export const DEFAULT_PORTAL_APP_CATEGORIES: string[] = [
  'Dịch vụ công',
  'Y tế',
  'Tiện ích',
  'Khác',
];

export function resolvePortalAppCategories(
  settings?: Partial<SystemSettings> | null
): string[] {
  const ordered: string[] = [...DEFAULT_PORTAL_APP_CATEGORIES];
  const pushUnique = (raw?: string) => {
    const clean = String(raw || '').trim();
    if (clean && !ordered.includes(clean)) {
      ordered.push(clean);
    }
  };
  if (Array.isArray(settings?.portalAppCategories)) {
    settings.portalAppCategories.forEach(pushUnique);
  }
  if (Array.isArray(settings?.portalApps)) {
    settings.portalApps.forEach(app => {
      if (app?.category) pushUnique(app.category);
    });
  }
  return ordered;
}

export const DEFAULT_VACCINATION_START_TIME = '07:00';
export const DEFAULT_VACCINATION_END_TIME = '11:00';
export const DEFAULT_VACCINATION_AUDIENCE =
  'Trẻ em theo lịch Tiêm chủng mở rộng & đối tượng chỉ định trên địa bàn';
export const DEFAULT_VACCINATION_VACCINES =
  'Các loại vắc xin trong Chương trình Tiêm chủng mở rộng theo phân bổ';
export const DEFAULT_VACCINATION_NOTES =
  'Phụ huynh mang theo sổ tiêm chủng và CCCD/mã định danh của trẻ; ở lại theo dõi sau tiêm ít nhất 30 phút.';

const VACCINATION_STATUS_RANK: Record<VaccinationScheduleItem['status'], number> = {
  ongoing: 0,
  upcoming: 1,
  postponed: 2,
  completed: 3,
};

export function sortVaccinationSchedules(
  schedules?: VaccinationScheduleItem[]
): VaccinationScheduleItem[] {
  if (!Array.isArray(schedules)) return [];
  const nowMs = Date.now();
  return [...schedules].sort((a, b) => {
    const statusA = resolveVaccinationLifecycle(a, nowMs).effectiveStatus;
    const statusB = resolveVaccinationLifecycle(b, nowMs).effectiveStatus;
    const rankA = VACCINATION_STATUS_RANK[statusA] ?? 4;
    const rankB = VACCINATION_STATUS_RANK[statusB] ?? 4;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
      return a.isPinned ? -1 : 1;
    }
    const dateCompare = (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31');
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

export function getActiveVaccinationSchedules(
  settings?: Partial<SystemSettings>
): VaccinationScheduleItem[] {
  const list = (settings?.vaccinationSchedules || []).filter(item => item.isActive !== false);
  return sortVaccinationSchedules(list);
}

export function formatIsoDateVN(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatVaccinationDateRange(
  item: Pick<VaccinationScheduleItem, 'date' | 'endDate' | 'dateLabel'>
): string {
  if (item.dateLabel && item.dateLabel.trim()) {
    return item.dateLabel.trim();
  }
  const startFormatted = formatIsoDateVN(item.date);
  if (item.endDate && item.endDate > item.date) {
    return `${startFormatted} - ${formatIsoDateVN(item.endDate)}`;
  }
  return startFormatted || 'Đang cập nhật';
}

export function enumerateDateRange(startIso: string, endIso: string, maxDays = 31): string[] {
  if (!startIso) return [];
  if (!endIso || endIso <= startIso) return [startIso];

  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return [startIso];

  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const dates: string[] = [];

  for (let cur = new Date(start); cur <= end && dates.length < maxDays; cur.setUTCDate(cur.getUTCDate() + 1)) {
    dates.push(cur.toISOString().split('T')[0]);
  }
  return dates.length > 0 ? dates : [startIso];
}

export function sortLocationsPrimaryFirst<T extends { isPrimary?: boolean }>(locations: T[]): T[] {
  return [...locations].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return 0;
  });
}

function parseClockTime(clockStr?: string, fallbackHour = 7, fallbackMin = 0): [number, number] {
  if (!clockStr) return [fallbackHour, fallbackMin];
  const m = clockStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return [fallbackHour, fallbackMin];
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return [h, min];
}

export function getVaccinationBounds(
  item: Pick<VaccinationScheduleItem, 'date' | 'endDate' | 'startTime' | 'endTime' | 'timeRange'>
): { startMs: number; endMs: number } | null {
  if (!item.date) return null;
  const startParts = item.date.split('-').map(Number);
  if (startParts.length !== 3 || startParts.some(n => Number.isNaN(n))) return null;

  const endIso = item.endDate && item.endDate >= item.date ? item.endDate : item.date;
  const endParts = endIso.split('-').map(Number);
  if (endParts.length !== 3 || endParts.some(n => Number.isNaN(n))) return null;

  let startHour = 7;
  let startMin = 0;
  let endHour = 11;
  let endMin = 0;

  const timeMatches = (item.timeRange || '').match(/\b\d{1,2}:\d{2}\b/g);
  if (item.startTime && /^\d{1,2}:\d{2}$/.test(item.startTime.trim())) {
    [startHour, startMin] = parseClockTime(item.startTime, 7, 0);
  } else if (timeMatches && timeMatches.length > 0) {
    [startHour, startMin] = parseClockTime(timeMatches[0], 7, 0);
  }

  if (item.endTime && /^\d{1,2}:\d{2}$/.test(item.endTime.trim())) {
    [endHour, endMin] = parseClockTime(item.endTime, 11, 0);
  } else if (timeMatches && timeMatches.length > 0) {
    [endHour, endMin] = parseClockTime(timeMatches[timeMatches.length - 1], 11, 0);
  }

  const startMs = new Date(startParts[0], startParts[1] - 1, startParts[2], startHour, startMin, 0).getTime();
  let endMs = new Date(endParts[0], endParts[1] - 1, endParts[2], endHour, endMin, 59).getTime();
  if (endMs < startMs) {
    endMs = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59).getTime();
  }
  return { startMs, endMs };
}

export function resolveVaccinationLifecycle(
  item: Pick<VaccinationScheduleItem, 'date' | 'endDate' | 'startTime' | 'endTime' | 'timeRange' | 'status'>,
  nowMs = Date.now()
): {
  effectiveStatus: VaccinationScheduleItem['status'];
  startMs: number | null;
  endMs: number | null;
} {
  const bounds = getVaccinationBounds(item);
  if (!bounds) {
    return { effectiveStatus: item.status, startMs: null, endMs: null };
  }

  if (item.status === 'postponed') {
    return { effectiveStatus: 'postponed', startMs: bounds.startMs, endMs: bounds.endMs };
  }

  let effectiveStatus: VaccinationScheduleItem['status'] = 'upcoming';
  if (nowMs > bounds.endMs) {
    effectiveStatus = 'completed';
  } else if (nowMs >= bounds.startMs && nowMs <= bounds.endMs) {
    effectiveStatus = 'ongoing';
  }

  return {
    effectiveStatus,
    startMs: bounds.startMs,
    endMs: bounds.endMs,
  };
}

export function getConfiguredEmergencyContacts(settings?: Partial<SystemSettings>): EmergencyContact[] {
  if (settings?.emergencyContacts && settings.emergencyContacts.length > 0) {
    return settings.emergencyContacts
      .filter(c => c.phone && c.phone.trim())
      .map((c, idx) => ({
        id: c.id || `ec_${idx + 1}`,
        phone: c.phone.trim(),
        note: (c.note || '').trim(),
      }));
  }
  const primaryPhone = settings?.emergencyPhone?.trim();
  if (!primaryPhone) return [];
  return [
    {
      id: 'ec_1',
      phone: primaryPhone,
      note: (settings?.emergencyNote || '').trim(),
    },
  ];
}

// System Settings
export async function getSystemSettings(): Promise<SystemSettings> {
  const path = 'systemSettings';
  try {
    const docRef = doc(db, path, 'general');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SystemSettings;
    }
    return emptySystemSettings;
  } catch (error) {
    console.warn('System settings read:', error);
    return emptySystemSettings;
  }
}

export async function updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
  const path = 'systemSettings';
  try {
    const docRef = doc(db, path, 'general');
    await setDoc(docRef, cleanDataForFirestore(settings), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Posts (News & Health Education)
export async function getPosts(): Promise<Post[]> {
  const path = 'posts';
  try {
    const q = query(collection(db, path), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
  } catch (error) {
    console.warn('Posts read:', error);
    return [];
  }
}

export async function createPost(post: Omit<Post, 'id'>): Promise<string> {
  const path = 'posts';
  try {
    const ref = await addDoc(collection(db, path), cleanDataForFirestore(post));
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePost(id: string, post: Partial<Post>): Promise<void> {
  const path = `posts/${id}`;
  try {
    await updateDoc(doc(db, 'posts', id), cleanDataForFirestore(post));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePost(id: string): Promise<void> {
  const path = `posts/${id}`;
  try {
    await deleteDoc(doc(db, 'posts', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deletePostsBatch(ids: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return;
  const path = 'posts';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      for (const id of chunk) {
        batch.delete(doc(db, 'posts', id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updatePostsSortOrder(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  if (updates.length === 0) return;
  const path = 'posts';
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      for (const item of chunk) {
        batch.update(doc(db, 'posts', item.id), { sortOrder: item.sortOrder });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Announcements
export async function getAnnouncements(): Promise<Announcement[]> {
  const path = 'announcements';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
  } catch (error) {
    console.warn('Announcements read:', error);
    return [];
  }
}

export async function createAnnouncement(announcement: Omit<Announcement, 'id'>): Promise<string> {
  const path = 'announcements';
  try {
    const ref = await addDoc(collection(db, path), cleanDataForFirestore(announcement));
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const path = `announcements/${id}`;
  try {
    await deleteDoc(doc(db, 'announcements', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Services Catalog
export async function getServices(): Promise<ServiceItem[]> {
  const path = 'services';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceItem));
  } catch (error) {
    console.warn('Services read:', error);
    return [];
  }
}

export async function createService(service: Omit<ServiceItem, 'id'>): Promise<string> {
  const path = 'services';
  try {
    const ref = await addDoc(collection(db, path), cleanDataForFirestore(service));
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateService(id: string, service: Partial<ServiceItem>): Promise<void> {
  const path = `services/${id}`;
  try {
    await updateDoc(doc(db, 'services', id), cleanDataForFirestore(service));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteService(id: string): Promise<void> {
  const path = `services/${id}`;
  try {
    await deleteDoc(doc(db, 'services', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Appointments
export async function getAppointments(): Promise<Appointment[]> {
  const path = 'appointments';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
  } catch (error) {
    console.warn('Appointments read:', error);
    return [];
  }
}

export async function createAppointment(appointment: Omit<Appointment, 'id'>): Promise<string> {
  const path = 'appointments';
  try {
    const ref = await addDoc(collection(db, path), cleanDataForFirestore(appointment));
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAppointmentStatus(
  id: string,
  status: Appointment['status'],
  responseNotes?: string
): Promise<void> {
  const path = `appointments/${id}`;
  try {
    const payload: Record<string, any> = { status };
    if (responseNotes !== undefined) {
      payload.responseNotes = responseNotes;
    }
    await updateDoc(doc(db, 'appointments', id), cleanDataForFirestore(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  const path = `appointments/${id}`;
  try {
    await deleteDoc(doc(db, 'appointments', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const MY_FEEDBACK_HISTORY_KEY = 'my_feedback_history';
export const FEEDBACK_HISTORY_EVENT = 'tyt_feedback_history_updated';
const FEEDBACK_HISTORY_MAX_AGE_MS = 42 * 24 * 60 * 60 * 1000; // ~30 business days

export interface LocalFeedbackHistoryItem {
  id?: string;
  code: string;
  date: string;
  createdAtIso: string;
  content: string;
  sender?: string;
  category?: FeedbackItem['category'];
  status?: FeedbackItem['status'];
  withdrawnAt?: string;
  attachments?: FeedbackAttachment[];
  githubBackupUrl?: string;
  uid?: string;
  deviceId?: string;
}

export function parseVietnameseOrIsoDateMs(dateStr?: string, createdAtIso?: string): number {
  if (createdAtIso) {
    const isoMs = Date.parse(createdAtIso);
    if (!Number.isNaN(isoMs)) return isoMs;
  }
  if (!dateStr) return NaN;
  const directMs = Date.parse(dateStr);
  if (!Number.isNaN(directMs)) return directMs;
  // Support vi-VN toLocaleString format like "03:50:12 14/11/2026" or "14/11/2026, 03:50:12"
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const timeMatch = dateStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    const hours = timeMatch ? Number(timeMatch[1]) : 0;
    const mins = timeMatch ? Number(timeMatch[2]) : 0;
    const secs = timeMatch && timeMatch[3] ? Number(timeMatch[3]) : 0;
    return new Date(year, month, day, hours, mins, secs).getTime();
  }
  return NaN;
}

export function loadLocalFeedbackHistory(): LocalFeedbackHistoryItem[] {
  try {
    const raw = localStorage.getItem(MY_FEEDBACK_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const valid: LocalFeedbackHistoryItem[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || !item.code) continue;
      const itemMs = parseVietnameseOrIsoDateMs(item.date, item.createdAtIso);
      const validMs = Number.isNaN(itemMs) ? now : itemMs;
      if (now - validMs <= FEEDBACK_HISTORY_MAX_AGE_MS) {
        valid.push({
          ...item,
          createdAtIso: item.createdAtIso || new Date(validMs).toISOString(),
        });
      }
    }
    valid.sort((a, b) => {
      const msA = Date.parse(a.createdAtIso || '') || 0;
      const msB = Date.parse(b.createdAtIso || '') || 0;
      return msB - msA;
    });
    if (valid.length !== parsed.length) {
      localStorage.setItem(MY_FEEDBACK_HISTORY_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return [];
  }
}

export function loadScopedLocalFeedbackHistory(
  uid?: string | null,
  deviceId?: string
): LocalFeedbackHistoryItem[] {
  const all = loadLocalFeedbackHistory();
  const cleanUid = uid?.trim() || '';
  if (cleanUid) {
    return all.filter(item => item.uid === cleanUid);
  }
  const resolvedDeviceId = deviceId?.trim() || getOrCreateDeviceId();
  return all.filter(
    item => item.uid === '' && item.deviceId === resolvedDeviceId
  );
}

export function saveLocalFeedbackHistory(items: LocalFeedbackHistoryItem[]): void {
  try {
    localStorage.setItem(MY_FEEDBACK_HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(FEEDBACK_HISTORY_EVENT));
    }
  } catch (e) {
    console.warn('Save local feedback history error:', e);
  }
}

export function appendLocalFeedbackHistory(entry: LocalFeedbackHistoryItem): LocalFeedbackHistoryItem[] {
  const existing = loadLocalFeedbackHistory().filter(
    item => item.code.toUpperCase() !== entry.code.toUpperCase()
  );
  const next = [entry, ...existing].slice(0, 50);
  saveLocalFeedbackHistory(next);
  return next;
}

export function updateLocalFeedbackHistoryItem(
  codeOrId: string,
  patch: Partial<LocalFeedbackHistoryItem>
): LocalFeedbackHistoryItem[] {
  const target = codeOrId.trim().toUpperCase();
  const next = loadLocalFeedbackHistory().map(item =>
    item.code.toUpperCase() === target || (item.id && item.id.toUpperCase() === target)
      ? { ...item, ...patch }
      : item
  );
  saveLocalFeedbackHistory(next);
  return next;
}

export function generateFeedbackTicketCode(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(100000 + Math.random() * 900000);
  return `PA-${year}-${num}`;
}

// Feedback & Petitions
export async function getFeedbackList(): Promise<FeedbackItem[]> {
  const path = 'feedback';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackItem));
  } catch (error) {
    console.warn('Feedback read:', error);
    return [];
  }
}

export async function getFeedbackByIdOrCode(idOrCode: string): Promise<FeedbackItem | null> {
  const clean = idOrCode.trim();
  if (!clean) return null;
  try {
    const snap = await getDoc(doc(db, 'feedback', clean));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as FeedbackItem;
    }
    const upper = clean.toUpperCase();
    if (upper !== clean) {
      const upperSnap = await getDoc(doc(db, 'feedback', upper));
      if (upperSnap.exists()) {
        return { id: upperSnap.id, ...upperSnap.data() } as FeedbackItem;
      }
    }
    return null;
  } catch (error) {
    console.warn('Feedback single read:', error);
    return null;
  }
}

export async function createFeedback(feedback: Omit<FeedbackItem, 'id'>): Promise<string> {
  const path = 'feedback';
  const deviceId = getOrCreateDeviceId();
  const payload = cleanDataForFirestore({
    ...feedback,
    deviceId: feedback.deviceId || deviceId,
    uid: feedback.uid || auth.currentUser?.uid || '',
  });
  try {
    const docId = feedback.ticketCode?.trim();
    if (docId && /^[a-zA-Z0-9_-]{3,128}$/.test(docId)) {
      const targetRef = doc(db, path, docId);
      await setDoc(targetRef, payload);
      return docId;
    }
    const ref = await addDoc(collection(db, path), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFeedbackResponse(
  id: string,
  status: FeedbackItem['status'],
  response?: string,
  assignedDepartment?: string
): Promise<void> {
  const path = `feedback/${id}`;
  try {
    const payload: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (response !== undefined) {
      payload.response = response;
    }
    if (assignedDepartment !== undefined && assignedDepartment.trim() !== '') {
      payload.assignedDepartment = assignedDepartment.trim();
    }
    await updateDoc(doc(db, 'feedback', id), cleanDataForFirestore(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface WithdrawFeedbackResult {
  withdrawnAt: string;
  foundInFirestore: boolean;
  resolvedId: string;
}

export async function withdrawFeedback(
  idOrCode: string,
  ticketCode?: string
): Promise<WithdrawFeedbackResult> {
  const nowIso = new Date().toISOString();
  const primaryId = idOrCode.trim();
  const codeToMatch = (ticketCode || idOrCode).trim();

  if (!auth.currentUser?.uid) {
    return {
      withdrawnAt: nowIso,
      foundInFirestore: false,
      resolvedId: primaryId || codeToMatch,
    };
  }

  let resolvedId: string | null = null;
  let existingData: Record<string, any> | null = null;

  try {
    if (primaryId) {
      const snap = await getDoc(doc(db, 'feedback', primaryId));
      if (snap.exists()) {
        resolvedId = snap.id;
        existingData = snap.data();
      }
    }

    if (!resolvedId && codeToMatch && codeToMatch !== primaryId) {
      const codeSnap = await getDoc(doc(db, 'feedback', codeToMatch));
      if (codeSnap.exists()) {
        resolvedId = codeSnap.id;
        existingData = codeSnap.data();
      }
    }

    // Legacy fallback: docs created previously via addDoc() have random IDs instead of ticketCode
    if (!resolvedId && codeToMatch && auth.currentUser?.uid) {
      try {
        const ownSnap = await getDocs(
          query(
            collection(db, 'feedback'),
            where('uid', '==', auth.currentUser.uid),
            where('ticketCode', '==', codeToMatch)
          )
        );
        if (!ownSnap.empty) {
          resolvedId = ownSnap.docs[0].id;
          existingData = ownSnap.docs[0].data();
        }
      } catch {
        // Ignore if query fails permissions
      }
    }

    if (!resolvedId && codeToMatch) {
      try {
        const staffSnap = await getDocs(
          query(collection(db, 'feedback'), where('ticketCode', '==', codeToMatch))
        );
        if (!staffSnap.empty) {
          resolvedId = staffSnap.docs[0].id;
          existingData = staffSnap.docs[0].data();
        }
      } catch {
        // Non-staff citizens cannot run collection-wide ticketCode queries; safely ignore
      }
    }
  } catch (lookupErr) {
    console.warn('Lookup feedback before withdraw failed:', lookupErr);
  }

  if (!resolvedId) {
    return {
      withdrawnAt: nowIso,
      foundInFirestore: false,
      resolvedId: primaryId || codeToMatch,
    };
  }

  if (existingData?.status === 'withdrawn') {
    return {
      withdrawnAt: existingData.withdrawnAt || nowIso,
      foundInFirestore: true,
      resolvedId,
    };
  }

  const path = `feedback/${resolvedId}`;
  try {
    await updateDoc(
      doc(db, 'feedback', resolvedId),
      cleanDataForFirestore({
        status: 'withdrawn',
        withdrawnAt: nowIso,
        updatedAt: nowIso,
      })
    );
    return {
      withdrawnAt: nowIso,
      foundInFirestore: true,
      resolvedId,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFeedback(id: string): Promise<void> {
  const path = `feedback/${id}`;
  try {
    await deleteDoc(doc(db, 'feedback', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Staff Tasks
export async function getStaffTasks(): Promise<StaffTask[]> {
  const path = 'tasks';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffTask));
  } catch (error) {
    console.warn('Staff tasks read:', error);
    return [];
  }
}

export async function createStaffTask(task: Omit<StaffTask, 'id'>): Promise<string> {
  const path = 'tasks';
  try {
    const ref = await addDoc(collection(db, path), cleanDataForFirestore(task));
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStaffTaskStatus(id: string, status: StaffTask['status']): Promise<void> {
  const path = `tasks/${id}`;
  try {
    await updateDoc(doc(db, 'tasks', id), cleanDataForFirestore({ status }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteStaffTask(id: string): Promise<void> {
  const path = `tasks/${id}`;
  try {
    await deleteDoc(doc(db, 'tasks', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Work Schedules & Duty
export async function getWorkSchedules(): Promise<WorkSchedule[]> {
  const path = 'workSchedules';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkSchedule));
  } catch (error) {
    console.warn('Work schedules read:', error);
    return [];
  }
}

export async function createWorkSchedule(schedule: Omit<WorkSchedule, 'id'>): Promise<string> {
  const path = 'workSchedules';
  try {
    const ref = await addDoc(collection(db, path), cleanDataForFirestore(schedule));
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorkSchedule(id: string, schedule: Partial<WorkSchedule>): Promise<void> {
  const path = `workSchedules/${id}`;
  try {
    await updateDoc(doc(db, 'workSchedules', id), cleanDataForFirestore(schedule));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWorkSchedule(id: string): Promise<void> {
  const path = `workSchedules/${id}`;
  try {
    await deleteDoc(doc(db, 'workSchedules', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Documents
export async function getDocuments(): Promise<DocumentItem[]> {
  const path = 'documents';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentItem));
  } catch (error) {
    console.warn('Documents read:', error);
    return [];
  }
}

const MAX_SAFE_FIRESTORE_DOC_BYTES = 920_000;

function assertDocumentPayloadWithinLimit(payload: Record<string, any>): void {
  const byteSize = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (byteSize > MAX_SAFE_FIRESTORE_DOC_BYTES) {
    const sizeMb = (byteSize / (1024 * 1024)).toFixed(2);
    throw new Error(
      `Dữ liệu văn bản (${sizeMb} MB) vượt quá giới hạn tối đa ~0.9 MB của Firestore. Vui lòng cấu hình lưu trữ GitHub trong Quản trị hệ thống hoặc dán đường dẫn Google Drive / liên kết ngoài.`
    );
  }
}

export async function createDocumentItem(docItem: Omit<DocumentItem, 'id'>): Promise<string> {
  const path = 'documents';
  const cleaned = cleanDataForFirestore(docItem);
  assertDocumentPayloadWithinLimit(cleaned);
  try {
    const ref = await addDoc(collection(db, path), cleaned);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDocumentItem(id: string, docItem: Partial<DocumentItem>): Promise<void> {
  const path = `documents/${id}`;
  const cleaned = cleanDataForFirestore(docItem);
  assertDocumentPayloadWithinLimit(cleaned);
  try {
    await updateDoc(doc(db, 'documents', id), cleaned);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDocumentItem(id: string): Promise<void> {
  const path = `documents/${id}`;
  try {
    await deleteDoc(doc(db, 'documents', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Audit Logs
export async function getAuditLogs(): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
  } catch (error) {
    console.warn('Audit logs read:', error);
    return [];
  }
}

export async function logAuditEvent(
  action: string,
  module: string,
  details: string,
  user?: { uid: string; name: string }
): Promise<void> {
  const path = 'auditLogs';
  try {
    await addDoc(
      collection(db, path),
      cleanDataForFirestore({
        userUid: user?.uid || 'anonymous',
        userName: user?.name || 'Khách truy cập',
        action,
        module,
        details,
        timestamp: new Date().toLocaleString('vi-VN'),
      })
    );
  } catch {
    // Non-blocking
  }
}

// User Profiles
export async function getUserProfiles(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
  } catch {
    return [];
  }
}

export async function updateUserRole(
  uid: string,
  role: UserProfile['role'],
  accountType: UserProfile['accountType']
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      accountType,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, any> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined) {
        payload[key] = deleteField();
      } else {
        payload[key] = value;
      }
    });
    payload.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserProfile(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
    try {
      await deleteDoc(doc(db, 'admins', uid));
    } catch {
      // Admin registry doc might not exist for non-admin users
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const deleteUserAccount = deleteUserProfile;

// Targeted Notifications (CCCD, Phone, Org, All, Read/Unread + Analytics)
export async function createTargetedNotification(
  item: Omit<TargetedNotification, 'id' | 'readByUids' | 'createdAt'>
): Promise<string> {
  const path = 'targetedNotifications';
  try {
    const payload = cleanDataForFirestore({
      ...item,
      readByUids: [],
      readByDeviceIds: [],
      viewCount: 0,
      createdAt: new Date().toISOString(),
    });
    const ref = await addDoc(collection(db, path), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function markNotificationAsRead(
  notificationId: string,
  userUid: string
): Promise<void> {
  return markNotificationViewed(notificationId, userUid);
}

export async function markNotificationViewed(
  notificationId: string,
  userUid?: string
): Promise<void> {
  if (!notificationId) return;
  const deviceId = getOrCreateDeviceId();
  const countedKey = 'tyt_counted_notif_views_v1';
  let alreadyCounted = false;
  try {
    const raw = localStorage.getItem(countedKey);
    const list: string[] = raw ? JSON.parse(raw) : [];
    alreadyCounted = Array.isArray(list) && list.includes(notificationId);
    if (!alreadyCounted) {
      localStorage.setItem(countedKey, JSON.stringify([...list, notificationId].slice(-300)));
    }
  } catch {
    // ignore storage errors
  }

  try {
    const updatePayload: Record<string, any> = {
      readByDeviceIds: arrayUnion(deviceId),
    };
    if (userUid) {
      updatePayload.readByUids = arrayUnion(userUid);
    }
    if (!alreadyCounted) {
      updatePayload.viewCount = increment(1);
    }
    await updateDoc(doc(db, 'targetedNotifications', notificationId), updatePayload);
  } catch (error) {
    console.warn('Mark notification viewed error:', error);
  }
}

export async function markAnnouncementViewed(announcementId: string): Promise<void> {
  if (!announcementId) return;
  const deviceId = getOrCreateDeviceId();
  const countedKey = 'tyt_counted_ann_views_v1';
  let alreadyCounted = false;
  try {
    const raw = localStorage.getItem(countedKey);
    const list: string[] = raw ? JSON.parse(raw) : [];
    alreadyCounted = Array.isArray(list) && list.includes(announcementId);
    if (!alreadyCounted) {
      localStorage.setItem(countedKey, JSON.stringify([...list, announcementId].slice(-200)));
    }
  } catch {
    // ignore
  }

  try {
    const updatePayload: Record<string, any> = {
      readByDeviceIds: arrayUnion(deviceId),
    };
    if (!alreadyCounted) {
      updatePayload.viewCount = increment(1);
    }
    await updateDoc(doc(db, 'announcements', announcementId), updatePayload);
  } catch (error) {
    console.warn('Mark announcement viewed error:', error);
  }
}

export async function recordPostViewOnce(postId: string): Promise<void> {
  if (!postId || isFirestoreWriteQuotaExceeded()) return;
  const viewedKey = 'tyt_viewed_posts_v1';
  try {
    const raw = sessionStorage.getItem(viewedKey);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && list.includes(postId)) {
      return;
    }
    sessionStorage.setItem(viewedKey, JSON.stringify([...list, postId].slice(-200)));
  } catch {
    // ignore session storage errors
  }

  try {
    await updateDoc(doc(db, 'posts', postId), {
      views: increment(1),
    });
  } catch (error) {
    markFirestoreWriteQuotaExceededIfMatch(error);
    console.warn('Record post view error:', error);
  }
}

export async function savePushSubscriptionRecord(
  record: PushSubscriptionRecord
): Promise<void> {
  if (!record.deviceId || isFirestoreWriteQuotaExceeded()) return;
  try {
    await setDoc(
      doc(db, 'pushSubscriptions', record.deviceId),
      cleanDataForFirestore(record),
      { merge: true }
    );
  } catch (error) {
    markFirestoreWriteQuotaExceededIfMatch(error);
    console.warn('Save push subscription record error:', error);
  }
}

export async function deletePushSubscriptionRecord(deviceId: string): Promise<void> {
  if (!deviceId) return;
  try {
    await deleteDoc(doc(db, 'pushSubscriptions', deviceId));
  } catch (error) {
    console.warn('Delete push subscription record error:', error);
  }
}

export async function deleteTargetedNotification(id: string): Promise<void> {
  const path = `targetedNotifications/${id}`;
  try {
    await deleteDoc(doc(db, 'targetedNotifications', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Nearby Healthcare Facilities (Cơ sở Y tế lân cận)
function sanitizePendingEditPayload(
  editData?: NearbyFacilityEditPayload
): NearbyFacilityEditPayload | undefined {
  if (!editData) return undefined;
  return cleanDataForFirestore({
    name: String(editData.name || '').trim().slice(0, 256),
    facilityType: editData.facilityType,
    level: String(editData.level || '').trim().slice(0, 128),
    address: String(editData.address || '').trim().slice(0, 512),
    ward: String(editData.ward || '').trim().slice(0, 128),
    lat: Math.max(-90, Math.min(90, Number(editData.lat) || 0)),
    lng: Math.max(-180, Math.min(180, Number(editData.lng) || 0)),
    phone: String(editData.phone || '').trim().slice(0, 64),
    emergencyPhone: String(editData.emergencyPhone || '').trim().slice(0, 64),
    workingHours: String(editData.workingHours || '').trim().slice(0, 256),
    is24Hours: Boolean(editData.is24Hours),
    hasEmergency: Boolean(editData.hasEmergency),
    hasBhyt: Boolean(editData.hasBhyt),
    services: String(editData.services || '').trim().slice(0, 2000),
    bedCount: Math.max(0, Math.round(Number(editData.bedCount) || 0)),
    headName: String(editData.headName || '').trim().slice(0, 128),
    website: String(editData.website || '').trim().slice(0, 512),
    notes: String(editData.notes || '').trim().slice(0, 2000),
    submittedBy: editData.submittedBy?.trim()
      ? editData.submittedBy.trim().slice(0, 128)
      : undefined,
    requestedAt: (editData.requestedAt || new Date().toISOString()).slice(0, 64),
  });
}

function sanitizeNearbyFacilityPayload(
  item: Partial<Omit<NearbyFacility, 'id'>>,
  isCreate: boolean
): Record<string, any> {
  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {};

  if (item.name !== undefined) payload.name = String(item.name).trim().slice(0, 256);
  if (item.facilityType !== undefined) payload.facilityType = item.facilityType;
  if (item.level !== undefined && item.level.trim()) payload.level = item.level.trim().slice(0, 128);
  if (item.address !== undefined) payload.address = String(item.address).trim().slice(0, 512);
  if (item.ward !== undefined && item.ward.trim()) payload.ward = item.ward.trim().slice(0, 128);
  if (typeof item.lat === 'number' && !Number.isNaN(item.lat)) {
    payload.lat = Math.max(-90, Math.min(90, item.lat));
  }
  if (typeof item.lng === 'number' && !Number.isNaN(item.lng)) {
    payload.lng = Math.max(-180, Math.min(180, item.lng));
  }
  if (item.phone !== undefined && item.phone.trim()) payload.phone = item.phone.trim().slice(0, 64);
  if (item.emergencyPhone !== undefined && item.emergencyPhone.trim()) {
    payload.emergencyPhone = item.emergencyPhone.trim().slice(0, 64);
  }
  if (item.workingHours !== undefined && item.workingHours.trim()) {
    payload.workingHours = item.workingHours.trim().slice(0, 256);
  }
  if (typeof item.is24Hours === 'boolean') payload.is24Hours = item.is24Hours;
  if (typeof item.hasEmergency === 'boolean') payload.hasEmergency = item.hasEmergency;
  if (typeof item.hasBhyt === 'boolean') payload.hasBhyt = item.hasBhyt;
  if (item.services !== undefined && item.services.trim()) {
    payload.services = item.services.trim().slice(0, 2000);
  }
  if (typeof item.bedCount === 'number' && !Number.isNaN(item.bedCount)) {
    payload.bedCount = Math.max(0, Math.round(item.bedCount));
  }
  if (item.headName !== undefined && item.headName.trim()) {
    payload.headName = item.headName.trim().slice(0, 128);
  }
  if (item.website !== undefined && item.website.trim()) {
    payload.website = item.website.trim().slice(0, 512);
  }
  if (item.notes !== undefined && item.notes.trim()) {
    payload.notes = item.notes.trim().slice(0, 2000);
  }
  if (
    item.approvalStatus === 'approved' ||
    item.approvalStatus === 'pending' ||
    item.approvalStatus === 'rejected'
  ) {
    payload.approvalStatus = item.approvalStatus;
  }
  if (item.submittedBy !== undefined && item.submittedBy.trim()) {
    payload.submittedBy = item.submittedBy.trim().slice(0, 128);
  }
  if (item.submittedByUid !== undefined && item.submittedByUid.trim()) {
    payload.submittedByUid = item.submittedByUid.trim().slice(0, 128);
  }
  if (item.submitterDeviceId !== undefined && item.submitterDeviceId.trim()) {
    payload.submitterDeviceId = item.submitterDeviceId.trim().slice(0, 128);
  }
  if (item.rejectionReason !== undefined && item.rejectionReason.trim()) {
    payload.rejectionReason = item.rejectionReason.trim().slice(0, 512);
  }
  if (
    item.editStatus === 'none' ||
    item.editStatus === 'pending_edit' ||
    item.editStatus === 'rejected_edit'
  ) {
    payload.editStatus = item.editStatus;
  }
  if (item.pendingEditData) {
    payload.pendingEditData = sanitizePendingEditPayload(item.pendingEditData);
  }
  if (item.editRequestedAt !== undefined && item.editRequestedAt.trim()) {
    payload.editRequestedAt = item.editRequestedAt.trim().slice(0, 64);
  }
  if (item.editRejectionReason !== undefined && item.editRejectionReason.trim()) {
    payload.editRejectionReason = item.editRejectionReason.trim().slice(0, 512);
  }
  if (typeof item.isActive === 'boolean') payload.isActive = item.isActive;
  if (typeof item.order === 'number' && !Number.isNaN(item.order)) payload.order = item.order;

  if (isCreate) {
    payload.createdAt = (item.createdAt || nowIso).slice(0, 64);
    payload.updatedAt = (item.updatedAt || nowIso).slice(0, 64);
    if (payload.isActive === undefined) payload.isActive = true;
  } else {
    if (item.createdAt) payload.createdAt = item.createdAt.slice(0, 64);
    payload.updatedAt = nowIso;
  }

  return cleanDataForFirestore(payload);
}

export async function createNearbyFacility(
  item: Omit<NearbyFacility, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'nearbyFacilities';
  try {
    const id = `fac_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = sanitizeNearbyFacilityPayload(
      {
        ...item,
        approvalStatus: item.approvalStatus || 'approved',
        editStatus: item.editStatus || 'none',
      },
      true
    );
    await setDoc(doc(db, path, id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export interface PendingNearbyFacilityInput {
  name: string;
  facilityType: NearbyFacility['facilityType'];
  level: string;
  address: string;
  ward: string;
  lat: number;
  lng: number;
  phone: string;
  emergencyPhone: string;
  workingHours: string;
  is24Hours: boolean;
  hasEmergency: boolean;
  hasBhyt: boolean;
  services: string;
  bedCount: number;
  headName: string;
  website: string;
  notes: string;
  submittedBy?: string;
  submittedByUid?: string;
  submitterDeviceId?: string;
}

export async function submitPendingNearbyFacility(
  input: PendingNearbyFacilityInput
): Promise<{ id: string; createdAt: string; deviceId: string; uid: string }> {
  const path = 'nearbyFacilities';
  try {
    const nowIso = new Date().toISOString();
    const id = `fac_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const resolvedUid = (input.submittedByUid ?? auth.currentUser?.uid ?? '').trim().slice(0, 128);
    const resolvedDeviceId = (input.submitterDeviceId || getOrCreateDeviceId()).trim().slice(0, 128);

    const payload = cleanDataForFirestore({
      name: input.name.trim().slice(0, 256),
      facilityType: input.facilityType,
      level: input.level.trim().slice(0, 128),
      address: input.address.trim().slice(0, 512),
      ward: input.ward.trim().slice(0, 128),
      lat: Math.max(-90, Math.min(90, input.lat)),
      lng: Math.max(-180, Math.min(180, input.lng)),
      phone: input.phone.trim().slice(0, 64),
      emergencyPhone: input.emergencyPhone.trim().slice(0, 64),
      workingHours: input.workingHours.trim().slice(0, 256),
      is24Hours: Boolean(input.is24Hours),
      hasEmergency: Boolean(input.hasEmergency),
      hasBhyt: Boolean(input.hasBhyt),
      services: input.services.trim().slice(0, 2000),
      bedCount: Math.max(0, Math.round(input.bedCount)),
      headName: input.headName.trim().slice(0, 128),
      website: input.website.trim().slice(0, 512),
      notes: input.notes.trim().slice(0, 2000),
      submittedBy: input.submittedBy?.trim()
        ? input.submittedBy.trim().slice(0, 128)
        : undefined,
      submittedByUid: resolvedUid || undefined,
      submitterDeviceId: resolvedDeviceId,
      approvalStatus: 'pending',
      editStatus: 'none',
      isActive: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await setDoc(doc(db, path, id), payload);
    return {
      id,
      createdAt: nowIso,
      deviceId: resolvedDeviceId,
      uid: resolvedUid,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function resubmitPendingNearbyFacility(
  id: string,
  input: PendingNearbyFacilityInput & {
    createdAt: string;
    submittedByUid?: string;
    submitterDeviceId?: string;
  }
): Promise<{ updatedAt: string }> {
  const path = `nearbyFacilities/${id}`;
  try {
    const nowIso = new Date().toISOString();
    const resolvedUid = (input.submittedByUid ?? auth.currentUser?.uid ?? '').trim().slice(0, 128);
    const resolvedDeviceId = (input.submitterDeviceId || getOrCreateDeviceId()).trim().slice(0, 128);

    const payload = cleanDataForFirestore({
      name: input.name.trim().slice(0, 256),
      facilityType: input.facilityType,
      level: input.level.trim().slice(0, 128),
      address: input.address.trim().slice(0, 512),
      ward: input.ward.trim().slice(0, 128),
      lat: Math.max(-90, Math.min(90, input.lat)),
      lng: Math.max(-180, Math.min(180, input.lng)),
      phone: input.phone.trim().slice(0, 64),
      emergencyPhone: input.emergencyPhone.trim().slice(0, 64),
      workingHours: input.workingHours.trim().slice(0, 256),
      is24Hours: Boolean(input.is24Hours),
      hasEmergency: Boolean(input.hasEmergency),
      hasBhyt: Boolean(input.hasBhyt),
      services: input.services.trim().slice(0, 2000),
      bedCount: Math.max(0, Math.round(input.bedCount)),
      headName: input.headName.trim().slice(0, 128),
      website: input.website.trim().slice(0, 512),
      notes: input.notes.trim().slice(0, 2000),
      submittedBy: input.submittedBy?.trim()
        ? input.submittedBy.trim().slice(0, 128)
        : undefined,
      submittedByUid: resolvedUid || undefined,
      submitterDeviceId: resolvedDeviceId,
      approvalStatus: 'pending',
      editStatus: 'none',
      isActive: false,
      createdAt: (input.createdAt || nowIso).slice(0, 64),
      updatedAt: nowIso,
    });
    await setDoc(doc(db, 'nearbyFacilities', id), payload);
    return { updatedAt: nowIso };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function proposeApprovedFacilityEdit(
  id: string,
  input: PendingNearbyFacilityInput
): Promise<{ pendingEditData: NearbyFacilityEditPayload; editRequestedAt: string }> {
  const path = `nearbyFacilities/${id}`;
  try {
    const nowIso = new Date().toISOString();
    const pendingEditData: NearbyFacilityEditPayload = cleanDataForFirestore({
      name: input.name.trim().slice(0, 256),
      facilityType: input.facilityType,
      level: input.level.trim().slice(0, 128),
      address: input.address.trim().slice(0, 512),
      ward: input.ward.trim().slice(0, 128),
      lat: Math.max(-90, Math.min(90, input.lat)),
      lng: Math.max(-180, Math.min(180, input.lng)),
      phone: input.phone.trim().slice(0, 64),
      emergencyPhone: input.emergencyPhone.trim().slice(0, 64),
      workingHours: input.workingHours.trim().slice(0, 256),
      is24Hours: Boolean(input.is24Hours),
      hasEmergency: Boolean(input.hasEmergency),
      hasBhyt: Boolean(input.hasBhyt),
      services: input.services.trim().slice(0, 2000),
      bedCount: Math.max(0, Math.round(input.bedCount)),
      headName: input.headName.trim().slice(0, 128),
      website: input.website.trim().slice(0, 512),
      notes: input.notes.trim().slice(0, 2000),
      submittedBy: input.submittedBy?.trim()
        ? input.submittedBy.trim().slice(0, 128)
        : undefined,
      requestedAt: nowIso,
    });

    await updateDoc(
      doc(db, 'nearbyFacilities', id),
      cleanDataForFirestore({
        editStatus: 'pending_edit',
        pendingEditData,
        editRequestedAt: nowIso,
        editRejectionReason: '',
        updatedAt: nowIso,
      })
    );
    return { pendingEditData, editRequestedAt: nowIso };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export const NEARBY_FACILITY_HISTORY_KEY = 'tyt_nearby_facility_history_v1';

export function loadLocalNearbyFacilityHistory(
  uid?: string | null,
  deviceId?: string
): NearbyFacility[] {
  try {
    const raw = localStorage.getItem(NEARBY_FACILITY_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const cleanUid = uid?.trim() || '';
    const resolvedDeviceId = (deviceId || getOrCreateDeviceId()).trim();

    return (parsed as NearbyFacility[])
      .filter(item => {
        if (!item || typeof item !== 'object' || !item.id) return false;
        if (cleanUid) {
          return item.submittedByUid === cleanUid || (!item.submittedByUid && item.submitterDeviceId === resolvedDeviceId);
        }
        return !item.submittedByUid && item.submitterDeviceId === resolvedDeviceId;
      })
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  } catch {
    return [];
  }
}

export function upsertLocalNearbyFacilityHistory(entry: NearbyFacility): void {
  try {
    const raw = localStorage.getItem(NEARBY_FACILITY_HISTORY_KEY);
    const list: NearbyFacility[] = raw ? JSON.parse(raw) : [];
    const filtered = (Array.isArray(list) ? list : []).filter(item => item && item.id !== entry.id);
    const next = [entry, ...filtered].slice(0, 60);
    localStorage.setItem(NEARBY_FACILITY_HISTORY_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('Save local nearby facility history error:', e);
  }
}

export async function updateNearbyFacility(
  id: string,
  item: NearbyFacility
): Promise<void> {
  const path = `nearbyFacilities/${id}`;
  try {
    const { id: _unused, ...rest } = item;
    const payload = sanitizeNearbyFacilityPayload(rest, false);
    await setDoc(doc(db, 'nearbyFacilities', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteNearbyFacility(id: string): Promise<void> {
  const path = `nearbyFacilities/${id}`;
  try {
    await deleteDoc(doc(db, 'nearbyFacilities', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// Rescue Signals (Bản đồ Cứu hộ cứu nạn)
export async function createRescueSignal(
  input: Omit<RescueSignal, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'rescueSignals';
  try {
    const nowIso = new Date().toISOString();
    const id = `sos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = cleanDataForFirestore({
      phone: input.phone.trim().slice(0, 32),
      extraPhone: input.extraPhone?.trim() ? input.extraPhone.trim().slice(0, 32) : undefined,
      senderName: input.senderName?.trim() ? input.senderName.trim().slice(0, 128) : undefined,
      senderAvatarUrl: input.senderAvatarUrl?.trim()
        ? input.senderAvatarUrl.trim().slice(0, 500000)
        : undefined,
      senderCitizenIdMasked: input.senderCitizenIdMasked?.trim()
        ? input.senderCitizenIdMasked.trim().slice(0, 32)
        : undefined,
      senderDob: input.senderDob?.trim() ? input.senderDob.trim().slice(0, 32) : undefined,
      senderGender: input.senderGender,
      senderAddress: input.senderAddress?.trim()
        ? input.senderAddress.trim().slice(0, 512)
        : undefined,
      senderVerified: typeof input.senderVerified === 'boolean' ? input.senderVerified : undefined,
      category: input.category,
      note: input.note?.trim() ? input.note.trim().slice(0, 1000) : undefined,
      lat: Math.max(-90, Math.min(90, input.lat)),
      lng: Math.max(-180, Math.min(180, input.lng)),
      accuracy: typeof input.accuracy === 'number' ? Math.round(input.accuracy) : undefined,
      status: 'active',
      deviceId: input.deviceId.slice(0, 128),
      uid: input.uid ? input.uid.slice(0, 128) : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await setDoc(doc(db, path, id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateRescueSignal(
  id: string,
  patch: Partial<
    Pick<
      RescueSignal,
      | 'lat'
      | 'lng'
      | 'accuracy'
      | 'status'
      | 'note'
      | 'responderName'
      | 'responderPhone'
      | 'responderNote'
      | 'outcome'
      | 'referredToFacility'
      | 'resolvedAt'
    >
  >
): Promise<void> {
  const path = `rescueSignals/${id}`;
  try {
    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (typeof patch.lat === 'number') payload.lat = Math.max(-90, Math.min(90, patch.lat));
    if (typeof patch.lng === 'number') payload.lng = Math.max(-180, Math.min(180, patch.lng));
    if (typeof patch.accuracy === 'number') payload.accuracy = Math.round(patch.accuracy);
    if (patch.status) payload.status = patch.status;
    if (patch.note !== undefined) payload.note = patch.note.trim().slice(0, 1000);
    if (patch.responderName !== undefined) payload.responderName = patch.responderName.trim().slice(0, 128);
    if (patch.responderPhone !== undefined) payload.responderPhone = patch.responderPhone.trim().slice(0, 32);
    if (patch.responderNote !== undefined) payload.responderNote = patch.responderNote.trim().slice(0, 1000);
    if (patch.outcome !== undefined) payload.outcome = patch.outcome;
    if (patch.referredToFacility !== undefined) {
      payload.referredToFacility = patch.referredToFacility.trim().slice(0, 256);
    }
    if (patch.resolvedAt !== undefined) payload.resolvedAt = patch.resolvedAt.slice(0, 64);

    await updateDoc(doc(db, 'rescueSignals', id), cleanDataForFirestore(payload));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteRescueSignal(id: string): Promise<void> {
  const path = `rescueSignals/${id}`;
  try {
    await deleteDoc(doc(db, 'rescueSignals', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// ==========================================
// Station Events & Holiday Celebrations
// ==========================================

export function getVietnamTodayKey(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function diffIsoDays(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function isEventHappeningToday(
  ev: Pick<StationEvent, 'eventDate' | 'endDate' | 'isAnnual' | 'isActive'>,
  todayKey = getVietnamTodayKey()
): boolean {
  if (ev.isActive === false || !ev.eventDate) return false;
  if (ev.isAnnual) {
    const startMd = ev.eventDate.slice(5, 10);
    const todayMd = todayKey.slice(5, 10);
    if (ev.endDate && ev.endDate >= ev.eventDate) {
      const endMd = ev.endDate.slice(5, 10);
      if (endMd >= startMd) {
        return todayMd >= startMd && todayMd <= endMd;
      }
      return todayMd >= startMd || todayMd <= endMd;
    }
    return todayMd === startMd;
  }
  if (ev.endDate && ev.endDate >= ev.eventDate) {
    return todayKey >= ev.eventDate && todayKey <= ev.endDate;
  }
  return todayKey === ev.eventDate;
}

export function resolveEventStatus(
  ev: Pick<StationEvent, 'eventDate' | 'endDate' | 'isAnnual' | 'isActive'>,
  todayKey = getVietnamTodayKey()
): { status: 'today' | 'upcoming' | 'past'; daysUntil: number; effectiveDate: string } {
  const baseDate = ev.eventDate || todayKey;
  if (isEventHappeningToday(ev, todayKey)) {
    return { status: 'today', daysUntil: 0, effectiveDate: todayKey };
  }

  if (ev.isAnnual && baseDate.length >= 10) {
    const todayYear = Number(todayKey.slice(0, 4));
    const md = baseDate.slice(5, 10);
    let candidate = `${todayYear}-${md}`;
    if (candidate < todayKey) {
      candidate = `${todayYear + 1}-${md}`;
    }
    return {
      status: 'upcoming',
      daysUntil: Math.max(1, diffIsoDays(todayKey, candidate)),
      effectiveDate: candidate,
    };
  }

  const endBoundary = ev.endDate && ev.endDate >= baseDate ? ev.endDate : baseDate;
  if (endBoundary < todayKey) {
    return {
      status: 'past',
      daysUntil: diffIsoDays(todayKey, baseDate),
      effectiveDate: baseDate,
    };
  }
  return {
    status: 'upcoming',
    daysUntil: Math.max(1, diffIsoDays(todayKey, baseDate)),
    effectiveDate: baseDate,
  };
}

export function sortStationEvents(
  events: StationEvent[],
  todayKey = getVietnamTodayKey()
): StationEvent[] {
  const rankMap = { today: 0, upcoming: 1, past: 2 };
  return [...events].sort((a, b) => {
    const ra = resolveEventStatus(a, todayKey);
    const rb = resolveEventStatus(b, todayKey);
    if (rankMap[ra.status] !== rankMap[rb.status]) {
      return rankMap[ra.status] - rankMap[rb.status];
    }
    if (ra.status === 'upcoming') {
      return ra.daysUntil - rb.daysUntil;
    }
    if (ra.status === 'past') {
      return (b.eventDate || '').localeCompare(a.eventDate || '');
    }
    return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
  });
}

function sanitizeStationEventPayload(
  item: Partial<Omit<StationEvent, 'id'>>,
  isCreate: boolean
): Record<string, any> {
  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {};

  if (item.title !== undefined) payload.title = String(item.title).trim().slice(0, 256);
  if (item.eventDate !== undefined) payload.eventDate = String(item.eventDate).trim().slice(0, 32);
  if (item.endDate !== undefined && item.endDate.trim()) {
    payload.endDate = item.endDate.trim().slice(0, 32);
  }
  if (item.startTime !== undefined && item.startTime.trim()) {
    payload.startTime = item.startTime.trim().slice(0, 16);
  }
  if (item.endTime !== undefined && item.endTime.trim()) {
    payload.endTime = item.endTime.trim().slice(0, 16);
  }
  if (item.location !== undefined && item.location.trim()) {
    payload.location = item.location.trim().slice(0, 256);
  }
  if (item.category !== undefined) payload.category = item.category;
  if (item.description !== undefined) {
    payload.description = String(item.description).trim().slice(0, 4000);
  }
  if (item.greetingMessage !== undefined && item.greetingMessage.trim()) {
    payload.greetingMessage = item.greetingMessage.trim().slice(0, 2000);
  }
  if (typeof item.enableConfetti === 'boolean') payload.enableConfetti = item.enableConfetti;
  if (typeof item.enableAutoPopup === 'boolean') payload.enableAutoPopup = item.enableAutoPopup;
  if (typeof item.isAnnual === 'boolean') payload.isAnnual = item.isAnnual;
  if (typeof item.isActive === 'boolean') payload.isActive = item.isActive;
  if (item.createdBy !== undefined && item.createdBy.trim()) {
    payload.createdBy = item.createdBy.trim().slice(0, 128);
  }

  if (isCreate) {
    payload.createdAt = (item.createdAt || nowIso).slice(0, 64);
    payload.updatedAt = (item.updatedAt || nowIso).slice(0, 64);
    if (payload.enableConfetti === undefined) payload.enableConfetti = true;
    if (payload.enableAutoPopup === undefined) payload.enableAutoPopup = true;
    if (payload.isActive === undefined) payload.isActive = true;
  } else {
    if (item.createdAt) payload.createdAt = item.createdAt.slice(0, 64);
    payload.updatedAt = nowIso;
  }

  return cleanDataForFirestore(payload);
}

export async function createStationEvent(
  input: Omit<StationEvent, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const path = 'events';
  try {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload = sanitizeStationEventPayload(input, true);
    await setDoc(doc(db, path, id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateStationEvent(id: string, item: StationEvent): Promise<void> {
  const path = `events/${id}`;
  try {
    const { id: _unused, ...rest } = item;
    const payload = sanitizeStationEventPayload(rest, false);
    await setDoc(doc(db, 'events', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function deleteStationEvent(id: string): Promise<void> {
  const path = `events/${id}`;
  try {
    await deleteDoc(doc(db, 'events', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// ==========================================
// Weekly Work Schedule & Holiday Setup Helpers
// ==========================================

export const DEFAULT_WEEKLY_WORK_DAYS: WeeklyWorkDayConfig[] = [
  {
    dayOfWeek: 1,
    label: 'Thứ Hai',
    isWorking: true,
    morningHours: '07:00 - 11:00',
    afternoonHours: '13:00 - 17:00',
    departmentsSummary: 'Khám BHYT, Cấp cứu ban đầu, Hồ sơ sức khỏe, Hành chính',
    notes: '',
  },
  {
    dayOfWeek: 2,
    label: 'Thứ Ba',
    isWorking: true,
    morningHours: '07:00 - 11:00',
    afternoonHours: '13:00 - 17:00',
    departmentsSummary: 'Khám BHYT, Khám thai & Chăm sóc sức khỏe sinh sản',
    notes: '',
  },
  {
    dayOfWeek: 3,
    label: 'Thứ Tư',
    isWorking: true,
    morningHours: '07:00 - 11:00',
    afternoonHours: '13:00 - 17:00',
    departmentsSummary: 'Khám BHYT, Tiêm chủng mở rộng (theo lịch), Quản lý bệnh mạn tính',
    notes: '',
  },
  {
    dayOfWeek: 4,
    label: 'Thứ Năm',
    isWorking: true,
    morningHours: '07:00 - 11:00',
    afternoonHours: '13:00 - 17:00',
    departmentsSummary: 'Khám BHYT, Tư vấn dinh dưỡng, Phòng chống dịch & ATTP',
    notes: '',
  },
  {
    dayOfWeek: 5,
    label: 'Thứ Sáu',
    isWorking: true,
    morningHours: '07:00 - 11:00',
    afternoonHours: '13:00 - 17:00',
    departmentsSummary: 'Khám BHYT, Cấp thuốc, Tổng hợp báo cáo tuần & Giao ban',
    notes: '',
  },
  {
    dayOfWeek: 6,
    label: 'Thứ Bảy',
    isWorking: false,
    morningHours: '',
    afternoonHours: '',
    departmentsSummary: 'Nghỉ hành chính',
    notes: 'Thường trực cấp cứu 24/24',
  },
  {
    dayOfWeek: 0,
    label: 'Chủ Nhật',
    isWorking: false,
    morningHours: '',
    afternoonHours: '',
    departmentsSummary: 'Nghỉ hành chính',
    notes: 'Thường trực cấp cứu 24/24',
  },
];

export const DEFAULT_WORK_SCHEDULE_CONFIG: WorkScheduleConfig = {
  weeklyDays: DEFAULT_WEEKLY_WORK_DAYS,
  dutyHoursSummary: 'Thường trực cấp cứu 24/24 giờ (07:00 hôm nay đến 07:00 hôm sau, kể cả Thứ 7, Chủ Nhật và ngày Lễ/Tết).',
  generalNote: 'Người dân cần khám BHYT hoặc giải quyết thủ tục hành chính vui lòng đến trong giờ làm việc. Trường hợp cấp cứu liên hệ trực tiếp kíp trực 24/7.',
};

export function getResolvedWeeklyWorkSchedule(settings?: Partial<SystemSettings>): WorkScheduleConfig {
  const configured = settings?.workScheduleConfig;
  if (!configured || !Array.isArray(configured.weeklyDays) || configured.weeklyDays.length === 0) {
    return DEFAULT_WORK_SCHEDULE_CONFIG;
  }
  const dayMap = new Map<number, WeeklyWorkDayConfig>();
  configured.weeklyDays.forEach(d => dayMap.set(d.dayOfWeek, d));
  const mergedDays = DEFAULT_WEEKLY_WORK_DAYS.map(defDay => {
    const found = dayMap.get(defDay.dayOfWeek);
    return found ? { ...defDay, ...found } : defDay;
  });
  return {
    weeklyDays: mergedDays,
    dutyHoursSummary: configured.dutyHoursSummary ?? DEFAULT_WORK_SCHEDULE_CONFIG.dutyHoursSummary,
    generalNote: configured.generalNote ?? DEFAULT_WORK_SCHEDULE_CONFIG.generalNote,
    updatedAt: configured.updatedAt,
  };
}

export const HOLIDAY_PRESETS: Array<{
  label: string;
  name: string;
  mmddStart: string;
  mmddEnd: string;
  isAnnual: boolean;
  noticeTitle: string;
  noticeMessage: string;
  dutyArrangement: string;
}> = [
  {
    label: 'Tết Dương lịch (01/01)',
    name: 'Nghỉ Lễ Tết Dương lịch 01/01',
    mmddStart: '01-01',
    mmddEnd: '01-01',
    isAnnual: true,
    noticeTitle: 'Thông báo nghỉ Lễ Tết Dương lịch',
    noticeMessage:
      'Trạm Y tế tạm nghỉ hoạt động khám chữa bệnh hành chính nhân dịp Tết Dương lịch. Hoạt động tiếp nhận cấp cứu ban đầu vẫn duy trì thường trực 24/24.',
    dutyArrangement: 'Kíp trực cấp cứu 24/24 tại Trụ sở chính & các điểm trạm theo lịch trực công khai.',
  },
  {
    label: '30/04 - 01/05',
    name: 'Nghỉ Lễ Giải phóng miền Nam & Quốc tế Lao động (30/4 - 1/5)',
    mmddStart: '04-30',
    mmddEnd: '05-01',
    isAnnual: true,
    noticeTitle: 'Thông báo nghỉ Lễ 30/4 - 01/5',
    noticeMessage:
      'Trạm Y tế nghỉ làm việc hành chính dịp Lễ 30/4 và 01/5. Trong thời gian nghỉ lễ, đội ngũ y bác sĩ trực 24/7 vẫn túc trực tiếp nhận sơ cấp cứu và xử trí y tế khẩn cấp.',
    dutyArrangement: 'Bố trí kíp trực cấp cứu 24/24 liên tục trong suốt kỳ nghỉ lễ.',
  },
  {
    label: 'Quốc khánh (02/09)',
    name: 'Nghỉ Lễ Quốc khánh nước CHXHCN Việt Nam (02/09)',
    mmddStart: '09-02',
    mmddEnd: '09-02',
    isAnnual: true,
    noticeTitle: 'Thông báo nghỉ Lễ Quốc khánh 02/09',
    noticeMessage:
      'Trạm Y tế tạm nghỉ làm việc hành chính dịp Lễ Quốc khánh 02/09. Hệ thống trực cấp cứu y tế 24/7 luôn sẵn sàng phục vụ người dân khi có tình huống khẩn cấp.',
    dutyArrangement: 'Thường trực cấp cứu 24/24, đảm bảo cơ số thuốc và vật tư y tế thiết yếu.',
  },
  {
    label: 'Giỗ Tổ Hùng Vương',
    name: 'Nghỉ Lễ Giỗ Tổ Hùng Vương (10/3 Âm lịch)',
    mmddStart: '04-18',
    mmddEnd: '04-18',
    isAnnual: false,
    noticeTitle: 'Thông báo nghỉ Lễ Giỗ Tổ Hùng Vương',
    noticeMessage:
      'Trạm Y tế nghỉ làm việc hành chính nhân ngày Giỗ Tổ Hùng Vương. Kíp trực cấp cứu 24/7 vẫn làm việc bình thường.',
    dutyArrangement: 'Kíp trực cấp cứu 24/24 tại Trụ sở chính.',
  },
  {
    label: 'Tết Nguyên Đán',
    name: 'Nghỉ Lễ Tết Nguyên Đán cổ truyền',
    mmddStart: '01-28',
    mmddEnd: '02-02',
    isAnnual: false,
    noticeTitle: 'Thông báo lịch nghỉ Tết Nguyên Đán & Trực cấp cứu 24/7',
    noticeMessage:
      'Trạm Y tế tạm nghỉ làm việc hành chính trong dịp Tết Nguyên Đán. Bộ phận thường trực cấp cứu, phòng chống dịch và an toàn thực phẩm trực 24/24 xuyên Tết.',
    dutyArrangement: 'Trực cấp cứu 24/24 xuyên Tết tại Trụ sở chính và các điểm trạm.',
  },
];

export interface VietnamNowInfo {
  dateKey: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  minutesOfDay: number;
  timeLabel: string;
  weekdayLabel: string;
}

const WEEKDAY_VN_LABELS: Record<number, string> = {
  0: 'Chủ Nhật',
  1: 'Thứ Hai',
  2: 'Thứ Ba',
  3: 'Thứ Tư',
  4: 'Thứ Năm',
  5: 'Thứ Sáu',
  6: 'Thứ Bảy',
};

export function getVietnamNowInfo(nowDate = new Date()): VietnamNowInfo {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    }).formatToParts(nowDate);

    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const hourRaw = Number(getPart('hour'));
    const hour = hourRaw === 24 ? 0 : hourRaw;
    const minute = Number(getPart('minute'));
    const weekdayShort = getPart('weekday').toLowerCase();

    let dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1;
    if (weekdayShort.startsWith('sun')) dayOfWeek = 0;
    else if (weekdayShort.startsWith('mon')) dayOfWeek = 1;
    else if (weekdayShort.startsWith('tue')) dayOfWeek = 2;
    else if (weekdayShort.startsWith('wed')) dayOfWeek = 3;
    else if (weekdayShort.startsWith('thu')) dayOfWeek = 4;
    else if (weekdayShort.startsWith('fri')) dayOfWeek = 5;
    else if (weekdayShort.startsWith('sat')) dayOfWeek = 6;

    return {
      dateKey: `${year}-${month}-${day}`,
      dayOfWeek,
      minutesOfDay: hour * 60 + minute,
      timeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      weekdayLabel: WEEKDAY_VN_LABELS[dayOfWeek] || 'Hôm nay',
    };
  } catch {
    const dayOfWeek = nowDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const h = nowDate.getHours();
    const m = nowDate.getMinutes();
    return {
      dateKey: nowDate.toISOString().split('T')[0],
      dayOfWeek,
      minutesOfDay: h * 60 + m,
      timeLabel: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      weekdayLabel: WEEKDAY_VN_LABELS[dayOfWeek] || 'Hôm nay',
    };
  }
}

export function isHolidayHappeningOnDate(
  holiday: Pick<HolidayScheduleItem, 'startDate' | 'endDate' | 'isAnnual' | 'isActive'>,
  dateKey = getVietnamTodayKey()
): boolean {
  if (holiday.isActive === false || !holiday.startDate) return false;
  const end = holiday.endDate && holiday.endDate >= holiday.startDate ? holiday.endDate : holiday.startDate;

  if (holiday.isAnnual) {
    const startMd = holiday.startDate.slice(5, 10);
    const endMd = end.slice(5, 10);
    const targetMd = dateKey.slice(5, 10);
    if (endMd >= startMd) {
      return targetMd >= startMd && targetMd <= endMd;
    }
    return targetMd >= startMd || targetMd <= endMd;
  }

  return dateKey >= holiday.startDate && dateKey <= end;
}

export function getActiveHolidaysToday(
  settings?: Partial<SystemSettings>,
  todayKey = getVietnamTodayKey()
): HolidayScheduleItem[] {
  const list = settings?.holidaySchedules || [];
  return list.filter(h => isHolidayHappeningOnDate(h, todayKey));
}

export function resolveHolidayStatus(
  holiday: Pick<HolidayScheduleItem, 'startDate' | 'endDate' | 'isAnnual' | 'isActive'>,
  todayKey = getVietnamTodayKey()
): { status: 'today' | 'upcoming' | 'past'; daysUntil: number; effectiveStart: string; effectiveEnd: string } {
  const start = holiday.startDate || todayKey;
  const end = holiday.endDate && holiday.endDate >= start ? holiday.endDate : start;

  if (isHolidayHappeningOnDate(holiday, todayKey)) {
    return { status: 'today', daysUntil: 0, effectiveStart: start, effectiveEnd: end };
  }

  if (holiday.isAnnual && start.length >= 10) {
    const todayYear = Number(todayKey.slice(0, 4));
    const startMd = start.slice(5, 10);
    const endMd = end.slice(5, 10);
    let candidateStart = `${todayYear}-${startMd}`;
    let candidateEnd = `${todayYear}-${endMd}`;
    if (endMd < startMd) {
      candidateEnd = `${todayYear + 1}-${endMd}`;
    }
    if (candidateEnd < todayKey) {
      candidateStart = `${todayYear + 1}-${startMd}`;
      candidateEnd = `${endMd < startMd ? todayYear + 2 : todayYear + 1}-${endMd}`;
    }
    return {
      status: 'upcoming',
      daysUntil: Math.max(1, diffIsoDays(todayKey, candidateStart)),
      effectiveStart: candidateStart,
      effectiveEnd: candidateEnd,
    };
  }

  if (end < todayKey) {
    return {
      status: 'past',
      daysUntil: diffIsoDays(todayKey, start),
      effectiveStart: start,
      effectiveEnd: end,
    };
  }

  return {
    status: 'upcoming',
    daysUntil: Math.max(1, diffIsoDays(todayKey, start)),
    effectiveStart: start,
    effectiveEnd: end,
  };
}

export function sortHolidaySchedules(
  holidays: HolidayScheduleItem[],
  todayKey = getVietnamTodayKey()
): HolidayScheduleItem[] {
  const rankMap = { today: 0, upcoming: 1, past: 2 };
  return [...holidays].sort((a, b) => {
    const ra = resolveHolidayStatus(a, todayKey);
    const rb = resolveHolidayStatus(b, todayKey);
    if (rankMap[ra.status] !== rankMap[rb.status]) {
      return rankMap[ra.status] - rankMap[rb.status];
    }
    if (ra.status === 'upcoming') {
      return ra.daysUntil - rb.daysUntil;
    }
    if (ra.status === 'past') {
      return (b.startDate || '').localeCompare(a.startDate || '');
    }
    return (a.startDate || '').localeCompare(b.startDate || '');
  });
}

export function formatHolidayDateRange(
  holiday: Pick<HolidayScheduleItem, 'startDate' | 'endDate'>
): string {
  const start = formatIsoDateVN(holiday.startDate);
  if (holiday.endDate && holiday.endDate > holiday.startDate) {
    return `${start} – ${formatIsoDateVN(holiday.endDate)}`;
  }
  return start;
}

function parseRangeMinutes(rangeStr?: string): [number, number] | null {
  if (!rangeStr) return null;
  const matches = rangeStr.match(/\b(\d{1,2}):(\d{2})\b/g);
  if (!matches || matches.length < 2) return null;
  const [sh, sm] = matches[0].split(':').map(Number);
  const [eh, em] = matches[matches.length - 1].split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
  return [sh * 60 + sm, eh * 60 + em];
}

export interface StationOperationalStatus {
  mode: 'holiday' | 'working_open' | 'working_break' | 'weekend_off';
  label: string;
  detail: string;
  activeHolidays: HolidayScheduleItem[];
  todayWorkConfig?: WeeklyWorkDayConfig;
  nowInfo: VietnamNowInfo;
}

export function getStationOperationalStatus(
  settings?: Partial<SystemSettings>,
  nowInfo = getVietnamNowInfo()
): StationOperationalStatus {
  const activeHolidays = getActiveHolidaysToday(settings, nowInfo.dateKey);
  const weekly = getResolvedWeeklyWorkSchedule(settings);
  const todayWorkConfig = weekly.weeklyDays.find(d => d.dayOfWeek === nowInfo.dayOfWeek);

  if (activeHolidays.length > 0) {
    const primary = activeHolidays[0];
    return {
      mode: 'holiday',
      label: `Nghỉ lễ · ${primary.name}`,
      detail: primary.resumeDate
        ? `Nghỉ hành chính (${formatHolidayDateRange(primary)}). Làm việc lại từ ${formatIsoDateVN(primary.resumeDate)}. Trực cấp cứu 24/7 vẫn hoạt động.`
        : `Nghỉ hành chính (${formatHolidayDateRange(primary)}). Bộ phận trực cấp cứu 24/7 vẫn túc trực bình thường.`,
      activeHolidays,
      todayWorkConfig,
      nowInfo,
    };
  }

  if (!todayWorkConfig || !todayWorkConfig.isWorking) {
    return {
      mode: 'weekend_off',
      label: `${nowInfo.weekdayLabel} · Nghỉ hành chính`,
      detail: 'Hôm nay nghỉ làm việc hành chính. Kíp trực cấp cứu 24/7 vẫn trực tiếp nhận khẩn cấp.',
      activeHolidays: [],
      todayWorkConfig,
      nowInfo,
    };
  }

  const morningRange = parseRangeMinutes(todayWorkConfig.morningHours);
  const afternoonRange = parseRangeMinutes(todayWorkConfig.afternoonHours);
  const mins = nowInfo.minutesOfDay;
  const inMorning = morningRange ? mins >= morningRange[0] && mins <= morningRange[1] : false;
  const inAfternoon = afternoonRange ? mins >= afternoonRange[0] && mins <= afternoonRange[1] : false;

  if (inMorning || inAfternoon) {
    return {
      mode: 'working_open',
      label: `${nowInfo.weekdayLabel} · Đang làm việc`,
      detail: `Đang trong giờ hành chính (${inMorning ? todayWorkConfig.morningHours : todayWorkConfig.afternoonHours}) và duy trì trực cấp cứu 24/7.`,
      activeHolidays: [],
      todayWorkConfig,
      nowInfo,
    };
  }

  const hoursCombined = [todayWorkConfig.morningHours, todayWorkConfig.afternoonHours]
    .filter(Boolean)
    .join(' · ');

  return {
    mode: 'working_break',
    label: `${nowInfo.weekdayLabel} · Ngoài giờ hành chính`,
    detail: `Giờ làm việc hôm nay: ${hoursCombined || '07:00 - 11:00 · 13:00 - 17:00'}. Hiện tại đang trực cấp cứu 24/7.`,
    activeHolidays: [],
    todayWorkConfig,
    nowInfo,
  };
}

export interface StationPointLeader {
  id: string;
  pointName: string;
  address?: string;
  headName?: string;
  phone?: string;
  isPrimary: boolean;
}

function isPlaceholderValue(val?: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  return trimmed.toLowerCase().includes('chưa cập nhật');
}

export function getStationPointLeaders(
  settings?: Partial<SystemSettings>
): StationPointLeader[] {
  if (!settings) return [];

  const sortedMap = sortLocationsPrimaryFirst(settings.mapLocations || []);
  const primaryMapLoc = sortedMap.find(loc => loc.isPrimary) || null;

  const mainStationName = !isPlaceholderValue(settings.stationName)
    ? settings.stationName!.trim()
    : 'Trụ sở chính Trạm Y tế';
  const mainLeader = !isPlaceholderValue(settings.leaderName)
    ? settings.leaderName!.trim()
    : settings.orgChart?.director?.fullName?.trim() || '';
  const mainPhone = !isPlaceholderValue(settings.hotline)
    ? settings.hotline!.trim()
    : settings.orgChart?.director?.phone?.trim() ||
      (!isPlaceholderValue(settings.emergencyPhone) ? settings.emergencyPhone!.trim() : '');

  const leaders: StationPointLeader[] = [];

  if (primaryMapLoc) {
    const headName = primaryMapLoc.headName?.trim() || mainLeader || undefined;
    const phone = primaryMapLoc.phone?.trim() || mainPhone || undefined;
    if (headName || phone) {
      leaders.push({
        id: primaryMapLoc.id || 'primary_station',
        pointName: primaryMapLoc.name || mainStationName,
        address: primaryMapLoc.address || (!isPlaceholderValue(settings.address) ? settings.address?.trim() : undefined),
        headName,
        phone,
        isPrimary: true,
      });
    }
  } else if (mainLeader || mainPhone) {
    leaders.push({
      id: 'primary_station',
      pointName: mainStationName,
      address: !isPlaceholderValue(settings.address) ? settings.address?.trim() : undefined,
      headName: mainLeader || undefined,
      phone: mainPhone || undefined,
      isPrimary: true,
    });
  }

  sortedMap.forEach((loc, idx) => {
    if (primaryMapLoc && loc.id === primaryMapLoc.id) return;
    if (!primaryMapLoc && loc.isPrimary) return;
    const headName = loc.headName?.trim() || undefined;
    const phone = loc.phone?.trim() || mainPhone || undefined;
    if (headName || phone) {
      leaders.push({
        id: loc.id || `point_${idx + 1}`,
        pointName: loc.name,
        address: loc.address,
        headName,
        phone,
        isPrimary: false,
      });
    }
  });

  return leaders;
}

export function getDutySchedulesForHoliday(
  schedules: WorkSchedule[],
  holiday: Pick<HolidayScheduleItem, 'startDate' | 'endDate' | 'isAnnual' | 'isActive'>,
  referenceDateKey = getVietnamTodayKey()
): WorkSchedule[] {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];

  const isToday = isHolidayHappeningOnDate(holiday, referenceDateKey);
  const resolved = resolveHolidayStatus(holiday, referenceDateKey);
  const rangeStart = resolved.effectiveStart;
  const rangeEnd = resolved.effectiveEnd;

  const sortPriority = (list: WorkSchedule[]): WorkSchedule[] => {
    const shiftOrder: Record<WorkSchedule['shift'], number> = {
      full_day: 0,
      night: 1,
      morning: 2,
      afternoon: 3,
    };
    return [...list].sort((a, b) => {
      if (a.date !== b.date) {
        if (a.date === referenceDateKey) return -1;
        if (b.date === referenceDateKey) return 1;
        return (a.date || '').localeCompare(b.date || '');
      }
      const aDuty = a.type === 'duty' ? 0 : 1;
      const bDuty = b.type === 'duty' ? 0 : 1;
      if (aDuty !== bDuty) return aDuty - bDuty;
      return (shiftOrder[a.shift] ?? 9) - (shiftOrder[b.shift] ?? 9);
    });
  };

  if (isToday) {
    const exactToday = schedules.filter(sch => sch.date === referenceDateKey);
    if (exactToday.length > 0) {
      return sortPriority(exactToday);
    }
  }

  const inRange = schedules.filter(
    sch => Boolean(sch.date) && sch.date >= rangeStart && sch.date <= rangeEnd
  );
  return sortPriority(inRange);
}

// ============================================================
// REFERRAL CODES (Cán bộ Y tế Registration & Invite Links)
// ============================================================

export function normalizeReferralCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 64);
}

export function generateRandomReferralCode(prefix = 'TYT'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

export async function getReferralCode(rawCode: string): Promise<ReferralCodeItem | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code || code.length < 4) return null;
  const path = `referralCodes/${code}`;
  try {
    const snap = await getDoc(doc(db, 'referralCodes', code));
    if (!snap.exists()) return null;
    return snap.data() as ReferralCodeItem;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function validateReferralCode(
  rawCode: string
): Promise<{ valid: boolean; item?: ReferralCodeItem; error?: string }> {
  const code = normalizeReferralCode(rawCode);
  if (!code || code.length < 4) {
    return { valid: false, error: 'Mã giới thiệu phải có ít nhất 4 ký tự hợp lệ.' };
  }
  try {
    const item = await getReferralCode(code);
    if (!item) {
      return { valid: false, error: 'Mã giới thiệu không tồn tại hoặc đã bị thu hồi.' };
    }
    if (!item.active) {
      return { valid: false, error: 'Mã giới thiệu này hiện đang tạm khóa.' };
    }
    return { valid: true, item };
  } catch {
    return { valid: false, error: 'Không thể kiểm tra mã giới thiệu lúc này.' };
  }
}

export async function consumeReferralCodeUsage(rawCode: string, uid: string): Promise<void> {
  const code = normalizeReferralCode(rawCode);
  if (!code || !uid) return;
  try {
    await updateDoc(doc(db, 'referralCodes', code), {
      usedCount: increment(1),
      lastUsedAt: new Date().toISOString(),
      lastUsedByUid: uid,
    });
  } catch (err) {
    console.warn('consumeReferralCodeUsage warning:', err);
  }
}

export async function listReferralCodes(): Promise<ReferralCodeItem[]> {
  const path = 'referralCodes';
  try {
    const snap = await getDocs(query(collection(db, 'referralCodes'), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => d.data() as ReferralCodeItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function createReferralCode(params: {
  code?: string;
  label?: string;
  issuerTier?: ReferralIssuerTier;
  targetAccountType?: 'employee' | 'admin';
  targetRole?: Exclude<RoleType, 'citizen' | 'super_admin'>;
  createdByUid: string;
  createdByEmail?: string;
}): Promise<ReferralCodeItem> {
  const issuerTier: ReferralIssuerTier = params.issuerTier || 'admin';
  const targetAccountType: 'employee' | 'admin' =
    issuerTier === 'super_admin' && params.targetAccountType === 'admin'
      ? 'admin'
      : 'employee';
  const targetRole: RoleType =
    targetAccountType === 'admin'
      ? 'admin'
      : params.targetRole && params.targetRole !== 'admin'
      ? params.targetRole
      : 'staff';

  const defaultPrefix =
    targetAccountType === 'admin'
      ? 'ADM'
      : issuerTier === 'super_admin'
      ? 'SADM'
      : 'CBYT';
  const code = normalizeReferralCode(params.code || generateRandomReferralCode(defaultPrefix));
  if (code.length < 4) {
    throw new Error('Mã giới thiệu phải có ít nhất 4 ký tự chữ/số (A-Z, 0-9, -, _).');
  }
  const existing = await getDoc(doc(db, 'referralCodes', code));
  if (existing.exists()) {
    throw new Error(`Mã giới thiệu "${code}" đã tồn tại. Vui lòng chọn mã khác.`);
  }
  const now = new Date().toISOString();
  const payload: ReferralCodeItem = cleanDataForFirestore({
    code,
    ...(params.label?.trim() ? { label: params.label.trim().slice(0, 128) } : {}),
    active: true,
    issuerTier,
    targetAccountType,
    targetRole,
    createdByUid: params.createdByUid,
    ...(params.createdByEmail?.trim() ? { createdByEmail: params.createdByEmail.trim().slice(0, 256) } : {}),
    createdAt: now,
    usedCount: 0,
  });
  const path = `referralCodes/${code}`;
  try {
    await setDoc(doc(db, 'referralCodes', code), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
    throw err;
  }
}

export async function toggleReferralCodeStatus(code: string, active: boolean): Promise<void> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  const path = `referralCodes/${normalized}`;
  try {
    await updateDoc(doc(db, 'referralCodes', normalized), { active });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    throw err;
  }
}

export async function deleteReferralCode(code: string): Promise<void> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return;
  const path = `referralCodes/${normalized}`;
  try {
    await deleteDoc(doc(db, 'referralCodes', normalized));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    throw err;
  }
}

// ================================
// Personal Referral & +1,000 EXP Reward System
// ================================
export const REFERRAL_EXP_REWARD = 1000;

export function buildPersonalReferralCodeForUid(uid: string): string {
  const clean = (uid || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  return `TYT-${clean || generateRandomReferralCode('U').slice(2)}`;
}

export async function getUserReferralLinkByCode(rawCode: string): Promise<UserReferralLink | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code || code.length < 4) return null;
  try {
    const snap = await getDoc(doc(db, 'userReferralLinks', code));
    if (!snap.exists()) return null;
    return snap.data() as UserReferralLink;
  } catch {
    return null;
  }
}

export async function resolveAnyReferralCode(rawCode: string): Promise<
  | { kind: 'role_invite'; item: ReferralCodeItem }
  | { kind: 'personal'; item: UserReferralLink }
  | null
> {
  const code = normalizeReferralCode(rawCode);
  if (!code || code.length < 4) return null;
  const roleCheck = await validateReferralCode(code);
  if (roleCheck.valid && roleCheck.item) {
    return { kind: 'role_invite', item: roleCheck.item };
  }
  const personal = await getUserReferralLinkByCode(code);
  if (personal) {
    return { kind: 'personal', item: personal };
  }
  return null;
}

export async function ensurePersonalReferralLink(params: {
  uid: string;
  displayName: string;
  existingCode?: string;
}): Promise<string> {
  const code = normalizeReferralCode(params.existingCode || buildPersonalReferralCodeForUid(params.uid));
  const linkRef = doc(db, 'userReferralLinks', code);
  const existing = await getDoc(linkRef).catch(() => null);
  const now = new Date().toISOString();
  if (!existing || !existing.exists()) {
    await setDoc(linkRef, {
      code,
      ownerUid: params.uid,
      ownerName: (params.displayName || 'Thành viên Trạm Y tế').slice(0, 128),
      createdAt: now,
    });
  }
  if (params.existingCode !== code) {
    await setDoc(
      doc(db, 'users', params.uid),
      { personalReferralCode: code, updatedAt: now },
      { merge: true }
    );
  }
  return code;
}

export async function ensureReferralTrackingForUser(params: {
  referredUid: string;
  referredName: string;
  referredEmailMasked?: string;
  referrerUid: string;
  referralCode: string;
  stepsCompleted: ReferralTrackingSteps;
}): Promise<void> {
  if (!params.referredUid || !params.referrerUid || params.referredUid === params.referrerUid) return;
  const trackingRef = doc(db, 'referralTracking', params.referredUid);
  const existingSnap = await getDoc(trackingRef).catch(() => null);
  const now = new Date().toISOString();
  const qualified = Boolean(
    params.stepsCompleted.email &&
      params.stepsCompleted.phone &&
      params.stepsCompleted.password
  );

  if (!existingSnap || !existingSnap.exists()) {
    const docData: ReferralTrackingItem = {
      referredUid: params.referredUid,
      referredName: (params.referredName || 'Người dùng mới').slice(0, 128),
      ...(params.referredEmailMasked ? { referredEmailMasked: params.referredEmailMasked.slice(0, 256) } : {}),
      referrerUid: params.referrerUid,
      referralCode: normalizeReferralCode(params.referralCode),
      stepsCompleted: params.stepsCompleted,
      qualifiedForReward: qualified,
      rewarded: false,
      expAwarded: 0,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(trackingRef, cleanDataForFirestore(docData));
    return;
  }

  const current = existingSnap.data() as ReferralTrackingItem;
  if (current.rewarded) return;

  const sameSteps =
    current.stepsCompleted?.email === params.stepsCompleted.email &&
    current.stepsCompleted?.phone === params.stepsCompleted.phone &&
    current.stepsCompleted?.password === params.stepsCompleted.password &&
    current.qualifiedForReward === qualified;

  if (!sameSteps) {
    await updateDoc(trackingRef, {
      stepsCompleted: params.stepsCompleted,
      qualifiedForReward: qualified,
      referredName: (params.referredName || current.referredName || 'Người dùng').slice(0, 128),
      updatedAt: now,
    });
  }
}

export async function claimReferralRewardBatch(tracking: ReferralTrackingItem): Promise<boolean> {
  if (!tracking.qualifiedForReward || tracking.rewarded) return false;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  const trackingRef = doc(db, 'referralTracking', tracking.referredUid);
  const referrerRef = doc(db, 'users', tracking.referrerUid);

  batch.update(trackingRef, {
    qualifiedForReward: true,
    rewarded: true,
    expAwarded: REFERRAL_EXP_REWARD,
    rewardedAt: now,
    updatedAt: now,
  });

  batch.update(referrerRef, {
    expBalance: increment(REFERRAL_EXP_REWARD),
    totalExpEarned: increment(REFERRAL_EXP_REWARD),
    lastRewardClaimRefUid: tracking.referredUid,
    updatedAt: now,
  });

  await batch.commit();
  return true;
}

export async function listMyReferrals(referrerUid: string): Promise<ReferralTrackingItem[]> {
  if (!referrerUid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'referralTracking'), where('referrerUid', '==', referrerUid))
    );
    return snap.docs
      .map(d => d.data() as ReferralTrackingItem)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.warn('listMyReferrals error:', err);
    return [];
  }
}

export async function getMyReferralTrackingStatus(referredUid: string): Promise<ReferralTrackingItem | null> {
  if (!referredUid) return null;
  try {
    const snap = await getDoc(doc(db, 'referralTracking', referredUid));
    return snap.exists() ? (snap.data() as ReferralTrackingItem) : null;
  } catch {
    return null;
  }
}

// ================================
// Semi-automatic Personnel Attendance (Chấm công nhanh)
// ================================
export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; shortLabel: string; badgeClass: string; buttonActiveClass: string }
> = {
  co_quan: {
    label: 'Làm việc cơ quan',
    shortLabel: 'Cơ quan',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    buttonActiveClass: 'bg-emerald-700 text-white border-emerald-700',
  },
  truc: {
    label: 'Trực',
    shortLabel: 'Trực',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    buttonActiveClass: 'bg-rose-600 text-white border-rose-600',
  },
  ra_truc: {
    label: 'Ra trực',
    shortLabel: 'Ra trực',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    buttonActiveClass: 'bg-amber-600 text-white border-amber-600',
  },
  nghi: {
    label: 'Nghỉ',
    shortLabel: 'Nghỉ',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    buttonActiveClass: 'bg-slate-700 text-white border-slate-700',
  },
};

export function sanitizeAttendanceKeyPart(raw: string): string {
  return (raw || 'staff').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
}

export function buildAttendanceRecordId(date: string, staffId: string): string {
  return `${date}_${sanitizeAttendanceKeyPart(staffId)}`;
}

export async function upsertAttendanceRecord(
  record: Omit<AttendanceRecord, 'id' | 'updatedAt'>
): Promise<AttendanceRecord> {
  const id = buildAttendanceRecordId(record.date, record.staffId);
  const now = new Date().toISOString();
  const payload: AttendanceRecord = cleanDataForFirestore({
    ...record,
    id,
    staffName: (record.staffName || 'Nhân sự').slice(0, 128),
    ...(record.department ? { department: record.department.slice(0, 128) } : {}),
    ...(record.position ? { position: record.position.slice(0, 128) } : {}),
    ...(record.note?.trim() ? { note: record.note.trim().slice(0, 512) } : {}),
    ...(record.updatedByName ? { updatedByName: record.updatedByName.slice(0, 128) } : {}),
    updatedAt: now,
  });
  await setDoc(doc(db, 'attendanceRecords', id), payload);
  return payload;
}

export async function batchApplyAttendanceRecords(
  records: Array<Omit<AttendanceRecord, 'id' | 'updatedAt'>>
): Promise<number> {
  if (records.length === 0) return 0;
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  for (const rec of records) {
    const id = buildAttendanceRecordId(rec.date, rec.staffId);
    const payload: AttendanceRecord = cleanDataForFirestore({
      ...rec,
      id,
      staffName: (rec.staffName || 'Nhân sự').slice(0, 128),
      ...(rec.department ? { department: rec.department.slice(0, 128) } : {}),
      ...(rec.position ? { position: rec.position.slice(0, 128) } : {}),
      ...(rec.note?.trim() ? { note: rec.note.trim().slice(0, 512) } : {}),
      ...(rec.updatedByName ? { updatedByName: rec.updatedByName.slice(0, 128) } : {}),
      updatedAt: now,
    });
    batch.set(doc(db, 'attendanceRecords', id), payload);
  }
  await batch.commit();
  return records.length;
}

export async function deleteAttendanceRecord(date: string, staffId: string): Promise<void> {
  const id = buildAttendanceRecordId(date, staffId);
  await deleteDoc(doc(db, 'attendanceRecords', id));
}

// ================================
// Per-Role Permissions Configuration (Super Admin, Admin, User, Guest)
// ================================
export const DEFAULT_ORGANIZATION_PERMISSION_POLICY: RolePermissionPolicy = {
  blockedTabs: [],
  canSubmitFeedback: true,
  canUseApps: true,
  canSendRescueSos: false,
  canViewPersonnelDirectory: false,
  canManageContent: false,
  canManageSchedules: false,
  canAttendanceCheckin: false,
  canManageUsers: false,
  canManageSystem: false,
};

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsConfig = {
  super_admin: { fullAccess: true },
  admin: {
    blockedTabs: [],
    requireLoginForTabs: [],
    canSubmitFeedback: true,
    canUseApps: true,
    canSendRescueSos: true,
    canViewPersonnelDirectory: true,
    canManageContent: true,
    canManageSchedules: true,
    canAttendanceCheckin: true,
    canManageUsers: true,
    canManageSystem: true,
  },
  user: {
    blockedTabs: [],
    canSubmitFeedback: true,
    canUseApps: true,
    canSendRescueSos: true,
    canViewPersonnelDirectory: false,
  },
  organization: DEFAULT_ORGANIZATION_PERMISSION_POLICY,
  guest: {
    blockedTabs: [],
    requireLoginForTabs: [],
    canSubmitFeedback: true,
    canUseApps: true,
    canSendRescueSos: true,
    canViewPersonnelDirectory: false,
  },
};

export function resolveRolePermissions(settings?: Partial<SystemSettings> | null): RolePermissionsConfig {
  const raw = settings?.rolePermissions;
  const orgPolicy: RolePermissionPolicy = {
    ...DEFAULT_ORGANIZATION_PERMISSION_POLICY,
    ...(raw?.organization || {}),
    blockedTabs: Array.isArray(raw?.organization?.blockedTabs)
      ? raw.organization.blockedTabs
      : DEFAULT_ORGANIZATION_PERMISSION_POLICY.blockedTabs,
  };
  return {
    super_admin: { fullAccess: true },
    admin: {
      ...DEFAULT_ROLE_PERMISSIONS.admin,
      ...(raw?.admin || {}),
      blockedTabs: Array.isArray(raw?.admin?.blockedTabs)
        ? raw.admin.blockedTabs
        : DEFAULT_ROLE_PERMISSIONS.admin.blockedTabs,
    },
    user: {
      ...DEFAULT_ROLE_PERMISSIONS.user,
      ...(raw?.user || {}),
      blockedTabs: Array.isArray(raw?.user?.blockedTabs)
        ? raw.user.blockedTabs
        : DEFAULT_ROLE_PERMISSIONS.user.blockedTabs,
    },
    organization: orgPolicy,
    guest: {
      ...DEFAULT_ROLE_PERMISSIONS.guest,
      ...(raw?.guest || {}),
      blockedTabs: Array.isArray(raw?.guest?.blockedTabs)
        ? raw.guest.blockedTabs
        : DEFAULT_ROLE_PERMISSIONS.guest.blockedTabs,
    },
    updatedAt: raw?.updatedAt,
    updatedByUid: raw?.updatedByUid,
  };
}

export const ROLE_PERMISSION_PRESETS = {
  admin: {
    full_admin: {
      label: 'Toàn quyền Admin (Mặc định)',
      policy: { ...DEFAULT_ROLE_PERMISSIONS.admin } as RolePermissionPolicy,
    },
    operations_only: {
      label: 'Admin Vận hành & Lịch (Khóa sửa hệ thống)',
      policy: {
        ...DEFAULT_ROLE_PERMISSIONS.admin,
        canManageSystem: false,
        canManageUsers: false,
      } as RolePermissionPolicy,
    },
    content_only: {
      label: 'Admin Nội dung & Lịch trực',
      policy: {
        ...DEFAULT_ROLE_PERMISSIONS.admin,
        canManageUsers: false,
        canManageSystem: false,
      } as RolePermissionPolicy,
    },
  },
  user: {
    standard_citizen: {
      label: 'Chuẩn Công dân & Cán bộ',
      policy: { ...DEFAULT_ROLE_PERMISSIONS.user } as RolePermissionPolicy,
    },
    essential_only: {
      label: 'Tối giản Y tế Cơ bản',
      policy: {
        blockedTabs: ['apps', 'telehealth', 'events'],
        canSubmitFeedback: true,
        canUseApps: false,
        canSendRescueSos: true,
        canViewPersonnelDirectory: false,
      } as RolePermissionPolicy,
    },
  },
  organization: {
    standard_org: {
      label: 'Tổ chức / Doanh nghiệp Chuẩn',
      policy: {
        blockedTabs: ['telehealth'],
        canSubmitFeedback: true,
        canUseApps: true,
        canSendRescueSos: false,
        canViewPersonnelDirectory: false,
      } as RolePermissionPolicy,
    },
    medical_partner: {
      label: 'Phòng khám / Nhà thuốc Đối tác (Liên kết chuyên môn)',
      policy: {
        blockedTabs: [],
        canSubmitFeedback: true,
        canUseApps: true,
        canSendRescueSos: true,
        canViewPersonnelDirectory: true,
      } as RolePermissionPolicy,
    },
    school_enterprise: {
      label: 'Trường học / Công ty Địa bàn (Y tế cơ quan)',
      policy: {
        blockedTabs: ['telehealth'],
        canSubmitFeedback: true,
        canUseApps: true,
        canSendRescueSos: false,
        canViewPersonnelDirectory: false,
      } as RolePermissionPolicy,
    },
  },
  guest: {
    public_portal_with_feedback_login: {
      label: 'Chuẩn Cổng Công khai (Yêu cầu đăng nhập: Phản ánh)',
      policy: {
        blockedTabs: [],
        requireLoginForTabs: ['feedback_tracking'],
        canSubmitFeedback: true,
        canUseApps: true,
        canSendRescueSos: true,
        canViewPersonnelDirectory: false,
      } as RolePermissionPolicy,
    },
    strict_guest: {
      label: 'Khách Hạn chế (Chỉ xem Thông tin & Lịch; bắt buộc đăng nhập Tiện ích)',
      policy: {
        blockedTabs: [],
        requireLoginForTabs: ['apps', 'bhyt_lookup', 'telehealth', 'feedback_tracking'],
        canSubmitFeedback: false,
        canUseApps: false,
        canSendRescueSos: true,
        canViewPersonnelDirectory: false,
      } as RolePermissionPolicy,
    },
    open_public: {
      label: 'Mở Công khai Toàn bộ',
      policy: {
        blockedTabs: [],
        requireLoginForTabs: [],
        canSubmitFeedback: true,
        canUseApps: true,
        canSendRescueSos: true,
        canViewPersonnelDirectory: false,
      } as RolePermissionPolicy,
    },
  },
};

// ================================
// EXP Reward Storefront & Redemption
// ================================
export const STORE_CATEGORY_LABELS: Record<StoreItemCategory, string> = {
  qua_tang: 'Quà tặng sức khỏe',
  dich_vu_y_te: 'Dịch vụ y tế',
  voucher: 'Phiếu ưu đãi',
  vat_tu: 'Vật tư y tế',
  khac: 'Khác',
};

export async function listStoreItems(): Promise<StoreItem[]> {
  try {
    const snap = await getDocs(query(collection(db, 'storeItems'), orderBy('createdAt', 'desc')));
    return snap.docs.map(d => d.data() as StoreItem);
  } catch (err) {
    console.warn('listStoreItems error:', err);
    return [];
  }
}

export async function upsertStoreItem(
  item: Omit<StoreItem, 'createdAt' | 'updatedAt'> & { createdAt?: string }
): Promise<StoreItem> {
  const now = new Date().toISOString();
  const payload: StoreItem = cleanDataForFirestore({
    ...item,
    priceExp: Math.max(1, Math.round(Number(item.priceExp) || 1)),
    stock: Math.max(0, Math.round(Number(item.stock) || 0)),
    redeemCount: Math.max(0, Math.round(Number(item.redeemCount) || 0)),
    createdAt: item.createdAt || now,
    updatedAt: now,
  });
  await setDoc(doc(db, 'storeItems', payload.id), payload);
  return payload;
}

export async function deleteStoreItem(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'storeItems', itemId));
}

export async function listUserStoreOrders(buyerUid: string): Promise<StoreOrder[]> {
  if (!buyerUid) return [];
  try {
    const snap = await getDocs(
      query(collection(db, 'storeOrders'), where('buyerUid', '==', buyerUid))
    );
    return snap.docs
      .map(d => d.data() as StoreOrder)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.warn('listUserStoreOrders error:', err);
    return [];
  }
}

export async function listAllStoreOrders(): Promise<StoreOrder[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'storeOrders'), orderBy('createdAt', 'desc'))
    );
    return snap.docs.map(d => d.data() as StoreOrder);
  } catch (err) {
    console.warn('listAllStoreOrders error:', err);
    return [];
  }
}

export async function redeemStoreItemWithExp(params: {
  item: StoreItem;
  buyerUid: string;
  buyerName: string;
  buyerEmail?: string;
  buyerPhone?: string;
  note?: string;
}): Promise<StoreOrder> {
  const { item, buyerUid, buyerName, buyerEmail, buyerPhone, note } = params;
  const now = new Date().toISOString();
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const order: StoreOrder = cleanDataForFirestore({
    id: orderId,
    itemId: item.id,
    itemName: item.name.slice(0, 256),
    ...(item.imageUrl ? { itemImageUrl: item.imageUrl.slice(0, 2000) } : {}),
    buyerUid,
    buyerName: (buyerName || 'Thành viên').slice(0, 128),
    ...(buyerEmail ? { buyerEmail: buyerEmail.slice(0, 256) } : {}),
    ...(buyerPhone ? { buyerPhone: buyerPhone.slice(0, 32) } : {}),
    expCost: Math.round(item.priceExp),
    quantity: 1,
    status: 'pending',
    ...(note?.trim() ? { note: note.trim().slice(0, 1000) } : {}),
    createdAt: now,
    updatedAt: now,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'storeOrders', orderId), order);
  batch.update(doc(db, 'storeItems', item.id), {
    stock: increment(-1),
    redeemCount: increment(1),
    updatedAt: now,
  });
  batch.update(doc(db, 'users', buyerUid), {
    expBalance: increment(-Math.round(item.priceExp)),
    lastStoreOrderId: orderId,
    updatedAt: now,
  });

  await batch.commit();
  return order;
}

export async function updateStoreOrderStatus(params: {
  order: StoreOrder;
  nextStatus: StoreOrderStatus;
  adminNote?: string;
}): Promise<void> {
  const { order, nextStatus, adminNote } = params;
  const now = new Date().toISOString();

  if (nextStatus === 'cancelled' && order.status !== 'cancelled') {
    const batch = writeBatch(db);
    batch.update(doc(db, 'storeOrders', order.id), cleanDataForFirestore({
      status: 'cancelled',
      ...(adminNote !== undefined ? { adminNote: adminNote.slice(0, 1000) } : {}),
      updatedAt: now,
    }));
    batch.update(doc(db, 'users', order.buyerUid), {
      expBalance: increment(order.expCost),
      updatedAt: now,
    });
    const itemSnap = await getDoc(doc(db, 'storeItems', order.itemId)).catch(() => null);
    if (itemSnap?.exists()) {
      batch.update(doc(db, 'storeItems', order.itemId), {
        stock: increment(order.quantity || 1),
        updatedAt: now,
      });
    }
    await batch.commit();
    return;
  }

  await updateDoc(
    doc(db, 'storeOrders', order.id),
    cleanDataForFirestore({
      status: nextStatus,
      ...(adminNote !== undefined ? { adminNote: adminNote.slice(0, 1000) } : {}),
      updatedAt: now,
    })
  );
}

// ================================
// End-of-Page Experience & Service Star Ratings
// ================================
export const SERVICE_RATING_CATEGORY_LABELS: Record<ServiceRatingCategory, string> = {
  giao_dien: 'Giao diện & Dễ dùng',
  thai_do: 'Thái độ phục vụ',
  chuyen_mon: 'Khám & Tiêm chủng',
  tien_ich: 'Tốc độ & Tiện ích',
};

export async function submitServiceRating(params: {
  score: 1 | 2 | 3 | 4 | 5;
  category: ServiceRatingCategory;
  comment?: string;
  raterName?: string;
  raterAvatarUrl?: string;
  uid?: string;
  pageView?: string;
}): Promise<ServiceRating> {
  const now = new Date().toISOString();
  const deviceId = getOrCreateDeviceId().slice(0, 128);
  const safeUid = (params.uid || '').trim().slice(0, 128);
  // Deterministic per-device or per-user ID so users can cleanly update their rating without spamming duplicates
  const docId = safeUid
    ? `rate_u_${safeUid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96)}`
    : `rate_d_${deviceId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96)}`;

  let existingCreatedAt = now;
  try {
    const existingSnap = await getDoc(doc(db, 'serviceRatings', docId));
    if (existingSnap.exists() && typeof existingSnap.data()?.createdAt === 'string') {
      existingCreatedAt = existingSnap.data().createdAt;
    }
  } catch {
    // ignore lookup errors
  }

  const cleanComment = params.comment?.trim().slice(0, 1000);
  const cleanName = params.raterName?.trim().slice(0, 128);
  const rawAvatar = params.raterAvatarUrl?.trim() || '';
  const cleanAvatar = rawAvatar && rawAvatar.length <= 500000 ? rawAvatar : undefined;

  const payload: ServiceRating = cleanDataForFirestore({
    id: docId,
    score: Math.min(5, Math.max(1, Math.round(params.score))) as 1 | 2 | 3 | 4 | 5,
    category: params.category,
    ...(cleanComment ? { comment: cleanComment } : {}),
    ...(cleanName ? { raterName: cleanName } : {}),
    ...(cleanAvatar ? { raterAvatarUrl: cleanAvatar } : {}),
    ...(safeUid ? { uid: safeUid } : {}),
    deviceId,
    ...(params.pageView ? { pageView: params.pageView.slice(0, 64) } : {}),
    createdAt: existingCreatedAt,
    updatedAt: now,
  });

  await setDoc(doc(db, 'serviceRatings', docId), payload);
  return payload;
}

export async function deleteServiceRating(ratingId: string): Promise<void> {
  await deleteDoc(doc(db, 'serviceRatings', ratingId));
}

// ================================
// Cross-Firebase User Migration Reconciliation
// ================================
export function computeLegacySnapshotId(email: string): string {
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return `snap_${Date.now()}`;
  let hash = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    hash ^= norm.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const safePrefix = norm.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').slice(0, 48);
  return `snap_${safePrefix}_${hash.toString(36)}`;
}

export async function lookupMyLegacySnapshot(email: string): Promise<LegacyUserSnapshot | null> {
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return null;
  try {
    const directId = computeLegacySnapshotId(norm);
    const directSnap = await getDoc(doc(db, 'legacyUserSnapshots', directId));
    if (directSnap.exists()) {
      return directSnap.data() as LegacyUserSnapshot;
    }
    const q = query(collection(db, 'legacyUserSnapshots'), where('email', '==', norm));
    const listSnap = await getDocs(q);
    if (!listSnap.empty) {
      return listSnap.docs[0].data() as LegacyUserSnapshot;
    }
    return null;
  } catch (err) {
    console.warn('lookupMyLegacySnapshot error:', err);
    return null;
  }
}

export async function listLegacyUserSnapshots(): Promise<LegacyUserSnapshot[]> {
  try {
    const snap = await getDocs(collection(db, 'legacyUserSnapshots'));
    return snap.docs
      .map(d => d.data() as LegacyUserSnapshot)
      .sort((a, b) => (b.migratedAt || '').localeCompare(a.migratedAt || ''));
  } catch (err) {
    console.warn('listLegacyUserSnapshots error:', err);
    return [];
  }
}

export async function listUserMigrationClaims(uid?: string): Promise<UserMigrationClaim[]> {
  try {
    const q = uid
      ? query(collection(db, 'userMigrationClaims'), where('uid', '==', uid))
      : collection(db, 'userMigrationClaims');
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data() as UserMigrationClaim)
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
  } catch (err) {
    console.warn('listUserMigrationClaims error:', err);
    return [];
  }
}

export async function confirmMigratedUserProfile(params: {
  uid: string;
  email: string;
  emailVerified: boolean;
  currentProfile: UserProfile;
  snapshot?: LegacyUserSnapshot | null;
}): Promise<{ mode: 'merged_snapshot' | 'confirmed_current' | 'queued_for_admin'; claim: UserMigrationClaim }> {
  const { uid, email, emailVerified, currentProfile, snapshot } = params;
  const now = new Date().toISOString();
  const claimId = `mig_${uid}_${Date.now()}`;

  // Case 1: Matching staged snapshot exists from previous Firebase & owner's email is verified
  if (snapshot && snapshot.claimStatus === 'pending' && emailVerified) {
    const batch = writeBatch(db);
    const mergedUserPatch: Record<string, any> = cleanDataForFirestore({
      uid,
      email: currentProfile.email || email,
      displayName: snapshot.displayName || currentProfile.displayName,
      phoneNumber: snapshot.phoneNumber || currentProfile.phoneNumber,
      verifiedPhone: snapshot.verifiedPhone || currentProfile.verifiedPhone,
      citizenId: snapshot.citizenId || currentProfile.citizenId,
      dob: snapshot.dob || currentProfile.dob,
      gender: snapshot.gender || currentProfile.gender,
      ethnicity: snapshot.ethnicity || currentProfile.ethnicity,
      provinceCode: snapshot.provinceCode || currentProfile.provinceCode,
      provinceName: snapshot.provinceName || currentProfile.provinceName,
      wardCode: snapshot.wardCode || currentProfile.wardCode,
      wardName: snapshot.wardName || currentProfile.wardName,
      address: snapshot.address || currentProfile.address,
      department: snapshot.department || currentProfile.department,
      position: snapshot.position || currentProfile.position,
      qualification: snapshot.qualification || currentProfile.qualification,
      role: snapshot.role,
      accountType: snapshot.accountType,
      expBalance: Math.round((currentProfile.expBalance || 0) + (snapshot.expBalance || 0)),
      totalExpEarned: Math.round((currentProfile.totalExpEarned || 0) + (snapshot.totalExpEarned || 0)),
      emailVerified: Boolean(snapshot.emailVerified || currentProfile.emailVerified || emailVerified),
      phoneVerified: Boolean(snapshot.phoneVerified || currentProfile.phoneVerified),
      citizenIdVerified: Boolean(snapshot.citizenIdVerified || currentProfile.citizenIdVerified),
      identityVerifiedFromDatabase: Boolean(
        snapshot.identityVerifiedFromDatabase || currentProfile.identityVerifiedFromDatabase
      ),
      personalReferralCode: snapshot.personalReferralCode || currentProfile.personalReferralCode,
      migrationStatus: 'confirmed',
      migrationConfirmedAt: now,
      migrationSnapshotId: snapshot.id,
      updatedAt: now,
    });

    batch.update(doc(db, 'users', uid), mergedUserPatch);
    batch.update(doc(db, 'legacyUserSnapshots', snapshot.id), {
      claimStatus: 'confirmed',
      confirmedByUid: uid,
      confirmedAt: now,
    });

    const claimDoc: UserMigrationClaim = cleanDataForFirestore({
      id: claimId,
      uid,
      email: (currentProfile.email || email).slice(0, 256),
      displayName: (snapshot.displayName || currentProfile.displayName || 'Thành viên').slice(0, 128),
      snapshotId: snapshot.id,
      claimType: 'confirm_exact',
      status: 'confirmed',
      userNote: 'Người dùng đã đăng nhập xác nhận dữ liệu cũ đầy đủ và chính xác, tự động đồng bộ vào hồ sơ mới.',
      createdAt: now,
      updatedAt: now,
    });
    batch.set(doc(db, 'userMigrationClaims', claimId), claimDoc);

    await batch.commit();
    return { mode: 'merged_snapshot', claim: claimDoc };
  }

  // Case 2: Staged snapshot exists, but email is not yet verified — queue confirmation for Admin safety approval
  if (snapshot && snapshot.claimStatus === 'pending' && !emailVerified) {
    const claimDoc: UserMigrationClaim = cleanDataForFirestore({
      id: claimId,
      uid,
      email: (currentProfile.email || email).slice(0, 256),
      displayName: (snapshot.displayName || currentProfile.displayName || 'Thành viên').slice(0, 128),
      snapshotId: snapshot.id,
      claimType: 'confirm_exact',
      status: 'pending',
      userNote:
        'Người dùng xác nhận dữ liệu trước đó đã đúng & đủ nhưng Email trên hệ thống mới chưa xác minh. Đề nghị Admin duyệt áp dụng đồng bộ.',
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, 'userMigrationClaims', claimId), claimDoc);
    await updateDoc(doc(db, 'users', uid), {
      migrationStatus: 'pending_review',
      updatedAt: now,
    });
    return { mode: 'queued_for_admin', claim: claimDoc };
  }

  // Case 3: Migration backup excluded `users` data — user reviews & confirms their current/updated profile is complete and accurate
  const claimDoc: UserMigrationClaim = cleanDataForFirestore({
    id: claimId,
    uid,
    email: (currentProfile.email || email).slice(0, 256),
    displayName: (currentProfile.displayName || 'Thành viên').slice(0, 128),
    claimType: 'confirm_exact',
    status: 'confirmed',
    userNote: 'Người dùng đã đăng nhập rà soát và xác nhận dữ liệu hồ sơ trên hệ thống mới đầy đủ & chính xác.',
    createdAt: now,
    updatedAt: now,
  });

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), {
    migrationStatus: 'confirmed',
    migrationConfirmedAt: now,
    updatedAt: now,
  });
  batch.set(doc(db, 'userMigrationClaims', claimId), claimDoc);
  await batch.commit();

  return { mode: 'confirmed_current', claim: claimDoc };
}

export async function submitUserMigrationAdjustmentRequest(params: {
  uid: string;
  email: string;
  displayName: string;
  snapshotId?: string;
  emailVerified?: boolean;
  disputedFields: string[];
  userNote: string;
  proposedData?: UserMigrationClaim['proposedData'];
}): Promise<UserMigrationClaim> {
  const now = new Date().toISOString();
  const claimId = `mig_adj_${params.uid}_${Date.now()}`;

  const claimDoc: UserMigrationClaim = cleanDataForFirestore({
    id: claimId,
    uid: params.uid,
    email: params.email.slice(0, 256),
    displayName: (params.displayName || 'Thành viên').slice(0, 128),
    ...(params.snapshotId ? { snapshotId: params.snapshotId } : {}),
    claimType: 'request_adjustment',
    status: 'disputed',
    disputedFields: params.disputedFields.slice(0, 20),
    userNote: params.userNote.trim().slice(0, 2000),
    ...(params.proposedData ? { proposedData: params.proposedData } : {}),
    createdAt: now,
    updatedAt: now,
  });

  const batch = writeBatch(db);
  batch.set(doc(db, 'userMigrationClaims', claimId), claimDoc);
  batch.update(doc(db, 'users', params.uid), {
    migrationStatus: 'disputed',
    updatedAt: now,
  });

  if (params.snapshotId && params.emailVerified) {
    try {
      const snapDoc = await getDoc(doc(db, 'legacyUserSnapshots', params.snapshotId));
      if (snapDoc.exists() && snapDoc.data()?.claimStatus === 'pending') {
        batch.update(doc(db, 'legacyUserSnapshots', params.snapshotId), {
          claimStatus: 'disputed',
          confirmedByUid: params.uid,
          confirmedAt: now,
        });
      }
    } catch {
      // ignore if snapshot update is restricted
    }
  }

  await batch.commit();
  return claimDoc;
}

export async function resolveUserMigrationClaim(params: {
  claim: UserMigrationClaim;
  action: 'resolve' | 'reject';
  adminUid: string;
  adminName: string;
  adminNote?: string;
  updatedUserFields?: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'phoneNumber'
      | 'citizenId'
      | 'dob'
      | 'gender'
      | 'address'
      | 'department'
      | 'position'
      | 'qualification'
      | 'role'
      | 'accountType'
      | 'expBalance'
      | 'totalExpEarned'
    >
  >;
}): Promise<void> {
  const { claim, action, adminUid, adminName, adminNote, updatedUserFields } = params;
  const now = new Date().toISOString();

  if (action === 'reject') {
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'userMigrationClaims', claim.id),
      cleanDataForFirestore({
        status: 'rejected',
        adminNote: (adminNote || 'Không đủ cơ sở điều chỉnh').slice(0, 2000),
        resolvedByUid: adminUid,
        resolvedByName: adminName,
        resolvedAt: now,
        updatedAt: now,
      })
    );
    batch.update(doc(db, 'users', claim.uid), {
      migrationStatus: 'confirmed',
      migrationConfirmedAt: now,
      updatedAt: now,
    });
    await batch.commit();
    return;
  }

  const userSnap = await getDoc(doc(db, 'users', claim.uid));
  const currentUserData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

  const userPatch: Record<string, any> = cleanDataForFirestore({
    ...(updatedUserFields || {}),
    migrationStatus: 'confirmed',
    migrationConfirmedAt: now,
    ...(claim.snapshotId ? { migrationSnapshotId: claim.snapshotId } : {}),
    updatedAt: now,
  });

  if (typeof userPatch.expBalance === 'number') {
    userPatch.expBalance = Math.max(0, Math.round(userPatch.expBalance));
  }
  if (typeof userPatch.totalExpEarned === 'number') {
    userPatch.totalExpEarned = Math.max(0, Math.round(userPatch.totalExpEarned));
  }

  const batch = writeBatch(db);
  if (currentUserData) {
    batch.update(doc(db, 'users', claim.uid), userPatch);
  }

  batch.update(
    doc(db, 'userMigrationClaims', claim.id),
    cleanDataForFirestore({
      status: 'resolved',
      adminNote: (adminNote || 'Admin đã kiểm tra và cập nhật dữ liệu mới cho tài khoản').slice(0, 2000),
      resolvedByUid: adminUid,
      resolvedByName: adminName,
      resolvedAt: now,
      updatedAt: now,
    })
  );

  if (claim.snapshotId) {
    const snapRef = doc(db, 'legacyUserSnapshots', claim.snapshotId);
    const snapExist = await getDoc(snapRef).catch(() => null);
    if (snapExist?.exists()) {
      batch.update(snapRef, {
        claimStatus: 'resolved',
        confirmedByUid: claim.uid,
        confirmedAt: now,
      });
    }
  }

  await batch.commit();

  // Keep admins registry in sync if role changed
  const nextRole = userPatch.role || currentUserData?.role;
  const nextAccountType = userPatch.accountType || currentUserData?.accountType;
  if (nextRole === 'admin' || nextRole === 'super_admin' || nextAccountType === 'admin') {
    try {
      await setDoc(
        doc(db, 'admins', claim.uid),
        cleanDataForFirestore({
          uid: claim.uid,
          email: currentUserData?.email || claim.email,
          displayName: userPatch.displayName || currentUserData?.displayName || claim.displayName,
          role: nextRole || 'admin',
          accountType: 'admin',
          updatedAt: now,
        }),
        { merge: true }
      );
    } catch {
      // ignore if already synced
    }
  }
}

// ==========================================
// Organization / Business Account Management
// ==========================================

export interface CreateOrganizationAccountParams {
  email: string;
  password?: string;
  displayName?: string;
  organizationName: string;
  organizationType: 'clinic' | 'pharmacy' | 'school' | 'enterprise' | 'agency' | 'other';
  taxCode?: string;
  businessLicenseNumber?: string;
  licenseIssueDate?: string;
  licenseIssuer?: string;
  legalRepresentative?: string;
  representativeCitizenId?: string;
  operatingField?: string;
  organizationAddress?: string;
  organizationPhone?: string;
  organizationEmail?: string;
  notes?: string;
}

export async function createOrganizationAccountManually(params: CreateOrganizationAccountParams): Promise<UserProfile> {
  const emailClean = params.email.trim().toLowerCase();
  if (!emailClean) throw new Error('Email tài khoản không được để trống.');
  if (!params.organizationName.trim()) throw new Error('Tên Doanh nghiệp / Tổ chức không được để trống.');

  const secondaryAppName = `org_prov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initSecondaryApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getSecondaryAuth(secondaryApp);

  try {
    const rawPass = params.password && params.password.trim().length >= 6 ? params.password.trim() : 'TYT@DoanhNghiep2026';
    const credential = await createUserWithEmailAndPassword(secondaryAuth, emailClean, rawPass);
    const uid = credential.user.uid;

    const userDoc: UserProfile = {
      uid,
      email: emailClean,
      displayName: params.displayName?.trim() || params.organizationName.trim(),
      role: 'organization',
      accountType: 'organization',
      organizationName: params.organizationName.trim(),
      organizationType: params.organizationType || 'enterprise',
      taxCode: params.taxCode?.trim() || undefined,
      businessLicenseNumber: params.businessLicenseNumber?.trim() || undefined,
      licenseIssueDate: params.licenseIssueDate?.trim() || undefined,
      licenseIssuer: params.licenseIssuer?.trim() || undefined,
      legalRepresentative: params.legalRepresentative?.trim() || undefined,
      representativeCitizenId: params.representativeCitizenId?.trim() || undefined,
      operatingField: params.operatingField?.trim() || undefined,
      organizationAddress: params.organizationAddress?.trim() || undefined,
      organizationPhone: params.organizationPhone?.trim() || undefined,
      organizationEmail: params.organizationEmail?.trim() || emailClean,
      phoneNumber: params.organizationPhone?.trim() || undefined,
      status: 'active',
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      notes: params.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'users', uid), cleanDataForFirestore(userDoc));
    return userDoc;
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use') {
      throw new Error(`Email "${emailClean}" đã tồn tại trong hệ thống.`);
    }
    throw new Error(err?.message || 'Không thể tạo tài khoản tổ chức.');
  } finally {
    await signSecondaryOut(secondaryAuth).catch(() => {});
    await deleteSecondaryApp(secondaryApp).catch(() => {});
  }
}

export interface ImportOrgResult {
  total: number;
  successCount: number;
  failedCount: number;
  createdAccounts: UserProfile[];
  errors: { row: number; name: string; email: string; error: string }[];
}

export async function batchImportOrganizationAccounts(
  rows: Record<string, any>[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportOrgResult> {
  const result: ImportOrgResult = {
    total: rows.length,
    successCount: 0,
    failedCount: 0,
    createdAccounts: [],
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (onProgress) onProgress(i + 1, rows.length);

    const getVal = (...keys: string[]): string => {
      for (const k of keys) {
        for (const rowKey of Object.keys(row)) {
          const normRowKey = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normTarget = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normRowKey === normTarget || normRowKey.includes(normTarget)) {
            const val = String(row[rowKey] ?? '').trim();
            if (val) return val;
          }
        }
      }
      return '';
    };

    const orgName = getVal('tento chuc', 'tendoanhnghiep', 'ten', 'organizationname', 'name');
    const email = getVal('email', 'emaildangnhap', 'taikhoan', 'organizationemail');
    const password = getVal('matkhau', 'password', 'pass') || 'TYT@DoanhNghiep2026';
    const taxCode = getVal('masothue', 'mst', 'taxcode');
    const licenseNumber = getVal('sogiayphep', 'giayphep', 'gpdkkd', 'businesslicensenumber');
    const licenseDate = getVal('ngaycap', 'licenseissuedate');
    const licenseIssuer = getVal('noicap', 'licenseissuer');
    const repName = getVal('nguoidaidien', 'daidien', 'legalrepresentative');
    const repCccd = getVal('cccd', 'cccdnguoidaidien', 'representativecitizenid');
    const field = getVal('linhvuc', 'operatingfield');
    const address = getVal('diachi', 'organizationaddress', 'address');
    const phone = getVal('sodienthoai', 'sdt', 'phone', 'organizationphone');
    const notes = getVal('ghichu', 'notes');

    const rawType = getVal('loaihinh', 'organizationtype', 'type').toLowerCase();
    let orgType: 'clinic' | 'pharmacy' | 'school' | 'enterprise' | 'agency' | 'other' = 'enterprise';
    if (rawType.includes('kham') || rawType.includes('clinic')) orgType = 'clinic';
    else if (rawType.includes('thuoc') || rawType.includes('pharmacy')) orgType = 'pharmacy';
    else if (rawType.includes('truong') || rawType.includes('school')) orgType = 'school';
    else if (rawType.includes('co quan') || rawType.includes('agency')) orgType = 'agency';
    else if (rawType.includes('khac') || rawType.includes('other')) orgType = 'other';

    if (!orgName || !email) {
      result.failedCount++;
      result.errors.push({
        row: i + 2,
        name: orgName || '(Chưa có tên)',
        email: email || '(Chưa có email)',
        error: 'Thiếu Tên tổ chức hoặc Email đăng nhập bắt buộc.',
      });
      continue;
    }

    try {
      const created = await createOrganizationAccountManually({
        email,
        password,
        organizationName: orgName,
        organizationType: orgType,
        taxCode: taxCode || undefined,
        businessLicenseNumber: licenseNumber || undefined,
        licenseIssueDate: licenseDate || undefined,
        licenseIssuer: licenseIssuer || undefined,
        legalRepresentative: repName || undefined,
        representativeCitizenId: repCccd || undefined,
        operatingField: field || undefined,
        organizationAddress: address || undefined,
        organizationPhone: phone || undefined,
        organizationEmail: email,
        notes: notes || undefined,
      });
      result.successCount++;
      result.createdAccounts.push(created);
    } catch (err: any) {
      result.failedCount++;
      result.errors.push({
        row: i + 2,
        name: orgName,
        email,
        error: err?.message || 'Lỗi không xác định khi tạo tài khoản.',
      });
    }

    // Small delay between auth requests
    await new Promise(r => setTimeout(r, 150));
  }

  return result;
}

export function downloadOrganizationImportTemplateExcel(): void {
  const templateRows = [
    {
      'Tên Tổ chức / Doanh nghiệp (*)': 'Phòng khám Đa khoa Hoàn Mỹ Sài Gòn',
      'Email đăng nhập (*)': 'hoanmy.clinic@gmail.com',
      'Mật khẩu ban đầu': 'TYT@DoanhNghiep2026',
      'Loại hình (clinic/pharmacy/school/enterprise/agency/other)': 'clinic',
      'Mã số thuế (MST)': '0301234567',
      'Số Giấy phép / ĐKKD': '08942/SYT-GPHĐ',
      'Ngày cấp GP (YYYY-MM-DD)': '2022-05-15',
      'Nơi cấp GP': 'Sở Y tế TP.HCM',
      'Người đại diện pháp luật': 'BS.CKII Nguyễn Văn An',
      'CCCD Người đại diện': '079085001234',
      'Lĩnh vực hoạt động': 'Khám chữa bệnh đa khoa, xét nghiệm, chẩn đoán hình ảnh',
      'Địa chỉ cơ sở tại địa bàn': '124 Đường số 7, Phường Tân Tạo, Quận Bình Tân',
      'Số điện thoại liên hệ': '02838776655',
      'Ghi chú': 'Phòng khám đối tác liên kết chuyển viện trạm y tế',
    },
    {
      'Tên Tổ chức / Doanh nghiệp (*)': 'Nhà thuốc GPP Bình An 2',
      'Email đăng nhập (*)': 'nhathuoc.binhan2@gmail.com',
      'Mật khẩu ban đầu': 'TYT@DoanhNghiep2026',
      'Loại hình (clinic/pharmacy/school/enterprise/agency/other)': 'pharmacy',
      'Mã số thuế (MST)': '0309876543',
      'Số Giấy phép / ĐKKD': '04123/ĐKKD-BYT',
      'Ngày cấp GP (YYYY-MM-DD)': '2023-01-10',
      'Nơi cấp GP': 'Sở Y tế TP.HCM',
      'Người đại diện pháp luật': 'Dược sĩ Trần Thị Bích',
      'CCCD Người đại diện': '079188002345',
      'Lĩnh vực hoạt động': 'Bán lẻ thuốc thành phẩm, thực phẩm chức năng, thiết bị y tế',
      'Địa chỉ cơ sở tại địa bàn': '45 Đường số 2, Khu phố 4',
      'Số điện thoại liên hệ': '0908123456',
      'Ghi chú': 'Nhà thuốc tham gia mạng lưới theo dõi dược cộng đồng',
    },
    {
      'Tên Tổ chức / Doanh nghiệp (*)': 'Công ty TNHH Dược Phẩm & Thiết Bị Y Tế Tâm Đức',
      'Email đăng nhập (*)': 'tamduc.medical@gmail.com',
      'Mật khẩu ban đầu': 'TYT@DoanhNghiep2026',
      'Loại hình (clinic/pharmacy/school/enterprise/agency/other)': 'enterprise',
      'Mã số thuế (MST)': '0315678901',
      'Số Giấy phép / ĐKKD': '0315678901',
      'Ngày cấp GP (YYYY-MM-DD)': '2021-08-20',
      'Nơi cấp GP': 'Sở Kế hoạch và Đầu tư',
      'Người đại diện pháp luật': 'Lê Minh Tuấn',
      'CCCD Người đại diện': '079090003456',
      'Lĩnh vực hoạt động': 'Cung ứng vật tư y tế, hóa chất xét nghiệm',
      'Địa chỉ cơ sở tại địa bàn': 'Lô B2, Khu công nghiệp Tân Tạo',
      'Số điện thoại liên hệ': '02837543210',
      'Ghi chú': 'Doanh nghiệp tài trợ thiết bị sơ cấp cứu cơ sở',
    },
    {
      'Tên Tổ chức / Doanh nghiệp (*)': 'Trường Tiểu học Nguyễn Văn Trỗi',
      'Email đăng nhập (*)': 'c1.nguyenvantroi@gmail.com',
      'Mật khẩu ban đầu': 'TYT@DoanhNghiep2026',
      'Loại hình (clinic/pharmacy/school/enterprise/agency/other)': 'school',
      'Mã số thuế (MST)': '0305544332',
      'Số Giấy phép / ĐKKD': 'QĐ-892/UBND',
      'Ngày cấp GP (YYYY-MM-DD)': '2018-09-01',
      'Nơi cấp GP': 'UBND Quận/Huyện',
      'Người đại diện pháp luật': 'Phạm Hoàng Yến (Hiệu trưởng)',
      'CCCD Người đại diện': '079175004567',
      'Lĩnh vực hoạt động': 'Giáo dục tiểu học & Y tế học đường',
      'Địa chỉ cơ sở tại địa bàn': '88 Hương Lộ 2, Khu phố 6',
      'Số điện thoại liên hệ': '02838751234',
      'Ghi chú': 'Điểm phối hợp tiêm chủng học đường & nha học đường',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Import_DoanhNghiep');

  ws['!cols'] = [
    { wch: 38 },
    { wch: 28 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 22 },
    { wch: 26 },
    { wch: 18 },
    { wch: 35 },
    { wch: 38 },
    { wch: 16 },
    { wch: 30 },
  ];

  XLSX.writeFile(wb, 'Mau_Import_TaiKhoan_DoanhNghiep.xlsx');
}

export function exportOrganizationsToExcel(organizations: UserProfile[]): void {
  const typeMap: Record<string, string> = {
    clinic: 'Phòng khám',
    pharmacy: 'Nhà thuốc GPP',
    school: 'Trường học',
    enterprise: 'Doanh nghiệp / Công ty',
    agency: 'Cơ quan / Đơn vị hành chính',
    other: 'Khác',
  };

  const exportRows = organizations.map((org, index) => ({
    'STT': index + 1,
    'Tên Tổ chức / Doanh nghiệp': org.organizationName || org.displayName || '—',
    'Email đăng nhập': org.email || '—',
    'Loại hình': (org.organizationType && typeMap[org.organizationType]) || org.organizationType || 'Doanh nghiệp',
    'Mã số thuế (MST)': org.taxCode || '—',
    'Số Giấy phép / ĐKKD': org.businessLicenseNumber || '—',
    'Ngày cấp GP': org.licenseIssueDate || '—',
    'Nơi cấp GP': org.licenseIssuer || '—',
    'Người đại diện pháp luật': org.legalRepresentative || '—',
    'CCCD Người đại diện': org.representativeCitizenId || '—',
    'Lĩnh vực hoạt động': org.operatingField || '—',
    'Địa chỉ trụ sở / Cơ sở': org.organizationAddress || org.address || '—',
    'Số điện thoại': org.organizationPhone || org.phoneNumber || '—',
    'Email liên hệ': org.organizationEmail || org.email || '—',
    'Trạng thái': org.status === 'banned' ? 'Đã khóa' : org.status === 'pending_approval' ? 'Chờ duyệt' : 'Đang hoạt động',
    'Ngày tạo': org.createdAt ? org.createdAt.split('T')[0] : '—',
    'Ghi chú': org.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSach_ToChuc_DoanhNghiep');

  ws['!cols'] = [
    { wch: 6 },
    { wch: 36 },
    { wch: 28 },
    { wch: 20 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 20 },
    { wch: 26 },
    { wch: 18 },
    { wch: 32 },
    { wch: 36 },
    { wch: 16 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
  ];

  XLSX.writeFile(wb, `Danh_sach_Tai_khoan_To_chuc_Doanh_nghiep_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function getBusinessTrips(): Promise<BusinessTrip[]> {
  try {
    const snap = await getDocs(collection(db, 'businessTrips'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BusinessTrip));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'businessTrips');
    return [];
  }
}

export async function saveBusinessTripToFirestore(trip: BusinessTrip): Promise<void> {
  const clean = {
    ...trip,
    updatedAt: new Date().toISOString(),
  };
  const docRef = doc(db, 'businessTrips', trip.id);
  await setDoc(docRef, clean, { merge: true });
}

export async function deleteBusinessTripFromFirestore(tripId: string): Promise<void> {
  await deleteDoc(doc(db, 'businessTrips', tripId));
}





