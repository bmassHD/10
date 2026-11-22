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
}

interface PendingOAuthSession {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  mode: ZaloAuthMode;
  exp: number;
}

interface PendingExchangeRecord {
  exchangeCode: string;
  mode: ZaloAuthMode;
  zaloProfile: ZaloUserProfilePayload;
  exp: number;
}

const OAUTH_COOKIE_NAME = 'tyt_zalo_oauth_v1';
const EXCHANGE_COOKIE_NAME = 'tyt_zalo_xchg_v1';
const OAUTH_SESSION_TTL_MS = 5 * 60 * 1000;
const EXCHANGE_TTL_MS = 2 * 60 * 1000;

const pendingOAuthMap = new Map<string, PendingOAuthSession>();
const consumedStates = new Map<string, number>();
const pendingExchangeMap = new Map<string, PendingExchangeRecord>();
const consumedExchangeCodes = new Map<string, number>();

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

  // Prefer live public host (Dev/Shared Cloud Run, Vercel, or custom domain) so callback matches window.location.origin
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

/**
 * Generates an exact 43-character alphanumeric PKCE code_verifier containing
 * uppercase, lowercase, and digit characters per Zalo OAuth v4 spec
 */
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
      width: 48px;
      height: 48px;
      border-radius: 14px;
      font-weight: 800;
      font-size: 18px;
      color: #fff;
      background: ${payload.ok ? '#0068FF' : '#e11d48'};
      margin-bottom: 12px;
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
    <div class="badge">Z</div>
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
      setTimeout(function () {
        try { window.close(); } catch (e) {}
      }, ${payload.ok ? 250 : 1200});
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
): Promise<{ email: string; secret: string }> {
  const apiKey = readFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error('Không tìm thấy cấu hình Firebase API Key để đồng bộ phiên đăng nhập Zalo.');
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

  return creds;
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
): { url: string; state: string; redirectUri: string; mode: ZaloAuthMode } {
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

  // Compact AES-256-GCM sealed state enables stateless verification across iframe/serverless hops
  const sealedState = sealJsonCookie(
    {
      v: codeVerifier,
      m: mode === 'link' ? 'k' : 'l',
      e: exp,
    },
    cfg.appSecret
  );
  const state = `z4_${sealedState}`;

  const session: PendingOAuthSession = {
    state,
    codeVerifier,
    redirectUri,
    mode,
    exp,
  };

  pendingOAuthMap.set(state, session);

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

export async function handleZaloOAuthCallback(req: any, res: any): Promise<string> {
  pruneExpiredMaps();
  const cfg = getZaloEnvConfig();
  const cookies = parseCookies(req);
  const localHttp = isLocalHttpRequest(req);

  // Clear pending OAuth session cookie immediately
  appendSetCookie(res, buildCookieString(OAUTH_COOKIE_NAME, '', 0, localHttp));

  const query = req?.query || {};
  const rawErrorCode = String(query.error || '').trim();
  const hasCallbackError =
    (rawErrorCode && rawErrorCode !== '0') ||
    Boolean(query.error_description || query.error_reason || query.error_name);
  const code = String(query.code || '').trim();
  const state = String(query.state || '').trim();

  if (!cfg.configured) {
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: 'Máy chủ chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET.',
    });
  }

  if (hasCallbackError) {
    const detail = formatZaloApiError(query, rawErrorCode || 'Lỗi xác thực Zalo');
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error:
        rawErrorCode === 'access_denied'
          ? 'Bạn đã từ chối cấp quyền truy cập tài khoản Zalo.'
          : `Zalo trả về lỗi (${detail}).`,
    });
  }

  if (!code || !state) {
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: 'Thiếu mã xác thực (code hoặc state) từ Zalo.',
    });
  }

  if (consumedStates.has(state)) {
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: 'Phiên xác thực Zalo này đã được sử dụng. Vui lòng thử đăng nhập lại.',
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
    const unsealedState = unsealJsonCookie<{ v?: string; m?: string; e?: number }>(
      state.slice(3),
      cfg.appSecret
    );
    if (unsealedState && typeof unsealedState.v === 'string' && typeof unsealedState.e === 'number') {
      session = {
        state,
        codeVerifier: unsealedState.v,
        redirectUri: getZaloRedirectUri(req),
        mode: unsealedState.m === 'k' ? 'link' : 'login',
        exp: unsealedState.e,
      };
    }
  }

  if (!session || session.exp <= Date.now()) {
    return renderPopupCallbackHtml({
      ok: false,
      state,
      error: 'Phiên xác thực Zalo đã hết hạn hoặc state không hợp lệ. Vui lòng thử lại.',
    });
  }

  consumedStates.set(state, session.exp);

  try {
    // 1. Exchange authorization code for Zalo User Access Token v4
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
      return renderPopupCallbackHtml({
        ok: false,
        state,
        mode: session.mode,
        error: `Không thể đổi mã truy cập Zalo (${detail}).`,
      });
    }

    const zaloAccessToken = String(tokenJson.access_token);

    // 2. Fetch Zalo user profile: try id,name,picture,phone first, fallback to id,name,picture
    let meRes = await fetchZaloGraphMe(zaloAccessToken, cfg.appSecret, 'id,name,picture,phone');
    if (!meRes.ok) {
      meRes = await fetchZaloGraphMe(zaloAccessToken, cfg.appSecret, 'id,name,picture');
    }

    if (!meRes.ok || !meRes.data?.id) {
      const gErr = formatZaloApiError(meRes.data, 'Không lấy được hồ sơ Zalo.');
      return renderPopupCallbackHtml({
        ok: false,
        state,
        mode: session.mode,
        error: `Không thể đọc thông tin người dùng Zalo (${gErr}).`,
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

    return renderPopupCallbackHtml({
      ok: true,
      exchangeCode,
      state,
      mode: session.mode,
    });
  } catch (err: any) {
    return renderPopupCallbackHtml({
      ok: false,
      state,
      mode: session.mode,
      error: err?.message || 'Lỗi kết nối tới máy chủ Zalo.',
    });
  }
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

  // Always clear exchange cookie once consumed
  appendSetCookie(
    res,
    buildCookieString(EXCHANGE_COOKIE_NAME, '', 0, isLocalHttpRequest(req))
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

  const bridgeAuth = await ensureFirebaseBridgeAccount(record.zaloProfile, cfg.appSecret);
  return {
    ok: true,
    mode: 'login',
    zaloProfile: record.zaloProfile,
    bridgeAuth,
  };
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
