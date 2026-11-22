import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ZaloAuthMode = 'login' | 'link';

export interface ZaloUserProfilePayload {
  zaloId: string;
  name: string;
  avatarUrl: string;
  phoneNumber: string;
  rawPhone?: string;
}

export interface ZaloCompletionResponse {
  ok: boolean;
  mode: ZaloAuthMode;
  zaloProfile: ZaloUserProfilePayload;
  bridgeAuth?: {
    email: string;
    secret: string;
  };
  firebaseBridgeDisabled?: boolean;
  firebaseBridgeReason?: string;
  zaloSessionToken?: string;
}

interface PendingOAuthSession {
  state: string;
  pollToken: string;
  codeVerifier: string;
  redirectUri: string;
  mode: ZaloAuthMode;
  exp: number;
}

interface PendingPollRecord {
  state: string;
  pollToken: string;
  status: 'pending' | 'success' | 'error';
  mode: ZaloAuthMode;
  exchangeCode?: string;
  error?: string;
  exp: number;
}

interface PendingExchangeRecord {
  exchangeCode: string;
  mode: ZaloAuthMode;
  zaloProfile: ZaloUserProfilePayload;
  exp: number;
}

interface SealedZaloSessionPayload {
  p: ZaloUserProfilePayload;
  iat: number;
  exp: number;
}

const OAUTH_COOKIE_NAME = 'tyt_zalo_oauth_v1';
const EXCHANGE_COOKIE_NAME = 'tyt_zalo_xchg_v1';
const SESSION_COOKIE_NAME = 'tyt_zalo_session_v1';
const OAUTH_SESSION_TTL_MS = 5 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;
const ZALO_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const globalForZalo = globalThis as typeof globalThis & {
  __tytZaloPendingOAuthMap?: Map<string, PendingOAuthSession>;
  __tytZaloConsumedStates?: Map<string, number>;
  __tytZaloPendingPollMap?: Map<string, PendingPollRecord>;
  __tytZaloPendingExchangeMap?: Map<string, PendingExchangeRecord>;
  __tytZaloConsumedExchangeCodes?: Map<string, number>;
};

const pendingOAuthMap =
  globalForZalo.__tytZaloPendingOAuthMap || new Map<string, PendingOAuthSession>();
const consumedStates =
  globalForZalo.__tytZaloConsumedStates || new Map<string, number>();
const pendingPollMap =
  globalForZalo.__tytZaloPendingPollMap || new Map<string, PendingPollRecord>();
const pendingExchangeMap =
  globalForZalo.__tytZaloPendingExchangeMap || new Map<string, PendingExchangeRecord>();
const consumedExchangeCodes =
  globalForZalo.__tytZaloConsumedExchangeCodes || new Map<string, number>();

globalForZalo.__tytZaloPendingOAuthMap = pendingOAuthMap;
globalForZalo.__tytZaloConsumedStates = consumedStates;
globalForZalo.__tytZaloPendingPollMap = pendingPollMap;
globalForZalo.__tytZaloPendingExchangeMap = pendingExchangeMap;
globalForZalo.__tytZaloConsumedExchangeCodes = consumedExchangeCodes;

const PKCE_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PKCE_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const PKCE_DIGITS = '0123456789';
const PKCE_ALPHABET = `${PKCE_UPPER}${PKCE_LOWER}${PKCE_DIGITS}`;

function pruneExpiredMaps(): void {
  const now = Date.now();
  for (const [key, val] of pendingOAuthMap.entries()) {
    if (val.exp <= now) pendingOAuthMap.delete(key);
  }
  for (const [key, exp] of consumedStates.entries()) {
    if (exp <= now) consumedStates.delete(key);
  }
  for (const [key, val] of pendingPollMap.entries()) {
    if (val.exp <= now) pendingPollMap.delete(key);
  }
  for (const [key, val] of pendingExchangeMap.entries()) {
    if (val.exp <= now) pendingExchangeMap.delete(key);
  }
  for (const [key, exp] of consumedExchangeCodes.entries()) {
    if (exp <= now) consumedExchangeCodes.delete(key);
  }
}

export function getZaloEnvConfig(): {
  appId: string;
  appSecret: string;
  configured: boolean;
} {
  const rawId = String(process.env.ZALO_APP_ID || '').trim();
  const rawSecret = String(process.env.ZALO_APP_SECRET || '').trim();
  const appId = rawId && rawId !== 'MY_ZALO_APP_ID' ? rawId : '';
  const appSecret = rawSecret && rawSecret !== 'MY_ZALO_APP_SECRET' ? rawSecret : '';
  return {
    appId,
    appSecret,
    configured: Boolean(appId && appSecret),
  };
}

