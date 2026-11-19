import React from 'react';
import {
  Siren,
  Phone,
  ShieldAlert,
  MapPin,
  User,
  Building2,
  WifiOff,
  Navigation,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Radio,
  HeartPulse,
} from 'lucide-react';
import { SystemSettings } from '../../types';
import { sortLocationsPrimaryFirst } from '../../services/firebaseService';

interface OfflineEmergencyViewProps {
  settings: SystemSettings;
}

export const OfflineEmergencyView: React.FC<OfflineEmergencyViewProps> = ({ settings }) => {
  const stationName =
    settings.stationName && !settings.stationName.includes('Chưa cấu hình')
      ? settings.stationName
      : 'Trạm Y Tế Xã/Phường';

  const hotline = settings.hotline || '115';
  const emergencyPhone = settings.emergencyPhone || settings.hotline || '115';
  const emergencyContacts = Array.isArray(settings.emergencyContacts)
    ? settings.emergencyContacts
    : [];

  const mapLocations = sortLocationsPrimaryFirst(settings.mapLocations || []);
  const orgDirector = settings.orgChart?.director;
  const deputyDirectors = settings.orgChart?.deputyDirectors || [];
  const departments = settings.orgChart?.departments || [];

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6 animate-in fade-in duration-300">
      {/* High-Impact Emergency Command Header */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-rose-600 via-rose-700 to-rose-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/30 backdrop-blur-md text-amber-300 text-xs font-black uppercase tracking-widest border border-white/20">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>Chế độ khẩn cấp · Hoạt động ngoại tuyến 100%</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              Trung Tâm Cấp Cứu &amp; Trực Điểm Trạm
            </h1>

            <p className="text-xs sm:text-sm font-medium text-rose-100 max-w-xl leading-relaxed">
              Trang web đã được lưu vào bộ nhớ cục bộ (PWA Local Storage). Quý dân cư và cán bộ có thể gọi điện cấp cứu, tra cứu số điện thoại người đứng đầu ngay cả khi hoàn toàn mất kết nối Internet (Không cần Wi-Fi / 5G).
            </p>
          </div>

          <div className="shrink-0 flex flex-col gap-2 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/15">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-200">
              <WifiOff className="w-4 h-4 text-amber-300" />
              <span>Trạng thái: Sẵn sàng ngoại tuyến</span>
            </div>
            <div className="text-[11px] text-rose-100/80">
              Đơn vị: <strong className="text-white">{stationName}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Emergency 1-Tap Calling Grid */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600">
            <Siren className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Đường Dây Nóng Cấp Cứu 24/7
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chạm trực tiếp vào các nút bên dưới để gọi khẩn cấp ngay từ điện thoại của bạn.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href={`tel:${emergencyPhone}`}
            className="p-6 rounded-3xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg flex items-center justify-between gap-4 transition group cursor-pointer border-2 border-rose-400/50"
          >
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-black uppercase tracking-wider text-rose-200 block">
                Cấp cứu 24/7 (Tuyến trên)
              </span>
              <span className="text-3xl sm:text-4xl font-black tracking-tight font-mono tabular-nums block">
                {emergencyPhone}
              </span>
              <span className="text-xs text-rose-100 block opacity-95 font-medium truncate">
                {settings.emergencyNote ? `Bệnh viện tiếp nhận: ${settings.emergencyNote}` : 'Bệnh viện tuyến trên tiếp nhận cấp cứu & xe cứu thương 24/7'}
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-inner">
              <Phone className="w-7 h-7 text-white" />
            </div>
          </a>

          <a
            href={`tel:${hotline}`}
            className="p-6 rounded-3xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg flex items-center justify-between gap-4 transition group cursor-pointer border-2 border-emerald-400/50"
          >
            <div className="space-y-1.5 min-w-0">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-200 block">
                Hotline Trạm Y Tế
              </span>
              <span className="text-3xl sm:text-4xl font-black tracking-tight font-mono tabular-nums block">
                {hotline}
              </span>
              <span className="text-xs text-emerald-100 block opacity-90 truncate">
                Tiếp nhận thông tin y tế &amp; tư vấn sức khỏe cơ sở
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-md flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-inner">
              <Phone className="w-7 h-7 text-white" />
            </div>
          </a>
        </div>

        {emergencyContacts.length > 0 && (
          <div className="pt-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Đường dây Cấp cứu Bệnh viện &amp; Cơ sở Tuyến trên (Đính kèm)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {emergencyContacts.map((contact, idx) => (
                <a
                  key={`ec_${idx}`}
                  href={`tel:${contact.phone}`}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-rose-500 hover:shadow-md transition flex items-center justify-between gap-3"
                  title={contact.note ? `Bệnh viện: ${contact.note}` : 'Cấp cứu tuyến trên'}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {contact.note || `Bệnh viện Cấp cứu Tuyến trên (${idx + 1})`}
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                      Cấp cứu 24/7 Tuyến trên
                    </div>
                    <div className="text-base font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                      {contact.phone}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Leadership & Point Heads Directory */}
      <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Danh Bạ Người Đứng Đầu &amp; Phụ Trách Điểm Trạm
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thông tin liên hệ trực tiếp Ban Giám đốc và cán bộ phụ trách các điểm trạm y tế.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Ban Giám đốc */}
          {(orgDirector || deputyDirectors.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Ban Giám Đốc Trạm Y Tế
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {orgDirector && orgDirector.fullName && (
                  <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 space-y-2 shadow-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                      {orgDirector.position || 'Giám đốc'}
                    </span>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {orgDirector.fullName}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {orgDirector.professionalTitle || 'Bác sĩ chuyên khoa'}
                    </div>
                    {orgDirector.phone && (
                      <div className="pt-1">
                        <a
                          href={`tel:${orgDirector.phone}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold font-mono transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Gọi: {orgDirector.phone}</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {deputyDirectors.map(dd => (
                  <div
                    key={dd.id}
                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 shadow-xs"
                  >
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {dd.position || 'Phó Giám đốc'}
                    </span>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      {dd.fullName}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {dd.professionalTitle || 'Bác sĩ / Y sĩ'}
                    </div>
                    {dd.phone && (
                      <div className="pt-1">
                        <a
                          href={`tel:${dd.phone}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold font-mono transition"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Gọi: {dd.phone}</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Phụ trách các điểm trạm */}
          {mapLocations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Phụ Trách Cơ Sở &amp; Điểm Trạm Vệ Tinh ({mapLocations.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mapLocations.map(loc => (
                  <div
                    key={loc.id}
                    className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          {loc.isPrimary ? 'Trụ sở chính' : 'Điểm trạm vệ tinh'}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {loc.name}
                        </h4>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{loc.address}</span>
                      </div>
                      {loc.headName && (
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                          <User className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Phụ trách: {loc.headName}</span>
                        </div>
                      )}
                    </div>

                    {loc.phone && (
                      <div className="pt-1">
                        <a
                          href={`tel:${loc.phone}`}
                          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold font-mono transition shadow-xs"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Gọi điểm trạm: {loc.phone}</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Offline PWA Installation & Access Guide */}
      <section className="p-6 sm:p-8 rounded-3xl bg-slate-900 text-white shadow-lg space-y-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              Hướng dẫn truy cập website khi hoàn toàn mất mạng (Không Wi-Fi / 5G)
            </h3>
            <p className="text-xs text-slate-400">
              Lưu trang web vào màn hình chính điện thoại để sử dụng như một ứng dụng ngoại tuyến độc lập.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-300">
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
            <div className="font-bold text-amber-400">Bước 1: Cài đặt PWA</div>
            <p>Mở menu trình duyệt (Safari trên iPhone hoặc Chrome trên Android) và chọn <strong>"Thêm vào màn hình chính" (Add to Home Screen)</strong>.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
            <div className="font-bold text-amber-400">Bước 2: Mở khi mất sóng</div>
            <p>Khi khu vực mất điện hoặc mất sóng 4G/5G, mở biểu tượng ứng dụng đã lưu trên màn hình điện thoại.</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 space-y-1.5">
            <div className="font-bold text-amber-400">Bước 3: Sử dụng tức thì</div>
            <p>Hệ thống tự động tải dữ liệu y tế, danh bạ cấp cứu và số điện thoại người đứng đầu từ bộ nhớ cục bộ thiết bị.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
