import { OrgChartConfig } from '../types';
import { ORG_DEFAULT_DEPARTMENT_SPECS } from '../data/defaultOrgChart';

export type OrgRoleKey = 'director' | 'deputy_director' | 'head' | 'deputy' | 'staff';

export interface StationDepartmentOption {
  value: string;
  label: string;
}

export function normalizeCccd(value?: string | null): string {
  return (value || '').replace(/[\s.-]/g, '').trim().toUpperCase();
}

export function normalizePhone(value?: string | null): string {
  return (value || '').replace(/[\s.-]/g, '').trim();
}

export function normalizeTextNoDiacritics(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function maskCccdForPublic(cccd?: string | null): string {
  const clean = normalizeCccd(cccd);
  if (!clean) return '';
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 3)}${'•'.repeat(Math.max(4, clean.length - 7))}${clean.slice(-4)}`;
}

export function stripDepartmentNumberPrefix(name?: string | null): string {
  return (name || '').replace(/^\d+\s*[.\-_:]\s*/, '').trim();
}

/**
 * Kiểm tra tài khoản được Admin chỉ định là Nhân viên Y tế (không phải Admin / Super Admin).
 */
export function isNonAdminHealthStaffAccount(
  accountType?: string | null,
  role?: string | null
): boolean {
  if (accountType === 'admin' || role === 'admin' || role === 'super_admin') {
    return false;
  }
  return (
    accountType === 'employee' ||
    role === 'staff' ||
    role === 'doctor' ||
    role === 'nurse' ||
    role === 'communicator' ||
    role === 'leadership'
  );
}

/**
 * Lấy danh sách Khoa / Phòng / Đơn vị thuộc nhân lực của Trạm Y tế
 * từ Sơ đồ tổ chức (fallback sang danh sách khoa/phòng chuẩn nếu chưa khởi tạo).
 */
export function getStationDepartmentOptions(
  orgChart?: OrgChartConfig | null,
  currentValue?: string | null
): StationDepartmentOption[] {
  const options: StationDepartmentOption[] = [
    { value: 'Ban Giám đốc', label: 'Ban Giám đốc' },
  ];
  const seenNormalized = new Set<string>([
    normalizeTextNoDiacritics('Ban Giám đốc'),
  ]);

  const rawDepts = Array.isArray(orgChart?.departments) ? orgChart.departments : [];
  if (rawDepts.length > 0) {
    rawDepts.forEach((dept, idx) => {
      const cleanName = stripDepartmentNumberPrefix(dept.name || '') || (dept.name || '').trim();
      if (!cleanName) return;
      const norm = normalizeTextNoDiacritics(cleanName);
      if (seenNormalized.has(norm)) return;
      seenNormalized.add(norm);
      options.push({
        value: cleanName,
        label: `${idx + 1}. ${cleanName}`,
      });
    });
  } else {
    ORG_DEFAULT_DEPARTMENT_SPECS.forEach((spec) => {
      const cleanName = spec.name.trim();
      const norm = normalizeTextNoDiacritics(cleanName);
      if (seenNormalized.has(norm)) return;
      seenNormalized.add(norm);
      options.push({
        value: cleanName,
        label: `${spec.index}. ${cleanName}`,
      });
    });
  }

  const trimmedCurrent = (currentValue || '').trim();
  if (trimmedCurrent) {
    const normCurrent = normalizeTextNoDiacritics(
      stripDepartmentNumberPrefix(trimmedCurrent) || trimmedCurrent
    );
    if (!seenNormalized.has(normCurrent)) {
      options.push({
        value: trimmedCurrent,
        label: `${trimmedCurrent} (Hiện tại)`,
      });
    }
  }

  return options;
}

export function resolveDepartmentOptionValue(
  currentValue: string | undefined | null,
  options: StationDepartmentOption[]
): string {
  const trimmed = (currentValue || '').trim();
  if (!trimmed) return '';
  const direct = options.find((o) => o.value === trimmed);
  if (direct) return direct.value;
  const normCurrent = normalizeTextNoDiacritics(
    stripDepartmentNumberPrefix(trimmed) || trimmed
  );
  const byNorm = options.find(
    (o) =>
      normalizeTextNoDiacritics(stripDepartmentNumberPrefix(o.value) || o.value) ===
      normCurrent
  );
  return byNorm ? byNorm.value : trimmed;
}

/**
 * Nhân bản cấu trúc Sơ đồ tổ chức & Nhân lực khoa phòng độc lập
 * (liên kết trực tiếp 2 chiều giữa Nhân lực khoa phòng và Sơ đồ tổ chức, tách khỏi tài khoản người dùng).
 */
export function cloneOrgChartConfig(source: OrgChartConfig): OrgChartConfig {
  return {
    director: source.director ? { ...source.director } : undefined,
    deputyDirectors: (source.deputyDirectors || []).map(d => ({ ...d })),
    departments: (source.departments || []).map(dept => ({
      ...dept,
      head: dept.head ? { ...dept.head } : undefined,
      deputies: (dept.deputies || []).map(p => ({ ...p })),
      staff: (dept.staff || []).map(s => ({ ...s })),
    })),
    updatedAt: source.updatedAt,
  };
}
