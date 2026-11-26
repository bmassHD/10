import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  FacebookAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  TwitterAuthProvider,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  linkWithCredential,
  linkWithPopup,
  linkWithPhoneNumber,
  updateProfile,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  multiFactor,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  MultiFactorResolver,
  MultiFactorInfo,
  PhoneMultiFactorInfo,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, collection, query, orderBy, onSnapshot, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase/config';
import {
  UserProfile,
  RoleType,
  AccountType,
  UserTotpSecurityDoc,
  UserVerifiedDevice,
  AuthProviderId,
  VipStatusInfo,
} from '../types';
import { verifyTotpToken, normalizeRecoveryCode } from '../utils/totp';
import { normalizeVietnamPhoneToE164, isValidE164Phone } from '../utils/smsMfaUtils';
import {
  buildEmailLockId,
  buildPhoneLockId,
  buildCccdLockId,
  normalizeAndValidatePhone,
  autoCompleteGmail,
  isValidEmailAddress,
  maskEmailForLock,
  maskPhoneForLock,
  maskCccdForLock,
  checkIdentifierAvailability,
  claimExclusiveIdentifierLock,
  releaseExclusiveIdentifierLock,
  detectCurrentDeviceMeta,
} from '../utils/verifiedIdentity';
import {
  BiometricEnvironment,
  LocalBiometricMeta,
  authenticateBiometricLogin,
  detectBiometricEnvironment,
  enrollDeviceBiometric,
  getLocalBiometricMeta,
  revokeServerBiometric,
  setPwaAppLockPreference,
  syncBiometricStatusFromServer,
  verifyBiometricUnlock,
} from '../utils/biometricAuth';
import {
  normalizeReferralCode,
  validateReferralCode,
  consumeReferralCodeUsage,
} from '../services/firebaseService';
import {
  isFirestoreWriteQuotaExceeded,
  markFirestoreWriteQuotaExceededIfMatch,
} from '../utils/firestoreQuotaGuard';
import { getBannedUntilMs, isUserActivelyBanned } from '../utils/userBan';
import { fetchMyVipStatus } from '../services/sepayService';

export const PRIMARY_ADMIN_EMAIL = 'sonlyhongduc@gmail.com';
export const BOOTSTRAP_ADMIN_EMAILS = [
  'sonlyhongduc@gmail.com',
  'sonlyhongduc2003@gmail.com',
  'tytvtd@gmail.com',
  'bmassk3@gmail.com',
];

const TWO_FA_SESSION_PREFIX = 'tyt_2fa_session_v1_';
const ACTIVE_SESSION_STORAGE_KEY = 'tyt_active_session_id_v1';
const ACK_CONCURRENT_STORAGE_KEY = 'tyt_ack_concurrent_v1';
const CONCURRENT_SESSION_TTL_MS = 3 * 60 * 1000;
export const REFERRAL_SESSION_KEY = 'tyt_pending_referral_code';

function generateSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateActiveSessionId(): string {
  try {
    const existing = sessionStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (existing && existing.length <= 128) return existing;
    const created = generateSessionId();
    sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return generateSessionId();
  }
}

function rotateActiveSessionId(): string {
  const next = generateSessionId();
  try {
    sessionStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, next);
    sessionStorage.removeItem(ACK_CONCURRENT_STORAGE_KEY);
  } catch {
    // ignore storage restriction
  }
  return next;
}

