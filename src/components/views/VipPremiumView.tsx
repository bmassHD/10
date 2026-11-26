import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Webhook,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import type {
  PaymentOrder,
  SepayPublicConfig,
  SystemSettings,
  VipPackageConfig,
  VipStatusInfo,
} from '../../types';
import {
  createVipPaymentOrder,
  fetchMyPaymentOrders,
  fetchPublicSepayConfig,
  formatVnd,
  pollPaymentOrderStatus,
} from '../../services/sepayService';
import { VerifiedBlueTick } from '../common/VerifiedBlueTick';

interface VipPremiumViewProps {
  settings: SystemSettings;
  onOpenAuthModal: () => void;
}

export const VipPremiumView: React.FC<VipPremiumViewProps> = ({
  settings,
  onOpenAuthModal,
}) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const [config, setConfig] = useState<SepayPublicConfig | null>(settings.sepayConfig || null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [vipStatus, setVipStatus] = useState<VipStatusInfo>({
    isVip: Boolean(userProfile?.isVip),
    vipTier: userProfile?.vipTier,
    vipPackageName: userProfile?.vipPackageName,
    vipActivatedAt: userProfile?.vipActivatedAt,
    vipExpiresAt: userProfile?.vipExpiresAt,
    vipOrderCode: userProfile?.vipOrderCode,
    source: userProfile?.isVip ? 'admin' : 'none',
  });
  const [loading, setLoading] = useState(true);
  const [creatingPkgId, setCreatingPkgId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<PaymentOrder | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const syncAuthVerifiedState = (nextStatus: VipStatusInfo) => {
    window.dispatchEvent(new CustomEvent('tyt-sepay-verified-updated', { detail: nextStatus }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const pubCfg = await fetchPublicSepayConfig();
      setConfig(pubCfg);
      if (currentUser) {
        const res = await fetchMyPaymentOrders();
        setOrders(res.orders || []);
        setVipStatus(res.vipStatus);
        syncAuthVerifiedState(res.vipStatus);
      }
    } catch (err: any) {
      showToast('error', 'Không thể tải thông tin xác minh tài khoản', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentUser?.uid]);

  // Live 3-second polling while SePay VietQR payment modal is open on an unpaid order
  useEffect(() => {
    if (!activeOrder || activeOrder.status === 'paid' || !currentUser) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await pollPaymentOrderStatus(activeOrder.orderCode);
        setActiveOrder(res.order);
        setVipStatus(res.vipStatus);
        if (res.order.status === 'paid') {
          syncAuthVerifiedState(res.vipStatus);
          showToast(
            'success',
            'Thanh toán SePay thành công!',
            'Trạng thái Verify (Tick Xanh) đã được kích hoạt tự động cho tài khoản của bạn.'
          );
          setOrders(prev => prev.map(o => (o.orderCode === res.order.orderCode ? res.order : o)));
        }
      } catch {
        // non-blocking poll
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.orderCode, activeOrder?.status, currentUser]);

  const handleSelectPackage = async (pkg: VipPackageConfig) => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    setCreatingPkgId(pkg.id);
    try {
      const res = await createVipPaymentOrder({
        packageId: pkg.id,
        userName: userProfile?.organizationName || userProfile?.displayName || currentUser.email || 'Người dùng',
      });
      setConfig(res.config);
      setActiveOrder(res.order);
      setOrders(prev => [res.order, ...prev]);
    } catch (err: any) {
      showToast('error', 'Không thể tạo đơn thanh toán SePay', err?.message);
    } finally {
      setCreatingPkgId(null);
    }
  };

  const handleManualVerifyCheck = async () => {
    if (!activeOrder) return;
    setCheckingPayment(true);
    try {
      const res = await pollPaymentOrderStatus(activeOrder.orderCode);
      setActiveOrder(res.order);
      setVipStatus(res.vipStatus);
      if (res.order.status === 'paid') {
        syncAuthVerifiedState(res.vipStatus);
        showToast(
          'success',
          'Đã nhận thanh toán qua SePay!',
          'Tài khoản của bạn đã được kích hoạt trạng thái Verify (Tick Xanh).'
        );
        setOrders(prev => prev.map(o => (o.orderCode === res.order.orderCode ? res.order : o)));
      } else {
        showToast(
          'info',
          'Chưa ghi nhận giao dịch khớp mã đơn',
          'Vui lòng chuyển khoản đúng số tiền và nội dung chuyển khoản rồi đợi vài giây.'
        );
      }
    } catch (err: any) {
      showToast('error', 'Không thể kiểm tra trạng thái đơn hàng', err?.message);
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      showToast('success', 'Đã sao chép nội dung chuyển khoản');
    } catch {
      // ignore
    }
  };

  const activePackages = (config?.packages || []).filter(p => p.isActive);
  const displayName =
    userProfile?.organizationName || userProfile?.displayName || currentUser?.email || 'Tài khoản của bạn';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
      {/* Hero Status Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-sky-700 via-blue-800 to-emerald-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-sky-100 text-xs font-bold">
            <BadgeCheck className="w-4 h-4 text-sky-200" />
            <span>Thanh Toán Chính Thức qua SePay VietQR</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2 flex-wrap">
            <span>
              {vipStatus.isVip
                ? 'Tài Khoản Đã Được Xác Minh Chính Thức (Verified)'
                : 'Mua Trạng Thái Verify Tài Khoản (Tick Xanh)'}
            </span>
            {vipStatus.isVip && <VerifiedBlueTick size="md" />}
          </h1>
          <p className="text-xs sm:text-sm text-sky-50/90 max-w-2xl">
            {vipStatus.isVip
              ? `Mã đối soát: ${vipStatus.vipOrderCode || 'Quản trị viên cấp'} · Hiệu lực đến ${
                  vipStatus.vipExpiresAt ? new Date(vipStatus.vipExpiresAt).toLocaleDateString('vi-VN') : 'Dài hạn'
                }. Huy hiệu Tick Xanh đã hiển thị trên toàn hệ thống.`
              : 'Quét mã VietQR ngân hàng qua cổng thanh toán SePay chính thức. Ngay khi giao dịch hoàn tất, hệ thống tự động kích hoạt huy hiệu Tick Xanh Verified cho tài khoản của bạn.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!currentUser ? (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="px-5 py-2.5 rounded-xl bg-white text-sky-900 font-bold text-xs shadow-md hover:bg-sky-50 cursor-pointer"
            >
              Đăng nhập để xác minh tài khoản
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Cập nhật trạng thái</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Verification Purchase & Badge Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Verification Tier Card(s) */}
        <div className="lg:col-span-5 space-y-4">
          {activePackages.length === 0 ? (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
              Hiện chưa mở đăng ký mua trạng thái Verify trực tuyến. Vui lòng liên hệ Quản trị viên để được tạo đơn hàng thanh toán riêng.
            </div>
          ) : (
            activePackages.map(pkg => (
              <div
                key={pkg.id}
                className="p-6 rounded-3xl bg-white dark:bg-slate-900 border-2 border-sky-400/70 dark:border-sky-600/70 flex flex-col justify-between space-y-5 shadow-sm h-full"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[11px] font-extrabold">
                      <VerifiedBlueTick size="xs" />
                      <span>{pkg.badgeText || 'Tick Xanh Verified'}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Hiệu lực {pkg.durationDays} ngày
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{pkg.name}</h2>
                    {pkg.subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{pkg.subtitle}</p>}
                  </div>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                      {formatVnd(pkg.priceVnd)}
                    </span>
                    <span className="text-xs text-slate-500">/ {pkg.durationDays} ngày</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {pkg.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={creatingPkgId === pkg.id || config?.enabled === false}
                  onClick={() => void handleSelectPackage(pkg)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-md cursor-pointer transition disabled:opacity-60"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {creatingPkgId === pkg.id
                      ? 'Đang tạo đơn SePay...'
                      : vipStatus.isVip
                      ? 'Gia hạn Verify qua SePay VietQR'
                      : 'Mua trạng thái Verify qua SePay'}
                  </span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Account Verification Status & Live Badge Preview */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-600" />
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Trạng Thái Xác Minh &amp; Hiển Thị Huy Hiệu
                </h2>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                  vipStatus.isVip
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {vipStatus.isVip ? 'Đã Verify' : 'Chưa Verify'}
              </span>
            </div>

            {/* Live Badge Preview Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center font-extrabold text-lg shrink-0">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {displayName}
                    </span>
                    <VerifiedBlueTick
                      size="md"
                      className={vipStatus.isVip ? '' : 'opacity-30 grayscale'}
                      title={
                        vipStatus.isVip
                          ? 'Tài khoản đã xác minh chính thức (Verified)'
                          : 'Minh họa huy hiệu Tick Xanh sau khi Verify'
                      }
                    />
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {currentUser ? currentUser.email || 'Tài khoản đã đăng nhập' : 'Đăng nhập để xem trạng thái tài khoản'}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 shrink-0 hidden sm:inline">
                {vipStatus.isVip ? 'Đang hiển thị công khai' : 'Xem trước huy hiệu'}
              </span>
            </div>

            {vipStatus.isVip ? (
              <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Trạng thái:</span>
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {vipStatus.vipPackageName || 'Tài khoản Verified chính thức'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Mã đơn SePay đối soát:</span>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {vipStatus.vipOrderCode || 'Cấp bởi Quản trị viên'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Ngày kích hoạt:</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {vipStatus.vipActivatedAt
                      ? new Date(vipStatus.vipActivatedAt).toLocaleString('vi-VN')
                      : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Hiệu lực đến:</span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {vipStatus.vipExpiresAt
                      ? new Date(vipStatus.vipExpiresAt).toLocaleDateString('vi-VN')
                      : 'Dài hạn'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-sky-700 dark:text-sky-400">Bước 1 · Tạo đơn</div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Nhấn &ldquo;Mua trạng thái Verify qua SePay&rdquo; hoặc mở đơn hàng được Admin cấu hình số tiền riêng.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-sky-700 dark:text-sky-400">Bước 2 · Quét VietQR</div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Dùng app ngân hàng quét mã QR, giữ nguyên số tiền và nội dung chuyển khoản bắt buộc.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="font-extrabold text-emerald-700 dark:text-emerald-400">Bước 3 · Kích hoạt ngay</div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Webhook SePay tự động xác nhận giao dịch và bật Tick Xanh Verified trong vài giây.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-900 text-[11px] text-sky-800 dark:text-sky-300 flex items-center gap-2">
            <Webhook className="w-4 h-4 shrink-0" />
            <span>
              Cổng tiếp nhận giao dịch thời gian thực: <strong className="font-mono">https://tyt.slhd.id.vn/hooks/sepay-payment</strong>
            </span>
          </div>
        </div>
      </div>

      {/* User Orders (Includes Admin-Configured Custom Amount Orders) */}
      {currentUser && orders.length > 0 && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Đơn Hàng Thanh Toán Của Bạn ({orders.length})
            </h3>
            <span className="text-[11px] text-slate-500">
              Bao gồm các đơn hàng được Quản trị viên cấu hình số tiền riêng
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {orders.map(order => (
              <div
                key={order.orderCode}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{order.orderCode}</span>
                    {order.customAmountConfiguredByAdmin && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 text-[10px] font-bold">
                        Giá cấu hình riêng
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">{order.packageName}</div>
                  <div className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                    {formatVnd(order.amountVnd)}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      order.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : order.status === 'underpaid'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {order.status === 'paid'
                      ? 'Đã thanh toán'
                      : order.status === 'underpaid'
                      ? 'Chuyển thiếu tiền'
                      : 'Chờ thanh toán'}
                  </span>
                  {order.status !== 'paid' && (
                    <button
                      type="button"
                      onClick={() => setActiveOrder(order)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer"
                    >
                      Mở mã QR thanh toán
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SePay VietQR Checkout Modal (Horizontal PC Design) */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg md:max-w-3xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 bg-gradient-to-r from-sky-700 to-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">Thanh Toán SePay VietQR · {activeOrder.orderCode}</h3>
                  <p className="text-xs text-sky-100">{activeOrder.packageName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-3">
                {activeOrder.qrUrl ? (
                  <img
                    src={activeOrder.qrUrl}
                    alt={`SePay VietQR ${activeOrder.orderCode}`}
                    className="w-60 h-auto rounded-2xl shadow-sm bg-white p-2"
                  />
                ) : (
                  <div className="w-56 h-56 rounded-2xl bg-slate-200 flex items-center justify-center text-slate-500">
                    Đang tạo mã QR...
                  </div>
                )}
                <p className="text-[11px] text-slate-500 text-center">
                  Mở ứng dụng ngân hàng để quét mã VietQR. Trạng thái Verify sẽ tự động kích hoạt ngay khi chuyển khoản thành công.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ngân hàng:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{config?.bankName || 'MB Bank'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Số tài khoản:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{config?.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Chủ tài khoản:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{config?.accountHolder}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500">Số tiền chính xác:</span>
                    <span className="text-lg font-extrabold text-emerald-600 font-mono">
                      {formatVnd(activeOrder.amountVnd)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Nội dung CK (bắt buộc):</span>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode(activeOrder.orderCode)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{activeOrder.orderCode}</span>
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {activeOrder.status === 'paid' ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-sm">Đã thanh toán thành công!</div>
                      <div className="text-[11px]">
                        Trạng thái Verify (Tick Xanh) đã được kích hoạt tự động cho tài khoản của bạn.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200 flex items-center gap-2">
                      <Webhook className="w-4 h-4 shrink-0 animate-pulse" />
                      <span className="text-[11px]">
                        Đang lắng nghe giao dịch từ SePay (tự động kiểm tra mỗi 3 giây)...
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={checkingPayment}
                      onClick={() => void handleManualVerifyCheck()}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className={`w-4 h-4 ${checkingPayment ? 'animate-spin' : ''}`} />
                      <span>
                        {checkingPayment ? 'Đang kiểm tra giao dịch...' : 'Tôi đã chuyển khoản · Kiểm tra ngay'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
