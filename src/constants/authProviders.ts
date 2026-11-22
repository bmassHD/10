import {
  AuthProviderId,
  AuthProviderStatus,
  AuthProvidersStatusMap,
  SystemSettings,
} from '../types';

export type AuthProviderCategory = 'native' | 'additional' | 'custom' | 'portal';

export interface AuthProviderCatalogItem {
  id: AuthProviderId;
  label: string;
  category: AuthProviderCategory;
  description: string;
  defaultStatus: AuthProviderStatus;
  supportsPopupOAuth?: boolean;
}

export const AUTH_PROVIDER_CATEGORIES: Array<{
  id: AuthProviderCategory;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'native',
    title: 'Nhà cung cấp bản địa',
    subtitle: 'Các phương thức xác thực cơ bản tích hợp sẵn',
  },
  {
    id: 'additional',
    title: 'Các nhà cung cấp bổ sung',
    subtitle: 'Đăng nhập nhanh qua mạng xã hội & tài khoản bên thứ ba',
  },
  {
    id: 'custom',
    title: 'Nhà cung cấp tùy chỉnh',
    subtitle: 'Chuẩn liên kết định danh doanh nghiệp & cổng dịch vụ công',
  },
  {
    id: 'portal',
    title: 'Phương thức mở rộng của Cổng',
    subtitle: 'Đăng nhập nhanh Zalo OA & quét mã QR trên máy tính',
  },
];

export const AUTH_PROVIDER_CATALOG: AuthProviderCatalogItem[] = [
  // Nhà cung cấp bản địa
  {
    id: 'email_password',
    label: 'Email/Mật khẩu',
    category: 'native',
    description: 'Đăng nhập và đăng ký truyền thống bằng Email / Gmail và mật khẩu',
    defaultStatus: 'enabled',
  },
  {
    id: 'phone',
    label: 'Điện thoại',
    category: 'native',
    description: 'Xác thực đăng nhập bằng số điện thoại & mã OTP SMS',
    defaultStatus: 'disabled',
  },
  {
    id: 'anonymous',
    label: 'Vô danh',
    category: 'native',
    description: 'Truy cập phiên khách ẩn danh không cần cung cấp email',
    defaultStatus: 'disabled',
  },

  // Các nhà cung cấp bổ sung
  {
    id: 'google',
    label: 'Google',
    category: 'additional',
    description: 'Đăng nhập một chạm bằng tài khoản Google / Gmail',
    defaultStatus: 'enabled',
    supportsPopupOAuth: true,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    category: 'additional',
    description: 'Đăng nhập nhanh qua tài khoản Facebook',
    defaultStatus: 'enabled',
    supportsPopupOAuth: true,
  },
  {
    id: 'play_games',
    label: 'Chơi trò chơi',
    category: 'additional',
    description: 'Google Play Games Services (Android)',
    defaultStatus: 'disabled',
  },
  {
    id: 'game_center',
    label: 'Trung tâm trò chơi',
    category: 'additional',
    description: 'Apple Game Center (iOS / macOS)',
    defaultStatus: 'disabled',
  },
  {
    id: 'apple',
    label: 'Apple',
    category: 'additional',
    description: 'Đăng nhập bằng Apple ID (Sign in with Apple)',
    defaultStatus: 'disabled',
    supportsPopupOAuth: true,
  },
  {
    id: 'github',
    label: 'GitHub',
    category: 'additional',
    description: 'Đăng nhập bằng tài khoản GitHub',
    defaultStatus: 'disabled',
    supportsPopupOAuth: true,
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    category: 'additional',
    description: 'Đăng nhập bằng tài khoản Microsoft / Office 365',
    defaultStatus: 'disabled',
    supportsPopupOAuth: true,
  },
  {
    id: 'twitter',
    label: 'Twitter',
    category: 'additional',
    description: 'Đăng nhập bằng tài khoản X (Twitter)',
    defaultStatus: 'disabled',
    supportsPopupOAuth: true,
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    category: 'additional',
    description: 'Đăng nhập bằng tài khoản Yahoo Mail',
    defaultStatus: 'disabled',
    supportsPopupOAuth: true,
  },

  // Nhà cung cấp tùy chỉnh
  {
    id: 'oidc',
    label: 'Kết nối OpenID',
    category: 'custom',
    description: 'Chuẩn OpenID Connect (OIDC) / VNeID / SSO cấp Sở',
    defaultStatus: 'disabled',
  },
  {
    id: 'saml',
    label: 'SAML',
    category: 'custom',
    description: 'Chuẩn xác thực doanh nghiệp SAML 2.0',
    defaultStatus: 'disabled',
  },

  // Phương thức mở rộng của Cổng
  {
    id: 'zalo',
    label: 'Zalo',
    category: 'portal',
    description: 'Đăng nhập nhanh qua Zalo và đồng bộ họ tên, ảnh đại diện',
    defaultStatus: 'enabled',
  },
  {
    id: 'qr',
    label: 'Mã QR (PC)',
    category: 'portal',
    description: 'Quét mã QR từ điện thoại đã đăng nhập để vào nhanh trên máy tính',
    defaultStatus: 'enabled',
  },
];

export const DEFAULT_AUTH_PROVIDER_STATUSES: Record<AuthProviderId, AuthProviderStatus> =
  AUTH_PROVIDER_CATALOG.reduce(
    (acc, item) => {
      acc[item.id] = item.defaultStatus;
      return acc;
    },
    {} as Record<AuthProviderId, AuthProviderStatus>
  );

export function resolveAuthProvidersMap(
  settings?: SystemSettings | { providers?: AuthProvidersStatusMap }
): Record<AuthProviderId, AuthProviderStatus> {
  const customMap: AuthProvidersStatusMap | undefined =
    settings && 'authProvidersConfig' in settings
      ? settings.authProvidersConfig?.providers
      : (settings as { providers?: AuthProvidersStatusMap } | undefined)?.providers;

  const merged: Record<AuthProviderId, AuthProviderStatus> = {
    ...DEFAULT_AUTH_PROVIDER_STATUSES,
  };

  if (customMap && typeof customMap === 'object') {
    for (const item of AUTH_PROVIDER_CATALOG) {
      const val = customMap[item.id];
      if (val === 'enabled' || val === 'disabled' || val === 'maintenance') {
        merged[item.id] = val;
      }
    }
  }
  return merged;
}
