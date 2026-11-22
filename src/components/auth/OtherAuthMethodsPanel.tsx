import React from 'react';
import {
  ChevronDown,
  Gamepad2,
  Globe,
  KeyRound,
  Mail,
  Phone,
  QrCode,
  ShieldCheck,
  UserCheck,
  Wrench,
} from 'lucide-react';
import { AuthProviderId, AuthProviderStatus, SystemSettings } from '../../types';
import {
  AUTH_PROVIDER_CATALOG,
  AuthProviderCatalogItem,
  resolveAuthProvidersMap,
} from '../../constants/authProviders';

export const AuthProviderIcon: React.FC<{
  providerId: AuthProviderId;
  className?: string;
  onColoredBg?: boolean;
}> = ({ providerId, className = 'w-4 h-4', onColoredBg = false }) => {
  switch (providerId) {
    case 'google':
      return (
        <svg className={`${className} shrink-0`} viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.7-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      );

    case 'facebook':
      return (
        <img
          src="https://static.xx.fbcdn.net/rsrc.php/yH/r/a0cO3e6g_yJ.webp"
          alt="Facebook"
          referrerPolicy="no-referrer"
          className="w-5 h-5 rounded-md object-contain bg-white p-0.5 shrink-0"
        />
      );

    case 'zalo':
      return (
        <img
          src="/zalo.png"
          alt="Zalo"
          className="w-5 h-5 rounded-md bg-white p-0.5 object-contain shrink-0"
        />
      );

    case 'qr':
      return <QrCode className={`${className} shrink-0`} />;

    case 'email_password':
      return <Mail className={`${className} text-slate-600 dark:text-slate-300 shrink-0`} />;

    case 'phone':
      return <Phone className={`${className} text-emerald-600 dark:text-emerald-400 shrink-0`} />;

    case 'anonymous':
      return <UserCheck className={`${className} text-slate-600 dark:text-slate-300 shrink-0`} />;

    case 'play_games':
      return <Gamepad2 className={`${className} text-emerald-600 dark:text-emerald-400 shrink-0`} />;

    case 'game_center':
      return <Gamepad2 className={`${className} text-pink-600 dark:text-pink-400 shrink-0`} />;

    case 'apple':
      return (
        <svg className={`${className} shrink-0 fill-current`} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
        </svg>
      );

    case 'github':
      return (
        <svg className={`${className} shrink-0 fill-current`} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.11.78-.25.78-.55 0-.27-.01-1.18-.02-2.14-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.67.41.36.78 1.07.78 2.15 0 1.56-.01 2.81-.01 3.19 0 .31.21.67.79.55A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
        </svg>
      );

    case 'microsoft':
      return (
        <svg className={`${className} shrink-0`} viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2" y="2" width="9" height="9" fill="#F25022" />
          <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
          <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
          <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
        </svg>
      );

    case 'twitter':
      return (
        <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="#1DA1F2" aria-hidden="true">
          <path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.3 4.3 0 0 0 1.88-2.38 8.59 8.59 0 0 1-2.72 1.04 4.28 4.28 0 0 0-7.29 3.9A12.14 12.14 0 0 1 3.04 4.8a4.28 4.28 0 0 0 1.32 5.71 4.24 4.24 0 0 1-1.94-.54v.05a4.28 4.28 0 0 0 3.43 4.2 4.3 4.3 0 0 1-1.93.07 4.29 4.29 0 0 0 4 2.97A8.59 8.59 0 0 1 2 19.07a12.12 12.12 0 0 0 6.56 1.92c7.88 0 12.19-6.53 12.19-12.19l-.01-.56A8.7 8.7 0 0 0 22.46 6z" />
        </svg>
      );

    case 'yahoo':
      return (
        <span className="w-5 h-5 rounded-md bg-[#6001D2] text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
          Y!
        </span>
      );

    case 'oidc':
      return <KeyRound className={`${className} text-amber-600 dark:text-amber-400 shrink-0`} />;

    case 'saml':
      return <Globe className={`${className} text-indigo-600 dark:text-indigo-400 shrink-0`} />;

    default:
      return <ShieldCheck className={`${className} text-slate-500 shrink-0`} />;
  }
};

