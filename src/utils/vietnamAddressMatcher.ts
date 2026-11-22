import { DataJsonProvince, DataJsonWard } from '../components/common/WardSelector';

let cachedProvincesData: DataJsonProvince[] | null = null;
let cachedProvincesPromise: Promise<DataJsonProvince[]> | null = null;

export async function loadVietnamAdminUnits(): Promise<DataJsonProvince[]> {
  if (cachedProvincesData && cachedProvincesData.length > 0) {
    return cachedProvincesData;
  }
  if (!cachedProvincesPromise) {
    cachedProvincesPromise = fetch('/json/data.json')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const list = Array.isArray(data) ? (data as DataJsonProvince[]) : [];
        cachedProvincesData = list;
        return list;
      })
      .catch(() => []);
  }
  return cachedProvincesPromise;
}

export function normalizeVnAdminText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripProvincePrefix(name: string): string {
  return normalizeVnAdminText(name)
    .replace(/^(tinh|thanh pho|tp\.?)\s+/i, '')
    .trim();
}

function stripWardPrefix(name: string): string {
  return normalizeVnAdminText(name)
    .replace(/^(phuong|xa|thi tran|dac khu|quan|huyen|thi xa)\s+/i, '')
    .trim();
}

export interface ReverseGeocodeResult {
  specificAddress: string;
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  fullAddress: string;
  displayName: string;
}

function matchProvince(provinces: DataJsonProvince[], candidates: string[]): DataJsonProvince | undefined {
  const joined = normalizeVnAdminText(candidates.filter(Boolean).join(', '));
  if (!joined) return undefined;

  // Prefer exact/full match first
  for (const cand of candidates) {
    const normCand = normalizeVnAdminText(cand);
    if (!normCand) continue;
    const bareCand = stripProvincePrefix(cand);

    const exact = provinces.find(p => {
      const full = normalizeVnAdminText(p.name);
      const short = normalizeVnAdminText(p.short_name || p.name);
      const bare = stripProvincePrefix(short);
      return normCand === full || normCand === short || (bareCand.length >= 3 && bareCand === bare);
    });
    if (exact) return exact;
  }

  // Fallback substring match on display/candidates
  return provinces.find(p => {
    const full = normalizeVnAdminText(p.name);
    const short = normalizeVnAdminText(p.short_name || p.name);
    const bare = stripProvincePrefix(short);
    return (
      (full && joined.includes(full)) ||
      (short && joined.includes(short)) ||
      (bare.length >= 4 && joined.includes(bare))
    );
  });
}

function matchWardInProvince(
  province: DataJsonProvince,
  candidates: string[]
): DataJsonWard | undefined {
  const cleanCandidates = candidates
    .map(c => c.trim())
    .filter(Boolean);

  for (const cand of cleanCandidates) {
    const normCand = normalizeVnAdminText(cand);
    const bareCand = stripWardPrefix(cand);
    const exact = province.wards.find(w => {
      const full = normalizeVnAdminText(w.name);
      const bare = stripWardPrefix(w.name);
      return (
        normCand === full ||
        (bareCand.length >= 2 && bareCand === bare)
      );
    });
    if (exact) return exact;
  }

  const joined = normalizeVnAdminText(cleanCandidates.join(', '));
  return province.wards.find(w => {
    const full = normalizeVnAdminText(w.name);
    const bare = stripWardPrefix(w.name);
    return (full && joined.includes(full)) || (bare.length >= 4 && joined.includes(bare));
  });
}

export function formatVietnamFullAddress(
  specificAddress: string,
  wardName: string,
  provinceName: string
): string {
  const parts = [specificAddress.trim(), wardName.trim(), provinceName.trim()].filter(Boolean);
  // Deduplicate adjacent identical or contained fragments
  const deduped: string[] = [];
  for (const part of parts) {
    const normPart = normalizeVnAdminText(part);
    if (!normPart) continue;
    const alreadyExists = deduped.some(existing => normalizeVnAdminText(existing) === normPart);
    if (!alreadyExists) {
      deduped.push(part);
    }
  }
  return deduped.join(', ');
}

