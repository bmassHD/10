import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  PaymentOrder,
  SepayAdminConfig,
  SepayAuthType,
  SepayBankTemplate,
  SepayOrderStatus,
  SepayPublicConfig,
  SepayWebhookLog,
  VipPackageConfig,
  VipStatusInfo,
} from '../types';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(MODULE_DIR, '..', '..');

const CONFIG_FILE = path.resolve(ROOT_DIR, '.sepay-config.json');
const ORDERS_FILE = path.resolve(ROOT_DIR, '.sepay-orders.json');
const WEBHOOKS_FILE = path.resolve(ROOT_DIR, '.sepay-webhooks.json');
const VIPS_FILE = path.resolve(ROOT_DIR, '.sepay-vips.json');

const BOOTSTRAP_ADMIN_EMAILS = [
  'sonlyhongduc@gmail.com',
  'sonlyhongduc2003@gmail.com',
  'tytvtd@gmail.com',
  'bmassk3@gmail.com',
];

const DEFAULT_WEBHOOK_URL = 'https://tyt.slhd.id.vn/hooks/sepay-payment';

const DEFAULT_VIP_PACKAGES: VipPackageConfig[] = [
  {
    id: 'account_verify',
    name: 'Xác Minh Tài Khoản Chính Thức (Verified)',
    subtitle: 'Cấp trạng thái Tick Xanh Verified chính thức cho tài khoản Cá nhân hoặc Doanh nghiệp / Tổ chức',
    priceVnd: 50000,
    durationDays: 365,
    badgeText: 'Tick Xanh Verified',
    isPopular: true,
    isActive: true,
    features: [
      'Hiển thị huy hiệu Tick Xanh (Verified) cạnh tên tài khoản trên toàn hệ thống',
      'Xác thực độ tin cậy hồ sơ công dân, doanh nghiệp và đơn vị liên kết',
      'Kích hoạt tự động tức thì ngay sau khi SePay ghi nhận chuyển khoản thành công',
      'Lưu trữ mã đơn hàng đối soát thanh toán SePay minh bạch',
    ],
  },
];

interface StoredSepayConfig extends SepayPublicConfig {
  authType: SepayAuthType;
  apiKey?: string;
  hmacSecret?: string;
}

interface StoredVipRecord {
  uid: string;
  userEmail?: string;
  userName?: string;
  isVip: boolean;
  vipTier: string;
  vipPackageName: string;
  vipActivatedAt: string;
  vipExpiresAt: string;
  vipOrderCode?: string;
  source: 'sepay' | 'admin';
  updatedAt: string;
}

interface SepayStore {
  config: StoredSepayConfig;
  orders: PaymentOrder[];
  webhooks: SepayWebhookLog[];
  vips: Record<string, StoredVipRecord>;
}

const globalForSepay = globalThis as typeof globalThis & {
  __tytSepayStore?: SepayStore;
};

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Ignore write failures on read-only serverless file systems (memory cache remains active)
  }
}

function normalizeOrderPrefix(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);
  return cleaned.length >= 2 ? cleaned : 'TYT';
}

function normalizeSuffixBounds(
  minRaw: unknown,
  maxRaw: unknown
): { minLen: number; maxLen: number } {
  const minLen = Math.max(2, Math.min(8, Math.round(Number(minRaw) || 2)));
  const maxLen = Math.max(minLen, Math.min(8, Math.round(Number(maxRaw) || 8)));
  return { minLen, maxLen };
}

function buildDefaultConfig(): StoredSepayConfig {
  const envApiKey = String(process.env.SEPAY_WEBHOOK_API_KEY || '').trim();
  const envHmacSecret = String(process.env.SEPAY_HMAC_SECRET || '').trim();
  return {
    enabled: true,
    bankCode: 'MBBank',
    bankName: 'MB Bank (Ngân hàng Quân Đội)',
    accountNumber: '0399998888',
    accountHolder: 'TRAM Y TE CO SO SLHD',
    subAccount: '',
    orderPrefix: 'TYT',
    orderSuffixMinLength: 2,
    orderSuffixMaxLength: 8,
    orderSuffixType: 'integer',
    webhookUrl: DEFAULT_WEBHOOK_URL,
    qrTemplate: 'compact2',
    packages: DEFAULT_VIP_PACKAGES.map(p => ({ ...p, features: [...p.features] })),
    authType: envApiKey ? 'api_key' : envHmacSecret ? 'hmac_sha256' : 'none',
    apiKey: envApiKey || '',
    hmacSecret: envHmacSecret || '',
    updatedAt: new Date().toISOString(),
  };
}

function getStore(): SepayStore {
  if (globalForSepay.__tytSepayStore) {
    return globalForSepay.__tytSepayStore;
  }
  const storedCfg = readJsonFile<Partial<StoredSepayConfig>>(CONFIG_FILE);
  const defaultCfg = buildDefaultConfig();
  const legacyPkgIds = new Set(['vip_monthly', 'vip_yearly', 'vip_enterprise']);
  const hasStoredPackages = Array.isArray(storedCfg?.packages) && storedCfg.packages.length > 0;
  const isLegacyVipSet =
    hasStoredPackages && storedCfg!.packages!.every(pkg => legacyPkgIds.has(pkg.id));
  const suffixBounds = normalizeSuffixBounds(
    storedCfg?.orderSuffixMinLength,
    storedCfg?.orderSuffixMaxLength
  );

  const mergedCfg: StoredSepayConfig = {
    ...defaultCfg,
    ...(storedCfg || {}),
    webhookUrl: String(storedCfg?.webhookUrl || defaultCfg.webhookUrl).trim() || DEFAULT_WEBHOOK_URL,
    orderPrefix: normalizeOrderPrefix(storedCfg?.orderPrefix || defaultCfg.orderPrefix),
    orderSuffixMinLength: suffixBounds.minLen,
    orderSuffixMaxLength: suffixBounds.maxLen,
    orderSuffixType: 'integer',
    packages:
      hasStoredPackages && !isLegacyVipSet
        ? storedCfg!.packages!
        : defaultCfg.packages,
    apiKey: String(storedCfg?.apiKey || process.env.SEPAY_WEBHOOK_API_KEY || '').trim(),
    hmacSecret: String(storedCfg?.hmacSecret || process.env.SEPAY_HMAC_SECRET || '').trim(),
  };

  const storedOrders = readJsonFile<PaymentOrder[]>(ORDERS_FILE);
  const storedWebhooks = readJsonFile<SepayWebhookLog[]>(WEBHOOKS_FILE);
  const storedVips = readJsonFile<Record<string, StoredVipRecord>>(VIPS_FILE);

  const store: SepayStore = {
    config: mergedCfg,
    orders: Array.isArray(storedOrders) ? storedOrders : [],
    webhooks: Array.isArray(storedWebhooks) ? storedWebhooks : [],
    vips: storedVips && typeof storedVips === 'object' ? storedVips : {},
  };

  globalForSepay.__tytSepayStore = store;
  return store;
}

