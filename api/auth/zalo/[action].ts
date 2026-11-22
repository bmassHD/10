import {
  completeZaloExchange,
  createZaloAuthorizationUrl,
  getZaloStatusPayload,
  handleZaloOAuthCallback,
  resolveZaloMiniAppPhone,
} from '../../../src/server/zaloAuthService';

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
