import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type QrSessionStatus =
  | 'pending'
  | 'scanned'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'consumed';

export interface QrDeviceMeta {
  deviceName: string;
  platform: 'desktop' | 'tablet' | 'mobile';
  os: string;
  browser: string;
  requestedAt: string;
}

export interface QrAuthHandoffBundle {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  providerData: Array<{
    providerId: string;
    uid: string;
    displayName?: string;
    email?: string;
    phoneNumber?: string;
    photoURL?: string;
  }>;
  createdAt?: string;
  lastLoginAt?: string;
  accessToken: string;
  refreshToken: string;
  expirationTime: number;
  apiKey: string;
}

interface QrLoginSessionRecord {
  sessionId: string;
  pairCode: string;
  pollSecret: string;
  status: QrSessionStatus;
  createdAtMs: number;
  expiresAtMs: number;
  pcDevice: QrDeviceMeta;
  scannerDisplayName?: string;
  scannerEmailMasked?: string;
  authBundle?: QrAuthHandoffBundle;
}

const QR_SESSION_TTL_MS = 3 * 60 * 1000;
const PAIR_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const globalForQr = globalThis as typeof globalThis & {
  __tytQrSessionsMap?: Map<string, QrLoginSessionRecord>;
  __tytQrPairCodeIndex?: Map<string, string>;
};

const sessionsMap: Map<string, QrLoginSessionRecord> =
  globalForQr.__tytQrSessionsMap || new Map<string, QrLoginSessionRecord>();
const pairCodeIndex: Map<string, string> =
  globalForQr.__tytQrPairCodeIndex || new Map<string, string>();

globalForQr.__tytQrSessionsMap = sessionsMap;
globalForQr.__tytQrPairCodeIndex = pairCodeIndex;

function pruneExpiredQrSessions(): void {
  const now = Date.now();
  for (const [id, rec] of sessionsMap.entries()) {
    if (rec.expiresAtMs + 60_000 <= now) {
      sessionsMap.delete(id);
      pairCodeIndex.delete(rec.pairCode);
    } else if (
      rec.expiresAtMs <= now &&
      (rec.status === 'pending' || rec.status === 'scanned')
    ) {
      rec.status = 'expired';
      rec.authBundle = undefined;
    }
  }
}

function readFirebaseWebApiKey(): string {
  const envKey = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
  if (envKey) return envKey;
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(moduleDir, '..', '..', 'firebase-applet-config.json'),
      path.resolve(moduleDir, '..', 'firebase-applet-config.json'),
    ];
    const cfgPath = candidates.find(p => fs.existsSync(p));
    if (cfgPath) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      return String(cfg?.apiKey || '').trim();
    }
  } catch {
    // ignore
  }
  return '';
}

function resolvePublicOrigin(req?: any): string {
  const envAppUrl = String(process.env.APP_URL || '').trim();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '')
    .split(',')[0]
    ?.trim();
  const rawHost = forwardedHost || String(req?.headers?.host || '').trim();
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    ?.trim();

  if (
    rawHost &&
    !rawHost.startsWith('0.0.0.0') &&
    !rawHost.startsWith('localhost') &&
    !rawHost.startsWith('127.0.0.1') &&
    (rawHost.endsWith('.id.vn') || rawHost.endsWith('.vercel.app') || rawHost.endsWith('.run.app'))
  ) {
    const proto = forwardedProto || 'https';
    return `${proto}://${rawHost}`.replace(/\/+$/, '');
  }

  if (envAppUrl && envAppUrl !== 'MY_APP_URL') {
    return envAppUrl.replace(/\/+$/, '');
  }

  if (
    rawHost &&
    !rawHost.startsWith('0.0.0.0') &&
    !rawHost.startsWith('localhost') &&
    !rawHost.startsWith('127.0.0.1')
  ) {
    const proto = forwardedProto || 'https';
    return `${proto}://${rawHost}`.replace(/\/+$/, '');
  }

  if (rawHost) {
    const proto =
      forwardedProto ||
      (rawHost.includes('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${rawHost}`.replace(/\/+$/, '');
  }

  return 'https://tyt.slhd.id.vn';
}

function generateUniquePairCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += PAIR_CODE_ALPHABET[crypto.randomInt(0, PAIR_CODE_ALPHABET.length)];
    }
    const existingId = pairCodeIndex.get(code);
    if (!existingId || !sessionsMap.has(existingId)) {
      return code;
    }
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sanitizeText(val: unknown, fallback: string, maxLen = 96): string {
  const s = String(val || '').trim();
  return s ? s.slice(0, maxLen) : fallback;
}

