import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  LayoutGrid,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  RefreshCw,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Sparkles,
  Image as ImageIcon,
  Save,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
} from 'lucide-react';
import { PortalAppItem, SystemSettings } from '../../types';
import {
  updateSystemSettings,
  logAuditEvent,
  cleanDataForFirestore,
  DEFAULT_PORTAL_APP_CATEGORIES,
  resolvePortalAppCategories,
} from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface AppsManagerProps {
  settings: SystemSettings;
}

function normalizeHttpUrl(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

interface ParsedAppImportRow {
  rowIndex: number;
  name: string;
  url: string;
  category: string;
  logoUrl: string;
  isActive: boolean;
  isDuplicate: boolean;
  error?: string;
}

function normalizeUrlCompareKey(rawUrl: string): string {
  const normalized = normalizeHttpUrl(rawUrl);
  try {
    const parsed = new URL(normalized);
    return `${parsed.hostname.replace(/^www\./i, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '').toLowerCase()}${parsed.search}`;
  } catch {
    return normalized.toLowerCase().replace(/\/+$/, '');
  }
}

function deriveAppNameFromUrl(rawUrl: string): string {
  try {
    const host = new URL(normalizeHttpUrl(rawUrl)).hostname.replace(/^www\./i, '');
    const core = host.split('.')[0] || host;
    return core.charAt(0).toUpperCase() + core.slice(1);
  } catch {
    return '';
  }
}

function parseBoolFlag(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return true;
  if (['0', 'false', 'no', 'n', 'ẩn', 'an', 'tạm ẩn', 'tam an', 'off', 'hidden'].includes(s)) {
    return false;
  }
  return true;
}

function findColumnValue(record: Record<string, unknown>, aliases: string[]): string {
  const keys = Object.keys(record);
  for (const alias of aliases) {
    const normAlias = alias.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]/gi, '');
    const foundKey = keys.find(
      k => k.toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]/gi, '') === normAlias
    );
    if (foundKey && record[foundKey] !== undefined && record[foundKey] !== null) {
      const text = String(record[foundKey]).trim();
      if (text) return text;
    }
  }
  return '';
}

