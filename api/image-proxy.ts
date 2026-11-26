import dns from 'node:dns';
import net from 'node:net';

const MAX_REDIRECTS = 4;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB
const FETCH_TIMEOUT_MS = 10000;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  '169.254.169.254',
]);

function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase().replace(/^\[|\]$/g, '');
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 192 && b === 0) return true; // 192.0.0.0/16
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking 198.18.0.0/15
    if (a >= 224) return true; // multicast & reserved
    return false;
  }
  if (version === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) {
      return isPrivateOrReservedIp(ip.slice('::ffff:'.length));
    }
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA fc00::/7
    if (ip.startsWith('fe80:') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) {
      return true; // link-local fe80::/10
    }
    if (ip.startsWith('ff')) return true; // multicast
    return false;
  }
  return true;
}

function isBlockedHostSyntax(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localdomain')
  ) {
    return true;
  }
  if (net.isIP(host) !== 0) {
    return isPrivateOrReservedIp(host);
  }
  return false;
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ liên kết HTTP/HTTPS');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Không hỗ trợ liên kết chứa thông tin đăng nhập');
  }
  if (isBlockedHostSyntax(parsed.hostname)) {
    throw new Error('Tên miền hoặc địa chỉ IP không được phép truy cập');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) === 0) {
    const records = await dns.promises.lookup(host, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      throw new Error('Không phân giải được tên miền nguồn ảnh');
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error('Địa chỉ đích nằm trong mạng nội bộ không được phép truy cập');
      }
    }
  }
  return parsed;
}

function normalizePastedImageUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim().replace(/^["'<]+|[">']+$/g, '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  }

  // GitHub /blob/ or /raw/ -> raw.githubusercontent.com
  const ghMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+?)(?:\?.*)?$/i
  );
  if (ghMatch) {
    return `https://raw.githubusercontent.com/${ghMatch[1]}/${ghMatch[2]}/${ghMatch[3]}/${ghMatch[4]}`;
  }

  // Google Drive share links -> direct lh3 image endpoint
  const driveFileMatch = trimmed.match(
    /^https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i
  );
  if (driveFileMatch) {
    return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
  }
  const driveQueryMatch = trimmed.match(
    /^https?:\/\/(?:drive\.google\.com|drive\.usercontent\.google\.com)\/(?:open|uc|thumbnail|download)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/i
  );
  if (driveQueryMatch) {
    return `https://lh3.googleusercontent.com/d/${driveQueryMatch[1]}`;
  }

  return trimmed;
}

