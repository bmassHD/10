import { OrgChartConfig } from '../types';

export type OrgRoleKey = 'director' | 'deputy_director' | 'head' | 'deputy' | 'staff';

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
