import { EpidemicCaseStatus, EpidemicDiseaseType } from '../types';

export interface EpidemicDiseaseOption {
  id: EpidemicDiseaseType;
  label: string;
  shortLabel: string;
  defaultRadiusMeters: number;
  color: string;
  fillColor: string;
  badgeBgClass: string;
  badgeTextClass: string;
  description: string;
}

export const EPIDEMIC_DISEASE_OPTIONS: ReadonlyArray<EpidemicDiseaseOption> = [
  {
    id: 'sot_xuat_huyet',
    label: 'Sốt xuất huyết',
    shortLabel: 'SXH',
    defaultRadiusMeters: 200,
    color: '#dc2626',
    fillColor: '#ef4444',
    badgeBgClass: 'bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
    badgeTextClass: 'text-rose-700 dark:text-rose-300',
    description:
      'Khoanh vùng ca bệnh / ổ dịch Sốt xuất huyết Dengue tại nhà dân để giám sát vector truyền bệnh và xử lý môi trường.',
  },
];

export const EPIDEMIC_RADIUS_PRESETS: ReadonlyArray<number> = [50, 100, 150, 200, 300, 500, 1000];

export const EPIDEMIC_STATUS_META: Record<
  EpidemicCaseStatus,
  {
    label: string;
    circleColor: string;
    circleFillColor: string;
    badgeClass: string;
  }
> = {
  active: {
    label: 'Đang khoanh vùng',
    circleColor: '#dc2626',
    circleFillColor: '#ef4444',
    badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  },
  monitoring: {
    label: 'Đang theo dõi',
    circleColor: '#d97706',
    circleFillColor: '#f59e0b',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  resolved: {
    label: 'Đã xử lý / An toàn',
    circleColor: '#059669',
    circleFillColor: '#10b981',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

export function getEpidemicDiseaseConfig(diseaseType?: string): EpidemicDiseaseOption {
  return (
    EPIDEMIC_DISEASE_OPTIONS.find(item => item.id === diseaseType) || EPIDEMIC_DISEASE_OPTIONS[0]
  );
}
