import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  Trash2,
  Calendar,
  Building,
  ExternalLink,
  Inbox,
  Download,
  Upload,
  Sparkles,
  Eye,
  X,
  CheckCircle2,
  FileSpreadsheet,
  FileType,
  Lock,
  Globe,
  Edit3,
  Info,
  Copy,
  Paperclip,
  Link2,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DocumentAttachment, DocumentItem, GitHubConfig } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  createDocumentItem,
  updateDocumentItem,
  deleteDocumentItem,
  getSystemSettings,
  logAuditEvent,
} from '../../services/firebaseService';
import { GitHubService } from '../../services/githubService';
import { TableSkeleton } from '../common/SkeletonLoader';
import { RevealOnScroll } from '../common/RevealOnScroll';

const MAX_INLINE_DATA_URL_CHARS = 720_000;
const MAX_INLINE_BINARY_BYTES = 520 * 1024;
const MAX_AI_SCAN_MEDIA_BYTES = 4 * 1024 * 1024;

function compressImageToDataUrl(file: File, maxDim = 1400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể giải mã tệp ảnh'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl.length > MAX_INLINE_DATA_URL_CHARS) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn'));
    reader.readAsDataURL(file);
  });
}

function normalizeGitHubRawUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  const match = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^/]+)\/(.+)$/i
  );
  if (match) {
    return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`;
  }
  return trimmed;
}

function buildSafeEmbedUrl(rawUrl: string, fileName?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  // Convert Google Drive view links into embeddable preview URLs
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (driveMatch?.[1]) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }

  // Never pass raw.githubusercontent.com or github.com blob directly into iframe/img (browsers block raw MIME/CSP)
  if (/raw\.githubusercontent\.com|github\.com/i.test(trimmed)) {
    const normalized = normalizeGitHubRawUrl(trimmed);
    return `/api/file-proxy?url=${encodeURIComponent(normalized)}&name=${encodeURIComponent(fileName || 'van-ban.pdf')}`;
  }

  return trimmed;
}

function resolveAttachmentFileType(
  fileName: string,
  mimeType?: string,
  url?: string
): DocumentAttachment['fileType'] {
  const combined = `${fileName} ${mimeType || ''} ${url || ''}`.toLowerCase();
  if (combined.includes('application/pdf') || /\.pdf(\?|#|$)/i.test(combined)) return 'pdf';
  if (
    mimeType?.toLowerCase().startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(combined)
  ) {
    return 'image';
  }
  if (/\.(doc|docx)(\?|#|$)/i.test(combined) || combined.includes('wordprocessingml')) return 'docx';
  if (/\.(xls|xlsx|csv)(\?|#|$)/i.test(combined) || combined.includes('spreadsheetml')) return 'xlsx';
  return 'link';
}

function isPdfDocument(docItem: {
  fileUrl?: string;
  fileType?: string;
  mimeType?: string;
  fileName?: string;
}): boolean {
  if (docItem.fileType === 'pdf') return true;
  if ((docItem.mimeType || '').toLowerCase() === 'application/pdf') return true;
  if ((docItem.fileName || '').toLowerCase().endsWith('.pdf')) return true;
  const url = (docItem.fileUrl || '').toLowerCase();
  return url.startsWith('data:application/pdf') || /\.pdf(\?|#|$)/i.test(url);
}

function isImageDocument(docItem: {
  fileUrl?: string;
  fileType?: string;
  mimeType?: string;
  fileName?: string;
}): boolean {
  if (docItem.fileType === 'image') return true;
  if ((docItem.mimeType || '').toLowerCase().startsWith('image/')) return true;
  const url = (docItem.fileUrl || '').toLowerCase();
  if (url.startsWith('data:image/')) return true;
  return (
    /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(url) ||
    /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(docItem.fileName || '')
  );
}

const DOCUMENT_CATEGORY_LABELS: Record<DocumentItem['category'], string> = {
  legal: 'Văn bản pháp quy',
  moh: 'Bộ Y tế / Tiêm chủng & BHYT',
  doh: 'Sở Y tế / Địa phương',
  decision: 'Quyết định / Chỉ đạo',
  guideline: 'Hướng dẫn chuyên môn',
  form: 'Biểu mẫu kê khai',
};

function mapScannedCategory(raw?: string): DocumentItem['category'] {
  const normalized = (raw || '').toLowerCase();
  if (normalized.includes('tiêm chủng') || normalized.includes('bhyt') || normalized.includes('bộ y tế')) {
    return 'moh';
  }
  if (normalized.includes('phòng chống dịch') || normalized.includes('hướng dẫn')) {
    return 'guideline';
  }
  if (normalized.includes('biểu mẫu') || normalized.includes('kê khai')) {
    return 'form';
  }
  if (normalized.includes('chỉ đạo') || normalized.includes('quyết định')) {
    return 'decision';
  }
  if (normalized.includes('sở y tế')) {
    return 'doh';
  }
  if (normalized.includes('pháp luật') || normalized.includes('luật')) {
    return 'legal';
  }
  return 'decision';
}

export const DocumentsView: React.FC = () => {
  const { isAdmin, userProfile, currentUser, isStaff } = useAuth();
  const { showToast, showConfirm } = useToast();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  // Built-in Preview Modal & Detail Modal
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentItem | null>(null);

  // Modal new/edit document
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [docNumber, setDocNumber] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<DocumentItem['category']>('moh');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [issuer, setIssuer] = useState('Bộ Y tế');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState<DocumentItem['fileType']>('pdf');
  const [fileSize, setFileSize] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [submitting, setSubmitting] = useState(false);

  // File Upload & Progress State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isScanningAI, setIsScanningAI] = useState<boolean>(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(true);
  const [autoExtractSummary, setAutoExtractSummary] = useState<boolean>(true);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [fileNameMeta, setFileNameMeta] = useState('');
  const [mimeTypeMeta, setMimeTypeMeta] = useState('');
  const [githubPath, setGithubPath] = useState('');
  const [githubHtmlUrl, setGithubHtmlUrl] = useState('');
  const [githubSha, setGithubSha] = useState('');
  const [attachments, setAttachments] = useState<DocumentAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [attachmentTitleInput, setAttachmentTitleInput] = useState('');
  const [attachmentUrlInput, setAttachmentUrlInput] = useState('');
  const [activePreviewAttachmentId, setActivePreviewAttachmentId] = useState<'main' | string>('main');
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  const [githubConfig, setGithubConfig] = useState<GitHubConfig | undefined>(undefined);
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string>('');
  const [loadingPreviewUrl, setLoadingPreviewUrl] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'documents'),
      snap => {
        setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentItem)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    getSystemSettings()
      .then(s => {
        if (s?.githubConfig) setGithubConfig(s.githubConfig);
        if (s?.aiAutomation) {
          setAutoScanEnabled(s.aiAutomation.autoScanOnUpload !== false);
          setAutoExtractSummary(s.aiAutomation.autoExtractSummary !== false);
        }
      })
      .catch(() => {});
    fetch('/api/ai/status')
      .then(res => (res.ok ? res.json() : null))
      .then(statusData => {
        if (statusData && typeof statusData.configured === 'boolean') {
          setAiReady(statusData.configured);
        }
      })
      .catch(() => {});
    return () => unsub();
  }, []);

  const openPreviewModal = (docItem: DocumentItem, targetAttachmentId?: string) => {
    const initialTarget =
      targetAttachmentId ||
      (docItem.fileUrl
        ? 'main'
        : docItem.attachments && docItem.attachments.length > 0
          ? docItem.attachments[0].id
          : 'main');
    setActivePreviewAttachmentId(initialTarget);
    setPreviewLoadError(null);
    setPreviewDoc(docItem);
  };

  const activePreviewFile = (() => {
    if (!previewDoc) return null;
    if (activePreviewAttachmentId !== 'main' && Array.isArray(previewDoc.attachments)) {
      const matched = previewDoc.attachments.find(a => a.id === activePreviewAttachmentId);
      if (matched) {
        return {
          id: matched.id,
          label: matched.title || matched.fileName,
          fileUrl: matched.fileUrl,
          fileName: matched.fileName,
          fileType: matched.fileType,
          fileSize: matched.fileSize,
          mimeType: matched.mimeType,
          githubPath: matched.githubPath,
          githubHtmlUrl: matched.githubHtmlUrl,
          githubSha: matched.githubSha,
        };
      }
    }
    return {
      id: 'main',
      label: previewDoc.fileName || 'Văn bản chính',
      fileUrl: previewDoc.fileUrl || '',
      fileName: previewDoc.fileName || `${previewDoc.docNumber || 'van-ban'}.${previewDoc.fileType || 'pdf'}`,
      fileType: previewDoc.fileType,
      fileSize: previewDoc.fileSize,
      mimeType: previewDoc.mimeType,
      githubPath: previewDoc.githubPath,
      githubHtmlUrl: previewDoc.githubHtmlUrl,
      githubSha: previewDoc.githubSha,
    };
  })();

  useEffect(() => {
    let active = true;
    let objectUrlToRevoke: string | null = null;

    if (!previewDoc || !activePreviewFile?.fileUrl) {
      setResolvedPreviewUrl('');
      setPreviewLoadError(null);
      setLoadingPreviewUrl(false);
      return;
    }

    const rawUrl = activePreviewFile.fileUrl.trim();
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
      setResolvedPreviewUrl(rawUrl);
      setPreviewLoadError(null);
      setLoadingPreviewUrl(false);
      return;
    }

    const isGitHubHosted =
      Boolean(activePreviewFile.githubPath || activePreviewFile.githubHtmlUrl) ||
      /raw\.githubusercontent\.com|github\.com/i.test(rawUrl);

    if (!isGitHubHosted) {
      setResolvedPreviewUrl(buildSafeEmbedUrl(rawUrl, activePreviewFile.fileName));
      setPreviewLoadError(null);
      setLoadingPreviewUrl(false);
      return;
    }

    setLoadingPreviewUrl(true);
    setResolvedPreviewUrl('');
    setPreviewLoadError(null);

    (async () => {
      let ghCfg = githubConfig;
      if (!ghCfg?.token) {
        try {
          const s = await getSystemSettings();
          ghCfg = s?.githubConfig;
          if (active && ghCfg) setGithubConfig(ghCfg);
        } catch {
          // ignore
        }
      }
      const res = await GitHubService.fetchAttachmentObjectUrl(ghCfg, {
        name: activePreviewFile.fileName || `${previewDoc.docNumber || 'van-ban'}.${activePreviewFile.fileType || 'pdf'}`,
        path: activePreviewFile.githubPath || '',
        sha: activePreviewFile.githubSha,
        mimeType:
          activePreviewFile.mimeType ||
          (activePreviewFile.fileType === 'pdf' ? 'application/pdf' : undefined),
        downloadUrl: normalizeGitHubRawUrl(rawUrl),
        htmlUrl: activePreviewFile.githubHtmlUrl || '',
      });
      if (!active) {
        if (res.isObjectUrl && res.url) URL.revokeObjectURL(res.url);
        return;
      }
      if (res.isObjectUrl && res.url) {
        objectUrlToRevoke = res.url;
        setResolvedPreviewUrl(res.url);
        setPreviewLoadError(null);
      } else if (res.url) {
        setResolvedPreviewUrl(buildSafeEmbedUrl(res.url, activePreviewFile.fileName));
        setPreviewLoadError(res.error || null);
      } else {
        setResolvedPreviewUrl(buildSafeEmbedUrl(rawUrl, activePreviewFile.fileName));
        setPreviewLoadError(res.error || null);
      }
      setLoadingPreviewUrl(false);
    })();

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [previewDoc, activePreviewAttachmentId, githubConfig]);

  const canManageDocs = isAdmin || isStaff;
  const accessibleDocs = documents.filter(d => (canManageDocs ? true : d.visibility !== 'private'));

  const filtered = accessibleDocs.filter(d => {
    const docVis = d.visibility === 'private' ? 'private' : 'public';
    const matchVis = !canManageDocs || visibilityFilter === 'all' || docVis === visibilityFilter;
    const matchSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.issuer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchVis && matchSearch;
  });

  const resetFormModal = () => {
    setEditingDoc(null);
    setDocNumber('');
    setTitle('');
    setSummary('');
    setCategory('moh');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setIssuer('Bộ Y tế');
    setFileUrl('');
    setFileType('pdf');
    setFileSize('');
    setFileNameMeta('');
    setMimeTypeMeta('');
    setGithubPath('');
    setGithubHtmlUrl('');
    setGithubSha('');
    setAttachments([]);
    setAttachmentTitleInput('');
    setAttachmentUrlInput('');
    setVisibility('public');
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadWarning(null);
  };

  const openEditDocModal = (docItem: DocumentItem) => {
    setEditingDoc(docItem);
    setDocNumber(docItem.docNumber || '');
    setTitle(docItem.title || '');
    setSummary(docItem.summary || '');
    setCategory(docItem.category || 'moh');
    setIssueDate(docItem.issueDate || new Date().toISOString().split('T')[0]);
    setIssuer(docItem.issuer || 'Bộ Y tế');
    setFileUrl(docItem.fileUrl || '');
    setFileType(docItem.fileType || 'pdf');
    setFileSize(docItem.fileSize || '');
    setFileNameMeta(docItem.fileName || '');
    setMimeTypeMeta(docItem.mimeType || '');
    setGithubPath(docItem.githubPath || '');
    setGithubHtmlUrl(docItem.githubHtmlUrl || '');
    setGithubSha(docItem.githubSha || '');
    setAttachments(Array.isArray(docItem.attachments) ? docItem.attachments : []);
    setAttachmentTitleInput('');
    setAttachmentUrlInput('');
    setVisibility(docItem.visibility === 'private' ? 'private' : 'public');
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadWarning(null);
    setShowCreateModal(true);
  };

  const handleToggleVisibility = async (docItem: DocumentItem) => {
    const nextVisibility: 'public' | 'private' =
      docItem.visibility === 'private' ? 'public' : 'private';
    try {
      await updateDocumentItem(docItem.id, { visibility: nextVisibility });
      await logAuditEvent(
        'Đổi chế độ hiển thị văn bản',
        'Văn bản',
        `${docItem.docNumber}: ${nextVisibility === 'public' ? 'Công khai' : 'Riêng tư'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        nextVisibility === 'public' ? 'Đã chuyển sang Công khai' : 'Đã chuyển sang Riêng tư',
        nextVisibility === 'public'
          ? 'Mọi người dân đều có thể xem văn bản này.'
          : 'Chỉ Cán bộ Y tế & Quản trị viên mới xem được.'
      );
    } catch (err: any) {
      showToast('error', 'Không thể cập nhật trạng thái văn bản', err?.message);
    }
  };

  const handleDelete = (id: string, docNum: string) => {
    showConfirm({
      title: 'Xóa văn bản này?',
      message: `Bạn có chắc chắn muốn xóa văn bản ${docNum} khỏi danh mục?`,
      confirmText: 'Xóa văn bản',
      cancelText: 'Huỷ',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteDocumentItem(id);
          await logAuditEvent('Xóa văn bản', 'Văn bản', `Xóa số hiệu: ${docNum}`, {
            uid: currentUser?.uid || 'admin',
            name: userProfile?.displayName || 'Admin',
          });
          showToast('success', 'Đã xóa văn bản thành công');
        } catch (err: any) {
          showToast('error', 'Không thể xóa văn bản', err?.message);
        }
      },
    });
  };

  // Admin Upload File with GitHub storage (supports <=20MB) or safe compressed/small inline fallback
  const handleLocalFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadWarning(null);
    setIsUploading(true);
    setUploadProgress(15);

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    setFileSize(`${sizeMb} MB`);
    setFileNameMeta(file.name);
    setMimeTypeMeta(file.type || '');

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') setFileType('pdf');
    else if (['doc', 'docx'].includes(ext || '')) setFileType('docx');
    else if (['xls', 'xlsx', 'csv'].includes(ext || '')) setFileType('xlsx');
    else setFileType('link');

    // Auto-trigger Gemini AI Document Scan when file is selected
    if (autoScanEnabled) {
      void handleAIScanDocument(file);
    }

    try {
      let activeGh = githubConfig;
      if (!activeGh?.token?.trim() || !activeGh?.owner?.trim() || !activeGh?.repo?.trim()) {
        try {
          const live = await getSystemSettings();
          activeGh = live?.githubConfig;
          if (activeGh) setGithubConfig(activeGh);
        } catch {
          // ignore
        }
      }

      const hasGitHub = Boolean(
        activeGh?.token?.trim() && activeGh?.owner?.trim() && activeGh?.repo?.trim()
      );

      if (hasGitHub && activeGh) {
        setUploadProgress(45);
        const upRes = await GitHubService.uploadFile(
          activeGh,
          file,
          userProfile?.displayName || 'Admin'
        );
        if (upRes.success && upRes.fileItem) {
          setFileUrl(upRes.fileItem.downloadUrl);
          setGithubPath(upRes.fileItem.path);
          setGithubHtmlUrl(upRes.fileItem.htmlUrl);
          setGithubSha(upRes.fileItem.sha || '');
          setUploadProgress(100);
          setIsUploading(false);
          showToast(
            'success',
            'Đã tải tệp lên kho lưu trữ GitHub!',
            `${file.name} (${sizeMb} MB) sẵn sàng lưu vào danh mục.`
          );
          return;
        }
        // If GitHub upload failed, notify and check safe inline fallback below
        setUploadWarning(
          `Không thể đẩy lên GitHub (${upRes.error || 'lỗi kết nối'}). Đang kiểm tra khả năng lưu trực tiếp...`
        );
      }

      setUploadProgress(70);

      // Image compression fallback
      if (file.type.startsWith('image/')) {
        const compressed = await compressImageToDataUrl(file);
        if (compressed.length <= MAX_INLINE_DATA_URL_CHARS) {
          setFileUrl(compressed);
          setGithubPath('');
          setGithubHtmlUrl('');
          setGithubSha('');
          setUploadProgress(100);
          setIsUploading(false);
          showToast('success', 'Đã nén và nạp ảnh thành công!', `Tệp ${file.name} đã sẵn sàng lưu.`);
          return;
        }
      }

      // Small non-image fallback (<= ~520KB binary so Data URL <= ~700KB, safely within Firestore 1MB limit)
      if (file.size <= MAX_INLINE_BINARY_BYTES) {
        const dataUrl = await readFileAsDataUrl(file);
        if (dataUrl.length <= MAX_INLINE_DATA_URL_CHARS) {
          setFileUrl(dataUrl);
          setGithubPath('');
          setGithubHtmlUrl('');
          setGithubSha('');
          setUploadProgress(100);
          setIsUploading(false);
          showToast('success', 'Tải tệp lên thành công!', `Đã sẵn sàng đường dẫn cho ${file.name}`);
          return;
        }
      }

      // File too large for Firestore direct inline Data URL without GitHub
      if (fileUrl.startsWith('data:')) {
        setFileUrl('');
      }
      setGithubPath('');
      setGithubHtmlUrl('');
      setGithubSha('');
      setUploadProgress(0);
      setIsUploading(false);
      const warnMsg =
        `Tệp "${file.name}" (${sizeMb} MB) vượt giới hạn lưu trực tiếp (~520 KB) của cơ sở dữ liệu Firestore. Vui lòng cấu hình Kho lưu trữ GitHub trong Quản trị hệ thống (hỗ trợ đến 20 MB) hoặc dán đường dẫn Google Drive / liên kết ngoài vào ô URL bên dưới.`;
      setUploadWarning(warnMsg);
      showToast('warning', 'Tệp quá lớn để lưu trực tiếp', warnMsg);
    } catch (err: any) {
      setIsUploading(false);
      setUploadProgress(0);
      showToast('error', 'Không thể đọc tệp đã chọn', err?.message);
    }
  };

  // AI Document Scanning via Express/Serverless API with multimodal PDF/Image & text support
  const handleAIScanDocument = async (fileOverride?: File) => {
    const fileToScan = fileOverride || selectedFile;
    if (!fileToScan && !title && !fileUrl) {
      showToast('warning', 'Vui lòng chọn tệp hoặc nhập nội dung văn bản để AI quét');
      return;
    }

    setIsScanningAI(true);
    showToast('info', 'Gemini AI đang đọc văn bản', 'Đang trích xuất số hiệu, tiêu đề, ngày ban hành và tóm tắt...');

    try {
      let textToScan = fileToScan ? fileToScan.name : title || 'Văn bản y tế';
      let fileBase64: string | undefined;
      let scanMimeType: string | undefined;

      if (fileToScan) {
        const ext = fileToScan.name.split('.').pop()?.toLowerCase() || '';
        if (
          fileToScan.type.startsWith('text/') ||
          ['txt', 'csv', 'json', 'md'].includes(ext)
        ) {
          try {
            const rawText = await fileToScan.text();
            if (rawText.trim()) {
              textToScan = rawText.slice(0, 6000);
            }
          } catch {
            // fallback to filename
          }
        } else if (
          (fileToScan.type === 'application/pdf' ||
            ext === 'pdf' ||
            fileToScan.type.startsWith('image/')) &&
          fileToScan.size <= MAX_AI_SCAN_MEDIA_BYTES
        ) {
          try {
            const dataUrl = await readFileAsDataUrl(fileToScan);
            const parts = dataUrl.split(',');
            if (parts.length === 2 && parts[1]) {
              fileBase64 = parts[1];
              scanMimeType =
                fileToScan.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
            }
          } catch {
            // fallback to filename
          }
        }
      }

      const res = await fetch('/api/ai/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textContent: textToScan,
          filename: fileToScan?.name || 'van-ban.pdf',
          fileName: fileToScan?.name || 'van-ban.pdf',
          ...(fileBase64 && scanMimeType ? { fileBase64, mimeType: scanMimeType } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.title) {
        throw new Error(data?.error || `Máy chủ AI trả về lỗi HTTP ${res.status}`);
      }

      if (data.title) setTitle(data.title);
      if (data.docNumber) setDocNumber(data.docNumber);
      if (data.issueDate) setIssueDate(data.issueDate);
      if (data.issuingAuthority) setIssuer(data.issuingAuthority);
      if (data.category) setCategory(mapScannedCategory(data.category));
      if (autoExtractSummary && data.summary) setSummary(data.summary);

      showToast(
        'success',
        'Gemini AI đã tự động đọc & điền thông tin',
        'Số hiệu, tiêu đề, ngày ban hành, thể loại và tóm tắt đã được điền tự động.'
      );
    } catch (err: any) {
      showToast(
        'error',
        'Không thể quét tự động bằng Gemini AI',
        err?.message || 'Vui lòng nhập thủ công các thông tin văn bản.'
      );
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docNumber.trim() || !title.trim()) return;

    const trimmedUrl = fileUrl.trim();
    if (trimmedUrl.startsWith('data:') && trimmedUrl.length > MAX_INLINE_DATA_URL_CHARS) {
      showToast(
        'error',
        'Đường dẫn tệp vượt quá giới hạn Firestore (~700 KB)',
        'Vui lòng cấu hình GitHub Storage hoặc dùng đường dẫn liên kết ngoài (Google Drive / URL).'
      );
      return;
    }

    setSubmitting(true);
    try {
      const sanitizedAttachments: DocumentAttachment[] = attachments
        .filter(a => Boolean(a.fileUrl?.trim()))
        .map(a => ({
          id: a.id,
          title: (a.title || a.fileName || 'Phụ lục đính kèm').trim(),
          fileName: (a.fileName || 'phu-luc.pdf').trim(),
          fileUrl: a.fileUrl.trim(),
          ...(a.fileType ? { fileType: a.fileType } : {}),
          ...(a.fileSize ? { fileSize: a.fileSize } : {}),
          ...(a.mimeType ? { mimeType: a.mimeType } : {}),
          ...(a.githubPath ? { githubPath: a.githubPath } : {}),
          ...(a.githubHtmlUrl ? { githubHtmlUrl: a.githubHtmlUrl } : {}),
          ...(a.githubSha ? { githubSha: a.githubSha } : {}),
          ...(a.uploadedAt ? { uploadedAt: a.uploadedAt } : {}),
        }));

      const inlineCharsTotal =
        (trimmedUrl.startsWith('data:') ? trimmedUrl.length : 0) +
        sanitizedAttachments.reduce(
          (sum, att) => sum + (att.fileUrl.startsWith('data:') ? att.fileUrl.length : 0),
          0
        );
      if (inlineCharsTotal > MAX_INLINE_DATA_URL_CHARS) {
        showToast(
          'error',
          'Tổng dung lượng tệp nhúng trực tiếp vượt giới hạn (~700 KB)',
          'Vui lòng cấu hình Kho lưu trữ GitHub (hỗ trợ 20 MB/tệp) hoặc sử dụng đường dẫn URL ngoài cho các tệp phụ lục.'
        );
        setSubmitting(false);
        return;
      }

      const commonPayload: Omit<DocumentItem, 'id' | 'createdAt'> = {
        docNumber: docNumber.trim(),
        title: title.trim(),
        summary: summary.trim() || undefined,
        category,
        issueDate,
        issuer: issuer.trim(),
        fileUrl: trimmedUrl || undefined,
        fileType,
        fileSize: fileSize.trim() || undefined,
        fileName: fileNameMeta.trim() || undefined,
        mimeType: mimeTypeMeta.trim() || undefined,
        githubPath: githubPath.trim() || undefined,
        githubHtmlUrl: githubHtmlUrl.trim() || undefined,
        githubSha: githubSha.trim() || undefined,
        attachments: sanitizedAttachments,
        visibility,
      };

      if (editingDoc) {
        await updateDocumentItem(editingDoc.id, commonPayload);

        await logAuditEvent('Cập nhật văn bản', 'Văn bản', `Số: ${docNumber} (${visibility})`, {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        });

        showToast('success', 'Đã cập nhật văn bản thành công');
      } else {
        await createDocumentItem({
          ...commonPayload,
          createdAt: new Date().toISOString().split('T')[0],
        });

        await logAuditEvent('Ban hành văn bản', 'Văn bản', `Số: ${docNumber} (${visibility})`, {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        });

        showToast('success', 'Đã lưu văn bản vào danh mục');
      }

      setShowCreateModal(false);
      resetFormModal();
    } catch (err: any) {
      showToast('error', 'Không thể lưu văn bản', err?.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppendixFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    setIsUploadingAttachment(true);
    try {
      let activeGh = githubConfig;
      if (!activeGh?.token?.trim() || !activeGh?.owner?.trim() || !activeGh?.repo?.trim()) {
        try {
          const live = await getSystemSettings();
          activeGh = live?.githubConfig;
          if (activeGh) setGithubConfig(activeGh);
        } catch {
          // ignore
        }
      }

      const hasGitHub = Boolean(
        activeGh?.token?.trim() && activeGh?.owner?.trim() && activeGh?.repo?.trim()
      );

      const addedItems: DocumentAttachment[] = [];
      let failedCount = 0;

      for (let idx = 0; idx < files.length; idx++) {
        const f = files[idx];
        const sizeMb = (f.size / (1024 * 1024)).toFixed(2);
        const attId = `att_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
        const resolvedType = resolveAttachmentFileType(f.name, f.type);

        if (hasGitHub && activeGh) {
          const upRes = await GitHubService.uploadFile(
            activeGh,
            f,
            userProfile?.displayName || 'Admin'
          );
          if (upRes.success && upRes.fileItem) {
            addedItems.push({
              id: attId,
              title: `Phụ lục ${attachments.length + addedItems.length + 1}: ${f.name.replace(/\.[^/.]+$/, '')}`,
              fileName: f.name,
              fileUrl: upRes.fileItem.downloadUrl,
              fileType: resolvedType,
              fileSize: `${sizeMb} MB`,
              mimeType: f.type || undefined,
              githubPath: upRes.fileItem.path,
              githubHtmlUrl: upRes.fileItem.htmlUrl,
              githubSha: upRes.fileItem.sha || '',
              uploadedAt: new Date().toISOString(),
            });
            continue;
          }
        }

        if (f.type.startsWith('image/')) {
          try {
            const compressed = await compressImageToDataUrl(f, 1200);
            if (compressed.length <= 320_000) {
              addedItems.push({
                id: attId,
                title: `Phụ lục ${attachments.length + addedItems.length + 1}: ${f.name.replace(/\.[^/.]+$/, '')}`,
                fileName: f.name,
                fileUrl: compressed,
                fileType: 'image',
                fileSize: `${sizeMb} MB`,
                mimeType: 'image/jpeg',
                uploadedAt: new Date().toISOString(),
              });
              continue;
            }
          } catch {
            // ignore
          }
        }

        if (f.size <= 260 * 1024) {
          try {
            const dataUrl = await readFileAsDataUrl(f);
            if (dataUrl.length <= 360_000) {
              addedItems.push({
                id: attId,
                title: `Phụ lục ${attachments.length + addedItems.length + 1}: ${f.name.replace(/\.[^/.]+$/, '')}`,
                fileName: f.name,
                fileUrl: dataUrl,
                fileType: resolvedType,
                fileSize: `${sizeMb} MB`,
                mimeType: f.type || undefined,
                uploadedAt: new Date().toISOString(),
              });
              continue;
            }
          } catch {
            // ignore
          }
        }

        failedCount++;
      }

      if (addedItems.length > 0) {
        setAttachments(prev => [...prev, ...addedItems]);
        showToast(
          'success',
          `Đã đính kèm ${addedItems.length} tệp phụ lục`,
          failedCount > 0 ? `${failedCount} tệp quá lớn khi chưa cấu hình GitHub Storage.` : undefined
        );
      } else if (failedCount > 0) {
        showToast(
          'warning',
          'Không thể đính kèm tệp phụ lục quá lớn',
          'Vui lòng cấu hình Kho lưu trữ GitHub (tối đa 20 MB/tệp) hoặc dán liên kết URL phụ lục.'
        );
      }
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleAddAttachmentByUrl = () => {
    const cleanUrl = attachmentUrlInput.trim();
    if (!cleanUrl) {
      showToast('warning', 'Vui lòng nhập đường dẫn URL phụ lục');
      return;
    }
    const cleanTitle = attachmentTitleInput.trim() || `Phụ lục ${attachments.length + 1}`;
    const guessedName = cleanUrl.split('?')[0].split('/').pop() || `${cleanTitle}.pdf`;
    setAttachments(prev => [
      ...prev,
      {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: cleanTitle,
        fileName: guessedName,
        fileUrl: cleanUrl,
        fileType: resolveAttachmentFileType(guessedName, undefined, cleanUrl),
        uploadedAt: new Date().toISOString(),
      },
    ]);
    setAttachmentTitleInput('');
    setAttachmentUrlInput('');
  };

  const handleDownloadTargetFile = async (target: {
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    mimeType?: string;
    githubPath?: string;
    githubHtmlUrl?: string;
    githubSha?: string;
    docNumber?: string;
  }) => {
    const rawUrl = (target.fileUrl || '').trim();
    if (!rawUrl) return;
    const fallbackName =
      target.fileName ||
      `${(target.docNumber || 'van-ban').replace(/[^a-zA-Z0-9._-]/g, '_')}.${target.fileType && target.fileType !== 'link' ? target.fileType : 'pdf'}`;

    const isGitHubHosted =
      Boolean(target.githubPath || target.githubHtmlUrl) ||
      /raw\.githubusercontent\.com|github\.com/i.test(rawUrl);

    if (isGitHubHosted && !rawUrl.startsWith('data:') && !rawUrl.startsWith('blob:')) {
      try {
        let ghCfg = githubConfig;
        if (!ghCfg?.token) {
          const s = await getSystemSettings().catch(() => null);
          ghCfg = s?.githubConfig;
          if (ghCfg) setGithubConfig(ghCfg);
        }
        const res = await GitHubService.fetchAttachmentObjectUrl(ghCfg, {
          name: fallbackName,
          path: target.githubPath || '',
          sha: target.githubSha,
          mimeType: target.mimeType || (target.fileType === 'pdf' ? 'application/pdf' : undefined),
          downloadUrl: normalizeGitHubRawUrl(rawUrl),
          htmlUrl: target.githubHtmlUrl || '',
        });
        if (res.url) {
          const link = document.createElement('a');
          link.href = res.url;
          link.download = fallbackName;
          link.target = '_blank';
          link.rel = 'noreferrer';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          if (res.isObjectUrl) {
            setTimeout(() => URL.revokeObjectURL(res.url!), 10000);
          }
          return;
        }
      } catch {
        // fallback below
      }
    }

    const link = document.createElement('a');
    link.href = /raw\.githubusercontent\.com|github\.com/i.test(rawUrl)
      ? `/api/file-proxy?url=${encodeURIComponent(normalizeGitHubRawUrl(rawUrl))}&name=${encodeURIComponent(fallbackName)}&download=1`
      : rawUrl;
    link.download = fallbackName;
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadDocument = async (docItem: DocumentItem) => {
    await handleDownloadTargetFile(docItem);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <RevealOnScroll immediate>
        <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Văn Bản &amp; Biểu Mẫu ({accessibleDocs.length})</span>
            </h2>
            <p className="hidden sm:block text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Công văn, quyết định và biểu mẫu y tế xem trực tuyến.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {canManageDocs && (
              <button
                type="button"
                onClick={() => {
                  resetFormModal();
                  setShowCreateModal(true);
                }}
                className="min-h-[40px] w-full sm:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" /> Thêm văn bản
              </button>
            )}
          </div>
        </div>
      </RevealOnScroll>

      <RevealOnScroll title="Danh mục văn bản">
        <div className="space-y-4">

      {/* Search & Visibility Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Tìm theo số hiệu văn bản, trích yếu, cơ quan ban hành..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>

        {canManageDocs && (
          <div className="flex items-center p-1 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setVisibilityFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                visibilityFilter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Tất cả ({accessibleDocs.length})
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter('public')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer ${
                visibilityFilter === 'public'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Công khai ({accessibleDocs.filter(d => d.visibility !== 'private').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter('private')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer ${
                visibilityFilter === 'private'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Riêng tư ({accessibleDocs.filter(d => d.visibility === 'private').length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Documents Table */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-3">
          <Inbox className="w-10 h-10 mx-auto text-slate-300" />
          <p>Không tìm thấy văn bản hoặc biểu mẫu nào.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                <th className="py-3 px-4 whitespace-nowrap">Số hiệu</th>
                <th className="py-3 px-4 whitespace-nowrap">Trích yếu nội dung (1 dòng - Rút gọn)</th>
                <th className="py-3 px-3 whitespace-nowrap">Cơ quan ban hành</th>
                <th className="py-3 px-3 whitespace-nowrap">Ngày ban hành</th>
                {canManageDocs && <th className="py-3 px-3 whitespace-nowrap">Phạm vi</th>}
                <th className="py-3 px-3 whitespace-nowrap">Thao tác văn bản</th>
                {canManageDocs && <th className="py-3 px-4 text-right whitespace-nowrap">Quản trị</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(doc => {
                const isPrivate = doc.visibility === 'private';
                return (
                  <tr
                    key={doc.id}
                    onClick={() => setDetailDoc(doc)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition h-12 cursor-pointer group"
                    title="Nhấn vào dòng này để xem chi tiết toàn văn văn bản"
                  >
                    <td className="py-2.5 px-4 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      <div className="max-w-[140px] overflow-hidden" title={doc.docNumber}>
                        <span className="inline-block max-w-full truncate whitespace-nowrap align-middle px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-bold">
                          {doc.docNumber}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      <div
                        className="flex items-center gap-2 min-w-0 max-w-[200px] sm:max-w-[280px] md:max-w-[360px] lg:max-w-[440px] xl:max-w-[520px] overflow-hidden"
                        title={`${doc.title} (Nhấn để xem chi tiết đầy đủ)`}
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="truncate whitespace-nowrap block min-w-0">
                          {doc.title}
                        </span>
                        {Array.isArray(doc.attachments) && doc.attachments.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-[10px] font-bold shrink-0"
                            title={`Có ${doc.attachments.length} văn bản phụ lục đính kèm`}
                          >
                            <Paperclip className="w-2.5 h-2.5" />+{doc.attachments.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <div className="max-w-[130px] sm:max-w-[170px] overflow-hidden" title={doc.issuer}>
                        <span className="truncate whitespace-nowrap block">
                          {doc.issuer}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap text-[11px]">
                      {doc.issueDate}
                    </td>
                    {canManageDocs && (
                      <td className="py-2.5 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(doc)}
                          title="Nhấn để chuyển đổi Công khai / Riêng tư"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            isPrivate
                              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          {isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          <span>{isPrivate ? 'Riêng tư' : 'Công khai'}</span>
                        </button>
                      </td>
                    )}
                    <td className="py-2.5 px-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {/* Primary View Details Button */}
                        <button
                          type="button"
                          onClick={() => setDetailDoc(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] transition cursor-pointer border border-emerald-200/80 dark:border-emerald-800 shrink-0"
                          title="Xem chi tiết toàn văn văn bản (nói KHÔNG với xuống dòng)"
                        >
                          <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Xem chi tiết</span>
                        </button>

                        {/* Built-in Preview Button if has main file or attachments */}
                        {(doc.fileUrl || (doc.attachments && doc.attachments.length > 0)) && (
                          <button
                            type="button"
                            onClick={() => openPreviewModal(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-semibold text-[11px] transition cursor-pointer shrink-0"
                            title="Xem trước tệp PDF / Ảnh / Phụ lục đính kèm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem tệp</span>
                          </button>
                        )}

                        {/* Download button if has file */}
                        {doc.fileUrl && (
                          <button
                            type="button"
                            onClick={() => void handleDownloadDocument(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition cursor-pointer shrink-0"
                            title="Tải văn bản về máy"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải về</span>
                          </button>
                        )}
                      </div>
                    </td>
                    {canManageDocs && (
                      <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditDocModal(doc)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition cursor-pointer"
                            title="Chỉnh sửa văn bản"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id, doc.docNumber)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Xóa văn bản"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </div>
      </RevealOnScroll>

      {/* Comprehensive 1-Line Document Detail Modal */}
      {detailDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {detailDoc.docNumber}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {DOCUMENT_CATEGORY_LABELS[detailDoc.category] || 'Văn bản hành chính'}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    detailDoc.visibility === 'private'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {detailDoc.visibility === 'private' ? 'Nội bộ / Riêng tư' : 'Công khai toàn dân'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  Chi Tiết Văn Bản &amp; Biểu Mẫu
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Full Title (untruncated, clear typography) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trích yếu nội dung toàn văn
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed select-text">
                  {detailDoc.title}
                </p>
              </div>

              {/* Document Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Cơ quan ban hành</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block mt-0.5">
                    {detailDoc.issuer}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Ngày ban hành</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs block mt-0.5">
                    {detailDoc.issueDate}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Định dạng &amp; Dung lượng</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs block mt-0.5">
                    {(detailDoc.fileType || 'pdf').toUpperCase()} {detailDoc.fileSize ? `(${detailDoc.fileSize})` : ''}
                  </span>
                </div>
              </div>

              {/* AI Summary if present */}
              {detailDoc.summary && (
                <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-purple-900 dark:text-purple-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                    <span>Tóm tắt nội dung chính (Gemini AI trích xuất)</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed select-text">
                    {detailDoc.summary}
                  </p>
                </div>
              )}

              {/* File action card */}
              {detailDoc.fileUrl ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white truncate block text-xs">
                        {detailDoc.fileName || `${detailDoc.docNumber}.${detailDoc.fileType || 'pdf'}`}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Văn bản chính · Sẵn sàng xem trực tuyến hoặc tải xuống
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailDoc;
                        setDetailDoc(null);
                        openPreviewModal(target, 'main');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem trước
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadDocument(detailDoc)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Tải về
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                  Văn bản niêm yết trích yếu hành chính (không có tệp văn bản chính)
                </div>
              )}

              {/* Appendix / Additional Attachments */}
              {Array.isArray(detailDoc.attachments) && detailDoc.attachments.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 text-xs flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>Văn bản đính kèm / Phụ lục ({detailDoc.attachments.length})</span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {detailDoc.attachments.map((att, idx) => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate text-xs">
                            {att.title || `Phụ lục ${idx + 1}`}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {att.fileName} {att.fileSize ? `· ${att.fileSize}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const target = detailDoc;
                              setDetailDoc(null);
                              openPreviewModal(target, att.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Xem tệp
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownloadTargetFile(att)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" /> Tải
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${detailDoc.docNumber}: ${detailDoc.title} (${detailDoc.issuer})`);
                  showToast('success', 'Đã sao chép thông tin văn bản');
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" /> Sao chép thông tin
              </button>

              <div className="flex items-center gap-2">
                {canManageDocs && (
                  <button
                    type="button"
                    onClick={() => {
                      const docToEdit = detailDoc;
                      setDetailDoc(null);
                      openEditDocModal(docToEdit);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDetailDoc(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Built-in Preview Modal (supports Primary Document + Appendix Attachments + Raw Proxy Fix) */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="min-w-0 pr-4">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {previewDoc.docNumber}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 leading-snug">
                  {previewDoc.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cơ quan ban hành: {previewDoc.issuer} • Ngày: {previewDoc.issueDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* File Switcher Tabs when main file + appendices exist */}
            {Array.isArray(previewDoc.attachments) && previewDoc.attachments.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
                {previewDoc.fileUrl && (
                  <button
                    type="button"
                    onClick={() => setActivePreviewAttachmentId('main')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                      activePreviewAttachmentId === 'main'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Văn bản chính</span>
                  </button>
                )}
                {previewDoc.attachments.map((att, idx) => {
                  const isActive = activePreviewAttachmentId === att.id;
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => setActivePreviewAttachmentId(att.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{att.title || `Phụ lục ${idx + 1}`}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Document Preview Canvas */}
            <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs flex-1 overflow-y-auto min-h-[340px]">
              {loadingPreviewUrl ? (
                <div className="h-[420px] flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <span className="w-6 h-6 border-2 border-emerald-500/40 border-t-emerald-600 rounded-full animate-spin" />
                  <span>Đang tải bản xem trước tài liệu...</span>
                </div>
              ) : previewLoadError ? (
                <div className="h-[360px] flex flex-col items-center justify-center text-center gap-3 p-6">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                  <div className="space-y-1 max-w-md">
                    <div className="font-bold text-slate-800 dark:text-white text-sm">
                      Không thể hiển thị trực tiếp tệp đính kèm
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {previewLoadError}
                    </p>
                  </div>
                  {activePreviewFile?.fileUrl && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadTargetFile(activePreviewFile)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải tệp về máy để xem</span>
                    </button>
                  )}
                </div>
              ) : activePreviewFile?.fileUrl && isImageDocument(activePreviewFile) ? (
                <div className="flex justify-center p-2">
                  <img
                    src={resolvedPreviewUrl || buildSafeEmbedUrl(activePreviewFile.fileUrl, activePreviewFile.fileName)}
                    alt={activePreviewFile.label}
                    className="max-h-[540px] rounded-xl object-contain shadow-xs"
                  />
                </div>
              ) : activePreviewFile?.fileUrl &&
                (isPdfDocument(activePreviewFile) || /drive\.google\.com/i.test(activePreviewFile.fileUrl)) &&
                (resolvedPreviewUrl || activePreviewFile.fileUrl) ? (
                <div className="h-[520px] w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <iframe
                    src={resolvedPreviewUrl || buildSafeEmbedUrl(activePreviewFile.fileUrl, activePreviewFile.fileName)}
                    title={activePreviewFile.label}
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              ) : activePreviewFile?.fileUrl ? (
                <div className="h-[340px] flex flex-col items-center justify-center text-center gap-4 p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                    <FileType className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {activePreviewFile.fileName || activePreviewFile.label}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Định dạng tệp {(activePreviewFile.fileType || 'tài liệu').toUpperCase()} này cần tải về máy hoặc mở bằng trình xem chuyên dụng để hiển thị đầy đủ bảng biểu và định dạng gốc.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDownloadTargetFile(activePreviewFile)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải tệp về máy</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 font-serif text-slate-800 dark:text-slate-200 leading-relaxed text-justify p-4 bg-white dark:bg-slate-900 rounded-xl shadow-inner border border-slate-100 dark:border-slate-800">
                  <div className="text-center font-bold font-sans text-xs uppercase text-slate-900 dark:text-white mb-2">
                    CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br />
                    Độc lập - Tự do - Hạnh phúc
                  </div>
                  <div className="text-center font-bold text-sm text-emerald-800 dark:text-emerald-400 py-1 border-b">
                    VĂN BẢN CHÍNH THỨC SỐ {previewDoc.docNumber}
                  </div>
                  <p className="[text-indent:1cm]">
                    {previewDoc.title} do <strong>{previewDoc.issuer}</strong> chính thức ban hành ngày {previewDoc.issueDate}. Văn bản này được lưu trữ và niêm yết công khai trên Cổng thông tin điện tử y tế cơ sở.
                  </p>
                  <p className="[text-indent:1cm]">
                    Yêu cầu các bộ phận chuyên môn, cán bộ y tế và công dân nghiêm túc theo dõi, chấp hành đúng các quy định hướng dẫn.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0 gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {activePreviewFile?.fileName || 'Xem trực tuyến chuẩn hóa Web App'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {activePreviewFile?.fileUrl && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadTargetFile(activePreviewFile)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Tải về máy
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded 2-Column Admin Upload, Appendix & AI Scan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                    {editingDoc
                      ? 'Chỉnh Sửa Văn Bản & Tệp Đính Kèm'
                      : 'Đăng Tải Tệp Văn Bản & Phụ Lục Đính Kèm'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Hỗ trợ văn bản chính, nhiều phụ lục đính kèm (Kế hoạch, Báo cáo) và tự động quét trích xuất thông tin bằng AI.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetFormModal();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable 2-Column Form Body */}
            <form
              id="document-upload-form"
              onSubmit={handleCreate}
              className="flex-1 overflow-y-auto p-5 sm:p-6 text-xs"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: AI Scan + Document Metadata */}
                <div className="lg:col-span-7 space-y-4">
                  {/* AI Auto Scan Card */}
                  <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="font-bold text-purple-900 dark:text-purple-300 text-xs flex items-center gap-1.5 flex-wrap">
                          <Sparkles className="w-4 h-4 text-purple-600 animate-pulse shrink-0" />
                          <span>Agent AI Tự Động Quét &amp; Đọc Văn Bản</span>
                          {aiReady !== null && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                aiReady
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {aiReady ? 'AI Sẵn sàng' : 'Chế độ dự phòng'}
                            </span>
                          )}
                        </span>
                        <p className="text-[11px] text-purple-700 dark:text-purple-400">
                          Tự động đọc tệp (PDF, Word, Ảnh), trích xuất số hiệu, ngày ban hành, thể loại và tóm tắt.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isScanningAI}
                        onClick={() => handleAIScanDocument()}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isScanningAI ? (
                          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{title ? 'AI Quét Lại' : 'AI Quét Ngay'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-purple-200/60 dark:border-purple-800/60 text-[11px]">
                      <span className="text-purple-800 dark:text-purple-300 font-medium">
                        Tự động kích hoạt AI quét ngay khi chọn tệp văn bản chính
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={autoScanEnabled}
                          onChange={e => setAutoScanEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600" />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Số / Ký hiệu văn bản *
                      </label>
                      <input
                        type="text"
                        required
                        value={docNumber}
                        onChange={e => setDocNumber(e.target.value)}
                        placeholder="Ví dụ: 33/2026/KH-TYT..."
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày ban hành
                      </label>
                      <input
                        type="date"
                        value={issueDate}
                        onChange={e => setIssueDate(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Trích yếu nội dung văn bản *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="Nhập trích yếu hoặc tải tệp để AI tự động điền..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                      <span>Tóm tắt nội dung văn bản</span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-normal">AI tự điền</span>
                    </label>
                    <textarea
                      rows={3}
                      value={summary}
                      onChange={e => setSummary(e.target.value)}
                      placeholder="Tóm tắt ngắn gọn nội dung văn bản, kế hoạch, báo cáo..."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cơ quan ban hành
                      </label>
                      <input
                        type="text"
                        value={issuer}
                        onChange={e => setIssuer(e.target.value)}
                        placeholder="Bộ Y tế / Sở Y tế / Trạm Y tế"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Thể loại văn bản
                      </label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value as DocumentItem['category'])}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="moh">Bộ Y tế / Tiêm chủng &amp; BHYT</option>
                        <option value="doh">Sở Y tế / Địa phương</option>
                        <option value="decision">Quyết định / Chỉ đạo</option>
                        <option value="guideline">Hướng dẫn chuyên môn</option>
                        <option value="legal">Văn bản pháp quy</option>
                        <option value="form">Biểu mẫu kê khai</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Định dạng tệp chính
                      </label>
                      <select
                        value={fileType}
                        onChange={e => setFileType(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="pdf">Tệp PDF (.pdf)</option>
                        <option value="docx">Văn bản Word (.docx)</option>
                        <option value="xlsx">Bảng tính Excel (.xlsx)</option>
                        <option value="link">Đường dẫn liên kết ngoài</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Chế độ hiển thị (Công khai / Riêng tư)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setVisibility('public')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          visibility === 'public'
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Công khai</span>
                        </div>
                        <p className="text-[10px] opacity-80 mt-0.5">Mọi người dân đều xem được</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibility('private')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          visibility === 'private'
                            ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Riêng tư (Nội bộ)</span>
                        </div>
                        <p className="text-[10px] opacity-80 mt-0.5">Chỉ Cán bộ &amp; Quản trị viên</p>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Primary File Upload + Multiple Appendices */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Primary Document File Section */}
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span>1. Tệp Văn Bản Chính</span>
                      </span>
                      {fileSize && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                          {fileSize}
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-2xl border-2 border-dashed border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/25 text-center space-y-2">
                      <input
                        type="file"
                        id="docFileInput"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                        onChange={handleLocalFileSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="docFileInput"
                        className="cursor-pointer w-full sm:w-auto min-h-[44px] sm:min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
                      >
                        <Upload className="w-4 h-4 shrink-0" />
                        <span>Chọn tệp văn bản chính</span>
                      </label>

                      {(selectedFile || fileNameMeta) && (
                        <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1 truncate">
                          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{selectedFile?.name || fileNameMeta}</span>
                        </div>
                      )}

                      {isUploading && (
                        <div className="w-full space-y-1 mt-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full transition-all duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold block">
                            Đang tải lên: {uploadProgress}%
                          </span>
                        </div>
                      )}

                      {uploadWarning && (
                        <div className="text-left p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                          {uploadWarning}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1 text-[11px]">
                        Đường dẫn tệp chính (URL)
                      </label>
                      <input
                        type="text"
                        value={fileUrl}
                        onChange={e => setFileUrl(e.target.value)}
                        placeholder="Tự động điền khi tải tệp hoặc dán URL..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-[11px]"
                      />
                    </div>
                  </div>

                  {/* Additional / Appendix Documents Section */}
                  <div className="p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>2. Văn Bản Đính Kèm / Phụ Lục ({attachments.length})</span>
                      </span>
                      <input
                        type="file"
                        id="docAppendixFilesInput"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                        onChange={handleAppendixFilesSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="docAppendixFilesInput"
                        className={`cursor-pointer w-full sm:w-auto min-h-[42px] sm:min-h-[36px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-[11px] transition shrink-0 ${
                          isUploadingAttachment ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>{isUploadingAttachment ? 'Đang tải...' : 'Thêm tệp phụ lục'}</span>
                      </label>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      Dùng cho Kế hoạch, Báo cáo có nhiều phụ lục, bảng biểu hoặc biểu mẫu đi kèm (có thể chọn nhiều tệp cùng lúc).
                    </p>

                    {/* Add Appendix by URL */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> Hoặc thêm phụ lục bằng đường dẫn URL
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                        <input
                          type="text"
                          value={attachmentTitleInput}
                          onChange={e => setAttachmentTitleInput(e.target.value)}
                          placeholder="Tên (vd: Phụ lục 01)"
                          className="sm:col-span-5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px]"
                        />
                        <input
                          type="text"
                          value={attachmentUrlInput}
                          onChange={e => setAttachmentUrlInput(e.target.value)}
                          placeholder="https://..."
                          className="sm:col-span-5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddAttachmentByUrl}
                          className="sm:col-span-2 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>

                    {/* Attachments List */}
                    {attachments.length === 0 ? (
                      <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-[11px] text-slate-400">
                        Chưa có văn bản phụ lục đính kèm nào.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {attachments.map((att, idx) => (
                          <div
                            key={att.id}
                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={att.title || ''}
                                onChange={e =>
                                  setAttachments(prev =>
                                    prev.map(item =>
                                      item.id === att.id ? { ...item, title: e.target.value } : item
                                    )
                                  )
                                }
                                placeholder={`Phụ lục ${idx + 1}`}
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-bold text-slate-800 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setAttachments(prev => prev.filter(item => item.id !== att.id))
                                }
                                title="Xóa phụ lục này"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                              <span className="truncate font-mono">{att.fileName}</span>
                              <span className="shrink-0 font-bold uppercase text-indigo-600 dark:text-indigo-400">
                                {(att.fileType || 'file').toUpperCase()}
                                {att.fileSize ? ` · ${att.fileSize}` : ''}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </form>

            {/* Sticky Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 shrink-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                Tất cả tệp GitHub &amp; liên kết raw đều được phát trực tuyến an toàn qua hệ thống.
              </span>
              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetFormModal();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  form="document-upload-form"
                  disabled={submitting || isUploading || isUploadingAttachment}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? 'Đang lưu...'
                    : editingDoc
                      ? 'Lưu thay đổi'
                      : 'Lưu văn bản'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
