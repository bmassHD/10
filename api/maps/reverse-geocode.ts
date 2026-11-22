export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận GET hoặc POST' });
  }

  const rawLat = req.method === 'GET' ? req.query?.lat : req.body?.lat;
  const rawLng = req.method === 'GET' ? req.query?.lng : req.body?.lng;

  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Tọa độ lat/lng không hợp lệ.' });
  }

  // Try OpenStreetMap Nominatim first (detailed street/house number in Vietnam)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        String(lat)
      )}&lon=${encodeURIComponent(String(lng))}&zoom=18&addressdetails=1&accept-language=vi`;

      const nominatimRes = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'TramYTePortal/3.0 (epidemic-map-reverse-geocode)',
          'Accept-Language': 'vi,en;q=0.8',
          Accept: 'application/json',
        },
      });

      if (nominatimRes.ok) {
        const data: any = await nominatimRes.json();
        const addr: Record<string, string> = (data && typeof data.address === 'object' && data.address) || {};

        const streetParts = [
          addr.house_number,
          addr.road || addr.pedestrian || addr.footway || addr.residential || addr.path,
        ].filter(Boolean);

        const localityDetail =
          addr.hamlet ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.city_block ||
          addr.residential ||
          '';

        const specificParts: string[] = [];
        if (streetParts.length > 0) {
          specificParts.push(streetParts.join(' '));
        }
        if (localityDetail && !specificParts.join(' ').toLowerCase().includes(String(localityDetail).toLowerCase())) {
          specificParts.push(String(localityDetail));
        }

        const wardCandidate =
          addr.quarter ||
          addr.suburb ||
          addr.village ||
          addr.town ||
          addr.municipality ||
          addr.city_district ||
          addr.county ||
          '';

        const provinceCandidate =
          addr.city ||
          addr.state ||
          addr.province ||
          addr.region ||
          '';

        return res.status(200).json({
          ok: true,
          provider: 'nominatim',
          lat,
          lng,
          displayName: String(data?.display_name || ''),
          specificAddress: specificParts.join(', '),
          wardCandidate: String(wardCandidate || ''),
          provinceCandidate: String(provinceCandidate || ''),
          rawAddress: addr,
        });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Fall through to BigDataCloud fallback
  }

  // Fallback to BigDataCloud reverse geocode
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        String(lat)
      )}&longitude=${encodeURIComponent(String(lng))}&localityLanguage=vi`;
      const bdcRes = await fetch(bdcUrl, { signal: controller.signal });
      if (bdcRes.ok) {
        const data: any = await bdcRes.json();
        const adminList: Array<{ name?: string; adminLevel?: number }> = Array.isArray(
          data?.localityInfo?.administrative
        )
          ? data.localityInfo.administrative
          : [];
        const sortedAdmin = [...adminList].sort((a, b) => (b.adminLevel || 0) - (a.adminLevel || 0));
        const wardCandidate = data?.locality || sortedAdmin[0]?.name || '';
        const provinceCandidate = data?.principalSubdivision || data?.city || '';
        const displayName = [wardCandidate, data?.city, provinceCandidate, data?.countryName]
          .filter(Boolean)
          .join(', ');

        return res.status(200).json({
          ok: true,
          provider: 'bigdatacloud',
          lat,
          lng,
          displayName,
          specificAddress: String(data?.locality || ''),
          wardCandidate: String(wardCandidate || ''),
          provinceCandidate: String(provinceCandidate || ''),
          rawAddress: data || {},
        });
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Ignore and return graceful error
  }

  return res.status(502).json({
    ok: false,
    error: 'Không thể lấy địa chỉ tự động từ tọa độ GPS. Vui lòng nhập địa chỉ thủ công.',
  });
}
