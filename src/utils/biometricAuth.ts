import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type { QrAuthHandoffBundle } from '../server/qrLoginService';
import { getOrCreateDeviceId } from '../services/systemNotificationService';
import { detectCurrentDeviceMeta } from './verifiedIdentity';

export interface BiometricEnvironment {
  supported: boolean;
  platformAuthenticatorAvailable: boolean;
  isSecureContext: boolean;
  isStandalonePwa: boolean;
  isEmbeddedIframe: boolean;
  available: boolean;
  label: string;
  shortLabel: string;
  reasonUnavailable?: string;
}

export interface LocalBiometricMeta {
  credentialId: string;
  uid: string;
  displayName: string;
  emailMasked: string;
  label: string;
  rpId: string;
  quickLoginEnabled: boolean;
  appLockEnabled: boolean;
  updatedAt: string;
}

const LOCAL_BIOMETRIC_META_KEY = 'tyt_biometric_device_meta_v1';

export function getBiometricOsLabels(): { label: string; shortLabel: string } {
  if (typeof navigator === 'undefined') {
    return { label: 'Sinh trắc học thiết bị', shortLabel: 'Sinh trắc học' };
  }
  const ua = navigator.userAgent || '';
  const isIPad =
    /iPad/i.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMac = /Mac OS X|Macintosh/i.test(ua) && !isIPad;
  const isWindows = /Windows/i.test(ua);

  if (isIPhone || isIPad) {
    return { label: 'Face ID / Touch ID', shortLabel: 'Face ID / Touch ID' };
  }
  if (isMac) {
    return { label: 'Touch ID (macOS)', shortLabel: 'Touch ID' };
  }
  if (isAndroid) {
    return { label: 'Vân tay / Khuôn mặt', shortLabel: 'Vân tay / Khuôn mặt' };
  }
  if (isWindows) {
    return { label: 'Windows Hello (Khuôn mặt / Vân tay / PIN)', shortLabel: 'Windows Hello' };
  }
  return { label: 'Sinh trắc học thiết bị', shortLabel: 'Sinh trắc học' };
}

export function isPwaStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        (window.navigator as any)?.standalone === true
    );
  } catch {
    return false;
  }
}

export async function detectBiometricEnvironment(): Promise<BiometricEnvironment> {
  const { label, shortLabel } = getBiometricOsLabels();
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext === true;
  const isStandalonePwa = isPwaStandaloneMode();
  let isEmbeddedIframe = false;
  try {
    isEmbeddedIframe = typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    isEmbeddedIframe = true;
  }

  const supported =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    browserSupportsWebAuthn();

  if (!isSecureContext) {
    return {
      supported,
      platformAuthenticatorAvailable: false,
      isSecureContext,
      isStandalonePwa,
      isEmbeddedIframe,
      available: false,
      label,
      shortLabel,
      reasonUnavailable: 'Kết nối không bảo mật (cần HTTPS) nên thiết bị không cho phép dùng sinh trắc học.',
    };
  }

  if (!supported) {
    return {
      supported: false,
      platformAuthenticatorAvailable: false,
      isSecureContext,
      isStandalonePwa,
      isEmbeddedIframe,
      available: false,
      label,
      shortLabel,
      reasonUnavailable: 'Trình duyệt hoặc thiết bị hiện tại chưa hỗ trợ chuẩn WebAuthn sinh trắc học.',
    };
  }

  let platformAvailable = false;
  try {
    platformAvailable = await platformAuthenticatorIsAvailable();
  } catch {
    platformAvailable = false;
  }

  return {
    supported,
    platformAuthenticatorAvailable: platformAvailable,
    isSecureContext,
    isStandalonePwa,
    isEmbeddedIframe,
    available: platformAvailable,
    label,
    shortLabel,
    ...(platformAvailable
      ? {}
      : {
          reasonUnavailable:
            'Thiết bị này chưa bật Face ID / Touch ID / Vân tay hoặc chưa thiết lập khóa màn hình hệ thống.',
        }),
  };
}