function persistConfig(cfg: StoredSepayConfig): void {
  const store = getStore();
  store.config = cfg;
  writeJsonFile(CONFIG_FILE, cfg);
}

function persistOrders(orders: PaymentOrder[]): void {
  const store = getStore();
  store.orders = orders.slice(0, 500);
  writeJsonFile(ORDERS_FILE, store.orders);
}

function persistWebhooks(webhooks: SepayWebhookLog[]): void {
  const store = getStore();
  store.webhooks = webhooks.slice(0, 200);
  writeJsonFile(WEBHOOKS_FILE, store.webhooks);
}

function persistVips(vips: Record<string, StoredVipRecord>): void {
  const store = getStore();
  store.vips = vips;
  writeJsonFile(VIPS_FILE, store.vips);
}

function maskSecret(secret?: string): string {
  const s = String(secret || '').trim();
  if (!s) return '';
  if (s.length <= 6) return '••••••';
  return `${s.slice(0, 3)}••••••${s.slice(-3)}`;
}

export function buildSepayQrUrl(params: {
  bankCode: string;
  accountNumber: string;
  amountVnd: number;
  orderCode: string;
  qrTemplate?: SepayBankTemplate;
}): string {
  const acc = encodeURIComponent(String(params.accountNumber || '').trim());
  const bank = encodeURIComponent(String(params.bankCode || 'MBBank').trim());
  const amount = Math.max(0, Math.round(Number(params.amountVnd) || 0));
  const des = encodeURIComponent(String(params.orderCode || '').trim());
  const template = encodeURIComponent(params.qrTemplate || 'compact2');
  return `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amount}&des=${des}&template=${template}`;
}

export function getPublicSepayConfig(): SepayPublicConfig {
  const cfg = getStore().config;
  const bounds = normalizeSuffixBounds(cfg.orderSuffixMinLength, cfg.orderSuffixMaxLength);
  return {
    enabled: Boolean(cfg.enabled),
    bankCode: cfg.bankCode,
    bankName: cfg.bankName,
    accountNumber: cfg.accountNumber,
    accountHolder: cfg.accountHolder,
    ...(cfg.subAccount ? { subAccount: cfg.subAccount } : {}),
    orderPrefix: normalizeOrderPrefix(cfg.orderPrefix),
    orderSuffixMinLength: bounds.minLen,
    orderSuffixMaxLength: bounds.maxLen,
    orderSuffixType: 'integer',
    webhookUrl: cfg.webhookUrl || DEFAULT_WEBHOOK_URL,
    qrTemplate: cfg.qrTemplate || 'compact2',
    packages: cfg.packages.map(p => ({ ...p, features: [...p.features] })),
    updatedAt: cfg.updatedAt,
  };
}

export function getAdminSepayConfig(): SepayAdminConfig {
  const cfg = getStore().config;
  const effectiveApiKey = cfg.apiKey || String(process.env.SEPAY_WEBHOOK_API_KEY || '').trim();
  const effectiveHmac = cfg.hmacSecret || String(process.env.SEPAY_HMAC_SECRET || '').trim();
  return {
    ...getPublicSepayConfig(),
    authType: cfg.authType,
    hasApiKey: Boolean(effectiveApiKey),
    apiKeyMasked: maskSecret(effectiveApiKey),
    hasHmacSecret: Boolean(effectiveHmac),
    hmacSecretMasked: maskSecret(effectiveHmac),
  };
}

interface FirebaseServerConfig {
  apiKey: string;
  projectId: string;
  firestoreDatabaseId: string;
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
    const candidates = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(ROOT_DIR, 'firebase-applet-config.json'),
      path.resolve(MODULE_DIR, '..', '..', 'firebase-applet-config.json'),
    ];
    const cfgPath = candidates.find(p => fs.existsSync(p));
    if (cfgPath) {
      fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as Partial<FirebaseServerConfig>;
    }
  } catch {
    // ignore
  }

  return {
    apiKey: envApiKey || String(fileCfg.apiKey || '').trim(),
    projectId: envProjectId || String(fileCfg.projectId || '').trim(),
    firestoreDatabaseId:
      envDatabaseId || String(fileCfg.firestoreDatabaseId || '').trim() || '(default)',
  };
}

function extractBearerToken(req: any): string {
  const raw = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

export interface VerifiedCaller {
  uid: string;
  email?: string;
  displayName?: string;
  idToken: string;
}

export async function verifyAuthenticatedUser(req: any): Promise<VerifiedCaller> {
  const idToken = extractBearerToken(req);
  if (!idToken) {
    throw new Error('Vui lòng đăng nhập để thực hiện thao tác thanh toán.');
  }
  const fbCfg = readFirebaseServerConfig();
  if (!fbCfg.apiKey) {
    throw new Error('Máy chủ chưa cấu hình Firebase API Key để xác thực phiên người dùng.');
  }
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbCfg.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const json = (await resp.json().catch(() => ({}))) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string }>;
  };
  const user = json?.users?.[0];
  if (!resp.ok || !user?.localId) {
    throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  }
  return {
    uid: String(user.localId),
    ...(user.email ? { email: String(user.email) } : {}),
    ...(user.displayName ? { displayName: String(user.displayName) } : {}),
    idToken,
  };
}