function maskEmailPreview(email?: string): string {
  const s = String(email || '').trim();
  if (!s || !s.includes('@')) return '';
  if (s.toLowerCase().endsWith('@zalo.tyt.local')) return 'Tài khoản Zalo';
  const [local, domain] = s.split('@');
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function extractBearerToken(req: any): string {
  const raw = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

async function verifyFirebaseIdToken(idToken: string, apiKey: string): Promise<{
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  createdAt?: string;
  lastLoginAt?: string;
  providerData: QrAuthHandoffBundle['providerData'];
}> {
  if (!idToken) {
    throw new Error('Bạn cần đăng nhập trên điện thoại để thực hiện thao tác này.');
  }
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const data = (await resp.json().catch(() => ({}))) as {
    users?: Array<{
      localId?: string;
      email?: string;
      emailVerified?: boolean;
      displayName?: string;
      photoUrl?: string;
      phoneNumber?: string;
      createdAt?: string;
      lastLoginAt?: string;
      providerUserInfo?: Array<{
        providerId?: string;
        rawId?: string;
        federatedId?: string;
        displayName?: string;
        email?: string;
        phoneNumber?: string;
        photoUrl?: string;
      }>;
    }>;
    error?: { message?: string };
  };

  const user = data?.users?.[0];
  if (!resp.ok || !user?.localId) {
    throw new Error('Phiên đăng nhập trên điện thoại không hợp lệ hoặc đã hết hạn.');
  }

  const providerData: QrAuthHandoffBundle['providerData'] = Array.isArray(user.providerUserInfo)
    ? user.providerUserInfo
        .filter(p => Boolean(p?.providerId))
        .map(p => ({
          providerId: String(p.providerId),
          uid: String(p.rawId || p.federatedId || user.localId),
          ...(p.displayName ? { displayName: String(p.displayName) } : {}),
          ...(p.email ? { email: String(p.email) } : {}),
          ...(p.phoneNumber ? { phoneNumber: String(p.phoneNumber) } : {}),
          ...(p.photoUrl ? { photoURL: String(p.photoUrl) } : {}),
        }))
    : [];

  return {
    uid: String(user.localId),
    ...(user.email ? { email: String(user.email) } : {}),
    emailVerified: Boolean(user.emailVerified),
    ...(user.displayName ? { displayName: String(user.displayName) } : {}),
    ...(user.photoUrl ? { photoURL: String(user.photoUrl) } : {}),
    ...(user.phoneNumber ? { phoneNumber: String(user.phoneNumber) } : {}),
    ...(user.createdAt ? { createdAt: String(user.createdAt) } : {}),
    ...(user.lastLoginAt ? { lastLoginAt: String(user.lastLoginAt) } : {}),
    providerData,
  };
}

function findSessionRecord(sessionId?: unknown, pairCode?: unknown): QrLoginSessionRecord | null {
  const sid = String(sessionId || '').trim();
  if (sid && sessionsMap.has(sid)) {
    return sessionsMap.get(sid) || null;
  }
  const code = String(pairCode || '').trim().toUpperCase();
  if (code) {
    const mappedId = pairCodeIndex.get(code);
    if (mappedId && sessionsMap.has(mappedId)) {
      return sessionsMap.get(mappedId) || null;
    }
  }
  return null;
}

export function createQrLoginSession(req: any) {
  pruneExpiredQrSessions();

  const body = req?.body || {};
  const rawPlatform = String(body.platform || '').trim();
  const platform: QrDeviceMeta['platform'] =
    rawPlatform === 'mobile' || rawPlatform === 'tablet' ? rawPlatform : 'desktop';

  const nowMs = Date.now();
  const expiresAtMs = nowMs + QR_SESSION_TTL_MS;
  const sessionId = `qr_${crypto.randomBytes(12).toString('hex')}`;
  const pairCode = generateUniquePairCode();
  const pollSecret = crypto.randomBytes(24).toString('hex');

  const record: QrLoginSessionRecord = {
    sessionId,
    pairCode,
    pollSecret,
    status: 'pending',
    createdAtMs: nowMs,
    expiresAtMs,
    pcDevice: {
      deviceName: sanitizeText(body.deviceName, 'Máy tính (Trình duyệt Web)', 120),
      platform,
      os: sanitizeText(body.os, 'PC / Web', 64),
      browser: sanitizeText(body.browser, 'Trình duyệt', 64),
      requestedAt: new Date(nowMs).toISOString(),
    },
  };

  sessionsMap.set(sessionId, record);
  pairCodeIndex.set(pairCode, sessionId);

  const origin = resolvePublicOrigin(req);
  const qrUrl = `${origin}/?qrLogin=${encodeURIComponent(sessionId)}&qrCode=${encodeURIComponent(pairCode)}#tai-khoan`;

  return {
    ok: true,
    sessionId,
    pairCode,
    pollSecret,
    expiresAt: expiresAtMs,
    ttlSeconds: Math.round(QR_SESSION_TTL_MS / 1000),
    qrUrl,
  };
}

export async function inspectQrLoginSession(req: any) {
  pruneExpiredQrSessions();
  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key để xác thực mã QR.');
  }

  const idToken = extractBearerToken(req);
  const scannerUser = await verifyFirebaseIdToken(idToken, apiKey);

  const { sessionId, pairCode } = req?.body || {};
  const record = findSessionRecord(sessionId, pairCode);
  if (!record) {
    throw new Error('Mã QR không tồn tại hoặc đã hết hạn. Hãy tạo mã mới trên máy tính.');
  }
  if (record.expiresAtMs <= Date.now() || record.status === 'expired') {
    record.status = 'expired';
    record.authBundle = undefined;
    throw new Error('Mã QR này đã hết hạn sau 3 phút. Vui lòng làm mới mã trên PC.');
  }
  if (record.status === 'consumed' || record.status === 'approved') {
    throw new Error('Mã QR này đã được sử dụng để đăng nhập.');
  }
  if (record.status === 'rejected') {
    throw new Error('Yêu cầu đăng nhập QR này đã bị từ chối.');
  }

  record.status = 'scanned';
  record.scannerDisplayName =
    scannerUser.displayName || maskEmailPreview(scannerUser.email) || 'Thiết bị di động';
  record.scannerEmailMasked = maskEmailPreview(scannerUser.email);

  return {
    ok: true,
    sessionId: record.sessionId,
    pairCode: record.pairCode,
    status: record.status,
    expiresAt: record.expiresAtMs,
    pcDevice: record.pcDevice,
  };
}

export async function approveQrLoginSession(req: any) {
  pruneExpiredQrSessions();
  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key để xác thực phiên QR.');
  }

  const idToken = extractBearerToken(req);
  const mobileAccount = await verifyFirebaseIdToken(idToken, apiKey);

  const { sessionId, pairCode, decision, refreshToken } = req?.body || {};
  const record = findSessionRecord(sessionId, pairCode);
  if (!record) {
    throw new Error('Phiên đăng nhập QR không tồn tại hoặc đã hết hạn.');
  }
  if (record.expiresAtMs <= Date.now() || record.status === 'expired') {
    record.status = 'expired';
    record.authBundle = undefined;
    throw new Error('Mã QR đã hết hạn. Vui lòng tạo mã mới trên PC.');
  }
  if (record.status === 'consumed' || record.status === 'approved') {
    throw new Error('Phiên QR này đã được xác nhận trước đó.');
  }
  if (record.status === 'rejected') {
    throw new Error('Phiên QR này đã bị từ chối.');
  }

  if (decision === 'reject') {
    record.status = 'rejected';
    record.authBundle = undefined;
    return {
      ok: true,
      decision: 'reject' as const,
      sessionId: record.sessionId,
    };
  }

  if (decision !== 'approve') {
    throw new Error('Hành động xác nhận QR không hợp lệ.');
  }

  const cleanRefreshToken = String(refreshToken || '').trim();
  if (!cleanRefreshToken) {
    throw new Error('Thiếu mã phiên làm mới (refreshToken) từ thiết bị di động.');
  }

  const tokenResp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cleanRefreshToken,
      }).toString(),
    }
  );
  const tokenJson = (await tokenResp.json().catch(() => ({}))) as {
    id_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    user_id?: string;
    error?: { message?: string };
  };

  if (
    !tokenResp.ok ||
    !tokenJson?.id_token ||
    !tokenJson?.refresh_token ||
    !tokenJson?.user_id
  ) {
    throw new Error(
      `Không thể cấp phiên đăng nhập cho PC (${tokenJson?.error?.message || `HTTP ${tokenResp.status}`}).`
    );
  }

  if (String(tokenJson.user_id) !== String(mobileAccount.uid)) {
    throw new Error('Thông tin tài khoản xác nhận không khớp. Yêu cầu bị từ chối vì lý do bảo mật.');
  }

  const expiresInSec = Math.max(60, Number(tokenJson.expires_in || 3600));
  record.authBundle = {
    uid: mobileAccount.uid,
    ...(mobileAccount.email ? { email: mobileAccount.email } : {}),
    emailVerified: mobileAccount.emailVerified,
    ...(mobileAccount.displayName ? { displayName: mobileAccount.displayName } : {}),
    ...(mobileAccount.photoURL ? { photoURL: mobileAccount.photoURL } : {}),
    ...(mobileAccount.phoneNumber ? { phoneNumber: mobileAccount.phoneNumber } : {}),
    providerData: mobileAccount.providerData,
    ...(mobileAccount.createdAt ? { createdAt: mobileAccount.createdAt } : {}),
    ...(mobileAccount.lastLoginAt ? { lastLoginAt: mobileAccount.lastLoginAt } : {}),
    accessToken: String(tokenJson.id_token),
    refreshToken: String(tokenJson.refresh_token),
    expirationTime: Date.now() + expiresInSec * 1000,
    apiKey,
  };
  record.status = 'approved';

  return {
    ok: true,
    decision: 'approve' as const,
    sessionId: record.sessionId,
    pcDevice: record.pcDevice,
  };
}

