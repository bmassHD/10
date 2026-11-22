import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { QrAuthHandoffBundle } from './qrLoginService';

interface EncryptedSecret {
  iv: string;
  tag: string;
  data: string;
}

export interface StoredBiometricCredential {
  credentialId: string;
  publicKeyB64: string;
  counter: number;
  transports: string[];
  uid: string;
  deviceId: string;
  rpID: string;
  origin: string;
  label: string;
  deviceName: string;
  displayName: string;
  emailMasked: string;
  encryptedRefreshToken: EncryptedSecret;
  createdAt: string;
  lastUsedAt: string;
}

interface BiometricChallengeRecord {
  challengeId: string;
  type: 'register' | 'login' | 'unlock';
  challenge: string;
  rpID: string;
  origin: string;
  uid?: string;
  deviceId: string;
  createdAtMs: number;
  expiresAtMs: number;
}

const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const RP_NAME = 'Trạm Y Tế Xã Sông Lô';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MASTER_KEY_FILE = path.resolve(__dirname, '..', '..', '.biometric-master.key');
const CREDENTIALS_FILE = path.resolve(__dirname, '..', '..', '.biometric-credentials.json');

const globalForBiometric = globalThis as typeof globalThis & {
  __tytBiometricChallenges?: Map<string, BiometricChallengeRecord>;
  __tytBiometricCredentials?: Map<string, StoredBiometricCredential>;
  __tytBiometricLoaded?: boolean;
  __tytBiometricMasterKey?: Buffer;
};

const challengesMap: Map<string, BiometricChallengeRecord> =
  globalForBiometric.__tytBiometricChallenges || new Map<string, BiometricChallengeRecord>();
const credentialsMap: Map<string, StoredBiometricCredential> =
  globalForBiometric.__tytBiometricCredentials || new Map<string, StoredBiometricCredential>();

globalForBiometric.__tytBiometricChallenges = challengesMap;
globalForBiometric.__tytBiometricCredentials = credentialsMap;

function getMasterKey(): Buffer {
  if (globalForBiometric.__tytBiometricMasterKey) {
    return globalForBiometric.__tytBiometricMasterKey;
  }

  const envSecret = String(process.env.BIOMETRIC_MASTER_KEY || '').trim();
  if (envSecret) {
    if (/^[0-9a-fA-F]{64}$/.test(envSecret)) {
      const buf = Buffer.from(envSecret, 'hex');
      globalForBiometric.__tytBiometricMasterKey = buf;
      return buf;
    }
    const derived = crypto.createHash('sha256').update(envSecret, 'utf8').digest();
    globalForBiometric.__tytBiometricMasterKey = derived;
    return derived;
  }

  try {
    if (fs.existsSync(MASTER_KEY_FILE)) {
      const hex = fs.readFileSync(MASTER_KEY_FILE, 'utf8').trim();
      if (/^[0-9a-fA-F]{64}$/.test(hex)) {
        const buf = Buffer.from(hex, 'hex');
        globalForBiometric.__tytBiometricMasterKey = buf;
        return buf;
      }
    }
  } catch {
    // regenerate if corrupt or unreadable
  }

  const generated = crypto.randomBytes(32);
  try {
    fs.writeFileSync(MASTER_KEY_FILE, generated.toString('hex'), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // non-fatal in ephemeral read-only environments
  }
  globalForBiometric.__tytBiometricMasterKey = generated;
  return generated;
}

function sealSecret(plaintext: string): EncryptedSecret {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    data: encrypted.toString('base64url'),
  };
}

function unsealSecret(secret: EncryptedSecret): string {
  const key = getMasterKey();
  const iv = Buffer.from(secret.iv, 'base64url');
  const tag = Buffer.from(secret.tag, 'base64url');
  const data = Buffer.from(secret.data, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

function ensureCredentialsLoaded(): void {
  if (globalForBiometric.__tytBiometricLoaded) return;
  globalForBiometric.__tytBiometricLoaded = true;
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) return;
    const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item?.credentialId && item?.uid && item?.publicKeyB64) {
          credentialsMap.set(String(item.credentialId), item as StoredBiometricCredential);
        }
      }
    }
  } catch {
    // ignore corrupt cache file
  }
}