async function getFirestoreDocFields(
  fbCfg: FirebaseServerConfig,
  collectionName: string,
  docId: string,
  idToken?: string
): Promise<Record<string, any> | null> {
  if (!fbCfg.projectId || !docId) return null;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    fbCfg.projectId
  )}/databases/${encodeURIComponent(fbCfg.firestoreDatabaseId || '(default)')}/documents`;
  try {
    const headers: Record<string, string> = {};
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const resp = await fetch(
      `${baseUrl}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`,
      { method: 'GET', headers }
    );
    if (!resp.ok) return null;
    const json = (await resp.json().catch(() => null)) as { fields?: Record<string, any> } | null;
    if (!json?.fields) return null;
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(json.fields)) {
      if ('stringValue' in v) out[k] = String(v.stringValue);
      else if ('booleanValue' in v) out[k] = Boolean(v.booleanValue);
      else if ('integerValue' in v) out[k] = Number(v.integerValue);
      else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
    }
    return out;
  } catch {
    return null;
  }
}

export async function verifyAdminCaller(req: any): Promise<VerifiedCaller> {
  const caller = await verifyAuthenticatedUser(req);
  const emailLower = (caller.email || '').trim().toLowerCase();
  if (emailLower && BOOTSTRAP_ADMIN_EMAILS.includes(emailLower)) {
    return caller;
  }
  const fbCfg = readFirebaseServerConfig();
  const userDoc = await getFirestoreDocFields(fbCfg, 'users', caller.uid, caller.idToken);
  const role = String(userDoc?.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin') {
    return caller;
  }
  const adminDoc = await getFirestoreDocFields(fbCfg, 'admins', caller.uid, caller.idToken);
  if (adminDoc && (adminDoc.role === 'admin' || adminDoc.role === 'super_admin' || adminDoc.uid === caller.uid)) {
    return caller;
  }
  throw new Error('Bạn không có quyền Quản trị viên để cấu hình SePay hoặc chỉnh số tiền đơn hàng.');
}

function normalizeVipStatusRecord(rec?: StoredVipRecord | null): VipStatusInfo {
  if (!rec || !rec.isVip) {
    return { isVip: false, source: 'none' };
  }
  const nowMs = Date.now();
  const expiresMs = rec.vipExpiresAt ? new Date(rec.vipExpiresAt).getTime() : 0;
  if (expiresMs && Number.isFinite(expiresMs) && expiresMs <= nowMs) {
    return {
      isVip: false,
      vipTier: rec.vipTier,
      vipPackageName: rec.vipPackageName,
      vipActivatedAt: rec.vipActivatedAt,
      vipExpiresAt: rec.vipExpiresAt,
      vipOrderCode: rec.vipOrderCode,
      source: rec.source,
    };
  }
  return {
    isVip: true,
    vipTier: rec.vipTier,
    vipPackageName: rec.vipPackageName,
    vipActivatedAt: rec.vipActivatedAt,
    vipExpiresAt: rec.vipExpiresAt,
    vipOrderCode: rec.vipOrderCode,
    source: rec.source,
  };
}

export async function getUserVipStatus(req: any): Promise<VipStatusInfo> {
  const caller = await verifyAuthenticatedUser(req);
  const store = getStore();
  const memVip = normalizeVipStatusRecord(store.vips[caller.uid]);
  if (memVip.isVip) {
    return memVip;
  }
  // Check Firestore user profile in case Admin granted VIP from Firestore directly
  const fbCfg = readFirebaseServerConfig();
  const userDoc = await getFirestoreDocFields(fbCfg, 'users', caller.uid, caller.idToken);
  if (userDoc?.isVip) {
    const expiresAt = String(userDoc.vipExpiresAt || '');
    const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
    if (!expiresMs || expiresMs > Date.now()) {
      return {
        isVip: true,
        vipTier: String(userDoc.vipTier || 'account_verify'),
        vipPackageName: String(userDoc.vipPackageName || 'Xác Minh Tài Khoản Chính Thức (Verified)'),
        vipActivatedAt: String(userDoc.vipActivatedAt || ''),
        ...(expiresAt ? { vipExpiresAt: expiresAt } : {}),
        ...(userDoc.vipOrderCode ? { vipOrderCode: String(userDoc.vipOrderCode) } : {}),
        source: 'admin',
      };
    }
  }
  return { isVip: false, source: 'none' };
}

function generateOrderCode(
  prefix: string,
  minLen = 2,
  maxLen = 8,
  existingOrders: PaymentOrder[] = []
): string {
  const cleanPrefix = normalizeOrderPrefix(prefix);
  const bounds = normalizeSuffixBounds(minLen, maxLen);
  const targetLen = bounds.maxLen;
  const minInt = Math.pow(10, targetLen - 1);
  const maxInt = Math.pow(10, targetLen);

  for (let attempt = 0; attempt < 25; attempt++) {
    const digits = String(crypto.randomInt(minInt, maxInt));
    const candidate = `${cleanPrefix}${digits}`;
    if (!existingOrders.some(o => o.orderCode === candidate)) {
      return candidate;
    }
  }

  const fallbackDigits = String(Date.now()).slice(-targetLen).padStart(targetLen, '1');
  return `${cleanPrefix}${fallbackDigits}`;
}

export async function createUserPaymentOrder(req: any): Promise<{ ok: true; order: PaymentOrder; config: SepayPublicConfig }> {
  const caller = await verifyAuthenticatedUser(req);
  const store = getStore();
  const cfg = store.config;
  if (!cfg.enabled) {
    throw new Error('Cổng thanh toán SePay hiện đang tạm tắt bởi Quản trị viên.');
  }

  const body = parseBody(req);
  const packageId = String(body.packageId || '').trim();
  const pkg = cfg.packages.find(p => p.id === packageId && p.isActive);
  if (!pkg) {
    throw new Error('Gói xác minh tài khoản không tồn tại hoặc đang ngừng cung cấp.');
  }

  // Server-authoritative pricing: client cannot tamper with amountVnd
  const amountVnd = Math.max(1000, Math.round(Number(pkg.priceVnd) || 0));
  const orderCode = generateOrderCode(
    cfg.orderPrefix,
    cfg.orderSuffixMinLength,
    cfg.orderSuffixMaxLength,
    store.orders
  );
  const now = new Date().toISOString();
  const userName = String(body.userName || caller.displayName || caller.email || 'Người dùng').trim().slice(0, 120);

  const order: PaymentOrder = {
    id: orderCode,
    orderCode,
    uid: caller.uid,
    ...(caller.email ? { userEmail: caller.email } : {}),
    userName,
    packageId: pkg.id,
    packageName: pkg.name,
    orderType: 'vip_package',
    amountVnd,
    currency: 'VND',
    status: 'pending',
    description: `Thanh toán ${pkg.name} (${orderCode})`,
    durationDays: pkg.durationDays,
    qrUrl: buildSepayQrUrl({
      bankCode: cfg.bankCode,
      accountNumber: cfg.accountNumber,
      amountVnd,
      orderCode,
      qrTemplate: cfg.qrTemplate,
    }),
    createdAt: now,
    updatedAt: now,
  };

  persistOrders([order, ...store.orders]);
  return { ok: true, order, config: getPublicSepayConfig() };
}

export async function listUserOrders(req: any): Promise<{ ok: true; orders: PaymentOrder[]; vipStatus: VipStatusInfo }> {
  const caller = await verifyAuthenticatedUser(req);
  const store = getStore();
  const orders = store.orders
    .filter(o => o.uid === caller.uid)
    .map(o => ({
      ...o,
      qrUrl: buildSepayQrUrl({
        bankCode: store.config.bankCode,
        accountNumber: store.config.accountNumber,
        amountVnd: o.amountVnd,
        orderCode: o.orderCode,
        qrTemplate: store.config.qrTemplate,
      }),
    }));
  const vipStatus = await getUserVipStatus(req);
  return { ok: true, orders, vipStatus };
}

export async function getUserOrderStatus(req: any, orderCodeParam?: string): Promise<{
  ok: true;
  order: PaymentOrder;
  vipStatus: VipStatusInfo;
}> {
  const caller = await verifyAuthenticatedUser(req);
  const store = getStore();
  const code = String(orderCodeParam || parseBody(req).orderCode || req?.query?.orderCode || '')
    .trim()
    .toUpperCase();
  const order = store.orders.find(o => o.orderCode === code);
  if (!order) {
    throw new Error('Không tìm thấy mã đơn hàng.');
  }
  if (order.uid !== caller.uid) {
    // Allow admins to check any order too
    await verifyAdminCaller(req).catch(() => {
      throw new Error('Bạn không có quyền xem đơn hàng này.');
    });
  }
  const vipStatus = await getUserVipStatus(req);
  return {
    ok: true,
    order: {
      ...order,
      qrUrl: buildSepayQrUrl({
        bankCode: store.config.bankCode,
        accountNumber: store.config.accountNumber,
        amountVnd: order.amountVnd,
        orderCode: order.orderCode,
        qrTemplate: store.config.qrTemplate,
      }),
    },
    vipStatus,
  };
}

export async function getAdminSepayState(req: any): Promise<{
  ok: true;
  config: SepayAdminConfig;
  orders: PaymentOrder[];
  webhooks: SepayWebhookLog[];
  vips: StoredVipRecord[];
}> {
  await verifyAdminCaller(req);
  const store = getStore();
  const orders = store.orders.map(o => ({
    ...o,
    qrUrl: buildSepayQrUrl({
      bankCode: store.config.bankCode,
      accountNumber: store.config.accountNumber,
      amountVnd: o.amountVnd,
      orderCode: o.orderCode,
      qrTemplate: store.config.qrTemplate,
    }),
  }));
  return {
    ok: true,
    config: getAdminSepayConfig(),
    orders,
    webhooks: store.webhooks,
    vips: Object.values(store.vips).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export async function saveAdminSepayConfig(req: any): Promise<{ ok: true; config: SepayAdminConfig }> {
  await verifyAdminCaller(req);
  const body = parseBody(req);
  const store = getStore();
  const prev = store.config;

  const allowedAuthTypes: SepayAuthType[] = ['api_key', 'hmac_sha256', 'none'];
  const nextAuthType = allowedAuthTypes.includes(body.authType) ? body.authType : prev.authType;
  const allowedTemplates: SepayBankTemplate[] = ['compact', 'compact2', 'qr_only', 'print'];
  const nextTemplate = allowedTemplates.includes(body.qrTemplate) ? body.qrTemplate : prev.qrTemplate;

  let nextPackages = prev.packages;
  if (Array.isArray(body.packages) && body.packages.length > 0) {
    nextPackages = body.packages.slice(0, 12).map((item: any, idx: number) => ({
      id: String(item.id || `vip_custom_${idx + 1}`).trim().slice(0, 64),
      name: String(item.name || 'Gói VIP').trim().slice(0, 120),
      subtitle: item.subtitle ? String(item.subtitle).trim().slice(0, 240) : '',
      priceVnd: Math.max(1000, Math.round(Number(item.priceVnd) || 49000)),
      durationDays: Math.max(1, Math.min(3650, Math.round(Number(item.durationDays) || 30))),
      badgeText: item.badgeText ? String(item.badgeText).trim().slice(0, 40) : '',
      isPopular: Boolean(item.isPopular),
      isActive: item.isActive !== false,
      features: Array.isArray(item.features)
        ? item.features.map((f: unknown) => String(f || '').trim()).filter(Boolean).slice(0, 12)
        : [],
    }));
  }

  const nextApiKey =
    typeof body.apiKey === 'string' && body.apiKey.trim()
      ? body.apiKey.trim()
      : body.clearApiKey
      ? ''
      : prev.apiKey || '';

  const nextHmacSecret =
    typeof body.hmacSecret === 'string' && body.hmacSecret.trim()
      ? body.hmacSecret.trim()
      : body.clearHmacSecret
      ? ''
      : prev.hmacSecret || '';

  const rawPrefixInput =
    typeof body.orderPrefix === 'string' ? body.orderPrefix.trim().toUpperCase() : prev.orderPrefix;
  const lettersOnlyPrefix = rawPrefixInput.replace(/[^A-Z]/g, '').slice(0, 5);
  if (typeof body.orderPrefix === 'string' && (lettersOnlyPrefix.length < 2 || lettersOnlyPrefix.length > 5)) {
    throw new Error('Tiền tố mã thanh toán phải gồm 2–5 ký tự chữ cái (A-Z), ví dụ: TYT.');
  }
  const suffixBounds = normalizeSuffixBounds(
    body.orderSuffixMinLength ?? prev.orderSuffixMinLength,
    body.orderSuffixMaxLength ?? prev.orderSuffixMaxLength
  );

  const nextCfg: StoredSepayConfig = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : prev.enabled,
    bankCode: String(body.bankCode || prev.bankCode).trim().slice(0, 40) || 'MBBank',
    bankName: String(body.bankName || prev.bankName).trim().slice(0, 120) || 'MB Bank',
    accountNumber: String(body.accountNumber || prev.accountNumber).trim().slice(0, 40),
    accountHolder: String(body.accountHolder || prev.accountHolder).trim().slice(0, 120),
    subAccount: typeof body.subAccount === 'string' ? body.subAccount.trim().slice(0, 40) : prev.subAccount,
    orderPrefix: lettersOnlyPrefix.length >= 2 ? lettersOnlyPrefix : normalizeOrderPrefix(prev.orderPrefix),
    orderSuffixMinLength: suffixBounds.minLen,
    orderSuffixMaxLength: suffixBounds.maxLen,
    orderSuffixType: 'integer',
    webhookUrl: String(body.webhookUrl || prev.webhookUrl || DEFAULT_WEBHOOK_URL).trim() || DEFAULT_WEBHOOK_URL,
    qrTemplate: nextTemplate,
    packages: nextPackages,
    authType: nextAuthType,
    apiKey: nextApiKey,
    hmacSecret: nextHmacSecret,
    updatedAt: new Date().toISOString(),
  };

  persistConfig(nextCfg);
  return { ok: true, config: getAdminSepayConfig() };
}

export async function createAdminCustomOrder(req: any): Promise<{ ok: true; order: PaymentOrder }> {
  const admin = await verifyAdminCaller(req);
  const body = parseBody(req);
  const store = getStore();
  const cfg = store.config;

  const targetUid = String(body.uid || admin.uid).trim();
  const userName = String(body.userName || 'Khách hàng / Doanh nghiệp').trim().slice(0, 120);
  const userEmail = body.userEmail ? String(body.userEmail).trim().slice(0, 160) : undefined;
  const packageId = String(body.packageId || 'custom_order').trim();
  const matchedPkg = cfg.packages.find(p => p.id === packageId);
  const packageName =
    String(body.packageName || matchedPkg?.name || 'Đơn hàng thanh toán tùy chỉnh').trim().slice(0, 140);
  const amountVnd = Math.max(1000, Math.round(Number(body.amountVnd) || 0));
  const durationDays = Math.max(0, Math.min(3650, Math.round(Number(body.durationDays ?? matchedPkg?.durationDays ?? 30))));
  const orderType: 'vip_package' | 'custom_order' =
    body.orderType === 'vip_package' || matchedPkg ? 'vip_package' : 'custom_order';
  const orderCode = body.orderCode
    ? String(body.orderCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24)
    : generateOrderCode(
        cfg.orderPrefix,
        cfg.orderSuffixMinLength,
        cfg.orderSuffixMaxLength,
        store.orders
      );

  if (store.orders.some(o => o.orderCode === orderCode)) {
    throw new Error(`Mã đơn hàng ${orderCode} đã tồn tại.`);
  }

  const now = new Date().toISOString();
  const order: PaymentOrder = {
    id: orderCode,
    orderCode,
    uid: targetUid,
    ...(userEmail ? { userEmail } : {}),
    userName,
    packageId,
    packageName,
    orderType,
    amountVnd,
    currency: 'VND',
    status: 'pending',
    description: String(body.description || `Thanh toán đơn hàng ${orderCode}`).trim().slice(0, 240),
    customAmountConfiguredByAdmin: true,
    durationDays,
    ...(body.adminNote ? { adminNote: String(body.adminNote).trim().slice(0, 240) } : {}),
    qrUrl: buildSepayQrUrl({
      bankCode: cfg.bankCode,
      accountNumber: cfg.accountNumber,
      amountVnd,
      orderCode,
      qrTemplate: cfg.qrTemplate,
    }),
    createdAt: now,
    updatedAt: now,
  };

  persistOrders([order, ...store.orders]);
  return { ok: true, order };
}

export async function updateAdminOrder(req: any, orderCodeParam?: string): Promise<{ ok: true; order: PaymentOrder }> {
  await verifyAdminCaller(req);
  const body = parseBody(req);
  const store = getStore();
  const code = String(orderCodeParam || body.orderCode || '')
    .trim()
    .toUpperCase();
  const idx = store.orders.findIndex(o => o.orderCode === code);
  if (idx < 0) {
    throw new Error('Không tìm thấy đơn hàng để cập nhật.');
  }

  const current = store.orders[idx];
  const now = new Date().toISOString();
  const nextAmount =
    body.amountVnd !== undefined && body.amountVnd !== null
      ? Math.max(1000, Math.round(Number(body.amountVnd) || current.amountVnd))
      : current.amountVnd;

  const allowedStatuses: SepayOrderStatus[] = ['pending', 'paid', 'underpaid', 'cancelled'];
  const nextStatus: SepayOrderStatus = allowedStatuses.includes(body.status) ? body.status : current.status;

  const updated: PaymentOrder = {
    ...current,
    amountVnd: nextAmount,
    customAmountConfiguredByAdmin:
      body.amountVnd !== undefined && nextAmount !== current.amountVnd
        ? true
        : current.customAmountConfiguredByAdmin,
    status: nextStatus,
    ...(typeof body.packageName === 'string' && body.packageName.trim()
      ? { packageName: body.packageName.trim().slice(0, 140) }
      : {}),
    ...(typeof body.description === 'string' && body.description.trim()
      ? { description: body.description.trim().slice(0, 240) }
      : {}),
    ...(typeof body.adminNote === 'string' ? { adminNote: body.adminNote.trim().slice(0, 240) } : {}),
    ...(nextStatus === 'paid' && !current.paidAt
      ? { paidAt: now, paidAmountVnd: nextAmount, sepayGateway: current.sepayGateway || 'Admin Manual' }
      : {}),
    qrUrl: buildSepayQrUrl({
      bankCode: store.config.bankCode,
      accountNumber: store.config.accountNumber,
      amountVnd: nextAmount,
      orderCode: current.orderCode,
      qrTemplate: store.config.qrTemplate,
    }),
    updatedAt: now,
  };

  const nextOrders = [...store.orders];
  nextOrders[idx] = updated;
  persistOrders(nextOrders);

  if (nextStatus === 'paid' && updated.uid && (updated.durationDays || updated.orderType === 'vip_package')) {
    activateVipForUser({
      uid: updated.uid,
      userEmail: updated.userEmail,
      userName: updated.userName,
      vipTier: updated.packageId,
      vipPackageName: updated.packageName,
      durationDays: updated.durationDays || 30,
      orderCode: updated.orderCode,
      source: 'admin',
    });
  }

  return { ok: true, order: updated };
}

export async function updateAdminUserVip(req: any): Promise<{ ok: true; vip: StoredVipRecord }> {
  await verifyAdminCaller(req);
  const body = parseBody(req);
  const uid = String(body.uid || '').trim();
  if (!uid) {
    throw new Error('Thiếu UID tài khoản.');
  }
  const grant = body.isVip !== false;
  if (!grant) {
    const store = getStore();
    const existing = store.vips[uid];
    const revoked: StoredVipRecord = {
      uid,
      userEmail: existing?.userEmail || (body.userEmail ? String(body.userEmail) : undefined),
      userName: existing?.userName || (body.userName ? String(body.userName) : undefined),
      isVip: false,
      vipTier: existing?.vipTier || 'none',
      vipPackageName: existing?.vipPackageName || '',
      vipActivatedAt: existing?.vipActivatedAt || '',
      vipExpiresAt: new Date().toISOString(),
      source: 'admin',
      updatedAt: new Date().toISOString(),
    };
    persistVips({ ...store.vips, [uid]: revoked });
    return { ok: true, vip: revoked };
  }

  const vip = activateVipForUser({
    uid,
    userEmail: body.userEmail ? String(body.userEmail) : undefined,
    userName: body.userName ? String(body.userName) : undefined,
    vipTier: String(body.vipTier || 'account_verify').trim(),
    vipPackageName: String(body.vipPackageName || 'Xác Minh Tài Khoản Chính Thức (Verified)').trim(),
    durationDays: Math.max(1, Math.min(3650, Math.round(Number(body.durationDays) || 365))),
    orderCode: body.orderCode ? String(body.orderCode) : undefined,
    source: 'admin',
  });
  return { ok: true, vip };
}

function activateVipForUser(params: {
  uid: string;
  userEmail?: string;
  userName?: string;
  vipTier: string;
  vipPackageName: string;
  durationDays: number;
  orderCode?: string;
  source: 'sepay' | 'admin';
}): StoredVipRecord {
  const store = getStore();
  const now = new Date();
  const existing = store.vips[params.uid];
  let baseMs = now.getTime();
  if (existing?.isVip && existing.vipExpiresAt) {
    const prevExp = new Date(existing.vipExpiresAt).getTime();
    if (Number.isFinite(prevExp) && prevExp > baseMs) {
      baseMs = prevExp;
    }
  }
  const expiresAt = new Date(baseMs + Math.max(1, params.durationDays) * 86_400_000).toISOString();
  const record: StoredVipRecord = {
    uid: params.uid,
    ...(params.userEmail || existing?.userEmail ? { userEmail: params.userEmail || existing?.userEmail } : {}),
    ...(params.userName || existing?.userName ? { userName: params.userName || existing?.userName } : {}),
    isVip: true,
    vipTier: params.vipTier || 'account_verify',
    vipPackageName: params.vipPackageName || 'Xác Minh Tài Khoản Chính Thức (Verified)',
    vipActivatedAt: existing?.vipActivatedAt || now.toISOString(),
    vipExpiresAt: expiresAt,
    ...(params.orderCode ? { vipOrderCode: params.orderCode } : {}),
    source: params.source,
    updatedAt: now.toISOString(),
  };
  persistVips({ ...store.vips, [params.uid]: record });
  return record;
}

function parseBody(req: any): Record<string, any> {
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

function constantTimeEquals(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr, 'utf8');
  const b = Buffer.from(bStr, 'utf8');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyWebhookAuth(req: any, cfg: StoredSepayConfig): { ok: boolean; method: string; error?: string } {
  const authType = cfg.authType || 'none';
  if (authType === 'none') {
    return { ok: true, method: 'none' };
  }

  if (authType === 'api_key') {
    const expectedKey = String(cfg.apiKey || process.env.SEPAY_WEBHOOK_API_KEY || '').trim();
    if (!expectedKey) {
      return { ok: false, method: 'api_key', error: 'SePay API Key chưa được cấu hình trên máy chủ.' };
    }
    const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '').trim();
    const xApiKey = String(req?.headers?.['x-api-key'] || '').trim();
    let incomingKey = xApiKey;
    if (!incomingKey && authHeader) {
      const match = authHeader.match(/^(?:Apikey|Bearer)\s+(.+)$/i);
      incomingKey = match ? match[1].trim() : authHeader;
    }
    if (!incomingKey || !constantTimeEquals(incomingKey, expectedKey)) {
      return { ok: false, method: 'api_key', error: 'API Key xác thực SePay Webhook không hợp lệ.' };
    }
    return { ok: true, method: 'api_key' };
  }

  if (authType === 'hmac_sha256') {
    const secret = String(cfg.hmacSecret || process.env.SEPAY_HMAC_SECRET || '').trim();
    if (!secret) {
      return { ok: false, method: 'hmac_sha256', error: 'SePay HMAC Secret chưa được cấu hình.' };
    }
    const sigRaw = String(
      req?.headers?.['x-sepay-signature'] ||
        req?.headers?.signature ||
        req?.headers?.['x-signature'] ||
        ''
    ).trim();
    if (!sigRaw) {
      return { ok: false, method: 'hmac_sha256', error: 'Thiếu chữ ký HMAC-SHA256 từ SePay.' };
    }
    const normalizedSig = sigRaw.replace(/^sha256=/i, '').trim();
    const rawPayloadStr = req?.rawBody
      ? Buffer.isBuffer(req.rawBody)
        ? req.rawBody.toString('utf8')
        : String(req.rawBody)
      : typeof req?.body === 'string'
      ? req.body
      : JSON.stringify(req?.body || {});

    const tsHeader = String(req?.headers?.['x-sepay-timestamp'] || '').trim();
    const candidates: string[] = [rawPayloadStr];
    if (tsHeader) {
      const tsNum = Number(tsHeader);
      if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
        return {
          ok: false,
          method: 'hmac_sha256',
          error: 'X-SePay-Timestamp đã hết hạn hoặc không hợp lệ (quá 5 phút).',
        };
      }
      candidates.unshift(`${tsHeader}.${rawPayloadStr}`);
    }

    const matched = candidates.some(candidate => {
      const expectedHex = crypto.createHmac('sha256', secret).update(candidate, 'utf8').digest('hex');
      const expectedB64 = crypto.createHmac('sha256', secret).update(candidate, 'utf8').digest('base64');
      return (
        constantTimeEquals(normalizedSig.toLowerCase(), expectedHex.toLowerCase()) ||
        constantTimeEquals(normalizedSig, expectedB64)
      );
    });

    if (!matched) {
      return { ok: false, method: 'hmac_sha256', error: 'Chữ ký HMAC-SHA256 không khớp.' };
    }
    return { ok: true, method: 'hmac_sha256' };
  }

  return { ok: false, method: authType, error: 'Phương thức xác thực không được hỗ trợ.' };
}

function extractOrderCodeFromWebhook(payload: Record<string, any>, store: SepayStore): string {
  const directCode = String(payload.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (directCode && store.orders.some(o => o.orderCode === directCode)) {
    return directCode;
  }

  const searchSpace = `${String(payload.code || '')} ${String(payload.content || '')} ${String(
    payload.description || ''
  )}`.toUpperCase();

  // Check against known orders first (most reliable for custom/variable codes)
  for (const ord of store.orders) {
    if (ord.orderCode && searchSpace.includes(ord.orderCode)) {
      return ord.orderCode;
    }
  }

  // Fallback regex using configured prefix (2-5 letters) + integer suffix (2-8 digits)
  const prefix = normalizeOrderPrefix(store.config.orderPrefix);
  const { minLen, maxLen } = normalizeSuffixBounds(
    store.config.orderSuffixMinLength,
    store.config.orderSuffixMaxLength
  );
  const regex = new RegExp(`\\b(${prefix}\\d{${minLen},${maxLen}})\\b`, 'i');
  const match = searchSpace.match(regex);
  if (match?.[1]) {
    return match[1].toUpperCase();
  }
  return directCode;
}

export interface SepayWebhookResult {
  statusCode: number;
  body: Record<string, any>;
}

export function processSepayWebhook(
  req: any,
  options?: { bypassHeaderAuth?: boolean; authMethodLabel?: string }
): SepayWebhookResult {
  const store = getStore();
  const cfg = store.config;

  const authCheck = options?.bypassHeaderAuth
    ? { ok: true, method: options.authMethodLabel || 'demo_simulate' }
    : verifyWebhookAuth(req, cfg);

  if (!authCheck.ok) {
    return {
      statusCode: 401,
      body: { success: false, message: authCheck.error || 'Unauthorized' },
    };
  }

  const payload = parseBody(req);
  const sepayTxId = Number(payload.id || 0);
  const transferType = String(payload.transferType || '').toLowerCase() === 'out' ? 'out' : 'in';
  const transferAmount = Math.max(0, Number(payload.transferAmount) || 0);
  const gateway = String(payload.gateway || 'Bank').trim();
  const transactionDate = String(payload.transactionDate || new Date().toISOString()).trim();
  const accountNumber = String(payload.accountNumber || '').trim();
  const subAccount = payload.subAccount ? String(payload.subAccount).trim() : null;
  const content = String(payload.content || '').trim();
  const referenceCode = payload.referenceCode ? String(payload.referenceCode).trim() : '';
  const description = payload.description ? String(payload.description).trim() : '';
  const accumulated = payload.accumulated !== undefined ? Number(payload.accumulated) : undefined;
  const now = new Date().toISOString();

  // Deduplication check on id (> 0)
  if (
    sepayTxId > 0 &&
    store.webhooks.some(
      w => w.sepayTransactionId === sepayTxId && w.matchStatus !== 'duplicate_ignored'
    )
  ) {
    const dupLog: SepayWebhookLog = {
      id: `wh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      sepayTransactionId: sepayTxId,
      gateway,
      transactionDate,
      accountNumber,
      subAccount,
      code: payload.code ? String(payload.code) : null,
      content,
      transferType,
      transferAmount,
      accumulated,
      referenceCode,
      description,
      matchStatus: 'duplicate_ignored',
      authMethod: authCheck.method,
      receivedAt: now,
    };
    persistWebhooks([dupLog, ...store.webhooks]);
    return {
      statusCode: 200,
      body: { success: true, duplicate: true, message: 'Giao dịch đã được xử lý trước đó.' },
    };
  }

  if (transferType !== 'in') {
    const outLog: SepayWebhookLog = {
      id: `wh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      sepayTransactionId: sepayTxId,
      gateway,
      transactionDate,
      accountNumber,
      subAccount,
      code: payload.code ? String(payload.code) : null,
      content,
      transferType,
      transferAmount,
      accumulated,
      referenceCode,
      description,
      matchStatus: 'ignored_out',
      authMethod: authCheck.method,
      receivedAt: now,
    };
    persistWebhooks([outLog, ...store.webhooks]);
    return {
      statusCode: 200,
      body: { success: true, ignored: true, reason: 'outgoing_transfer' },
    };
  }

  const matchedOrderCode = extractOrderCodeFromWebhook(payload, store);
  const orderIdx = matchedOrderCode
    ? store.orders.findIndex(o => o.orderCode === matchedOrderCode)
    : -1;

  if (orderIdx < 0) {
    const unmatchedLog: SepayWebhookLog = {
      id: `wh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      sepayTransactionId: sepayTxId,
      gateway,
      transactionDate,
      accountNumber,
      subAccount,
      code: payload.code ? String(payload.code) : null,
      content,
      transferType,
      transferAmount,
      accumulated,
      referenceCode,
      description,
      ...(matchedOrderCode ? { matchedOrderCode } : {}),
      matchStatus: 'unmatched',
      authMethod: authCheck.method,
      receivedAt: now,
    };
    persistWebhooks([unmatchedLog, ...store.webhooks]);
    return {
      statusCode: 200,
      body: {
        success: true,
        matched: false,
        orderCode: matchedOrderCode || null,
        message: 'Đã ghi nhận webhook nhưng chưa khớp mã đơn hàng chờ thanh toán.',
      },
    };
  }

  const order = store.orders[orderIdx];
  const isPaid = transferAmount >= order.amountVnd;
  const nextStatus: SepayOrderStatus = isPaid ? 'paid' : 'underpaid';

  const updatedOrder: PaymentOrder = {
    ...order,
    status: order.status === 'paid' ? 'paid' : nextStatus,
    sepayTransactionId: sepayTxId || order.sepayTransactionId,
    sepayReferenceCode: referenceCode || order.sepayReferenceCode,
    sepayGateway: gateway || order.sepayGateway,
    paidAmountVnd: transferAmount,
    ...(isPaid ? { paidAt: now } : {}),
    updatedAt: now,
  };

  const nextOrders = [...store.orders];
  nextOrders[orderIdx] = updatedOrder;
  persistOrders(nextOrders);

  let activatedVip: StoredVipRecord | undefined;
  if (isPaid && updatedOrder.uid && (updatedOrder.orderType === 'vip_package' || (updatedOrder.durationDays || 0) > 0)) {
    activatedVip = activateVipForUser({
      uid: updatedOrder.uid,
      userEmail: updatedOrder.userEmail,
      userName: updatedOrder.userName,
      vipTier: updatedOrder.packageId,
      vipPackageName: updatedOrder.packageName,
      durationDays: updatedOrder.durationDays || 30,
      orderCode: updatedOrder.orderCode,
      source: 'sepay',
    });
  }

  const logEntry: SepayWebhookLog = {
    id: `wh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    sepayTransactionId: sepayTxId,
    gateway,
    transactionDate,
    accountNumber,
    subAccount,
    code: payload.code ? String(payload.code) : matchedOrderCode,
    content,
    transferType,
    transferAmount,
    accumulated,
    referenceCode,
    description,
    matchedOrderCode: updatedOrder.orderCode,
    matchStatus: isPaid ? 'matched_paid' : 'underpaid',
    authMethod: authCheck.method,
    receivedAt: now,
  };
  persistWebhooks([logEntry, ...store.webhooks]);

  return {
    statusCode: 200,
    body: {
      success: true,
      matched: true,
      order: updatedOrder,
      vipActivated: Boolean(activatedVip),
      vipStatus: activatedVip ? normalizeVipStatusRecord(activatedVip) : undefined,
    },
  };
}

export async function simulateSepayDemoPayment(req: any): Promise<Record<string, any>> {
  await verifyAdminCaller(req);
  const body = parseBody(req);
  const store = getStore();
  const orderCode = String(body.orderCode || '').trim().toUpperCase();

  const order = orderCode ? store.orders.find(o => o.orderCode === orderCode) : undefined;
  const simulatedAmount =
    body.transferAmount !== undefined
      ? Math.max(0, Number(body.transferAmount) || 0)
      : order
      ? order.amountVnd
      : Math.max(1000, Number(store.config.packages?.[0]?.priceVnd) || 50000);

  const txId = Math.floor(100000 + Math.random() * 8999999);
  const simulatedPayload = {
    id: txId,
    gateway: store.config.bankCode || 'MBBank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: store.config.accountNumber || '00010302003',
    subAccount: store.config.subAccount || null,
    code: order ? order.orderCode : orderCode || null,
    content: order
      ? `Chuyen khoan ${order.orderCode} xac minh tai khoan Verified`
      : String(body.content || `Test webhook ${orderCode || 'TYTVERIFY'}`),
    transferType: 'in',
    transferAmount: simulatedAmount,
    accumulated: simulatedAmount,
    referenceCode: `FT${Date.now().toString().slice(-8)}`,
    description: `Admin SePay Webhook Test -> ${DEFAULT_WEBHOOK_URL}`,
  };

  const result = processSepayWebhook(
    {
      headers: {},
      body: simulatedPayload,
      rawBody: Buffer.from(JSON.stringify(simulatedPayload), 'utf8'),
    },
    { bypassHeaderAuth: true, authMethodLabel: 'admin_manual_test' }
  );

  const vipStatus = await getUserVipStatus(req);
  return {
    ok: true,
    webhookPayload: simulatedPayload,
    webhookResponse: result.body,
    vipStatus,
  };
}

export async function testAdminWebhookEndpoint(req: any): Promise<Record<string, any>> {
  await verifyAdminCaller(req);
  const body = parseBody(req);
  const store = getStore();
  const cfg = store.config;

  const sampleCode = String(body.orderCode || '').trim().toUpperCase();
  const txId = Math.floor(100000 + Math.random() * 8999999);
  const amount = Math.max(1000, Math.round(Number(body.transferAmount) || 49000));
  const payload = {
    id: txId,
    gateway: cfg.bankCode || 'MBBank',
    transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
    accountNumber: cfg.accountNumber || '00010302003',
    subAccount: cfg.subAccount || '',
    code: sampleCode || null,
    content: sampleCode
      ? `Chuyen khoan ${sampleCode} test webhook SePay`
      : `SePay test webhook ${cfg.orderPrefix || 'TYT'}`,
    transferType: 'in',
    description: `Test Webhook tu SePay Dashboard (${cfg.webhookUrl || DEFAULT_WEBHOOK_URL})`,
    transferAmount: amount,
    accumulated: amount,
    referenceCode: `FT${Date.now().toString().slice(-8)}`,
  };

  const rawBodyStr = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (cfg.authType === 'api_key') {
    const key = String(cfg.apiKey || process.env.SEPAY_WEBHOOK_API_KEY || '').trim();
    if (key) headers.authorization = `Apikey ${key}`;
  } else if (cfg.authType === 'hmac_sha256') {
    const secret = String(cfg.hmacSecret || process.env.SEPAY_HMAC_SECRET || '').trim();
    const ts = String(Math.floor(Date.now() / 1000));
    headers['x-sepay-timestamp'] = ts;
    if (secret) {
      const hex = crypto.createHmac('sha256', secret).update(`${ts}.${rawBodyStr}`, 'utf8').digest('hex');
      headers['x-sepay-signature'] = `sha256=${hex}`;
    }
  }

  const result = processSepayWebhook({
    headers,
    body: payload,
    rawBody: Buffer.from(rawBodyStr, 'utf8'),
  });

  if (result.statusCode >= 400) {
    throw new Error(String(result.body?.message || 'Kiểm tra xác thực Webhook SePay thất bại.'));
  }

  return {
    ok: true,
    statusCode: result.statusCode,
    authTypeUsed: cfg.authType,
    webhookPayload: payload,
    webhookResponse: result.body,
  };
}
