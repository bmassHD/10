import React, { useState, useEffect } from 'react';
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
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  HardDriveDownload,
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import { useToast } from '../../contexts/ToastContext';
import { SystemSettings, SandboxFirebaseConfig } from '../../types';
import { updateSystemSettings } from '../../services/firebaseService';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, getDocs, collection, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface FirebaseConfigReadonlyCardProps {
  settings?: SystemSettings;
  onRefresh?: () => void;
}

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
    description: 'Khóa công khai Firebase Web SDK',
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
];

export const FirebaseConfigReadonlyCard: React.FC<FirebaseConfigReadonlyCardProps> = ({
  settings,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Sandbox Mode state
  const sb = settings?.sandboxFirebase;
  const [sandboxEnabled, setSandboxEnabled] = useState<boolean>(Boolean(sb?.enabled));
  const [sandboxMode, setSandboxMode] = useState<'independent' | 'parallel'>(
    sb?.mode || 'independent'
  );
  const [sandboxProjectId, setSandboxProjectId] = useState<string>(sb?.projectId || '');
  const [sandboxDatabaseId, setSandboxDatabaseId] = useState<string>(
    sb?.firestoreDatabaseId || '(default)'
  );
  const [sandboxApiKey, setSandboxApiKey] = useState<string>(sb?.apiKey || '');
  const [sandboxAuthDomain, setSandboxAuthDomain] = useState<string>(sb?.authDomain || '');
  const [sandboxStorageBucket, setSandboxStorageBucket] = useState<string>(sb?.storageBucket || '');
  const [sandboxMessagingSenderId, setSandboxMessagingSenderId] = useState<string>(
    sb?.messagingSenderId || ''
  );
  const [sandboxAppId, setSandboxAppId] = useState<string>(sb?.appId || '');

  const [savingSandbox, setSavingSandbox] = useState(false);
  const [testingSandbox, setTestingSandbox] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncingData, setSyncingData] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.sandboxFirebase) {
      setSandboxEnabled(Boolean(settings.sandboxFirebase.enabled));
      setSandboxMode(settings.sandboxFirebase.mode || 'independent');
      setSandboxProjectId(settings.sandboxFirebase.projectId || '');
      setSandboxDatabaseId(settings.sandboxFirebase.firestoreDatabaseId || '(default)');
      setSandboxApiKey(settings.sandboxFirebase.apiKey || '');
      setSandboxAuthDomain(settings.sandboxFirebase.authDomain || '');
      setSandboxStorageBucket(settings.sandboxFirebase.storageBucket || '');
      setSandboxMessagingSenderId(settings.sandboxFirebase.messagingSenderId || '');
      setSandboxAppId(settings.sandboxFirebase.appId || '');
    }
  }, [settings?.sandboxFirebase]);

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
      subtitle: 'Kiểm tra & rà soát firestore.rules',
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
      subtitle: 'Theo dõi lượt đọc/ghi/xóa',
      url: `${firestoreBaseUrl}/usage`,
      icon: BarChart3,
    },
  ];

  const authLinks = [
    {
      id: 'auth-users',
      title: 'Người dùng (Users)',
      subtitle: 'Danh sách tài khoản đăng nhập',
      url: `${authBaseUrl}/users`,
      icon: Users,
      primary: true,
    },
    {
      id: 'auth-providers',
      title: 'Phương thức đăng nhập',
      subtitle: 'Bật/tắt Google, Email, SĐT, MFA',
      url: `${authBaseUrl}/providers`,
      icon: KeyRound,
    },
    {
      id: 'auth-templates',
      title: 'Mẫu Email & Action URL',
      subtitle: 'Cấu hình email xác minh, đặt lại mật khẩu',
      url: `${authBaseUrl}/emails`,
      icon: Mail,
    },
    {
      id: 'auth-settings',
      title: 'Tên miền ủy quyền',
      subtitle: 'Thêm domain vào danh sách cho phép',
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

  const persistSandboxConfig = async (
    nextEnabled: boolean,
    options?: { isToggle?: boolean; onRollback?: () => void }
  ) => {
    setSavingSandbox(true);
    try {
      const sandboxPayload: SandboxFirebaseConfig = {
        enabled: nextEnabled,
        mode: sandboxMode,
        projectId: sandboxProjectId.trim(),
        firestoreDatabaseId: sandboxDatabaseId.trim() || '(default)',
        apiKey: sandboxApiKey.trim(),
        authDomain: sandboxAuthDomain.trim(),
        storageBucket: sandboxStorageBucket.trim(),
        messagingSenderId: sandboxMessagingSenderId.trim(),
        appId: sandboxAppId.trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateSystemSettings({ sandboxFirebase: sandboxPayload });
      try {
        localStorage.setItem('tyt_sandbox_firebase_v1', JSON.stringify(sandboxPayload));
      } catch {
        // ignore
      }

      showToast(
        'success',
        options?.isToggle
          ? nextEnabled
            ? 'Đã BẬT chế độ Sandbox Firebase'
            : 'Đã TẮT chế độ Sandbox Firebase'
          : 'Đã lưu cấu hình Sandbox Firebase',
        nextEnabled
          ? `Chế độ Sandbox đang BẬT (${sandboxMode === 'independent' ? 'Độc lập' : 'Song song'})`
          : 'Chế độ Sandbox đang TẮT'
      );
      if (onRefresh) onRefresh();
    } catch (err: any) {
      if (options?.onRollback) options.onRollback();
      showToast('error', 'Không thể lưu cấu hình Sandbox', err?.message);
    } finally {
      setSavingSandbox(false);
    }
  };

  const handleSaveSandbox = async () => {
    await persistSandboxConfig(sandboxEnabled);
  };

  const handleToggleSandboxImmediate = () => {
    const prevEnabled = sandboxEnabled;
    const nextEnabled = !prevEnabled;
    if (nextEnabled && !sandboxProjectId.trim()) {
      showToast('warning', 'Vui lòng nhập Sandbox Project ID trước khi bật chế độ Sandbox');
      return;
    }
    setSandboxEnabled(nextEnabled);
    void persistSandboxConfig(nextEnabled, {
      isToggle: true,
      onRollback: () => setSandboxEnabled(prevEnabled),
    });
  };

  const handleTestSandbox = async () => {
    if (!sandboxProjectId.trim()) {
      showToast('warning', 'Vui lòng nhập Sandbox Project ID trước khi kiểm tra');
      return;
    }
    setTestingSandbox(true);
    setTestResult(null);
    try {
      const testApp = initializeApp(
        {
          apiKey: sandboxApiKey.trim() || 'AIzaSyTestSandboxKeyDummy',
          authDomain: sandboxAuthDomain.trim() || `${sandboxProjectId.trim()}.firebaseapp.com`,
          projectId: sandboxProjectId.trim(),
          storageBucket: sandboxStorageBucket.trim() || `${sandboxProjectId.trim()}.appspot.com`,
          messagingSenderId: sandboxMessagingSenderId.trim() || '123456789',
          appId: sandboxAppId.trim() || '1:123456:web:abcdef',
        },
        `sandbox_test_${Date.now()}`
      );
      const testDb = getFirestore(testApp, sandboxDatabaseId.trim() || '(default)');
      await getDocFromServer(doc(testDb, 'systemSettings', 'connection_test'));
      setTestResult({
        ok: true,
        message: `Kết nối thành công tới Project ID: "${sandboxProjectId.trim()}" (Database: ${sandboxDatabaseId.trim() || '(default)'})`,
      });
      showToast('success', 'Kiểm tra kết nối Sandbox thành công!');
    } catch (err: any) {
      const msg = err?.message || 'Không thể kết nối đến Cloud Firestore Sandbox.';
      setTestResult({
        ok: false,
        message: `Lỗi kết nối: ${msg} (Vui lòng kiểm tra lại thông số Project ID và Database ID).`,
      });
      showToast('error', 'Kiểm tra kết nối Sandbox thất bại', msg);
    } finally {
      setTestingSandbox(false);
    }
  };

  const handleSyncToSandbox = async () => {
    if (!sandboxProjectId.trim()) {
      showToast('warning', 'Vui lòng nhập Sandbox Project ID trước khi đồng bộ dữ liệu');
      return;
    }
    setSyncingData(true);
    setSyncProgress('Đang khởi tạo kết nối Sandbox Firebase...');
    try {
      const sandboxApp = initializeApp(
        {
          apiKey: sandboxApiKey.trim() || 'AIzaSyTestSandboxKeyDummy',
          authDomain: sandboxAuthDomain.trim() || `${sandboxProjectId.trim()}.firebaseapp.com`,
          projectId: sandboxProjectId.trim(),
          storageBucket: sandboxStorageBucket.trim() || `${sandboxProjectId.trim()}.appspot.com`,
          messagingSenderId: sandboxMessagingSenderId.trim() || '123456789',
          appId: sandboxAppId.trim() || '1:123456:web:abcdef',
        },
        `sandbox_sync_${Date.now()}`
      );
      const sandboxDb = getFirestore(sandboxApp, sandboxDatabaseId.trim() || '(default)');

      const collectionsToSync = [
        'systemSettings',
        'nearbyFacilities',
        'events',
        'posts',
        'announcements',
        'services',
        'documents',
        'workSchedules',
        'businessTrips',
        'attendanceRecords',
        'feedback',
        'serviceRatings',
        'appointments',
        'targetedNotifications',
        'storeItems',
        'storeOrders',
        'referralCodes',
        'userReferralLinks',
        'referralTracking',
        'users',
        'verifiedIdentifiers',
        'legacyUserSnapshots',
        'userMigrationClaims',
        'admins',
        'tasks',
        'rescueSignals',
        'siteStats',
        'onlinePresence',
        'pushSubscriptions',
        'auditLogs',
      ];

      let totalSynced = 0;
      for (const collName of collectionsToSync) {
        setSyncProgress(`Đang đồng bộ collection: ${collName}...`);
        try {
          const snapshot = await getDocs(collection(db, collName));
          for (const d of snapshot.docs) {
            if (collName === 'systemSettings' && d.id === 'connection_test') continue;
            await setDoc(doc(sandboxDb, collName, d.id), d.data(), { merge: true });
            totalSynced++;

            if (collName === 'users') {
              try {
                const devSnap = await getDocs(collection(db, 'users', d.id, 'devices'));
                for (const devDoc of devSnap.docs) {
                  await setDoc(
                    doc(sandboxDb, 'users', d.id, 'devices', devDoc.id),
                    devDoc.data(),
                    { merge: true }
                  );
                  totalSynced++;
                }
              } catch {
                // non-blocking subcollection sync
              }
            }
          }
        } catch (colErr) {
          console.warn(`Sync collection ${collName} skipped:`, colErr);
        }
      }

      setSyncProgress(`Đồng bộ thành công ${totalSynced} bản ghi sang Sandbox Firebase!`);
      showToast('success', 'Đồng bộ dữ liệu thành công', `Đã chuyển ${totalSynced} bản ghi sang Sandbox Firebase.`);
    } catch (err: any) {
      setSyncProgress(`Lỗi đồng bộ: ${err?.message}`);
      showToast('error', 'Lỗi đồng bộ dữ liệu sang Sandbox', err?.message);
    } finally {
      setSyncingData(false);
    }
  };

  const formattedJson = JSON.stringify(firebaseConfig, null, 2);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sandbox Mode Configuration Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 shadow-md space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-indigo-100 dark:border-slate-800 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-sm shrink-0">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Chế Độ Sandbox Firebase &amp; Đồng Bộ Trực Tiếp
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                    sandboxEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {sandboxEnabled ? '● Đang Bật Sandbox' : '○ Đang Tắt'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                Cấu hình dự án Firebase thử nghiệm và đồng bộ toàn bộ dữ liệu trực tiếp từ Firebase hiện tại sang Sandbox Firebase.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={syncingData}
              onClick={() => void handleSyncToSandbox()}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
            >
              <HardDriveDownload className={`w-3.5 h-3.5 ${syncingData ? 'animate-bounce' : ''}`} />
              <span>{syncingData ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu sang Sandbox'}</span>
            </button>

            <button
              type="button"
              disabled={testingSandbox}
              onClick={() => void handleTestSandbox()}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
            >
              {testingSandbox ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kiểm tra kết nối</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={savingSandbox}
              onClick={() => void handleSaveSandbox()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-60"
            >
              {savingSandbox ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </div>

        {/* Sandbox Toggles and Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Bật Chế Độ Sandbox (Sandbox Mode)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Kích hoạt kết nối máy chủ Firebase Sandbox
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleSandboxImmediate}
              disabled={savingSandbox}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                sandboxEnabled ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
              role="switch"
              aria-checked={sandboxEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  sandboxEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
            <label className="text-xs font-bold text-slate-900 dark:text-white">
              Chế độ hoạt động máy chủ (Server Mode)
            </label>
            <select
              value={sandboxMode}
              onChange={e => setSandboxMode(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="independent">Độc lập (Independent Server)</option>
              <option value="parallel">Song song (Parallel Server - Đồng thời)</option>
            </select>
          </div>
        </div>

        {/* Sync Progress / Test Result Banner */}
        {(syncProgress || testResult) && (
          <div className="space-y-2">
            {syncProgress && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 text-xs font-medium flex items-center gap-2">
                <HardDriveDownload className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                <span>{syncProgress}</span>
              </div>
            )}
            {testResult && (
              <div
                className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
                  testResult.ok
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <div className="font-medium">{testResult.message}</div>
              </div>
            )}
          </div>
        )}

        {/* Sandbox Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Sandbox Project ID
            </label>
            <input
              type="text"
              value={sandboxProjectId}
              onChange={e => setSandboxProjectId(e.target.value)}
              placeholder="vd: my-sandbox-project-id"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Sandbox Firestore Database ID
            </label>
            <input
              type="text"
              value={sandboxDatabaseId}
              onChange={e => setSandboxDatabaseId(e.target.value)}
              placeholder="vd: (default)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Sandbox API Key
            </label>
            <input
              type="text"
              value={sandboxApiKey}
              onChange={e => setSandboxApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Sandbox Auth Domain
            </label>
            <input
              type="text"
              value={sandboxAuthDomain}
              onChange={e => setSandboxAuthDomain(e.target.value)}
              placeholder="project.firebaseapp.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Sandbox Storage Bucket
            </label>
            <input
              type="text"
              value={sandboxStorageBucket}
              onChange={e => setSandboxStorageBucket(e.target.value)}
              placeholder="project.appspot.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Sandbox App ID
            </label>
            <input
              type="text"
              value={sandboxAppId}
              onChange={e => setSandboxAppId(e.target.value)}
              placeholder="1:123456:web:..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Header Banner (Read-Only Default Notice) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Cấu Hình Mặc Định Firebase (Applet Config)
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Cố định triển khai</span>
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Thông số kết nối chính thức từ <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">firebase-applet-config.json</code>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={`https://console.firebase.google.com/project/${encodedProject}/overview`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold transition inline-flex items-center gap-1.5"
          >
            <span>Project Overview</span>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
          </a>
        </div>
      </div>

      {/* Deep Links Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  Database ID: {databaseId || '(default)'}
                </p>
              </div>
            </div>
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
                      : 'bg-slate-50 dark:bg-slate-800/65 hover:bg-slate-100 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate">{item.title}</div>
                      <div className="text-[11px] truncate opacity-90">{item.subtitle}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
              );
            })}
          </div>
        </div>

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
                  Project: {projectId}
                </p>
              </div>
            </div>
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
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white'
                      : 'bg-slate-50 dark:bg-slate-800/65 hover:bg-slate-100 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold truncate">{item.title}</div>
                      <div className="text-[11px] truncate opacity-90">{item.subtitle}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