export function getLocalBiometricMeta(): LocalBiometricMeta | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_BIOMETRIC_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalBiometricMeta>;
    if (!parsed?.credentialId || !parsed?.uid) return null;
    return {
      credentialId: String(parsed.credentialId),
      uid: String(parsed.uid),
      displayName: String(parsed.displayName || 'Thành viên'),
      emailMasked: String(parsed.emailMasked || ''),
      label: String(parsed.label || getBiometricOsLabels().shortLabel),
      rpId: String(parsed.rpId || window.location.hostname),
      quickLoginEnabled: parsed.quickLoginEnabled !== false,
      appLockEnabled: Boolean(parsed.appLockEnabled),
      updatedAt: String(parsed.updatedAt || new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function saveLocalBiometricMeta(meta: LocalBiometricMeta | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!meta) {
      window.localStorage.removeItem(LOCAL_BIOMETRIC_META_KEY);
      return;
    }
    // Only non-sensitive metadata is persisted locally; never store tokens or secrets here.
    const sanitized: LocalBiometricMeta = {
      credentialId: meta.credentialId,
      uid: meta.uid,
      displayName: meta.displayName,
      emailMasked: meta.emailMasked,
      label: meta.label,
      rpId: meta.rpId,
      quickLoginEnabled: meta.quickLoginEnabled,
      appLockEnabled: meta.appLockEnabled,
      updatedAt: meta.updatedAt || new Date().toISOString(),
    };
    window.localStorage.setItem(LOCAL_BIOMETRIC_META_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore storage errors
  }
}

export function setPwaAppLockPreference(enabled: boolean): LocalBiometricMeta | null {
  const existing = getLocalBiometricMeta();
  if (!existing) return null;
  const updated: LocalBiometricMeta = {
    ...existing,
    appLockEnabled: Boolean(enabled),
    updatedAt: new Date().toISOString(),
  };
  saveLocalBiometricMeta(updated);
  return updated;
}

export function translateBiometricError(err: any): string {
  const name = String(err?.name || '');
  const msg = String(err?.message || '').toLowerCase();

  if (
    msg.includes('publickey-credentials') ||
    msg.includes('permissions policy') ||
    msg.includes('feature policy')
  ) {
    return 'Trình duyệt đang chạy trong khung nhúng nên chặn Face ID / Touch ID. Vui lòng mở ứng dụng ở tab riêng hoặc Cài đặt App (PWA) ra Màn hình chính để kích hoạt.';
  }
  if (name === 'NotAllowedError' || msg.includes('not allowed') || msg.includes('timed out') || msg.includes('aborted')) {
    return 'Bạn đã hủy hoặc quá thời gian xác thực sinh trắc học trên thiết bị.';
  }
  if (name === 'SecurityError') {
    return 'Tên miền hiện tại chưa phù hợp để xác thực sinh trắc học. Vui lòng mở đúng địa chỉ HTTPS của hệ thống.';
  }
  if (name === 'InvalidStateError') {
    return 'Khóa sinh trắc học của thiết bị này đã được đăng ký trước đó.';
  }
  if (name === 'NotSupportedError') {
    return 'Thiết bị hoặc trình duyệt này chưa hỗ trợ phương thức xác thực sinh trắc học.';
  }
  return err?.message || 'Không thể xác thực sinh trắc học trên thiết bị này.';
}

export async function syncBiometricStatusFromServer(uid?: string): Promise<LocalBiometricMeta | null> {
  const deviceId = getOrCreateDeviceId();
  const existingLocal = getLocalBiometricMeta();
  try {
    const resp = await fetch('/api/auth/biometric/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, ...(uid ? { uid } : {}) }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      return existingLocal;
    }
    if (!data.enrolled || !data.credential?.credentialId) {
      if (existingLocal && (!uid || existingLocal.uid === uid)) {
        saveLocalBiometricMeta(null);
      }
      return null;
    }

    const synced: LocalBiometricMeta = {
      credentialId: String(data.credential.credentialId),
      uid: String(data.credential.uid),
      displayName: String(data.credential.displayName || 'Thành viên'),
      emailMasked: String(data.credential.emailMasked || ''),
      label: String(data.credential.label || getBiometricOsLabels().shortLabel),
      rpId: String(data.rpId || (typeof window !== 'undefined' ? window.location.hostname : '')),
      quickLoginEnabled: true,
      appLockEnabled: existingLocal && existingLocal.uid === data.credential.uid ? Boolean(existingLocal.appLockEnabled) : false,
      updatedAt: new Date().toISOString(),
    };
    saveLocalBiometricMeta(synced);
    return synced;
  } catch {
    return null;
  }
}

export async function enrollDeviceBiometric(params: {
  idToken: string;
  refreshToken: string;
  uid: string;
  enableAppLock?: boolean;
}): Promise<LocalBiometricMeta> {
  const env = await detectBiometricEnvironment();
  if (!env.available) {
    throw new Error(env.reasonUnavailable || 'Thiết bị này chưa hỗ trợ sinh trắc học.');
  }

  const deviceMeta = detectCurrentDeviceMeta();
  const optResp = await fetch('/api/auth/biometric/register-options', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      deviceId: deviceMeta.deviceId,
    }),
  });
  const optData = await optResp.json().catch(() => ({}));
  if (!optResp.ok || !optData?.ok || !optData?.options) {
    throw new Error(optData?.error || 'Không thể khởi tạo đăng ký sinh trắc học.');
  }

  let attestation;
  try {
    attestation = await startRegistration({ optionsJSON: optData.options });
  } catch (err: any) {
    throw new Error(translateBiometricError(err));
  }

  const verifyResp = await fetch('/api/auth/biometric/register-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      challengeId: optData.challengeId,
      deviceId: deviceMeta.deviceId,
      deviceName: deviceMeta.deviceName,
      label: env.shortLabel,
      refreshToken: params.refreshToken,
      response: attestation,
    }),
  });
  const verifyData = await verifyResp.json().catch(() => ({}));
  if (!verifyResp.ok || !verifyData?.ok || !verifyData?.credential) {
    throw new Error(verifyData?.error || 'Không thể xác nhận khóa sinh trắc học.');
  }

  const meta: LocalBiometricMeta = {
    credentialId: String(verifyData.credential.credentialId),
    uid: String(verifyData.credential.uid || params.uid),
    displayName: String(verifyData.credential.displayName || 'Thành viên'),
    emailMasked: String(verifyData.credential.emailMasked || ''),
    label: String(verifyData.credential.label || env.shortLabel),
    rpId: String(verifyData.credential.rpId || optData.rpID || window.location.hostname),
    quickLoginEnabled: true,
    appLockEnabled: Boolean(params.enableAppLock),
    updatedAt: new Date().toISOString(),
  };
  saveLocalBiometricMeta(meta);
  return meta;
}

