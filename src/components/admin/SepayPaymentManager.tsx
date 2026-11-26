import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  DollarSign,
  ExternalLink,
  KeyRound,
  Landmark,
  Pencil,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Webhook,
  X,
} from 'lucide-react';
import type {
  PaymentOrder,
  SepayAdminConfig,
  SepayAuthType,
  SepayBankTemplate,
  SepayOrderStatus,
  SepayWebhookLog,
  UserProfile,
  VipPackageConfig,
} from '../../types';
import {
  createAdminCustomPaymentOrder,
  fetchAdminSepayState,
  formatVnd,
  runAdminSepayWebhookTest,
  saveAdminSepayConfig,
  simulateSepayWebhookPayment,
  updateAdminPaymentOrder,
} from '../../services/sepayService';
import { useToast } from '../../contexts/ToastContext';

interface SepayPaymentManagerProps {
  users: UserProfile[];
}

const SEPAY_BANKS = [
  { code: 'MBBank', name: 'MB Bank (Ngân hàng Quân Đội)' },
  { code: 'Vietcombank', name: 'Vietcombank (VCB)' },
  { code: 'Techcombank', name: 'Techcombank (TCB)' },
  { code: 'ACB', name: 'ACB (Ngân hàng Á Châu)' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VietinBank', name: 'VietinBank' },
  { code: 'TPBank', name: 'TPBank' },
  { code: 'VPBank', name: 'VPBank' },
  { code: 'OCB', name: 'OCB' },
  { code: 'VIB', name: 'VIB' },
];

export const SepayPaymentManager: React.FC<SepayPaymentManagerProps> = ({ users }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [config, setConfig] = useState<SepayAdminConfig | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [webhooks, setWebhooks] = useState<SepayWebhookLog[]>([]);

  // Config form state
  const [enabled, setEnabled] = useState(true);
  const [bankCode, setBankCode] = useState('MBBank');
  const [bankName, setBankName] = useState('MB Bank (Ngân hàng Quân Đội)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [subAccount, setSubAccount] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('TYT');
  const [orderSuffixMinLength, setOrderSuffixMinLength] = useState(2);
  const [orderSuffixMaxLength, setOrderSuffixMaxLength] = useState(8);
  const [webhookUrl, setWebhookUrl] = useState('https://tyt.slhd.id.vn/hooks/sepay-payment');
  const [qrTemplate, setQrTemplate] = useState<SepayBankTemplate>('compact2');
  const [authType, setAuthType] = useState<SepayAuthType>('none');
  const [newApiKey, setNewApiKey] = useState('');
  const [newHmacSecret, setNewHmacSecret] = useState('');
  const [packages, setPackages] = useState<VipPackageConfig[]>([]);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Search & Filter state for Orders and Webhook Logs
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | SepayOrderStatus>('all');
  const [webhookSearchQuery, setWebhookSearchQuery] = useState('');
  const [webhookStatusFilter, setWebhookStatusFilter] = useState<'all' | SepayWebhookLog['matchStatus']>('all');

  // Create custom order modal state
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [customTargetUid, setCustomTargetUid] = useState('');
  const [customUserName, setCustomUserName] = useState('');
  const [customUserEmail, setCustomUserEmail] = useState('');
  const [customOrderType, setCustomOrderType] = useState<'vip_package' | 'custom_order'>('vip_package');
  const [customPackageId, setCustomPackageId] = useState('account_verify');
  const [customPackageName, setCustomPackageName] = useState('Xác Minh Tài Khoản Chính Thức (Verified)');
  const [customAmountVnd, setCustomAmountVnd] = useState('50000');
  const [customDurationDays, setCustomDurationDays] = useState('365');
  const [customNote, setCustomNote] = useState('');

  // Inline edit order amount modal state
  const [editingOrder, setEditingOrder] = useState<PaymentOrder | null>(null);
  const [editAmountVnd, setEditAmountVnd] = useState('');
  const [editStatus, setEditStatus] = useState<SepayOrderStatus>('pending');
  const [editAdminNote, setEditAdminNote] = useState('');
  const [savingOrderEdit, setSavingOrderEdit] = useState(false);

  // Preview QR modal
  const [previewQrOrder, setPreviewQrOrder] = useState<PaymentOrder | null>(null);
  const [simulatingOrderCode, setSimulatingOrderCode] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const isAiStudioDevHost =
    typeof window !== 'undefined' &&
    /ais-(dev|pre)-.*\.run\.app$/i.test(window.location.hostname);

  const loadState = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchAdminSepayState();
      setConfig(data.config);
      setOrders(data.orders || []);
      setWebhooks(data.webhooks || []);
      setEnabled(Boolean(data.config.enabled));
      setBankCode(data.config.bankCode || 'MBBank');
      setBankName(data.config.bankName || 'MB Bank (Ngân hàng Quân Đội)');
      setAccountNumber(data.config.accountNumber || '');
      setAccountHolder(data.config.accountHolder || '');
      setSubAccount(data.config.subAccount || '');
      setOrderPrefix(
        String(data.config.orderPrefix || 'TYT')
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 5) || 'TYT'
      );
      const minLen = Math.max(2, Math.min(8, Number(data.config.orderSuffixMinLength) || 2));
      const maxLen = Math.max(minLen, Math.min(8, Number(data.config.orderSuffixMaxLength) || 8));
      setOrderSuffixMinLength(minLen);
      setOrderSuffixMaxLength(maxLen);
      setWebhookUrl(data.config.webhookUrl || 'https://tyt.slhd.id.vn/hooks/sepay-payment');
      setQrTemplate(data.config.qrTemplate || 'compact2');
      setAuthType(data.config.authType || 'none');
      const loadedPackages = data.config.packages || [];
      setPackages(loadedPackages);
      if (loadedPackages.length > 0) {
        const firstPkg = loadedPackages[0];
        setCustomPackageId(firstPkg.id);
        setCustomPackageName(firstPkg.name);
        setCustomAmountVnd(String(firstPkg.priceVnd));
        setCustomDurationDays(String(firstPkg.durationDays));
      }
    } catch (err: any) {
      showToast('error', 'Không thể tải cấu hình SePay', err?.message || 'Vui lòng thử lại.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    if (createOrderOpen && !customTargetUid && users.length > 0) {
      const first = users[0];
      setCustomTargetUid(first.uid);
      setCustomUserName(first.organizationName || first.displayName || first.email || 'Khách hàng');
      setCustomUserEmail(first.email || '');
    }
  }, [createOrderOpen, customTargetUid, users]);

  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.trim().toLowerCase();
    return orders.filter(order => {
      if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        order.orderCode,
        order.userName,
        order.userEmail,
        order.packageName,
        order.description,
        order.adminNote,
        order.sepayReferenceCode,
        order.sepayTransactionId !== undefined ? String(order.sepayTransactionId) : '',
        String(order.amountVnd),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, orderSearchQuery, orderStatusFilter]);

  const filteredWebhooks = useMemo(() => {
    const q = webhookSearchQuery.trim().toLowerCase();
    return webhooks.filter(log => {
      if (webhookStatusFilter !== 'all' && log.matchStatus !== webhookStatusFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        log.sepayTransactionId ? String(log.sepayTransactionId) : '',
        log.matchedOrderCode,
        log.code,
        log.content,
        log.description,
        log.referenceCode,
        log.gateway,
        log.accountNumber,
        log.authMethod,
        String(log.transferAmount),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [webhooks, webhookSearchQuery, webhookStatusFilter]);

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
      showToast('success', 'Đã sao chép URL Webhook SePay');
    } catch {
      showToast('info', 'Webhook URL', webhookUrl);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrefix = orderPrefix.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
    if (cleanPrefix.length < 2 || cleanPrefix.length > 5) {
      showToast('warning', 'Tiền tố không hợp lệ', 'Tiền tố phải gồm từ 2 đến 5 ký tự chữ cái (A-Z), ví dụ: TYT.');
      return;
    }
    setSavingConfig(true);
    try {
      const updated = await saveAdminSepayConfig({
        enabled,
        bankCode,
        bankName,
        accountNumber,
        accountHolder,
        subAccount,
        orderPrefix: cleanPrefix,
        orderSuffixMinLength,
        orderSuffixMaxLength,
        orderSuffixType: 'integer',
        webhookUrl,
        qrTemplate,
        authType,
        ...(newApiKey.trim() ? { apiKey: newApiKey.trim() } : {}),
        ...(newHmacSecret.trim() ? { hmacSecret: newHmacSecret.trim() } : {}),
        packages,
      });
      setConfig(updated);
      setOrderPrefix(updated.orderPrefix);
      setOrderSuffixMinLength(updated.orderSuffixMinLength || 2);
      setOrderSuffixMaxLength(updated.orderSuffixMaxLength || 8);
      setNewApiKey('');
      setNewHmacSecret('');
      showToast('success', 'Đã lưu cấu hình SePay & Giá Verify Tài Khoản');
    } catch (err: any) {
      showToast('error', 'Lưu cấu hình thất bại', err?.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handlePackageFieldChange = (
    idx: number,
    field: keyof VipPackageConfig,
    value: string | number | boolean
  ) => {
    setPackages(prev =>
      prev.map((pkg, i) => (i === idx ? { ...pkg, [field]: value } : pkg))
    );
  };

  const handleSelectTargetUser = (uid: string) => {
    setCustomTargetUid(uid);
    const found = users.find(u => u.uid === uid);
    if (found) {
      setCustomUserName(found.organizationName || found.displayName || found.email || 'Khách hàng');
      setCustomUserEmail(found.email || '');
    }
  };

  const handleCreateCustomOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Math.max(1000, Math.round(Number(customAmountVnd) || 0));
    if (!customTargetUid.trim() || !customUserName.trim()) {
      showToast('warning', 'Vui lòng chọn hoặc nhập thông tin tài khoản nhận đơn');
      return;
    }
    setCreatingOrder(true);
    try {
      await createAdminCustomPaymentOrder({
        uid: customTargetUid.trim(),
        userName: customUserName.trim(),
        userEmail: customUserEmail.trim() || undefined,
        packageId: customOrderType === 'vip_package' ? customPackageId : 'custom_order',
        packageName: customPackageName.trim(),
        orderType: customOrderType,
        amountVnd: amountNum,
        durationDays: Math.max(0, Math.round(Number(customDurationDays) || 0)),
        adminNote: customNote.trim() || undefined,
      });
      showToast('success', 'Đã tạo đơn hàng cấu hình số tiền riêng', formatVnd(amountNum));
      setCreateOrderOpen(false);
      setCustomNote('');
      await loadState(true);
    } catch (err: any) {
      showToast('error', 'Không thể tạo đơn hàng', err?.message);
    } finally {
      setCreatingOrder(false);
    }
  };

  const openEditOrder = (order: PaymentOrder) => {
    setEditingOrder(order);
    setEditAmountVnd(String(order.amountVnd));
    setEditStatus(order.status);
    setEditAdminNote(order.adminNote || '');
  };

  const handleSaveOrderEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const nextAmount = Math.max(1000, Math.round(Number(editAmountVnd) || editingOrder.amountVnd));
    setSavingOrderEdit(true);
    try {
      await updateAdminPaymentOrder({
        orderCode: editingOrder.orderCode,
        amountVnd: nextAmount,
        status: editStatus,
        adminNote: editAdminNote.trim(),
      });
      showToast(
        'success',
        `Đã cập nhật đơn ${editingOrder.orderCode}`,
        `Số tiền: ${formatVnd(nextAmount)} · Trạng thái: ${editStatus}`
      );
      setEditingOrder(null);
      await loadState(true);
    } catch (err: any) {
      showToast('error', 'Cập nhật đơn hàng thất bại', err?.message);
    } finally {
      setSavingOrderEdit(false);
    }
  };

  const handleSimulateWebhook = async (orderCode: string) => {
    setSimulatingOrderCode(orderCode);
    try {
      await simulateSepayWebhookPayment({ orderCode });
      showToast('success', `Đã gửi Webhook SePay test cho đơn ${orderCode}`, 'Trạng thái đã chuyển Đã thanh toán & kích hoạt Verify (Tick Xanh).');
      await loadState(true);
    } catch (err: any) {
      showToast('error', 'Giả lập webhook thất bại', err?.message);
    } finally {
      setSimulatingOrderCode(null);
    }
  };

  const handleRunWebhookTest = async () => {
    setTestingWebhook(true);
    try {
      const res = await runAdminSepayWebhookTest();
      showToast(
        'success',
        `Test Webhook thành công (HTTP ${res.statusCode})`,
        `Phương thức xác thực: ${res.authTypeUsed} · Đã ghi nhận vào Nhật ký Webhook.`
      );
      await loadState(true);
    } catch (err: any) {
      showToast('error', 'Test Webhook thất bại', err?.message || 'Kiểm tra lại API Key / HMAC Secret đã lưu.');
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-900 text-white shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Webhook className="w-4 h-4" />
            <span>Tích hợp SePay Webhooks · VietQR · Verify Tài Khoản</span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold">
            Cổng Thanh Toán SePay &amp; Cấu Hình Số Tiền Đơn Hàng
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Nhận biến động số dư ngân hàng theo thời gian thực qua Webhook, tùy chỉnh số tiền từng đơn hàng và tự động kích hoạt trạng thái Verify (Tick Xanh) cho tài khoản.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadState()}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới dữ liệu</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!customTargetUid && users.length > 0) {
                handleSelectTargetUser(users[0].uid);
              }
              setCreateOrderOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo đơn hàng cấu hình số tiền</span>
          </button>
        </div>
      </div>

      {/* Config Form: Webhook + Bank + VIP Packages */}
      <form onSubmit={handleSaveConfig} className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Webhook & Auth Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Webhook className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  1. Endpoint Webhook &amp; Bảo Mật SePay
                </h3>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span className={enabled ? 'text-emerald-600' : 'text-rose-600'}>
                  {enabled ? 'Đang bật SePay' : 'Đang tạm tắt'}
                </span>
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Webhook URL nhận POST từ SePay
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-emerald-700 dark:text-emerald-300 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    disabled={testingWebhook}
                    onClick={() => void handleRunWebhookTest()}
                    className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60 shrink-0"
                    title="Kiểm tra xác thực (API Key / HMAC) và phản hồi HTTP 200 của endpoint"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{testingWebhook ? 'Đang gửi...' : 'Gửi thử'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Khai báo URL này trong trang quản trị <a href="https://my.sepay.vn" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline inline-flex items-center gap-0.5">my.sepay.vn <ExternalLink className="w-3 h-3" /></a> · Sự kiện: Tiền vào (in).
                </p>
                {isAiStudioDevHost && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    <strong>Lưu ý môi trường Preview:</strong> Tên miền <span className="font-mono">{window.location.hostname}</span> có lớp bảo vệ cookie nội bộ (trả về <span className="font-mono">302 /__cookie_check.html</span> với máy chủ bên ngoài), nên khi nhấn &ldquo;Gửi thử&rdquo; từ <span className="font-mono">my.sepay.vn</span> tới link preview có thể không xuyên qua proxy. Để nhận webhook thật từ SePay, hãy dùng URL production công khai <span className="font-mono font-bold">https://tyt.slhd.id.vn/hooks/sepay-payment</span> (hoặc bấm nút <strong>Gửi thử</strong> ngay bên cạnh để kiểm tra xác thực nội bộ).
                    {webhookUrl !== 'https://tyt.slhd.id.vn/hooks/sepay-payment' && (
                      <button
                        type="button"
                        onClick={() => setWebhookUrl('https://tyt.slhd.id.vn/hooks/sepay-payment')}
                        className="ml-1.5 underline font-bold cursor-pointer"
                      >
                        Đặt lại về URL Production
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kiểu xác thực Webhook
                </label>
                <select
                  value={authType}
                  onChange={e => setAuthType(e.target.value as SepayAuthType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  <option value="none">Không xác thực (Test / Demo)</option>
                  <option value="api_key">API Key (Authorization: Apikey)</option>
                  <option value="hmac_sha256">HMAC-SHA256 (X-Sepay-Signature)</option>
                </select>
              </div>

              {/* Tiền tố & Hậu tố mã thanh toán khớp SePay */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                  <div className="sm:col-span-4">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tiền tố
                    </label>
                    <input
                      type="text"
                      value={orderPrefix}
                      onChange={e => setOrderPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5))}
                      placeholder="TYT"
                      maxLength={5}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono uppercase font-bold"
                    />
                    <span className="block text-[10px] text-slate-500 mt-1">
                      2–5 ký tự chữ cái
                    </span>
                  </div>

                  <div className="sm:col-span-8">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hậu tố
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <select
                          value={orderSuffixMinLength}
                          onChange={e => {
                            const nextMin = Number(e.target.value);
                            setOrderSuffixMinLength(nextMin);
                            if (orderSuffixMaxLength < nextMin) {
                              setOrderSuffixMaxLength(nextMin);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                          title="Số ký tự hậu tố tối thiểu"
                        >
                          {[2, 3, 4, 5, 6, 7, 8].map(n => (
                            <option key={n} value={n}>
                              Từ {n} ký tự
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <select
                          value={orderSuffixMaxLength}
                          onChange={e => setOrderSuffixMaxLength(Number(e.target.value))}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                          title="Số ký tự hậu tố tối đa"
                        >
                          {[2, 3, 4, 5, 6, 7, 8]
                            .filter(n => n >= orderSuffixMinLength)
                            .map(n => (
                              <option key={n} value={n}>
                                Đến {n} ký tự
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/70 font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center">
                        Số nguyên
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Ví dụ: <strong className="font-mono text-slate-700 dark:text-slate-200">{(orderPrefix || 'TYT').toLowerCase()}{'1'.repeat(orderSuffixMaxLength)}</strong>
                  </span>
                  <span>
                    Mã đơn sinh ra: <strong className="font-mono text-emerald-700 dark:text-emerald-300">{(orderPrefix || 'TYT').toUpperCase()}{'1'.repeat(orderSuffixMaxLength)}</strong>
                  </span>
                </div>
              </div>

              {authType === 'api_key' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>SePay API Key {config?.hasApiKey ? `(Hiện có: ${config.apiKeyMasked})` : ''}</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={newApiKey}
                      onChange={e => setNewApiKey(e.target.value)}
                      placeholder={config?.hasApiKey ? 'Nhập khóa mới để thay thế (để trống giữ nguyên)' : 'Nhập API Key cấu hình trên my.sepay.vn'}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}

              {authType === 'hmac_sha256' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SePay HMAC Secret {config?.hasHmacSecret ? `(Hiện có: ${config.hmacSecretMasked})` : ''}
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={newHmacSecret}
                      onChange={e => setNewHmacSecret(e.target.value)}
                      placeholder={config?.hasHmacSecret ? 'Nhập secret mới để thay thế' : 'Nhập HMAC Secret Key từ SePay'}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bank & VietQR Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Landmark className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Tài Khoản Ngân Hàng Liên Kết &amp; Mẫu QR SePay
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ngân hàng nhận tiền
                </label>
                <select
                  value={bankCode}
                  onChange={e => {
                    const code = e.target.value;
                    setBankCode(code);
                    const found = SEPAY_BANKS.find(b => b.code === code);
                    if (found) setBankName(found.name);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                >
                  {SEPAY_BANKS.map(b => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Số tài khoản ngân hàng (hoặc VA)
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="0399998888"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên chủ tài khoản
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={e => setAccountHolder(e.target.value.toUpperCase())}
                  placeholder="TRAM Y TE CO SO SLHD"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 uppercase font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tài khoản ảo / Sub-Account (tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={subAccount}
                  onChange={e => setSubAccount(e.target.value)}
                  placeholder="Để trống nếu không dùng VA"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Giao diện VietQR SePay (`qr.sepay.vn`)
                </label>
                <select
                  value={qrTemplate}
                  onChange={e => setQrTemplate(e.target.value as SepayBankTemplate)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="compact2">compact2 (QR + Logo + Số tiền + Nội dung)</option>
                  <option value="compact">compact (QR gọn)</option>
                  <option value="qr_only">qr_only (Chỉ mã QR)</option>
                  <option value="print">print (Mẫu in)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Account Verification Price Configuration */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                3. Cấu Hình Giá Trạng Thái Verify Tài Khoản
              </h3>
            </div>
            <button
              type="submit"
              disabled={savingConfig}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Đang lưu...' : 'Lưu toàn bộ cấu hình SePay'}</span>
            </button>
          </div>

          <div
            className={`grid gap-4 text-xs ${
              packages.length <= 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 md:grid-cols-2'
            }`}
          >
            {packages.map((pkg, idx) => (
              <div
                key={pkg.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold text-slate-500">{pkg.id}</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={pkg.isActive}
                      onChange={e => handlePackageFieldChange(idx, 'isActive', e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Hiển thị</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tên gói Verify
                  </label>
                  <input
                    type="text"
                    value={pkg.name}
                    onChange={e => handlePackageFieldChange(idx, 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Số tiền (VND)
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      value={pkg.priceVnd}
                      onChange={e => handlePackageFieldChange(idx, 'priceVnd', Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 font-mono font-bold text-emerald-700 dark:text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Thời hạn (ngày)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={pkg.durationDays}
                      onChange={e => handlePackageFieldChange(idx, 'durationDays', Number(e.target.value) || 30)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono font-semibold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* Orders Management Table (Configure per-order payment amount) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span>
                4. Quản Lý Đơn Hàng &amp; Cấu Hình Số Tiền Từng Đơn Hàng ({filteredOrders.length}
                {filteredOrders.length !== orders.length ? `/${orders.length}` : ''})
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Admin có thể sửa trực tiếp số tiền thanh toán (VND) của bất kỳ đơn hàng nào; mã QR SePay &amp; kiểm tra Webhook sẽ tự cập nhật theo số tiền mới.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={e => setOrderSearchQuery(e.target.value)}
                placeholder="Tìm mã đơn, tên khách, email, số tiền..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa từ khóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={orderStatusFilter}
              onChange={e => setOrderStatusFilter(e.target.value as 'all' | SepayOrderStatus)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">Chờ thanh toán</option>
              <option value="paid">Đã thanh toán</option>
              <option value="underpaid">Chuyển thiếu</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Chưa có đơn hàng nào. Hãy nhấn &ldquo;Tạo đơn hàng cấu hình số tiền&rdquo; hoặc tạo đơn từ trang Xác minh Tài khoản.
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 space-y-2">
            <div>Không tìm thấy đơn hàng nào khớp với từ khóa hoặc bộ lọc hiện tại.</div>
            <button
              type="button"
              onClick={() => {
                setOrderSearchQuery('');
                setOrderStatusFilter('all');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 pr-3">Mã đơn</th>
                  <th className="py-2.5 pr-3">Khách hàng / Tổ chức</th>
                  <th className="py-2.5 pr-3">Gói / Nội dung</th>
                  <th className="py-2.5 pr-3">Số tiền cấu hình</th>
                  <th className="py-2.5 pr-3">Trạng thái</th>
                  <th className="py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredOrders.map(order => (
                  <tr key={order.orderCode} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">{order.orderCode}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(order.createdAt).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{order.userName}</div>
                      {order.userEmail && <div className="text-[11px] text-slate-500">{order.userEmail}</div>}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{order.packageName}</div>
                      <div className="text-[11px] text-slate-500">
                        {order.durationDays ? `${order.durationDays} ngày Verify` : 'Đơn tùy chỉnh'}
                        {order.adminNote ? ` · ${order.adminNote}` : ''}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                        {formatVnd(order.amountVnd)}
                      </div>
                      {order.customAmountConfiguredByAdmin && (
                        <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                          Admin cấu hình riêng
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          order.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : order.status === 'underpaid'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : order.status === 'cancelled'
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                        }`}
                      >
                        {order.status === 'paid'
                          ? 'Đã thanh toán'
                          : order.status === 'underpaid'
                          ? 'Chuyển thiếu'
                          : order.status === 'cancelled'
                          ? 'Đã huỷ'
                          : 'Chờ thanh toán'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditOrder(order)}
                          className="px-2.5 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-sky-100"
                          title="Chỉnh số tiền & trạng thái đơn"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Sửa số tiền</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewQrOrder(order)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Xem mã QR SePay"
                        >
                          <QrCode className="w-3 h-3" />
                          <span>QR</span>
                        </button>
                        {order.status !== 'paid' && (
                          <button
                            type="button"
                            disabled={simulatingOrderCode === order.orderCode}
                            onClick={() => void handleSimulateWebhook(order.orderCode)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                            title="Gửi Webhook SePay giả lập tới /hooks/sepay-payment"
                          >
                            <Play className="w-3 h-3" />
                            <span>Test Webhook</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Webhook Logs */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-violet-600" />
            <span>
              5. Nhật Ký SePay Webhook Gần Nhất ({filteredWebhooks.length}
              {filteredWebhooks.length !== webhooks.length ? `/${webhooks.length}` : ''})
            </span>
          </h3>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={webhookSearchQuery}
                onChange={e => setWebhookSearchQuery(e.target.value)}
                placeholder="Tìm mã GD, mã đơn, nội dung CK, số tiền..."
                className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              {webhookSearchQuery && (
                <button
                  type="button"
                  onClick={() => setWebhookSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa từ khóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <select
              value={webhookStatusFilter}
              onChange={e => setWebhookStatusFilter(e.target.value as 'all' | SepayWebhookLog['matchStatus'])}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
            >
              <option value="all">Tất cả kết quả</option>
              <option value="matched_paid">Khớp đơn · Đã thanh toán</option>
              <option value="underpaid">Chuyển thiếu tiền</option>
              <option value="unmatched">Chưa khớp đơn</option>
              <option value="duplicate_ignored">Trùng lặp</option>
              <option value="ignored_out">Tiền ra</option>
            </select>
          </div>
        </div>

        {webhooks.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Chưa nhận được webhook nào tại <span className="font-mono">/hooks/sepay-payment</span>.
          </p>
        ) : filteredWebhooks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 space-y-2">
            <div>Không tìm thấy nhật ký webhook nào khớp với từ khóa hoặc bộ lọc hiện tại.</div>
            <button
              type="button"
              onClick={() => {
                setWebhookSearchQuery('');
                setWebhookStatusFilter('all');
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
            {filteredWebhooks.map(log => (
              <div
                key={log.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      #{log.sepayTransactionId || 'N/A'}
                    </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                      +{formatVnd(log.transferAmount)}
                    </span>
                    <span className="text-slate-500">· {log.gateway}</span>
                    {log.matchedOrderCode && (
                      <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                        {log.matchedOrderCode}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-2xl">
                    Nội dung: {log.content || '—'} {log.referenceCode ? `· Ref: ${log.referenceCode}` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      log.matchStatus === 'matched_paid'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : log.matchStatus === 'underpaid'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : log.matchStatus === 'unmatched'
                        ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {log.matchStatus === 'matched_paid'
                      ? 'Khớp đơn · Đã thanh toán'
                      : log.matchStatus === 'underpaid'
                      ? 'Chuyển thiếu tiền'
                      : log.matchStatus === 'unmatched'
                      ? 'Chưa khớp đơn (Test/Khác)'
                      : log.matchStatus === 'duplicate_ignored'
                      ? 'Trùng lặp (Đã bỏ qua)'
                      : log.matchStatus === 'ignored_out'
                      ? 'Tiền ra (Bỏ qua)'
                      : log.matchStatus}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(log.receivedAt).toLocaleString('vi-VN')} · {log.authMethod}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Custom Order Modal */}
      {createOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg md:max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tạo Đơn Hàng Cấu Hình Số Tiền Riêng (Admin)
              </h3>
              <button
                type="button"
                onClick={() => setCreateOrderOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomOrder} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn tài khoản nhận đơn *
                  </label>
                  <select
                    value={customTargetUid}
                    onChange={e => handleSelectTargetUser(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>
                        {(u.organizationName || u.displayName || u.email || u.uid)} ({u.email || u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Loại đơn hàng
                  </label>
                  <select
                    value={customOrderType}
                    onChange={e => setCustomOrderType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="vip_package">Mở khóa / Gia hạn Verify Tài Khoản</option>
                    <option value="custom_order">Đơn hàng dịch vụ tùy chỉnh</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tên gói / Dịch vụ hiển thị *
                  </label>
                  <input
                    type="text"
                    required
                    value={customPackageName}
                    onChange={e => setCustomPackageName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Số tiền thanh toán (VND) *
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={1000}
                      required
                      value={customAmountVnd}
                      onChange={e => setCustomAmountVnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 font-mono font-bold text-emerald-700 dark:text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Số ngày Verify
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={3650}
                      value={customDurationDays}
                      onChange={e => setCustomDurationDays(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              </div>

              {customOrderType === 'vip_package' && packages.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Áp dụng mẫu Verify Tài Khoản
                  </label>
                  <select
                    value={customPackageId}
                    onChange={e => {
                      const id = e.target.value;
                      setCustomPackageId(id);
                      const pkg = packages.find(p => p.id === id);
                      if (pkg) {
                        setCustomPackageName(pkg.name);
                        setCustomDurationDays(String(pkg.durationDays));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Mặc định {formatVnd(p.priceVnd)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú của Admin cho đơn hàng
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="Ví dụ: Ưu đãi Doanh nghiệp liên kết, miễn/giảm phí Verify..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateOrderOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingOrder}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  {creatingOrder ? 'Đang tạo...' : 'Tạo đơn & Sinh mã QR SePay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Order Amount Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg md:max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cấu Hình Số Tiền Đơn Hàng {editingOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số tiền thanh toán (VND) *
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    required
                    value={editAmountVnd}
                    onChange={e => setEditAmountVnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/30 font-mono font-bold text-emerald-700 dark:text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái đơn hàng
                  </label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value as SepayOrderStatus)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold"
                  >
                    <option value="pending">Chờ thanh toán (pending)</option>
                    <option value="paid">Đã thanh toán &amp; Kích hoạt Verify (paid)</option>
                    <option value="underpaid">Chuyển thiếu tiền (underpaid)</option>
                    <option value="cancelled">Đã hủy (cancelled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú điều chỉnh giá / thanh toán
                </label>
                <input
                  type="text"
                  value={editAdminNote}
                  onChange={e => setEditAdminNote(e.target.value)}
                  placeholder="Lý do điều chỉnh số tiền đơn hàng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingOrderEdit}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingOrderEdit ? 'Đang lưu...' : 'Lưu số tiền & trạng thái'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Preview Modal */}
      {previewQrOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md md:max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Mã VietQR SePay · {previewQrOrder.orderCode}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewQrOrder(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                {previewQrOrder.qrUrl && (
                  <img
                    src={previewQrOrder.qrUrl}
                    alt={`VietQR ${previewQrOrder.orderCode}`}
                    className="w-56 h-auto rounded-xl"
                  />
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-slate-500">Khách hàng:</span>
                  <div className="font-bold text-slate-900 dark:text-white">{previewQrOrder.userName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Số tiền thanh toán:</span>
                  <div className="text-lg font-extrabold text-emerald-600 font-mono">
                    {formatVnd(previewQrOrder.amountVnd)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Nội dung chuyển khoản:</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white">{previewQrOrder.orderCode}</div>
                </div>
                <div>
                  <span className="text-slate-500">Webhook nhận kết quả:</span>
                  <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 break-all">
                    {webhookUrl}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
