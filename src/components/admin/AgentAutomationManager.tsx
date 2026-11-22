import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  RefreshCw,
  Cpu,
  Bot,
  Zap,
  SlidersHorizontal,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  Eye,
  EyeOff,
  Server,
  Info,
} from 'lucide-react';
import { SystemSettings, AiProviderType } from '../../types';
import { updateSystemSettings, logAuditEvent } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface ProviderCardState {
  apiKeyInput: string;
  showRawKey: boolean;
  selectedModel: string;
  isTesting: boolean;
  testResult: { ok: boolean; message: string; latencyMs?: number; preview?: string } | null;
  showGuide: boolean;
}

const DEFAULT_AI_PROVIDERS_INFO: Record<string, any> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    label: 'Google Gemini (Khuyên dùng)',
    defaultModel: 'gemini-4-hydrogen',
    availableModels: ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-4-neon'],
    docsUrl: 'https://aistudio.google.com/app/apikey',
    freeGuideSteps: [
      '1. Truy cập trang Google AI Studio: https://aistudio.google.com/app/apikey',
      '2. Đăng nhập bằng tài khoản Google (Gmail) cá nhân hoặc tổ chức',
      '3. Nhấn vào nút xanh "Create API key" (Tạo khóa API)',
      '4. Chọn một dự án Google Cloud miễn phí hoặc nhấn "Create API key in new project"',
      '5. Sao chép chuỗi mã khóa bắt đầu bằng "AIzaSy..." và dán vào ô Khóa API bên dưới',
    ],
    freeGuideNotes:
      'Xử lý cực nhanh đa phương thức văn bản, PDF và hình ảnh y tế; hỗ trợ dự phòng tự động với biến môi trường GEMINI_API_KEY.',
    isConfigured: false,
    apiKeyMasked: '',
    model: 'gemini-4-hydrogen',
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT (OpenAI)',
    label: 'ChatGPT (OpenAI)',
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
    docsUrl: 'https://platform.openai.com/api-keys',
    freeGuideSteps: [
      '1. Truy cập cổng quản lý OpenAI Platform: https://platform.openai.com/api-keys',
      '2. Đăng nhập hoặc đăng ký tài khoản OpenAI',
      '3. Chuyển đến mục "API keys" trong menu điều hướng bên trái',
      '4. Nhấn nút "+ Create new secret key", đặt tên gợi nhớ (ví dụ: "TYT-Agent-Portal")',
      '5. Sao chép chuỗi mã bí mật bắt đầu bằng "sk-proj-..." và lưu vào ô cấu hình',
    ],
    freeGuideNotes:
      'Phù hợp khi muốn dùng mô hình GPT-4o / GPT-4o-mini để trích xuất và tóm tắt văn bản hành chính.',
    isConfigured: false,
    apiKeyMasked: '',
    model: 'gpt-4o-mini',
  },
};

function buildInitialProviderStates(providersMap: Record<string, any>): Record<string, ProviderCardState> {
  const states: Record<string, ProviderCardState> = {};
  Object.keys(providersMap).forEach(k => {
    const p = providersMap[k];
    states[k] = {
      apiKeyInput: '',
      showRawKey: false,
      selectedModel: p?.model || p?.defaultModel || '',
      isTesting: false,
      testResult: null,
      showGuide: false,
    };
  });
  return states;
}

