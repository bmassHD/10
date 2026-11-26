import { processSepayWebhook } from '../../src/server/sepayService';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      service: 'SePay Payment Webhook Endpoint',
      webhookUrl: 'https://tyt.slhd.id.vn/hooks/sepay-payment',
      status: 'ready',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const result = processSepayWebhook(req);
    return res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Lỗi xử lý SePay Webhook.',
    });
  }
}
