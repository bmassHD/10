import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Shield,
  Phone,
  Mail,
  MapPin,
  Lock,
  Unlock,
  Trash2,
  Eye,
  RefreshCw,
  X,
  FileText,
  Briefcase,
  Hospital,
  Pill,
  GraduationCap,
  Building,
} from 'lucide-react';
import { UserProfile, SystemSettings } from '../../types';
import {
  createOrganizationAccountManually,
  batchImportOrganizationAccounts,
  downloadOrganizationImportTemplateExcel,
  exportOrganizationsToExcel,
  updateUserProfile,
  deleteUserAccount,
  logAuditEvent,
} from '../../services/firebaseService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import * as XLSX from 'xlsx';

interface OrganizationAccountsManagerProps {
  settings: SystemSettings;
}

export const OrganizationAccountsManager: React.FC<OrganizationAccountsManagerProps> = () => {
  const { showToast } = useToast();
  const { currentUser, userProfile } = useAuth();

  const [organizations, setOrganizations] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Manual Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [addForm, setAddForm] = useState({
    organizationName: '',
    email: '',
    password: '',
    organizationType: 'enterprise' as 'clinic' | 'pharmacy' | 'school' | 'enterprise' | 'agency' | 'other',
    taxCode: '',
    businessLicenseNumber: '',
    licenseIssueDate: '',
    licenseIssuer: '',
    legalRepresentative: '',
    representativeCitizenId: '',
    operatingField: '',
    organizationAddress: '',
    organizationPhone: '',
    organizationEmail: '',
    notes: '',
  });

  // Detail Modal
  const [viewingOrg, setViewingOrg] = useState<UserProfile | null>(null);

  // Delete Confirmation Modal
  const [deletingOrg, setDeletingOrg] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  // Import Modal & State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Real-time listener for organization accounts
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'), where('accountType', '==', 'organization'));
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const list: UserProfile[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data() as UserProfile);
        });
        setOrganizations(list);
        setLoading(false);
      },
      err => {
        console.error('Error fetching organization accounts:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filtered list
  const filteredOrgs = useMemo(() => {
    return organizations.filter(org => {
      if (selectedTypeFilter !== 'all' && org.organizationType !== selectedTypeFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'all') {
        if (selectedStatusFilter === 'active' && org.status !== 'active') return false;
        if (selectedStatusFilter === 'banned' && org.status !== 'banned') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (org.organizationName || org.displayName || '').toLowerCase().includes(q);
        const matchEmail = (org.email || '').toLowerCase().includes(q);
        const matchTax = (org.taxCode || '').toLowerCase().includes(q);
        const matchLic = (org.businessLicenseNumber || '').toLowerCase().includes(q);
        const matchRep = (org.legalRepresentative || '').toLowerCase().includes(q);
        const matchPhone = (org.organizationPhone || org.phoneNumber || '').includes(q);
        return matchName || matchEmail || matchTax || matchLic || matchRep || matchPhone;
      }
      return true;
    });
  }, [organizations, selectedTypeFilter, selectedStatusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = organizations.length;
    const clinics = organizations.filter(o => o.organizationType === 'clinic').length;
    const pharmacies = organizations.filter(o => o.organizationType === 'pharmacy').length;
    const schools = organizations.filter(o => o.organizationType === 'school').length;
    const enterprises = organizations.filter(o => o.organizationType === 'enterprise').length;
    const active = organizations.filter(o => o.status === 'active').length;
    const banned = organizations.filter(o => o.status === 'banned').length;
    return { total, clinics, pharmacies, schools, enterprises, active, banned };
  }, [organizations]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.organizationName.trim()) {
      showToast('error', 'Vui lòng nhập tên Tổ chức / Doanh nghiệp');
      return;
    }
    if (!addForm.email.trim()) {
      showToast('error', 'Vui lòng nhập Email tài khoản đăng nhập');
      return;
    }

    setCreatingOrg(true);
    try {
      const created = await createOrganizationAccountManually({
        ...addForm,
        displayName: addForm.organizationName.trim(),
        organizationEmail: addForm.organizationEmail.trim() || addForm.email.trim(),
      });

      await logAuditEvent(
        'CREATE_ORGANIZATION_ACCOUNT',
        'Tài khoản Doanh nghiệp',
        `Cấp tài khoản thủ công cho tổ chức: ${created.organizationName} (${created.email})`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast('success', 'Đã cấp tài khoản tổ chức thành công!', `Email: ${created.email}`);
      setShowAddModal(false);
      setAddForm({
        organizationName: '',
        email: '',
        password: '',
        organizationType: 'enterprise',
        taxCode: '',
        businessLicenseNumber: '',
        licenseIssueDate: '',
        licenseIssuer: '',
        legalRepresentative: '',
        representativeCitizenId: '',
        operatingField: '',
        organizationAddress: '',
        organizationPhone: '',
        organizationEmail: '',
        notes: '',
      });
    } catch (err: any) {
      showToast('error', 'Không thể tạo tài khoản', err?.message);
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        if (!data || data.length === 0) {
          showToast('error', 'Tệp Excel không có dữ liệu để import');
          return;
        }

        setImporting(true);
        setImportResult(null);
        setShowImportModal(true);

        const result = await batchImportOrganizationAccounts(data, (curr, tot) => {
          setImportProgress({ current: curr, total: tot });
        });

        setImportResult(result);
        if (result.successCount > 0) {
          showToast('success', `Đã import thành công ${result.successCount} tài khoản tổ chức!`);
        }
        if (result.failedCount > 0) {
          showToast('warning', `Có ${result.failedCount} dòng import thất bại hoặc lỗi định dạng`);
        }

        await logAuditEvent(
          'IMPORT_ORGANIZATIONS_EXCEL',
          'Tài khoản Doanh nghiệp',
          `Import Excel: Thành công ${result.successCount}/${result.total}, Thất bại: ${result.failedCount}`,
          {
            uid: currentUser?.uid || 'admin',
            name: userProfile?.displayName || 'Admin',
          }
        );
      } catch (err: any) {
        showToast('error', 'Lỗi xử lý tệp Excel', err?.message);
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleToggleBan = async (org: UserProfile) => {
    const isBanning = org.status !== 'banned';
    try {
      await updateUserProfile(org.uid, {
        status: isBanning ? 'banned' : 'active',
        banReason: isBanning ? 'Tạm ngưng hoạt động bởi Ban Quản trị' : undefined,
      });

      await logAuditEvent(
        isBanning ? 'BAN_ORGANIZATION_ACCOUNT' : 'UNBAN_ORGANIZATION_ACCOUNT',
        'Tài khoản Doanh nghiệp',
        `${isBanning ? 'Khóa' : 'Mở khóa'} tài khoản tổ chức: ${org.organizationName} (${org.email})`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast('success', `${isBanning ? 'Đã tạm khóa' : 'Đã mở khóa'} tài khoản: ${org.organizationName || org.email}`);
    } catch (err: any) {
      showToast('error', 'Thao tác thất bại', err?.message);
    }
  };

  const handleDelete = (org: UserProfile) => {
    setDeletingOrg(org);
    setDeleteConfirmText('');
  };

  const confirmDeleteOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingOrg) return;
    const expectedName = (deletingOrg.organizationName || deletingOrg.displayName || '').trim();
    if (deleteConfirmText.trim() !== expectedName) {
      showToast('info', 'Tên xác nhận chưa khớp, vui lòng nhập chính xác tên tổ chức');
      return;
    }

    setIsDeletingOrg(true);
    try {
      await deleteUserAccount(deletingOrg.uid);
      await logAuditEvent(
        'DELETE_ORGANIZATION_ACCOUNT',
        'Tài khoản Doanh nghiệp',
        `Đã xóa tài khoản tổ chức: ${deletingOrg.organizationName || deletingOrg.displayName} (${deletingOrg.email})`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', `Đã xóa tài khoản ${deletingOrg.organizationName || deletingOrg.displayName}`);
      setDeletingOrg(null);
      setDeleteConfirmText('');
    } catch (err: any) {
      showToast('error', 'Không thể xóa tài khoản', err?.message);
    } finally {
      setIsDeletingOrg(false);
    }
  };

  const getOrgTypeBadge = (type?: string) => {
    switch (type) {
      case 'clinic':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50">
            <Hospital className="w-3 h-3" /> Phòng khám
          </span>
        );
      case 'pharmacy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50">
            <Pill className="w-3 h-3" /> Nhà thuốc
          </span>
        );
      case 'school':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50">
            <GraduationCap className="w-3 h-3" /> Trường học
          </span>
        );
      case 'agency':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50">
            <Building className="w-3 h-3" /> Cơ quan
          </span>
        );
      case 'other':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Khác
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50">
            <Briefcase className="w-3 h-3" /> Doanh nghiệp
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-linear-to-br from-slate-900 via-teal-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-500/30">
              <Building2 className="w-3.5 h-3.5" />
              <span>Danh Sách Cấp Thủ Công</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Tài Khoản Doanh Nghiệp &amp; Tổ Chức Địa Bàn
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Quản lý tài khoản cấp cho các phòng khám tư nhân, nhà thuốc GPP, trường học, công ty và cơ quan trên địa bàn trạm y tế phụ trách. Hỗ trợ import hàng loạt, xuất file Excel và theo dõi mã số thuế, giấy phép hoạt động.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={downloadOrganizationImportTemplateExcel}
              className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
              title="Tải file mẫu Excel có cột chuẩn"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Mẫu Import</span>
            </button>

            <label className="px-3.5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-md">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Excel</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => exportOrganizationsToExcel(filteredOrgs)}
              disabled={filteredOrgs.length === 0}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel ({filteredOrgs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold transition inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Thủ Công</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tổng Tổ chức / DN</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums font-mono">
            {stats.total}
          </div>
          <span className="text-[11px] text-emerald-600 font-bold">● {stats.active} hoạt động</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Phòng khám &amp; Nhà thuốc</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums font-mono">
            {stats.clinics + stats.pharmacies}
          </div>
          <span className="text-[11px] text-slate-400">
            {stats.clinics} phòng khám · {stats.pharmacies} nhà thuốc
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Doanh nghiệp &amp; Trường học</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums font-mono">
            {stats.enterprises + stats.schools}
          </div>
          <span className="text-[11px] text-slate-400">
            {stats.enterprises} DN · {stats.schools} trường học
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đã tạm ngưng / Khóa</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums font-mono">
            {stats.banned}
          </div>
          <span className="text-[11px] text-slate-400">Cần liên hệ cập nhật GP</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Tên tổ chức, MST, Số GP, Email, Người đại diện..."
            className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedTypeFilter}
            onChange={e => setSelectedTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">Tất cả loại hình</option>
            <option value="clinic">Phòng khám</option>
            <option value="pharmacy">Nhà thuốc GPP</option>
            <option value="school">Trường học</option>
            <option value="enterprise">Doanh nghiệp / Công ty</option>
            <option value="agency">Cơ quan hành chính</option>
            <option value="other">Khác</option>
          </select>

          <select
            value={selectedStatusFilter}
            onChange={e => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="banned">Tạm khóa</option>
          </select>

          {(searchQuery || selectedTypeFilter !== 'all' || selectedStatusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTypeFilter('all');
                setSelectedStatusFilter('all');
              }}
              className="px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition cursor-pointer"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Organizations Table */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-600" />
            <p className="text-xs">Đang tải danh sách tài khoản Doanh nghiệp &amp; Tổ chức...</p>
          </div>
        ) : filteredOrgs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Building2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <div className="space-y-1">
              <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                Chưa có tài khoản Doanh nghiệp / Tổ chức nào
              </p>
              <p className="text-xs text-slate-400">
                Nhấn &quot;Thêm Thủ Công&quot; hoặc &quot;Import Excel&quot; để cấp tài khoản cho các đơn vị trên địa bàn.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Tổ chức / Doanh nghiệp</th>
                  <th className="py-3 px-4">Loại hình</th>
                  <th className="py-3 px-4">Mã số thuế</th>
                  <th className="py-3 px-4">Giấy phép &amp; Đại diện</th>
                  <th className="py-3 px-4">Liên hệ</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredOrgs.map(org => {
                  const isBanned = org.status === 'banned';
                  return (
                    <tr
                      key={org.uid}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                            {org.organizationName || org.displayName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            {org.email}
                          </span>
                          {org.organizationAddress && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              {org.organizationAddress}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getOrgTypeBadge(org.organizationType)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                        {org.taxCode || '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-[200px]">
                          {org.businessLicenseNumber ? (
                            <span className="font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400 block truncate">
                              GP: {org.businessLicenseNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] block">—</span>
                          )}
                          {org.legalRepresentative && (
                            <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate">
                              ĐD: {org.legalRepresentative}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          {org.organizationPhone || org.phoneNumber ? (
                            <a
                              href={`tel:${org.organizationPhone || org.phoneNumber}`}
                              className="font-mono font-bold text-slate-700 dark:text-slate-200 hover:text-teal-600 block tabular-nums"
                            >
                              {org.organizationPhone || org.phoneNumber}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            Tạm khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Hoạt động
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setViewingOrg(org)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            title="Xem chi tiết tài khoản"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleBan(org)}
                            className={`p-1.5 rounded-xl border transition cursor-pointer ${
                              isBanned
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={isBanned ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}
                          >
                            {isBanned ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(org)}
                            className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300 transition cursor-pointer"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add Manual Account */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Cấp Mới Tài Khoản Doanh Nghiệp / Tổ Chức
                  </h3>
                  <p className="text-xs text-slate-500">
                    Khởi tạo tài khoản đăng nhập và hồ sơ pháp lý cơ sở trên địa bàn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên Tổ chức / Doanh nghiệp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.organizationName}
                    onChange={e => setAddForm(prev => ({ ...prev, organizationName: e.target.value }))}
                    placeholder="Vd: Phòng khám Đa khoa Sài Gòn, Nhà thuốc GPP An Tâm..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Email đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addForm.email}
                    onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email.tochuc@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mật khẩu ban đầu (ít nhất 6 ký tự)
                  </label>
                  <input
                    type="text"
                    value={addForm.password}
                    onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Mặc định: TYT@DoanhNghiep2026"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Loại hình cơ sở
                  </label>
                  <select
                    value={addForm.organizationType}
                    onChange={e =>
                      setAddForm(prev => ({ ...prev, organizationType: e.target.value as any }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="clinic">Phòng khám tư nhân</option>
                    <option value="pharmacy">Nhà thuốc GPP</option>
                    <option value="school">Trường học</option>
                    <option value="enterprise">Doanh nghiệp / Công ty</option>
                    <option value="agency">Cơ quan hành chính</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mã số thuế (MST)
                  </label>
                  <input
                    type="text"
                    value={addForm.taxCode}
                    onChange={e => setAddForm(prev => ({ ...prev, taxCode: e.target.value }))}
                    placeholder="Mã số thuế doanh nghiệp..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Số Giấy phép Hoạt động / ĐKKD
                  </label>
                  <input
                    type="text"
                    value={addForm.businessLicenseNumber}
                    onChange={e => setAddForm(prev => ({ ...prev, businessLicenseNumber: e.target.value }))}
                    placeholder="Vd: 08942/SYT-GPHĐ..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Ngày cấp &amp; Nơi cấp GP
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={addForm.licenseIssueDate}
                      onChange={e => setAddForm(prev => ({ ...prev, licenseIssueDate: e.target.value }))}
                      className="w-full px-2.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                    <input
                      type="text"
                      value={addForm.licenseIssuer}
                      onChange={e => setAddForm(prev => ({ ...prev, licenseIssuer: e.target.value }))}
                      placeholder="Sở Y tế / Sở KH&ĐT"
                      className="w-full px-2.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Người đại diện pháp luật
                  </label>
                  <input
                    type="text"
                    value={addForm.legalRepresentative}
                    onChange={e => setAddForm(prev => ({ ...prev, legalRepresentative: e.target.value }))}
                    placeholder="Họ và tên người đại diện..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    CCCD Người đại diện
                  </label>
                  <input
                    type="text"
                    value={addForm.representativeCitizenId}
                    onChange={e => setAddForm(prev => ({ ...prev, representativeCitizenId: e.target.value }))}
                    placeholder="Số thẻ CCCD/ĐDPL (12 số)..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="tel"
                    value={addForm.organizationPhone}
                    onChange={e => setAddForm(prev => ({ ...prev, organizationPhone: e.target.value }))}
                    placeholder="028... hoặc 09..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Lĩnh vực hoạt động
                  </label>
                  <input
                    type="text"
                    value={addForm.operatingField}
                    onChange={e => setAddForm(prev => ({ ...prev, operatingField: e.target.value }))}
                    placeholder="Khám chữa bệnh, dược phẩm, giáo dục..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Địa chỉ cơ sở / Trụ sở tại địa bàn
                  </label>
                  <input
                    type="text"
                    value={addForm.organizationAddress}
                    onChange={e => setAddForm(prev => ({ ...prev, organizationAddress: e.target.value }))}
                    placeholder="Số nhà, tên đường, khu phố/ấp..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Ghi chú nội bộ
                  </label>
                  <input
                    type="text"
                    value={addForm.notes}
                    onChange={e => setAddForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Ghi chú phối hợp y tế, điểm liên kết..."
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={creatingOrg}
                  className="px-6 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition cursor-pointer shadow-md disabled:opacity-50"
                >
                  {creatingOrg ? 'Đang khởi tạo...' : 'Xác Nhận Cấp Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details */}
      {viewingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 block">
                  Chi Tiết Hồ Sơ Tổ Chức
                </span>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {viewingOrg.organizationName || viewingOrg.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrg(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <span className="text-slate-400 block text-[11px]">Email đăng nhập</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {viewingOrg.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Loại hình</span>
                  <div className="mt-0.5">{getOrgTypeBadge(viewingOrg.organizationType)}</div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mã số thuế (MST)</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {viewingOrg.taxCode || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Số Giấy phép / ĐKKD</span>
                  <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                    {viewingOrg.businessLicenseNumber || '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[11px]">Người đại diện pháp luật</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {viewingOrg.legalRepresentative || '—'}{' '}
                    {viewingOrg.representativeCitizenId ? `(CCCD: ${viewingOrg.representativeCitizenId})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Lĩnh vực hoạt động</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {viewingOrg.operatingField || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Địa chỉ cơ sở tại địa bàn</span>
                  <span className="text-slate-700 dark:text-slate-200">
                    {viewingOrg.organizationAddress || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Điện thoại liên hệ</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {viewingOrg.organizationPhone || viewingOrg.phoneNumber || '—'}
                  </span>
                </div>
                {viewingOrg.notes && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Ghi chú nội bộ</span>
                    <span className="text-slate-500 italic">{viewingOrg.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingOrg(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Progress & Result */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Tiến Trình Import Excel Doanh Nghiệp
              </h3>
              {!importing && (
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {importing ? (
                <div className="text-center py-6 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600" />
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-white">
                      Đang khởi tạo tài khoản và ghi nhận hồ sơ...
                    </p>
                    {importProgress && (
                      <p className="text-xs font-mono text-slate-500">
                        Đã xử lý {importProgress.current} / {importProgress.total} dòng
                      </p>
                    )}
                  </div>
                </div>
              ) : importResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200">
                      <span className="text-2xl font-black font-mono block">
                        {importResult.successCount}
                      </span>
                      <span className="text-xs font-bold">Tạo thành công</span>
                    </div>
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200">
                      <span className="text-2xl font-black font-mono block">
                        {importResult.failedCount}
                      </span>
                      <span className="text-xs font-bold">Lỗi / Trùng lặp</span>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs">
                      <span className="font-bold text-rose-600 block">Chi tiết lỗi:</span>
                      {importResult.errors.map((err: any, idx: number) => (
                        <div key={idx} className="text-[11px] text-slate-600 dark:text-slate-300">
                          <strong>Dòng {err.row}:</strong> {err.name} ({err.email}) —{' '}
                          <span className="text-rose-500">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {!importing && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Hoàn Tất
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Delete Organization Account Confirmation */}
      {deletingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Xác Nhận Xóa Tài Khoản Tổ Chức
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeletingOrg(null)}
                disabled={isDeletingOrg}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={confirmDeleteOrg} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Hành động này sẽ xóa hồ sơ tài khoản tổ chức{' '}
                <strong className="text-slate-900 dark:text-white">
                  {deletingOrg.organizationName || deletingOrg.displayName}
                </strong>{' '}
                (<span className="font-mono">{deletingOrg.email}</span>) khỏi hệ thống.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Nhập chính xác tên tổ chức để xác nhận:
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deletingOrg.organizationName || deletingOrg.displayName || ''}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingOrg(null)}
                  disabled={isDeletingOrg}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    isDeletingOrg ||
                    deleteConfirmText.trim() !==
                      (deletingOrg.organizationName || deletingOrg.displayName || '').trim()
                  }
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  {isDeletingOrg ? 'Đang xóa...' : 'Xóa Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