function persistCredentials(): void {
  try {
    const list = Array.from(credentialsMap.values());
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(list, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    // non-fatal in read-only env
  }
}

function pruneExpiredChallenges(): void {
  const now = Date.now();
  for (const [id, rec] of challengesMap.entries()) {
    if (rec.expiresAtMs <= now) {
      challengesMap.delete(id);
    }
  }
}

function readFirebaseWebApiKey(): string {
  const envKey = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
  if (envKey) return envKey;
  try {
    const candidates = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(__dirname, '..', '..', 'firebase-applet-config.json'),
      path.resolve(__dirname, '..', 'firebase-applet-config.json'),
    ];
    const cfgPath = candidates.find((p) => fs.existsSync(p));
    if (cfgPath) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      return String(cfg?.apiKey || '').trim();
    }
  } catch {
    // ignore
  }
  return '';
}

function extractBearerToken(req: any): string {
  const raw = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

function resolveRpContext(req: any): { origin: string; rpID: string; allowedOrigins: string[] } {
  const originHeader = String(req?.headers?.origin || '').trim();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '')
    .split(',')[0]
    ?.trim();
  const rawHost = forwardedHost || String(req?.headers?.host || '').trim();
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    ?.trim();
  const proto =
    forwardedProto ||
    (rawHost.includes('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https');

  const computedOrigin = rawHost ? `${proto}://${rawHost}`.replace(/\/+$/, '') : '';
  const envAppUrl = String(process.env.APP_URL || '').trim();
  const validEnvOrigin =
    envAppUrl && envAppUrl !== 'MY_APP_URL' ? envAppUrl.replace(/\/+$/, '') : '';

  let primaryOrigin = computedOrigin || validEnvOrigin || 'https://tyt.slhd.id.vn';
  if (originHeader) {
    try {
      const parsedOrigin = new URL(originHeader);
      const computedHost = computedOrigin ? new URL(computedOrigin).host : '';
      const envHost = validEnvOrigin ? new URL(validEnvOrigin).host : '';
      if (
        parsedOrigin.host === computedHost ||
        parsedOrigin.host === envHost ||
        parsedOrigin.hostname === 'localhost' ||
        parsedOrigin.hostname === '127.0.0.1' ||
        parsedOrigin.hostname.endsWith('.run.app') ||
        parsedOrigin.hostname.endsWith('.id.vn')
      ) {
        primaryOrigin = parsedOrigin.origin;
      }
    } catch {
      // ignore invalid origin header
    }
  }

  let rpID = 'localhost';
  try {
    rpID = new URL(primaryOrigin).hostname;
  } catch {
    rpID = rawHost.split(':')[0] || 'localhost';
  }

  const allowedSet = new Set<string>([primaryOrigin]);
  if (computedOrigin) allowedSet.add(computedOrigin);
  if (validEnvOrigin) allowedSet.add(validEnvOrigin);

  return {
    origin: primaryOrigin,
    rpID,
    allowedOrigins: Array.from(allowedSet),
  };
}

function sanitizeText(val: unknown, fallback: string, maxLen = 96): string {
  const s = String(val || '').trim();
  return s ? s.slice(0, maxLen) : fallback;
}

function sanitizeDeviceId(val: unknown): string {
  const s = String(val || '').trim();
  if (!s || s.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(s)) {
    throw new Error('Mã định danh thiết bị không hợp lệ.');
  }
  return s;
}

function maskEmailPreview(email?: string): string {
  const s = String(email || '').trim();
  if (!s || !s.includes('@')) return '';
  if (s.toLowerCase().endsWith('@zalo.tyt.local')) return 'Tài khoản Zalo';
  const [local, domain] = s.split('@');
  if (local.length <= 2) return `${local[0] || '*'}*@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
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
    throw new Error('Bạn cần đăng nhập trước khi thực hiện thao tác sinh trắc học.');
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
    throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const providerData: QrAuthHandoffBundle['providerData'] = Array.isArray(user.providerUserInfo)
    ? user.providerUserInfo
        .filter((p) => Boolean(p?.providerId))
        .map((p) => ({
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

async function exchangeRefreshToken(
  refreshToken: string,
  apiKey: string
): Promise<{
  idToken: string;
  refreshToken: string;
  expirationTime: number;
  userId: string;
}> {
  const tokenResp = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
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
    const reason = tokenJson?.error?.message || `HTTP ${tokenResp.status}`;
    const err = new Error(`Phiên sinh trắc học không còn hiệu lực (${reason}).`) as Error & {
      tokenRevoked?: boolean;
    };
    if (
      reason.includes('TOKEN_EXPIRED') ||
      reason.includes('USER_DISABLED') ||
      reason.includes('INVALID_REFRESH_TOKEN') ||
      reason.includes('USER_NOT_FOUND')
    ) {
      err.tokenRevoked = true;
    }
    throw err;
  }

  const expiresInSec = Math.max(60, Number(tokenJson.expires_in || 3600));
  return {
    idToken: String(tokenJson.id_token),
    refreshToken: String(tokenJson.refresh_token),
    expirationTime: Date.now() + expiresInSec * 1000,
    userId: String(tokenJson.user_id),
  };
}

export async function createBiometricRegistrationOptions(req: any) {
  ensureCredentialsLoaded();
  pruneExpiredChallenges();

  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key.');
  }

  const idToken = extractBearerToken(req);
  const user = await verifyFirebaseIdToken(idToken, apiKey);

  const body = req?.body || {};
  const deviceId = sanitizeDeviceId(body.deviceId);
  const { origin, rpID } = resolveRpContext(req);

  const excludeCredentials = Array.from(credentialsMap.values())
    .filter((c) => c.uid === user.uid && c.rpID === rpID && c.deviceId === deviceId)
    .map((c) => ({
      id: c.credentialId,
      transports: c.transports as any,
    }));

  const userName = user.email || user.phoneNumber || `user-${user.uid.slice(0, 8)}`;
  const userDisplayName = sanitizeText(user.displayName || userName, 'Thành viên', 80);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new Uint8Array(Buffer.from(user.uid, 'utf8')),
    userName,
    userDisplayName,
    timeout: 60000,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    preferredAuthenticatorType: 'localDevice',
  });

  const challengeId = `bio_reg_${crypto.randomBytes(12).toString('hex')}`;
  const nowMs = Date.now();
  challengesMap.set(challengeId, {
    challengeId,
    type: 'register',
    challenge: options.challenge,
    rpID,
    origin,
    uid: user.uid,
    deviceId,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + CHALLENGE_TTL_MS,
  });

  return {
    ok: true,
    challengeId,
    rpID,
    options,
  };
}

export async function verifyBiometricRegistration(req: any) {
  ensureCredentialsLoaded();
  pruneExpiredChallenges();

  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key.');
  }

  const idToken = extractBearerToken(req);
  const user = await verifyFirebaseIdToken(idToken, apiKey);

  const body = req?.body || {};
  const challengeId = String(body.challengeId || '').trim();
  const deviceId = sanitizeDeviceId(body.deviceId);
  const refreshToken = String(body.refreshToken || '').trim();
  const attestationResponse = body.response;

  if (!challengeId || !attestationResponse) {
    throw new Error('Thiếu dữ liệu xác thực sinh trắc học.');
  }
  if (!refreshToken) {
    throw new Error('Thiếu mã phiên làm mới để liên kết đăng nhập nhanh.');
  }

  const challengeRec = challengesMap.get(challengeId);
  challengesMap.delete(challengeId); // single-use

  if (!challengeRec || challengeRec.type !== 'register') {
    throw new Error('Phiên kích hoạt sinh trắc học không tồn tại hoặc đã được sử dụng.');
  }
  if (challengeRec.expiresAtMs <= Date.now()) {
    throw new Error('Yêu cầu kích hoạt sinh trắc học đã hết hạn. Vui lòng thử lại.');
  }
  if (challengeRec.uid !== user.uid || challengeRec.deviceId !== deviceId) {
    throw new Error('Phiên kích hoạt sinh trắc học không khớp với thiết bị hoặc tài khoản hiện tại.');
  }

  // Validate refreshToken ownership before trusting it
  const tokenCheck = await exchangeRefreshToken(refreshToken, apiKey);
  if (tokenCheck.userId !== user.uid) {
    throw new Error('Phiên tài khoản không khớp. Không thể kích hoạt sinh trắc học.');
  }

  const { allowedOrigins } = resolveRpContext(req);
  const expectedOrigins = Array.from(new Set([challengeRec.origin, ...allowedOrigins]));

  const verification = await verifyRegistrationResponse({
    response: attestationResponse,
    expectedChallenge: challengeRec.challenge,
    expectedOrigin: expectedOrigins,
    expectedRPID: challengeRec.rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Xác thực khóa sinh trắc học trên thiết bị thất bại.');
  }

  const { credential, userVerified } = verification.registrationInfo;
  if (!userVerified) {
    throw new Error('Thiết bị chưa xác nhận xác thực người dùng (Face ID / Touch ID / PIN).');
  }

  // Remove older credentials for this same device + rpID so this device stays 1-to-1 clean
  for (const [existingId, existingCred] of credentialsMap.entries()) {
    if (existingCred.deviceId === deviceId && existingCred.rpID === challengeRec.rpID) {
      credentialsMap.delete(existingId);
    }
  }

  const nowIso = new Date().toISOString();
  const label = sanitizeText(body.label, 'Face ID / Touch ID', 64);
  const deviceName = sanitizeText(body.deviceName, 'Thiết bị hiện tại', 96);
  const displayName = sanitizeText(user.displayName || user.email || 'Thành viên', 'Thành viên', 80);
  const emailMasked = maskEmailPreview(user.email) || (user.phoneNumber ? `****${user.phoneNumber.slice(-4)}` : 'Tài khoản đã xác thực');

  const stored: StoredBiometricCredential = {
    credentialId: credential.id,
    publicKeyB64: Buffer.from(credential.publicKey).toString('base64url'),
    counter: Number(credential.counter || 0),
    transports: Array.isArray(credential.transports) ? credential.transports : ['internal'],
    uid: user.uid,
    deviceId,
    rpID: challengeRec.rpID,
    origin: challengeRec.origin,
    label,
    deviceName,
    displayName,
    emailMasked,
    encryptedRefreshToken: sealSecret(tokenCheck.refreshToken),
    createdAt: nowIso,
    lastUsedAt: nowIso,
  };

  credentialsMap.set(stored.credentialId, stored);
  persistCredentials();

  return {
    ok: true,
    credential: {
      credentialId: stored.credentialId,
      uid: stored.uid,
      rpId: stored.rpID,
      label: stored.label,
      displayName: stored.displayName,
      emailMasked: stored.emailMasked,
      createdAt: stored.createdAt,
    },
  };
}

export async function createBiometricAuthenticationOptions(req: any) {
  ensureCredentialsLoaded();
  pruneExpiredChallenges();

  const body = req?.body || {};
  const deviceId = sanitizeDeviceId(body.deviceId);
  const mode: 'login' | 'unlock' = body.mode === 'unlock' ? 'unlock' : 'login';
  const expectedUid = typeof body.uid === 'string' ? body.uid.trim() : '';
  const { origin, rpID } = resolveRpContext(req);

  const matchingCreds = Array.from(credentialsMap.values()).filter((c) => {
    if (c.deviceId !== deviceId || c.rpID !== rpID) return false;
    if (expectedUid && c.uid !== expectedUid) return false;
    return true;
  });

  if (matchingCreds.length === 0) {
    return {
      ok: false,
      notEnrolled: true,
      error: 'Thiết bị này chưa kích hoạt hoặc đã thu hồi đăng nhập sinh trắc học.',
    };
  }

  // Sort most recently used first
  matchingCreds.sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || ''));
  const primary = matchingCreds[0];

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: matchingCreds.map((c) => ({
      id: c.credentialId,
      transports: (c.transports?.length ? c.transports : ['internal']) as any,
    })),
    timeout: 60000,
    userVerification: 'required',
  });

  const challengeId = `bio_auth_${crypto.randomBytes(12).toString('hex')}`;
  const nowMs = Date.now();
  challengesMap.set(challengeId, {
    challengeId,
    type: mode,
    challenge: options.challenge,
    rpID,
    origin,
    ...(expectedUid ? { uid: expectedUid } : {}),
    deviceId,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + CHALLENGE_TTL_MS,
  });

  return {
    ok: true,
    challengeId,
    rpID,
    options,
    hint: {
      credentialId: primary.credentialId,
      uid: primary.uid,
      label: primary.label,
      displayName: primary.displayName,
      emailMasked: primary.emailMasked,
    },
  };
}

export async function verifyBiometricAuthentication(req: any) {
  ensureCredentialsLoaded();
  pruneExpiredChallenges();

  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key.');
  }

  const body = req?.body || {};
  const challengeId = String(body.challengeId || '').trim();
  const deviceId = sanitizeDeviceId(body.deviceId);
  const assertionResponse = body.response;

  if (!challengeId || !assertionResponse?.id) {
    throw new Error('Thiếu dữ liệu phản hồi sinh trắc học.');
  }

  const challengeRec = challengesMap.get(challengeId);
  challengesMap.delete(challengeId); // single-use

  if (!challengeRec || (challengeRec.type !== 'login' && challengeRec.type !== 'unlock')) {
    throw new Error('Phiên xác thực sinh trắc học không tồn tại hoặc đã hết hạn.');
  }
  if (challengeRec.expiresAtMs <= Date.now()) {
    throw new Error('Yêu cầu xác thực sinh trắc học đã hết hạn. Vui lòng thử lại.');
  }
  if (challengeRec.deviceId !== deviceId) {
    throw new Error('Mã thiết bị không khớp với phiên xác thực sinh trắc học.');
  }

  const credentialId = String(assertionResponse.id);
  const cred = credentialsMap.get(credentialId);
  if (!cred || cred.deviceId !== deviceId || cred.rpID !== challengeRec.rpID) {
    throw new Error('Thông tin sinh trắc học của thiết bị không tồn tại hoặc đã bị thu hồi.');
  }

  if (challengeRec.type === 'unlock') {
    const idToken = extractBearerToken(req);
    const activeUser = await verifyFirebaseIdToken(idToken, apiKey);
    if (activeUser.uid !== cred.uid || (challengeRec.uid && challengeRec.uid !== cred.uid)) {
      throw new Error('Khóa sinh trắc học không thuộc về tài khoản đang đăng nhập.');
    }
  } else if (challengeRec.uid && challengeRec.uid !== cred.uid) {
    throw new Error('Khóa sinh trắc học không khớp tài khoản.');
  }

  const { allowedOrigins } = resolveRpContext(req);
  const expectedOrigins = Array.from(new Set([challengeRec.origin, ...allowedOrigins]));

  const verification = await verifyAuthenticationResponse({
    response: assertionResponse,
    expectedChallenge: challengeRec.challenge,
    expectedOrigin: expectedOrigins,
    expectedRPID: challengeRec.rpID,
    credential: {
      id: cred.credentialId,
      publicKey: new Uint8Array(Buffer.from(cred.publicKeyB64, 'base64url')),
      counter: cred.counter,
      transports: cred.transports,
    },
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.authenticationInfo) {
    throw new Error('Xác thực sinh trắc học không hợp lệ.');
  }

  if (!verification.authenticationInfo.userVerified) {
    throw new Error('Chưa hoàn tất xác minh sinh trắc học trên thiết bị.');
  }

  const newCounter = Number(verification.authenticationInfo.newCounter || 0);
  if (cred.counter > 0 && newCounter <= cred.counter) {
    throw new Error('Phát hiện bất thường bộ đếm bảo mật sinh trắc học. Vui lòng kích hoạt lại.');
  }

  cred.counter = newCounter;
  cred.lastUsedAt = new Date().toISOString();

  if (challengeRec.type === 'unlock') {
    persistCredentials();
    return {
      ok: true,
      mode: 'unlock' as const,
      uid: cred.uid,
      label: cred.label,
      lastUsedAt: cred.lastUsedAt,
    };
  }

  let storedRefreshToken = '';
  try {
    storedRefreshToken = unsealSecret(cred.encryptedRefreshToken);
  } catch {
    credentialsMap.delete(cred.credentialId);
    persistCredentials();
    const err = new Error('Khóa giải mã phiên sinh trắc học đã thay đổi. Vui lòng đăng nhập lại và kích hoạt lại.') as Error & {
      credentialInvalidated?: boolean;
    };
    err.credentialInvalidated = true;
    throw err;
  }

  let refreshed: Awaited<ReturnType<typeof exchangeRefreshToken>>;
  try {
    refreshed = await exchangeRefreshToken(storedRefreshToken, apiKey);
  } catch (err: any) {
    if (err?.tokenRevoked) {
      credentialsMap.delete(cred.credentialId);
      persistCredentials();
      const revokedErr = new Error(
        'Phiên đăng nhập liên kết với sinh trắc học đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập bằng mật khẩu/Google/Zalo để kích hoạt lại.'
      ) as Error & { credentialInvalidated?: boolean };
      revokedErr.credentialInvalidated = true;
      throw revokedErr;
    }
    throw err;
  }

  if (refreshed.userId !== cred.uid) {
    credentialsMap.delete(cred.credentialId);
    persistCredentials();
    throw new Error('Thông tin tài khoản không khớp. Đã hủy khóa sinh trắc học này.');
  }

  // Rotate sealed refresh token
  cred.encryptedRefreshToken = sealSecret(refreshed.refreshToken);
  persistCredentials();

  const userDetails = await verifyFirebaseIdToken(refreshed.idToken, apiKey);
  const authBundle: QrAuthHandoffBundle = {
    uid: userDetails.uid,
    ...(userDetails.email ? { email: userDetails.email } : {}),
    emailVerified: userDetails.emailVerified,
    ...(userDetails.displayName ? { displayName: userDetails.displayName } : {}),
    ...(userDetails.photoURL ? { photoURL: userDetails.photoURL } : {}),
    ...(userDetails.phoneNumber ? { phoneNumber: userDetails.phoneNumber } : {}),
    providerData: userDetails.providerData,
    ...(userDetails.createdAt ? { createdAt: userDetails.createdAt } : {}),
    ...(userDetails.lastLoginAt ? { lastLoginAt: userDetails.lastLoginAt } : {}),
    accessToken: refreshed.idToken,
    refreshToken: refreshed.refreshToken,
    expirationTime: refreshed.expirationTime,
    apiKey,
  };

  return {
    ok: true,
    mode: 'login' as const,
    label: cred.label,
    authBundle,
  };
}

export function getBiometricStatusForDevice(req: any) {
  ensureCredentialsLoaded();
  const body = req?.body || {};
  const deviceId = sanitizeDeviceId(body.deviceId);
  const expectedUid = typeof body.uid === 'string' ? body.uid.trim() : '';
  const { rpID } = resolveRpContext(req);

  const matching = Array.from(credentialsMap.values())
    .filter((c) => c.deviceId === deviceId && c.rpID === rpID && (!expectedUid || c.uid === expectedUid))
    .sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || ''));

  const primary = matching[0];
  if (!primary) {
    return {
      ok: true,
      enrolled: false,
      rpId: rpID,
    };
  }

  return {
    ok: true,
    enrolled: true,
    rpId: rpID,
    credential: {
      credentialId: primary.credentialId,
      uid: primary.uid,
      label: primary.label,
      displayName: primary.displayName,
      emailMasked: primary.emailMasked,
      createdAt: primary.createdAt,
      lastUsedAt: primary.lastUsedAt,
    },
  };
}

export async function revokeBiometricCredentials(req: any) {
  ensureCredentialsLoaded();

  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key.');
  }

  const idToken = extractBearerToken(req);
  const user = await verifyFirebaseIdToken(idToken, apiKey);

  const body = req?.body || {};
  const targetDeviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const targetCredentialId = typeof body.credentialId === 'string' ? body.credentialId.trim() : '';
  const { rpID } = resolveRpContext(req);

  let removedCount = 0;
  for (const [id, cred] of credentialsMap.entries()) {
    // IDOR prevention: strictly verify credential owner === authenticated Firebase uid
    if (cred.uid !== user.uid) continue;

    if (targetCredentialId && cred.credentialId === targetCredentialId) {
      credentialsMap.delete(id);
      removedCount++;
    } else if (targetDeviceId && cred.deviceId === targetDeviceId && cred.rpID === rpID) {
      credentialsMap.delete(id);
      removedCount++;
    } else if (!targetCredentialId && !targetDeviceId) {
      credentialsMap.delete(id);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    persistCredentials();
  }

  return {
    ok: true,
    removedCount,
  };
}