export const AppsManager: React.FC<AppsManagerProps> = ({ settings }) => {
  const { currentUser, userProfile } = useAuth();
  const { showToast, showConfirm } = useToast();

  const [apps, setApps] = useState<PortalAppItem[]>(() =>
    Array.isArray(settings.portalApps) ? settings.portalApps : []
  );
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    Array.isArray(settings.portalAppCategories) ? settings.portalAppCategories : []
  );
  const [newCategoryInput, setNewCategoryInput] = useState('');

  useEffect(() => {
    setApps(Array.isArray(settings.portalApps) ? settings.portalApps : []);
  }, [settings.portalApps]);

  useEffect(() => {
    setCustomCategories(Array.isArray(settings.portalAppCategories) ? settings.portalAppCategories : []);
  }, [settings.portalAppCategories]);

  const allCategoryOptions = resolvePortalAppCategories({
    portalApps: apps,
    portalAppCategories: customCategories,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_PORTAL_APP_CATEGORIES[0]);
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [logoCandidates, setLogoCandidates] = useState<string[]>([]);
  const [previewImgError, setPreviewImgError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Import state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'paste'>('file');
  const [importPasteText, setImportPasteText] = useState('');
  const [importRows, setImportRows] = useState<ParsedAppImportRow[]>([]);
  const [importSkipDuplicates, setImportSkipDuplicates] = useState(true);
  const [importFetchingLogos, setImportFetchingLogos] = useState(false);
  const [importLogoProgress, setImportLogoProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [importingSaving, setImportingSaving] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const lastFetchedUrlRef = useRef<string>('');
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setPreviewImgError(false);
  }, [logoUrl]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setUrl('');
    setLogoUrl('');
    setCategory(DEFAULT_PORTAL_APP_CATEGORIES[0]);
    setIsCustomCategoryMode(false);
    setIsActive(true);
    setLogoCandidates([]);
    setPreviewImgError(false);
    lastFetchedUrlRef.current = '';
  };

  const openAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (app: PortalAppItem) => {
    const resolvedCat = (app.category || '').trim() || 'Khác';
    setEditingId(app.id);
    setName(app.name || '');
    setUrl(app.url || '');
    setLogoUrl(app.logoUrl || '');
    setCategory(resolvedCat);
    setIsCustomCategoryMode(!allCategoryOptions.includes(resolvedCat));
    setIsActive(app.isActive !== false);
    setLogoCandidates(app.logoUrl ? [app.logoUrl] : []);
    setPreviewImgError(false);
    lastFetchedUrlRef.current = app.url || '';
    setIsFormOpen(true);
  };

  const persistCategories = async (nextCats: string[], toastMsg?: string) => {
    setSaving(true);
    try {
      const cleaned = Array.from(
        new Set(
          nextCats
            .map(c => c.trim())
            .filter(c => c && !DEFAULT_PORTAL_APP_CATEGORIES.includes(c))
        )
      );
      await updateSystemSettings({
        portalAppCategories: cleaned,
        updatedAt: new Date().toISOString(),
      });
      setCustomCategories(cleaned);
      if (toastMsg) showToast('success', toastMsg);
    } catch (err: any) {
      showToast('error', 'Không thể lưu danh mục ứng dụng', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomCategory = async () => {
    const cleanCat = newCategoryInput.trim();
    if (!cleanCat) return;
    if (allCategoryOptions.some(c => c.toLowerCase() === cleanCat.toLowerCase())) {
      showToast('info', `Danh mục "${cleanCat}" đã tồn tại`);
      setNewCategoryInput('');
      return;
    }
    await persistCategories([...customCategories, cleanCat], `Đã thêm danh mục "${cleanCat}"`);
    setNewCategoryInput('');
  };

  const handleDeleteCustomCategory = (catName: string) => {
    showConfirm({
      title: `Xóa danh mục "${catName}"?`,
      message: 'Các ứng dụng đang dùng danh mục này vẫn giữ nguyên hoặc có thể chuyển sang danh mục khác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        await persistCategories(
          customCategories.filter(c => c !== catName),
          `Đã xóa danh mục "${catName}"`
        );
      },
    });
  };

  const fetchMetadataFromUrl = async (targetRawUrl: string, force = false) => {
    const normalized = normalizeHttpUrl(targetRawUrl);
    if (!normalized) return;

    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname || !parsed.hostname.includes('.')) return;
    } catch {
      return;
    }

    if (!force && lastFetchedUrlRef.current === normalized) return;
    lastFetchedUrlRef.current = normalized;

    setFetchingMeta(true);
    try {
      const res = await fetch('/api/app-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (force) {
          showToast('warning', 'Không lấy được HTML', data?.error || 'Bạn có thể dán URL logo thủ công.');
        }
        return;
      }

      const nextCandidates: string[] = Array.isArray(data.candidates) ? data.candidates : [];
      setLogoCandidates(nextCandidates);

      if (data.logoUrl) {
        setLogoUrl(String(data.logoUrl));
      }
      if (data.name) {
        setName(prev => (prev.trim() ? prev : String(data.name)));
      }
      if (data.extractedFromHtml) {
        showToast('success', 'Đã tự động lấy logo từ HTML', data.name ? `Gợi ý tên: ${data.name}` : undefined);
      } else if (force) {
        showToast('info', 'Đã dùng biểu tượng favicon mặc định', 'Trang đích chặn đọc HTML trực tiếp.');
      }
    } catch {
      if (force) {
        showToast('warning', 'Lỗi kết nối máy chủ lấy logo');
      }
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleUrlChange = (nextVal: string) => {
    setUrl(nextVal);
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    const trimmed = nextVal.trim();
    if (/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(trimmed) || /^[^/\s]+\.[^/\s]{2,}/i.test(trimmed)) {
      debounceTimerRef.current = window.setTimeout(() => {
        void fetchMetadataFromUrl(trimmed, false);
      }, 650);
    }
  };

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')?.trim();
    if (!pasted) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    window.setTimeout(() => {
      void fetchMetadataFromUrl(pasted, true);
    }, 50);
  };

  const persistApps = async (
    nextList: PortalAppItem[],
    auditAction: string,
    auditDetails: string,
    extraCategories?: string[]
  ) => {
    setSaving(true);
    try {
      const normalizedList = nextList.map((item, idx) => {
        const { description: _omitDesc, ...rest } = item as PortalAppItem & { description?: string };
        return cleanDataForFirestore({
          ...rest,
          order: idx,
        });
      });
      await updateSystemSettings({
        portalApps: normalizedList,
        ...(extraCategories !== undefined ? { portalAppCategories: extraCategories } : {}),
        updatedAt: new Date().toISOString(),
      });
      setApps(normalizedList);
      if (extraCategories !== undefined) {
        setCustomCategories(extraCategories);
      }
      if (currentUser) {
        await logAuditEvent(
          auditAction,
          'Menu Ứng dụng',
          auditDetails,
          {
            uid: currentUser.uid,
            name: userProfile?.displayName || currentUser.email || 'Admin',
          }
        );
      }
      return true;
    } catch (err: any) {
      showToast('error', 'Không thể lưu cấu hình ứng dụng', err?.message || 'Vui lòng thử lại.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanUrl = normalizeHttpUrl(url);
    const cleanCategory = category.trim() || 'Khác';
    if (!cleanName) {
      showToast('warning', 'Vui lòng nhập Tên ứng dụng');
      return;
    }
    if (!cleanUrl) {
      showToast('warning', 'Vui lòng nhập Link truy cập hợp lệ');
      return;
    }
    try {
      new URL(cleanUrl);
    } catch {
      showToast('warning', 'Link truy cập không đúng định dạng URL');
      return;
    }

    const nextExtraCats =
      !DEFAULT_PORTAL_APP_CATEGORIES.includes(cleanCategory) && !customCategories.includes(cleanCategory)
        ? [...customCategories, cleanCategory]
        : undefined;

    const now = new Date().toISOString();
    let nextList: PortalAppItem[];
    if (editingId) {
      nextList = apps.map(item =>
        item.id === editingId
          ? {
              ...item,
              name: cleanName,
              url: cleanUrl,
              logoUrl: logoUrl.trim(),
              category: cleanCategory,
              isActive,
              updatedAt: now,
            }
          : item
      );
    } else {
      const newItem: PortalAppItem = {
        id: `app_${Date.now()}`,
        name: cleanName,
        url: cleanUrl,
        logoUrl: logoUrl.trim(),
        category: cleanCategory,
        isActive,
        order: apps.length,
        createdAt: now,
        updatedAt: now,
      };
      nextList = [...apps, newItem];
    }

    const ok = await persistApps(
      nextList,
      editingId ? 'UPDATE_PORTAL_APP' : 'CREATE_PORTAL_APP',
      `${editingId ? 'Cập nhật' : 'Thêm'} ứng dụng "${cleanName}" (${cleanUrl})`,
      nextExtraCats
    );
    if (ok) {
      showToast('success', editingId ? 'Đã cập nhật ứng dụng' : 'Đã thêm ứng dụng mới');
      setIsFormOpen(false);
      resetForm();
    }
  };

  const handleDeleteApp = (app: PortalAppItem) => {
    showConfirm({
      title: 'Xóa ứng dụng khỏi menu?',
      message: `Ứng dụng "${app.name}" sẽ bị xóa khỏi tab Ứng dụng.`,
      confirmText: 'Xóa ứng dụng',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        const nextList = apps.filter(item => item.id !== app.id);
        const ok = await persistApps(nextList, 'DELETE_PORTAL_APP', `Xóa ứng dụng "${app.name}"`);
        if (ok) {
          showToast('success', 'Đã xóa ứng dụng');
        }
      },
    });
  };

  const handleToggleActive = async (app: PortalAppItem) => {
    const nextActive = app.isActive === false;
    const nextList = apps.map(item =>
      item.id === app.id ? { ...item, isActive: nextActive, updatedAt: new Date().toISOString() } : item
    );
    const ok = await persistApps(
      nextList,
      'TOGGLE_PORTAL_APP',
      `${nextActive ? 'Hiện' : 'Ẩn'} ứng dụng "${app.name}"`
    );
    if (ok) {
      showToast('info', nextActive ? `Đã hiển thị "${app.name}"` : `Đã tạm ẩn "${app.name}"`);
    }
  };

  const handleMoveOrder = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= apps.length) return;
    const nextList = [...apps];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIdx, 0, moved);
    await persistApps(nextList, 'REORDER_PORTAL_APPS', `Sắp xếp vị trí ứng dụng "${moved.name}"`);
  };

  // --- App Import / Template / Export Helpers ---
  const buildValidatedImportRows = (
    rawItems: Array<{ name?: string; url?: string; category?: string; logoUrl?: string; isActive?: unknown }>
  ): ParsedAppImportRow[] => {
    const existingUrlSet = new Set(apps.map(a => normalizeUrlCompareKey(a.url)));
    const existingNameSet = new Set(apps.map(a => a.name.trim().toLowerCase()));
    const seenUrlsInBatch = new Set<string>();

    return rawItems.map((raw, idx) => {
      const cleanUrl = normalizeHttpUrl(raw.url || '');
      let urlValid = false;
      try {
        if (cleanUrl) {
          const parsed = new URL(cleanUrl);
          urlValid = Boolean(parsed.hostname && parsed.hostname.includes('.'));
        }
      } catch {
        urlValid = false;
      }

      const rawName = (raw.name || '').trim();
      const resolvedName = rawName || (urlValid ? deriveAppNameFromUrl(cleanUrl) : '');
      const cleanCategory = (raw.category || '').trim() || 'Khác';
      const cleanLogo = (raw.logoUrl || '').trim();
      const isActiveFlag = parseBoolFlag(raw.isActive);

      let error: string | undefined;
      if (!cleanUrl || !urlValid) {
        error = 'Link truy cập không hợp lệ';
      } else if (!resolvedName) {
        error = 'Thiếu tên ứng dụng';
      }

      const urlKey = urlValid ? normalizeUrlCompareKey(cleanUrl) : '';
      const isDuplicate =
        !error &&
        (existingUrlSet.has(urlKey) ||
          existingNameSet.has(resolvedName.toLowerCase()) ||
          seenUrlsInBatch.has(urlKey));
      if (urlKey && !error) {
        seenUrlsInBatch.add(urlKey);
      }

      return {
        rowIndex: idx + 1,
        name: resolvedName,
        url: cleanUrl,
        category: cleanCategory,
        logoUrl: cleanLogo,
        isActive: isActiveFlag,
        isDuplicate,
        error,
      };
    });
  };

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'Tên ứng dụng': 'VNeID Định danh điện tử',
        'Link truy cập': 'https://vneid.gov.vn',
        'Danh mục': 'Dịch vụ công',
        'Logo URL': '',
        'Hiển thị': 'Có',
      },
      {
        'Tên ứng dụng': 'Bảo hiểm Xã hội Việt Nam (VssID)',
        'Link truy cập': 'https://baohiemxahoi.gov.vn',
        'Danh mục': 'Y tế',
        'Logo URL': '',
        'Hiển thị': 'Có',
      },
      {
        'Tên ứng dụng': 'Cổng Dịch vụ công Quốc gia',
        'Link truy cập': 'https://dichvucong.gov.vn',
        'Danh mục': 'Dịch vụ công',
        'Logo URL': '',
        'Hiển thị': 'Có',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    ws['!cols'] = [{ wch: 32 }, { wch: 36 }, { wch: 18 }, { wch: 42 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Ung_Dung');
    XLSX.writeFile(wb, 'Mau_Import_Ung_Dung.xlsx');
    showToast('success', 'Đã tải file mẫu Excel', 'Điền danh sách ứng dụng rồi chọn Import để tải lên hàng loạt.');
  };

  const handleExportAppsExcel = () => {
    if (apps.length === 0) {
      showToast('info', 'Chưa có ứng dụng nào để xuất');
      return;
    }
    const exportRows = apps.map(app => ({
      'Tên ứng dụng': app.name,
      'Link truy cập': app.url,
      'Danh mục': app.category || 'Khác',
      'Logo URL': app.logoUrl || '',
      'Hiển thị': app.isActive === false ? 'Ẩn' : 'Có',
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [{ wch: 32 }, { wch: 38 }, { wch: 18 }, { wch: 46 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ung_Dung');
    XLSX.writeFile(wb, `Danh_Sach_Ung_Dung_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('success', `Đã xuất ${apps.length} ứng dụng ra Excel`);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.portalApps)
          ? parsed.portalApps
          : Array.isArray(parsed?.apps)
          ? parsed.apps
          : [];
        if (!Array.isArray(list) || list.length === 0) {
          showToast('warning', 'Tệp JSON không có danh sách ứng dụng hợp lệ');
          return;
        }
        const mapped = list.map((item: any) => ({
          name: String(item?.name || item?.title || ''),
          url: String(item?.url || item?.link || ''),
          category: String(item?.category || ''),
          logoUrl: String(item?.logoUrl || item?.logo || item?.icon || ''),
          isActive: item?.isActive ?? true,
        }));
        setImportRows(buildValidatedImportRows(mapped));
        return;
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });
      if (records.length === 0) {
        showToast('warning', 'Tệp không có dữ liệu', 'Hãy kiểm tra lại bảng tính hoặc tải file mẫu.');
        return;
      }

      const mapped = records.map(rec => ({
        name: findColumnValue(rec, ['Tên ứng dụng', 'Ten ung dung', 'name', 'title', 'ten']),
        url: findColumnValue(rec, ['Link truy cập', 'Link truy cap', 'url', 'link', 'website', 'href']),
        category: findColumnValue(rec, ['Danh mục', 'Danh muc', 'category', 'nhom', 'group']),
        logoUrl: findColumnValue(rec, ['Logo URL', 'logoUrl', 'logo', 'icon', 'hinhanh', 'image']),
        isActive: findColumnValue(rec, ['Hiển thị', 'Hien thi', 'isActive', 'active', 'trangthai']) || true,
      }));
      setImportRows(buildValidatedImportRows(mapped));
    } catch (err: any) {
      showToast('error', 'Không đọc được tệp import', err?.message || 'Vui lòng kiểm tra định dạng Excel/CSV/JSON.');
    }
  };

  const handleParsePastedLines = () => {
    const lines = importPasteText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      showToast('warning', 'Vui lòng dán ít nhất 1 dòng ứng dụng');
      return;
    }

    const parsed = lines.map(line => {
      const parts = line.includes('\t')
        ? line.split('\t').map(p => p.trim())
        : line.includes('|')
        ? line.split('|').map(p => p.trim())
        : line.includes(',') && !/^https?:\/\//i.test(line.split(',')[0].trim())
        ? line.split(',').map(p => p.trim())
        : [line];

      if (parts.length === 1) {
        return { name: '', url: parts[0], category: 'Khác', logoUrl: '', isActive: true };
      }
      if (parts.length === 2) {
        const firstIsUrl = /^https?:\/\/|^[^/\s]+\.[^/\s]{2,}/i.test(parts[0]) && !parts[0].includes(' ');
        return firstIsUrl
          ? { name: parts[1], url: parts[0], category: 'Khác', logoUrl: '', isActive: true }
          : { name: parts[0], url: parts[1], category: 'Khác', logoUrl: '', isActive: true };
      }
      return {
        name: parts[0] || '',
        url: parts[1] || '',
        category: parts[2] || 'Khác',
        logoUrl: parts[3] || '',
        isActive: parts[4] ?? true,
      };
    });

    setImportRows(buildValidatedImportRows(parsed));
  };

  const handleAutoFetchImportLogos = async () => {
    const candidateIndices = importRows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !r.error && (!r.logoUrl || !r.name))
      .map(({ idx }) => idx);

    if (candidateIndices.length === 0) {
      showToast('info', 'Tất cả dòng hợp lệ đã có tên và logo');
      return;
    }

    setImportFetchingLogos(true);
    setImportLogoProgress({ done: 0, total: candidateIndices.length });
    const nextRows = [...importRows];
    let doneCount = 0;

    try {
      for (let i = 0; i < candidateIndices.length; i += 3) {
        const batch = candidateIndices.slice(i, i + 3);
        await Promise.all(
          batch.map(async rowIdx => {
            const target = nextRows[rowIdx];
            try {
              const res = await fetch('/api/app-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: target.url }),
              });
              const data = await res.json().catch(() => null);
              if (res.ok && data?.ok) {
                nextRows[rowIdx] = {
                  ...nextRows[rowIdx],
                  logoUrl: nextRows[rowIdx].logoUrl || (data.logoUrl ? String(data.logoUrl) : ''),
                  name: nextRows[rowIdx].name || (data.name ? String(data.name) : deriveAppNameFromUrl(target.url)),
                };
              }
            } catch {
              // ignore individual lookup errors
            } finally {
              doneCount++;
              setImportLogoProgress({ done: doneCount, total: candidateIndices.length });
            }
          })
        );
        setImportRows([...nextRows]);
      }
      showToast('success', `Đã tự động quét metadata cho ${doneCount} ứng dụng`);
    } finally {
      setImportFetchingLogos(false);
    }
  };

  const readyToImportRows = importRows.filter(
    r => !r.error && (!importSkipDuplicates || !r.isDuplicate)
  );

  const handleConfirmImport = async () => {
    if (readyToImportRows.length === 0) {
      showToast('warning', 'Không có ứng dụng hợp lệ nào để import');
      return;
    }

    setImportingSaving(true);
    try {
      const now = new Date().toISOString();
      const baseTs = Date.now();
      const importedItems: PortalAppItem[] = readyToImportRows.map((row, idx) => ({
        id: `app_${baseTs}_${idx}`,
        name: row.name.trim(),
        url: row.url.trim(),
        logoUrl: row.logoUrl.trim(),
        category: row.category.trim() || 'Khác',
        isActive: row.isActive,
        order: apps.length + idx,
        createdAt: now,
        updatedAt: now,
      }));

      const newCustomCats = Array.from(
        new Set([
          ...customCategories,
          ...importedItems
            .map(i => i.category || 'Khác')
            .filter(c => c && !DEFAULT_PORTAL_APP_CATEGORIES.includes(c)),
        ])
      );

      const ok = await persistApps(
        [...apps, ...importedItems],
        'IMPORT_PORTAL_APPS',
        `Import hàng loạt ${importedItems.length} ứng dụng vào Menu Ứng dụng`,
        newCustomCats
      );
      if (ok) {
        showToast('success', `Đã import thành công ${importedItems.length} ứng dụng`);
        setImportModalOpen(false);
        setImportRows([]);
        setImportPasteText('');
      }
    } finally {
      setImportingSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Quản Lý Menu Ứng Dụng (Kiểu Điện Thoại)
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Cấu hình Tên ứng dụng, Link truy cập, tự động trích xuất Logo hoặc Import hàng loạt từ Excel / JSON / danh sách URL.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Tải file Excel mẫu để điền danh sách ứng dụng"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>File mẫu</span>
          </button>

          {apps.length > 0 && (
            <button
              type="button"
              onClick={handleExportAppsExcel}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Xuất danh sách ứng dụng hiện tại ra Excel"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Xuất Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setImportRows([]);
              setImportModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Import Ứng dụng</span>
          </button>

          <button
            type="button"
            onClick={openAddForm}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold transition inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm ứng dụng</span>
          </button>
        </div>
      </div>

      {/* Category Setup Card (Mặc định: Dịch vụ công, Y tế, Tiện ích, Khác + Thêm tùy thích) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Danh mục ứng dụng (Mặc định &amp; Thêm tùy thích)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              4 danh mục mặc định gồm Dịch vụ công, Y tế, Tiện ích, Khác. Bạn có thể thêm danh mục tùy thích bên dưới.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {allCategoryOptions.map(cat => {
            const isDefault = DEFAULT_PORTAL_APP_CATEGORIES.includes(cat);
            return (
              <span
                key={cat}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                  isDefault
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{cat}</span>
                {!isDefault && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleDeleteCustomCategory(cat)}
                    title={`Xóa danh mục "${cat}"`}
                    className="p-0.5 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            value={newCategoryInput}
            onChange={e => setNewCategoryInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAddCustomCategory();
              }
            }}
            placeholder="Nhập tên danh mục mới tùy thích (VD: Nội bộ trạm, Học tập...)"
            maxLength={50}
            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <button
            type="button"
            disabled={saving || !newCategoryInput.trim()}
            onClick={() => void handleAddCustomCategory()}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm danh mục</span>
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveApp}
          className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {editingId ? 'Chỉnh sửa ứng dụng' : 'Thêm ứng dụng mới'}
            </h4>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Squircle Live Icon Preview */}
            <div className="lg:col-span-3 flex flex-col items-center p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Xem trước biểu tượng
              </span>
              <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden p-2.5">
                {logoUrl && !previewImgError ? (
                  <img
                    src={logoUrl}
                    alt={name || 'Logo xem trước'}
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewImgError(true)}
                    className="w-full h-full object-contain rounded-[14px]"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                )}
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 text-center line-clamp-2 max-w-[130px]">
                {name.trim() || 'Tên ứng dụng'}
              </div>
            </div>

            {/* Form Inputs */}
            <div className="lg:col-span-9 space-y-4">
              {/* Link URL + Auto Extract */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Link truy cập <span className="text-rose-600">*</span>{' '}
                  <span className="font-normal text-slate-500">
                    (Dán link vào sẽ tự động đọc HTML để lấy Logo &amp; gợi ý tên)
                  </span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={e => handleUrlChange(e.target.value)}
                    onPaste={handleUrlPaste}
                    placeholder="https://dichvucong.gov.vn hoặc https://..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    disabled={fetchingMeta || !url.trim()}
                    onClick={() => void fetchMetadataFromUrl(url, true)}
                    className="px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${fetchingMeta ? 'animate-spin' : ''}`} />
                    <span>{fetchingMeta ? 'Đang lấy HTML...' : 'Lấy logo từ HTML'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Tên Ứng dụng <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ví dụ: VNeID, Sổ Sức Khỏe Điện Tử..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Danh mục ứng dụng
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {allCategoryOptions.map(catOption => {
                      const active = !isCustomCategoryMode && category === catOption;
                      return (
                        <button
                          key={catOption}
                          type="button"
                          onClick={() => {
                            setIsCustomCategoryMode(false);
                            setCategory(catOption);
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            active
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                          }`}
                        >
                          {catOption}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomCategoryMode(true);
                        if (allCategoryOptions.includes(category)) {
                          setCategory('');
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition inline-flex items-center gap-1 cursor-pointer ${
                        isCustomCategoryMode
                          ? 'bg-slate-900 dark:bg-emerald-700 text-white border-slate-900 dark:border-emerald-700'
                          : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-dashed border-emerald-400 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm tùy thích</span>
                    </button>
                  </div>

                  {isCustomCategoryMode && (
                    <input
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="Nhập tên danh mục mới tùy thích..."
                      maxLength={50}
                      autoFocus
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  )}
                </div>
              </div>

              {/* Logo URL + Candidates Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Logo ứng dụng (URL ảnh)
                </label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="Tự động điền khi dán link hoặc dán URL ảnh logo..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />

                {logoCandidates.length > 1 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Các logo tìm thấy từ HTML (nhấn để chọn):</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {logoCandidates.map((cand, idx) => {
                        const selected = cand === logoUrl;
                        return (
                          <button
                            key={`${cand}-${idx}`}
                            type="button"
                            onClick={() => setLogoUrl(cand)}
                            className={`p-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                              selected
                                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-emerald-600'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400'
                            }`}
                            title={cand}
                          >
                            <img
                              src={cand}
                              alt={`Logo ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 object-contain rounded-lg bg-white"
                            />
                            {selected && <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600"
                  />
                  <span>Hiển thị công khai trên tab Ứng dụng</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      resetForm();
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Lưu ứng dụng'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* List of configured apps */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Danh sách ứng dụng đã cấu hình ({apps.length})
          </h4>
        </div>

        {apps.length === 0 ? (
          <div className="py-10 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Chưa có ứng dụng nào. Nhấn <strong>&quot;Thêm ứng dụng&quot;</strong> để cấu hình ứng dụng đầu tiên.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {apps.map((app, index) => (
              <div
                key={app.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden p-1.5 shrink-0">
                    {app.logoUrl ? (
                      <img
                        src={app.logoUrl}
                        alt={app.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <LayoutGrid className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {app.name}
                      </span>
                      {app.category && (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          · {app.category}
                        </span>
                      )}
                      {app.isActive === false && (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          · Đang tạm ẩn
                        </span>
                      )}
                    </div>
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 inline-flex items-center gap-1 max-w-full truncate"
                    >
                      <span className="truncate">{app.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    disabled={index === 0 || saving}
                    onClick={() => void handleMoveOrder(index, -1)}
                    title="Di chuyển lên"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === apps.length - 1 || saving}
                    onClick={() => void handleMoveOrder(index, 1)}
                    title="Di chuyển xuống"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleToggleActive(app)}
                    title={app.isActive === false ? 'Hiện ứng dụng' : 'Tạm ẩn ứng dụng'}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {app.isActive === false ? (
                      <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(app)}
                    title="Chỉnh sửa"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-emerald-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDeleteApp(app)}
                    title="Xóa"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Import Apps Modal */}
      {importModalOpen && (
        <div
          className="fixed inset-0 z-[150] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={e => {
            if (e.target === e.currentTarget && !importingSaving && !importFetchingLogos) {
              setImportModalOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    Import Danh Sách Ứng Dụng Hàng Loạt
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Hỗ trợ Excel (.xlsx, .xls), CSV, JSON hoặc dán nhanh danh sách URL
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={importingSaving || importFetchingLogos}
                onClick={() => setImportModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="px-6 py-3 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('file')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    importMode === 'file'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Chọn file Excel / CSV / JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('paste')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer ${
                    importMode === 'paste'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Dán danh sách nhanh</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs font-bold text-blue-700 dark:text-sky-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải file Excel mẫu</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {importMode === 'file' ? (
                <div className="p-5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-center space-y-3">
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.json"
                    onChange={handleImportFileSelected}
                    className="hidden"
                  />
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Chọn tệp Excel (.xlsx, .xls), CSV hoặc JSON chứa danh sách ứng dụng
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Các cột hỗ trợ: <strong>Tên ứng dụng</strong>, <strong>Link truy cập</strong>, <strong>Danh mục</strong>, <strong>Logo URL</strong>, <strong>Hiển thị</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Chọn tệp từ máy tính</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                    Mỗi dòng 1 ứng dụng (định dạng: <code className="font-mono text-emerald-700 dark:text-emerald-400">Tên | Link | Danh mục</code> hoặc chỉ cần dán Link URL):
                  </label>
                  <textarea
                    rows={5}
                    value={importPasteText}
                    onChange={e => setImportPasteText(e.target.value)}
                    placeholder={`VNeID | https://vneid.gov.vn | Dịch vụ công\nSổ Sức Khỏe | https://vneid.gov.vn | Y tế\nhttps://dichvucong.gov.vn`}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParsePastedLines}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Phân tích danh sách</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Parsed Rows */}
              {importRows.length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        Xem trước: {importRows.length} dòng
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold tabular-nums">
                        Sẵn sàng: {readyToImportRows.length}
                      </span>
                      {importRows.some(r => r.isDuplicate) && (
                        <label className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300 cursor-pointer ml-1">
                          <input
                            type="checkbox"
                            checked={importSkipDuplicates}
                            onChange={e => setImportSkipDuplicates(e.target.checked)}
                            className="w-3.5 h-3.5 rounded accent-emerald-600"
                          />
                          <span>Bỏ qua dòng trùng ({importRows.filter(r => r.isDuplicate).length})</span>
                        </label>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={importFetchingLogos}
                      onClick={() => void handleAutoFetchImportLogos()}
                      className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {importFetchingLogos ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            Đang lấy Logo HTML ({importLogoProgress.done}/{importLogoProgress.total})...
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Tự động lấy Logo &amp; Tên từ HTML</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Logo</th>
                          <th className="py-2.5 px-3">Tên ứng dụng &amp; Link</th>
                          <th className="py-2.5 px-3">Danh mục</th>
                          <th className="py-2.5 px-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {importRows.map(row => (
                          <tr
                            key={row.rowIndex}
                            className={
                              row.error
                                ? 'bg-rose-50/50 dark:bg-rose-950/20'
                                : row.isDuplicate
                                ? 'bg-amber-50/50 dark:bg-amber-950/20'
                                : ''
                            }
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-500">{row.rowIndex}</td>
                            <td className="py-2.5 px-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden p-1">
                                {row.logoUrl ? (
                                  <img
                                    src={row.logoUrl}
                                    alt={row.name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain rounded"
                                  />
                                ) : (
                                  <LayoutGrid className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 max-w-[280px]">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                {row.name || '—'}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {row.url || '—'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                                {row.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {row.error ? (
                                <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{row.error}</span>
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{importSkipDuplicates ? 'Trùng (bỏ qua)' : 'Trùng (vẫn thêm)'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>{row.isActive ? 'Hợp lệ · Hiện' : 'Hợp lệ · Ẩn'}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Danh mục mới trong file import sẽ tự động được thêm vào bộ lọc ứng dụng.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={importingSaving || importFetchingLogos}
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={importingSaving || importFetchingLogos || readyToImportRows.length === 0}
                  onClick={() => void handleConfirmImport()}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {importingSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Import {readyToImportRows.length} ứng dụng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
