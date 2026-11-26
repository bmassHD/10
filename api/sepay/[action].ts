import {
  createAdminCustomOrder,
  createUserPaymentOrder,
  getAdminSepayState,
  getPublicSepayConfig,
  getUserOrderStatus,
  getUserVipStatus,
  listUserOrders,
  saveAdminSepayConfig,
  simulateSepayDemoPayment,
  testAdminWebhookEndpoint,
  updateAdminOrder,
  updateAdminUserVip,
} from '../../src/server/sepayService';

function resolveAction(req: any): string {
  const raw = req.query?.action;
  if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim().toLowerCase();
  try {
    const pathname = new URL(req.url || '', 'http://localhost').pathname;
    const parts = pathname.split('/').filter(Boolean);
    const sepayIdx = parts.indexOf('sepay');
    if (sepayIdx >= 0) {
      return parts.slice(sepayIdx + 1).join('/').toLowerCase();
    }
    return (parts[parts.length - 1] || '').toLowerCase();
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

  try {
    if (action === 'public-config' && req.method === 'GET') {
      return res.status(200).json({ ok: true, config: getPublicSepayConfig() });
    }
    if (action === 'my-vip-status' && req.method === 'GET') {
      const vipStatus = await getUserVipStatus(req);
      return res.status(200).json({ ok: true, vipStatus });
    }
    if (action === 'orders') {
      if (req.method === 'GET') {
        return res.status(200).json(await listUserOrders(req));
      }
      if (req.method === 'POST') {
        return res.status(200).json(await createUserPaymentOrder(req));
      }
    }
    if (action.startsWith('orders/') && action.endsWith('/status') && req.method === 'GET') {
      const orderCode = action.split('/')[1] || '';
      return res.status(200).json(await getUserOrderStatus(req, orderCode));
    }
    if (action === 'order-status' && req.method === 'GET') {
      return res.status(200).json(await getUserOrderStatus(req));
    }
    if (action === 'demo-simulate' && req.method === 'POST') {
      return res.status(200).json(await simulateSepayDemoPayment(req));
    }
    if (action === 'admin-state' && req.method === 'GET') {
      return res.status(200).json(await getAdminSepayState(req));
    }
    if (action === 'admin-config' && req.method === 'POST') {
      return res.status(200).json(await saveAdminSepayConfig(req));
    }
    if (action === 'admin-orders' && req.method === 'POST') {
      return res.status(200).json(await createAdminCustomOrder(req));
    }
    if (action === 'admin-order-update' && (req.method === 'PATCH' || req.method === 'POST')) {
      return res.status(200).json(await updateAdminOrder(req));
    }
    if (action === 'admin-vip' && req.method === 'POST') {
      return res.status(200).json(await updateAdminUserVip(req));
    }
    if (action === 'admin-test-webhook' && req.method === 'POST') {
      return res.status(200).json(await testAdminWebhookEndpoint(req));
    }
    return res.status(404).json({ ok: false, error: 'Endpoint SePay không tồn tại.' });
  } catch (err: any) {
    const msg = err?.message || 'Lỗi xử lý yêu cầu SePay.';
    const status = msg.includes('đăng nhập') || msg.includes('hết hạn') ? 401 : msg.includes('quyền') ? 403 : 400;
    return res.status(status).json({ ok: false, error: msg });
  }
}