function sniffImageMimeType(buf: Buffer, fallbackType: string, urlStr: string): string | null {
  const cleanType = (fallbackType || '').split(';')[0].trim().toLowerCase();
  if (
    cleanType === 'image/jpeg' ||
    cleanType === 'image/jpg' ||
    cleanType === 'image/png' ||
    cleanType === 'image/webp' ||
    cleanType === 'image/gif' ||
    cleanType === 'image/avif' ||
    cleanType === 'image/bmp' ||
    cleanType === 'image/x-icon' ||
    cleanType === 'image/vnd.microsoft.icon' ||
    cleanType === 'image/svg+xml'
  ) {
    return cleanType === 'image/jpg' ? 'image/jpeg' : cleanType;
  }

  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (buf.length >= 6 && buf.slice(0, 6).toString('ascii').startsWith('GIF8')) {
    return 'image/gif';
  }
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
    return 'image/bmp';
  }
  if (cleanType === 'application/octet-stream' || cleanType === 'binary/octet-stream') {
    if (/\.jpe?g(\?|#|$)/i.test(urlStr)) return 'image/jpeg';
    if (/\.png(\?|#|$)/i.test(urlStr)) return 'image/png';
    if (/\.webp(\?|#|$)/i.test(urlStr)) return 'image/webp';
    if (/\.gif(\?|#|$)/i.test(urlStr)) return 'image/gif';
  }
  return null;
}

function extractOgImageFromHtml(html: string, baseUrl: string): string | null {
  const head = html.slice(0, 180_000);
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|og:image:url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image:secure_url|og:image|og:image:url|twitter:image|twitter:image:src)["'][^>]*>/i,
  ];
  for (const pat of patterns) {
    const m = head.match(pat);
    if (m?.[1]) {
      const raw = m[1]
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();
      try {
        const resolved = new URL(raw, baseUrl);
        if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
          return resolved.toString();
        }
      } catch {
        // ignore invalid og:image
      }
    }
  }
  return null;
}

async function fetchPublicResource(startUrl: string): Promise<{
  response: Response;
  finalUrl: string;
}> {
  let currentUrl = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = await assertPublicHttpUrl(currentUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(validated.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      if (resp.status >= 300 && resp.status < 400) {
        const location = resp.headers.get('location');
        if (!location) {
          throw new Error(`Chuyển hướng không hợp lệ (HTTP ${resp.status})`);
        }
        currentUrl = new URL(location, validated.toString()).toString();
        continue;
      }
      return { response: resp, finalUrl: validated.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Quá nhiều lần chuyển hướng khi tải ảnh');
}

async function readLimitedBuffer(resp: Response): Promise<Buffer> {
  const lenHeader = Number(resp.headers.get('content-length') || 0);
  if (Number.isFinite(lenHeader) && lenHeader > MAX_IMAGE_BYTES) {
    throw new Error('Kích thước ảnh vượt quá giới hạn 6MB');
  }
  const reader = resp.body?.getReader();
  if (!reader) {
    const ab = await resp.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Kích thước ảnh vượt quá giới hạn 6MB');
    }
    return Buffer.from(ab);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        throw new Error('Kích thước ảnh vượt quá giới hạn 6MB');
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c)));
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
  if (!rawUrl) {
    return res.status(400).json({ error: 'Thiếu tham số url' });
  }

  const normalizedUrl = normalizePastedImageUrl(rawUrl);
  if (!normalizedUrl) {
    return res.status(400).json({ error: 'Đường dẫn ảnh không hợp lệ' });
  }

  try {
    let { response, finalUrl } = await fetchPublicResource(normalizedUrl);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Máy chủ nguồn ảnh phản hồi lỗi HTTP ${response.status}`,
      });
    }

    let contentType = (response.headers.get('content-type') || '').toLowerCase();
    let buffer = await readLimitedBuffer(response);
    let imageMime = sniffImageMimeType(buffer, contentType, finalUrl);

    // If the user pasted a webpage URL (e.g. article/post/viewer) instead of direct image, try its og:image once
    if (!imageMime && (contentType.includes('text/html') || contentType.includes('application/xhtml'))) {
      const htmlText = buffer.toString('utf-8');
      const ogImgUrl = extractOgImageFromHtml(htmlText, finalUrl);
      if (ogImgUrl) {
        const ogRes = await fetchPublicResource(normalizePastedImageUrl(ogImgUrl));
        if (ogRes.response.ok) {
          contentType = (ogRes.response.headers.get('content-type') || '').toLowerCase();
          buffer = await readLimitedBuffer(ogRes.response);
          finalUrl = ogRes.finalUrl;
          imageMime = sniffImageMimeType(buffer, contentType, finalUrl);
        }
      }
    }

    if (!imageMime) {
      return res.status(415).json({
        error: 'Liên kết không trả về dữ liệu hình ảnh hợp lệ',
      });
    }

    res.setHeader('Content-Type', imageMime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (imageMime === 'image/svg+xml') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    }
    res.setHeader('Cache-Control', 'public, max-age=1800');
    return res.status(200).send(buffer);
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    const message = isTimeout
      ? 'Hết thời gian kết nối tới máy chủ nguồn ảnh'
      : err?.message || 'Không thể tải ảnh từ URL này';
    const status = isTimeout
      ? 504
      : /không được phép|không hỗ trợ|không hợp lệ/i.test(message)
      ? 400
      : /giới hạn/i.test(message)
      ? 413
      : 502;
    return res.status(status).json({ error: message });
  }
}