function deriveCookieKey(appSecret: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(`${appSecret}:tyt-zalo-cookie-seal-v1`, 'utf8')
    .digest();
}

function sealJsonCookie(payload: unknown, appSecret: string): string {
  const key = deriveCookieKey(appSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function unsealJsonCookie<T>(token: string, appSecret: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const encrypted = Buffer.from(parts[2], 'base64url');
    const key = deriveCookieKey(appSecret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const parsed = JSON.parse(decrypted.toString('utf8')) as T;
    return parsed;
  } catch {
    return null;
  }
}

function sealCompactToken(payload: unknown, appSecret: string): string {
  const key = deriveCookieKey(appSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function unsealCompactToken<T>(token: string, appSecret: string): T | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length <= 28) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const key = deriveCookieKey(appSecret);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

function parseCookies(req: any): Record<string, string> {
  const header = String(req?.headers?.cookie || '');
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function appendSetCookie(res: any, cookieStr: string): void {
  const existing = res.getHeader?.('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', [cookieStr]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [String(existing), cookieStr]);
  }
}

function buildCookieString(name: string, value: string, maxAgeSeconds: number, isLocalHttp: boolean): string {
  const encoded = encodeURIComponent(value);
  if (isLocalHttp) {
    return `${name}=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  }
  return `${name}=${encoded}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${maxAgeSeconds}`;
}

function isLocalHttpRequest(req: any): boolean {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').toLowerCase();
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0]?.trim().toLowerCase();
  if (proto === 'https') return false;
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

export function resolvePublicOrigin(req?: any): string {
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
    const proto = forwardedProto || (rawHost.includes('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https');
    return `${proto}://${rawHost}`.replace(/\/+$/, '');
  }

  return 'https://tyt.slhd.id.vn';
}

export function getZaloRedirectUri(req?: any): string {
  return `${resolvePublicOrigin(req)}/api/auth/zalo/callback`;
}

export function generateZaloCodeVerifier(): string {
  const chars: string[] = [
    PKCE_UPPER[crypto.randomInt(0, PKCE_UPPER.length)],
    PKCE_LOWER[crypto.randomInt(0, PKCE_LOWER.length)],
    PKCE_DIGITS[crypto.randomInt(0, PKCE_DIGITS.length)],
  ];
  while (chars.length < 43) {
    chars.push(PKCE_ALPHABET[crypto.randomInt(0, PKCE_ALPHABET.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

export function generateZaloCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier, 'ascii')
    .digest('base64url');
}

export function computeZaloAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto
    .createHmac('sha256', appSecret)
    .update(accessToken, 'utf8')
    .digest('hex')
    .toLowerCase();
}

export function normalizeVietnamesePhone(raw?: unknown): string {
  if (raw === undefined || raw === null) return '';
  let digits = String(raw).replace(/\D/g, '').trim();
  if (!digits) return '';
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  if (/^0\d{9}$/.test(digits)) {
    return digits;
  }
  return '';
}

function escapeHtmlText(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForInlineScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function renderPopupCallbackHtml(payload: {
  ok: boolean;
  exchangeCode?: string;
  state?: string;
  mode?: ZaloAuthMode;
  error?: string;
}): string {
  const msg = payload.ok
    ? {
        type: 'ZALO_OAUTH_SUCCESS',
        exchangeCode: payload.exchangeCode || '',
        state: payload.state || '',
        mode: payload.mode || 'login',
      }
    : {
        type: 'ZALO_OAUTH_ERROR',
        error: payload.error || 'Đăng nhập Zalo không thành công.',
        state: payload.state || '',
        mode: payload.mode || 'login',
      };

  const title = payload.ok ? 'Đăng nhập Zalo thành công' : 'Đăng nhập Zalo thất bại';
  const heading = payload.ok
    ? 'Đã xác thực tài khoản Zalo thành công'
    : 'Không thể hoàn tất đăng nhập Zalo';
  const subtext = payload.ok
    ? 'Cửa sổ này sẽ tự đóng và quay lại Cổng Thông Tin Trạm Y Tế...'
    : payload.error || 'Vui lòng đóng cửa sổ này và thử lại.';

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtmlText(title)}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 20px;
      text-align: center;
    }
    .card {
      max-width: 380px;
      width: 100%;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      padding: 24px 20px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: ${payload.ok ? '#eef5ff' : '#fff1f2'};
      border: 1px solid ${payload.ok ? '#bfdbfe' : '#fecdd3'};
      margin-bottom: 12px;
      padding: 6px;
      box-sizing: border-box;
    }
    .badge img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    h1 { font-size: 16px; margin: 0 0 8px; }
    p { font-size: 13px; color: #475569; margin: 0 0 16px; line-height: 1.5; }
    button {
      border: 0;
      border-radius: 12px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      background: #0f766e;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><img src="/zalo.png" alt="Zalo" /></div>
    <h1>${escapeHtmlText(heading)}</h1>
    <p>${escapeHtmlText(subtext)}</p>
    <button type="button" onclick="window.close()">Đóng cửa sổ</button>
  </div>
  <script>
    (function () {
      var payload = ${serializeForInlineScript(msg)};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, '*');
        }
      } catch (e) {}
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          var bc = new BroadcastChannel('tyt_zalo_oauth_channel');
          bc.postMessage(payload);
          setTimeout(function () { try { bc.close(); } catch (e) {} }, 300);
        }
      } catch (e) {}
      try {
        if (payload.state && typeof localStorage !== 'undefined') {
          localStorage.setItem('tyt_zalo_oauth_result_' + payload.state, JSON.stringify({
            payload: payload,
            ts: Date.now()
          }));
        }
      } catch (e) {}
      setTimeout(function () {
        try { window.close(); } catch (e) {}
      }, ${payload.ok ? 350 : 1400});
    })();
  </script>
</body>
</html>`;
}

function readFirebaseWebApiKey(): string {
  const envKey = String(process.env.FIREBASE_WEB_API_KEY || '').trim();
  if (envKey) return envKey;
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
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      return String(cfg?.apiKey || '').trim();
    }
  } catch {
    // ignore
  }
  return '';
}

function buildFirebaseBridgeCredentials(
  zaloId: string,
  appSecret: string
): { email: string; secret: string } {
  const safeId = zaloId.replace(/[^a-zA-Z0-9_-]/g, '');
  const email = `zalo_${safeId}@zalo.tyt.local`;
  const digest = crypto
    .createHmac('sha256', `${appSecret}:tyt-firebase-bridge-v1`)
    .update(zaloId, 'utf8')
    .digest('hex');
  const secret = `Zalo#${digest.slice(0, 32)}`;
  return { email, secret };
}

async function ensureFirebaseBridgeAccount(
  zaloProfile: ZaloUserProfilePayload,
  appSecret: string
): Promise<{
  bridgeAuth?: { email: string; secret: string };
  firebaseBridgeDisabled?: boolean;
  reason?: string;
}> {
  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    return {
      firebaseBridgeDisabled: true,
      reason: 'MISSING_FIREBASE_API_KEY',
    };
  }

  const creds = buildFirebaseBridgeCredentials(zaloProfile.zaloId, appSecret);
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`;
  const updateUrl = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`;

  let idToken = '';

  const signInResp = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: creds.email,
      password: creds.secret,
      returnSecureToken: true,
    }),
  });
  const signInData = (await signInResp.json().catch(() => ({}))) as {
    idToken?: string;
    error?: { message?: string };
  };

  if (signInResp.ok && signInData.idToken) {
    idToken = signInData.idToken;
  } else {
    const errMsg = String(signInData?.error?.message || '');
    if (
      errMsg.includes('PASSWORD_LOGIN_DISABLED') ||
      errMsg.includes('OPERATION_NOT_ALLOWED')
    ) {
      return {
        firebaseBridgeDisabled: true,
        reason: errMsg,
      };
    }

    const canTrySignUp =
      errMsg.includes('EMAIL_NOT_FOUND') ||
      errMsg.includes('INVALID_LOGIN_CREDENTIALS') ||
      errMsg.includes('INVALID_PASSWORD');
    if (!canTrySignUp) {
      throw new Error(`Không thể xác thực tài khoản cầu nối Firebase (${errMsg || signInResp.status}).`);
    }

    const signUpResp = await fetch(signUpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: creds.email,
        password: creds.secret,
        returnSecureToken: true,
      }),
    });
    const signUpData = (await signUpResp.json().catch(() => ({}))) as {
      idToken?: string;
      error?: { message?: string };
    };
    if (!signUpResp.ok || !signUpData.idToken) {
      const signUpErr = String(signUpData?.error?.message || '');
      if (
        signUpErr.includes('OPERATION_NOT_ALLOWED') ||
        signUpErr.includes('PASSWORD_LOGIN_DISABLED') ||
        signUpErr.includes('EMAIL_EXISTS')
      ) {
        return {
          firebaseBridgeDisabled: true,
          reason: signUpErr,
        };
      }
      throw new Error(`Không thể khởi tạo phiên tài khoản Zalo (${signUpErr || signUpResp.status}).`);
    }
    idToken = signUpData.idToken;
  }

  if (idToken && (zaloProfile.name || zaloProfile.avatarUrl)) {
    try {
      await fetch(updateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          ...(zaloProfile.name ? { displayName: zaloProfile.name } : {}),
          ...(zaloProfile.avatarUrl ? { photoUrl: zaloProfile.avatarUrl } : {}),
          returnSecureToken: false,
        }),
      });
    } catch {
      // non-blocking Firebase Auth profile metadata sync
    }
  }

  return { bridgeAuth: creds };
}

