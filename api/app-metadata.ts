import net from 'node:net';

interface IconCandidate {
  url: string;
  score: number;
  source: string;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  } else if (ipVersion === 6) {
    if (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd')
    ) {
      return true;
    }
  }
  return false;
}

function normalizeTargetUrl(rawUrl: string): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isBlockedHostname(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAttributes(tagStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tagStr)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = decodeHtmlEntities(val);
  }
  return attrs;
}

function resolveUrlSafely(rawHref: string, baseUrl: string): string | null {
  const clean = String(rawHref || '').trim();
  if (!clean || clean.startsWith('javascript:')) return null;
  if (clean.startsWith('data:image/')) return clean;
  try {
    const resolved = new URL(clean, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    if (isBlockedHostname(resolved.hostname)) return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function parseSizeScore(sizesAttr?: string): number {
  if (!sizesAttr) return 0;
  if (sizesAttr.toLowerCase() === 'any') return 260;
  let maxDim = 0;
  const matches = sizesAttr.matchAll(/(\d+)\s*x\s*(\d+)/gi);
  for (const m of matches) {
    const w = Number(m[1]) || 0;
    const h = Number(m[2]) || 0;
    maxDim = Math.max(maxDim, Math.min(w, h));
  }
  return maxDim;
}

function extractAppMetadataFromHtml(html: string, finalUrl: string) {
  const headSlice = html.slice(0, 300_000);
  const candidates: IconCandidate[] = [];

  const pushCandidate = (rawHref: string, baseScore: number, source: string, sizesAttr?: string) => {
    const absUrl = resolveUrlSafely(rawHref, finalUrl);
    if (!absUrl) return;
    let score = baseScore + Math.min(parseSizeScore(sizesAttr), 512);
    const lowerUrl = absUrl.toLowerCase();
    if (lowerUrl.endsWith('.svg') || lowerUrl.includes('.svg?')) score += 120;
    else if (lowerUrl.endsWith('.png') || lowerUrl.includes('.png?')) score += 80;
    else if (lowerUrl.endsWith('.webp') || lowerUrl.includes('.webp?')) score += 60;
    else if (lowerUrl.endsWith('.ico') || lowerUrl.includes('.ico?')) score -= 30;
    candidates.push({ url: absUrl, score, source });
  };

  // 1. Parse <link ...> tags for apple-touch-icon, icon, shortcut icon, fluid-icon, manifest
  let manifestHref = '';
  const linkTags = headSlice.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const attrs = parseAttributes(tag);
    const rel = (attrs.rel || '').toLowerCase();
    const href = attrs.href || '';
    if (!href || !rel) continue;

    if (rel.includes('apple-touch-icon')) {
      pushCandidate(href, 500, 'apple-touch-icon', attrs.sizes);
    } else if (rel === 'icon' || rel === 'shortcut icon' || /\bicon\b/.test(rel)) {
      pushCandidate(href, 380, rel, attrs.sizes);
    } else if (rel.includes('fluid-icon') || rel.includes('mask-icon')) {
      pushCandidate(href, 300, rel, attrs.sizes);
    } else if (rel === 'manifest' && !manifestHref) {
      manifestHref = resolveUrlSafely(href, finalUrl) || '';
    }
  }

  // 2. Parse <meta ...> tags for title, site_name, og:image, twitter:image, msapplication-TileImage
  let ogSiteName = '';
  let appNameMeta = '';
  let ogTitle = '';
  const metaTags = headSlice.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const attrs = parseAttributes(tag);
    const prop = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    const content = attrs.content || '';
    if (!prop || !content) continue;

    if (prop === 'og:site_name' && !ogSiteName) {
      ogSiteName = content;
    } else if (prop === 'application-name' && !appNameMeta) {
      appNameMeta = content;
    } else if ((prop === 'og:title' || prop === 'twitter:title') && !ogTitle) {
      ogTitle = content;
    } else if (prop === 'msapplication-tileimage') {
      pushCandidate(content, 420, 'msapplication-TileImage');
    } else if (prop === 'og:image' || prop === 'og:image:secure_url' || prop === 'twitter:image') {
      pushCandidate(content, 240, prop);
    }
  }

  // 3. Extract <title>
  const titleMatch = headSlice.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
  const cleanPageTitle = rawTitle ? rawTitle.split(/\s[|\-–—]\s/)[0].trim() : '';

  const extractedName = appNameMeta || ogSiteName || cleanPageTitle || ogTitle || '';

  return { candidates, manifestHref, extractedName };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Phương thức không hợp lệ' });
  }

  const rawInputUrl = req.method === 'POST' ? req.body?.url : req.query?.url;
  const normalizedUrl = normalizeTargetUrl(String(rawInputUrl || ''));
  if (!normalizedUrl) {
    return res.status(400).json({
      ok: false,
      error: 'Đường dẫn không hợp lệ hoặc không được phép truy cập.',
    });
  }

  const targetParsed = new URL(normalizedUrl);
  const googleFaviconFallback = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    targetParsed.hostname
  )}&sz=128`;
  const originFaviconFallback = `${targetParsed.origin}/favicon.ico`;

  let finalUrl = normalizedUrl;
  let extractedName = '';
  const allCandidates: IconCandidate[] = [];
  let htmlFetched = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(normalizedUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    }).finally(() => clearTimeout(timer));

    if (resp.url) {
      const checkedFinal = normalizeTargetUrl(resp.url);
      if (checkedFinal) finalUrl = checkedFinal;
    }

    if (resp.ok) {
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/xhtml') || !contentType) {
        const html = (await resp.text()).slice(0, 600_000);
        htmlFetched = true;
        const parsed = extractAppMetadataFromHtml(html, finalUrl);
        extractedName = parsed.extractedName;
        allCandidates.push(...parsed.candidates);

        // If web manifest exists and high-res icon isn't already abundant, inspect manifest icons
        if (parsed.manifestHref) {
          try {
            const mController = new AbortController();
            const mTimer = setTimeout(() => mController.abort(), 3500);
            const mResp = await fetch(parsed.manifestHref, {
              signal: mController.signal,
              headers: { Accept: 'application/json,application/manifest+json,*/*' },
            }).finally(() => clearTimeout(mTimer));
            if (mResp.ok) {
              const manifestJson = (await mResp.json().catch(() => null)) as {
                short_name?: string;
                name?: string;
                icons?: Array<{ src?: string; sizes?: string }>;
              } | null;
              if (manifestJson) {
                if (!extractedName && (manifestJson.short_name || manifestJson.name)) {
                  extractedName = String(manifestJson.short_name || manifestJson.name).trim();
                }
                if (Array.isArray(manifestJson.icons)) {
                  for (const icon of manifestJson.icons) {
                    if (!icon?.src) continue;
                    const resolved = resolveUrlSafely(icon.src, parsed.manifestHref);
                    if (resolved) {
                      allCandidates.push({
                        url: resolved,
                        score: 480 + Math.min(parseSizeScore(icon.sizes), 512),
                        source: 'manifest',
                      });
                    }
                  }
                }
              }
            }
          } catch {
            // ignore manifest fetch errors
          }
        }
      }
    }
  } catch {
    // Fallback gracefully if site blocks bot or times out
  }

  // Add fallback candidates at lower priority
  const finalOrigin = new URL(finalUrl).origin;
  allCandidates.push({
    url: `${finalOrigin}/apple-touch-icon.png`,
    score: 120,
    source: 'origin-apple-touch-fallback',
  });
  allCandidates.push({
    url: originFaviconFallback,
    score: 90,
    source: 'origin-favicon',
  });
  allCandidates.push({
    url: googleFaviconFallback,
    score: 50,
    source: 'google-s2-favicon',
  });

  // Sort by highest score and deduplicate URLs
  const sorted = [...allCandidates].sort((a, b) => b.score - a.score);
  const uniqueUrls: string[] = [];
  for (const item of sorted) {
    if (!uniqueUrls.includes(item.url)) {
      uniqueUrls.push(item.url);
    }
  }

  // Pick top candidate found in HTML; if none found in HTML, prefer Google high-res favicon fallback
  const htmlFoundUrls = sorted
    .filter(c => c.source !== 'origin-apple-touch-fallback' && c.source !== 'origin-favicon' && c.source !== 'google-s2-favicon')
    .map(c => c.url);

  const primaryLogo =
    htmlFoundUrls[0] ||
    (htmlFetched ? originFaviconFallback : googleFaviconFallback);

  const orderedCandidates = Array.from(
    new Set([primaryLogo, ...htmlFoundUrls, googleFaviconFallback, originFaviconFallback])
  ).slice(0, 6);

  return res.status(200).json({
    ok: true,
    url: finalUrl,
    name: extractedName || targetParsed.hostname.replace(/^www\./i, ''),
    logoUrl: primaryLogo,
    candidates: orderedCandidates,
    extractedFromHtml: htmlFoundUrls.length > 0,
  });
}