interface OtherAuthMethodsPanelProps {
  settings?: SystemSettings;
  authMode: 'login' | 'register';
  isPcClient: boolean;
  loading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelectProvider: (providerId: AuthProviderId) => void;
  onOpenQrModal: () => void;
  size?: 'sm' | 'md';
}

export const OtherAuthMethodsPanel: React.FC<OtherAuthMethodsPanelProps> = ({
  settings,
  authMode,
  isPcClient,
  loading,
  expanded,
  onToggleExpand,
  onSelectProvider,
  onOpenQrModal,
  size = 'sm',
}) => {
  const providersMap = resolveAuthProvidersMap(settings);

  const visibleItems = AUTH_PROVIDER_CATALOG.filter((item) => {
    if (item.id === 'email_password') return false;
    const status = providersMap[item.id];
    if (status === 'disabled') return false;
    if (item.id === 'qr') {
      return authMode === 'login' && isPcClient;
    }
    return true;
  });

  if (visibleItems.length === 0) {
    return null;
  }

  const qrItem = visibleItems.find((i) => i.id === 'qr');
  const gridItems = visibleItems.filter((i) => i.id !== 'qr');
  const isMedium = size === 'md';

  const getButtonStyle = (item: AuthProviderCatalogItem, status: AuthProviderStatus) => {
    if (status === 'maintenance') {
      return 'border border-amber-300/80 dark:border-amber-800/70 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 opacity-55 grayscale cursor-not-allowed pointer-events-none select-none';
    }
    if (item.id === 'facebook') {
      return 'bg-[#1877F2] hover:bg-[#1465D1] text-white shadow-xs cursor-pointer';
    }
    if (item.id === 'zalo') {
      return 'bg-[#0068FF] hover:bg-[#0057D8] text-white shadow-xs cursor-pointer';
    }
    return 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs cursor-pointer';
  };

  const qrStatus = qrItem ? providersMap.qr : 'disabled';

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className={`w-full ${
          isMedium ? 'min-h-[46px] rounded-2xl text-sm' : 'min-h-[44px] rounded-xl text-xs'
        } py-2.5 px-4 border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold transition flex items-center justify-between gap-2 cursor-pointer`}
      >
        <span className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Đăng nhập bằng phương thức khác</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5 animate-in fade-in duration-150">
          {gridItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {gridItems.map((item) => {
                const status = providersMap[item.id];
                const isMaintenance = status === 'maintenance';
                const hasColoredBg = !isMaintenance && (item.id === 'facebook' || item.id === 'zalo');

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={loading || isMaintenance}
                    aria-disabled={loading || isMaintenance}
                    onClick={() => {
                      if (!isMaintenance) onSelectProvider(item.id);
                    }}
                    title={isMaintenance ? `Đăng nhập bằng ${item.label} đang bảo trì` : item.description}
                    className={`${
                      isMedium ? 'min-h-[46px] rounded-2xl text-sm' : 'min-h-[44px] rounded-xl text-xs'
                    } py-2 px-3 font-semibold transition flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 ${getButtonStyle(
                      item,
                      status
                    )}`}
                  >
                    <AuthProviderIcon providerId={item.id} onColoredBg={hasColoredBg} />
                    <span className="truncate">Đăng nhập bằng {item.label}</span>
                    {isMaintenance && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                        <Wrench className="w-2.5 h-2.5" />
                        Bảo trì
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {qrItem && (
            <button
              type="button"
              disabled={loading || qrStatus === 'maintenance'}
              aria-disabled={loading || qrStatus === 'maintenance'}
              onClick={() => {
                if (qrStatus !== 'maintenance') onOpenQrModal();
              }}
              className={`w-full ${
                isMedium ? 'min-h-[46px] rounded-2xl text-sm' : 'min-h-[44px] rounded-xl text-xs'
              } py-2.5 px-4 font-semibold transition flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 ${
                qrStatus === 'maintenance'
                  ? 'border border-amber-300/80 dark:border-amber-800/70 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 opacity-55 grayscale cursor-not-allowed pointer-events-none select-none'
                  : 'border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 cursor-pointer'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>Đăng nhập bằng mã QR (Quét từ điện thoại)</span>
              {qrStatus === 'maintenance' && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                  <Wrench className="w-2.5 h-2.5" />
                  Bảo trì
                </span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