export function getZaloStatusPayload(req?: any) {
  const cfg = getZaloEnvConfig();
  return {
    ok: true,
    configured: cfg.configured,
    callbackUrl: getZaloRedirectUri(req),
    missingVars: [
      ...(!cfg.appId ? ['ZALO_APP_ID'] : []),
      ...(!cfg.appSecret ? ['ZALO_APP_SECRET'] : []),
    ],
    scopes: ['id', 'name', 'picture', 'phone'],
  };
}

export function createZaloAuthorizationUrl(
  req: any,
  res: any,
  rawMode?: unknown
): { url: string; state: string; pollToken: string; redirectUri: string; mode: ZaloAuthMode } {
  pruneExpiredMaps();
  const cfg = getZaloEnvConfig();
  if (!cfg.configured) {
    throw new Error(
      'Chưa cấu hình ZALO_APP_ID và ZALO_APP_SECRET trong AI Studio Settings > Secrets (hoặc biến môi trường máy chủ).'
    );
  }

  const mode: ZaloAuthMode = rawMode === 'link' ? 'link' : 'login';
  const codeVerifier = generateZaloCodeVerifier();
  const codeChallenge = generateZaloCodeChallenge(codeVerifier);
  const redirectUri = getZaloRedirectUri(req);
  const exp = Date.now() + OAUTH_SESSION_TTL_MS;
  const pollToken = crypto.randomBytes(16).toString('hex');

  const sealedState = sealCompactToken(
    {
      v: codeVerifier,
      m: mode === 'link' ? 'k' : 'l',
      e: exp,
      p: pollToken,
    },
    cfg.appSecret
  );
  const state = `z4_${sealedState}`;

  const session: PendingOAuthSession = {
    state,
    pollToken,
    codeVerifier,
    redirectUri,
    mode,
    exp,
  };

  pendingOAuthMap.set(state, session);
  pendingPollMap.set(state, {
    state,
    pollToken,
    status: 'pending',
    mode,
    exp,
  });

  const sealedCookie = sealJsonCookie(session, cfg.appSecret);
  appendSetCookie(
    res,
    buildCookieString(OAUTH_COOKIE_NAME, sealedCookie, 300, isLocalHttpRequest(req))
  );

  const authParams = new URLSearchParams({
    app_id: cfg.appId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state,
  });

  return {
    url: `https://oauth.zaloapp.com/v4/permission?${authParams.toString()}`,
    state,
    pollToken,
    redirectUri,
    mode,
  };
}

