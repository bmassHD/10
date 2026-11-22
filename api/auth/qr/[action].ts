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
  pollSecretHash: string;
  publicKey: string;
  status: QrSessionStatus;
  createdAtMs: number;
  expiresAtMs: number;
  pcDevice: QrDeviceMeta;
  scannerDisplayName?: string;
  scannerEmailMasked?: string;
  scannerUid?: string;
  encryptedAuthBundle?: string;
}

interface FirebaseServerConfig {
  apiKey: string;
  projectId: string;
  firestoreDatabaseId: string;
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

function pruneExpiredLocalSessions(): void {
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
      rec.encryptedAuthBundle = undefined;
    }
  }
}

function parseRequestBody(req: any): Record<string, any> {
  const raw = req?.body;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function readFirebaseServerConfig(): FirebaseServerConfig {
  const envApiKey = String(
    process.env.FIREBASE_WEB_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      process.env.VITE_FIREBASE_API_KEY ||
      ''
  ).trim();
  const envProjectId = String(
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || ''
  ).trim();
  const envDatabaseId = String(
    process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || ''
  ).trim();

  let fileCfg: Partial<FirebaseServerConfig> = {};
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(moduleDir, '..', '..', '..', 'firebase-applet-config.json'),
      path.resolve(moduleDir, '..', '..', 'firebase-applet-config.json'),
      path.resolve(moduleDir, '..', 'firebase-applet-config.json'),
    ];
    const cfgPath = candidates.find(p => fs.existsSync(p));
    if (cfgPath) {
      fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Partial<FirebaseServerConfig>;
    }
  } catch {
    // ignore file lookup failure
  }

  return {
    apiKey: envApiKey || String(fileCfg.apiKey || '').trim(),
    projectId: envProjectId || String(fileCfg.projectId || '').trim(),
    firestoreDatabaseId:
      envDatabaseId || String(fileCfg.firestoreDatabaseId || '').trim() || '(default)',
  };
}

function getFirestoreDocumentsBaseUrl(cfg: FirebaseServerConfig): string {
  if (!cfg.projectId) return '';
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(cfg.firestoreDatabaseId || '(default)')}/documents`;
}

function toFirestoreValue(value: unknown): Record<string, any> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { integerValue: String(value) };
    }
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(item => toFirestoreValue(item)) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  return fields;
}

function fromFirestoreValue(val: Record<string, any> | undefined): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return String(val.stringValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = val.arrayValue?.values;
    return Array.isArray(arr) ? arr.map((item: any) => fromFirestoreValue(item)) : [];
  }
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = fromFirestoreValue(v as Record<string, any>);
    }
    return out;
  }
  return undefined;
}

function fromFirestoreDoc<T = Record<string, any>>(docJson: any): T | null {
  if (!docJson || typeof docJson !== 'object' || !docJson.fields) return null;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(docJson.fields)) {
    out[k] = fromFirestoreValue(v as Record<string, any>);
  }
  return out as T;
}

async function createFirestoreDoc(
  cfg: FirebaseServerConfig,
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  idToken?: string
): Promise<boolean> {
  const baseUrl = getFirestoreDocumentsBaseUrl(cfg);
  if (!baseUrl) return false;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const resp = await fetch(
      `${baseUrl}/${encodeURIComponent(collectionName)}?documentId=${encodeURIComponent(docId)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ fields: toFirestoreFields(data) }),
      }
    );
    return resp.ok;
  } catch {
    return false;
  }
}

