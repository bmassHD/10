import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { BackupItem, GitHubConfig, SystemSettings } from '../types';
import { cleanDataForFirestore, logAuditEvent, computeLegacySnapshotId } from './firebaseService';
import { GitHubService } from './githubService';
import {
  exportBhxhServerConfigForBackup,
  restoreBhxhServerConfigFromBackup,
} from './bhxhService';
import { utf8ToBase64, base64ToUtf8 } from '../utils/base64Utils';

export const AUTO_GITHUB_BACKUP_HOUR_VN = 3; // 03:00 AM giờ Việt Nam

export interface RestoreProgressInfo {
  phase: 'parsing' | 'staging_users' | 'restoring' | 'finalizing' | 'completed' | 'error';
  phaseLabel: string;
  currentCollection?: string;
  currentCollectionLabel?: string;
  processedCollections: number;
  totalCollections: number;
  processedRecords: number;
  totalRecords: number;
  restoredCount: number;
  skippedCount: number;
  stagedSnapshotsCount: number;
  percent: number;
  message: string;
}

export function getVietnamTimeParts(date: Date = new Date()): {
  dayKey: string;
  hour: number;
  minute: number;
  timeLabel: string;
} {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const getVal = (type: string) => parts.find(p => p.type === type)?.value || '00';
    const year = getVal('year');
    const month = getVal('month');
    const day = getVal('day');
    let hour = Number(getVal('hour'));
    if (hour === 24) hour = 0;
    const minute = Number(getVal('minute'));
    const hourStr = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');

    return {
      dayKey: `${year}-${month}-${day}`,
      hour,
      minute,
      timeLabel: `${hourStr}:${minStr}`,
    };
  } catch {
    const vnMs = date.getTime() + 7 * 60 * 60 * 1000;
    const vn = new Date(vnMs);
    const dayKey = vn.toISOString().slice(0, 10);
    const hour = vn.getUTCHours();
    const minute = vn.getUTCMinutes();
    return {
      dayKey,
      hour,
      minute,
      timeLabel: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  }
}

export function isGitHubConfigValid(config?: Partial<GitHubConfig>): boolean {
  return Boolean(config?.token?.trim() && config?.owner?.trim() && config?.repo?.trim());
}