export function pollQrLoginSession(req: any) {
  pruneExpiredQrSessions();

  const { sessionId, pollSecret } = req?.body || {};
  const sid = String(sessionId || '').trim();
  const secret = String(pollSecret || '').trim();

  if (!sid || !secret) {
    throw new Error('Thiếu thông tin phiên QR.');
  }

  const record = sessionsMap.get(sid);
  if (!record) {
    return {
      ok: true,
      status: 'expired' as QrSessionStatus,
    };
  }

  const a = Buffer.from(record.pollSecret, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Mã bí mật theo dõi phiên QR không hợp lệ.');
  }

  if (
    record.expiresAtMs <= Date.now() &&
    (record.status === 'pending' || record.status === 'scanned')
  ) {
    record.status = 'expired';
    record.authBundle = undefined;
  }

  if (record.status === 'approved' && record.authBundle) {
    const bundle = record.authBundle;
    record.authBundle = undefined;
    record.status = 'consumed';
    return {
      ok: true,
      status: 'approved' as QrSessionStatus,
      authBundle: bundle,
    };
  }

  return {
    ok: true,
    status: record.status,
    expiresAt: record.expiresAtMs,
    ...(record.scannerDisplayName ? { scannerHint: record.scannerDisplayName } : {}),
  };
}