async function getFirestoreDoc<T = Record<string, any>>(
  cfg: FirebaseServerConfig,
  collectionName: string,
  docId: string,
  idToken?: string
): Promise<T | null> {
  const baseUrl = getFirestoreDocumentsBaseUrl(cfg);
  if (!baseUrl || !docId) return null;
  try {
    const headers: Record<string, string> = {};
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const resp = await fetch(
      `${baseUrl}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
      { method: 'GET', headers }
    );
    if (!resp.ok) return null;
    const json = await resp.json().catch(() => null);
    return fromFirestoreDoc<T>(json);
  } catch {
    return null;
  }
}

async function patchFirestoreDoc(
  cfg: FirebaseServerConfig,
  collectionName: string,
  docId: string,
  updates: Record<string, unknown>,
  idToken?: string
): Promise<boolean> {
  const baseUrl = getFirestoreDocumentsBaseUrl(cfg);
  if (!baseUrl || !docId) return false;
  const fieldPaths = Object.keys(updates).filter(k => updates[k] !== undefined);
  if (fieldPaths.length === 0) return true;
  const maskQuery = fieldPaths
    .map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
    .join('&');
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const resp = await fetch(
      `${baseUrl}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?${maskQuery}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ fields: toFirestoreFields(updates) }),
      }
    );
    return resp.ok;
  } catch {
    return false;
  }
}

function generateEphemeralEcKeyPair(): { publicKeyB64: string; privateKeyB64: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
  return {
    publicKeyB64: Buffer.from(publicKey).toString('base64url'),
    privateKeyB64: Buffer.from(privateKey).toString('base64url'),
  };
}

function encryptBundleForPc(publicKeyB64: string, bundle: QrAuthHandoffBundle): string {
  const recipientPubKey = crypto.createPublicKey({
    key: Buffer.from(publicKeyB64, 'base64url'),
    format: 'der',
    type: 'spki',
  });
  const ephemeral = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'der' },
  });
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: recipientPubKey,
  });
  const aesKey = crypto.createHash('sha256').update(sharedSecret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(bundle), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    epk: Buffer.from(ephemeral.publicKey).toString('base64url'),
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    ct: ciphertext.toString('base64url'),
  });
}

