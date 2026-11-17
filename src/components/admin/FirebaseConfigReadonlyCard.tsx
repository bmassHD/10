import React, { useState } from 'react';
import {
  Database,
  ShieldCheck,
  Lock,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  FileJson,
  KeyRound,
  Users,
  Mail,
  Globe,
  FileCode2,
  ListTree,
  BarChart3,
  Settings,
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import { useToast } from '../../contexts/ToastContext';

interface ConfigFieldItem {
  key: keyof typeof firebaseConfig;
  label: string;
  description: string;
  sensitive?: boolean;
  highlight?: boolean;
}

const CONFIG_FIELDS: ConfigFieldItem[] = [
  {
    key: 'projectId',
    label: 'Project ID',
    description: 'Mã định danh dự án Firebase / Google Cloud',
    highlight: true,
  },
  {
    key: 'firestoreDatabaseId',
    label: 'Cloud Firestore Database ID',
    description: 'Database ID đang kết nối bắt buộc qua getFirestore(app, databaseId)',
    highlight: true,
  },
  {
    key: 'authDomain',
    label: 'Auth Domain',
    description: 'Tên miền xác thực mặc định của Firebase Authentication',
  },
  {
    key: 'appId',
    label: 'App ID',
    description: 'Mã định danh ứng dụng Web Firebase',
  },
  {
    key: 'apiKey',
    label: 'Web API Key',
    description: 'Khóa công khai Firebase Web SDK (cố định theo cấu hình triển khai)',
    sensitive: true,
  },
  {
    key: 'storageBucket',
    label: 'Storage Bucket',
    description: 'Kho lưu trữ Firebase Storage của dự án',
  },
  {
    key: 'messagingSenderId',
    label: 'Messaging Sender ID',
    description: 'Mã định danh Cloud Messaging / Web Push Sender',
  },
  {
    key: 'oAuthClientId',
    label: 'OAuth Client ID',
    description: 'Client ID đăng nhập Google OAuth 2.0',
  },
  {
    key: 'measurementId',
    label: 'Measurement ID',
    description: 'Mã Google Analytics (nếu có cấu hình)',
  },
  {
    key: 'recaptchaSiteKey',
    label: 'reCAPTCHA Site Key',
    description: 'Khóa App Check / reCAPTCHA v3 (nếu có cấu hình)',
  },
];

export const FirebaseConfigReadonlyCard: React.FC = () => {
  const { showToast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const projectId = String(firebaseConfig.projectId || '').trim();
  const databaseId = String(firebaseConfig.firestoreDatabaseId || '').trim();
  const encodedProject = encodeURIComponent(projectId);
  const encodedDatabase = encodeURIComponent(databaseId || '(default)');

  const firestoreBaseUrl = `https://console.firebase.google.com/project/${encodedProject}/firestore/databases/${encodedDatabase}`;
  const authBaseUrl = `https://console.firebase.google.com/project/${encodedProject}/authentication`;

  const firestoreLinks = [
    {
      id: 'fs-data',
      title: 'Dữ liệu Collections (Data)',
      subtitle: `Mở trực tiếp database: ${databaseId || '(default)'}`,
      url: `${firestoreBaseUrl}/data`,
      icon: Database,
      primary: true,
    },
    {
      id: 'fs-rules',
      title: 'Quy tắc bảo mật (Rules)',
      subtitle: 'Kiểm tra & rà soát firestore.rules của Database ID này',
      url: `${firestoreBaseUrl}/rules`,
      icon: FileCode2,
    },
    {
      id: 'fs-indexes',
      title: 'Chỉ mục (Indexes)',
      subtitle: 'Quản lý Single-field & Composite Indexes',
      url: `${firestoreBaseUrl}/indexes`,
      icon: ListTree,
    },
    {
      id: 'fs-usage',
      title: 'Dung lượng & Hạn mức (Usage)',
      subtitle: 'Theo dõi lượt đọc/ghi/xóa và quota Cloud Firestore',
      url: `${firestoreBaseUrl}/usage`,
      icon: BarChart3,
    },
  ];

  const authLinks = [
    {
      id: 'auth-users',
      title: 'Người dùng (Users)',
      subtitle: 'Danh sách tài khoản đăng nhập Email, Google, SĐT',
      url: `${authBaseUrl}/users`,
      icon: Users,
      primary: true,
    },
    {
      id: 'auth-providers',
      title: 'Phương thức đăng nhập (Sign-in method)',
      subtitle: 'Bật/tắt Google, Email/Password, Phone OTP, MFA',
      url: `${authBaseUrl}/providers`,
      icon: KeyRound,
    },
    {
      id: 'auth-templates',
      title: 'Mẫu Email & Action URL (Templates)',
      subtitle: 'Cấu hình email xác minh, đặt lại mật khẩu & custom link',
      url: `${authBaseUrl}/emails`,
      icon: Mail,
    },
    {
      id: 'auth-settings',
      title: 'Tên miền ủy quyền (Authorized domains)',
      subtitle: 'Thêm tyt.slhd.id.vn và domain Vercel vào danh sách cho phép',
      url: `${authBaseUrl}/settings`,
      icon: Globe,
    },
  ];

  const handleCopy = async (value: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast('success', `Đã sao chép ${label}`);
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1800);
    } catch {
      showToast('warning', 'Không thể sao chép tự động');
    }
  };

  const formattedJson = JSON.stringify(firebaseConfig, null, 2);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner (Read-Only Notice) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Cấu Hình Kết Nối Firebase (Chỉ Xem)
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Không thể chỉnh sửa</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Hiển thị nguyên trạng tệp cấu hình <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">firebase-applet-config.json</code> đang gắn với ứng dụng kèm liên kết truy cập trực tiếp Cloud Firestore &amp; Firebase Authentication.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`https://console.firebase.google.com/project/${encodedProject}/overview`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition inline-flex items-center gap-1.5"
          >
            <span>Project Overview</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
          </a>
          <a
            href={`https://console.firebase.google.com/project/${encodedProject}/settings/general`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition inline-flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Project Settings</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
          </a>
        </div>
      </div>

      {/* Deep Links Grid: Cloud Firestore (Exact Database ID) & Firebase Auth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cloud Firestore Direct Links */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Cloud Firestore
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Liên kết trực tiếp tới đúng Database ID của hệ thống
                </p>
              </div>
            </div>
            <a
              href={`https://console.firebase.google.com/project/${encodedProject}/firestore`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 shrink-0"
            >
              <span>Tất cả DB</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Highlighted Exact Database ID Box */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Database ID đang kết nối
              </span>
              <button
                type="button"
                onClick={() => handleCopy(databaseId, 'db-id-top', 'Database ID')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
              >
                {copiedKey === 'db-id-top' ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <code className="block font-mono text-xs font-bold text-emerald-950 dark:text-emerald-100 break-all select-all">
              {databaseId || '(default)'}
            </code>
          </div>

          <div className="space-y-2">
            {firestoreLinks.map(item => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 group ${
                    item.primary
                      ? 'bg-emerald-700 hover:bg-emerald-800 border-emerald-700 text-white'
                      : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.primary ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate">{item.title}</div>
                      <div
                        className={`text-[11px] truncate ${
                          item.primary ? 'text-emerald-100/90' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ExternalLink
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                      item.primary ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'
                    }`}
                  />
                </a>
              );
            })}
          </div>
        </div>

        {/* Firebase Authentication Direct Links */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Firebase Authentication
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quản lý người dùng, phương thức đăng nhập &amp; mẫu email
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {projectId}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Auth Domain mặc định
              </span>
              <button
                type="button"
                onClick={() => handleCopy(firebaseConfig.authDomain, 'auth-domain-top', 'Auth Domain')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
              >
                {copiedKey === 'auth-domain-top' ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
            <code className="block font-mono text-xs font-bold text-indigo-950 dark:text-indigo-100 break-all select-all">
              {firebaseConfig.authDomain}
            </code>
          </div>

          <div className="space-y-2">
            {authLinks.map(item => {
              const Icon = item.icon;
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 group ${
                    item.primary
                      ? 'bg-slate-900 hover:bg-slate-800 dark:bg-indigo-700 dark:hover:bg-indigo-600 border-slate-900 dark:border-indigo-700 text-white'
                      : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        item.primary ? 'text-indigo-200' : 'text-indigo-600 dark:text-indigo-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate">{item.title}</div>
                      <div
                        className={`text-[11px] truncate ${
                          item.primary ? 'text-slate-300 dark:text-indigo-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <ExternalLink
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
                      item.primary ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'
                    }`}
                  />
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Read-Only Parameter Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Chi Tiết Thông Số Firebase Config (Chế Độ Chỉ Đọc)
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Mọi trường đều khóa chỉnh sửa (Read-Only)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {CONFIG_FIELDS.map(field => {
            const rawVal = String(firebaseConfig[field.key] ?? '').trim();
            const isEmpty = rawVal.length === 0;
            const displayVal = isEmpty
              ? '(Chưa cấu hình)'
              : field.sensitive && !showApiKey
              ? `${rawVal.slice(0, 8)}••••••••••••••••••••${rawVal.slice(-4)}`
              : rawVal;

            return (
              <div
                key={field.key}
                className={`p-3.5 rounded-2xl border space-y-1.5 ${
                  field.highlight
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {field.label}{' '}
                    <span className="font-mono font-normal text-[11px] text-slate-500 dark:text-slate-400">
                      ({field.key})
                    </span>
                  </label>
                  <div className="flex items-center gap-1 shrink-0">
                    {field.sensitive && !isEmpty && (
                      <button
                        type="button"
                        onClick={() => setShowApiKey(prev => !prev)}
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                        title={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {!isEmpty && (
                      <button
                        type="button"
                        onClick={() => handleCopy(rawVal, field.key, field.label)}
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                        title={`Sao chép ${field.label}`}
                      >
                        {copiedKey === field.key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  readOnly
                  aria-readonly="true"
                  value={displayVal}
                  onFocus={e => e.target.select()}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono cursor-default focus:outline-none ${
                    isEmpty
                      ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-400 italic'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                  }`}
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{field.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw JSON Preview (Read-Only) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              firebase-applet-config.json (Chỉ xem)
            </h4>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(formattedJson, 'raw-json', 'JSON cấu hình Firebase')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copiedKey === 'raw-json' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã sao chép JSON</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Sao chép JSON</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 font-mono text-xs overflow-x-auto leading-relaxed select-all border border-slate-800">
          <code>{formattedJson}</code>
        </pre>
      </div>
    </div>
  );
};
