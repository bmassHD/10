import { auth } from '../firebase/config';
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

export function formatVnd(amount: number): string {
  return `${Math.max(0, Math.round(Number(amount) || 0)).toLocaleString('vi-VN')} đ`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken().catch(() => undefined);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJsonResponse<T>(resp: Response): Promise<T> {
  const data = (await resp.json().catch(() => ({}))) as any;
  if (!resp.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || `Lỗi máy chủ (HTTP ${resp.status}).`);
  }
  return data as T;
}

export async function fetchPublicSepayConfig(): Promise<SepayPublicConfig> {
  const resp = await fetch('/api/sepay/public-config', { cache: 'no-store' });
  const data = await parseJsonResponse<{ ok: true; config: SepayPublicConfig }>(resp);
  return data.config;
}

export async function fetchMyVipStatus(): Promise<VipStatusInfo> {
  if (!auth.currentUser) {
    return { isVip: false, source: 'none' };
  }
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/my-vip-status', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = await parseJsonResponse<{ ok: true; vipStatus: VipStatusInfo }>(resp);
  return data.vipStatus;
}

export async function fetchMyPaymentOrders(): Promise<{
  orders: PaymentOrder[];
  vipStatus: VipStatusInfo;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/orders', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  return parseJsonResponse<{ ok: true; orders: PaymentOrder[]; vipStatus: VipStatusInfo }>(resp);
}

export async function createVipPaymentOrder(params: {
  packageId: string;
  userName?: string;
}): Promise<{ order: PaymentOrder; config: SepayPublicConfig }> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseJsonResponse<{ ok: true; order: PaymentOrder; config: SepayPublicConfig }>(resp);
}

export async function pollPaymentOrderStatus(orderCode: string): Promise<{
  order: PaymentOrder;
  vipStatus: VipStatusInfo;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch(
    `/api/sepay/order-status?orderCode=${encodeURIComponent(orderCode)}`,
    {
      method: 'GET',
      headers,
      cache: 'no-store',
    }
  );
  return parseJsonResponse<{ ok: true; order: PaymentOrder; vipStatus: VipStatusInfo }>(resp);
}

export async function simulateSepayWebhookPayment(params: {
  orderCode: string;
  transferAmount?: number;
}): Promise<{
  webhookPayload: Record<string, any>;
  webhookResponse: Record<string, any>;
  vipStatus: VipStatusInfo;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/demo-simulate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseJsonResponse(resp);
}

export async function fetchAdminSepayState(): Promise<{
  config: SepayAdminConfig;
  orders: PaymentOrder[];
  webhooks: SepayWebhookLog[];
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-state', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  return parseJsonResponse(resp);
}

export async function saveAdminSepayConfig(payload: {
  enabled: boolean;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  subAccount?: string;
  orderPrefix: string;
  orderSuffixMinLength?: number;
  orderSuffixMaxLength?: number;
  orderSuffixType?: 'integer';
  webhookUrl: string;
  qrTemplate: SepayBankTemplate;
  authType: SepayAuthType;
  apiKey?: string;
  hmacSecret?: string;
  clearApiKey?: boolean;
  clearHmacSecret?: boolean;
  packages: VipPackageConfig[];
}): Promise<SepayAdminConfig> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-config', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ ok: true; config: SepayAdminConfig }>(resp);
  return data.config;
}

export async function createAdminCustomPaymentOrder(payload: {
  uid: string;
  userName: string;
  userEmail?: string;
  packageId?: string;
  packageName: string;
  orderType: 'vip_package' | 'custom_order';
  amountVnd: number;
  durationDays?: number;
  description?: string;
  adminNote?: string;
  orderCode?: string;
}): Promise<PaymentOrder> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ ok: true; order: PaymentOrder }>(resp);
  return data.order;
}

export async function updateAdminPaymentOrder(payload: {
  orderCode: string;
  amountVnd?: number;
  status?: SepayOrderStatus;
  packageName?: string;
  description?: string;
  adminNote?: string;
}): Promise<PaymentOrder> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-order-update', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ ok: true; order: PaymentOrder }>(resp);
  return data.order;
}

export async function updateAdminUserVipStatus(payload: {
  uid: string;
  userEmail?: string;
  userName?: string;
  isVip: boolean;
  vipTier?: string;
  vipPackageName?: string;
  durationDays?: number;
}): Promise<void> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-vip', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  await parseJsonResponse(resp);
}

export async function runAdminSepayWebhookTest(payload?: {
  orderCode?: string;
  transferAmount?: number;
}): Promise<{
  ok: true;
  statusCode: number;
  authTypeUsed: string;
  webhookPayload: Record<string, any>;
  webhookResponse: Record<string, any>;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-test-webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
  });
  return parseJsonResponse(resp);
}
