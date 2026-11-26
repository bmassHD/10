import { auth } from '../firebase/config';
import type {
  DonationFund,
  FundExpense,
  PaymentOrder,
  SepayAdminConfig,
  SepayAuthType,
  SepayBankTemplate,
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

export interface SepayVipRecord {
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

export async function fetchAdminSepayState(): Promise<{
  config: SepayAdminConfig;
  orders: PaymentOrder[];
  webhooks: SepayWebhookLog[];
  vips: SepayVipRecord[];
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
  fundId?: string;
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

export async function checkAdminPaymentOrder(orderCode: string): Promise<{
  ok: true;
  order: PaymentOrder;
  paid: boolean;
  matched: boolean;
  checkedAt: string;
  message: string;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-order-check', {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderCode }),
  });
  return parseJsonResponse(resp);
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

export async function deleteMyPaymentOrder(orderCode: string): Promise<{
  ok: true;
  deletedOrderCode: string;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/order-delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderCode }),
  });
  return parseJsonResponse(resp);
}

export async function deleteAdminPaymentOrder(orderCode: string): Promise<{
  ok: true;
  deletedOrderCode: string;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-order-delete', {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderCode }),
  });
  return parseJsonResponse(resp);
}

export async function deleteAdminWebhookLog(params: {
  id?: string;
  clearAll?: boolean;
}): Promise<{
  ok: true;
  deletedId?: string;
  clearedAll?: boolean;
  remainingCount: number;
}> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-webhook-delete', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseJsonResponse(resp);
}

export async function adminMarkOrderPaid(orderCode: string, adminNote?: string): Promise<PaymentOrder> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-order-mark-paid', {
    method: 'POST',
    headers,
    body: JSON.stringify({ orderCode, adminNote }),
  });
  const data = await parseJsonResponse<{ ok: true; order: PaymentOrder }>(resp);
  return data.order;
}

export async function fetchAdminFunds(): Promise<DonationFund[]> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-funds', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = await parseJsonResponse<{ ok: true; funds: DonationFund[] }>(resp);
  return data.funds || [];
}

export async function saveAdminFund(payload: Partial<DonationFund>): Promise<DonationFund> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-funds', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ ok: true; fund: DonationFund }>(resp);
  return data.fund;
}

export async function deleteAdminFund(id: string): Promise<string> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`/api/sepay/admin-funds?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });
  const data = await parseJsonResponse<{ ok: true; deletedId: string }>(resp);
  return data.deletedId;
}

export async function addFundExpense(payload: {
  fundId: string;
  purpose: string;
  amountVnd: number;
  expenseDate: string;
  notes?: string;
}): Promise<DonationFund> {
  const headers = await getAuthHeaders();
  const resp = await fetch('/api/sepay/admin-funds/expense', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ ok: true; fund: DonationFund }>(resp);
  return data.fund;
}