export function matchVietnamAddressFromGeocode(
  provinces: DataJsonProvince[],
  payload: {
    specificAddress?: string;
    wardCandidate?: string;
    provinceCandidate?: string;
    displayName?: string;
    rawAddress?: Record<string, any>;
  }
): ReverseGeocodeResult {
  const rawAddr = payload.rawAddress || {};
  const displayParts = String(payload.displayName || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const provinceCandidates = [
    payload.provinceCandidate || '',
    String(rawAddr.city || ''),
    String(rawAddr.state || ''),
    String(rawAddr.province || ''),
    ...displayParts.slice(-4),
  ];

  const matchedProv = matchProvince(provinces, provinceCandidates);

  const wardCandidates = [
    payload.wardCandidate || '',
    String(rawAddr.quarter || ''),
    String(rawAddr.suburb || ''),
    String(rawAddr.village || ''),
    String(rawAddr.town || ''),
    String(rawAddr.municipality || ''),
    String(rawAddr.city_district || ''),
    String(rawAddr.county || ''),
    ...displayParts,
  ];

  let matchedWard: DataJsonWard | undefined;
  let resolvedProv = matchedProv;

  if (matchedProv) {
    matchedWard = matchWardInProvince(matchedProv, wardCandidates);
  }

  // Fallback across all provinces if province was not matched or ward wasn't inside matchedProv
  if (!matchedWard && wardCandidates.filter(Boolean).length > 0) {
    for (const p of provinces) {
      const candidate = matchWardInProvince(p, [
        payload.wardCandidate || '',
        String(rawAddr.quarter || ''),
        String(rawAddr.suburb || ''),
        String(rawAddr.village || ''),
        String(rawAddr.town || ''),
      ]);
      if (candidate) {
        matchedWard = candidate;
        if (!resolvedProv) resolvedProv = p;
        break;
      }
    }
  }

  const provinceCode = resolvedProv?.province_code || '';
  const provinceName = resolvedProv?.name || String(payload.provinceCandidate || '').trim();
  const wardCode = matchedWard?.ward_code || '';
  const wardName = matchedWard?.name || String(payload.wardCandidate || '').trim();

  // Compute clean specific address
  let specificAddress = String(payload.specificAddress || '').trim();
  if (!specificAddress && displayParts.length > 0) {
    const normWard = normalizeVnAdminText(wardName);
    const normProv = normalizeVnAdminText(provinceName);
    const firstUseful = displayParts.filter(part => {
      const n = normalizeVnAdminText(part);
      if (!n || n === 'viet nam' || n === 'vietnam') return false;
      if (/^\d{5,6}$/.test(n)) return false;
      if (normWard && (n === normWard || n.includes(stripWardPrefix(normWard)))) return false;
      if (normProv && (n === normProv || n.includes(stripProvincePrefix(normProv)))) return false;
      return true;
    });
    specificAddress = firstUseful.slice(0, 2).join(', ');
  }

  const fullAddress = formatVietnamFullAddress(specificAddress, wardName, provinceName);

  return {
    specificAddress,
    provinceCode,
    provinceName,
    wardCode,
    wardName,
    fullAddress,
    displayName: String(payload.displayName || fullAddress),
  };
}

export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const provinces = await loadVietnamAdminUnits();

  // Try server proxy first
  try {
    const res = await fetch(
      `/api/maps/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
    );
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const json = await res.json();
      if (json?.ok) {
        return matchVietnamAddressFromGeocode(provinces, {
          specificAddress: json.specificAddress,
          wardCandidate: json.wardCandidate,
          provinceCandidate: json.provinceCandidate,
          displayName: json.displayName,
          rawAddress: json.rawAddress,
        });
      }
    }
  } catch {
    // Fall through to browser direct fallback
  }

  // Client fallback (CORS-friendly BigDataCloud)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        String(lat)
      )}&longitude=${encodeURIComponent(String(lng))}&localityLanguage=vi`
    );
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
      const displayName = [wardCandidate, data?.city, provinceCandidate]
        .filter(Boolean)
        .join(', ');

      return matchVietnamAddressFromGeocode(provinces, {
        specificAddress: String(data?.locality || ''),
        wardCandidate,
        provinceCandidate,
        displayName,
        rawAddress: data,
      });
    }
  } catch {
    // Return empty fallback
  }

  return {
    specificAddress: '',
    provinceCode: '',
    provinceName: '',
    wardCode: '',
    wardName: '',
    fullAddress: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    displayName: '',
  };
}