function formatZaloApiError(payload: any, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback;
  const parts = [
    payload.error !== undefined && payload.error !== 0 ? `Mã ${String(payload.error)}` : '',
    payload.error_name ? String(payload.error_name).trim() : '',
    payload.error_reason ? String(payload.error_reason).trim() : '',
    payload.error_description ? String(payload.error_description).trim() : '',
    payload.message ? String(payload.message).trim() : '',
  ].filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)).join(' - ') : fallback;
}

async function fetchZaloGraphMe(
  accessToken: string,
  appSecret: string,
  fields: string
): Promise<{ ok: boolean; data: any }> {
  const proof = computeZaloAppSecretProof(accessToken, appSecret);
  const url = `https://graph.zalo.me/v2.0/me?fields=${encodeURIComponent(fields)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      access_token: accessToken,
      appsecret_proof: proof,
    },
  });
  const data = await resp.json().catch(() => ({}));
  const isSuccess = resp.ok && (!data?.error || Number(data.error) === 0) && Boolean(data?.id);
  return { ok: isSuccess, data };
}

export async function refreshZaloAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: string | number;
}> {
  const cfg = getZaloEnvConfig();
  if (!cfg.configured) {
    throw new Error('Máy chủ chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET.');
  }
  const cleanRefresh = String(refreshToken || '').trim();
  if (!cleanRefresh) {
    throw new Error('Thiếu refresh_token để làm mới Zalo Access Token.');
  }

  const body = new URLSearchParams({
    app_id: cfg.appId,
    refresh_token: cleanRefresh,
    grant_type: 'refresh_token',
  });

  const resp = await fetch('https://oauth.zaloapp.com/v4/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      secret_key: cfg.appSecret,
    },
    body: body.toString(),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || (json?.error && Number(json.error) !== 0) || !json?.access_token) {
    throw new Error(formatZaloApiError(json, `HTTP ${resp.status}`));
  }
  return {
    access_token: String(json.access_token),
    refresh_token: String(json.refresh_token || ''),
    expires_in: json.expires_in ?? 3600,
  };
}

function recordPollOutcome(
  state: string,
  outcome: {
    status: 'success' | 'error';
    mode?: ZaloAuthMode;
    exchangeCode?: string;
    error?: string;
  }
): void {
  if (!state) return;
  const existing = pendingPollMap.get(state);
  if (!existing) return;
  pendingPollMap.set(state, {
    ...existing,
    status: outcome.status,
    mode: outcome.mode || existing.mode,
    exchangeCode: outcome.exchangeCode,
    error: outcome.error,
    exp: Math.max(existing.exp, Date.now() + EXCHANGE_TTL_MS),
  });
}

export async function handleZaloOAuthCallback(req: any, res: any): Promise<string> {
  pruneExpiredMaps();
  const cfg = getZaloEnvConfig();
  const cookies = parseCookies(req);
  const localHttp = isLocalHttpRequest(req);

  appendSetCookie(res, buildCookieString(OAUTH_COOKIE_NAME, '', 0, localHttp));

  const query = req?.query || {};
  const rawErrorCode = String(query.error || '').trim();
  const hasCallbackError =
    (rawErrorCode && rawErrorCode !== '0') ||
    Boolean(query.error_description || query.error_reason || query.error_name);
  const code = String(query.code || '').trim();
  const state = String(query.state || '').trim();

  if (!cfg.configured) {
    const errText = 'Máy chủ chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET.';
    recordPollOutcome(state, { status: 'error', error: errText });
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: errText,
    });
  }

  if (hasCallbackError) {
    const detail = formatZaloApiError(query, rawErrorCode || 'Lỗi xác thực Zalo');
    const errText =
      rawErrorCode === 'access_denied'
        ? 'Bạn đã từ chối cấp quyền truy cập tài khoản Zalo.'
        : `Zalo trả về lỗi (${detail}).`;
    recordPollOutcome(state, { status: 'error', error: errText });
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: errText,
    });
  }

  if (!code || !state) {
    const errText = 'Thiếu mã xác thực (code hoặc state) từ Zalo.';
    recordPollOutcome(state, { status: 'error', error: errText });
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: errText,
    });
  }

  if (consumedStates.has(state)) {
    const errText = 'Phiên xác thực Zalo này đã được sử dụng. Vui lòng thử đăng nhập lại.';
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: errText,
    });
  }

  let session: PendingOAuthSession | null = pendingOAuthMap.get(state) || null;
  pendingOAuthMap.delete(state);

  if (!session && cookies[OAUTH_COOKIE_NAME]) {
    const cookieSession = unsealJsonCookie<PendingOAuthSession>(
      cookies[OAUTH_COOKIE_NAME],
      cfg.appSecret
    );
    if (
      cookieSession &&
      typeof cookieSession.state === 'string' &&
      cookieSession.state.length === state.length &&
      crypto.timingSafeEqual(Buffer.from(cookieSession.state), Buffer.from(state))
    ) {
      session = cookieSession;
    }
  }

  if (!session && state.startsWith('z4_')) {
    const rawStateBody = state.slice(3);
    const unsealedState =
      unsealCompactToken<{ v?: string; m?: string; e?: number; p?: string }>(
        rawStateBody,
        cfg.appSecret
      ) ||
      unsealJsonCookie<{ v?: string; m?: string; e?: number; p?: string }>(
        rawStateBody,
        cfg.appSecret
      );
    if (unsealedState && typeof unsealedState.v === 'string' && typeof unsealedState.e === 'number') {
      session = {
        state,
        pollToken: String(unsealedState.p || ''),
        codeVerifier: unsealedState.v,
        redirectUri: getZaloRedirectUri(req),
        mode: unsealedState.m === 'k' ? 'link' : 'login',
        exp: unsealedState.e,
      };
    }
  }

  if (!session || session.exp <= Date.now()) {
    const errText = 'Phiên xác thực Zalo đã hết hạn hoặc state không hợp lệ. Vui lòng thử lại.';
    recordPollOutcome(state, { status: 'error', error: errText });
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: errText,
    });
  }

  consumedStates.set(state, session.exp);

  try {
    const tokenBody = new URLSearchParams({
      app_id: cfg.appId,
      code,
      code_verifier: session.codeVerifier,
      grant_type: 'authorization_code',
    });

    const tokenResp = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        secret_key: cfg.appSecret,
      },
      body: tokenBody.toString(),
    });

    const tokenJson = (await tokenResp.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: string | number;
      error?: number;
      error_name?: string;
      error_reason?: string;
      error_description?: string;
      message?: string;
    };

    if (
      !tokenResp.ok ||
      (tokenJson?.error && Number(tokenJson.error) !== 0) ||
      !tokenJson?.access_token
    ) {
      const detail = formatZaloApiError(tokenJson, `HTTP ${tokenResp.status}`);
      const errText = `Không thể đổi mã truy cập Zalo (${detail}).`;
      recordPollOutcome(state, { status: 'error', mode: session.mode, error: errText });
      return renderPopupCallbackHtml({
        ok: false,
        state,
        mode: session.mode,
        error: errText,
      });
    }

    const zaloAccessToken = String(tokenJson.access_token);

    let meRes = await fetchZaloGraphMe(zaloAccessToken, cfg.appSecret, 'id,name,picture,phone');
    if (!meRes.ok) {
      meRes = await fetchZaloGraphMe(zaloAccessToken, cfg.appSecret, 'id,name,picture');
    }

    if (!meRes.ok || !meRes.data?.id) {
      const gErr = formatZaloApiError(meRes.data, 'Không lấy được hồ sơ Zalo.');
      const errText = `Không thể đọc thông tin người dùng Zalo (${gErr}).`;
      recordPollOutcome(state, { status: 'error', mode: session.mode, error: errText });
      return renderPopupCallbackHtml({
        ok: false,
        state,
        mode: session.mode,
        error: errText,
      });
    }

    const zaloId = String(meRes.data.id).trim();
    const zaloName = String(meRes.data.name || '').trim() || `Người dùng Zalo ${zaloId.slice(-4)}`;
    const pictureObj = meRes.data.picture;
    const avatarUrl =
      typeof pictureObj === 'string'
        ? pictureObj
        : String(pictureObj?.data?.url || '').trim();
    const rawPhone = String(meRes.data.phone || '').trim();
    const phoneNumber = normalizeVietnamesePhone(rawPhone);

    const zaloProfile: ZaloUserProfilePayload = {
      zaloId,
      name: zaloName,
      avatarUrl,
      phoneNumber,
      ...(rawPhone ? { rawPhone } : {}),
    };

    const exp = Date.now() + EXCHANGE_TTL_MS;
    const sealedExchangePayload = sealJsonCookie(
      {
        m: session.mode,
        p: zaloProfile,
        e: exp,
        n: crypto.randomBytes(8).toString('hex'),
      },
      cfg.appSecret
    );
    const exchangeCode = `zx_${sealedExchangePayload}`;

    const exchangeRecord: PendingExchangeRecord = {
      exchangeCode,
      mode: session.mode,
      zaloProfile,
      exp,
    };

    pendingExchangeMap.set(exchangeCode, exchangeRecord);

    const sealedExchangeCookie = sealJsonCookie(exchangeRecord, cfg.appSecret);
    appendSetCookie(
      res,
      buildCookieString(EXCHANGE_COOKIE_NAME, sealedExchangeCookie, 120, localHttp)
    );

    recordPollOutcome(state, {
      status: 'success',
      mode: session.mode,
      exchangeCode,
    });

    return renderPopupCallbackHtml({
      ok: true,
      exchangeCode,
      state,
      mode: session.mode,
    });
  } catch (err: any) {
    const errText = err?.message || 'Lỗi kết nối tới máy chủ Zalo.';
    recordPollOutcome(state, { status: 'error', mode: session.mode, error: errText });
    return renderPopupCallbackHtml({
      ok: false,
      state,
      mode: session.mode,
      error: errText,
    });
  }
}

export function pollZaloOAuthResult(req: any): {
  ok: boolean;
  status: 'pending' | 'success' | 'error';
  mode?: ZaloAuthMode;
  exchangeCode?: string;
  error?: string;
} {
  pruneExpiredMaps();
  const cfg = getZaloEnvConfig();
  const state = String(req?.body?.state || req?.query?.state || '').trim();
  const pollToken = String(req?.body?.pollToken || req?.query?.pollToken || '').trim();

  if (!state || !pollToken || !cfg.configured) {
    return { ok: true, status: 'pending' };
  }

  const record = pendingPollMap.get(state);
  if (!record) {
    return { ok: true, status: 'pending' };
  }

  const a = Buffer.from(record.pollToken, 'utf8');
  const b = Buffer.from(pollToken, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Mã theo dõi phiên đăng nhập Zalo không hợp lệ.');
  }

  if (record.status === 'success' && record.exchangeCode) {
    const code = record.exchangeCode;
    pendingPollMap.delete(state);
    return {
      ok: true,
      status: 'success',
      mode: record.mode,
      exchangeCode: code,
    };
  }

  if (record.status === 'error') {
    const errMsg = record.error || 'Đăng nhập Zalo không thành công.';
    pendingPollMap.delete(state);
    return {
      ok: true,
      status: 'error',
      mode: record.mode,
      error: errMsg,
    };
  }

  return {
    ok: true,
    status: 'pending',
    mode: record.mode,
  };
}

export async function completeZaloExchange(
  req: any,
  res: any
): Promise<ZaloCompletionResponse> {
  pruneExpiredMaps();
  const cfg = getZaloEnvConfig();
  if (!cfg.configured) {
    throw new Error('Máy chủ chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET.');
  }

  const exchangeCode = String(req?.body?.exchangeCode || '').trim();
  if (!exchangeCode) {
    throw new Error('Thiếu mã hoàn tất đăng nhập Zalo (exchangeCode).');
  }

  if (consumedExchangeCodes.has(exchangeCode)) {
    throw new Error('Mã đăng nhập Zalo đã được sử dụng. Vui lòng thử đăng nhập lại.');
  }

  let record: PendingExchangeRecord | null = pendingExchangeMap.get(exchangeCode) || null;
  pendingExchangeMap.delete(exchangeCode);

  const cookies = parseCookies(req);
  if (!record && cookies[EXCHANGE_COOKIE_NAME]) {
    const cookieRec = unsealJsonCookie<PendingExchangeRecord>(
      cookies[EXCHANGE_COOKIE_NAME],
      cfg.appSecret
    );
    if (
      cookieRec &&
      typeof cookieRec.exchangeCode === 'string' &&
      cookieRec.exchangeCode.length === exchangeCode.length &&
      crypto.timingSafeEqual(Buffer.from(cookieRec.exchangeCode), Buffer.from(exchangeCode))
    ) {
      record = cookieRec;
    }
  }

  if (!record && exchangeCode.startsWith('zx_')) {
    const unsealed = unsealJsonCookie<{
      m?: ZaloAuthMode;
      p?: ZaloUserProfilePayload;
      e?: number;
    }>(exchangeCode.slice(3), cfg.appSecret);
    if (unsealed && unsealed.p?.zaloId && typeof unsealed.e === 'number') {
      record = {
        exchangeCode,
        mode: unsealed.m === 'link' ? 'link' : 'login',
        zaloProfile: unsealed.p,
        exp: unsealed.e,
      };
    }
  }

  const localHttp = isLocalHttpRequest(req);
  appendSetCookie(
    res,
    buildCookieString(EXCHANGE_COOKIE_NAME, '', 0, localHttp)
  );

  if (!record || record.exp <= Date.now()) {
    throw new Error('Phiên đổi mã Zalo đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
  }

  consumedExchangeCodes.set(exchangeCode, record.exp);

  if (record.mode === 'link') {
    return {
      ok: true,
      mode: 'link',
      zaloProfile: record.zaloProfile,
    };
  }

  const now = Date.now();
  const sessionToken = `zs_${sealJsonCookie(
    {
      p: record.zaloProfile,
      iat: now,
      exp: now + ZALO_SESSION_TTL_MS,
    } satisfies SealedZaloSessionPayload,
    cfg.appSecret
  )}`;

  const bridgeResult = await ensureFirebaseBridgeAccount(record.zaloProfile, cfg.appSecret);
  if (bridgeResult.bridgeAuth) {
    return {
      ok: true,
      mode: 'login',
      zaloProfile: record.zaloProfile,
      bridgeAuth: bridgeResult.bridgeAuth,
    };
  }

  appendSetCookie(
    res,
    buildCookieString(
      SESSION_COOKIE_NAME,
      sessionToken,
      Math.floor(ZALO_SESSION_TTL_MS / 1000),
      localHttp
    )
  );

  return {
    ok: true,
    mode: 'login',
    zaloProfile: record.zaloProfile,
    firebaseBridgeDisabled: true,
    firebaseBridgeReason: bridgeResult.reason || 'PASSWORD_LOGIN_DISABLED',
    zaloSessionToken: sessionToken,
  };
}

export function getZaloSessionFromRequest(req: any): {
  ok: boolean;
  authenticated: boolean;
  zaloProfile?: ZaloUserProfilePayload;
  zaloSessionToken?: string;
} {
  const cfg = getZaloEnvConfig();
  if (!cfg.configured) {
    return { ok: true, authenticated: false };
  }

  const cookies = parseCookies(req);
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const bodyToken = String(req?.body?.zaloSessionToken || '').trim();
  const rawToken = bodyToken || bearer || cookies[SESSION_COOKIE_NAME] || '';

  if (!rawToken || !rawToken.startsWith('zs_')) {
    return { ok: true, authenticated: false };
  }

  const unsealed = unsealJsonCookie<SealedZaloSessionPayload>(rawToken.slice(3), cfg.appSecret);
  if (!unsealed || !unsealed.p?.zaloId || typeof unsealed.exp !== 'number' || unsealed.exp <= Date.now()) {
    return { ok: true, authenticated: false };
  }

  return {
    ok: true,
    authenticated: true,
    zaloProfile: unsealed.p,
    zaloSessionToken: rawToken,
  };
}

export function logoutZaloSession(req: any, res: any): { ok: boolean } {
  appendSetCookie(
    res,
    buildCookieString(SESSION_COOKIE_NAME, '', 0, isLocalHttpRequest(req))
  );
  return { ok: true };
}

export async function resolveZaloMiniAppPhone(
  accessToken: string,
  phoneToken: string
): Promise<{ phoneNumber: string; rawPhone: string }> {
  const cfg = getZaloEnvConfig();
  if (!cfg.configured) {
    throw new Error('Máy chủ chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET.');
  }
  const cleanAccess = String(accessToken || '').trim();
  const cleanCode = String(phoneToken || '').trim();
  if (!cleanAccess || !cleanCode) {
    throw new Error('Thiếu accessToken hoặc phoneToken từ Zalo Mini App.');
  }

  const resp = await fetch('https://graph.zalo.me/v2.0/me/info', {
    method: 'GET',
    headers: {
      access_token: cleanAccess,
      code: cleanCode,
      secret_key: cfg.appSecret,
    },
  });
  const data = (await resp.json().catch(() => ({}))) as {
    error?: number;
    message?: string;
    data?: { number?: string };
  };

  if (!resp.ok || (data?.error && data.error !== 0) || !data?.data?.number) {
    throw new Error(data?.message || 'Không thể giải mã số điện thoại từ Zalo.');
  }

  const rawPhone = String(data.data.number).trim();
  const phoneNumber = normalizeVietnamesePhone(rawPhone);
  return { phoneNumber, rawPhone };
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

  const action = resolveAction(req);

  if (action === 'status') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức GET' });
    }
    return res.status(200).json(getZaloStatusPayload(req));
  }

  if (action === 'url') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức GET' });
    }
    try {
      const mode = req.query?.mode === 'link' ? 'link' : 'login';
      const result = createZaloAuthorizationUrl(req, res, mode);
      return res.status(200).json({ ok: true, ...result });
    } catch (err: any) {
      return res.status(503).json({
        ok: false,
        error: err?.message || 'Chưa cấu hình đăng nhập Zalo.',
        status: getZaloStatusPayload(req),
      });
    }
  }

  if (action === 'callback') {
    if (req.method !== 'GET') {
      return res.status(405).send('Method Not Allowed');
    }
    const html = await handleZaloOAuthCallback(req, res);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  if (action === 'complete') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
    }
    try {
      const payload = await completeZaloExchange(req, res);
      return res.status(200).json(payload);
    } catch (err: any) {
      return res.status(400).json({
        ok: false,
        error: err?.message || 'Không thể hoàn tất đăng nhập Zalo.',
      });
    }
  }

  if (action === 'poll') {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
    }
    try {
      const result = pollZaloOAuthResult(req);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(400).json({
        ok: false,
        error: err?.message || 'Không thể kiểm tra trạng thái đăng nhập Zalo.',
      });
    }
  }

  if (action === 'session') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Phương thức không được hỗ trợ' });
    }
    return res.status(200).json(getZaloSessionFromRequest(req));
  }

  if (action === 'logout') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
    }
    return res.status(200).json(logoutZaloSession(req, res));
  }

  if (action === 'phone') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
    }
    try {
      const { accessToken, phoneToken } = req.body || {};
      const result = await resolveZaloMiniAppPhone(accessToken, phoneToken);
      return res.status(200).json({ ok: true, ...result });
    } catch (err: any) {
      return res.status(400).json({
        ok: false,
        error: err?.message || 'Không thể lấy số điện thoại Zalo.',
      });
    }
  }

  return res.status(404).json({ error: 'Endpoint Zalo Auth không tồn tại.' });
}