export const AgentAutomationManager: React.FC<{ settings?: SystemSettings }> = ({ settings }) => {
  const { showToast } = useToast();
  const { currentUser, userProfile } = useAuth();

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configFetchError, setConfigFetchError] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<AiProviderType>('gemini');
  const [providersData, setProvidersData] = useState<Record<string, any>>(DEFAULT_AI_PROVIDERS_INFO);
  const [savingServerConfig, setSavingServerConfig] = useState(false);

  // Per provider UI editing state
  const [providerStates, setProviderStates] = useState<Record<string, ProviderCardState>>(() =>
    buildInitialProviderStates(DEFAULT_AI_PROVIDERS_INFO)
  );

  // System Automation Toggles
  const [autoScanOnUpload, setAutoScanOnUpload] = useState<boolean>(
    settings?.aiAutomation?.autoScanOnUpload !== false
  );
  const [autoExtractSummary, setAutoExtractSummary] = useState<boolean>(
    settings?.aiAutomation?.autoExtractSummary !== false
  );
  const [autoSuggestNeeds, setAutoSuggestNeeds] = useState<boolean>(
    settings?.aiAutomation?.autoSuggestNeeds !== false
  );
  const [savingToggles, setSavingToggles] = useState(false);

  useEffect(() => {
    setAutoScanOnUpload(settings?.aiAutomation?.autoScanOnUpload !== false);
    setAutoExtractSummary(settings?.aiAutomation?.autoExtractSummary !== false);
    setAutoSuggestNeeds(settings?.aiAutomation?.autoSuggestNeeds !== false);
  }, [
    settings?.aiAutomation?.autoScanOnUpload,
    settings?.aiAutomation?.autoExtractSummary,
    settings?.aiAutomation?.autoSuggestNeeds,
  ]);

  // Live Test Playground
  const [sampleDocText, setSampleDocText] = useState(
    'BỘ Y TẾ - QUYẾT ĐỊNH SỐ 456/QĐ-BYT NGÀY 12/03/2026 VỀ VIỆC BAN HÀNH HƯỚNG DẪN CHUYÊN MÔN TIÊM CHỦNG MỞ RỘNG VÀ GIÁM SÁT DỊCH BỆNH TRUYỀN NHIỄM TẠI TRẠM Y TẾ XÃ PHƯỜNG.'
  );
  const [testingScan, setTestingScan] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanLatency, setScanLatency] = useState<number | null>(null);

  const [sampleCitizenQuery, setSampleCitizenQuery] = useState('Tôi muốn tra cứu lịch tiêm chủng mở rộng tháng này');
  const [testingNeeds, setTestingNeeds] = useState(false);
  const [needsResult, setNeedsResult] = useState<any>(null);
  const [needsLatency, setNeedsLatency] = useState<number | null>(null);

  const getAuthHeaders = async (includeJson = false): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    try {
      const token = await currentUser?.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      // ignore token error
    }
    return headers;
  };

  const fetchAgentConfig = async () => {
    setLoadingConfig(true);
    setConfigFetchError(null);
    try {
      const headers = await getAuthHeaders(false);
      const res = await fetch('/api/ai/agent-config', { headers });
      if (res.ok) {
        const data = await res.json();
        const mergedProviders: Record<string, any> = { ...DEFAULT_AI_PROVIDERS_INFO };
        Object.keys(data.providers || {}).forEach(k => {
          mergedProviders[k] = {
            ...(DEFAULT_AI_PROVIDERS_INFO[k] || {}),
            ...(data.providers[k] || {}),
          };
        });
        setActiveProvider(data.activeProvider || 'gemini');
        setProvidersData(mergedProviders);
        setProviderStates(prev => {
          const next = buildInitialProviderStates(mergedProviders);
          Object.keys(next).forEach(k => {
            if (prev[k]) {
              next[k] = {
                ...next[k],
                apiKeyInput: prev[k].apiKeyInput || '',
                showRawKey: prev[k].showRawKey,
                showGuide: prev[k].showGuide,
                selectedModel: mergedProviders[k]?.model || prev[k].selectedModel || mergedProviders[k]?.defaultModel,
              };
            }
          });
          return next;
        });
      } else {
        const errPayload = await res.json().catch(() => ({}));
        setConfigFetchError(
          errPayload?.error || `Không thể đồng bộ trạng thái khóa từ máy chủ (HTTP ${res.status}).`
        );
      }
    } catch (err: any) {
      console.error('Failed to fetch Agent config:', err);
      setConfigFetchError(err?.message || 'Không thể kết nối máy chủ cấu hình Agent AI.');
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    void fetchAgentConfig();
  }, [currentUser?.uid]);

  const handleTestProvider = async (provId: string) => {
    const pState = providerStates[provId];
    if (!pState) return;

    setProviderStates(prev => ({
      ...prev,
      [provId]: { ...prev[provId], isTesting: true, testResult: null },
    }));

    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/ai/test-provider', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: provId,
          apiKey: pState.apiKeyInput || undefined,
          model: pState.selectedModel,
        }),
      });
      const data = await res.json();
      setProviderStates(prev => ({
        ...prev,
        [provId]: {
          ...prev[provId],
          isTesting: false,
          testResult: {
            ok: Boolean(data.ok),
            message: data.message || (data.ok ? 'Kết nối thành công!' : 'Kết nối thất bại'),
            latencyMs: data.latencyMs,
            preview: data.responsePreview,
          },
        },
      }));
      if (data.ok) {
        showToast('success', `Kết nối ${providersData[provId]?.name || provId} thành công!`, `${data.latencyMs}ms`);
      } else {
        showToast('error', `Kiểm tra ${provId} thất bại`, data.message || data.error);
      }
    } catch (err: any) {
      setProviderStates(prev => ({
        ...prev,
        [provId]: {
          ...prev[provId],
          isTesting: false,
          testResult: { ok: false, message: err?.message || 'Lỗi mạng' },
        },
      }));
      showToast('error', 'Lỗi kiểm tra kết nối', err?.message);
    }
  };

  const handleSaveServerConfig = async () => {
    setSavingServerConfig(true);
    try {
      const payloadProviders: Record<string, any> = {};
      Object.keys(providerStates).forEach(id => {
        const state = providerStates[id];
        payloadProviders[id] = {
          model: state.selectedModel,
          ...(state.apiKeyInput.trim() ? { apiKey: state.apiKeyInput.trim() } : {}),
        };
      });

      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/ai/agent-config', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          activeProvider,
          providers: payloadProviders,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lỗi lưu cấu hình Agent');
      }

      await logAuditEvent(
        'UPDATE_AI_AGENT_CONFIG',
        'Agent AI',
        `Cập nhật cấu hình Agent AI. Nhà cung cấp hoạt động: ${activeProvider}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast('success', 'Đã lưu cấu hình Agent AI thành công!', `Nhà cung cấp chính: ${providersData[activeProvider]?.name || activeProvider}`);
      fetchAgentConfig();
    } catch (err: any) {
      showToast('error', 'Không thể lưu cấu hình Agent', err?.message);
    } finally {
      setSavingServerConfig(false);
    }
  };

  const persistAiToggles = async (
    nextState: {
      autoScanOnUpload: boolean;
      autoExtractSummary: boolean;
      autoSuggestNeeds: boolean;
    },
    prevState?: {
      autoScanOnUpload: boolean;
      autoExtractSummary: boolean;
      autoSuggestNeeds: boolean;
    },
    immediateLabel?: string
  ) => {
    setSavingToggles(true);
    try {
      await updateSystemSettings({
        aiAutomation: nextState,
      });

      await logAuditEvent(
        'UPDATE_AI_TOGGLES',
        'Agent AI',
        `Cập nhật tùy chọn tự động hóa Agent: Scan=${nextState.autoScanOnUpload}, Summary=${nextState.autoExtractSummary}, Suggest=${nextState.autoSuggestNeeds}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast('success', immediateLabel || 'Đã lưu tùy chọn tự động hóa Agent');
    } catch (err: any) {
      if (prevState) {
        setAutoScanOnUpload(prevState.autoScanOnUpload);
        setAutoExtractSummary(prevState.autoExtractSummary);
        setAutoSuggestNeeds(prevState.autoSuggestNeeds);
      }
      showToast('error', 'Lỗi khi lưu cấu hình', err?.message);
    } finally {
      setSavingToggles(false);
    }
  };

  const handleSaveToggles = async () => {
    await persistAiToggles({
      autoScanOnUpload,
      autoExtractSummary,
      autoSuggestNeeds,
    });
  };

  const handleToggleAutomationSwitch = (
    field: 'autoScanOnUpload' | 'autoExtractSummary' | 'autoSuggestNeeds',
    label: string
  ) => {
    const prevState = {
      autoScanOnUpload,
      autoExtractSummary,
      autoSuggestNeeds,
    };
    const nextValue = !prevState[field];
    const nextState = {
      ...prevState,
      [field]: nextValue,
    };
    setAutoScanOnUpload(nextState.autoScanOnUpload);
    setAutoExtractSummary(nextState.autoExtractSummary);
    setAutoSuggestNeeds(nextState.autoSuggestNeeds);
    void persistAiToggles(
      nextState,
      prevState,
      nextValue ? `Đã BẬT: ${label}` : `Đã TẮT: ${label}`
    );
  };

  const handleRunTestScan = async () => {
    if (!sampleDocText.trim()) return;
    setTestingScan(true);
    setScanResult(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/ai/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent: sampleDocText }),
      });
      const data = await res.json();
      setScanLatency(Date.now() - start);
      if (res.ok) {
        setScanResult(data);
        showToast('success', 'Agent trích xuất văn bản thành công!');
      } else {
        showToast('error', 'Lỗi khi Agent đọc văn bản', data.error);
      }
    } catch (err: any) {
      showToast('error', 'Lỗi kết nối', err?.message);
    } finally {
      setTestingScan(false);
    }
  };

  const handleRunTestNeeds = async () => {
    if (!sampleCitizenQuery.trim()) return;
    setTestingNeeds(true);
    setNeedsResult(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/ai/suggest-needs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: sampleCitizenQuery, role: 'citizen' }),
      });
      const data = await res.json();
      setNeedsLatency(Date.now() - start);
      if (res.ok) {
        setNeedsResult(data);
        showToast('success', 'Agent phân loại nhu cầu thành công!');
      } else {
        showToast('error', 'Lỗi phân tích nhu cầu', data.error);
      }
    } catch (err: any) {
      showToast('error', 'Lỗi kết nối', err?.message);
    } finally {
      setTestingNeeds(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-linear-to-br from-indigo-900 via-slate-900 to-purple-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
              <Bot className="w-3.5 h-3.5" />
              <span>Trung tâm Điều phối Agent AI (Gemini &amp; ChatGPT)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Agent AI &amp; Tự Động Hóa Trạm Y Tế
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Chọn nhà cung cấp AI giữa 2 nền tảng: <strong>Google Gemini</strong> và <strong>ChatGPT (OpenAI)</strong>. Tự động dự phòng thông minh khi có sự cố mạng hoặc hết hạn mức.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchAgentConfig}
              disabled={loadingConfig}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs inline-flex items-center gap-2 transition cursor-pointer backdrop-blur-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingConfig ? 'animate-spin' : ''}`} />
              <span>Tải lại</span>
            </button>
            <button
              type="button"
              onClick={handleSaveServerConfig}
              disabled={savingServerConfig}
              className="px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs inline-flex items-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-500/30"
            >
              <Zap className="w-4 h-4" />
              <span>{savingServerConfig ? 'Đang lưu...' : 'Lưu Cấu Hình Agent'}</span>
            </button>
          </div>
        </div>
      </div>

      {configFetchError && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Chưa đồng bộ được trạng thái API Key từ máy chủ</p>
              <p className="opacity-90 mt-0.5">
                {configFetchError} Bảng cấu hình khóa API &amp; hướng dẫn lấy API miễn phí bên dưới vẫn hiển thị đầy đủ để bạn thao tác.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAgentConfig}
            disabled={loadingConfig}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer"
          >
            Thử đồng bộ lại
          </button>
        </div>
      )}

      {/* Active Provider Selector */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Chọn Nhà Cung Cấp Hoạt Động Chính (Active Provider)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Agent sẽ ưu tiên sử dụng nhà cung cấp này để quét văn bản và phân loại nhu cầu dịch vụ y tế.
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            Đang chọn: {providersData[activeProvider]?.name || activeProvider}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {Object.keys(providersData).map(id => {
            const p = providersData[id];
            const isSelected = activeProvider === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveProvider(id as AiProviderType)}
                className={`p-4 rounded-2xl border text-left transition flex flex-col justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                    {p.name}
                  </span>
                  {isSelected ? (
                    <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {providerStates[id]?.selectedModel || p.defaultModel}
                  </div>
                  <div className="text-[10px]">
                    {p.isConfigured ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">● Đã cấu hình</span>
                    ) : (
                      <span className="text-amber-500 font-medium">○ Chưa có khóa</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detailed Provider Config Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Chi Tiết Khóa API &amp; Hướng Dẫn Lấy API (Miễn Phí) Từng Nhà Cung Cấp</span>
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {Object.keys(providersData).map(id => {
            const p = providersData[id];
            const pState = providerStates[id] || {
              apiKeyInput: '',
              showRawKey: false,
              selectedModel: p.defaultModel,
              isTesting: false,
              testResult: null,
              showGuide: false,
            };

            const isCurrentActive = activeProvider === id;

            return (
              <div
                key={id}
                className={`p-6 rounded-3xl border bg-white dark:bg-slate-900 transition shadow-xs ${
                  isCurrentActive
                    ? 'border-indigo-400 dark:border-indigo-600/70'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shrink-0">
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {p.label || p.name}
                        </h3>
                        {isCurrentActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            Đang dùng
                          </span>
                        )}
                        {p.isConfigured ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Sẵn sàng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500">
                            <AlertCircle className="w-3 h-3" /> Chưa có API Key
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {p.freeGuideNotes || 'Nhà cung cấp trí tuệ nhân tạo thế hệ mới'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setProviderStates(prev => ({
                          ...prev,
                          [id]: { ...prev[id], showGuide: !prev[id]?.showGuide },
                        }))
                      }
                      className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Hướng dẫn lấy API (Miễn phí)</span>
                      {pState.showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <a
                      href={p.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                      title="Mở cổng phát triển chính thức"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Collapsible Free API Guide */}
                {pState.showGuide && (
                  <div className="my-4 p-4.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Các bước lấy API Key miễn phí cho {p.name}:
                      </span>
                      <a
                        href={p.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Mở trang lấy key</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-none pl-1 leading-relaxed">
                      {(p.freeGuideSteps || []).map((step: string, sIdx: number) => (
                        <li key={sIdx} className="flex items-start gap-2">
                          <span className="text-indigo-600 font-bold shrink-0">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                    {p.freeGuideNotes && (
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-200/50 dark:border-indigo-900/50 italic">
                        💡 Lưu ý: {p.freeGuideNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Key Input & Model Controls */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
                  <div className="md:col-span-7 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Khóa API (API Key)
                      </label>
                      {p.apiKeyMasked && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Khóa hiện tại: {p.apiKeyMasked}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={pState.showRawKey ? 'text' : 'password'}
                        value={pState.apiKeyInput}
                        onChange={e =>
                          setProviderStates(prev => ({
                            ...prev,
                            [id]: { ...prev[id], apiKeyInput: e.target.value },
                          }))
                        }
                        placeholder={p.apiKeyMasked ? 'Dán khóa mới nếu muốn thay đổi...' : 'Dán mã API Key vào đây (vd: AIzaSy..., sk-proj...)'}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProviderStates(prev => ({
                            ...prev,
                            [id]: { ...prev[id], showRawKey: !prev[id]?.showRawKey },
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={pState.showRawKey ? 'Ẩn khóa' : 'Hiện khóa'}
                      >
                        {pState.showRawKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Mô hình (Model)
                    </label>
                    <select
                      value={pState.selectedModel || p.defaultModel}
                      onChange={e =>
                        setProviderStates(prev => ({
                          ...prev,
                          [id]: { ...prev[id], selectedModel: e.target.value },
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {(p.availableModels || [p.defaultModel]).map((m: string) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="button"
                      onClick={() => handleTestProvider(id)}
                      disabled={pState.isTesting}
                      className="w-full py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className={`w-3.5 h-3.5 text-amber-500 ${pState.isTesting ? 'animate-bounce' : ''}`} />
                      <span>{pState.isTesting ? 'Kiểm tra...' : 'Test Key'}</span>
                    </button>
                  </div>
                </div>

                {/* Test Result Message */}
                {pState.testResult && (
                  <div
                    className={`mt-3 p-3 rounded-2xl text-xs flex items-start gap-2.5 ${
                      pState.testResult.ok
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {pState.testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-semibold">{pState.testResult.message}</div>
                      {pState.testResult.preview && (
                        <div className="text-[11px] font-mono opacity-80">
                          Phản hồi Agent: {pState.testResult.preview}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
              <span>Bật / Tắt Tính Năng Tự Động Hóa Agent</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kiểm soát các điểm chạm tự động của Agent đối với dữ liệu văn bản và hành động của công dân.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveToggles}
            disabled={savingToggles}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-sm"
          >
            {savingToggles ? 'Đang lưu...' : 'Lưu Tùy Chọn'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                Tự động quét khi chọn tệp văn bản
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Khi cán bộ chọn PDF/Word/Ảnh, Agent sẽ tự động trích xuất số hiệu, tiêu đề và ngày ban hành.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoScanOnUpload}
              aria-label="Tự động quét khi chọn tệp văn bản"
              onClick={() =>
                handleToggleAutomationSwitch('autoScanOnUpload', 'Tự động quét khi chọn tệp văn bản')
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                autoScanOnUpload ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  autoScanOnUpload ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                Tự động tóm tắt nội dung văn bản
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Tự động cô đọng 1-2 câu nội dung trọng tâm để người dân nắm bắt nhanh chỉ đạo y tế.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoExtractSummary}
              aria-label="Tự động tóm tắt nội dung văn bản"
              onClick={() =>
                handleToggleAutomationSwitch('autoExtractSummary', 'Tự động tóm tắt nội dung văn bản')
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                autoExtractSummary ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  autoExtractSummary ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white block">
                Trợ lý Agent phân loại nhu cầu dịch vụ
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Phân tích câu hỏi người dân nhập tại Trang chủ để điều hướng chính xác đến tính năng trạm.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSuggestNeeds}
              aria-label="Trợ lý Agent phân loại nhu cầu dịch vụ"
              onClick={() =>
                handleToggleAutomationSwitch('autoSuggestNeeds', 'Trợ lý Agent phân loại nhu cầu dịch vụ')
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                autoSuggestNeeds ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                  autoSuggestNeeds ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Live Interactive Playground */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Playground: Document Scanner */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Thực nghiệm Quét &amp; Đọc Văn Bản</span>
            </h3>
            {scanLatency && (
              <span className="text-[10px] font-mono text-slate-400">
                Độ trễ: {scanLatency}ms
              </span>
            )}
          </div>

          <textarea
            value={sampleDocText}
            onChange={e => setSampleDocText(e.target.value)}
            rows={4}
            className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
            placeholder="Nhập nội dung văn bản thử nghiệm..."
          />

          <button
            type="button"
            onClick={handleRunTestScan}
            disabled={testingScan}
            className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className={`w-3.5 h-3.5 ${testingScan ? 'animate-spin' : ''}`} />
            <span>{testingScan ? 'Agent đang phân tích...' : 'Chạy thử Agent Đọc Văn Bản'}</span>
          </button>

          {scanResult && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span className="font-bold text-indigo-600">Kết quả trích xuất</span>
                {scanResult._meta && (
                  <span className="font-mono">
                    {scanResult._meta.provider} · {scanResult._meta.model}
                  </span>
                )}
              </div>
              <div className="font-bold text-slate-900 dark:text-white">{scanResult.title}</div>
              <div className="text-slate-600 dark:text-slate-300">
                <strong>Số hiệu:</strong> {scanResult.docNumber} · <strong>Ngày:</strong> {scanResult.issueDate}
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                <strong>Cơ quan:</strong> {scanResult.issuingAuthority} · <strong>Thể loại:</strong> {scanResult.category}
              </div>
              {scanResult.summary && (
                <div className="text-slate-500 italic pt-1 border-t border-slate-200 dark:border-slate-700">
                  &ldquo;{scanResult.summary}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Playground: Smart Need Finder */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-600" />
              <span>Thực nghiệm Gợi Ý Dịch Vụ Theo Nhu Cầu</span>
            </h3>
            {needsLatency && (
              <span className="text-[10px] font-mono text-slate-400">
                Độ trễ: {needsLatency}ms
              </span>
            )}
          </div>

          <div className="space-y-2">
            <input
              type="text"
              value={sampleCitizenQuery}
              onChange={e => setSampleCitizenQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-purple-500"
              placeholder="Nhập câu hỏi công dân (vd: Tôi muốn xin giấy chứng sinh)..."
            />
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="text-slate-400">Mẫu thử:</span>
              <button
                type="button"
                onClick={() => setSampleCitizenQuery('Đăng ký tiêm chủng cho trẻ')}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 cursor-pointer"
              >
                Tiêm chủng
              </button>
              <button
                type="button"
                onClick={() => setSampleCitizenQuery('Lịch trực trạm y tế hôm nay')}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 cursor-pointer"
              >
                Lịch trực
              </button>
              <button
                type="button"
                onClick={() => setSampleCitizenQuery('Tra cứu thông tin BHYT')}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-purple-600 cursor-pointer"
              >
                BHYT
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunTestNeeds}
            disabled={testingNeeds}
            className="w-full py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className={`w-3.5 h-3.5 ${testingNeeds ? 'animate-spin' : ''}`} />
            <span>{testingNeeds ? 'Agent đang phân loại...' : 'Chạy thử Agent Gợi Ý'}</span>
          </button>

          {needsResult && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span className="font-bold text-purple-600">Đích đến gợi ý: {needsResult.suggestedTarget}</span>
                {needsResult._meta && (
                  <span className="font-mono">
                    {needsResult._meta.provider} · {needsResult._meta.model}
                  </span>
                )}
              </div>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Phân tích:</strong> {needsResult.reasoning}
              </div>
              {Array.isArray(needsResult.recommendedActions) && (
                <div className="pt-2 flex flex-wrap gap-1.5">
                  {needsResult.recommendedActions.map((act: any, aIdx: number) => (
                    <span
                      key={aIdx}
                      className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[11px] font-semibold"
                    >
                      {act.label} ({act.target})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
