const ALLOWED_HOSTS = new Set([
  'raw.githubusercontent.com',
  'github.com',
  'www.github.com',
  'gist.githubusercontent.com',
  'objects.githubusercontent.com',
  'codeload.github.com',
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

function inferMimeType(fileName: string, urlStr: string, fallbackType?: string | null): string {
  const combined = `${fileName} ${urlStr}`.toLowerCase();
  if (/\.pdf(\?|#|$)/i.test(combined)) return 'application/pdf';
  if (/\.png(\?|#|$)/i.test(combined)) return 'image/png';
  if (/\.jpe?g(\?|#|$)/i.test(combined)) return 'image/jpeg';
  if (/\.webp(\?|#|$)/i.test(combined)) return 'image/webp';
  if (/\.gif(\?|#|$)/i.test(combined)) return 'image/gif';
  if (/\.svg(\?|#|$)/i.test(combined)) return 'image/svg+xml';
  if (/\.docx(\?|#|$)/i.test(combined)) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (/\.doc(\?|#|$)/i.test(combined)) return 'application/msword';
  if (/\.xlsx(\?|#|$)/i.test(combined)) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (/\.xls(\?|#|$)/i.test(combined)) return 'application/vnd.ms-excel';
  if (/\.txt(\?|#|$)/i.test(combined)) return 'text/plain; charset=utf-8';
  const cleanFallback = (fallbackType || '').split(';')[0].trim().toLowerCase();
  if (cleanFallback && cleanFallback !== 'text/plain' && cleanFallback !== 'application/octet-stream') {
    return cleanFallback;
  }
  return 'application/octet-stream';
}

function normalizeUpstreamUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const blobMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i
  );
  if (blobMatch) {
    return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}/${blobMatch[4]}`;
  }
  return trimmed;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức GET' });
  }

  const rawUrl = String(req.query?.url || '').trim();
  const requestedName = String(req.query?.name || '').trim();
  const forceDownload = req.query?.download === '1' || req.query?.download === 'true';

  if (!rawUrl) {
    return res.status(400).json({ error: 'Thiếu tham số url' });
  }

  const normalizedUrl = normalizeUpstreamUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return res.status(400).json({ error: 'Đường dẫn tệp không hợp lệ' });
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return res.status(400).json({ error: 'Chỉ hỗ trợ giao thức HTTP/HTTPS' });
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(403).json({ error: 'Tên miền nguồn tệp không nằm trong danh sách cho phép' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'TramYTePortal-FileProxy/1.0',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Không thể tải tệp từ nguồn lưu trữ (HTTP ${upstream.status})`,
      });
    }

    const arrayBuf = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const fallbackName = requestedName || parsed.pathname.split('/').pop() || 'van-ban';
    const safeFileName = fallbackName.replace(/[\r\n"]/g, '_');
    const contentType = inferMimeType(safeFileName, parsed.toString(), upstream.headers.get('content-type'));

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(safeFileName)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).send(buffer);
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout
        ? 'Hết thời gian kết nối tới máy chủ lưu trữ tệp'
        : err?.message || 'Lỗi proxy tải tệp văn bản',
    });
  } finally {
    clearTimeout(timeout);
  }
}