function decryptBundleForPc(privateKeyB64: string, encryptedPayload: string): QrAuthHandoffBundle {
  const parsed = JSON.parse(encryptedPayload) as {
    epk: string;
    iv: string;
    tag: string;
    ct: string;
  };
  const recipientPrivKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyB64, 'base64url'),
    format: 'der',
    type: 'pkcs8',
  });
  const ephemeralPubKey = crypto.createPublicKey({
    key: Buffer.from(parsed.epk, 'base64url'),
    format: 'der',
    type: 'spki',
  });
  const sharedSecret = crypto.diffieHellman({
    privateKey: recipientPrivKey,
    publicKey: ephemeralPubKey,
  });
  const aesKey = crypto.createHash('sha256').update(sharedSecret).digest();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    aesKey,
    Buffer.from(parsed.iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ct, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as QrAuthHandoffBundle;
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

async function verifyFirebaseIdToken(
  idToken: string,
  apiKey: string
): Promise<{
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

async function resolveSessionRecord(
  cfg: FirebaseServerConfig,
  sessionId?: unknown,
  pairCode?: unknown,
  idToken?: string
): Promise<QrLoginSessionRecord | null> {
  const sid = String(sessionId || '').trim();
  const code = String(pairCode || '').trim().toUpperCase();

  let targetSessionId = sid;
  if (!targetSessionId && code) {
    const fsPair = await getFirestoreDoc<{ sessionId?: string }>(cfg, 'qrPairCodes', code, idToken);
    if (fsPair?.sessionId) {
      targetSessionId = String(fsPair.sessionId);
    } else {
      targetSessionId = pairCodeIndex.get(code) || '';
    }
  }

  if (!targetSessionId) return null;

  const fsSession = await getFirestoreDoc<QrLoginSessionRecord>(
    cfg,
    'qrLoginSessions',
    targetSessionId,
    idToken
  );
  if (fsSession && fsSession.sessionId) {
    return fsSession;
  }

  return sessionsMap.get(targetSessionId) || null;
}

export async function createQrLoginSession(req: any) {
  pruneExpiredLocalSessions();
  const cfg = readFirebaseServerConfig();

  const body = parseRequestBody(req);
  const rawPlatform = String(body.platform || '').trim();
  const platform: QrDeviceMeta['platform'] =
    rawPlatform === 'mobile' || rawPlatform === 'tablet' ? rawPlatform : 'desktop';

  const nowMs = Date.now();
  const expiresAtMs = nowMs + QR_SESSION_TTL_MS;
  const sessionId = `qr_${crypto.randomBytes(16).toString('hex')}`;
  const secretHex = crypto.randomBytes(24).toString('hex');
  const pollSecretHash = crypto.createHash('sha256').update(secretHex, 'utf8').digest('hex');
  const { publicKeyB64, privateKeyB64 } = generateEphemeralEcKeyPair();
  const pollSecret = `${secretHex}.${privateKeyB64}`;

  let pairCode = generateUniquePairCode();
  const pcDevice: QrDeviceMeta = {
    deviceName: sanitizeText(body.deviceName, 'Máy tính (Trình duyệt Web)', 120),
    platform,
    os: sanitizeText(body.os, 'PC / Web', 64),
    browser: sanitizeText(body.browser, 'Trình duyệt', 64),
    requestedAt: new Date(nowMs).toISOString(),
  };

  const record: QrLoginSessionRecord = {
    sessionId,
    pairCode,
    pollSecretHash,
    publicKey: publicKeyB64,
    status: 'pending',
    createdAtMs: nowMs,
    expiresAtMs,
    pcDevice,
  };

  if (cfg.projectId) {
    let createdPair = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      createdPair = await createFirestoreDoc(cfg, 'qrPairCodes', pairCode, {
        pairCode,
        sessionId,
        expiresAtMs,
      });
      if (createdPair) break;
      pairCode = generateUniquePairCode();
      record.pairCode = pairCode;
    }

    const createdSession = await createFirestoreDoc(cfg, 'qrLoginSessions', sessionId, {
      sessionId,
      pairCode,
      pollSecretHash,
      publicKey: publicKeyB64,
      status: 'pending',
      createdAtMs: nowMs,
      expiresAtMs,
      pcDevice,
    });

    if (!createdSession && process.env.VERCEL) {
      throw new Error('Không thể khởi tạo phiên QR bảo mật trên máy chủ dữ liệu.');
    }
  }

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
  pruneExpiredLocalSessions();
  const cfg = readFirebaseServerConfig();
  if (!cfg.apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key để xác thực mã QR.');
  }

  const idToken = extractBearerToken(req);
  const scannerUser = await verifyFirebaseIdToken(idToken, cfg.apiKey);

  const { sessionId, pairCode } = parseRequestBody(req);
  const record = await resolveSessionRecord(cfg, sessionId, pairCode, idToken);
  if (!record) {
    throw new Error('Mã QR không tồn tại hoặc đã hết hạn. Hãy tạo mã mới trên máy tính.');
  }
  if (record.expiresAtMs <= Date.now() || record.status === 'expired') {
    await patchFirestoreDoc(cfg, 'qrLoginSessions', record.sessionId, {
      status: 'expired',
      encryptedAuthBundle: '',
    });
    const localRec = sessionsMap.get(record.sessionId);
    if (localRec) {
      localRec.status = 'expired';
      localRec.encryptedAuthBundle = undefined;
    }
    throw new Error('Mã QR này đã hết hạn sau 3 phút. Vui lòng làm mới mã trên PC.');
  }
  if (record.status === 'consumed' || record.status === 'approved') {
    throw new Error('Mã QR này đã được sử dụng để đăng nhập.');
  }
  if (record.status === 'rejected') {
    throw new Error('Yêu cầu đăng nhập QR này đã bị từ chối.');
  }

  const scannerDisplayName = sanitizeText(
    scannerUser.displayName || maskEmailPreview(scannerUser.email),
    'Thiết bị di động',
    120
  );
  const scannerEmailMasked = sanitizeText(maskEmailPreview(scannerUser.email), '', 120);

  await patchFirestoreDoc(
    cfg,
    'qrLoginSessions',
    record.sessionId,
    {
      status: 'scanned',
      scannerDisplayName,
      scannerEmailMasked,
      scannerUid: scannerUser.uid,
    },
    idToken
  );

  const localRec = sessionsMap.get(record.sessionId);
  if (localRec) {
    localRec.status = 'scanned';
    localRec.scannerDisplayName = scannerDisplayName;
    localRec.scannerEmailMasked = scannerEmailMasked;
    localRec.scannerUid = scannerUser.uid;
  }

  return {
    ok: true,
    sessionId: record.sessionId,
    pairCode: record.pairCode,
    status: 'scanned' as QrSessionStatus,
    expiresAt: record.expiresAtMs,
    pcDevice: record.pcDevice,
  };
}

export async function approveQrLoginSession(req: any) {
  pruneExpiredLocalSessions();
  const cfg = readFirebaseServerConfig();
  if (!cfg.apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key để xác thực phiên QR.');
  }

  const idToken = extractBearerToken(req);
  const mobileAccount = await verifyFirebaseIdToken(idToken, cfg.apiKey);

  const { sessionId, pairCode, decision, refreshToken } = parseRequestBody(req);
  const record = await resolveSessionRecord(cfg, sessionId, pairCode, idToken);
  if (!record) {
    throw new Error('Phiên đăng nhập QR không tồn tại hoặc đã hết hạn.');
  }
  if (record.expiresAtMs <= Date.now() || record.status === 'expired') {
    await patchFirestoreDoc(cfg, 'qrLoginSessions', record.sessionId, {
      status: 'expired',
      encryptedAuthBundle: '',
    });
    throw new Error('Mã QR đã hết hạn. Vui lòng tạo mã mới trên PC.');
  }
  if (record.status === 'consumed' || record.status === 'approved') {
    throw new Error('Phiên QR này đã được xác nhận trước đó.');
  }
  if (record.status === 'rejected') {
    throw new Error('Phiên QR này đã bị từ chối.');
  }

  if (decision === 'reject') {
    await patchFirestoreDoc(
      cfg,
      'qrLoginSessions',
      record.sessionId,
      {
        status: 'rejected',
        scannerUid: mobileAccount.uid,
        encryptedAuthBundle: '',
      },
      idToken
    );
    const localRec = sessionsMap.get(record.sessionId);
    if (localRec) {
      localRec.status = 'rejected';
      localRec.encryptedAuthBundle = undefined;
    }
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
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`,
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
  const authBundle: QrAuthHandoffBundle = {
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
    apiKey: cfg.apiKey,
  };

  const encryptedAuthBundle = encryptBundleForPc(record.publicKey, authBundle);

  const patched = await patchFirestoreDoc(
    cfg,
    'qrLoginSessions',
    record.sessionId,
    {
      status: 'approved',
      scannerUid: mobileAccount.uid,
      encryptedAuthBundle,
    },
    idToken
  );

  const localRec = sessionsMap.get(record.sessionId);
  if (localRec) {
    localRec.status = 'approved';
    localRec.scannerUid = mobileAccount.uid;
    localRec.encryptedAuthBundle = encryptedAuthBundle;
  }

  if (!patched && !localRec) {
    throw new Error('Không thể lưu trạng thái phê duyệt QR. Vui lòng thử lại.');
  }

  return {
    ok: true,
    decision: 'approve' as const,
    sessionId: record.sessionId,
    pcDevice: record.pcDevice,
  };
}

export async function pollQrLoginSession(req: any) {
  pruneExpiredLocalSessions();
  const cfg = readFirebaseServerConfig();

  const { sessionId, pollSecret } = parseRequestBody(req);
  const sid = String(sessionId || '').trim();
  const rawSecret = String(pollSecret || '').trim();

  if (!sid || !rawSecret) {
    throw new Error('Thiếu thông tin phiên QR.');
  }

  const dotIdx = rawSecret.indexOf('.');
  if (dotIdx <= 0) {
    throw new Error('Mã bí mật theo dõi phiên QR không hợp lệ.');
  }
  const secretHex = rawSecret.slice(0, dotIdx);
  const privateKeyB64 = rawSecret.slice(dotIdx + 1);
  if (!secretHex || !privateKeyB64) {
    throw new Error('Mã bí mật theo dõi phiên QR không hợp lệ.');
  }

  const fsRecord = await getFirestoreDoc<QrLoginSessionRecord>(cfg, 'qrLoginSessions', sid);
  const record = fsRecord || sessionsMap.get(sid) || null;
  if (!record) {
    return {
      ok: true,
      status: 'expired' as QrSessionStatus,
    };
  }

  const incomingHash = crypto.createHash('sha256').update(secretHex, 'utf8').digest('hex');
  const a = Buffer.from(String(record.pollSecretHash || ''), 'utf8');
  const b = Buffer.from(incomingHash, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Mã bí mật theo dõi phiên QR không hợp lệ.');
  }

  if (
    record.expiresAtMs <= Date.now() &&
    (record.status === 'pending' || record.status === 'scanned')
  ) {
    await patchFirestoreDoc(cfg, 'qrLoginSessions', sid, {
      status: 'expired',
      encryptedAuthBundle: '',
    });
    const localRec = sessionsMap.get(sid);
    if (localRec) {
      localRec.status = 'expired';
      localRec.encryptedAuthBundle = undefined;
    }
    return {
      ok: true,
      status: 'expired' as QrSessionStatus,
    };
  }

  if (record.status === 'approved' && record.encryptedAuthBundle) {
    const authBundle = decryptBundleForPc(privateKeyB64, record.encryptedAuthBundle);
    await patchFirestoreDoc(cfg, 'qrLoginSessions', sid, {
      status: 'consumed',
      encryptedAuthBundle: '',
    });
    sessionsMap.delete(sid);
    pairCodeIndex.delete(record.pairCode);
    return {
      ok: true,
      status: 'approved' as QrSessionStatus,
      authBundle,
    };
  }

  return {
    ok: true,
    status: record.status,
    expiresAt: record.expiresAtMs,
    ...(record.scannerDisplayName ? { scannerHint: record.scannerDisplayName } : {}),
  };
}

function resolveAction(req: any): string {
  const rawQueryAction = req.query?.action;
  if (typeof rawQueryAction === 'string' && rawQueryAction.trim()) {
    return rawQueryAction.trim().toLowerCase();
  }
  if (Array.isArray(rawQueryAction) && rawQueryAction[0]) {
    return String(rawQueryAction[0]).trim().toLowerCase();
  }
  try {
    const pathname = new URL(req.url || '', 'http://localhost').pathname;
    const segments = pathname.split('/').filter(Boolean);
    return (segments[segments.length - 1] || '').toLowerCase();
  } catch {
    return '';
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Chỉ chấp nhận phương thức POST.' });
  }

  const action = resolveAction(req);

  try {
    if (action === 'create') {
      const result = await createQrLoginSession(req);
      return res.status(200).json(result);
    }
    if (action === 'inspect') {
      const result = await inspectQrLoginSession(req);
      return res.status(200).json(result);
    }
    if (action === 'approve') {
      const result = await approveQrLoginSession(req);
      return res.status(200).json(result);
    }
    if (action === 'status') {
      const result = await pollQrLoginSession(req);
      return res.status(200).json(result);
    }
    return res.status(404).json({ ok: false, error: 'Endpoint QR Auth không tồn tại.' });
  } catch (err: any) {
    const message = err?.message || 'Không thể xử lý yêu cầu đăng nhập QR.';
    const status = message.includes('đăng nhập trên điện thoại') ? 401 : 400;
    return res.status(status).json({ ok: false, error: message });
  }
}