export async function authenticateBiometricLogin(expectedUid?: string): Promise<{
  authBundle: QrAuthHandoffBundle;
  label: string;
}> {
  const env = await detectBiometricEnvironment();
  if (!env.available) {
    throw new Error(env.reasonUnavailable || 'Thiết bị chưa hỗ trợ sinh trắc học.');
  }

  const deviceId = getOrCreateDeviceId();
  const optResp = await fetch('/api/auth/biometric/login-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      mode: 'login',
      ...(expectedUid ? { uid: expectedUid } : {}),
    }),
  });
  const optData = await optResp.json().catch(() => ({}));
  if (!optResp.ok || !optData?.ok || !optData?.options) {
    if (optData?.notEnrolled) {
      saveLocalBiometricMeta(null);
    }
    throw new Error(optData?.error || 'Thiết bị chưa liên kết sinh trắc học.');
  }

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: optData.options });
  } catch (err: any) {
    throw new Error(translateBiometricError(err));
  }

  const verifyResp = await fetch('/api/auth/biometric/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: optData.challengeId,
      deviceId,
      response: assertion,
    }),
  });
  const verifyData = await verifyResp.json().catch(() => ({}));
  if (!verifyResp.ok || !verifyData?.ok || !verifyData?.authBundle) {
    if (verifyData?.credentialInvalidated) {
      saveLocalBiometricMeta(null);
    }
    throw new Error(verifyData?.error || 'Xác thực đăng nhập sinh trắc học thất bại.');
  }

  return {
    authBundle: verifyData.authBundle as QrAuthHandoffBundle,
    label: String(verifyData.label || env.shortLabel),
  };
}

function generateLocalRandomChallengeB64Url(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function verifyBiometricUnlock(params: {
  idToken: string;
  uid: string;
}): Promise<{ ok: boolean; offlineFallback?: boolean }> {
  const env = await detectBiometricEnvironment();
  if (!env.available) {
    throw new Error(env.reasonUnavailable || 'Thiết bị chưa hỗ trợ sinh trắc học.');
  }

  const deviceId = getOrCreateDeviceId();
  const localMeta = getLocalBiometricMeta();

  // Offline PWA fallback when user is already authenticated locally
  if (typeof navigator !== 'undefined' && navigator.onLine === false && localMeta?.credentialId && localMeta.uid === params.uid) {
    try {
      await startAuthentication({
        optionsJSON: {
          challenge: generateLocalRandomChallengeB64Url(),
          timeout: 60000,
          rpId: localMeta.rpId || window.location.hostname,
          allowCredentials: [
            {
              id: localMeta.credentialId,
              type: 'public-key',
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
        },
      });
      return { ok: true, offlineFallback: true };
    } catch (err: any) {
      throw new Error(translateBiometricError(err));
    }
  }

  const optResp = await fetch('/api/auth/biometric/login-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      mode: 'unlock',
      uid: params.uid,
    }),
  });
  const optData = await optResp.json().catch(() => ({}));
  if (!optResp.ok || !optData?.ok || !optData?.options) {
    throw new Error(optData?.error || 'Không tìm thấy khóa sinh trắc học trên thiết bị này.');
  }

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: optData.options });
  } catch (err: any) {
    throw new Error(translateBiometricError(err));
  }

  const verifyResp = await fetch('/api/auth/biometric/login-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      challengeId: optData.challengeId,
      deviceId,
      response: assertion,
    }),
  });
  const verifyData = await verifyResp.json().catch(() => ({}));
  if (!verifyResp.ok || !verifyData?.ok) {
    throw new Error(verifyData?.error || 'Mở khóa sinh trắc học thất bại.');
  }

  return { ok: true };
}

export async function revokeServerBiometric(params: {
  idToken: string;
  deviceId?: string;
  credentialId?: string;
}): Promise<void> {
  const currentDeviceId = getOrCreateDeviceId();
  const targetDeviceId = params.deviceId ?? currentDeviceId;

  const resp = await fetch('/api/auth/biometric/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      ...(targetDeviceId ? { deviceId: targetDeviceId } : {}),
      ...(params.credentialId ? { credentialId: params.credentialId } : {}),
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.ok) {
    throw new Error(data?.error || 'Không thể hủy kích hoạt sinh trắc học.');
  }

  if (targetDeviceId === currentDeviceId) {
    saveLocalBiometricMeta(null);
  }
}
