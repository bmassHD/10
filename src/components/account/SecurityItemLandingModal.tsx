import React from 'react';
import {
  X,
  ShieldCheck,
  MailCheck,
  Phone,
  KeyRound,
  Lock,
  Smartphone,
  CreditCard,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface SecurityItemLandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionKey: 'verify' | 'phone' | 'totp_2fa' | 'password' | 'cccd' | 'devices' | null;
  settings: SystemSettings;
  setCurrentView: (view: string) => void;
}

export const SecurityItemLandingModal: React.FC<SecurityItemLandingModalProps> = ({
  isOpen,
  onClose,
  sectionKey,
  setCurrentView,
}) => {
  const { currentUser, userProfile } = useAuth();
  if (!isOpen || !sectionKey) return null;

  const getSectionDetails = () => {
    switch (sectionKey) {
      case 'verify':
        return {
          title: 'Trang Chuyên Biệt: Xác Minh Email & Gmail',
          subtitle: 'Bảo vệ định danh bằng hòm thư chính chủ và liên kết tài khoản Google/Zalo.',
          icon: MailCheck,
          color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400',
          steps: [
            'Kiểm tra địa chỉ email đăng nhập hiện tại trên hệ thống.',
            'Bấm "Gửi link Firebase" để nhận email xác minh từ hệ thống.',
            'Mở hòm thư Gmail, bấm vào đường dẫn xác nhận để hoàn tất khóa định danh.',
            'Có thể liên kết thêm tài khoản Google hoặc Zalo để đăng nhập một chạm an toàn.',
          ],
        };
      case 'phone':
        return {
          title: 'Trang Chuyên Biệt: Xác Minh Số Điện Thoại',
          subtitle: 'Gắn kết và khóa duy nhất số điện thoại 10 số chính chủ cho tài khoản.',
          icon: Phone,
          color: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400',
          steps: [
            'Nhập chính xác số điện thoại di động 10 số (VD: 0912345678).',
            'Hệ thống tự động kiểm tra tính duy nhất trên cơ sở dữ liệu để tránh trùng lặp.',
            'Bấm "Xác nhận" để lưu và khóa vĩnh viễn số điện thoại vào hồ sơ cá nhân.',
            'Số điện thoại đã xác nhận hỗ trợ khôi phục tài khoản và nhận thông báo khẩn cấp.',
          ],
        };
      case 'totp_2fa':
        return {
          title: 'Trang Chuyên Biệt: Khoá 2FA Authenticator',
          subtitle: 'Bảo mật tuyệt đối cấp độ cao với mã OTP thay đổi mỗi 30 giây qua ứng dụng Google Authenticator / Authy.',
          icon: KeyRound,
          color: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400',
          steps: [
            'Cài đặt ứng dụng Google Authenticator, Microsoft Authenticator hoặc Authy trên điện thoại.',
            'Quét mã QR hiển thị trên màn hình bảo mật tài khoản.',
            'Nhập mã OTP gồm 6 chữ số từ ứng dụng để kích hoạt.',
            'Lưu trữ an toàn các mã khôi phục dự phòng để sử dụng khi mất thiết bị.',
          ],
        };
      case 'password':
        return {
          title: 'Trang Chuyên Biệt: Quản Lý Mật Khẩu Đăng Nhập',
          subtitle: 'Thiết lập mật khẩu mạnh hoặc thay đổi mật khẩu định kỳ bảo vệ tài khoản.',
          icon: Lock,
          color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
          steps: [
            'Nhập mật khẩu hiện tại (đối với tài khoản đã có mật khẩu).',
            'Nhập mật khẩu mới tối thiểu 6 ký tự gồm chữ và số.',
            'Xác nhận lại mật khẩu mới và bấm lưu thay đổi.',
            'Sử dụng tính năng quên mật khẩu nếu cần khôi phục qua email và CCCD.',
          ],
        };
      case 'cccd':
        return {
          title: 'Trang Chuyên Biệt: Xác Minh Định Danh CCCD / VNeID',
          subtitle: 'Đối chiếu và tích hợp số Căn cước công dân gắn chip với Cơ sở dữ liệu dân cư & Y tế.',
          icon: CreditCard,
          color: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400',
          steps: [
            'Nhập số định danh CCCD gồm 12 chữ số hoặc dùng tính năng quét NFC thẻ CCCD gắn chip.',
            'Hệ thống tự động tra cứu, đối chiếu và điền thông tin Họ tên, Ngày sinh, Địa chỉ hành chính.',
            'Bấm "Xác nhận đúng thông tin" để khóa vĩnh viễn hồ sơ và nhận huy hiệu xác minh.',
            'Định danh CCCD giúp liên kết hồ sơ khám chữa bệnh, lịch tiêm chủng và tra cứu BHYT trực tuyến.',
          ],
        };
      case 'devices':
        return {
          title: 'Trang Chuyên Biệt: Thiết Bị & Phiên Đăng Nhập',
          subtitle: 'Giám sát toàn bộ thiết bị đang hoạt động, quét mã QR đăng nhập PC và thu hồi phiên từ xa.',
          icon: Smartphone,
          color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400',
          steps: [
            'Xem danh sách mọi thiết bị, trình duyệt và hệ điều hành từng đăng nhập.',
            'Thu hồi ngay lập tức quyền truy cập của bất kỳ thiết bị lạ nào.',
            'Sử dụng tính năng quét mã QR để đồng bộ đăng nhập nhanh chóng từ di động sang máy tính PC.',
            'Bật khóa sinh trắc học Face ID / Touch ID cho ứng dụng.',
          ],
        };
      default:
        return {
          title: 'Xác Minh & Bảo Mật Tài Khoản',
          subtitle: 'Thông tin chi tiết bảo vệ tài khoản người dùng.',
          icon: ShieldCheck,
          color: 'bg-emerald-50 text-emerald-700',
          steps: ['Hoàn tất các lớp bảo vệ để đạt độ an toàn 100%.'],
        };
    }
  };

  const details = getSectionDetails();
  const Icon = details.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-2xl ${details.color} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Landing Page Chuyên Biệt
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {details.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Overview Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/50 to-sky-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-sky-950/30 border border-emerald-200/60 dark:border-emerald-800/50 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tổng quan mục bảo mật
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {details.subtitle}
            </p>
          </div>

          {/* Step-by-step guidance */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Hướng dẫn &amp; Các bước thực hiện
            </h4>
            <div className="space-y-2.5">
              {details.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex items-start gap-3 text-xs sm:text-sm"
                >
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed pt-0.5">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account info summary */}
          {currentUser && (
            <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 text-xs font-mono space-y-1">
              <div className="text-emerald-400 font-bold">Trạng thái tài khoản hiện tại:</div>
              <div>Email: {currentUser.email || '—'}</div>
              <div>UID: {currentUser.uid}</div>
              <div>Tên hiển thị: {userProfile?.displayName || currentUser.displayName || '—'}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
          >
            Quay lại Cài đặt
          </button>

          {sectionKey === 'devices' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                setCurrentView('account_devices');
              }}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Mở trang Quản lý Thiết bị đầy đủ</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-xs"
            >
              Đã hiểu &amp; Quay lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
