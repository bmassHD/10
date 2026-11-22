import {
  approveQrLoginSession,
  createQrLoginSession,
  inspectQrLoginSession,
  pollQrLoginSession,
} from '../../../src/server/qrLoginService';

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
      return res.status(200).json(createQrLoginSession(req));
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
      return res.status(200).json(pollQrLoginSession(req));
    }
    return res.status(404).json({ ok: false, error: 'Endpoint QR Auth không tồn tại.' });
  } catch (err: any) {
    const message = err?.message || 'Không thể xử lý yêu cầu đăng nhập QR.';
    const status = message.includes('đăng nhập trên điện thoại') ? 401 : 400;
    return res.status(status).json({ ok: false, error: message });
  }
}