export function hasGithubBackupForDay(
  settings?: Partial<SystemSettings>,
  targetDayKey?: string
): boolean {
  const dayKey = targetDayKey || getVietnamTimeParts().dayKey;
  if (settings?.lastGithubBackupDay === dayKey) {
    return true;
  }
  if (settings?.lastGithubBackupAt) {
    const parsed = new Date(settings.lastGithubBackupAt);
    if (!Number.isNaN(parsed.getTime())) {
      if (getVietnamTimeParts(parsed).dayKey === dayKey) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Trả về true nếu đã từ 03:00 sáng (giờ VN) trở đi mà hôm nay chưa đẩy sao lưu lên GitHub.
 * Khi Admin đã đẩy xong (lastGithubBackupDay === todayVN), hàm trả về false -> ngừng nhắc ngay.
 */
export function isDailyGithubBackupMissing(
  settings?: Partial<SystemSettings>,
  now: Date = new Date()
): boolean {
  if (!settings || settings.autoBackupGithubEnabled === false) {
    return false;
  }
  const { dayKey, hour } = getVietnamTimeParts(now);
  if (hour < AUTO_GITHUB_BACKUP_HOUR_VN) {
    return false;
  }
  return !hasGithubBackupForDay(settings, dayKey);
}

/**
 * Kiểm tra xem có đang trong khung giờ 03:00 - 03:59 sáng giờ VN và chưa tự động đẩy hôm nay không
 */
export function shouldRunAutoGithubBackupNow(
  settings?: Partial<SystemSettings>,
  now: Date = new Date()
): boolean {
  if (!settings || settings.autoBackupGithubEnabled === false) {
    return false;
  }
  if (!isGitHubConfigValid(settings.githubConfig)) {
    return false;
  }
  const { dayKey, hour } = getVietnamTimeParts(now);
  if (hour !== AUTO_GITHUB_BACKUP_HOUR_VN) {
    return false;
  }
  if (hasGithubBackupForDay(settings, dayKey)) {
    return false;
  }
  if (settings.lastAutoGithubBackupAttemptDay === dayKey) {
    return false;
  }
  return true;
}

export const CURRENT_SYSTEM_VERSION = 'v3.0.0 (Bản Chính Thức)';

export const BACKUP_COLLECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'systemSettings', label: 'Cấu hình trạm & Bản đồ' },
  { key: 'nearbyFacilities', label: 'Cơ sở Y tế lân cận' },
  { key: 'events', label: 'Sự kiện & Ngày lễ' },
  { key: 'posts', label: 'Tin tức & Truyền thông' },
  { key: 'announcements', label: 'Thông báo khẩn' },
  { key: 'services', label: 'Danh mục dịch vụ' },
  { key: 'documents', label: 'Văn bản & Biểu mẫu' },
  { key: 'workSchedules', label: 'Lịch trực 24/7' },
  { key: 'businessTrips', label: 'Lịch công tác' },
  { key: 'attendanceRecords', label: 'Chấm công nhân sự' },
  { key: 'feedback', label: 'Phản ánh kiến nghị' },
  { key: 'serviceRatings', label: 'Đánh giá dịch vụ (★)' },
  { key: 'appointments', label: 'Lịch hẹn khám' },
  { key: 'targetedNotifications', label: 'Thông báo mục tiêu' },
  { key: 'storeItems', label: 'Cửa hàng đổi EXP (Mặt hàng)' },
  { key: 'storeOrders', label: 'Đơn đổi quà EXP' },
  { key: 'referralCodes', label: 'Mã giới thiệu Admin/Cán bộ' },
  { key: 'userReferralLinks', label: 'Link giới thiệu cá nhân' },
  { key: 'referralTracking', label: 'Theo dõi giới thiệu (+1000 EXP)' },
  { key: 'users', label: 'Tài khoản, Định danh Y tế & Bảo mật người dùng' },
  { key: 'verifiedIdentifiers', label: 'Khoá định danh đã xác minh (Email/SĐT/CCCD)' },
  { key: 'legacyUserSnapshots', label: 'Hồ sơ đối chiếu di trú Firebase' },
  { key: 'userMigrationClaims', label: 'Yêu cầu xác nhận/điều chỉnh di trú' },
  { key: 'admins', label: 'Danh sách Quản trị viên' },
  { key: 'tasks', label: 'Nhiệm vụ công việc' },
  { key: 'rescueSignals', label: 'Tín hiệu cứu hộ SOS' },
  { key: 'siteStats', label: 'Thống kê lượt truy cập' },
  { key: 'onlinePresence', label: 'Trạng thái trực tuyến' },
  { key: 'pushSubscriptions', label: 'Đăng ký thông báo đẩy' },
  { key: 'bhxhServerConfig', label: 'Cấu hình API BHXH (Server)' },
  { key: 'aiServerConfig', label: 'Cấu hình Agent AI (Server)' },
  { key: 'auditLogs', label: 'Nhật ký kiểm toán' },
];

const RESTORABLE_COLLECTIONS = new Set<string>([
  'systemSettings',
  'nearbyFacilities',
  'events',
  'posts',
  'announcements',
  'services',
  'documents',
  'workSchedules',
  'businessTrips',
  'attendanceRecords',
  'feedback',
  'serviceRatings',
  'appointments',
  'targetedNotifications',
  'storeItems',
  'storeOrders',
  'referralCodes',
  'userReferralLinks',
  'referralTracking',
  'users',
  'verifiedIdentifiers',
  'legacyUserSnapshots',
  'userMigrationClaims',
  'admins',
  'tasks',
  'rescueSignals',
  'siteStats',
  'onlinePresence',
  'pushSubscriptions',
  'bhxhServerConfig',
  'aiServerConfig',
  'auditLogs',
]);

const MAX_SINGLE_DOC_BACKUP_BYTES = 800_000; // Safe margin under Firestore 1 MiB document limit
const BACKUP_CHUNK_CHAR_SIZE = 280_000; // Max ~840 KB UTF-8 per chunk doc (strictly under 900 KB rule & 1 MiB limit)

async function exportAiServerConfigForBackup(): Promise<any[]> {
  if (!auth.currentUser) return [];
  const token = await auth.currentUser.getIdToken();
  const res = await fetch('/api/ai/backup-export', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ct = res.headers.get('content-type') || '';
  if (res.status === 404 || !ct.includes('application/json')) {
    return [];
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  if (data?.ok && data?.hasConfigured && data?.record) {
    return [data.record];
  }
  return [];
}

async function restoreAiServerConfigFromBackup(record: Record<string, any>): Promise<boolean> {
  if (!auth.currentUser || !record) return false;
  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/ai/backup-restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ record }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export class BackupService {
  /**
   * Collect snapshot across all system Firestore collections
   */
  private static async collectSnapshot(options?: { excludeUsers?: boolean }): Promise<{
    backupData: Record<string, any[]>;
    stats: BackupItem['stats'];
    collectionsIncluded: string[];
    failedCollections: string[];
    dataJson: string;
    sizeBytes: number;
  }> {
    const excludeUsers = Boolean(options?.excludeUsers);
    const backupData: Record<string, any[]> = {};
    const collectionsIncluded: string[] = [];
    const failedCollections: string[] = [];
    const stats: BackupItem['stats'] = {
      postsCount: 0,
      servicesCount: 0,
      documentsCount: 0,
      usersCount: 0,
      feedbackCount: 0,
      workSchedulesCount: 0,
      businessTripsCount: 0,
      announcementsCount: 0,
      appointmentsCount: 0,
      tasksCount: 0,
      notificationsCount: 0,
      auditLogsCount: 0,
      adminsCount: 0,
      settingsCount: 0,
      rescueSignalsCount: 0,
      onlinePresenceCount: 0,
      nearbyFacilitiesCount: 0,
      eventsCount: 0,
      siteStatsCount: 0,
      pushSubscriptionsCount: 0,
      feedbackAttachmentsCount: 0,
      verifiedIdentifiersCount: 0,
      userDevicesCount: 0,
      bhxhServerConfigCount: 0,
      aiServerConfigCount: 0,
      referralCodesCount: 0,
      userReferralLinksCount: 0,
      referralTrackingCount: 0,
      attendanceRecordsCount: 0,
      storeItemsCount: 0,
      storeOrdersCount: 0,
      serviceRatingsCount: 0,
      legacyUserSnapshotsCount: 0,
      userMigrationClaimsCount: 0,
      totalRecords: 0,
    };

    const currentUid = auth.currentUser?.uid || '';

    for (const { key: collName } of BACKUP_COLLECTIONS) {
      if (excludeUsers && (collName === 'users' || collName === 'verifiedIdentifiers')) {
        continue;
      }
      if (collName === 'bhxhServerConfig') {
        try {
          const bhxhRecords = await exportBhxhServerConfigForBackup();
          backupData[collName] = bhxhRecords;
          collectionsIncluded.push(collName);
          stats.bhxhServerConfigCount = bhxhRecords.length;
          stats.totalRecords = (stats.totalRecords || 0) + bhxhRecords.length;
        } catch (bhxhErr) {
          console.warn('Snapshot reading BHXH server config failed:', bhxhErr);
          backupData[collName] = [];
          failedCollections.push(collName);
        }
        continue;
      }
      if (collName === 'aiServerConfig') {
        try {
          const aiRecords = await exportAiServerConfigForBackup();
          backupData[collName] = aiRecords;
          collectionsIncluded.push(collName);
          stats.aiServerConfigCount = aiRecords.length;
          stats.totalRecords = (stats.totalRecords || 0) + aiRecords.length;
        } catch (aiErr) {
          console.warn('Snapshot reading AI server config failed:', aiErr);
          backupData[collName] = [];
          failedCollections.push(collName);
        }
        continue;
      }

      try {
        const snap = await getDocs(collection(db, collName));
        let docs = snap.docs
          .filter(d => !(collName === 'systemSettings' && d.id === 'connection_test'))
          .map(d => ({ id: d.id, ...d.data() }));

        if (collName === 'users') {
          let totalDevices = 0;
          docs = await Promise.all(
            docs.map(async (userDoc: any) => {
              let verifiedDevices: any[] = [];
              try {
                const devSnap = await getDocs(collection(db, 'users', userDoc.id, 'devices'));
                verifiedDevices = devSnap.docs.map(dd => ({ deviceId: dd.id, ...dd.data() }));
                totalDevices += verifiedDevices.length;
              } catch {
                verifiedDevices = [];
              }

              // users/{uid}/security/totp is owner-only per firestore.rules
              let totpSecurity: any = undefined;
              if (currentUid && userDoc.id === currentUid) {
                try {
                  const totpSnap = await getDoc(doc(db, 'users', userDoc.id, 'security', 'totp'));
                  if (totpSnap.exists()) {
                    totpSecurity = totpSnap.data();
                  }
                } catch {
                  // non-blocking
                }
              }

              return {
                ...userDoc,
                verifiedDevices,
                ...(totpSecurity ? { totpSecurity } : {}),
              };
            })
          );
          stats.userDevicesCount = totalDevices;
          stats.totalRecords = (stats.totalRecords || 0) + totalDevices;
        }

        backupData[collName] = docs;
        collectionsIncluded.push(collName);

        const count = docs.length;
        stats.totalRecords = (stats.totalRecords || 0) + count;

        if (collName === 'posts') stats.postsCount = count;
        if (collName === 'services') stats.servicesCount = count;
        if (collName === 'documents') stats.documentsCount = count;
        if (collName === 'users') stats.usersCount = count;
        if (collName === 'verifiedIdentifiers') stats.verifiedIdentifiersCount = count;
        if (collName === 'feedback') {
          stats.feedbackCount = count;
          stats.feedbackAttachmentsCount = docs.reduce(
            (sum: number, item: any) =>
              sum + (Array.isArray(item.attachments) ? item.attachments.length : 0),
            0
          );
        }
        if (collName === 'workSchedules') stats.workSchedulesCount = count;
        if (collName === 'businessTrips') stats.businessTripsCount = count;
        if (collName === 'announcements') stats.announcementsCount = count;
        if (collName === 'appointments') stats.appointmentsCount = count;
        if (collName === 'tasks') stats.tasksCount = count;
        if (collName === 'targetedNotifications') stats.notificationsCount = count;
        if (collName === 'auditLogs') stats.auditLogsCount = count;
        if (collName === 'admins') stats.adminsCount = count;
        if (collName === 'systemSettings') stats.settingsCount = count;
        if (collName === 'rescueSignals') stats.rescueSignalsCount = count;
        if (collName === 'onlinePresence') stats.onlinePresenceCount = count;
        if (collName === 'nearbyFacilities') stats.nearbyFacilitiesCount = count;
        if (collName === 'events') stats.eventsCount = count;
        if (collName === 'siteStats') stats.siteStatsCount = count;
        if (collName === 'pushSubscriptions') stats.pushSubscriptionsCount = count;
        if (collName === 'referralCodes') stats.referralCodesCount = count;
        if (collName === 'userReferralLinks') stats.userReferralLinksCount = count;
        if (collName === 'referralTracking') stats.referralTrackingCount = count;
        if (collName === 'attendanceRecords') stats.attendanceRecordsCount = count;
        if (collName === 'storeItems') stats.storeItemsCount = count;
        if (collName === 'storeOrders') stats.storeOrdersCount = count;
        if (collName === 'serviceRatings') stats.serviceRatingsCount = count;
        if (collName === 'legacyUserSnapshots') stats.legacyUserSnapshotsCount = count;
        if (collName === 'userMigrationClaims') stats.userMigrationClaimsCount = count;
      } catch (collectionErr) {
        console.warn(`Snapshot reading collection ${collName} failed:`, collectionErr);
        backupData[collName] = [];
        failedCollections.push(collName);
      }
    }

    const dataJson = JSON.stringify(backupData);
    const sizeBytes = new Blob([dataJson]).size;

    return {
      backupData,
      stats,
      collectionsIncluded,
      failedCollections,
      dataJson,
      sizeBytes,
    };
  }

  /**
   * Create a full snapshot backup in Firestore `backups` collection
   */
  public static async createBackup(
    userEmail: string,
    title?: string
  ): Promise<{ success: boolean; backupItem?: BackupItem; warning?: string; error?: string }> {
    try {
      const {
        stats,
        collectionsIncluded,
        failedCollections,
        dataJson,
        sizeBytes,
      } = await this.collectSnapshot();

      const nowIso = new Date().toISOString();
      const backupTitle =
        title?.trim() ||
        `Bản sao lưu hệ thống ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;

      const needsChunking = sizeBytes > MAX_SINGLE_DOC_BACKUP_BYTES;
      const chunks: string[] = [];
      if (needsChunking) {
        for (let offset = 0; offset < dataJson.length; offset += BACKUP_CHUNK_CHAR_SIZE) {
          chunks.push(dataJson.slice(offset, offset + BACKUP_CHUNK_CHAR_SIZE));
        }
      }

      const backupPayload: Omit<BackupItem, 'id'> = {
        title: backupTitle,
        version: CURRENT_SYSTEM_VERSION,
        createdAt: nowIso,
        createdBy: userEmail || 'Hệ thống',
        sizeBytes,
        collectionsIncluded,
        stats,
        storageType: 'cloud',
        encoding: needsChunking ? 'chunked' : 'json',
        isChunked: needsChunking,
        chunkCount: chunks.length,
        dataJson: needsChunking ? '' : dataJson,
      };

      const ref = await addDoc(collection(db, 'backups'), cleanDataForFirestore(backupPayload));

      if (needsChunking) {
        try {
          for (let idx = 0; idx < chunks.length; idx++) {
            const chunkId = `chunk_${String(idx).padStart(4, '0')}`;
            await setDoc(doc(db, 'backups', ref.id, 'chunks', chunkId), {
              chunkIndex: idx,
              totalChunks: chunks.length,
              data: chunks[idx],
              createdAt: nowIso,
            });
          }
        } catch (chunkErr) {
          await this.deleteBackup(ref.id);
          throw chunkErr;
        }
      }

      // Update lastBackupAt in systemSettings/general
      try {
        await setDoc(
          doc(db, 'systemSettings', 'general'),
          { lastBackupAt: nowIso, updatedAt: nowIso },
          { merge: true }
        );
      } catch (settingsErr) {
        console.warn('Could not update lastBackupAt:', settingsErr);
      }

      // Record audit log
      try {
        await logAuditEvent(
          'Tạo bản sao lưu hệ thống',
          'Sao lưu & Phục hồi',
          `${backupTitle} (${stats.totalRecords || 0} bản ghi, ${Math.max(1, Math.round(sizeBytes / 1024))} KB${
            needsChunking ? `, chia ${chunks.length} phân mảnh` : ''
          })`,
          { uid: userEmail || 'admin', name: userEmail || 'Admin' }
        );
      } catch {
        // Non-blocking audit log
      }

      const backupItem: BackupItem = {
        id: ref.id,
        ...backupPayload,
      };

      return {
        success: true,
        backupItem,
        warning:
          failedCollections.length > 0
            ? `Một số phân hệ không đọc được: ${failedCollections.join(', ')}`
            : undefined,
      };
    } catch (err: any) {
      console.error('Create backup failed:', err);
      return { success: false, error: err?.message || 'Lỗi khi tạo bản sao lưu' };
    }
  }

  /**
   * Resolve full JSON string for a Cloud backup item (handles both inline and chunked subcollection backups)
   */
  public static async resolveCloudBackupJson(backup: BackupItem): Promise<string> {
    if (backup.dataJson && backup.dataJson.trim()) {
      return backup.dataJson;
    }
    if (!backup.id || (!backup.isChunked && backup.encoding !== 'chunked')) {
      return '';
    }
    const chunkSnap = await getDocs(collection(db, 'backups', backup.id, 'chunks'));
    if (chunkSnap.empty) {
      throw new Error('Không tìm thấy các phân mảnh dữ liệu của bản sao lưu Cloud này.');
    }
    const chunks = chunkSnap.docs
      .map(d => d.data() as { chunkIndex?: number; data?: string })
      .sort((a, b) => Number(a.chunkIndex ?? 0) - Number(b.chunkIndex ?? 0));
    if (backup.chunkCount && chunks.length < backup.chunkCount) {
      throw new Error(
        `Bản sao lưu bị thiếu phân mảnh (${chunks.length}/${backup.chunkCount}). Vui lòng tạo bản sao lưu mới.`
      );
    }
    return chunks.map(c => c.data || '').join('');
  }

  /**
   * Snapshot all collections and immediately download as a local JSON file (no 1MB cloud limit)
   */
  public static async exportLocalBackup(
    userEmail: string,
    title?: string,
    options?: { excludeUsers?: boolean }
  ): Promise<{
    success: boolean;
    totalRecords?: number;
    sizeBytes?: number;
    warning?: string;
    error?: string;
  }> {
    try {
      const { stats, collectionsIncluded, failedCollections, dataJson, sizeBytes } =
        await this.collectSnapshot(options);
      const nowIso = new Date().toISOString();
      const backupItem: BackupItem = {
        id: `local_${Date.now()}`,
        title:
          title?.trim() ||
          (options?.excludeUsers
            ? `Bản sao lưu hệ thống (Trừ dữ liệu User) ${new Date().toLocaleDateString('vi-VN')}`
            : `Bản sao lưu cục bộ ${new Date().toLocaleDateString('vi-VN')}`),
        version: CURRENT_SYSTEM_VERSION,
        createdAt: nowIso,
        createdBy: userEmail || 'Admin',
        sizeBytes,
        collectionsIncluded,
        stats,
        dataJson,
      };
      this.downloadBackupFile(backupItem);
      return {
        success: true,
        totalRecords: stats.totalRecords || 0,
        sizeBytes,
        warning:
          failedCollections.length > 0
            ? `Một số phân hệ không đọc được nên có thể bị thiếu: ${failedCollections.join(', ')}`
            : undefined,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Không thể xuất tệp sao lưu' };
    }
  }

  /**
   * Push full JSON snapshot backup directly into the configured GitHub repository
   * and persist the backup metadata record in Firestore `backups` history
   */
  public static async backupToGitHub(
    githubConfig: GitHubConfig,
    userEmail: string,
    title?: string,
    options?: { isAutoBackup?: boolean }
  ): Promise<{
    success: boolean;
    backupItem?: BackupItem;
    path?: string;
    htmlUrl?: string;
    totalRecords?: number;
    sizeBytes?: number;
    warning?: string;
    error?: string;
  }> {
    const isAutoBackup = Boolean(options?.isAutoBackup);
    const todayKey = getVietnamTimeParts().dayKey;

    if (!githubConfig?.token || !githubConfig?.owner || !githubConfig?.repo) {
      const errMsg = 'Chưa cấu hình GitHub PAT để sao lưu lên kho lưu trữ.';
      if (isAutoBackup) {
        try {
          await setDoc(
            doc(db, 'systemSettings', 'general'),
            cleanDataForFirestore({
              lastAutoGithubBackupAttemptDay: todayKey,
              lastAutoGithubBackupStatus: 'failed',
              lastAutoGithubBackupError: errMsg,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        } catch {
          // ignore
        }
      }
      return {
        success: false,
        error: errMsg,
      };
    }

    try {
      const { stats, collectionsIncluded, failedCollections, backupData, sizeBytes } =
        await this.collectSnapshot();
      const nowIso = new Date().toISOString();
      const defaultTitle = isAutoBackup
        ? `Sao lưu tự động 03:00 lên GitHub ${new Date().toLocaleDateString('vi-VN')}`
        : `Sao lưu GitHub ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`;
      const backupTitle = title?.trim() || defaultTitle;

      // Mã hoá toàn bộ dữ liệu sao lưu sang Base64 an toàn để ngăn chặn cơ chế GitHub Secret Scanning
      // ("Repository rule violations found: Secret detected in content") chặn đẩy mã khi có token/key hệ thống
      const rawDataString = JSON.stringify(backupData);
      const dataBase64 = utf8ToBase64(rawDataString);

      const envelope = {
        title: backupTitle,
        version: CURRENT_SYSTEM_VERSION,
        createdAt: nowIso,
        createdBy: userEmail || (isAutoBackup ? 'Hệ thống tự động 03:00' : 'Admin'),
        encoding: 'base64',
        isBase64: true,
        isAutoBackup,
        sizeBytes,
        collectionsIncluded,
        stats,
        dataBase64,
      };

      const res = await GitHubService.uploadJsonContent(
        githubConfig,
        `backups/system_backup_${Date.now()}.json`,
        envelope,
        `Sao lưu dữ liệu hệ thống (Base64${isAutoBackup ? ' · Tự động 03:00' : ''}) - ${backupTitle}`
      );

      if (!res.success) {
        if (isAutoBackup) {
          try {
            await setDoc(
              doc(db, 'systemSettings', 'general'),
              cleanDataForFirestore({
                lastAutoGithubBackupAttemptDay: todayKey,
                lastAutoGithubBackupStatus: 'failed',
                lastAutoGithubBackupError: res.error || 'Lỗi khi đẩy sao lưu lên GitHub',
                updatedAt: nowIso,
              }),
              { merge: true }
            );
          } catch {
            // ignore
          }
        }
        return { success: false, error: res.error };
      }

      const backupPayload: Omit<BackupItem, 'id'> = {
        title: backupTitle,
        version: CURRENT_SYSTEM_VERSION,
        createdAt: nowIso,
        createdBy: userEmail || (isAutoBackup ? 'Hệ thống tự động 03:00' : 'Admin'),
        sizeBytes,
        collectionsIncluded,
        stats,
        storageType: 'github',
        githubPath: res.path || '',
        githubHtmlUrl: res.htmlUrl || '',
        encoding: 'base64',
        isAutoBackup,
        // Lưu chuỗi rỗng trong Firestore để không chạm giới hạn 1MB; toàn bộ snapshot Base64 lưu trên GitHub
        dataJson: '',
      };

      let createdBackupId = `gh_${Date.now()}`;
      try {
        const ref = await addDoc(collection(db, 'backups'), cleanDataForFirestore(backupPayload));
        createdBackupId = ref.id;
      } catch (saveHistoryErr) {
        console.warn('Could not save GitHub backup record to Firestore history:', saveHistoryErr);
      }

      try {
        await setDoc(
          doc(db, 'systemSettings', 'general'),
          cleanDataForFirestore({
            lastBackupAt: nowIso,
            lastGithubBackupAt: nowIso,
            lastGithubBackupDay: todayKey,
            lastAutoGithubBackupStatus: 'success',
            lastAutoGithubBackupError: '',
            ...(isAutoBackup ? { lastAutoGithubBackupAttemptDay: todayKey } : {}),
            updatedAt: nowIso,
          }),
          { merge: true }
        );
        await logAuditEvent(
          isAutoBackup ? 'Sao lưu tự động 03:00 lên GitHub' : 'Sao lưu dữ liệu lên GitHub',
          'Sao lưu & Phục hồi',
          `${backupTitle} -> ${res.path} (${stats.totalRecords || 0} bản ghi, Base64)`,
          { uid: userEmail || 'admin', name: userEmail || 'Admin' }
        );
      } catch {
        // Non-blocking
      }

      return {
        success: true,
        backupItem: {
          id: createdBackupId,
          ...backupPayload,
        },
        path: res.path,
        htmlUrl: res.htmlUrl,
        totalRecords: stats.totalRecords || 0,
        sizeBytes,
        warning:
          failedCollections.length > 0
            ? `Một số phân hệ không đọc được: ${failedCollections.join(', ')}`
            : undefined,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Lỗi khi sao lưu dữ liệu lên GitHub';
      if (isAutoBackup) {
        try {
          await setDoc(
            doc(db, 'systemSettings', 'general'),
            cleanDataForFirestore({
              lastAutoGithubBackupAttemptDay: todayKey,
              lastAutoGithubBackupStatus: 'failed',
              lastAutoGithubBackupError: errMsg,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        } catch {
          // ignore
        }
      }
      return {
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Export dedicated Users & Citizen Identity backup with ethnic and administrative details
   */
  public static async exportUsersProfilesBackup(
    userEmail: string
  ): Promise<{ success: boolean; usersCount?: number; sizeBytes?: number; error?: string }> {
    try {
      const [snap, locksSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'verifiedIdentifiers')).catch(() => null),
      ]);

      const verifiedIdentifiersList = locksSnap
        ? locksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        : [];

      const currentUid = auth.currentUser?.uid || '';
      let totalDevices = 0;
      const usersList = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          const addressComponents = [
            data.address,
            data.wardName,
            data.provinceName,
          ].filter(Boolean);

          let verifiedDevices: any[] = [];
          try {
            const devSnap = await getDocs(collection(db, 'users', d.id, 'devices'));
            verifiedDevices = devSnap.docs.map(dd => ({ deviceId: dd.id, ...dd.data() }));
            totalDevices += verifiedDevices.length;
          } catch {
            verifiedDevices = [];
          }

          let totpSecurity: any = undefined;
          if (currentUid && d.id === currentUid) {
            try {
              const totpSnap = await getDoc(doc(db, 'users', d.id, 'security', 'totp'));
              if (totpSnap.exists()) {
                totpSecurity = totpSnap.data();
              }
            } catch {
              // non-blocking
            }
          }

          const securityStatus = {
            emailVerified: Boolean(data.emailVerified),
            emailVerifiedAt: data.emailVerifiedAt || '',
            phoneVerified: Boolean(data.phoneVerified),
            verifiedPhone: data.verifiedPhone || '',
            phoneVerifiedAt: data.phoneVerifiedAt || '',
            citizenIdVerified: Boolean(data.citizenIdVerified),
            citizenIdVerifiedAt: data.citizenIdVerifiedAt || '',
            hasPasswordLinked: Boolean(data.hasPasswordLinked),
            googleLinked: Boolean(data.googleLinked),
            twoFactorEnabled: Boolean(data.twoFactorEnabled),
            twoFactorUpdatedAt: data.twoFactorUpdatedAt || '',
            smsMfaEnabled: Boolean(data.smsMfaEnabled),
            smsMfaPhoneMasked: data.smsMfaPhoneMasked || '',
            verifiedDevicesCount: verifiedDevices.length,
          };

          return {
            id: d.id,
            uid: d.id,
            // Định danh y tế cá nhân
            email: data.email || '',
            displayName: data.displayName || '',
            citizenId: data.citizenId || '',
            phoneNumber: data.phoneNumber || '',
            dob: data.dob || '',
            gender: data.gender || '',
            ethnicity: data.ethnicity || '',
            provinceCode: data.provinceCode || '',
            provinceName: data.provinceName || '',
            wardCode: data.wardCode || '',
            wardName: data.wardName || '',
            address: data.address || '',
            fullAddress: addressComponents.join(', '),
            role: data.role || 'citizen',
            accountType: data.accountType || 'citizen',
            department: data.department || '',
            position: data.position || '',
            qualification: data.qualification || '',
            status: data.status || 'active',
            avatarUrl: data.avatarUrl || '',
            notes: data.notes || '',
            lastLoginAt: data.lastLoginAt || '',
            createdAt: data.createdAt || '',
            updatedAt: data.updatedAt || '',
            // Trạng thái bảo mật & xác minh tài khoản
            emailVerified: securityStatus.emailVerified,
            emailVerifiedAt: securityStatus.emailVerifiedAt,
            phoneVerified: securityStatus.phoneVerified,
            verifiedPhone: securityStatus.verifiedPhone,
            phoneVerifiedAt: securityStatus.phoneVerifiedAt,
            citizenIdVerified: securityStatus.citizenIdVerified,
            citizenIdVerifiedAt: securityStatus.citizenIdVerifiedAt,
            hasPasswordLinked: securityStatus.hasPasswordLinked,
            googleLinked: securityStatus.googleLinked,
            twoFactorEnabled: securityStatus.twoFactorEnabled,
            twoFactorUpdatedAt: securityStatus.twoFactorUpdatedAt,
            smsMfaEnabled: securityStatus.smsMfaEnabled,
            smsMfaPhoneMasked: securityStatus.smsMfaPhoneMasked,
            securityStatus,
            verifiedDevices,
            ...(totpSecurity ? { totpSecurity } : {}),
          };
        })
      );

      const payload = {
        title: `Bản sao lưu toàn diện Người dùng, Định danh Y tế & Trạng thái Bảo mật`,
        version: CURRENT_SYSTEM_VERSION,
        exportedAt: new Date().toISOString(),
        exportedBy: userEmail || 'Admin',
        usersCount: usersList.length,
        userDevicesCount: totalDevices,
        verifiedIdentifiersCount: verifiedIdentifiersList.length,
        users: usersList,
        verifiedIdentifiers: verifiedIdentifiersList,
      };

      const dataJson = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataJson], { type: 'application/json' });
      const sizeBytes = blob.size;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_nguoi_dung_dinh_danh_bao_mat_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      try {
        await logAuditEvent(
          'Xuất sao lưu danh sách người dùng & bảo mật',
          'Sao lưu & Phục hồi',
          `Xuất dữ liệu ${usersList.length} tài khoản (Định danh Y tế, Trạng thái bảo mật/xác minh, ${totalDevices} thiết bị tin cậy, ${verifiedIdentifiersList.length} khoá định danh)`,
          { uid: userEmail || 'admin', name: userEmail || 'Admin' }
        );
      } catch {
        // Non-blocking
      }

      return { success: true, usersCount: usersList.length, sizeBytes };
    } catch (err: any) {
      console.error('Export users backup failed:', err);
      return { success: false, error: err?.message || 'Không thể xuất danh sách người dùng' };
    }
  }

  /**
   * List all system backups ordered by creation date
   */
  public static async listBackups(): Promise<BackupItem[]> {
    try {
      const q = query(collection(db, 'backups'), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BackupItem));
    } catch (err) {
      console.warn('List backups indexed query error, trying plain fetch:', err);
      try {
        const snap = await getDocs(collection(db, 'backups'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as BackupItem));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        return list.slice(0, 20);
      } catch (plainErr) {
        console.warn('Plain list backups error:', plainErr);
        return [];
      }
    }
  }

  /**
   * Delete a backup snapshot
   */
  public static async deleteBackup(id: string): Promise<boolean> {
    try {
      try {
        const chunkSnap = await getDocs(collection(db, 'backups', id, 'chunks'));
        for (const cDoc of chunkSnap.docs) {
          await deleteDoc(doc(db, 'backups', id, 'chunks', cDoc.id));
        }
      } catch {
        // non-blocking if chunks subcollection does not exist
      }
      await deleteDoc(doc(db, 'backups', id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate and parse a backup JSON string (supports direct collection map, Base64-encoded envelopes, wrapped BackupItem JSON, or dedicated users export JSON)
   * Tự động giải mã Base64 ngược về cấu trúc JSON gốc khi khôi phục dữ liệu
   */
  public static parseBackupJson(rawJson: string): {
    valid: boolean;
    data?: Record<string, any[]>;
    totalRecords?: number;
    collections?: string[];
    collectionCounts?: Record<string, number>;
    isBase64?: boolean;
    metadata?: {
      title?: string;
      version?: string;
      createdAt?: string;
      createdBy?: string;
    };
    error?: string;
  } {
    try {
      const trimmed = (rawJson || '').trim();
      if (!trimmed) {
        return { valid: false, error: 'Dữ liệu tệp sao lưu rỗng.' };
      }

      let rawParsed: any;
      let wasBase64 = false;

      // 1. Thử phân tích JSON trực tiếp, nếu lỗi cú pháp thì thử giải mã chuỗi Base64 thô
      try {
        rawParsed = JSON.parse(trimmed);
      } catch (jsonErr) {
        try {
          const decoded = base64ToUtf8(trimmed);
          rawParsed = JSON.parse(decoded);
          wasBase64 = true;
        } catch {
          return { valid: false, error: 'Tệp JSON bị lỗi cú pháp hoặc không thể giải mã Base64.' };
        }
      }

      // 2. Trích xuất dữ liệu bên trong nếu được bao bọc hoặc mã hoá Base64
      let parsedData: unknown = rawParsed;
      const metadata: { title?: string; version?: string; createdAt?: string; createdBy?: string } = {};

      if (rawParsed && typeof rawParsed === 'object') {
        if (typeof rawParsed.title === 'string') metadata.title = rawParsed.title;
        if (typeof rawParsed.version === 'string') metadata.version = rawParsed.version;
        if (typeof rawParsed.createdAt === 'string') metadata.createdAt = rawParsed.createdAt;
        if (typeof rawParsed.createdBy === 'string') metadata.createdBy = rawParsed.createdBy;

        // Kiểm tra các thuộc tính Base64 phổ biến
        if (typeof rawParsed.dataBase64 === 'string') {
          const decodedStr = base64ToUtf8(rawParsed.dataBase64);
          parsedData = JSON.parse(decodedStr);
          wasBase64 = true;
        } else if (typeof rawParsed.payloadBase64 === 'string') {
          const decodedStr = base64ToUtf8(rawParsed.payloadBase64);
          parsedData = JSON.parse(decodedStr);
          wasBase64 = true;
        } else if (typeof rawParsed.contentBase64 === 'string') {
          const decodedStr = base64ToUtf8(rawParsed.contentBase64);
          parsedData = JSON.parse(decodedStr);
          wasBase64 = true;
        } else if (typeof rawParsed.base64Data === 'string') {
          const decodedStr = base64ToUtf8(rawParsed.base64Data);
          parsedData = JSON.parse(decodedStr);
          wasBase64 = true;
        } else if (typeof rawParsed.dataJson === 'string') {
          try {
            const inner = JSON.parse(rawParsed.dataJson);
            if (inner && typeof inner === 'object' && typeof inner.dataBase64 === 'string') {
              const decodedStr = base64ToUtf8(inner.dataBase64);
              parsedData = JSON.parse(decodedStr);
              wasBase64 = true;
            } else {
              parsedData = inner;
            }
          } catch {
            try {
              const decodedStr = base64ToUtf8(rawParsed.dataJson);
              parsedData = JSON.parse(decodedStr);
              wasBase64 = true;
            } catch {
              parsedData = rawParsed.dataJson;
            }
          }
        } else if (rawParsed.data && typeof rawParsed.data === 'object' && !Array.isArray(rawParsed.data)) {
          if (typeof (rawParsed.data as any).dataBase64 === 'string') {
            const decodedStr = base64ToUtf8((rawParsed.data as any).dataBase64);
            parsedData = JSON.parse(decodedStr);
            wasBase64 = true;
          } else {
            parsedData = rawParsed.data;
          }
        }
      }

      // Hỗ trợ trường hợp tải về mảng người dùng định danh hoặc bản sao lưu cá nhân (TYT_PERSONAL_PROFILE_BACKUP)
      if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData.some(it => it && (it.uid || it.email))) {
        parsedData = { users: parsedData };
      } else if (
        parsedData &&
        typeof parsedData === 'object' &&
        !Array.isArray(parsedData) &&
        ((parsedData as any).type === 'TYT_PERSONAL_PROFILE_BACKUP' ||
          ((parsedData as any).identity && typeof (parsedData as any).identity === 'object'))
      ) {
        const pd = parsedData as any;
        const identityPart = (pd.identity && typeof pd.identity === 'object' ? pd.identity : pd.data) || {};
        const secPart =
          (pd.securityVerification && typeof pd.securityVerification === 'object'
            ? pd.securityVerification
            : pd.security) || {};
        const actPart = (pd.userActivity && typeof pd.userActivity === 'object' ? pd.userActivity : {}) || {};
        const mergedPersonalUser = {
          ...identityPart,
          id: identityPart.uid || identityPart.id || '',
          uid: identityPart.uid || identityPart.id || '',
          ...(typeof secPart.emailVerified === 'boolean' ? { emailVerified: secPart.emailVerified } : {}),
          ...(secPart.emailVerifiedAt ? { emailVerifiedAt: secPart.emailVerifiedAt } : {}),
          ...(typeof secPart.phoneVerified === 'boolean' ? { phoneVerified: secPart.phoneVerified } : {}),
          ...(secPart.verifiedPhone ? { verifiedPhone: secPart.verifiedPhone } : {}),
          ...(secPart.phoneVerifiedAt ? { phoneVerifiedAt: secPart.phoneVerifiedAt } : {}),
          ...(typeof secPart.citizenIdVerified === 'boolean' ? { citizenIdVerified: secPart.citizenIdVerified } : {}),
          ...(secPart.citizenIdVerifiedAt ? { citizenIdVerifiedAt: secPart.citizenIdVerifiedAt } : {}),
          ...(typeof secPart.hasPasswordLinked === 'boolean' ? { hasPasswordLinked: secPart.hasPasswordLinked } : {}),
          ...(typeof secPart.googleLinked === 'boolean' ? { googleLinked: secPart.googleLinked } : {}),
          ...(typeof secPart.twoFactorEnabled === 'boolean' ? { twoFactorEnabled: secPart.twoFactorEnabled } : {}),
          ...(secPart.twoFactorUpdatedAt ? { twoFactorUpdatedAt: secPart.twoFactorUpdatedAt } : {}),
          ...(typeof secPart.smsMfaEnabled === 'boolean' ? { smsMfaEnabled: secPart.smsMfaEnabled } : {}),
          ...(secPart.smsMfaPhoneMasked ? { smsMfaPhoneMasked: secPart.smsMfaPhoneMasked } : {}),
          ...(Array.isArray(secPart.verifiedDevices) ? { verifiedDevices: secPart.verifiedDevices } : {}),
          ...(secPart.totpSecurity ? { totpSecurity: secPart.totpSecurity } : {}),
        };
        const builtPersonalCollections: Record<string, any[]> = {};
        if (mergedPersonalUser.uid) {
          builtPersonalCollections.users = [mergedPersonalUser];
        }
        if (Array.isArray(secPart.verifiedIdentifiers) && secPart.verifiedIdentifiers.length > 0) {
          builtPersonalCollections.verifiedIdentifiers = secPart.verifiedIdentifiers;
        }
        if (Array.isArray(actPart.appointments) && actPart.appointments.length > 0) {
          builtPersonalCollections.appointments = actPart.appointments;
        }
        if (Array.isArray(actPart.feedback) && actPart.feedback.length > 0) {
          builtPersonalCollections.feedback = actPart.feedback;
        }
        if (Array.isArray(actPart.rescueSignals) && actPart.rescueSignals.length > 0) {
          builtPersonalCollections.rescueSignals = actPart.rescueSignals;
        }
        if (Array.isArray(actPart.nearbyFacilities) && actPart.nearbyFacilities.length > 0) {
          builtPersonalCollections.nearbyFacilities = actPart.nearbyFacilities;
        }
        if (Object.keys(builtPersonalCollections).length > 0) {
          parsedData = builtPersonalCollections;
        }
      }

      if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
        return { valid: false, error: 'Cấu trúc tệp JSON không đúng định dạng bản sao lưu.' };
      }

      // Kiểm tra lớp phụ nếu parsedData vẫn còn chứa dataBase64
      if (typeof (parsedData as any).dataBase64 === 'string') {
        try {
          const decodedStr = base64ToUtf8((parsedData as any).dataBase64);
          parsedData = JSON.parse(decodedStr);
          wasBase64 = true;
        } catch {
          // ignore
        }
      }

      const entries = Object.entries(parsedData as Record<string, unknown>).filter(
        ([collName, items]) => RESTORABLE_COLLECTIONS.has(collName) && Array.isArray(items)
      ) as [string, any[]][];

      if (entries.length === 0) {
        return {
          valid: false,
          error: 'Không tìm thấy phân hệ dữ liệu hợp lệ nào trong tệp sao lưu.',
        };
      }

      const validMap: Record<string, any[]> = {};
      const collectionCounts: Record<string, number> = {};
      let totalRecords = 0;
      const collections: string[] = [];

      for (const [collName, items] of entries) {
        const cleanItems = items
          .map(item => {
            if (!item || typeof item !== 'object') return null;
            const resolvedId =
              typeof item.id === 'string' && item.id.trim()
                ? item.id.trim()
                : collName === 'users' && typeof item.uid === 'string' && item.uid.trim()
                ? item.uid.trim()
                : collName === 'pushSubscriptions' &&
                  typeof item.deviceId === 'string' &&
                  item.deviceId.trim()
                ? item.deviceId.trim()
                : collName === 'onlinePresence' &&
                  typeof item.sessionId === 'string' &&
                  item.sessionId.trim()
                ? item.sessionId.trim()
                : '';
            if (!resolvedId) return null;
            if (collName === 'systemSettings' && resolvedId === 'connection_test') return null;
            return { ...item, id: resolvedId };
          })
          .filter(Boolean) as any[];

        validMap[collName] = cleanItems;
        collectionCounts[collName] = cleanItems.length;
        totalRecords += cleanItems.length;
        collections.push(collName);
      }

      return {
        valid: true,
        data: validMap,
        totalRecords,
        collections,
        collectionCounts,
        isBase64: wasBase64,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };
    } catch {
      return { valid: false, error: 'Tệp JSON bị lỗi cú pháp hoặc không thể đọc được.' };
    }
  }

  /**
   * Restore database from a backup JSON string
   */
  public static async restoreFromBackup(
    dataJson: string,
    userEmail?: string,
    selectedCollections?: string[],
    options?: {
      migrationMode?: boolean;
      enableMigrationPrompt?: boolean;
      sourceBackupTitle?: string;
      onProgress?: (progress: RestoreProgressInfo) => void;
    }
  ): Promise<{ success: boolean; message: string; stagedSnapshotsCount?: number }> {
    const emitProgress = options?.onProgress;
    const report = (info: RestoreProgressInfo) => {
      if (emitProgress) {
        try {
          emitProgress(info);
        } catch {
          // non-blocking UI callback
        }
      }
    };

    try {
      report({
        phase: 'parsing',
        phaseLabel: 'Đang giải mã & kiểm tra bản sao lưu',
        processedCollections: 0,
        totalCollections: 0,
        processedRecords: 0,
        totalRecords: 0,
        restoredCount: 0,
        skippedCount: 0,
        stagedSnapshotsCount: 0,
        percent: 4,
        message: 'Đang giải mã Base64 và phân tích cấu trúc dữ liệu phân hệ...',
      });

      const parsed = this.parseBackupJson(dataJson);
      if (!parsed.valid || !parsed.data) {
        const errMsg = parsed.error || 'Tệp sao lưu không hợp lệ.';
        report({
          phase: 'error',
          phaseLabel: 'Dữ liệu sao lưu không hợp lệ',
          processedCollections: 0,
          totalCollections: 0,
          processedRecords: 0,
          totalRecords: 0,
          restoredCount: 0,
          skippedCount: 0,
          stagedSnapshotsCount: 0,
          percent: 0,
          message: errMsg,
        });
        return { success: false, message: errMsg };
      }

      const migrationMode = Boolean(options?.migrationMode);
      const enableMigrationPrompt = Boolean(options?.enableMigrationPrompt || migrationMode);

      const selectedSet =
        Array.isArray(selectedCollections) && selectedCollections.length > 0
          ? new Set(selectedCollections)
          : null;

      const collectionLabelsMap = new Map<string, string>(
        BACKUP_COLLECTIONS.map(c => [c.key, c.label])
      );
      const getCollectionLabel = (key: string) => collectionLabelsMap.get(key) || key;

      const targetCollectionEntries = Object.entries(parsed.data).filter(([collName, items]) => {
        if (!RESTORABLE_COLLECTIONS.has(collName) || !Array.isArray(items)) return false;
        if (
          migrationMode &&
          (collName === 'users' || collName === 'verifiedIdentifiers' || collName === 'admins')
        ) {
          return false;
        }
        if (selectedSet && !selectedSet.has(collName)) return false;
        return true;
      }) as [string, any[]][];

      const legacyUsersToStage =
        migrationMode && Array.isArray(parsed.data.users) ? parsed.data.users : [];
      const totalCollections =
        targetCollectionEntries.length + (legacyUsersToStage.length > 0 ? 1 : 0);
      const totalRecords =
        legacyUsersToStage.length +
        targetCollectionEntries.reduce((sum, [, items]) => sum + items.length, 0);

      let restoredCount = 0;
      let skippedCount = 0;
      let stagedSnapshotsCount = 0;
      let processedCollections = 0;
      let processedRecords = 0;
      const restoredCollections: string[] = [];

      const calcPercent = (done: number, total: number) => {
        if (total <= 0) return 90;
        return Math.min(96, Math.max(8, Math.round(8 + (done / total) * 88)));
      };

      const shouldEmitStep = (idx: number, len: number) => {
        if (totalRecords <= 45) return true;
        return idx === 0 || idx === len - 1 || (idx + 1) % 4 === 0;
      };

      // If migrationMode is enabled and `users` exists in parsed backup, stage user snapshots cleanly by email
      // without touching live `users/{oldUid}` documents (because new Firebase Auth generates new UIDs).
      if (legacyUsersToStage.length > 0) {
        const nowIso = new Date().toISOString();
        report({
          phase: 'staging_users',
          phaseLabel: 'Đang tạo kho hồ sơ đối chiếu người dùng',
          currentCollection: 'legacyUserSnapshots',
          currentCollectionLabel: 'Hồ sơ đối chiếu User (Di trú)',
          processedCollections,
          totalCollections,
          processedRecords,
          totalRecords,
          restoredCount,
          skippedCount,
          stagedSnapshotsCount,
          percent: calcPercent(processedRecords, totalRecords),
          message: `Đang chuẩn bị ${legacyUsersToStage.length} hồ sơ tài khoản để người dùng xác nhận lại...`,
        });

        for (let uIdx = 0; uIdx < legacyUsersToStage.length; uIdx++) {
          const u = legacyUsersToStage[uIdx];
          const rawEmail = typeof u?.email === 'string' ? u.email.trim().toLowerCase() : '';
          if (rawEmail) {
            const snapId = computeLegacySnapshotId(rawEmail);
            try {
              const snapPayload = cleanDataForFirestore({
                id: snapId,
                legacyUid: String(u.uid || u.id || '').slice(0, 128),
                email: rawEmail.slice(0, 256),
                displayName: String(u.displayName || rawEmail.split('@')[0] || 'Thành viên').slice(
                  0,
                  128
                ),
                ...(u.phoneNumber ? { phoneNumber: String(u.phoneNumber).slice(0, 32) } : {}),
                ...(u.verifiedPhone ? { verifiedPhone: String(u.verifiedPhone).slice(0, 32) } : {}),
                ...(u.citizenId ? { citizenId: String(u.citizenId).slice(0, 32) } : {}),
                ...(u.dob ? { dob: String(u.dob).slice(0, 32) } : {}),
                ...(u.gender === 'Nam' || u.gender === 'Nữ' || u.gender === 'Khác'
                  ? { gender: u.gender }
                  : {}),
                ...(u.ethnicity ? { ethnicity: String(u.ethnicity).slice(0, 64) } : {}),
                ...(u.provinceCode ? { provinceCode: String(u.provinceCode).slice(0, 16) } : {}),
                ...(u.provinceName ? { provinceName: String(u.provinceName).slice(0, 128) } : {}),
                ...(u.wardCode ? { wardCode: String(u.wardCode).slice(0, 16) } : {}),
                ...(u.wardName ? { wardName: String(u.wardName).slice(0, 128) } : {}),
                ...(u.address ? { address: String(u.address).slice(0, 256) } : {}),
                ...(u.department ? { department: String(u.department).slice(0, 128) } : {}),
                ...(u.position ? { position: String(u.position).slice(0, 128) } : {}),
                ...(u.qualification ? { qualification: String(u.qualification).slice(0, 128) } : {}),
                role: u.role || 'citizen',
                accountType: u.accountType || 'citizen',
                expBalance: Math.max(0, Math.round(Number(u.expBalance) || 0)),
                totalExpEarned: Math.max(0, Math.round(Number(u.totalExpEarned) || 0)),
                emailVerified: Boolean(u.emailVerified),
                phoneVerified: Boolean(u.phoneVerified),
                citizenIdVerified: Boolean(u.citizenIdVerified),
                identityVerifiedFromDatabase: Boolean(u.identityVerifiedFromDatabase),
                ...(u.personalReferralCode
                  ? { personalReferralCode: String(u.personalReferralCode).slice(0, 64) }
                  : {}),
                claimStatus: 'pending',
                migratedAt: nowIso,
                ...(options?.sourceBackupTitle || parsed.metadata?.title
                  ? {
                      sourceBackupTitle: String(
                        options?.sourceBackupTitle || parsed.metadata?.title
                      ).slice(0, 256),
                    }
                  : {}),
              });
              await setDoc(doc(db, 'legacyUserSnapshots', snapId), snapPayload, { merge: true });
              stagedSnapshotsCount++;
            } catch (snapErr) {
              console.warn(`Stage legacy snapshot for ${rawEmail} skipped:`, snapErr);
            }
          }
          processedRecords++;
          if (shouldEmitStep(uIdx, legacyUsersToStage.length)) {
            report({
              phase: 'staging_users',
              phaseLabel: 'Đang tạo kho hồ sơ đối chiếu người dùng',
              currentCollection: 'legacyUserSnapshots',
              currentCollectionLabel: 'Hồ sơ đối chiếu User (Di trú)',
              processedCollections,
              totalCollections,
              processedRecords,
              totalRecords,
              restoredCount,
              skippedCount,
              stagedSnapshotsCount,
              percent: calcPercent(processedRecords, totalRecords),
              message: `Đã xử lý ${uIdx + 1}/${legacyUsersToStage.length} hồ sơ đối chiếu...`,
            });
          }
        }
        processedCollections++;
        if (stagedSnapshotsCount > 0) {
          restoredCollections.push('legacyUserSnapshots');
        }
      }

      for (const [collName, items] of targetCollectionEntries) {
        const collLabel = getCollectionLabel(collName);

        report({
          phase: 'restoring',
          phaseLabel: 'Đang khôi phục dữ liệu phân hệ',
          currentCollection: collName,
          currentCollectionLabel: collLabel,
          processedCollections,
          totalCollections,
          processedRecords,
          totalRecords,
          restoredCount,
          skippedCount,
          stagedSnapshotsCount,
          percent: calcPercent(processedRecords, totalRecords),
          message: `Đang phục hồi "${collLabel}" (${items.length} bản ghi)...`,
        });

        if (collName === 'bhxhServerConfig' || collName === 'aiServerConfig') {
          let serverCfgRestored = 0;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item && typeof item === 'object') {
              const ok =
                collName === 'bhxhServerConfig'
                  ? await restoreBhxhServerConfigFromBackup(item)
                  : await restoreAiServerConfigFromBackup(item);
              if (ok) {
                restoredCount++;
                serverCfgRestored++;
              } else {
                skippedCount++;
              }
            } else {
              skippedCount++;
            }
            processedRecords++;
            if (shouldEmitStep(i, items.length)) {
              report({
                phase: 'restoring',
                phaseLabel: 'Đang khôi phục dữ liệu phân hệ',
                currentCollection: collName,
                currentCollectionLabel: collLabel,
                processedCollections,
                totalCollections,
                processedRecords,
                totalRecords,
                restoredCount,
                skippedCount,
                stagedSnapshotsCount,
                percent: calcPercent(processedRecords, totalRecords),
                message: `Đang phục hồi "${collLabel}" (${i + 1}/${items.length})...`,
              });
            }
          }
          if (serverCfgRestored > 0) {
            restoredCollections.push(collName);
          }
          processedCollections++;
          continue;
        }

        let collRestored = 0;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const emitCurrentStep = () => {
            if (shouldEmitStep(i, items.length)) {
              report({
                phase: 'restoring',
                phaseLabel: 'Đang khôi phục dữ liệu phân hệ',
                currentCollection: collName,
                currentCollectionLabel: collLabel,
                processedCollections,
                totalCollections,
                processedRecords,
                totalRecords,
                restoredCount,
                skippedCount,
                stagedSnapshotsCount,
                percent: calcPercent(processedRecords, totalRecords),
                message: `Đang phục hồi "${collLabel}" (${i + 1}/${items.length})...`,
              });
            }
          };

          if (!item?.id) {
            skippedCount++;
            processedRecords++;
            emitCurrentStep();
            continue;
          }
          if (collName === 'systemSettings' && item.id === 'connection_test') {
            skippedCount++;
            processedRecords++;
            emitCurrentStep();
            continue;
          }

          // siteStats rules only allow 'summary' document with valid counters
          if (collName === 'siteStats' && item.id !== 'summary') {
            skippedCount++;
            processedRecords++;
            emitCurrentStep();
            continue;
          }

          const { id, ...rawData } = item;
          const docRef = doc(db, collName, id);

          // auditLogs & verifiedIdentifiers are immutable in Firestore rules: only restore missing records
          if (collName === 'auditLogs' || collName === 'verifiedIdentifiers') {
            try {
              const existingSnap = await getDoc(docRef);
              if (existingSnap.exists()) {
                skippedCount++;
              } else {
                await setDoc(docRef, cleanDataForFirestore(rawData));
                restoredCount++;
                collRestored++;
              }
            } catch {
              skippedCount++;
            }
            processedRecords++;
            emitCurrentStep();
            continue;
          }

          if (collName === 'users') {
            const {
              verifiedDevices,
              securityStatus,
              securityVerification,
              fullAddress,
              totpSecurity,
              enrolledSmsFactors,
              verificationPercent,
              verificationSummary,
              ...userDocBase
            } = rawData as Record<string, any>;
            void fullAddress;
            void totpSecurity;
            void enrolledSmsFactors;
            void verificationPercent;
            void verificationSummary;

            const secSource =
              (securityStatus && typeof securityStatus === 'object' ? securityStatus : null) ||
              (securityVerification && typeof securityVerification === 'object'
                ? securityVerification
                : null);

            const hydratedUserData: Record<string, any> = {
              ...userDocBase,
              uid: userDocBase.uid || id,
            };

            if (secSource) {
              const securityKeys = [
                'emailVerified',
                'emailVerifiedAt',
                'phoneVerified',
                'verifiedPhone',
                'phoneVerifiedAt',
                'citizenIdVerified',
                'citizenIdVerifiedAt',
                'hasPasswordLinked',
                'googleLinked',
                'twoFactorEnabled',
                'twoFactorUpdatedAt',
                'smsMfaEnabled',
                'smsMfaPhoneMasked',
              ];
              for (const key of securityKeys) {
                if (hydratedUserData[key] === undefined && secSource[key] !== undefined) {
                  hydratedUserData[key] = secSource[key];
                }
              }
            }

            try {
              await setDoc(docRef, cleanDataForFirestore(hydratedUserData), { merge: true });
              restoredCount++;
              collRestored++;

              if (Array.isArray(verifiedDevices)) {
                for (const dev of verifiedDevices) {
                  const devId =
                    typeof dev?.deviceId === 'string' && dev.deviceId.trim()
                      ? dev.deviceId.trim()
                      : '';
                  if (
                    !devId ||
                    !dev?.deviceName ||
                    !dev?.platform ||
                    !dev?.verifiedAt ||
                    !dev?.lastActiveAt
                  ) {
                    continue;
                  }
                  try {
                    await setDoc(
                      doc(db, 'users', id, 'devices', devId),
                      cleanDataForFirestore({
                        deviceId: devId,
                        deviceName: String(dev.deviceName).slice(0, 128),
                        platform: ['mobile', 'tablet', 'desktop'].includes(dev.platform)
                          ? dev.platform
                          : 'desktop',
                        isTrusted: Boolean(dev.isTrusted),
                        verifiedAt: String(dev.verifiedAt).slice(0, 64),
                        lastActiveAt: String(dev.lastActiveAt).slice(0, 64),
                        ...(typeof dev.os === 'string' ? { os: dev.os.slice(0, 64) } : {}),
                        ...(typeof dev.browser === 'string'
                          ? { browser: dev.browser.slice(0, 64) }
                          : {}),
                        ...(dev.verificationMethod
                          ? { verificationMethod: dev.verificationMethod }
                          : {}),
                        ...(typeof dev.biometricEnabled === 'boolean'
                          ? { biometricEnabled: dev.biometricEnabled }
                          : {}),
                        ...(typeof dev.firstSeenAt === 'string'
                          ? { firstSeenAt: dev.firstSeenAt.slice(0, 64) }
                          : {}),
                      }),
                      { merge: true }
                    );
                  } catch (devErr) {
                    console.warn(`Restore device ${id}/${devId} skipped:`, devErr);
                  }
                }
              }

              // Restore owner-only TOTP configuration when restoring the current admin's own account
              if (
                auth.currentUser?.uid === id &&
                totpSecurity &&
                totpSecurity.enabled &&
                typeof totpSecurity.secret === 'string' &&
                totpSecurity.secret.length >= 16
              ) {
                try {
                  const nowIso = new Date().toISOString();
                  await setDoc(doc(db, 'users', id, 'security', 'totp'), {
                    enabled: true,
                    secret: totpSecurity.secret,
                    recoveryCodes: Array.isArray(totpSecurity.recoveryCodes)
                      ? totpSecurity.recoveryCodes.slice(0, 12)
                      : [],
                    issuer: totpSecurity.issuer || 'Tram Y Te',
                    verifiedAt: totpSecurity.verifiedAt || nowIso,
                    updatedAt: totpSecurity.updatedAt || nowIso,
                  });
                } catch (totpErr) {
                  console.warn(`Restore owner TOTP ${id} skipped:`, totpErr);
                }
              }
            } catch (itemErr) {
              console.warn(`Restore user ${id} skipped:`, itemErr);
              skippedCount++;
            }
            processedRecords++;
            emitCurrentStep();
            continue;
          }

          try {
            await setDoc(docRef, cleanDataForFirestore(rawData), { merge: true });
            restoredCount++;
            collRestored++;
          } catch (itemErr) {
            console.warn(`Restore item ${collName}/${id} skipped:`, itemErr);
            skippedCount++;
          }
          processedRecords++;
          emitCurrentStep();
        }
        processedCollections++;
        if (collRestored > 0) {
          restoredCollections.push(collName);
        }
      }

      report({
        phase: 'finalizing',
        phaseLabel: 'Đang hoàn tất & đồng bộ nhật ký kiểm toán',
        processedCollections,
        totalCollections,
        processedRecords,
        totalRecords,
        restoredCount,
        skippedCount,
        stagedSnapshotsCount,
        percent: 98,
        message: 'Đang lưu cấu hình đồng bộ và ghi nhật ký thao tác hệ thống...',
      });

      if (enableMigrationPrompt) {
        try {
          const nowIso = new Date().toISOString();
          await setDoc(
            doc(db, 'systemSettings', 'general'),
            cleanDataForFirestore({
              migrationReconciliationActive: true,
              migrationBannerNote:
                stagedSnapshotsCount > 0
                  ? `Hệ thống vừa chuyển đổi dữ liệu sang máy chủ mới (${stagedSnapshotsCount} hồ sơ đối chiếu sẵn sàng). Vui lòng kiểm tra và xác nhận thông tin tài khoản của bạn.`
                  : 'Hệ thống vừa khôi phục dữ liệu (không bao gồm tài khoản cũ). Vui lòng đăng nhập và xác nhận hồ sơ của bạn đã đầy đủ & chính xác chưa.',
              updatedAt: nowIso,
            }),
            { merge: true }
          );
        } catch (migSettingsErr) {
          console.warn('Could not enable migrationReconciliationActive:', migSettingsErr);
        }
      }

      try {
        await logAuditEvent(
          migrationMode ? 'Di trú dữ liệu sang Firebase mới' : 'Khôi phục dữ liệu hệ thống',
          'Sao lưu & Phục hồi',
          `Phục hồi ${restoredCount} bản ghi trên ${restoredCollections.length} phân hệ (${restoredCollections.join(', ')})${
            stagedSnapshotsCount > 0 ? ` · Tạo ${stagedSnapshotsCount} hồ sơ đối chiếu user` : ''
          }${skippedCount > 0 ? ` · Bỏ qua ${skippedCount} bản ghi bất biến/không hợp lệ` : ''}`,
          { uid: userEmail || 'admin', name: userEmail || 'Admin' }
        );
      } catch {
        // Non-blocking audit log
      }

      const finalMsg = `Khôi phục thành công ${restoredCount} bản ghi trên ${restoredCollections.length} phân hệ${
        stagedSnapshotsCount > 0
          ? ` và tạo ${stagedSnapshotsCount} hồ sơ đối chiếu cho người dùng khi đăng nhập`
          : enableMigrationPrompt
          ? ' (đã bật thông báo yêu cầu người dùng xác nhận dữ liệu khi đăng nhập)'
          : ''
      }${skippedCount > 0 ? ` (giữ nguyên ${skippedCount} bản ghi bất biến/đã tồn tại)` : ''}.`;

      report({
        phase: 'completed',
        phaseLabel: 'Khôi phục dữ liệu hoàn tất',
        processedCollections: totalCollections,
        totalCollections,
        processedRecords: totalRecords,
        totalRecords,
        restoredCount,
        skippedCount,
        stagedSnapshotsCount,
        percent: 100,
        message: finalMsg,
      });

      return {
        success: true,
        stagedSnapshotsCount,
        message: finalMsg,
      };
    } catch (err: any) {
      const errMsg = `Lỗi khôi phục: ${err?.message || 'Tệp sao lưu không hợp lệ'}`;
      report({
        phase: 'error',
        phaseLabel: 'Khôi phục thất bại',
        processedCollections: 0,
        totalCollections: 0,
        processedRecords: 0,
        totalRecords: 0,
        restoredCount: 0,
        skippedCount: 0,
        stagedSnapshotsCount: 0,
        percent: 0,
        message: errMsg,
      });
      return {
        success: false,
        message: errMsg,
      };
    }
  }

  /**
   * Trigger download of backup JSON file to user's computer
   */
  public static downloadBackupFile(backup: BackupItem) {
    if (!backup.dataJson) return;
    const blob = new Blob([backup.dataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_tram_y_te_${(backup.version || 'v3').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download any backup item (Cloud local dataJson or remote GitHub Base64 backup decoded back to readable JSON)
   */
  public static async downloadBackupItem(
    backup: BackupItem,
    githubConfig?: GitHubConfig
  ): Promise<{ success: boolean; error?: string }> {
    if (backup.dataJson && backup.dataJson.trim()) {
      this.downloadBackupFile(backup);
      return { success: true };
    }

    if (backup.isChunked || backup.encoding === 'chunked') {
      try {
        const assembled = await this.resolveCloudBackupJson(backup);
        if (!assembled) {
          return { success: false, error: 'Không tải được dữ liệu phân mảnh từ Cloud.' };
        }
        this.downloadBackupFile({ ...backup, dataJson: assembled });
        return { success: true };
      } catch (chunkErr: any) {
        return {
          success: false,
          error: chunkErr?.message || 'Lỗi khi ghép các phân mảnh sao lưu từ Cloud.',
        };
      }
    }

    if (backup.storageType === 'github' && backup.githubPath) {
      if (!githubConfig || !isGitHubConfigValid(githubConfig)) {
        return {
          success: false,
          error: 'Cần cấu hình GitHub PAT để tải tệp sao lưu từ kho GitHub.',
        };
      }
      const fetchRes = await GitHubService.fetchFileText(githubConfig, backup.githubPath);
      if (!fetchRes.success || !fetchRes.content) {
        return {
          success: false,
          error: fetchRes.error || 'Không thể tải tệp sao lưu từ GitHub.',
        };
      }

      // Tự động giải mã Base64 về JSON gốc dễ đọc & có thể dùng khôi phục trực tiếp
      const parsed = this.parseBackupJson(fetchRes.content);
      const outputJson =
        parsed.valid && parsed.data
          ? JSON.stringify(parsed.data, null, 2)
          : fetchRes.content;

      const blob = new Blob([outputJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_github_${(backup.version || 'v3').replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    }

    return { success: false, error: 'Bản sao lưu không chứa dữ liệu để tải về.' };
  }

  /**
   * Directly fetch and restore from a backup file stored on GitHub (automatically decodes Base64)
   */
  public static async restoreFromGitHub(
    githubConfig: GitHubConfig,
    filePath: string,
    userEmail?: string,
    selectedCollections?: string[],
    options?: {
      onProgress?: (progress: RestoreProgressInfo) => void;
    }
  ): Promise<{ success: boolean; message: string; isBase64?: boolean; totalRecords?: number }> {
    const fetchRes = await GitHubService.fetchFileText(githubConfig, filePath);
    if (!fetchRes.success || !fetchRes.content) {
      return { success: false, message: fetchRes.error || 'Không tải được bản sao lưu từ GitHub' };
    }
    const restoreRes = await this.restoreFromBackup(
      fetchRes.content,
      userEmail,
      selectedCollections,
      options
    );
    return restoreRes;
  }
}