function readAckConcurrentKeys(): string[] {
  try {
    const raw = sessionStorage.getItem(ACK_CONCURRENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeAckConcurrentKeys(keys: string[]): void {
  try {
    sessionStorage.setItem(ACK_CONCURRENT_STORAGE_KEY, JSON.stringify(keys.slice(-30)));
  } catch {
    // ignore storage restriction
  }
}

export function getPendingReferralCode(): string {
  try {
    const raw = sessionStorage.getItem(REFERRAL_SESSION_KEY) || '';
    return normalizeReferralCode(raw);
  } catch {
    return '';
  }
}

export function setPendingReferralCode(code?: string | null): string {
  const normalized = normalizeReferralCode(code || '');
  try {
    if (normalized) {
      sessionStorage.setItem(REFERRAL_SESSION_KEY, normalized);
    } else {
      sessionStorage.removeItem(REFERRAL_SESSION_KEY);
    }
  } catch {
    // ignore storage restriction
  }
  return normalized;
}

export function clearPendingReferralCode(): void {
  try {
    sessionStorage.removeItem(REFERRAL_SESSION_KEY);
  } catch {
    // ignore storage restriction
  }
}

export function captureReferralCodeFromUrl(): string {
  try {
    const searchRef = new URLSearchParams(window.location.search).get('ref');
    if (searchRef) {
      return setPendingReferralCode(searchRef);
    }
    const hashQuery = window.location.hash.split('?')[1] || '';
    const hashRef = new URLSearchParams(hashQuery).get('ref');
    if (hashRef) {
      return setPendingReferralCode(hashRef);
    }
  } catch {
    // ignore
  }
  return getPendingReferralCode();
}

enum FirestoreOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleAuthFirestoreError(
  error: unknown,
  operationType: FirestoreOperationType,
  path: string | null
) {
  markFirestoreWriteQuotaExceededIfMatch(error);
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function buildTwoFactorSessionKey(user: User): string {
  const signInToken = user.metadata?.lastSignInTime || 'active';
  return `${TWO_FA_SESSION_PREFIX}${user.uid}_${signInToken}`;
}

function clearAllTwoFactorSessionMarkers(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(TWO_FA_SESSION_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore storage restriction
  }
}

function maskPhoneForProfile(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.includes('*') || trimmed.includes('•')) return trimmed;
  if (trimmed.length <= 6) return trimmed;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}

export function isBootstrapAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAP_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export const SYNTHETIC_ZALO_EMAIL_DOMAIN = '@zalo.tyt.local';

export function isSyntheticZaloEmail(email?: string | null): boolean {
  return (
    typeof email === 'string' &&
    email.trim().toLowerCase().endsWith(SYNTHETIC_ZALO_EMAIL_DOMAIN)
  );
}

function resolveVerificationMethodFromUser(user: User): UserVerifiedDevice['verificationMethod'] {
  if (isSyntheticZaloEmail(user.email)) return 'zalo';
  const ids = new Set((user.providerData || []).map((p) => p.providerId));
  if (ids.has('facebook.com')) return 'facebook';
  if (ids.has('google.com')) return 'google';
  if (ids.has('github.com')) return 'github';
  if (ids.has('microsoft.com')) return 'microsoft';
  if (ids.has('apple.com')) return 'apple';
  if (ids.has('twitter.com')) return 'twitter';
  if (ids.has('yahoo.com')) return 'yahoo';
  if (ids.has('phone')) return 'phone';
  if (user.isAnonymous) return 'anonymous';
  return 'password';
}

function formatFirebaseOAuthProviderError(err: any, providerLabel: string): Error {
  const code = String(err?.code || '');
  if (code === 'auth/popup-closed-by-user') {
    return new Error(`Bạn đã đóng cửa sổ đăng nhập ${providerLabel} trước khi hoàn tất.`);
  }
  if (code === 'auth/popup-blocked') {
    return new Error(
      `Trình duyệt đã chặn cửa sổ bật lên (Popup) cho ${providerLabel}. Vui lòng cho phép mở popup và thử lại.`
    );
  }
  if (code === 'auth/cancelled-popup-request') {
    return new Error(`Yêu cầu đăng nhập ${providerLabel} đã bị hủy.`);
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return new Error(
      `Email tài khoản ${providerLabel} đã được liên kết với một phương thức đăng nhập khác (ví dụ Google hoặc Email/Mật khẩu). Vui lòng đăng nhập bằng phương thức ban đầu đó.`
    );
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      `Phương thức đăng nhập ${providerLabel} chưa được bật hoặc cấu hình App ID / App Secret trên Firebase Authentication Console.`
    );
  }
  if (code === 'auth/unauthorized-domain') {
    return new Error(
      'Tên miền hiện tại chưa được cấp phép trong Firebase Authentication (Authorized domains).'
    );
  }
  if (code === 'auth/network-request-failed') {
    return new Error('Lỗi kết nối mạng. Vui lòng kiểm tra Internet và thử lại.');
  }
  return err instanceof Error ? err : new Error(String(err || `Đăng nhập ${providerLabel} thất bại.`));
}

export interface ZaloAuthProfile {
  zaloId: string;
  name: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

const ZALO_ONLY_SESSION_STORAGE_KEY = 'tyt_zalo_verified_session_v1';

interface StoredZaloOnlySession {
  profile: ZaloAuthProfile;
  token: string;
  rememberMe: boolean;
  savedAt: number;
}

function buildSafeZaloUid(zaloId: string): string {
  const safeId = String(zaloId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return `zalo_${safeId || 'user'}`;
}

function buildSyntheticZaloUser(profile: ZaloAuthProfile): User {
  const safeId = String(profile.zaloId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const uid = buildSafeZaloUid(profile.zaloId);
  const email = `zalo_${safeId}@zalo.tyt.local`;
  const nowIso = new Date().toISOString();
  const fakeUser = {
    uid,
    email,
    emailVerified: false,
    displayName: profile.name || `Người dùng Zalo ${safeId.slice(-4)}`,
    photoURL: profile.avatarUrl || null,
    phoneNumber: profile.phoneNumber || null,
    isAnonymous: false,
    tenantId: null,
    providerId: 'zalo',
    providerData: [
      {
        providerId: 'zalo',
        uid: profile.zaloId,
        displayName: profile.name || null,
        email: null,
        phoneNumber: profile.phoneNumber || null,
        photoURL: profile.avatarUrl || null,
      },
    ],
    metadata: {
      creationTime: nowIso,
      lastSignInTime: nowIso,
    },
    refreshToken: '',
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({ uid, email, displayName: profile.name }),
  };
  return fakeUser as unknown as User;
}

function buildInitialZaloOnlyUserProfile(
  profile: ZaloAuthProfile,
  existing?: Partial<UserProfile> | null
): UserProfile {
  const safeId = String(profile.zaloId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const uid = buildSafeZaloUid(profile.zaloId);
  const now = new Date().toISOString();
  const normalizedPhone = normalizeAndValidatePhone(profile.phoneNumber || '');
  return {
    ...(existing || {}),
    uid,
    email: existing?.email || `zalo_${safeId}@zalo.tyt.local`,
    displayName: profile.name || existing?.displayName || `Người dùng Zalo ${safeId.slice(-4)}`,
    phoneNumber: existing?.phoneNumber || normalizedPhone || '',
    ...(profile.avatarUrl || existing?.avatarUrl
      ? { avatarUrl: profile.avatarUrl || existing?.avatarUrl }
      : {}),
    role: existing?.role || 'user',
    accountType: existing?.accountType || 'user',
    status: existing?.status || 'active',
    hasPasswordLinked: false,
    googleLinked: false,
    zaloLinked: true,
    zaloId: profile.zaloId,
    zaloName: profile.name,
    ...(profile.avatarUrl ? { zaloAvatarUrl: profile.avatarUrl } : {}),
    emailVerified: false,
    phoneVerified: Boolean(existing?.phoneVerified || normalizedPhone),
    ...(normalizedPhone && !existing?.verifiedPhone
      ? { verifiedPhone: normalizedPhone, phoneVerifiedAt: now }
      : {}),
    twoFactorEnabled: false,
    smsMfaEnabled: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function readStoredZaloOnlySession(): StoredZaloOnlySession | null {
  try {
    const raw =
      localStorage.getItem(ZALO_ONLY_SESSION_STORAGE_KEY) ||
      sessionStorage.getItem(ZALO_ONLY_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredZaloOnlySession;
    if (!parsed?.profile?.zaloId || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredZaloOnlySession(session: StoredZaloOnlySession): void {
  try {
    localStorage.removeItem(ZALO_ONLY_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(ZALO_ONLY_SESSION_STORAGE_KEY);
    const target = session.rememberMe ? localStorage : sessionStorage;
    target.setItem(ZALO_ONLY_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage errors
  }
}

function clearStoredZaloOnlySession(): void {
  try {
    localStorage.removeItem(ZALO_ONLY_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(ZALO_ONLY_SESSION_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
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

export type SignInResultStatus = 'signed_in' | 'mfa_required';

export interface PhoneVerificationSession {
  mode: 'mfa' | 'phone_link';
  normalizedPhone: string;
  verificationId?: string;
  confirmationResult?: ConfirmationResult;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  activeRole: RoleType;
  activeAccountType: AccountType;
  isAdmin: boolean;
  isStaff: boolean;
  isCitizen: boolean;
  isPrimaryAdmin: boolean;
  isSuperAdmin: boolean;
  isBanned: boolean;
  hasPasswordProvider: boolean;
  hasGoogleProvider: boolean;
  hasFacebookProvider: boolean;
  hasZaloProvider: boolean;
  totpConfig: UserTotpSecurityDoc | null;
  twoFactorEnabled: boolean;
  twoFactorVerifiedThisSession: boolean;
  twoFactorLoading: boolean;
  requiresTwoFactorVerification: boolean;
  enrolledSmsFactors: PhoneMultiFactorInfo[];
  smsMfaEnabled: boolean;
  pendingSmsMfaResolver: MultiFactorResolver | null;
  verifiedDevices: UserVerifiedDevice[];
  currentDeviceId: string;
  currentDeviceTrusted: boolean;
  currentSessionId: string;
  concurrentActiveDevices: UserVerifiedDevice[];
  remoteRevokedNotice: boolean;
  dismissConcurrentLoginAlert: (devices?: UserVerifiedDevice[]) => Promise<void>;
  approveTrustedDevice: (deviceId: string) => Promise<void>;
  revokeConcurrentDeviceSession: (targetDevice: UserVerifiedDevice) => Promise<void>;
  clearRemoteRevokedNotice: () => void;
  clearPendingSmsMfaResolver: () => void;
  sendVerificationEmailToCurrentUser: () => Promise<void>;
  refreshCurrentUserState: () => Promise<void>;
  linkGoogleAccount: () => Promise<void>;
  linkZaloAccount: () => Promise<ZaloAuthProfile>;
  sendPhoneVerificationOtp: (
    rawPhone: string,
    passwordForReauth?: string
  ) => Promise<PhoneVerificationSession>;
  confirmPhoneVerificationOtp: (
    session: PhoneVerificationSession,
    smsCode: string
  ) => Promise<void>;
  confirmAndLockPhoneNumber: (rawPhone: string) => Promise<string>;
  verifyAndLockCitizenId: (
    rawCitizenId: string,
    verifiedDatabaseFields?: Partial<UserProfile>
  ) => Promise<void>;
  registerOrVerifyCurrentDevice: (
    method?: UserVerifiedDevice['verificationMethod'],
    customName?: string
  ) => Promise<void>;
  renameVerifiedDevice: (deviceId: string, newName: string) => Promise<void>;
  removeVerifiedDevice: (deviceId: string) => Promise<void>;
  sendSmsMfaEnrollmentCode: (
    rawPhone: string,
    recaptchaContainer?: HTMLElement | null,
    passwordForReauth?: string
  ) => Promise<{ verificationId: string; normalizedPhone: string }>;
  confirmSmsMfaEnrollment: (
    verificationId: string,
    smsCode: string,
    displayName?: string,
    normalizedPhone?: string
  ) => Promise<void>;
  unenrollSmsMfaFactor: (
    factorOrUid: MultiFactorInfo | string,
    passwordForReauth?: string
  ) => Promise<void>;
  sendSmsMfaSignInCode: (hintIndex: number, recaptchaContainer?: HTMLElement | null) => Promise<string>;
  resolveSmsMfaSignIn: (verificationId: string, smsCode: string) => Promise<void>;
  signInWithGoogle: () => Promise<SignInResultStatus>;
  signInWithFacebook: () => Promise<SignInResultStatus>;
  signInWithZalo: (rememberMe?: boolean) => Promise<SignInResultStatus>;
  signInWithProviderMethod: (
    providerId: AuthProviderId,
    options?: { rememberMe?: boolean }
  ) => Promise<SignInResultStatus>;
  signInWithQrHandoff: (bundle: QrAuthHandoffBundle) => Promise<void>;
  signInWithBiometric: () => Promise<void>;
  biometricEnvironment: BiometricEnvironment | null;
  biometricMeta: LocalBiometricMeta | null;
  activateDeviceBiometric: (options?: { enableAppLock?: boolean }) => Promise<LocalBiometricMeta>;
  deactivateDeviceBiometric: () => Promise<void>;
  updateBiometricAppLock: (enabled: boolean) => void;
  verifyBiometricUnlockForPwa: () => Promise<{ ok: boolean; offlineFallback?: boolean }>;
  refreshBiometricStatus: () => Promise<void>;
  loginWithEmail: (email: string, pass: string, rememberMe?: boolean) => Promise<SignInResultStatus>;
  sendPasswordReset: (email?: string) => Promise<void>;
  registerWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    phone?: string,
    referralCode?: string,
    organizationData?: {
      isOrganization?: boolean;
      organizationName?: string;
      organizationType?: 'clinic' | 'pharmacy' | 'school' | 'enterprise' | 'agency' | 'other';
      taxCode?: string;
      organizationAddress?: string;
      organizationPhone?: string;
    }
  ) => Promise<void>;
  logout: () => Promise<void>;
  switchPreviewRole: (role: RoleType, accountType: AccountType) => void;
  resetRoleToActual: () => void;
  isSimulatingRole: boolean;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  linkEmailPassword: (newPassword: string) => Promise<void>;
  changeAccountPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  verifyAccountPassword: (passwordToVerify: string) => Promise<boolean>;
  verifySessionTwoFactorOtp: (
    codeOrRecovery: string
  ) => Promise<{ ok: boolean; usedRecoveryCode?: boolean; error?: string }>;
  enableTwoFactorAuth: (
    secret: string,
    verificationCode: string,
    recoveryCodes: string[],
    issuer?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  disableTwoFactorAuth: (options?: {
    verificationCode?: string;
    password?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulatedRole, setSimulatedRole] = useState<{ role: RoleType; accountType: AccountType } | null>(null);
  const [providerTick, setProviderTick] = useState<number>(0);
  const [banNowTick, setBanNowTick] = useState<number>(() => Date.now());

  // 2FA & SMS MFA states
  const [totpConfig, setTotpConfig] = useState<UserTotpSecurityDoc | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState<boolean>(false);
  const [twoFactorVerifiedThisSession, setTwoFactorVerifiedThisSession] = useState<boolean>(false);
  const [pendingSmsMfaResolver, setPendingSmsMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [verifiedDevices, setVerifiedDevices] = useState<UserVerifiedDevice[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => getOrCreateActiveSessionId());
  const [sessionStartedAtIso, setSessionStartedAtIso] = useState<string>(() => new Date().toISOString());
  const [sessionNowTick, setSessionNowTick] = useState<number>(() => Date.now());
  const [acknowledgedSessionKeys, setAcknowledgedSessionKeys] = useState<string[]>(() => readAckConcurrentKeys());
  const [remoteRevokedNotice, setRemoteRevokedNotice] = useState<boolean>(false);
  const currentDeviceMeta = useRef(detectCurrentDeviceMeta());
  const verifiedDevicesRef = useRef<UserVerifiedDevice[]>([]);
  const currentSessionIdRef = useRef<string>(currentSessionId);
  const sessionStartedAtRef = useRef<string>(sessionStartedAtIso);
  const lastHeartbeatWriteMsRef = useRef<number>(0);
  const remoteRevokeInProgressRef = useRef<boolean>(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaSlotRef = useRef<HTMLDivElement | null>(null);
  const pendingZaloProfileRef = useRef<ZaloAuthProfile | null>(null);
  const zaloOnlySessionRef = useRef<StoredZaloOnlySession | null>(readStoredZaloOnlySession());
  const [isZaloOnlySession, setIsZaloOnlySession] = useState<boolean>(() =>
    Boolean(readStoredZaloOnlySession())
  );
  const pendingQrDeviceMethodRef = useRef<boolean>(false);
  const pendingBiometricDeviceMethodRef = useRef<boolean>(false);
  const [biometricEnvironment, setBiometricEnvironment] = useState<BiometricEnvironment | null>(null);
  const [biometricMeta, setBiometricMeta] = useState<LocalBiometricMeta | null>(() => getLocalBiometricMeta());

  useEffect(() => {
    let active = true;
    void detectBiometricEnvironment().then((env) => {
      if (active) setBiometricEnvironment(env);
    });
    void syncBiometricStatusFromServer().then((synced) => {
      if (active) setBiometricMeta(synced);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    verifiedDevicesRef.current = verifiedDevices;
  }, [verifiedDevices]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    sessionStartedAtRef.current = sessionStartedAtIso;
  }, [sessionStartedAtIso]);

  const getOrCreatePersistentRecaptchaHost = useCallback((): HTMLElement => {
    const HOST_ID = 'tyt-firebase-recaptcha-host';
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.style.position = 'fixed';
      host.style.bottom = '0px';
      host.style.right = '0px';
      host.style.zIndex = '2147483000';
      document.body.appendChild(host);
    }
    return host;
  }, []);

  const clearSmsRecaptchaVerifier = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore cleanup error
      }
      recaptchaVerifierRef.current = null;
    }
    const oldSlot = recaptchaSlotRef.current;
    recaptchaSlotRef.current = null;
    if (oldSlot) {
      // Hide visually while keeping layout box intact until async Google reCAPTCHA timers settle
      oldSlot.style.visibility = 'hidden';
      oldSlot.style.pointerEvents = 'none';
      oldSlot.style.opacity = '0';
      window.setTimeout(() => {
        try {
          oldSlot.remove();
        } catch {
          // ignore
        }
      }, 45_000);
    }
  }, []);

  const createFreshRecaptchaVerifier = useCallback(
    (_preferredContainer?: HTMLElement | null): {
      verifier: RecaptchaVerifier;
      errorPromise: Promise<never>;
    } => {
      clearSmsRecaptchaVerifier();
      const host = getOrCreatePersistentRecaptchaHost();
      const mountEl = document.createElement('div');
      host.appendChild(mountEl);
      recaptchaSlotRef.current = mountEl;

      let rejectErrorPromise: ((err: Error) => void) | null = null;
      const errorPromise = new Promise<never>((_resolve, reject) => {
        rejectErrorPromise = reject;
      });

      auth.languageCode = 'vi';
      const verifier = new RecaptchaVerifier(auth, mountEl, {
        size: 'invisible',
        'expired-callback': () => {
          window.setTimeout(() => clearSmsRecaptchaVerifier(), 0);
        },
        'error-callback': (rawErr?: unknown) => {
          const err = new Error('auth/captcha-check-failed');
          (err as any).code = 'auth/captcha-check-failed';
          (err as any).cause = rawErr;
          rejectErrorPromise?.(err);
          window.setTimeout(() => clearSmsRecaptchaVerifier(), 0);
        },
      });
      recaptchaVerifierRef.current = verifier;
      return { verifier, errorPromise };
    },
    [clearSmsRecaptchaVerifier, getOrCreatePersistentRecaptchaHost]
  );

  const runVerifyPhoneWithSafety = useCallback(
    async (
      runVerify: (verifier: RecaptchaVerifier) => Promise<string>,
      preferredContainer?: HTMLElement | null
    ): Promise<string> => {
      const { verifier, errorPromise } = createFreshRecaptchaVerifier(preferredContainer);
      let timeoutId: number | undefined;
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = window.setTimeout(() => {
          const err = new Error('auth/network-request-failed');
          (err as any).code = 'auth/network-request-failed';
          reject(err);
        }, 45_000);
      });

      try {
        auth.languageCode = 'vi';
        const verificationId = await Promise.race([
          runVerify(verifier),
          errorPromise,
          timeoutPromise,
        ]);
        return verificationId;
      } catch (err) {
        clearSmsRecaptchaVerifier();
        throw err;
      } finally {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      }
    },
    [clearSmsRecaptchaVerifier, createFreshRecaptchaVerifier]
  );

  const clearPendingSmsMfaResolver = useCallback(() => {
    clearSmsRecaptchaVerifier();
    setPendingSmsMfaResolver(null);
  }, [clearSmsRecaptchaVerifier]);

  const markSessionTwoFactorVerified = useCallback((user: User) => {
    try {
      sessionStorage.setItem(buildTwoFactorSessionKey(user), 'verified');
    } catch {
      // ignore storage restriction
    }
    setTwoFactorVerifiedThisSession(true);
  }, []);

  const upsertCurrentDeviceDoc = useCallback(
    async (
      uid: string,
      method: UserVerifiedDevice['verificationMethod'],
      customName?: string,
      forceTrust = false,
      biometricEnabledOverride?: boolean
    ) => {
      const meta = currentDeviceMeta.current;
      const now = new Date().toISOString();
      const devicePath = `users/${uid}/devices/${meta.deviceId}`;
      const existing = verifiedDevicesRef.current.find((d) => d.deviceId === meta.deviceId);
      let resolvedTrusted = forceTrust ? true : Boolean(existing?.isTrusted);
      if (!forceTrust && !existing) {
        try {
          const curSnap = await getDoc(doc(db, 'users', uid, 'devices', meta.deviceId));
          if (curSnap.exists()) {
            resolvedTrusted = Boolean((curSnap.data() as UserVerifiedDevice)?.isTrusted);
          } else {
            const allSnap = await getDocs(collection(db, 'users', uid, 'devices'));
            resolvedTrusted = allSnap.empty;
          }
        } catch {
          resolvedTrusted = false;
        }
      }
      const localBio = getLocalBiometricMeta();
      const resolvedBiometricEnabled =
        typeof biometricEnabledOverride === 'boolean'
          ? biometricEnabledOverride
          : Boolean(existing?.biometricEnabled ?? (localBio?.uid === uid));
      const payload: UserVerifiedDevice = {
        deviceId: meta.deviceId,
        deviceName: (customName || existing?.deviceName || meta.deviceName).slice(0, 128),
        platform: meta.platform,
        os: meta.os,
        browser: meta.browser,
        isTrusted: resolvedTrusted,
        verificationMethod: method || existing?.verificationMethod || 'password',
        biometricEnabled: resolvedBiometricEnabled,
        verifiedAt: existing?.verifiedAt || now,
        firstSeenAt: existing?.firstSeenAt || now,
        lastActiveAt: now,
        activeSessionId: currentSessionIdRef.current,
        isSessionActive: true,
        sessionStartedAt: sessionStartedAtRef.current || now,
        lastHeartbeatAt: now,
        lastHeartbeatMs: Date.now(),
        forceLogoutSessionId: '',
        forceLogoutRequestedAt: '',
      };
      try {
        await setDoc(doc(db, 'users', uid, 'devices', meta.deviceId), payload, { merge: true });
        lastHeartbeatWriteMsRef.current = Date.now();
      } catch (err) {
        handleAuthFirestoreError(err, FirestoreOperationType.WRITE, devicePath);
      }
    },
    []
  );

  const syncedLockCacheRef = useRef<string>('');

  const syncVerifiedIdentityLocks = useCallback(
    async (user: User, profile?: UserProfile | null, force = false) => {
      if (isFirestoreWriteQuotaExceeded()) return;
      const now = new Date().toISOString();
      const hasGoogle = Boolean(user.providerData?.some((p) => p.providerId === 'google.com'));
      const googleProviderEmail =
        user.providerData?.find((p) => p.providerId === 'google.com')?.email || '';
      const realAuthEmail =
        (!isSyntheticZaloEmail(user.email) ? user.email || '' : '') || googleProviderEmail;
      const emailIsVerified = Boolean(realAuthEmail && (user.emailVerified || hasGoogle));
      const smsFactors = multiFactor(user).enrolledFactors.filter(
        (f): f is PhoneMultiFactorInfo => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      );
      const authPhone = smsFactors[0]?.phoneNumber || user.phoneNumber || '';

      const lockSig = [
        user.uid,
        emailIsVerified ? realAuthEmail.toLowerCase() : '',
        authPhone,
        Boolean(profile?.googleLinked),
        Boolean(profile?.emailVerified),
        Boolean(profile?.phoneVerified),
      ].join('|');

      const storageKey = `tyt_id_lock_sig_${user.uid}`;
      if (!force) {
        if (syncedLockCacheRef.current === lockSig) return;
        try {
          if (
            localStorage.getItem(storageKey) === lockSig &&
            (!emailIsVerified || Boolean(profile?.emailVerified)) &&
            (!authPhone || Boolean(profile?.phoneVerified)) &&
            (!hasGoogle || Boolean(profile?.googleLinked))
          ) {
            syncedLockCacheRef.current = lockSig;
            return;
          }
        } catch {
          // ignore storage errors
        }
      }
      syncedLockCacheRef.current = lockSig;

      const updates: Partial<UserProfile> = {};
      if (hasGoogle && !profile?.googleLinked) {
        updates.googleLinked = true;
      }
      if (googleProviderEmail && isSyntheticZaloEmail(profile?.email)) {
        updates.email = googleProviderEmail;
      }
      if (emailIsVerified && realAuthEmail) {
        const emailLockId = await buildEmailLockId(realAuthEmail);
        if (emailLockId) {
          await claimExclusiveIdentifierLock({
            lockId: emailLockId,
            type: 'email',
            valueMasked: maskEmailForLock(realAuthEmail),
            ownerUid: user.uid,
          }).catch((err) => {
            markFirestoreWriteQuotaExceededIfMatch(err);
          });
        }
        if (!profile?.emailVerified) {
          updates.emailVerified = true;
          updates.emailVerifiedAt = now;
        }
      }
      const profilePhone =
        profile?.verifiedPhone ||
        profile?.phoneNumber ||
        '';
      const candidatePhone =
        authPhone && !authPhone.includes('*') && !authPhone.includes('•')
          ? authPhone
          : profilePhone && !profilePhone.includes('*') && !profilePhone.includes('•')
          ? profilePhone
          : '';
      if (candidatePhone) {
        const normalized = normalizeAndValidatePhone(candidatePhone);
        const phoneLockId = buildPhoneLockId(normalized || candidatePhone);
        let lockClaimed = false;
        if (phoneLockId && normalized) {
          const lockRes = await claimExclusiveIdentifierLock({
            lockId: phoneLockId,
            type: 'phone',
            valueMasked: maskPhoneForLock(normalized),
            ownerUid: user.uid,
          }).catch((err) => {
            markFirestoreWriteQuotaExceededIfMatch(err);
            return { ok: false };
          });
          lockClaimed = Boolean(lockRes?.ok);
        }
        if ((authPhone || lockClaimed) && !profile?.phoneVerified && normalized) {
          updates.phoneVerified = true;
          updates.verifiedPhone = normalized;
          updates.phoneNumber = normalized;
          updates.phoneVerifiedAt = now;
        }
      }
      if (Object.keys(updates).length > 0 && !isFirestoreWriteQuotaExceeded()) {
        try {
          await setDoc(doc(db, 'users', user.uid), { ...updates, updatedAt: now }, { merge: true });
        } catch (err) {
          markFirestoreWriteQuotaExceededIfMatch(err);
        }
      }
      if (!isFirestoreWriteQuotaExceeded()) {
        try {
          localStorage.setItem(storageKey, lockSig);
        } catch {
          // ignore
        }
      }
    },
    []
  );

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubTotp: (() => void) | null = null;
    let unsubDevices: (() => void) | null = null;
    let syncedAdminUid = '';
    let creatingProfileForUid = '';
    let recordedSessionDeviceKey = '';

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubTotp) {
        unsubTotp();
        unsubTotp = null;
      }
      if (unsubDevices) {
        unsubDevices();
        unsubDevices = null;
      }

      setCurrentUser(user);
      setProviderTick((t) => t + 1);
      void syncBiometricStatusFromServer(user?.uid).then((synced) => {
        setBiometricMeta(synced);
      });

      if (!user) {
        const storedZalo = zaloOnlySessionRef.current || readStoredZaloOnlySession();
        if (storedZalo?.profile?.zaloId) {
          zaloOnlySessionRef.current = storedZalo;
          setIsZaloOnlySession(true);
          setCurrentUser(buildSyntheticZaloUser(storedZalo.profile));
          setUserProfile(buildInitialZaloOnlyUserProfile(storedZalo.profile));
          setTotpConfig(null);
          setVerifiedDevices([]);
          setTwoFactorLoading(false);
          setTwoFactorVerifiedThisSession(false);
          setLoading(false);

          // Verify server-side session token if available (non-blocking)
          void fetch('/api/auth/zalo/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ zaloSessionToken: storedZalo.token }),
          })
            .then((r) => r.json().catch(() => null))
            .then((data) => {
              if (auth.currentUser) return;
              if (data?.authenticated && data?.zaloProfile?.zaloId) {
                const refreshed: StoredZaloOnlySession = {
                  ...storedZalo,
                  profile: data.zaloProfile,
                  token: data.zaloSessionToken || storedZalo.token,
                };
                zaloOnlySessionRef.current = refreshed;
                writeStoredZaloOnlySession(refreshed);
                setCurrentUser(buildSyntheticZaloUser(refreshed.profile));
                setUserProfile((prev) => buildInitialZaloOnlyUserProfile(refreshed.profile, prev));
              }
            })
            .catch(() => {
              // keep local verified Zalo session offline
            });
          return;
        }

        // Also check HttpOnly Zalo session cookie in case storage was cleared
        setIsZaloOnlySession(false);
        setUserProfile(null);
        setTotpConfig(null);
        setVerifiedDevices([]);
        setTwoFactorLoading(false);
        setTwoFactorVerifiedThisSession(false);
        void fetch('/api/auth/zalo/session', {
          method: 'GET',
          credentials: 'include',
        })
          .then((r) => r.json().catch(() => null))
          .then((data) => {
            if (auth.currentUser) return;
            if (data?.authenticated && data?.zaloProfile?.zaloId && data?.zaloSessionToken) {
              const restored: StoredZaloOnlySession = {
                profile: data.zaloProfile,
                token: data.zaloSessionToken,
                rememberMe: true,
                savedAt: Date.now(),
              };
              zaloOnlySessionRef.current = restored;
              writeStoredZaloOnlySession(restored);
              setIsZaloOnlySession(true);
              setCurrentUser(buildSyntheticZaloUser(restored.profile));
              setUserProfile(buildInitialZaloOnlyUserProfile(restored.profile));
            }
          })
          .catch(() => {
            // ignore network error
          })
          .finally(() => {
            setLoading(false);
          });
        return;
      }

      zaloOnlySessionRef.current = null;
      clearStoredZaloOnlySession();
      setIsZaloOnlySession(false);

      // Check session verification state for this login session
      let isVerifiedInSession = false;
      try {
        isVerifiedInSession = sessionStorage.getItem(buildTwoFactorSessionKey(user)) === 'verified';
      } catch {
        isVerifiedInSession = false;
      }
      setTwoFactorVerifiedThisSession(isVerifiedInSession);
      setTwoFactorLoading(true);

      // Subscribe to owner's verified devices
      const devicesPath = `users/${user.uid}/devices`;
      const devicesQuery = query(
        collection(db, 'users', user.uid, 'devices'),
        orderBy('lastActiveAt', 'desc')
      );
      unsubDevices = onSnapshot(
        devicesQuery,
        (snap) => {
          const list = snap.docs.map((d) => d.data() as UserVerifiedDevice);
          setVerifiedDevices(list);
        },
        (err) => {
          console.warn('Devices snapshot fallback:', err?.message);
          if (String(err?.message || '').toLowerCase().includes('permission')) {
            try {
              handleAuthFirestoreError(err, FirestoreOperationType.LIST, devicesPath);
            } catch {
              // logged
            }
          }
        }
      );

      // Record current device & active session presence immediately for concurrent login detection
      const sessionKey = `${user.uid}_${user.metadata?.lastSignInTime || 'active'}`;
      if (recordedSessionDeviceKey !== sessionKey && !isFirestoreWriteQuotaExceeded()) {
        recordedSessionDeviceKey = sessionKey;
        const meta = currentDeviceMeta.current;
        const hasZalo = Boolean(
          isSyntheticZaloEmail(user.email) || pendingZaloProfileRef.current
        );
        const isQrLogin = pendingQrDeviceMethodRef.current;
        if (isQrLogin) {
          pendingQrDeviceMethodRef.current = false;
        }
        const isBiometricLogin = pendingBiometricDeviceMethodRef.current;
        if (isBiometricLogin) {
          pendingBiometricDeviceMethodRef.current = false;
        }
        const method: UserVerifiedDevice['verificationMethod'] = isBiometricLogin
          ? 'biometric'
          : isQrLogin
          ? 'qr'
          : hasZalo
          ? 'zalo'
          : resolveVerificationMethodFromUser(user);
        const deviceSyncKey = `tyt_device_sync_${user.uid}_${meta.deviceId}`;
        let hasRecordedDeviceBefore = false;
        try {
          if (localStorage.getItem(deviceSyncKey)) {
            hasRecordedDeviceBefore = true;
          }
        } catch {
          // ignore storage errors
        }

        const now = new Date().toISOString();
        const existingDev = verifiedDevicesRef.current.find((d) => d.deviceId === meta.deviceId);
        const localBio = getLocalBiometricMeta();
        void (async () => {
          let resolvedTrusted = Boolean(existingDev?.isTrusted);
          if (!existingDev) {
            if (isQrLogin || isBiometricLogin) {
              resolvedTrusted = true;
            } else {
              try {
                const curSnap = await getDoc(doc(db, 'users', user.uid, 'devices', meta.deviceId));
                if (curSnap.exists()) {
                  resolvedTrusted = Boolean((curSnap.data() as UserVerifiedDevice)?.isTrusted);
                } else {
                  const allSnap = await getDocs(collection(db, 'users', user.uid, 'devices'));
                  resolvedTrusted = allSnap.empty;
                }
              } catch {
                resolvedTrusted = false;
              }
            }
          }
          const devicePayload: UserVerifiedDevice = {
            deviceId: meta.deviceId,
            deviceName: (existingDev?.deviceName || meta.deviceName).slice(0, 128),
            platform: meta.platform,
            os: meta.os,
            browser: meta.browser,
            isTrusted: resolvedTrusted,
            verificationMethod: isBiometricLogin
              ? 'biometric'
              : isQrLogin
              ? 'qr'
              : existingDev?.verificationMethod || method,
            biometricEnabled: Boolean(
              isBiometricLogin || existingDev?.biometricEnabled || localBio?.uid === user.uid
            ),
            verifiedAt: existingDev?.verifiedAt || now,
            firstSeenAt: existingDev?.firstSeenAt || (hasRecordedDeviceBefore ? now : now),
            lastActiveAt: now,
            activeSessionId: currentSessionIdRef.current,
            isSessionActive: true,
            sessionStartedAt: sessionStartedAtRef.current || now,
            lastHeartbeatAt: now,
            lastHeartbeatMs: Date.now(),
            forceLogoutSessionId: '',
            forceLogoutRequestedAt: '',
          };
          try {
            await setDoc(doc(db, 'users', user.uid, 'devices', meta.deviceId), devicePayload, {
              merge: true,
            });
            lastHeartbeatWriteMsRef.current = Date.now();
            try {
              localStorage.setItem(deviceSyncKey, JSON.stringify({ ts: Date.now(), method }));
            } catch {
              // ignore
            }
          } catch (err) {
            markFirestoreWriteQuotaExceededIfMatch(err);
          }
        })();
      }

      // Subscribe to strictly isolated owner-only TOTP security document
      const totpPath = `users/${user.uid}/security/totp`;
      const totpDocRef = doc(db, 'users', user.uid, 'security', 'totp');
      unsubTotp = onSnapshot(
        totpDocRef,
        (totpSnap) => {
          if (totpSnap.exists()) {
            setTotpConfig(totpSnap.data() as UserTotpSecurityDoc);
          } else {
            setTotpConfig(null);
          }
          setTwoFactorLoading(false);
        },
        (err) => {
          console.warn('TOTP security snapshot fallback:', err?.message);
          setTotpConfig(null);
          setTwoFactorLoading(false);
          if (String(err?.message || '').toLowerCase().includes('permission')) {
            try {
              handleAuthFirestoreError(err, FirestoreOperationType.GET, totpPath);
            } catch {
              // logged cleanly
            }
          }
        }
      );

      const isTargetAdmin = isBootstrapAdminEmail(user.email);
      const userIsSyntheticZalo = isSyntheticZaloEmail(user.email);
      const userHasPassword = Boolean(
        user.providerData?.some((p) => p.providerId === 'password') && !userIsSyntheticZalo
      );
      const userHasGoogle = Boolean(user.providerData?.some((p) => p.providerId === 'google.com'));
      const userHasFacebook = Boolean(
        user.providerData?.some((p) => p.providerId === 'facebook.com')
      );
      const googleProviderEmail =
        user.providerData?.find((p) => p.providerId === 'google.com')?.email || '';
      const userSmsFactors = multiFactor(user).enrolledFactors.filter(
        (f): f is PhoneMultiFactorInfo => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      );
      const userHasSmsMfa = userSmsFactors.length > 0;
      const firstSmsMasked = userSmsFactors[0] ? maskPhoneForProfile(userSmsFactors[0].phoneNumber) : '';
      const userDocRef = doc(db, 'users', user.uid);

      unsubProfile = onSnapshot(
        userDocRef,
        async (snap) => {
          try {
            const pendingZalo = pendingZaloProfileRef.current;
            if (snap.exists()) {
              const profile = { uid: snap.id, ...snap.data() } as UserProfile;
              let changed = false;
              if (isTargetAdmin && profile.role !== 'super_admin') {
                profile.role = 'super_admin';
                profile.accountType = 'admin';
                changed = true;
              }
              if (pendingZalo) {
                if (!profile.zaloLinked) {
                  profile.zaloLinked = true;
                  changed = true;
                }
                if (pendingZalo.zaloId && profile.zaloId !== pendingZalo.zaloId) {
                  profile.zaloId = pendingZalo.zaloId;
                  changed = true;
                }
                if (pendingZalo.name && profile.zaloName !== pendingZalo.name) {
                  profile.zaloName = pendingZalo.name;
                  if (
                    !profile.displayName ||
                    profile.displayName === 'Người dùng' ||
                    profile.displayName.startsWith('zalo_')
                  ) {
                    profile.displayName = pendingZalo.name;
                  }
                  changed = true;
                }
                if (pendingZalo.avatarUrl && profile.zaloAvatarUrl !== pendingZalo.avatarUrl) {
                  profile.zaloAvatarUrl = pendingZalo.avatarUrl;
                  if (!profile.avatarUrl) {
                    profile.avatarUrl = pendingZalo.avatarUrl;
                  }
                  changed = true;
                }
                if (pendingZalo.phoneNumber && !profile.phoneNumber) {
                  profile.phoneNumber = pendingZalo.phoneNumber;
                  changed = true;
                }
              }
              if (!profile.avatarUrl && user.photoURL) {
                profile.avatarUrl = user.photoURL;
                changed = true;
              }
              if (userHasPassword && !profile.hasPasswordLinked) {
                profile.hasPasswordLinked = true;
                changed = true;
              }
              if (userIsSyntheticZalo && profile.hasPasswordLinked && !userHasPassword) {
                profile.hasPasswordLinked = false;
                changed = true;
              }
              if (userHasGoogle && !profile.googleLinked) {
                profile.googleLinked = true;
                changed = true;
              }
              if (userHasFacebook && !profile.facebookLinked) {
                profile.facebookLinked = true;
                changed = true;
              }
              if (googleProviderEmail && isSyntheticZaloEmail(profile.email)) {
                profile.email = googleProviderEmail;
                changed = true;
              }
              if ((!userIsSyntheticZalo && (user.emailVerified || userHasGoogle)) || (userHasGoogle && googleProviderEmail)) {
                if (!profile.emailVerified) {
                  profile.emailVerified = true;
                  profile.emailVerifiedAt = new Date().toISOString();
                  changed = true;
                }
              }
              if ((user.phoneNumber || userHasSmsMfa) && !profile.phoneVerified) {
                profile.phoneVerified = true;
                profile.phoneVerifiedAt = profile.phoneVerifiedAt || new Date().toISOString();
                if (!profile.verifiedPhone && (user.phoneNumber || userSmsFactors[0]?.phoneNumber)) {
                  profile.verifiedPhone = user.phoneNumber || userSmsFactors[0]?.phoneNumber || '';
                }
                changed = true;
              }
              if (Boolean(profile.smsMfaEnabled) !== userHasSmsMfa) {
                profile.smsMfaEnabled = userHasSmsMfa;
                profile.smsMfaPhoneMasked = firstSmsMasked;
                changed = true;
              } else if (userHasSmsMfa && firstSmsMasked && profile.smsMfaPhoneMasked !== firstSmsMasked) {
                profile.smsMfaPhoneMasked = firstSmsMasked;
                changed = true;
              }
              const profileIsBanned = !isTargetAdmin && isUserActivelyBanned(profile);
              if (changed && !profileIsBanned && !isFirestoreWriteQuotaExceeded()) {
                try {
                  await setDoc(userDocRef, profile, { merge: true });
                } catch (writeErr) {
                  markFirestoreWriteQuotaExceededIfMatch(writeErr);
                }
              }
              if (!profileIsBanned) {
                void syncVerifiedIdentityLocks(user, profile);
              }
              if (isTargetAdmin && syncedAdminUid !== user.uid && !isFirestoreWriteQuotaExceeded()) {
                syncedAdminUid = user.uid;
                const adminSyncKey = `tyt_admin_doc_synced_${user.uid}`;
                let adminRecentlySynced = false;
                try {
                  const lastTs = Number(localStorage.getItem(adminSyncKey) || 0);
                  adminRecentlySynced = Boolean(lastTs && Date.now() - lastTs < 24 * 60 * 60 * 1000);
                } catch {
                  // ignore
                }
                if (!adminRecentlySynced) {
                  try {
                    await setDoc(
                      doc(db, 'admins', user.uid),
                      {
                        uid: user.uid,
                        email: user.email,
                        role: 'super_admin',
                        updatedAt: new Date().toISOString(),
                      },
                      { merge: true }
                    );
                    try {
                      localStorage.setItem(adminSyncKey, String(Date.now()));
                    } catch {
                      // ignore
                    }
                  } catch (adminDocErr) {
                    markFirestoreWriteQuotaExceededIfMatch(adminDocErr);
                    console.warn('Sync admin record error:', adminDocErr);
                  }
                }
              }
              setUserProfile(profile);
              setLoading(false);
            } else if (creatingProfileForUid !== user.uid) {
              creatingProfileForUid = user.uid;
              const now = new Date().toISOString();
              const resolvedVerifiedPhone = user.phoneNumber || userSmsFactors[0]?.phoneNumber || '';
              const zaloPhoneCandidate = normalizeAndValidatePhone(pendingZalo?.phoneNumber || '');
              let zaloPhoneClaimed = false;
              if (!resolvedVerifiedPhone && zaloPhoneCandidate) {
                const phoneLockId = buildPhoneLockId(zaloPhoneCandidate);
                if (phoneLockId) {
                  const lockRes = await claimExclusiveIdentifierLock({
                    lockId: phoneLockId,
                    type: 'phone',
                    valueMasked: maskPhoneForLock(zaloPhoneCandidate),
                    ownerUid: user.uid,
                  }).catch(() => ({ ok: false }));
                  zaloPhoneClaimed = Boolean(lockRes?.ok);
                }
              }

              let resolvedRole: RoleType = isTargetAdmin ? 'super_admin' : 'user';
              let resolvedAccountType: AccountType = isTargetAdmin ? 'admin' : 'user';
              let usedReferralCode = '';
              if (!isTargetAdmin) {
                const pendingRef = getPendingReferralCode();
                if (pendingRef) {
                  const roleCheck = await validateReferralCode(pendingRef);
                  if (roleCheck.valid && roleCheck.item) {
                    resolvedRole = roleCheck.item.targetRole || 'user';
                    resolvedAccountType = roleCheck.item.targetAccountType || resolvedRole;
                    usedReferralCode = roleCheck.item.code;
                  }
                }
              }

              const effectiveEmail =
                googleProviderEmail || (!userIsSyntheticZalo ? user.email || '' : '') || '';
              const finalVerifiedPhone = resolvedVerifiedPhone || (zaloPhoneClaimed ? zaloPhoneCandidate : '');

              const newProfile: UserProfile = {
                uid: user.uid,
                email: effectiveEmail || user.email || '',
                displayName:
                  pendingZalo?.name ||
                  user.displayName ||
                  (isTargetAdmin
                    ? 'Admin Hồng Đức'
                    : (!userIsSyntheticZalo && user.email?.split('@')[0]) || 'Người dùng'),
                phoneNumber: finalVerifiedPhone || zaloPhoneCandidate || '',
                ...((pendingZalo?.avatarUrl || user.photoURL)
                  ? { avatarUrl: pendingZalo?.avatarUrl || user.photoURL || '' }
                  : {}),
                role: resolvedRole,
                accountType: resolvedAccountType,
                ...(usedReferralCode ? { referralCodeUsed: usedReferralCode } : {}),
                status: 'active',
                hasPasswordLinked: userHasPassword,
                googleLinked: userHasGoogle,
                facebookLinked: userHasFacebook,
                ...(pendingZalo || userIsSyntheticZalo
                  ? {
                      zaloLinked: true,
                      ...(pendingZalo?.zaloId ? { zaloId: pendingZalo.zaloId } : {}),
                      ...(pendingZalo?.name ? { zaloName: pendingZalo.name } : {}),
                      ...(pendingZalo?.avatarUrl ? { zaloAvatarUrl: pendingZalo.avatarUrl } : {}),
                    }
                  : {}),
                emailVerified: Boolean(!userIsSyntheticZalo && (user.emailVerified || userHasGoogle)),
                ...(!userIsSyntheticZalo && (user.emailVerified || userHasGoogle)
                  ? { emailVerifiedAt: now }
                  : {}),
                phoneVerified: Boolean(finalVerifiedPhone || userHasSmsMfa),
                ...(finalVerifiedPhone ? { verifiedPhone: finalVerifiedPhone, phoneVerifiedAt: now } : {}),
                twoFactorEnabled: false,
                smsMfaEnabled: userHasSmsMfa,
                ...(firstSmsMasked ? { smsMfaPhoneMasked: firstSmsMasked } : {}),
                createdAt: now,
              };
              if (!isFirestoreWriteQuotaExceeded()) {
                try {
                  await setDoc(userDocRef, newProfile);
                  if (usedReferralCode) {
                    await consumeReferralCodeUsage(usedReferralCode, user.uid);
                    clearPendingReferralCode();
                  }
                } catch (createErr) {
                  markFirestoreWriteQuotaExceededIfMatch(createErr);
                }
              }
              void syncVerifiedIdentityLocks(user, newProfile);
              setUserProfile(newProfile);
              setLoading(false);

              if (isTargetAdmin && syncedAdminUid !== user.uid && !isFirestoreWriteQuotaExceeded()) {
                syncedAdminUid = user.uid;
                try {
                  await setDoc(doc(db, 'admins', user.uid), {
                    uid: user.uid,
                    email: user.email,
                    role: 'super_admin',
                    createdAt: now,
                  });
                } catch (adminDocErr) {
                  markFirestoreWriteQuotaExceededIfMatch(adminDocErr);
                  console.warn('Create admin record error:', adminDocErr);
                }
              }
            }
          } catch (err) {
            console.warn('Profile snapshot sync fallback:', err);
            setLoading(false);
          }
        },
        (err) => {
          console.warn('Profile read fallback:', err);
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || (isTargetAdmin ? 'Admin Hồng Đức' : 'Người dùng'),
            ...(user.photoURL ? { avatarUrl: user.photoURL } : {}),
            role: isTargetAdmin ? 'super_admin' : 'citizen',
            accountType: isTargetAdmin ? 'admin' : 'citizen',
            status: 'active',
            hasPasswordLinked: userHasPassword,
            createdAt: new Date().toISOString(),
          });
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubTotp) unsubTotp();
      if (unsubDevices) unsubDevices();
      unsubscribe();
    };
  }, [syncVerifiedIdentityLocks]);

  const resetClientSessionBeforeSignIn = async (rememberMe = true) => {
    clearAllTwoFactorSessionMarkers();
    setTwoFactorVerifiedThisSession(false);
    setPendingSmsMfaResolver(null);
    const nextSession = rotateActiveSessionId();
    setCurrentSessionId(nextSession);
    setSessionStartedAtIso(new Date().toISOString());
    setAcknowledgedSessionKeys([]);
    setRemoteRevokedNotice(false);
    remoteRevokeInProgressRef.current = false;
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  };

  const signInWithGoogle = async (): Promise<SignInResultStatus> => {
    await resetClientSessionBeforeSignIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      return 'signed_in';
    } catch (err: any) {
      if (err?.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err);
        setPendingSmsMfaResolver(resolver);
        return 'mfa_required';
      }
      throw err;
    }
  };

  const signInWithFacebook = async (): Promise<SignInResultStatus> => {
    await resetClientSessionBeforeSignIn(true);
    const provider = new FacebookAuthProvider();
    provider.addScope('email');
    provider.addScope('public_profile');
    try {
      await signInWithPopup(auth, provider);
      return 'signed_in';
    } catch (err: any) {
      if (err?.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err);
        setPendingSmsMfaResolver(resolver);
        return 'mfa_required';
      }
      throw formatFirebaseOAuthProviderError(err, 'Facebook');
    }
  };

  const signInWithProviderMethod = async (
    providerId: AuthProviderId,
    options?: { rememberMe?: boolean }
  ): Promise<SignInResultStatus> => {
    if (providerId === 'google') return signInWithGoogle();
    if (providerId === 'facebook') return signInWithFacebook();
    if (providerId === 'zalo') return signInWithZalo(options?.rememberMe ?? true);

    if (providerId === 'anonymous') {
      await resetClientSessionBeforeSignIn(options?.rememberMe ?? false);
      try {
        await signInAnonymously(auth);
        return 'signed_in';
      } catch (err: any) {
        throw formatFirebaseOAuthProviderError(err, 'Vô danh');
      }
    }

    const popupProviderMap: Partial<
      Record<
        AuthProviderId,
        { label: string; create: () => GithubAuthProvider | TwitterAuthProvider | OAuthProvider }
      >
    > = {
      github: { label: 'GitHub', create: () => new GithubAuthProvider() },
      microsoft: { label: 'Microsoft', create: () => new OAuthProvider('microsoft.com') },
      apple: { label: 'Apple', create: () => new OAuthProvider('apple.com') },
      twitter: { label: 'Twitter / X', create: () => new TwitterAuthProvider() },
      yahoo: { label: 'Yahoo', create: () => new OAuthProvider('yahoo.com') },
    };

    const popupEntry = popupProviderMap[providerId];
    if (popupEntry) {
      await resetClientSessionBeforeSignIn(options?.rememberMe ?? true);
      try {
        await signInWithPopup(auth, popupEntry.create());
        return 'signed_in';
      } catch (err: any) {
        if (err?.code === 'auth/multi-factor-auth-required') {
          const resolver = getMultiFactorResolver(auth, err);
          setPendingSmsMfaResolver(resolver);
          return 'mfa_required';
        }
        throw formatFirebaseOAuthProviderError(err, popupEntry.label);
      }
    }

    const unsupportedMap: Record<string, string> = {
      phone: 'Điện thoại (SMS OTP)',
      play_games: 'Chơi trò chơi (Play Games)',
      game_center: 'Trung tâm trò chơi (Game Center)',
      oidc: 'Kết nối OpenID (OIDC)',
      saml: 'SAML',
    };
    const label = unsupportedMap[providerId] || providerId;
    throw new Error(
      `Phương thức ${label} cần được cấu hình ID nhà cung cấp riêng trên Firebase Authentication Console hoặc SDK di động gốc trước khi sử dụng.`
    );
  };

  const openZaloOAuthPopup = async (
    mode: 'login' | 'link'
  ): Promise<{
    mode: 'login' | 'link';
    zaloProfile: ZaloAuthProfile;
    bridgeAuth?: { email: string; secret: string };
    firebaseBridgeDisabled?: boolean;
    zaloSessionToken?: string;
  }> => {
    // Open popup synchronously on user click so Safari/iOS/mobile popup blockers do not block it
    const width = 520;
    const height = 680;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      '',
      'tyt_zalo_oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      throw new Error(
        'Trình duyệt đã chặn cửa sổ bật lên (Popup). Vui lòng cho phép mở popup và thử lại.'
      );
    }

    try {
      popup.document.title = 'Đang kết nối Zalo...';
      popup.document.body.innerHTML =
        '<div style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;color:#0f172a;text-align:center;padding:24px;"><div><div style="font-weight:700;font-size:15px;margin-bottom:8px;">Đang chuyển tới cổng xác thực Zalo...</div><div style="font-size:13px;color:#64748b;">Vui lòng chờ trong giây lát.</div></div></div>';
    } catch {
      // ignore cross-origin reuse error if window already exists
    }

    let urlData: {
      ok?: boolean;
      url?: string;
      state?: string;
      pollToken?: string;
      redirectUri?: string;
      error?: string;
    };
    try {
      const urlResp = await fetch(`/api/auth/zalo/url?mode=${encodeURIComponent(mode)}`, {
        method: 'GET',
        credentials: 'include',
      });
      urlData = (await urlResp.json().catch(() => ({}))) as typeof urlData;
      if (!urlResp.ok || !urlData?.url || !urlData?.state) {
        throw new Error(
          urlData?.error || 'Không thể khởi tạo phiên đăng nhập Zalo. Vui lòng kiểm tra cấu hình máy chủ.'
        );
      }
      popup.location.replace(urlData.url);
    } catch (err) {
      try {
        if (!popup.closed) popup.close();
      } catch {
        // ignore
      }
      throw err;
    }

    let redirectOrigin = '';
    try {
      if (urlData.redirectUri) {
        redirectOrigin = new URL(urlData.redirectUri).origin;
      }
    } catch {
      redirectOrigin = '';
    }

    const isAllowedOrigin = (origin: string): boolean => {
      if (!origin) return false;
      if (origin === window.location.origin) return true;
      if (redirectOrigin && origin === redirectOrigin) return true;
      try {
        const parsed = new URL(origin);
        if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
          return false;
        }
        return (
          parsed.hostname.endsWith('.run.app') ||
          parsed.hostname.endsWith('.vercel.app') ||
          parsed.hostname.endsWith('.id.vn') ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1'
        );
      } catch {
        return false;
      }
    };

    const resultStorageKey = `tyt_zalo_oauth_result_${urlData.state}`;
    try {
      localStorage.removeItem(resultStorageKey);
    } catch {
      // ignore
    }

    const exchangeCode = await new Promise<string>((resolve, reject) => {
      let settled = false;
      let closeCheckTimer: number | undefined;
      let serverPollTimer: number | undefined;
      let closedGraceTimer: number | undefined;
      let overallTimer: number | undefined;
      let broadcastChannel: BroadcastChannel | null = null;
      let pollInFlight = false;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.removeEventListener('storage', onStorageEvent);
        if (broadcastChannel) {
          try {
            broadcastChannel.close();
          } catch {
            // ignore
          }
          broadcastChannel = null;
        }
        if (closeCheckTimer !== undefined) window.clearInterval(closeCheckTimer);
        if (serverPollTimer !== undefined) window.clearInterval(serverPollTimer);
        if (closedGraceTimer !== undefined) window.clearTimeout(closedGraceTimer);
        if (overallTimer !== undefined) window.clearTimeout(overallTimer);
        try {
          localStorage.removeItem(resultStorageKey);
        } catch {
          // ignore
        }
      };

      const handleOutcome = (msg: any) => {
        if (settled || !msg || typeof msg !== 'object') return;
        if (msg.type !== 'ZALO_OAUTH_SUCCESS' && msg.type !== 'ZALO_OAUTH_ERROR') return;
        if (msg.state && msg.state !== urlData.state) return;

        settled = true;
        cleanup();
        try {
          if (!popup.closed) popup.close();
        } catch {
          // ignore
        }

        if (msg.type === 'ZALO_OAUTH_ERROR') {
          reject(new Error(String(msg.error || 'Đăng nhập Zalo bị huỷ hoặc thất bại.')));
          return;
        }

        if (!msg.exchangeCode) {
          reject(new Error('Thiếu mã xác thực trao đổi từ Zalo.'));
          return;
        }
        resolve(String(msg.exchangeCode));
      };

      const onMessage = (event: MessageEvent) => {
        if (!isAllowedOrigin(event.origin)) return;
        handleOutcome(event.data);
      };

      const checkLocalStorageFallback = () => {
        try {
          const raw = localStorage.getItem(resultStorageKey);
          if (!raw) return false;
          const parsed = JSON.parse(raw);
          if (parsed?.payload) {
            handleOutcome(parsed.payload);
            return true;
          }
        } catch {
          // ignore
        }
        return false;
      };

      const onStorageEvent = (event: StorageEvent) => {
        if (event.key === resultStorageKey) {
          checkLocalStorageFallback();
        }
      };

      const checkServerPoll = async (): Promise<boolean> => {
        if (settled || pollInFlight || !urlData.pollToken || !urlData.state) return false;
        pollInFlight = true;
        try {
          const resp = await fetch('/api/auth/zalo/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              state: urlData.state,
              pollToken: urlData.pollToken,
            }),
          });
          const data = (await resp.json().catch(() => null)) as {
            status?: 'pending' | 'success' | 'error';
            exchangeCode?: string;
            error?: string;
          } | null;
          if (!data) return false;
          if (data.status === 'success' && data.exchangeCode) {
            handleOutcome({
              type: 'ZALO_OAUTH_SUCCESS',
              state: urlData.state,
              exchangeCode: data.exchangeCode,
            });
            return true;
          }
          if (data.status === 'error') {
            handleOutcome({
              type: 'ZALO_OAUTH_ERROR',
              state: urlData.state,
              error: data.error || 'Đăng nhập Zalo thất bại.',
            });
            return true;
          }
        } catch {
          // ignore transient poll error
        } finally {
          pollInFlight = false;
        }
        return false;
      };

      window.addEventListener('message', onMessage);
      window.addEventListener('storage', onStorageEvent);

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          broadcastChannel = new BroadcastChannel('tyt_zalo_oauth_channel');
          broadcastChannel.onmessage = (ev) => handleOutcome(ev.data);
        }
      } catch {
        // ignore unsupported BroadcastChannel
      }

      serverPollTimer = window.setInterval(() => {
        if (settled) return;
        if (checkLocalStorageFallback()) return;
        void checkServerPoll();
      }, 1000);

      closeCheckTimer = window.setInterval(() => {
        if (settled) return;
        let isClosed = false;
        try {
          isClosed = Boolean(popup.closed);
        } catch {
          isClosed = false;
        }
        if (isClosed && closedGraceTimer === undefined) {
          closedGraceTimer = window.setTimeout(async () => {
            if (settled) return;
            if (checkLocalStorageFallback()) return;
            const resolvedByServer = await checkServerPoll();
            if (!settled && !resolvedByServer) {
              settled = true;
              cleanup();
              reject(new Error('Bạn đã đóng cửa sổ đăng nhập Zalo trước khi hoàn tất.'));
            }
          }, 1200);
        }
      }, 450);

      overallTimer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          try {
            if (!popup.closed) popup.close();
          } catch {
            // ignore
          }
          reject(new Error('Hết thời gian chờ đăng nhập Zalo. Vui lòng thử lại.'));
        }
      }, 5 * 60 * 1000);
    });

    const completeResp = await fetch('/api/auth/zalo/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ exchangeCode }),
    });
    const completeData = (await completeResp.json().catch(() => ({}))) as {
      ok?: boolean;
      mode?: 'login' | 'link';
      zaloProfile?: ZaloAuthProfile;
      bridgeAuth?: { email: string; secret: string };
      firebaseBridgeDisabled?: boolean;
      zaloSessionToken?: string;
      error?: string;
    };

    if (!completeResp.ok || !completeData?.ok || !completeData?.zaloProfile) {
      throw new Error(completeData?.error || 'Không thể hoàn tất xác thực với Zalo.');
    }

    return {
      mode: completeData.mode === 'link' ? 'link' : 'login',
      zaloProfile: completeData.zaloProfile,
      bridgeAuth: completeData.bridgeAuth,
      firebaseBridgeDisabled: completeData.firebaseBridgeDisabled,
      zaloSessionToken: completeData.zaloSessionToken,
    };
  };

  const applyZaloProfileToUserDoc = async (user: User, zaloProfile: ZaloAuthProfile) => {
    const now = new Date().toISOString();
    const userDocRef = doc(db, 'users', user.uid);
    let docExists = false;
    let existingData: Partial<UserProfile> | null = null;
    try {
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        docExists = true;
        existingData = snap.data() as Partial<UserProfile>;
      }
    } catch {
      existingData = userProfile;
    }

    const updates: Record<string, any> = {
      zaloLinked: true,
      zaloId: zaloProfile.zaloId,
      zaloName: zaloProfile.name,
      ...(zaloProfile.avatarUrl ? { zaloAvatarUrl: zaloProfile.avatarUrl } : {}),
      updatedAt: now,
    };
    const currentName = existingData?.displayName || user.displayName || '';
    if (
      zaloProfile.name &&
      (!currentName ||
        currentName === 'Người dùng' ||
        currentName.startsWith('zalo_') ||
        (existingData?.zaloName && currentName === existingData.zaloName))
    ) {
      updates.displayName = zaloProfile.name;
    }
    const currentAvatar = existingData?.avatarUrl || user.photoURL || '';
    if (
      zaloProfile.avatarUrl &&
      (!currentAvatar ||
        (existingData?.zaloAvatarUrl && currentAvatar === existingData.zaloAvatarUrl))
    ) {
      updates.avatarUrl = zaloProfile.avatarUrl;
    }

    const normalizedPhone = normalizeAndValidatePhone(zaloProfile.phoneNumber || '');
    if (normalizedPhone && !existingData?.phoneVerified) {
      const lockId = buildPhoneLockId(normalizedPhone);
      if (lockId) {
        const lockRes = await claimExclusiveIdentifierLock({
          lockId,
          type: 'phone',
          valueMasked: maskPhoneForLock(normalizedPhone),
          ownerUid: user.uid,
        }).catch(() => ({ ok: false }));
        if (lockRes.ok) {
          updates.phoneNumber = normalizedPhone;
          updates.verifiedPhone = normalizedPhone;
          updates.phoneVerified = true;
          updates.phoneVerifiedAt = existingData?.phoneVerifiedAt || now;
        }
      }
    }

    if (!isFirestoreWriteQuotaExceeded()) {
      try {
        if (docExists) {
          await setDoc(userDocRef, updates, { merge: true });
        } else {
          // Document not created yet: write a complete valid initial UserProfile satisfying firestore.rules create checks
          const isTargetAdmin = isBootstrapAdminEmail(user.email);
          const userIsSyntheticZalo = isSyntheticZaloEmail(user.email);
          const userHasGoogle = Boolean(user.providerData?.some((p) => p.providerId === 'google.com'));
          const googleProviderEmail =
            user.providerData?.find((p) => p.providerId === 'google.com')?.email || '';
          const userHasPassword = Boolean(
            user.providerData?.some((p) => p.providerId === 'password') && !userIsSyntheticZalo
          );
          const fullNewProfile: UserProfile = {
            uid: user.uid,
            email: googleProviderEmail || user.email || '',
            displayName: updates.displayName || zaloProfile.name || user.displayName || 'Người dùng',
            phoneNumber: updates.phoneNumber || normalizedPhone || '',
            ...((updates.avatarUrl || zaloProfile.avatarUrl || user.photoURL)
              ? { avatarUrl: updates.avatarUrl || zaloProfile.avatarUrl || user.photoURL || '' }
              : {}),
            role: isTargetAdmin ? 'super_admin' : 'citizen',
            accountType: isTargetAdmin ? 'admin' : 'citizen',
            status: 'active',
            hasPasswordLinked: userHasPassword,
            googleLinked: userHasGoogle,
            zaloLinked: true,
            zaloId: zaloProfile.zaloId,
            zaloName: zaloProfile.name,
            ...(zaloProfile.avatarUrl ? { zaloAvatarUrl: zaloProfile.avatarUrl } : {}),
            emailVerified: Boolean(!userIsSyntheticZalo && (user.emailVerified || userHasGoogle)),
            ...(!userIsSyntheticZalo && (user.emailVerified || userHasGoogle)
              ? { emailVerifiedAt: now }
              : {}),
            phoneVerified: Boolean(updates.phoneVerified),
            ...(updates.verifiedPhone
              ? { verifiedPhone: updates.verifiedPhone, phoneVerifiedAt: now }
              : {}),
            twoFactorEnabled: false,
            smsMfaEnabled: false,
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(userDocRef, fullNewProfile, { merge: true });
        }
      } catch (err) {
        markFirestoreWriteQuotaExceededIfMatch(err);
      }
    }

    if (zaloProfile.name || zaloProfile.avatarUrl) {
      try {
        await updateProfile(user, {
          ...(zaloProfile.name ? { displayName: zaloProfile.name } : {}),
          ...(zaloProfile.avatarUrl ? { photoURL: zaloProfile.avatarUrl } : {}),
        });
      } catch {
        // non-blocking
      }
    }
  };

  const signInWithZalo = async (rememberMe = true): Promise<SignInResultStatus> => {
    const result = await openZaloOAuthPopup('login');

    clearAllTwoFactorSessionMarkers();
    setTwoFactorVerifiedThisSession(false);
    setPendingSmsMfaResolver(null);
    const nextSession = rotateActiveSessionId();
    setCurrentSessionId(nextSession);
    setSessionStartedAtIso(new Date().toISOString());
    setAcknowledgedSessionKeys([]);
    setRemoteRevokedNotice(false);
    remoteRevokeInProgressRef.current = false;

    if (result.bridgeAuth?.email && result.bridgeAuth?.secret) {
      zaloOnlySessionRef.current = null;
      clearStoredZaloOnlySession();
      setIsZaloOnlySession(false);

      pendingZaloProfileRef.current = result.zaloProfile;
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          result.bridgeAuth.email,
          result.bridgeAuth.secret
        );
        await applyZaloProfileToUserDoc(cred.user, result.zaloProfile);
        await upsertCurrentDeviceDoc(cred.user.uid, 'zalo');
        pendingZaloProfileRef.current = null;
        return 'signed_in';
      } catch (err: any) {
        if (err?.code === 'auth/multi-factor-auth-required') {
          const resolver = getMultiFactorResolver(auth, err);
          setPendingSmsMfaResolver(resolver);
          return 'mfa_required';
        }
        pendingZaloProfileRef.current = null;
        throw err;
      }
    }

    if (result.firebaseBridgeDisabled && result.zaloProfile && result.zaloSessionToken) {
      const zaloSession: StoredZaloOnlySession = {
        profile: result.zaloProfile,
        token: result.zaloSessionToken,
        rememberMe,
        savedAt: Date.now(),
      };
      zaloOnlySessionRef.current = zaloSession;
      writeStoredZaloOnlySession(zaloSession);
      setIsZaloOnlySession(true);
      setCurrentUser(buildSyntheticZaloUser(result.zaloProfile));
      setUserProfile(buildInitialZaloOnlyUserProfile(result.zaloProfile));
      setTotpConfig(null);
      setVerifiedDevices([]);
      setTwoFactorLoading(false);
      setLoading(false);
      return 'signed_in';
    }

    throw new Error('Không nhận được phiên xác thực cho tài khoản Zalo.');
  };

  const writeFirebaseUserToIndexedDb = async (
    storageKey: string,
    payload: Record<string, unknown>
  ): Promise<boolean> => {
    if (typeof indexedDB === 'undefined') return false;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('firebaseLocalStorageDb', 1);
        req.onupgradeneeded = () => {
          const idb = req.result;
          if (!idb.objectStoreNames.contains('firebaseLocalStorage')) {
            idb.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
          }
        };
        req.onerror = () => resolve(false);
        req.onsuccess = () => {
          const idb = req.result;
          if (!idb.objectStoreNames.contains('firebaseLocalStorage')) {
            idb.close();
            resolve(false);
            return;
          }
          const tx = idb.transaction(['firebaseLocalStorage'], 'readwrite');
          const store = tx.objectStore('firebaseLocalStorage');
          store.put({ fbase_key: storageKey, value: payload });
          tx.oncomplete = () => {
            idb.close();
            resolve(true);
          };
          tx.onerror = () => {
            idb.close();
            resolve(false);
          };
          tx.onabort = () => {
            idb.close();
            resolve(false);
          };
        };
      } catch {
        resolve(false);
      }
    });
  };

  const hydrateAuthBundle = async (
    bundle: QrAuthHandoffBundle,
    deviceMethod: 'qr' | 'biometric'
  ): Promise<void> => {
    if (!bundle?.uid || !bundle?.refreshToken || !bundle?.accessToken) {
      throw new Error(
        deviceMethod === 'biometric'
          ? 'Phiên xác thực sinh trắc học không hợp lệ hoặc đã hết hạn.'
          : 'Gói xác thực QR không hợp lệ hoặc đã hết hạn.'
      );
    }

    clearAllTwoFactorSessionMarkers();
    setTwoFactorVerifiedThisSession(false);
    setPendingSmsMfaResolver(null);
    const nextSession = rotateActiveSessionId();
    setCurrentSessionId(nextSession);
    setSessionStartedAtIso(new Date().toISOString());
    setAcknowledgedSessionKeys([]);
    setRemoteRevokedNotice(false);
    remoteRevokeInProgressRef.current = false;
    if (deviceMethod === 'qr') {
      pendingQrDeviceMethodRef.current = true;
    } else {
      pendingBiometricDeviceMethodRef.current = true;
    }

    const resolvedApiKey = bundle.apiKey || firebaseConfig.apiKey;
    const appName = auth.name || '[DEFAULT]';
    const storageKey = `firebase:authUser:${resolvedApiKey}:${appName}`;

    const persistedUserPayload: Record<string, unknown> = {
      uid: bundle.uid,
      emailVerified: Boolean(bundle.emailVerified),
      isAnonymous: false,
      providerData: Array.isArray(bundle.providerData) ? bundle.providerData : [],
      stsTokenManager: {
        refreshToken: bundle.refreshToken,
        accessToken: bundle.accessToken,
        expirationTime: Number(bundle.expirationTime) || Date.now() + 3600 * 1000,
      },
      apiKey: resolvedApiKey,
      appName,
    };
    if (typeof bundle.email === 'string' && bundle.email) {
      persistedUserPayload.email = bundle.email;
    }
    if (typeof bundle.displayName === 'string' && bundle.displayName) {
      persistedUserPayload.displayName = bundle.displayName;
    }
    if (typeof bundle.photoURL === 'string' && bundle.photoURL) {
      persistedUserPayload.photoURL = bundle.photoURL;
    }
    if (typeof bundle.phoneNumber === 'string' && bundle.phoneNumber) {
      persistedUserPayload.phoneNumber = bundle.phoneNumber;
    }
    if (typeof bundle.createdAt === 'string' && bundle.createdAt) {
      persistedUserPayload.createdAt = bundle.createdAt;
    }
    if (typeof bundle.lastLoginAt === 'string' && bundle.lastLoginAt) {
      persistedUserPayload.lastLoginAt = bundle.lastLoginAt;
    }

    const waitForHydratedUser = (timeoutMs: number): Promise<User | null> =>
      new Promise((resolve) => {
        if (auth.currentUser?.uid === bundle.uid) {
          resolve(auth.currentUser);
          return;
        }
        let settled = false;
        const timer = window.setTimeout(() => {
          if (!settled) {
            settled = true;
            unsub();
            resolve(auth.currentUser?.uid === bundle.uid ? auth.currentUser : null);
          }
        }, timeoutMs);
        const unsub = onAuthStateChanged(auth, (u) => {
          if (u?.uid === bundle.uid && !settled) {
            settled = true;
            window.clearTimeout(timer);
            unsub();
            resolve(u);
          }
        });
      });

    const wroteIdb = await writeFirebaseUserToIndexedDb(storageKey, persistedUserPayload);
    if (!wroteIdb) {
      await setPersistence(auth, browserLocalPersistence);
      try {
        localStorage.setItem(storageKey, JSON.stringify(persistedUserPayload));
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: storageKey,
            newValue: JSON.stringify(persistedUserPayload),
            storageArea: window.localStorage,
          })
        );
      } catch {
        // ignore storage error
      }
    }

    let hydratedUser = await waitForHydratedUser(2400);

    // Fallback: if IndexedDB poll was unavailable in current browser mode, trigger browserLocalPersistence StorageEvent
    if (!hydratedUser) {
      try {
        await setPersistence(auth, browserLocalPersistence);
        localStorage.setItem(storageKey, JSON.stringify(persistedUserPayload));
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: storageKey,
            newValue: JSON.stringify(persistedUserPayload),
            storageArea: window.localStorage,
          })
        );
      } catch {
        // ignore
      }
      hydratedUser = await waitForHydratedUser(3500);
    }

    if (!hydratedUser) {
      pendingQrDeviceMethodRef.current = false;
      pendingBiometricDeviceMethodRef.current = false;
      throw new Error('Không thể đồng bộ phiên đăng nhập trên trình duyệt này. Vui lòng thử lại.');
    }

    try {
      await hydratedUser.reload();
    } catch {
      // non-blocking
    }
    setProviderTick((t) => t + 1);
    await upsertCurrentDeviceDoc(
      hydratedUser.uid,
      deviceMethod,
      undefined,
      true,
      deviceMethod === 'biometric' ? true : undefined
    );
  };

  const signInWithQrHandoff = async (bundle: QrAuthHandoffBundle): Promise<void> => {
    await hydrateAuthBundle(bundle, 'qr');
  };

  const signInWithBiometric = async (): Promise<void> => {
    try {
      const result = await authenticateBiometricLogin();
      await hydrateAuthBundle(result.authBundle, 'biometric');
      const synced = await syncBiometricStatusFromServer(result.authBundle.uid);
      setBiometricMeta(synced);
    } catch (err) {
      setBiometricMeta(getLocalBiometricMeta());
      throw err;
    }
  };

  const refreshBiometricStatus = useCallback(async () => {
    const env = await detectBiometricEnvironment();
    setBiometricEnvironment(env);
    const synced = await syncBiometricStatusFromServer(auth.currentUser?.uid);
    setBiometricMeta(synced);
  }, []);

  const activateDeviceBiometric = async (options?: {
    enableAppLock?: boolean;
  }): Promise<LocalBiometricMeta> => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để kích hoạt Face ID / Touch ID.');
    }
    const idToken = await currentUser.getIdToken(true);
    const refreshToken = currentUser.refreshToken;
    if (!refreshToken) {
      throw new Error('Không tìm thấy mã làm mới phiên. Vui lòng đăng nhập lại trước khi kích hoạt.');
    }
    const meta = await enrollDeviceBiometric({
      idToken,
      refreshToken,
      uid: currentUser.uid,
      enableAppLock: Boolean(options?.enableAppLock),
    });
    setBiometricMeta(meta);
    await upsertCurrentDeviceDoc(currentUser.uid, 'biometric', undefined, true, true);
    return meta;
  };

  const deactivateDeviceBiometric = async (): Promise<void> => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để tắt sinh trắc học thiết bị.');
    }
    const idToken = await currentUser.getIdToken();
    await revokeServerBiometric({
      idToken,
      deviceId: currentDeviceMeta.current.deviceId,
    });
    setBiometricMeta(null);
    const existing = verifiedDevicesRef.current.find(
      (d) => d.deviceId === currentDeviceMeta.current.deviceId
    );
    await upsertCurrentDeviceDoc(
      currentUser.uid,
      existing?.verificationMethod === 'biometric' ? 'password' : existing?.verificationMethod || 'password',
      undefined,
      true,
      false
    );
  };

  const updateBiometricAppLock = (enabled: boolean): void => {
    const updated = setPwaAppLockPreference(enabled);
    setBiometricMeta(updated);
  };

  const verifyBiometricUnlockForPwa = async (): Promise<{ ok: boolean; offlineFallback?: boolean }> => {
    if (!currentUser) {
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    let idToken = '';
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      idToken = await currentUser.getIdToken();
    }
    return verifyBiometricUnlock({
      idToken,
      uid: currentUser.uid,
    });
  };

  const loginWithEmail = async (
    email: string,
    pass: string,
    rememberMe = true
  ): Promise<SignInResultStatus> => {
    clearAllTwoFactorSessionMarkers();
    setTwoFactorVerifiedThisSession(false);
    setPendingSmsMfaResolver(null);
    const nextSession = rotateActiveSessionId();
    setCurrentSessionId(nextSession);
    setSessionStartedAtIso(new Date().toISOString());
    setAcknowledgedSessionKeys([]);
    setRemoteRevokedNotice(false);
    remoteRevokeInProgressRef.current = false;
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      return 'signed_in';
    } catch (err: any) {
      if (err?.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err);
        setPendingSmsMfaResolver(resolver);
        return 'mfa_required';
      }
      throw err;
    }
  };

  const sendPasswordReset = async (targetEmail?: string) => {
    const resolvedEmail = (targetEmail || currentUser?.email || '').trim();
    if (!resolvedEmail) {
      throw new Error('Không tìm thấy địa chỉ email để gửi liên kết đặt lại mật khẩu.');
    }
    if (isSyntheticZaloEmail(resolvedEmail)) {
      throw new Error(
        'Tài khoản này đang đăng nhập nhanh bằng Zalo nên không sử dụng email đặt lại mật khẩu. Vui lòng tiếp tục đăng nhập với Zalo.'
      );
    }
    auth.languageCode = 'vi';
    await sendPasswordResetEmail(auth, resolvedEmail);
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    phone?: string,
    referralCode?: string,
    organizationData?: {
      isOrganization?: boolean;
      organizationName?: string;
      organizationType?: 'clinic' | 'pharmacy' | 'school' | 'enterprise' | 'agency' | 'other';
      taxCode?: string;
      organizationAddress?: string;
      organizationPhone?: string;
    }
  ) => {
    const cleanEmail = autoCompleteGmail(email);
    if (!isValidEmailAddress(cleanEmail)) {
      throw new Error('Địa chỉ Email / Gmail không hợp lệ.');
    }
    const cleanName = displayName.trim();
    const cleanPhone = phone ? phone.trim() : '';
    const normalizedPhone = cleanPhone ? normalizeAndValidatePhone(cleanPhone) : '';

    if (cleanPhone && !normalizedPhone) {
      throw new Error('Số điện thoại phải gồm đúng 10 chữ số (VD: 0912345678).');
    }

    const isTargetAdmin = isBootstrapAdminEmail(cleanEmail);
    const isOrg = Boolean(organizationData?.isOrganization);
    const effectiveReferral = normalizeReferralCode(referralCode || getPendingReferralCode());
    let validatedRefRole: RoleType = isOrg ? 'organization' : 'user';
    let validatedAccountType: AccountType = isOrg ? 'organization' : 'user';
    let usedReferralCode = '';

    if (!isTargetAdmin && effectiveReferral) {
      const roleCheck = await validateReferralCode(effectiveReferral);
      if (!roleCheck.valid || !roleCheck.item) {
        throw new Error(roleCheck.error || 'Mã giới thiệu không hợp lệ, không tồn tại hoặc đã ngừng hoạt động.');
      }
      validatedRefRole = roleCheck.item.targetRole || (isOrg ? 'organization' : 'user');
      validatedAccountType = roleCheck.item.targetAccountType || validatedRefRole;
      usedReferralCode = roleCheck.item.code;
    }

    // Enforce uniqueness locks BEFORE creating account
    const emailLockId = await buildEmailLockId(cleanEmail);
    if (emailLockId) {
      const emailCheck = await checkIdentifierAvailability(emailLockId);
      if (!emailCheck.available) {
        throw new Error('Địa chỉ Email / Gmail này đã được đăng ký bởi tài khoản khác và không thể sử dụng.');
      }
    }
    const phoneLockId = normalizedPhone ? buildPhoneLockId(normalizedPhone) : '';
    if (phoneLockId) {
      const phoneCheck = await checkIdentifierAvailability(phoneLockId);
      if (!phoneCheck.available) {
        throw new Error('Số điện thoại này đã được đăng ký bởi tài khoản khác và không thể sử dụng.');
      }
    }

    clearAllTwoFactorSessionMarkers();
    await setPersistence(auth, browserLocalPersistence);
    const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    if (cleanName) {
      try {
        await updateProfile(res.user, { displayName: cleanName });
      } catch {
        // non-blocking
      }
    }

    // Immediately claim email lock so password reset identity checks work immediately
    if (emailLockId) {
      await claimExclusiveIdentifierLock({
        lockId: emailLockId,
        type: 'email',
        valueMasked: maskEmailForLock(cleanEmail),
        ownerUid: res.user.uid,
      }).catch((err) => {
        console.warn('Claim email lock on signup warning:', err);
      });
    }

    // Automatically trigger Firebase email verification on signup
    try {
      auth.languageCode = 'vi';
      await sendEmailVerification(res.user);
    } catch {
      // user can resend inside Verification Hub
    }

    const now = new Date().toISOString();

    let phoneLocked = false;
    if (normalizedPhone && phoneLockId) {
      const lockRes = await claimExclusiveIdentifierLock({
        lockId: phoneLockId,
        type: 'phone',
        valueMasked: maskPhoneForLock(normalizedPhone),
        ownerUid: res.user.uid,
      });
      phoneLocked = lockRes.ok;
    }

    const effectiveRole: RoleType = isTargetAdmin ? 'super_admin' : validatedRefRole;
    const effectiveAccountType: AccountType = isTargetAdmin ? 'admin' : validatedAccountType;

    const profile: UserProfile = {
      uid: res.user.uid,
      email: cleanEmail,
      displayName: isOrg
        ? organizationData?.organizationName?.trim() || cleanName || 'Doanh nghiệp / Tổ chức'
        : cleanName || cleanEmail.split('@')[0],
      phoneNumber: phoneLocked ? normalizedPhone : '',
      role: effectiveRole,
      accountType: effectiveAccountType,
      ...(usedReferralCode ? { referralCodeUsed: usedReferralCode } : {}),
      ...(isOrg || effectiveRole === 'organization'
        ? {
            organizationName: organizationData?.organizationName?.trim() || cleanName || 'Doanh nghiệp / Tổ chức',
            organizationType: organizationData?.organizationType || 'enterprise',
            taxCode: organizationData?.taxCode?.trim() || undefined,
            organizationAddress: organizationData?.organizationAddress?.trim() || undefined,
            organizationPhone: organizationData?.organizationPhone?.trim() || normalizedPhone || undefined,
            organizationEmail: cleanEmail,
          }
        : {}),
      status: 'active',
      hasPasswordLinked: true,
      emailVerified: Boolean(res.user.emailVerified),
      phoneVerified: phoneLocked,
      ...(phoneLocked ? { verifiedPhone: normalizedPhone, phoneVerifiedAt: now } : {}),
      twoFactorEnabled: false,
      createdAt: now,
    };

    try {
      await setDoc(doc(db, 'users', res.user.uid), profile);
      if (usedReferralCode) {
        await consumeReferralCodeUsage(usedReferralCode, res.user.uid);
        clearPendingReferralCode();
      }
      if (isTargetAdmin) {
        await setDoc(doc(db, 'admins', res.user.uid), { uid: res.user.uid, email: cleanEmail, role: 'super_admin' });
      }
      await upsertCurrentDeviceDoc(res.user.uid, 'password', undefined, true);
    } catch (e) {
      console.warn('Save initial profile error:', e);
    }
    setUserProfile(profile);
  };

  const logoutInternal = useCallback(async (options?: { keepRevokedNotice?: boolean; skipInactiveWrite?: boolean }) => {
    const activeUser = auth.currentUser;
    if (activeUser && !options?.skipInactiveWrite && !isFirestoreWriteQuotaExceeded()) {
      const meta = currentDeviceMeta.current;
      const existingDev = verifiedDevicesRef.current.find((d) => d.deviceId === meta.deviceId);
      const now = new Date().toISOString();
      const payload: UserVerifiedDevice = {
        deviceId: meta.deviceId,
        deviceName: (existingDev?.deviceName || meta.deviceName).slice(0, 128),
        platform: meta.platform,
        os: meta.os,
        browser: meta.browser,
        isTrusted: existingDev ? Boolean(existingDev.isTrusted) : false,
        verificationMethod:
          existingDev?.verificationMethod || resolveVerificationMethodFromUser(activeUser),
        ...(typeof existingDev?.biometricEnabled === 'boolean'
          ? { biometricEnabled: existingDev.biometricEnabled }
          : {}),
        verifiedAt: existingDev?.verifiedAt || now,
        firstSeenAt: existingDev?.firstSeenAt || now,
        lastActiveAt: now,
        activeSessionId: currentSessionIdRef.current,
        isSessionActive: false,
        sessionStartedAt: existingDev?.sessionStartedAt || sessionStartedAtRef.current || now,
        lastHeartbeatAt: now,
        lastHeartbeatMs: Date.now(),
      };
      try {
        await setDoc(doc(db, 'users', activeUser.uid, 'devices', meta.deviceId), payload, { merge: true });
      } catch (err) {
        markFirestoreWriteQuotaExceededIfMatch(err);
      }
    }

    zaloOnlySessionRef.current = null;
    clearStoredZaloOnlySession();
    setIsZaloOnlySession(false);
    setCurrentUser(null);
    setUserProfile(null);
    void fetch('/api/auth/zalo/logout', { method: 'POST', credentials: 'include' }).catch(() => {});

    clearAllTwoFactorSessionMarkers();
    clearPendingSmsMfaResolver();
    setTwoFactorVerifiedThisSession(false);
    setTotpConfig(null);
    setVerifiedDevices([]);
    const nextSession = rotateActiveSessionId();
    setCurrentSessionId(nextSession);
    setSessionStartedAtIso(new Date().toISOString());
    setAcknowledgedSessionKeys([]);
    if (!options?.keepRevokedNotice) {
      setRemoteRevokedNotice(false);
    }
    if (activeUser) {
      await signOut(auth);
    }
    setSimulatedRole(null);
  }, [clearPendingSmsMfaResolver]);

  const logout = async () => {
    remoteRevokeInProgressRef.current = false;
    await logoutInternal({ keepRevokedNotice: false });
  };

  const switchPreviewRole = (role: RoleType, accountType: AccountType) => {
    setSimulatedRole({ role, accountType });
  };

  const resetRoleToActual = () => {
    setSimulatedRole(null);
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    if (isZaloOnlySession || !auth.currentUser) {
      const now = new Date().toISOString();
      const mergedProfile: UserProfile = {
        ...(userProfile || ({ uid: currentUser.uid, role: 'citizen', accountType: 'citizen', status: 'active' } as UserProfile)),
        ...data,
        updatedAt: now,
      };
      setUserProfile(mergedProfile);
      if (zaloOnlySessionRef.current) {
        const nextZaloProfile: ZaloAuthProfile = {
          ...zaloOnlySessionRef.current.profile,
          name: mergedProfile.displayName || zaloOnlySessionRef.current.profile.name,
          avatarUrl: mergedProfile.avatarUrl || zaloOnlySessionRef.current.profile.avatarUrl,
          phoneNumber: mergedProfile.phoneNumber || zaloOnlySessionRef.current.profile.phoneNumber,
        };
        const nextSess = { ...zaloOnlySessionRef.current, profile: nextZaloProfile };
        zaloOnlySessionRef.current = nextSess;
        writeStoredZaloOnlySession(nextSess);
        setCurrentUser(buildSyntheticZaloUser(nextZaloProfile));
      }
      return;
    }
    const path = `users/${currentUser.uid}`;
    const ref = doc(db, 'users', currentUser.uid);

    const isSuperAdminUser =
      isBootstrapAdminEmail(currentUser.email) || userProfile?.role === 'super_admin';
    const allowEditByAdmin =
      isSuperAdminUser || Boolean(userProfile?.allowIdentityEditByAdmin);
    const isAdminUser =
      isSuperAdminUser ||
      userProfile?.role === 'admin' ||
      userProfile?.accountType === 'admin';

    const prevNormalizedPhone = normalizeAndValidatePhone(
      userProfile?.verifiedPhone || userProfile?.phoneNumber || ''
    );
    const prevPhoneLockId = prevNormalizedPhone ? buildPhoneLockId(prevNormalizedPhone) : '';
    const prevCccdDigits = (userProfile?.citizenId || '').replace(/\D/g, '');
    const prevCccdLockId = prevCccdDigits ? buildCccdLockId(prevCccdDigits) : '';

    // Handle phoneNumber uniqueness & optional update when unlocked by Admin
    let lockedNewPhone = '';
    let clearedPhone = false;
    if (data.phoneNumber !== undefined && (!userProfile?.phoneVerified || allowEditByAdmin)) {
      const rawPhone = data.phoneNumber.trim();
      if (rawPhone) {
        const normalized = normalizeAndValidatePhone(rawPhone);
        if (!normalized) {
          throw new Error('Số điện thoại phải gồm đúng 10 chữ số (VD: 0912345678).');
        }
        if (normalized !== prevNormalizedPhone || !userProfile?.phoneVerified) {
          const lockId = buildPhoneLockId(normalized);
          const lockRes = await claimExclusiveIdentifierLock({
            lockId,
            type: 'phone',
            valueMasked: maskPhoneForLock(normalized),
            ownerUid: currentUser.uid,
          });
          if (!lockRes.ok) {
            throw new Error(lockRes.error || 'Số điện thoại này đã được tài khoản khác sử dụng.');
          }
          if (prevPhoneLockId && prevPhoneLockId !== lockId && allowEditByAdmin) {
            await releaseExclusiveIdentifierLock(prevPhoneLockId);
          }
          lockedNewPhone = normalized;
        }
      } else if (allowEditByAdmin && prevPhoneLockId) {
        await releaseExclusiveIdentifierLock(prevPhoneLockId);
        clearedPhone = true;
      }
    }

    // Handle citizenId uniqueness & optional update when unlocked by Admin
    let updatedCccdDigits: string | null = null;
    let clearedCccd = false;
    if (data.citizenId !== undefined && (!userProfile?.citizenIdVerified || allowEditByAdmin)) {
      const nextDigits = data.citizenId.replace(/\D/g, '').trim();
      if (nextDigits) {
        if (nextDigits !== prevCccdDigits) {
          if (nextDigits.length < 9 || nextDigits.length > 12) {
            throw new Error('Số CCCD/ĐDCN phải gồm từ 9 đến 12 chữ số.');
          }
          const newCccdLockId = buildCccdLockId(nextDigits);
          if (allowEditByAdmin || userProfile?.citizenIdVerified) {
            const lockRes = await claimExclusiveIdentifierLock({
              lockId: newCccdLockId,
              type: 'cccd',
              valueMasked: maskCccdForLock(nextDigits),
              ownerUid: currentUser.uid,
            });
            if (!lockRes.ok) {
              throw new Error(lockRes.error || 'Số CCCD này đã được tài khoản khác xác minh và không thể sử dụng.');
            }
            if (prevCccdLockId && prevCccdLockId !== newCccdLockId && allowEditByAdmin) {
              await releaseExclusiveIdentifierLock(prevCccdLockId);
            }
          } else {
            const check = await checkIdentifierAvailability(newCccdLockId, currentUser.uid);
            if (!check.available) {
              throw new Error('Số CCCD này đã được xác minh bởi tài khoản khác và không thể sử dụng.');
            }
          }
          updatedCccdDigits = nextDigits;
        }
      } else if (allowEditByAdmin) {
        if (prevCccdLockId) {
          await releaseExclusiveIdentifierLock(prevCccdLockId);
        }
        clearedCccd = true;
      }
    }

    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleaned[k] = v;
    }

    const now = new Date().toISOString();
    if (lockedNewPhone) {
      cleaned.phoneNumber = lockedNewPhone;
      cleaned.verifiedPhone = lockedNewPhone;
      cleaned.phoneVerified = true;
      cleaned.phoneVerifiedAt = now;
    } else if (clearedPhone) {
      cleaned.phoneNumber = '';
      cleaned.verifiedPhone = '';
      cleaned.phoneVerified = false;
    }

    if (updatedCccdDigits !== null) {
      cleaned.citizenId = updatedCccdDigits;
      if (userProfile?.citizenIdVerified || allowEditByAdmin) {
        cleaned.citizenIdVerified = true;
        cleaned.citizenIdVerifiedAt = now;
      }
    } else if (clearedCccd) {
      cleaned.citizenId = '';
      cleaned.citizenIdVerified = false;
      cleaned.identityVerifiedFromDatabase = false;
    }

    // Never allow overwriting verified email
    if (userProfile?.emailVerified) {
      delete cleaned.email;
      cleaned.emailVerified = true;
    }

    // Protect admin-controlled flags & ban status fields for non-admins
    if (!isAdminUser) {
      delete cleaned.allowIdentityEditByAdmin;
      delete cleaned.status;
      delete cleaned.banType;
      delete cleaned.bannedUntil;
      delete cleaned.bannedUntilMs;
      delete cleaned.banReason;
      delete cleaned.bannedAt;
      delete cleaned.bannedByUid;
      delete cleaned.bannedByName;
    }

    // When locked (not unlocked by Admin), prevent tampering with locked identity & profile fields
    if (!allowEditByAdmin) {
      if (userProfile?.phoneVerified && userProfile?.verifiedPhone) {
        cleaned.phoneNumber = userProfile.verifiedPhone;
        cleaned.verifiedPhone = userProfile.verifiedPhone;
        cleaned.phoneVerified = true;
      }
      if (userProfile?.citizenIdVerified && userProfile?.citizenId) {
        cleaned.citizenId = userProfile.citizenId;
        cleaned.citizenIdVerified = true;
      }

      const isLockedProfile = Boolean(
        userProfile?.identityVerifiedFromDatabase || userProfile?.citizenIdVerified
      );
      if (isLockedProfile && !isAdminUser) {
        const lockedKeys: (keyof UserProfile)[] = [
          'identityVerifiedFromDatabase',
          'citizenIdVerified',
          'citizenId',
          'displayName',
          'dob',
          'gender',
          'ethnicity',
          'provinceCode',
          'provinceName',
          'wardCode',
          'wardName',
          'address',
          'department',
          'position',
        ];
        for (const key of lockedKeys) {
          if (userProfile && userProfile[key] !== undefined) {
            cleaned[key] = userProfile[key];
          } else {
            delete cleaned[key];
          }
        }
      }
    }

    cleaned.updatedAt = now;
    try {
      await setDoc(ref, cleaned, { merge: true });
      setUserProfile((prev) => (prev ? { ...prev, ...cleaned } : null));
    } catch (err) {
      handleAuthFirestoreError(err, FirestoreOperationType.UPDATE, path);
    }
  };

  const linkEmailPassword = async (newPassword: string) => {
    if (!currentUser || !currentUser.email) {
      throw new Error('Không tìm thấy thông tin tài khoản email đang đăng nhập.');
    }
    if (isSyntheticZaloEmail(currentUser.email)) {
      throw new Error(
        'Tài khoản đang đăng nhập nhanh qua Zalo. Hãy liên kết Gmail / Google trong mục Bảo mật tài khoản hoặc tiếp tục đăng nhập trực tiếp bằng Zalo.'
      );
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu phải có tối thiểu 6 ký tự.');
    }

    const cred = EmailAuthProvider.credential(currentUser.email, newPassword);
    try {
      await linkWithCredential(currentUser, cred);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/requires-recent-login') {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
        await linkWithCredential(currentUser, cred);
      } else if (code === 'auth/provider-already-linked' || code === 'auth/credential-already-in-use') {
        await updatePassword(currentUser, newPassword);
      } else {
        throw err;
      }
    }

    await currentUser.reload();
    setProviderTick((t) => t + 1);
    await updateProfileData({ hasPasswordLinked: true });
  };

  const verifyAccountPassword = async (passwordToVerify: string): Promise<boolean> => {
    if (!currentUser || !currentUser.email) {
      throw new Error('Không tìm thấy email tài khoản.');
    }
    if (isSyntheticZaloEmail(currentUser.email)) {
      throw new Error('Tài khoản Zalo không sử dụng mật khẩu riêng.');
    }
    if (!passwordToVerify) return false;
    const cred = EmailAuthProvider.credential(currentUser.email, passwordToVerify);
    await reauthenticateWithCredential(currentUser, cred);
    return true;
  };

  const changeAccountPassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser || !currentUser.email) {
      throw new Error('Không tìm thấy email tài khoản.');
    }
    if (isSyntheticZaloEmail(currentUser.email)) {
      throw new Error(
        'Tài khoản đang đăng nhập bằng Zalo nên không đặt mật khẩu trực tiếp.'
      );
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
    }

    const hasPwd = Boolean(currentUser.providerData?.some((p) => p.providerId === 'password'));
    if (!hasPwd) {
      await linkEmailPassword(newPassword);
      return;
    }

    if (!currentPassword || !currentPassword.trim()) {
      throw new Error('Vui lòng nhập mật khẩu cũ (hiện tại) để tiếp tục.');
    }

    const cred = EmailAuthProvider.credential(currentUser.email, currentPassword);
    await reauthenticateWithCredential(currentUser, cred);

    try {
      await updatePassword(currentUser, newPassword);
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        await reauthenticateWithCredential(currentUser, cred);
        await updatePassword(currentUser, newPassword);
      } else {
        throw err;
      }
    }

    await currentUser.reload();
    setProviderTick((t) => t + 1);
  };

  const verifySessionTwoFactorOtp = async (
    codeOrRecovery: string
  ): Promise<{ ok: boolean; usedRecoveryCode?: boolean; error?: string }> => {
    if (!currentUser) {
      return { ok: false, error: 'Phiên đăng nhập đã hết hạn.' };
    }
    if (!totpConfig?.enabled || !totpConfig.secret) {
      markSessionTwoFactorVerified(currentUser);
      return { ok: true };
    }

    const cleaned = codeOrRecovery.trim();
    if (!cleaned) {
      return { ok: false, error: 'Vui lòng nhập mã OTP 6 số hoặc mã khôi phục.' };
    }

    // 1. Try 6-digit TOTP verification first
    if (/^\d{6}$/.test(cleaned.replace(/\s+/g, ''))) {
      const isValidTotp = await verifyTotpToken(totpConfig.secret, cleaned, 1);
      if (isValidTotp) {
        markSessionTwoFactorVerified(currentUser);
        return { ok: true };
      }
      return {
        ok: false,
        error: 'Mã OTP Authenticator không chính xác hoặc đã hết hạn 30 giây. Vui lòng kiểm tra lại.',
      };
    }

    // 2. Try one-time Recovery Code
    const normalizedInput = normalizeRecoveryCode(cleaned);
    const existingCodes = Array.isArray(totpConfig.recoveryCodes) ? totpConfig.recoveryCodes : [];
    const matchedIdx = existingCodes.findIndex((c) => normalizeRecoveryCode(c) === normalizedInput);

    if (matchedIdx !== -1) {
      const remainingCodes = existingCodes.filter((_, idx) => idx !== matchedIdx);
      const totpPath = `users/${currentUser.uid}/security/totp`;
      try {
        await setDoc(
          doc(db, 'users', currentUser.uid, 'security', 'totp'),
          {
            enabled: true,
            secret: totpConfig.secret,
            recoveryCodes: remainingCodes,
            issuer: totpConfig.issuer || 'Tram Y Te So',
            verifiedAt: totpConfig.verifiedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleAuthFirestoreError(err, FirestoreOperationType.UPDATE, totpPath);
      }
      markSessionTwoFactorVerified(currentUser);
      return { ok: true, usedRecoveryCode: true };
    }

    return { ok: false, error: 'Mã OTP hoặc mã khôi phục không hợp lệ.' };
  };

  const enableTwoFactorAuth = async (
    secret: string,
    verificationCode: string,
    recoveryCodes: string[],
    issuer = 'Tram Y Te So'
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) {
      return { ok: false, error: 'Bạn cần đăng nhập để bật khóa 2FA.' };
    }
    const isValid = await verifyTotpToken(secret, verificationCode, 1);
    if (!isValid) {
      return {
        ok: false,
        error: 'Mã OTP 6 số chưa khớp với ứng dụng Authenticator. Hãy kiểm tra đồng hồ thiết bị và thử lại.',
      };
    }

    const now = new Date().toISOString();
    const payload: UserTotpSecurityDoc = {
      enabled: true,
      secret: secret.trim().toUpperCase(),
      recoveryCodes: recoveryCodes.slice(0, 12),
      issuer: issuer.slice(0, 128),
      verifiedAt: now,
      updatedAt: now,
    };

    const totpPath = `users/${currentUser.uid}/security/totp`;
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'security', 'totp'), payload);
    } catch (err) {
      handleAuthFirestoreError(err, FirestoreOperationType.WRITE, totpPath);
    }

    await updateProfileData({
      twoFactorEnabled: true,
      twoFactorUpdatedAt: now,
      hasPasswordLinked: Boolean(currentUser.providerData?.some((p) => p.providerId === 'password')),
    });

    setTotpConfig(payload);
    markSessionTwoFactorVerified(currentUser);
    return { ok: true };
  };

  const disableTwoFactorAuth = async (options?: {
    verificationCode?: string;
    password?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) {
      return { ok: false, error: 'Bạn cần đăng nhập để thực hiện thao tác này.' };
    }

    const hasPwd = Boolean(currentUser.providerData?.some((p) => p.providerId === 'password'));

    if (hasPwd) {
      if (!options?.password) {
        return { ok: false, error: 'Vui lòng nhập mật khẩu tài khoản để xác nhận tắt khóa 2FA.' };
      }
      try {
        await verifyAccountPassword(options.password);
      } catch (err: any) {
        const msg = err?.code || err?.message || '';
        if (String(msg).includes('wrong-password') || String(msg).includes('invalid-credential')) {
          return { ok: false, error: 'Mật khẩu xác nhận không chính xác.' };
        }
        return { ok: false, error: 'Không thể xác thực mật khẩu. Vui lòng thử lại hoặc dùng Quên mật khẩu.' };
      }
    }

    if (totpConfig?.enabled && totpConfig.secret) {
      const code = (options?.verificationCode || '').trim();
      if (!code) {
        return { ok: false, error: 'Vui lòng nhập mã OTP 6 số từ Authenticator hoặc mã khôi phục.' };
      }
      const normalizedInput = normalizeRecoveryCode(code);
      const isRecoveryMatch = (totpConfig.recoveryCodes || []).some(
        (c) => normalizeRecoveryCode(c) === normalizedInput
      );
      const isOtpMatch = /^\d{6}$/.test(code.replace(/\s+/g, ''))
        ? await verifyTotpToken(totpConfig.secret, code, 1)
        : false;
      if (!isOtpMatch && !isRecoveryMatch) {
        return { ok: false, error: 'Mã OTP Authenticator hoặc mã khôi phục không hợp lệ.' };
      }
    }

    const totpPath = `users/${currentUser.uid}/security/totp`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'security', 'totp'));
    } catch (err) {
      handleAuthFirestoreError(err, FirestoreOperationType.DELETE, totpPath);
    }

    await updateProfileData({
      twoFactorEnabled: false,
      twoFactorUpdatedAt: new Date().toISOString(),
    });

    setTotpConfig(null);
    clearAllTwoFactorSessionMarkers();
    setTwoFactorVerifiedThisSession(false);
    return { ok: true };
  };

  const sendVerificationEmailToCurrentUser = async () => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để gửi email xác minh.');
    }
    if (isSyntheticZaloEmail(currentUser.email)) {
      throw new Error(
        'Tài khoản Zalo chưa có Gmail thực. Hãy bấm "Liên kết Google" để gắn và xác minh Gmail.'
      );
    }
    auth.languageCode = 'vi';
    await sendEmailVerification(currentUser);
  };

  const refreshCurrentUserState = async () => {
    if (!currentUser) return;
    if (isZaloOnlySession || !auth.currentUser) return;
    await currentUser.reload();
    setProviderTick((t) => t + 1);
    await syncVerifiedIdentityLocks(currentUser, userProfile);
  };

  const linkGoogleAccount = async () => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để liên kết Gmail / Google.');
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    if (isZaloOnlySession || !auth.currentUser) {
      const pendingZalo = zaloOnlySessionRef.current?.profile || null;
      if (pendingZalo) {
        pendingZaloProfileRef.current = pendingZalo;
      }
      const cred = await signInWithPopup(auth, provider);
      zaloOnlySessionRef.current = null;
      clearStoredZaloOnlySession();
      setIsZaloOnlySession(false);
      if (pendingZalo) {
        await applyZaloProfileToUserDoc(cred.user, pendingZalo);
        pendingZaloProfileRef.current = null;
      }
      return;
    }

    try {
      await linkWithPopup(currentUser, provider);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/provider-already-linked') {
        // already linked
      } else if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        throw new Error('Tài khoản Gmail / Google này đã được liên kết với một tài khoản khác và không thể sử dụng.');
      } else if (code === 'auth/requires-recent-login') {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
        await linkWithPopup(currentUser, provider);
      } else {
        throw err;
      }
    }
    await currentUser.reload();
    setProviderTick((t) => t + 1);
    await syncVerifiedIdentityLocks(currentUser, userProfile);
    await upsertCurrentDeviceDoc(currentUser.uid, 'google');
  };

  const linkZaloAccount = async (): Promise<ZaloAuthProfile> => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để liên kết tài khoản Zalo.');
    }
    const res = await openZaloOAuthPopup('link');
    if (isZaloOnlySession || !auth.currentUser) {
      const zaloSession: StoredZaloOnlySession = {
        profile: res.zaloProfile,
        token: zaloOnlySessionRef.current?.token || '',
        rememberMe: zaloOnlySessionRef.current?.rememberMe ?? true,
        savedAt: Date.now(),
      };
      zaloOnlySessionRef.current = zaloSession;
      writeStoredZaloOnlySession(zaloSession);
      setCurrentUser(buildSyntheticZaloUser(res.zaloProfile));
      setUserProfile((prev) => buildInitialZaloOnlyUserProfile(res.zaloProfile, prev));
      return res.zaloProfile;
    }
    await applyZaloProfileToUserDoc(currentUser, res.zaloProfile);
    await syncVerifiedIdentityLocks(currentUser, {
      ...(userProfile || ({} as UserProfile)),
      zaloLinked: true,
      zaloId: res.zaloProfile.zaloId,
      zaloName: res.zaloProfile.name,
      zaloAvatarUrl: res.zaloProfile.avatarUrl,
    });
    return res.zaloProfile;
  };

  const confirmAndLockPhoneNumber = async (rawPhone: string): Promise<string> => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để xác nhận số điện thoại.');
    }
    const normalizedPhone = normalizeAndValidatePhone(rawPhone);
    if (!normalizedPhone) {
      throw new Error('Số điện thoại phải gồm đúng 10 chữ số (VD: 0912345678).');
    }
    if (isZaloOnlySession || !auth.currentUser) {
      const now = new Date().toISOString();
      await updateProfileData({
        phoneNumber: normalizedPhone,
        verifiedPhone: normalizedPhone,
        phoneVerified: true,
        phoneVerifiedAt: userProfile?.phoneVerifiedAt || now,
      });
      return normalizedPhone;
    }
    const isSuperAdminUser =
      isBootstrapAdminEmail(currentUser.email) || userProfile?.role === 'super_admin';
    const prevNormalizedPhone = normalizeAndValidatePhone(
      userProfile?.verifiedPhone || userProfile?.phoneNumber || ''
    );
    if (!isSuperAdminUser && userProfile?.phoneVerified && prevNormalizedPhone) {
      if (prevNormalizedPhone !== normalizedPhone) {
        throw new Error('Số điện thoại của tài khoản này đã được xác nhận và khoá cố định.');
      }
    }

    const lockId = buildPhoneLockId(normalizedPhone);
    const lockRes = await claimExclusiveIdentifierLock({
      lockId,
      type: 'phone',
      valueMasked: maskPhoneForLock(normalizedPhone),
      ownerUid: currentUser.uid,
    });
    if (!lockRes.ok) {
      throw new Error(lockRes.error || 'Số điện thoại này đã được tài khoản khác sử dụng.');
    }
    if (isSuperAdminUser && prevNormalizedPhone && prevNormalizedPhone !== normalizedPhone) {
      const prevLockId = buildPhoneLockId(prevNormalizedPhone);
      if (prevLockId && prevLockId !== lockId) {
        await releaseExclusiveIdentifierLock(prevLockId);
      }
    }

    const now = new Date().toISOString();
    const path = `users/${currentUser.uid}`;
    const updates = {
      phoneNumber: normalizedPhone,
      verifiedPhone: normalizedPhone,
      phoneVerified: true,
      phoneVerifiedAt: userProfile?.phoneVerifiedAt || now,
      updatedAt: now,
    };
    try {
      await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
      setUserProfile((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (err) {
      handleAuthFirestoreError(err, FirestoreOperationType.UPDATE, path);
    }
    return normalizedPhone;
  };

  const verifyAndLockCitizenId = async (
    rawCitizenId: string,
    verifiedDatabaseFields?: Partial<UserProfile>
  ) => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để xác minh số CCCD.');
    }
    const digits = rawCitizenId.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 12) {
      throw new Error('Số CCCD/ĐDCN phải gồm từ 9 đến 12 chữ số.');
    }
    const isSuperAdminUser =
      isBootstrapAdminEmail(currentUser.email) || userProfile?.role === 'super_admin';
    if (!isZaloOnlySession && auth.currentUser) {
      const prevDigits = (userProfile?.citizenId || '').replace(/\D/g, '');
      const lockId = buildCccdLockId(digits);
      const lockRes = await claimExclusiveIdentifierLock({
        lockId,
        type: 'cccd',
        valueMasked: maskCccdForLock(digits),
        ownerUid: currentUser.uid,
      });
      if (!lockRes.ok) {
        throw new Error(lockRes.error || 'Số CCCD này đã được tài khoản khác xác minh.');
      }
      if (
        (isSuperAdminUser || userProfile?.allowIdentityEditByAdmin) &&
        prevDigits &&
        prevDigits !== digits
      ) {
        await releaseExclusiveIdentifierLock(buildCccdLockId(prevDigits));
      }
    }
    const now = new Date().toISOString();
    const dbPayload: Partial<UserProfile> = verifiedDatabaseFields
      ? {
          displayName: (verifiedDatabaseFields.displayName || '').trim(),
          dob: verifiedDatabaseFields.dob || '',
          gender: verifiedDatabaseFields.gender || 'Nam',
          provinceCode: verifiedDatabaseFields.provinceCode || '',
          provinceName: verifiedDatabaseFields.provinceName || '',
          wardCode: verifiedDatabaseFields.wardCode || '',
          wardName: verifiedDatabaseFields.wardName || '',
          address: verifiedDatabaseFields.address || '',
          identityVerifiedFromDatabase: true,
          allowIdentityEditByAdmin: isSuperAdminUser ? true : false,
        }
      : {};

    await updateProfileData({
      ...dbPayload,
      citizenId: digits,
      citizenIdVerified: true,
      citizenIdVerifiedAt: now,
    });
  };

  const registerOrVerifyCurrentDevice = async (
    method: UserVerifiedDevice['verificationMethod'] = 'manual',
    customName?: string
  ) => {
    if (!currentUser || isZaloOnlySession || !auth.currentUser) return;
    await upsertCurrentDeviceDoc(currentUser.uid, method, customName, true);
  };

  const renameVerifiedDevice = async (deviceId: string, newName: string) => {
    if (!currentUser) return;
    const clean = newName.trim().slice(0, 128);
    if (!clean) return;
    const target = verifiedDevices.find((d) => d.deviceId === deviceId);
    if (!target) return;
    const devicePath = `users/${currentUser.uid}/devices/${deviceId}`;
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid, 'devices', deviceId),
        {
          ...target,
          deviceName: clean,
          lastActiveAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      handleAuthFirestoreError(err, FirestoreOperationType.UPDATE, devicePath);
    }
  };

  const removeVerifiedDevice = async (deviceId: string) => {
    if (!currentUser) return;
    const devicePath = `users/${currentUser.uid}/devices/${deviceId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'devices', deviceId));
      try {
        const idToken = await currentUser.getIdToken();
        await revokeServerBiometric({ idToken, deviceId });
        if (deviceId === currentDeviceMeta.current.deviceId) {
          setBiometricMeta(null);
        }
      } catch {
        // non-blocking
      }
    } catch (err) {
      handleAuthFirestoreError(err, FirestoreOperationType.DELETE, devicePath);
    }
  };

  const reauthenticateForMfa = async (passwordForReauth?: string) => {
    if (!currentUser) {
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    const hasPwd = Boolean(currentUser.providerData?.some((p) => p.providerId === 'password'));
    const hasGoogle = Boolean(currentUser.providerData?.some((p) => p.providerId === 'google.com'));

    if (passwordForReauth && currentUser.email) {
      const cred = EmailAuthProvider.credential(currentUser.email, passwordForReauth);
      await reauthenticateWithCredential(currentUser, cred);
      return;
    }
    if (hasGoogle && !hasPwd) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      return;
    }
    throw new Error('REQUIRES_REAUTH_PASSWORD');
  };

  const sendSmsMfaEnrollmentCode = async (
    rawPhone: string,
    recaptchaContainer?: HTMLElement | null,
    passwordForReauth?: string
  ): Promise<{ verificationId: string; normalizedPhone: string }> => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để thiết lập xác thực SMS MFA.');
    }
    try {
      await currentUser.reload();
    } catch {
      // ignore transient reload failure
    }
    setProviderTick((t) => t + 1);

    if (!currentUser.emailVerified) {
      const unverifiedErr = new Error('auth/unverified-email');
      (unverifiedErr as any).code = 'auth/unverified-email';
      throw unverifiedErr;
    }

    const normalizedPhone = normalizeVietnamPhoneToE164(rawPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      const invalidPhoneErr = new Error('auth/invalid-phone-number');
      (invalidPhoneErr as any).code = 'auth/invalid-phone-number';
      throw invalidPhoneErr;
    }

    // Enforce exclusive lock before sending SMS
    const phoneLockId = buildPhoneLockId(normalizedPhone);
    if (phoneLockId) {
      const avail = await checkIdentifierAvailability(phoneLockId, currentUser.uid);
      if (!avail.available) {
        throw new Error('Số điện thoại này đã được xác minh bởi tài khoản khác và không thể sử dụng.');
      }
    }

    const multiFactorUser = multiFactor(currentUser);
    let session;
    try {
      session = await multiFactorUser.getSession();
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        await reauthenticateForMfa(passwordForReauth);
        session = await multiFactorUser.getSession();
      } else {
        throw err;
      }
    }

    const verificationId = await runVerifyPhoneWithSafety(async (verifier) => {
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      return phoneAuthProvider.verifyPhoneNumber(
        { phoneNumber: normalizedPhone, session },
        verifier
      );
    }, recaptchaContainer);

    return { verificationId, normalizedPhone };
  };

  const confirmSmsMfaEnrollment = async (
    verificationId: string,
    smsCode: string,
    displayName?: string,
    normalizedPhone?: string
  ) => {
    if (!currentUser) {
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    const cleanCode = smsCode.replace(/\s+/g, '').trim();
    if (!cleanCode) {
      throw new Error('Vui lòng nhập mã OTP từ tin nhắn SMS.');
    }

    const cred = PhoneAuthProvider.credential(verificationId, cleanCode);
    const assertion = PhoneMultiFactorGenerator.assertion(cred);
    const multiFactorUser = multiFactor(currentUser);

    await multiFactorUser.enroll(assertion, displayName?.trim() || 'Số điện thoại SMS 2FA');
    clearSmsRecaptchaVerifier();

    try {
      await currentUser.reload();
    } catch {
      // ignore reload hiccup right after token refresh revocation
    }
    setProviderTick((t) => t + 1);

    const smsFactors = multiFactor(currentUser).enrolledFactors.filter(
      (f): f is PhoneMultiFactorInfo => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID
    );
    const resolvedPhone = normalizedPhone || smsFactors[0]?.phoneNumber || '';
    const maskedPhone = maskPhoneForProfile(resolvedPhone);

    if (resolvedPhone && !resolvedPhone.includes('*')) {
      const lockId = buildPhoneLockId(resolvedPhone);
      if (lockId) {
        await claimExclusiveIdentifierLock({
          lockId,
          type: 'phone',
          valueMasked: maskPhoneForLock(resolvedPhone),
          ownerUid: currentUser.uid,
        });
      }
    }

    const now = new Date().toISOString();
    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        smsMfaEnabled: smsFactors.length > 0,
        smsMfaPhoneMasked: maskedPhone,
        phoneVerified: true,
        ...(resolvedPhone && !resolvedPhone.includes('*')
          ? { verifiedPhone: resolvedPhone, phoneNumber: resolvedPhone }
          : {}),
        phoneVerifiedAt: userProfile?.phoneVerifiedAt || now,
        updatedAt: now,
      },
      { merge: true }
    );
    await upsertCurrentDeviceDoc(currentUser.uid, 'sms_mfa');
  };

  const sendPhoneVerificationOtp = async (
    rawPhone: string,
    passwordForReauth?: string
  ): Promise<PhoneVerificationSession> => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để xác minh số điện thoại.');
    }
    const normalizedPhone = normalizeVietnamPhoneToE164(rawPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      const invalidPhoneErr = new Error('auth/invalid-phone-number');
      (invalidPhoneErr as any).code = 'auth/invalid-phone-number';
      throw invalidPhoneErr;
    }

    // Exclusive lock check before sending SMS
    const phoneLockId = buildPhoneLockId(normalizedPhone);
    if (phoneLockId) {
      const avail = await checkIdentifierAvailability(phoneLockId, currentUser.uid);
      if (!avail.available) {
        throw new Error('Số điện thoại này đã được xác minh bởi tài khoản khác và không thể sử dụng.');
      }
    }

    // Prefer SMS MFA enrollment when email is verified; fall back to linkWithPhoneNumber otherwise
    if (currentUser.emailVerified) {
      try {
        const res = await sendSmsMfaEnrollmentCode(normalizedPhone, null, passwordForReauth);
        return {
          mode: 'mfa',
          normalizedPhone: res.normalizedPhone,
          verificationId: res.verificationId,
        };
      } catch (err: any) {
        const code = String(err?.code || '');
        if (
          code !== 'auth/operation-not-allowed' &&
          code !== 'auth/unsupported-first-factor' &&
          code !== 'auth/unverified-email'
        ) {
          throw err;
        }
      }
    }

    // Fallback or pre-email-verification: linkWithPhoneNumber
    const { verifier, errorPromise } = createFreshRecaptchaVerifier();
    try {
      auth.languageCode = 'vi';
      const confirmationResult = await Promise.race([
        linkWithPhoneNumber(currentUser, normalizedPhone, verifier),
        errorPromise,
      ]);
      return {
        mode: 'phone_link',
        normalizedPhone,
        confirmationResult,
      };
    } catch (err: any) {
      clearSmsRecaptchaVerifier();
      if (err?.code === 'auth/credential-already-in-use' || err?.code === 'auth/phone-number-already-exists') {
        throw new Error('Số điện thoại này đã được liên kết với tài khoản khác.');
      }
      throw err;
    }
  };

  const confirmPhoneVerificationOtp = async (
    session: PhoneVerificationSession,
    smsCode: string
  ) => {
    if (!currentUser) {
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    const cleanCode = smsCode.replace(/\s+/g, '').trim();
    if (cleanCode.length < 6) {
      throw new Error('Vui lòng nhập đủ 6 chữ số OTP.');
    }

    if (session.mode === 'mfa' && session.verificationId) {
      await confirmSmsMfaEnrollment(
        session.verificationId,
        cleanCode,
        'Số điện thoại chính',
        session.normalizedPhone
      );
      return;
    }

    if (session.mode === 'phone_link' && session.confirmationResult) {
      await session.confirmationResult.confirm(cleanCode);
      clearSmsRecaptchaVerifier();
      try {
        await currentUser.reload();
      } catch {
        // ignore
      }
      setProviderTick((t) => t + 1);
      const lockId = buildPhoneLockId(session.normalizedPhone);
      if (lockId) {
        const lockRes = await claimExclusiveIdentifierLock({
          lockId,
          type: 'phone',
          valueMasked: maskPhoneForLock(session.normalizedPhone),
          ownerUid: currentUser.uid,
        });
        if (!lockRes.ok) {
          throw new Error(lockRes.error || 'Số điện thoại đã được tài khoản khác xác minh.');
        }
      }
      const now = new Date().toISOString();
      await setDoc(
        doc(db, 'users', currentUser.uid),
        {
          phoneVerified: true,
          verifiedPhone: session.normalizedPhone,
          phoneNumber: session.normalizedPhone,
          phoneVerifiedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
      await upsertCurrentDeviceDoc(currentUser.uid, 'sms_otp');
      return;
    }

    throw new Error('Phiên xác minh SMS không hợp lệ.');
  };

  const unenrollSmsMfaFactor = async (
    factorOrUid: MultiFactorInfo | string,
    passwordForReauth?: string
  ) => {
    if (!currentUser) {
      throw new Error('Bạn cần đăng nhập để thực hiện thao tác này.');
    }
    const multiFactorUser = multiFactor(currentUser);
    try {
      await multiFactorUser.unenroll(factorOrUid);
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        await reauthenticateForMfa(passwordForReauth);
        await multiFactorUser.unenroll(factorOrUid);
      } else {
        throw err;
      }
    }

    try {
      await currentUser.reload();
    } catch {
      // ignore reload hiccup
    }
    setProviderTick((t) => t + 1);

    const remainingSms = multiFactor(currentUser).enrolledFactors.filter(
      (f): f is PhoneMultiFactorInfo => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID
    );
    await updateProfileData({
      smsMfaEnabled: remainingSms.length > 0,
      smsMfaPhoneMasked: remainingSms[0] ? maskPhoneForProfile(remainingSms[0].phoneNumber) : '',
    });
  };

  const sendSmsMfaSignInCode = async (
    hintIndex: number,
    recaptchaContainer?: HTMLElement | null
  ): Promise<string> => {
    if (!pendingSmsMfaResolver) {
      throw new Error('Không tìm thấy phiên xác thực đa yếu tố đang chờ.');
    }
    const hints = pendingSmsMfaResolver.hints || [];
    const selectedHint = hints[hintIndex] || hints[0];
    if (!selectedHint) {
      throw new Error('Tài khoản chưa có số điện thoại xác thực hợp lệ.');
    }

    return runVerifyPhoneWithSafety(async (verifier) => {
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      return phoneAuthProvider.verifyPhoneNumber(
        {
          multiFactorHint: selectedHint,
          session: pendingSmsMfaResolver.session,
        },
        verifier
      );
    }, recaptchaContainer);
  };

  const resolveSmsMfaSignIn = async (verificationId: string, smsCode: string) => {
    if (!pendingSmsMfaResolver) {
      throw new Error('Phiên xác thực SMS MFA đã hết hạn, vui lòng đăng nhập lại.');
    }
    const cleanCode = smsCode.replace(/\s+/g, '').trim();
    const cred = PhoneAuthProvider.credential(verificationId, cleanCode);
    const assertion = PhoneMultiFactorGenerator.assertion(cred);
    await pendingSmsMfaResolver.resolveSignIn(assertion);
    clearPendingSmsMfaResolver();
  };

  void providerTick;
  const isSyntheticZalo = isSyntheticZaloEmail(currentUser?.email);
  const hasPasswordProvider = Boolean(
    currentUser?.providerData?.some((p) => p.providerId === 'password') && !isSyntheticZalo
  );
  const hasGoogleProvider = Boolean(
    currentUser?.providerData?.some((p) => p.providerId === 'google.com')
  );
  const hasFacebookProvider = Boolean(
    currentUser?.providerData?.some((p) => p.providerId === 'facebook.com') ||
      userProfile?.facebookLinked
  );
  const hasZaloProvider = Boolean(
    isSyntheticZalo || userProfile?.zaloLinked || userProfile?.zaloId
  );

  const enrolledSmsFactors: PhoneMultiFactorInfo[] =
    currentUser && !isZaloOnlySession && auth.currentUser
      ? multiFactor(currentUser).enrolledFactors.filter(
          (f): f is PhoneMultiFactorInfo => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID
        )
      : [];
  const smsMfaEnabled = enrolledSmsFactors.length > 0;

  useEffect(() => {
    if (!userProfile || userProfile.status !== 'banned' || userProfile.banType !== 'temporary') {
      return;
    }
    const untilMs = getBannedUntilMs(userProfile);
    if (!untilMs) return;
    const updateNow = () => setBanNowTick(Date.now());
    updateNow();
    const diff = untilMs - Date.now();
    if (diff <= 0) return;

    const timer = window.setInterval(updateNow, 15000);
    const exactTimeout = diff <= 24 * 60 * 60 * 1000
      ? window.setTimeout(updateNow, diff + 300)
      : undefined;
    return () => {
      window.clearInterval(timer);
      if (exactTimeout !== undefined) window.clearTimeout(exactTimeout);
    };
  }, [userProfile]);

  const isPrimaryAdmin = isBootstrapAdminEmail(currentUser?.email);

  const currentActualRole: RoleType = isPrimaryAdmin
    ? 'super_admin'
    : userProfile?.role || 'citizen';

  const currentActualAccountType: AccountType = isPrimaryAdmin
    ? 'admin'
    : userProfile?.accountType || 'citizen';

  const activeRole: RoleType = simulatedRole ? simulatedRole.role : currentActualRole;
  const activeAccountType: AccountType = simulatedRole ? simulatedRole.accountType : currentActualAccountType;

  const isActualAdmin = Boolean(
    isPrimaryAdmin ||
      currentActualRole === 'super_admin' ||
      currentActualRole === 'admin' ||
      currentActualAccountType === 'admin'
  );

  const isAdmin = simulatedRole
    ? activeAccountType === 'admin' || activeRole === 'super_admin' || activeRole === 'admin'
    : isActualAdmin;

  const isStaff = simulatedRole
    ? isAdmin || activeAccountType === 'employee' || ['doctor', 'nurse', 'communicator', 'staff', 'leadership'].includes(activeRole)
    : isAdmin || activeAccountType === 'employee' || ['doctor', 'nurse', 'communicator', 'staff', 'leadership'].includes(activeRole);

  const isCitizen = !isAdmin && !isStaff;

  const isSuperAdminActual = Boolean(isPrimaryAdmin || currentActualRole === 'super_admin');
  const isSuperAdmin = simulatedRole ? activeRole === 'super_admin' : isSuperAdminActual;

  const isBanned = Boolean(currentUser && !isActualAdmin && isUserActivelyBanned(userProfile, banNowTick));

  const twoFactorEnabled = Boolean(
    totpConfig?.enabled && Boolean(totpConfig?.secret)
  );
  // Admin đặc cách bỏ qua xác thực 2FA khi mở khóa phiên
  const isAdminTwoFactorExempt = isActualAdmin || isAdmin;
  const requiresTwoFactorVerification = Boolean(
    currentUser &&
      !isBanned &&
      !isAdminTwoFactorExempt &&
      !twoFactorLoading &&
      twoFactorEnabled &&
      !twoFactorVerifiedThisSession
  );

  const currentDeviceId = currentDeviceMeta.current.deviceId;
  const currentDeviceTrusted = Boolean(
    verifiedDevices.find((d) => d.deviceId === currentDeviceId)?.isTrusted
  );

  // Active session heartbeat (every 60s + tab focus) while authenticated & not banned
  useEffect(() => {
    if (!currentUser || isBanned || isZaloOnlySession || !auth.currentUser) return;
    let disposed = false;

    const sendHeartbeat = async (force = false) => {
      if (disposed || isFirestoreWriteQuotaExceeded() || remoteRevokeInProgressRef.current) return;
      const nowMs = Date.now();
      if (!force && nowMs - lastHeartbeatWriteMsRef.current < 45_000) return;
      const meta = currentDeviceMeta.current;
      const existingDev = verifiedDevicesRef.current.find((d) => d.deviceId === meta.deviceId);
      if (!existingDev) return;
      // Do not overwrite if this session has already been remotely revoked
      if (
        existingDev?.forceLogoutSessionId &&
        existingDev.forceLogoutSessionId === currentSessionIdRef.current
      ) {
        return;
      }
      const now = new Date().toISOString();
      const payload: UserVerifiedDevice = {
        deviceId: meta.deviceId,
        deviceName: (existingDev?.deviceName || meta.deviceName).slice(0, 128),
        platform: meta.platform,
        os: meta.os,
        browser: meta.browser,
        isTrusted: Boolean(existingDev.isTrusted),
        verificationMethod:
          existingDev?.verificationMethod || resolveVerificationMethodFromUser(currentUser),
        ...(typeof existingDev?.biometricEnabled === 'boolean'
          ? { biometricEnabled: existingDev.biometricEnabled }
          : {}),
        verifiedAt: existingDev?.verifiedAt || now,
        firstSeenAt: existingDev?.firstSeenAt || now,
        lastActiveAt: now,
        activeSessionId: currentSessionIdRef.current,
        isSessionActive: true,
        sessionStartedAt: sessionStartedAtRef.current || now,
        lastHeartbeatAt: now,
        lastHeartbeatMs: nowMs,
        forceLogoutSessionId: '',
        forceLogoutRequestedAt: '',
      };
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'devices', meta.deviceId), payload, { merge: true });
        lastHeartbeatWriteMsRef.current = nowMs;
      } catch (err) {
        markFirestoreWriteQuotaExceededIfMatch(err);
      }
    };

    const intervalId = window.setInterval(() => {
      setSessionNowTick(Date.now());
      void sendHeartbeat(false);
    }, 60_000);

    const tickId = window.setInterval(() => {
      setSessionNowTick(Date.now());
    }, 30_000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        setSessionNowTick(Date.now());
        void sendHeartbeat(false);
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.clearInterval(tickId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [currentUser, isBanned, isZaloOnlySession]);

  // Remote revocation check: if another device clicked "Không phải tôi", sign out immediately
  useEffect(() => {
    if (!currentUser) return;
    const myDoc = verifiedDevices.find((d) => d.deviceId === currentDeviceId);
    if (
      myDoc &&
      myDoc.forceLogoutSessionId &&
      myDoc.forceLogoutSessionId === currentSessionId &&
      !remoteRevokeInProgressRef.current
    ) {
      remoteRevokeInProgressRef.current = true;
      setRemoteRevokedNotice(true);
      void logoutInternal({ keepRevokedNotice: true, skipInactiveWrite: true });
    }
  }, [currentUser, verifiedDevices, currentDeviceId, currentSessionId, logoutInternal]);

  const concurrentActiveDevices = useMemo(() => {
    if (!currentUser || isBanned) return [];
    const currentDevDoc = verifiedDevices.find((d) => d.deviceId === currentDeviceId);
    if (!currentDevDoc) return [];
    const isCurrentTrusted = Boolean(currentDevDoc.isTrusted);
    return verifiedDevices.filter((d) => {
      if (!d || d.deviceId === currentDeviceId) return false;
      if (d.isSessionActive !== true) return false;
      if (typeof d.lastHeartbeatMs !== 'number') return false;
      if (sessionNowTick - d.lastHeartbeatMs > CONCURRENT_SESSION_TTL_MS) return false;
      if (d.forceLogoutSessionId && d.activeSessionId && d.forceLogoutSessionId === d.activeSessionId) {
        return false;
      }
      // Once both devices are approved/trusted, do NOT trigger Concurrent Login alert
      if (isCurrentTrusted && d.isTrusted === true) {
        return false;
      }
      const ackKey = `${d.deviceId}:${d.activeSessionId || d.sessionStartedAt || ''}`;
      if (acknowledgedSessionKeys.includes(ackKey)) return false;
      return true;
    });
  }, [currentUser, isBanned, verifiedDevices, currentDeviceId, sessionNowTick, acknowledgedSessionKeys]);

  const approveTrustedDevice = useCallback(
    async (deviceId: string) => {
      if (!currentUser || !deviceId) return;
      const target = verifiedDevicesRef.current.find((d) => d.deviceId === deviceId);
      if (!target) return;
      const now = new Date().toISOString();
      const devicePath = `users/${currentUser.uid}/devices/${deviceId}`;
      const payload: UserVerifiedDevice = {
        deviceId: target.deviceId,
        deviceName: (target.deviceName || 'Thiết bị').slice(0, 128),
        platform: target.platform || 'desktop',
        ...(target.os ? { os: target.os } : {}),
        ...(target.browser ? { browser: target.browser } : {}),
        isTrusted: true,
        verificationMethod: target.verificationMethod || 'password',
        ...(typeof target.biometricEnabled === 'boolean'
          ? { biometricEnabled: target.biometricEnabled }
          : {}),
        verifiedAt: target.verifiedAt || now,
        ...(target.firstSeenAt ? { firstSeenAt: target.firstSeenAt } : {}),
        lastActiveAt: target.lastActiveAt || now,
        ...(target.activeSessionId ? { activeSessionId: target.activeSessionId } : {}),
        ...(typeof target.isSessionActive === 'boolean' ? { isSessionActive: target.isSessionActive } : {}),
        ...(target.sessionStartedAt ? { sessionStartedAt: target.sessionStartedAt } : {}),
        ...(target.lastHeartbeatAt ? { lastHeartbeatAt: target.lastHeartbeatAt } : {}),
        ...(typeof target.lastHeartbeatMs === 'number' ? { lastHeartbeatMs: target.lastHeartbeatMs } : {}),
        forceLogoutSessionId: target.forceLogoutSessionId || '',
        forceLogoutRequestedAt: target.forceLogoutRequestedAt || '',
      };
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'devices', deviceId), payload, { merge: true });
      } catch (err) {
        handleAuthFirestoreError(err, FirestoreOperationType.UPDATE, devicePath);
      }
    },
    [currentUser]
  );

  const dismissConcurrentLoginAlert = useCallback(
    async (devices?: UserVerifiedDevice[]) => {
      const targetList = devices && devices.length > 0 ? devices : concurrentActiveDevices;
      if (targetList.length === 0) return;
      const newKeys = targetList.map(
        (d) => `${d.deviceId}:${d.activeSessionId || d.sessionStartedAt || ''}`
      );
      setAcknowledgedSessionKeys((prev) => {
        const merged = Array.from(new Set([...prev, ...newKeys]));
        writeAckConcurrentKeys(merged);
        return merged;
      });
      if (currentUser && currentDeviceTrusted) {
        await Promise.all(
          targetList
            .filter((d) => d.isTrusted !== true)
            .map((d) => approveTrustedDevice(d.deviceId).catch(() => {}))
        );
      }
    },
    [concurrentActiveDevices, currentUser, currentDeviceTrusted, approveTrustedDevice]
  );

  const revokeConcurrentDeviceSession = useCallback(
    async (targetDevice: UserVerifiedDevice) => {
      if (!currentUser || !targetDevice?.deviceId) return;
      const now = new Date().toISOString();
      const devicePath = `users/${currentUser.uid}/devices/${targetDevice.deviceId}`;
      const payload: UserVerifiedDevice = {
        deviceId: targetDevice.deviceId,
        deviceName: (targetDevice.deviceName || 'Thiết bị khác').slice(0, 128),
        platform: targetDevice.platform || 'desktop',
        ...(targetDevice.os ? { os: targetDevice.os } : {}),
        ...(targetDevice.browser ? { browser: targetDevice.browser } : {}),
        isTrusted: false,
        verificationMethod: targetDevice.verificationMethod || 'password',
        biometricEnabled: false,
        verifiedAt: targetDevice.verifiedAt || now,
        firstSeenAt: targetDevice.firstSeenAt || now,
        lastActiveAt: now,
        activeSessionId: targetDevice.activeSessionId || '',
        isSessionActive: false,
        sessionStartedAt: targetDevice.sessionStartedAt || now,
        lastHeartbeatAt: targetDevice.lastHeartbeatAt || now,
        lastHeartbeatMs: typeof targetDevice.lastHeartbeatMs === 'number' ? targetDevice.lastHeartbeatMs : 0,
        forceLogoutSessionId: targetDevice.activeSessionId || 'revoked',
        forceLogoutRequestedAt: now,
      };
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'devices', targetDevice.deviceId), payload, {
          merge: true,
        });
        await dismissConcurrentLoginAlert([targetDevice]);
      } catch (err) {
        handleAuthFirestoreError(err, FirestoreOperationType.UPDATE, devicePath);
      }
    },
    [currentUser, dismissConcurrentLoginAlert]
  );

  const clearRemoteRevokedNotice = useCallback(() => {
    setRemoteRevokedNotice(false);
  }, []);

  const [sepayVerifiedInfo, setSepayVerifiedInfo] = useState<VipStatusInfo | null>(null);

  useEffect(() => {
    let active = true;
    if (!currentUser?.uid) {
      setSepayVerifiedInfo(null);
      return;
    }
    fetchMyVipStatus()
      .then((info) => {
        if (active) setSepayVerifiedInfo(info);
      })
      .catch(() => {
        // non-blocking
      });

    const handleVerifiedUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<VipStatusInfo>)?.detail;
      if (detail) {
        setSepayVerifiedInfo(detail);
      } else {
        fetchMyVipStatus()
          .then((info) => {
            if (active) setSepayVerifiedInfo(info);
          })
          .catch(() => {});
      }
    };
    window.addEventListener('tyt-sepay-verified-updated', handleVerifiedUpdate);
    return () => {
      active = false;
      window.removeEventListener('tyt-sepay-verified-updated', handleVerifiedUpdate);
    };
  }, [currentUser?.uid]);

  const effectiveUserProfile = useMemo<UserProfile | null>(() => {
    if (!userProfile) return null;
    if (!sepayVerifiedInfo || !sepayVerifiedInfo.isVip) return userProfile;
    return {
      ...userProfile,
      isVip: true,
      vipTier: sepayVerifiedInfo.vipTier || userProfile.vipTier,
      vipPackageName: sepayVerifiedInfo.vipPackageName || userProfile.vipPackageName,
      vipActivatedAt: sepayVerifiedInfo.vipActivatedAt || userProfile.vipActivatedAt,
      vipExpiresAt: sepayVerifiedInfo.vipExpiresAt || userProfile.vipExpiresAt,
      vipOrderCode: sepayVerifiedInfo.vipOrderCode || userProfile.vipOrderCode,
    };
  }, [userProfile, sepayVerifiedInfo]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile: effectiveUserProfile,
        loading,
        activeRole,
        activeAccountType,
        isAdmin,
        isStaff,
        isCitizen,
        isPrimaryAdmin,
        isSuperAdmin,
        isBanned,
        hasPasswordProvider,
        hasGoogleProvider,
        hasFacebookProvider,
        hasZaloProvider,
        totpConfig,
        twoFactorEnabled,
        twoFactorVerifiedThisSession,
        twoFactorLoading,
        requiresTwoFactorVerification,
        enrolledSmsFactors,
        smsMfaEnabled,
        pendingSmsMfaResolver,
        verifiedDevices,
        currentDeviceId,
        currentDeviceTrusted,
        currentSessionId,
        concurrentActiveDevices,
        remoteRevokedNotice,
        dismissConcurrentLoginAlert,
        approveTrustedDevice,
        revokeConcurrentDeviceSession,
        clearRemoteRevokedNotice,
        clearPendingSmsMfaResolver,
        sendVerificationEmailToCurrentUser,
        refreshCurrentUserState,
        linkGoogleAccount,
        linkZaloAccount,
        sendPhoneVerificationOtp,
        confirmPhoneVerificationOtp,
        confirmAndLockPhoneNumber,
        verifyAndLockCitizenId,
        registerOrVerifyCurrentDevice,
        renameVerifiedDevice,
        removeVerifiedDevice,
        sendSmsMfaEnrollmentCode,
        confirmSmsMfaEnrollment,
        unenrollSmsMfaFactor,
        sendSmsMfaSignInCode,
        resolveSmsMfaSignIn,
        signInWithGoogle,
        signInWithFacebook,
        signInWithZalo,
        signInWithProviderMethod,
        signInWithQrHandoff,
        signInWithBiometric,
        biometricEnvironment,
        biometricMeta,
        activateDeviceBiometric,
        deactivateDeviceBiometric,
        updateBiometricAppLock,
        verifyBiometricUnlockForPwa,
        refreshBiometricStatus,
        loginWithEmail,
        sendPasswordReset,
        registerWithEmail,
        logout,
        switchPreviewRole,
        resetRoleToActual,
        isSimulatingRole: !!simulatedRole,
        updateProfileData,
        linkEmailPassword,
        changeAccountPassword,
        verifyAccountPassword,
        verifySessionTwoFactorOtp,
        enableTwoFactorAuth,
        disableTwoFactorAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
