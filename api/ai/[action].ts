import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export type AiProviderType = 'gemini' | 'openai';

export interface StoredAiProvider {
  apiKey?: string;
  model?: string;
  isConfigured?: boolean;
  updatedAt?: string;
}

export interface StoredAiAgentConfig {
  activeProvider: AiProviderType;
  fallbackOrder: AiProviderType[];
  providers: Partial<Record<AiProviderType, StoredAiProvider>>;
  updatedAt?: string;
}

export interface AiProviderInfo {
  id: AiProviderType;
  name: string;
  label: string;
  defaultModel: string;
  availableModels: string[];
  docsUrl: string;
  freeGuideSteps: string[];
  freeGuideNotes?: string;
}

const CONFIG_FILE = path.resolve(
  process.env.VERCEL ? '/tmp' : process.cwd(),
  '.ai-agent-config.json'
);

const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

export const AI_PROVIDERS_INFO: Record<AiProviderType, AiProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    label: 'Google Gemini (Khuyên dùng)',
    defaultModel: DEFAULT_GEMINI_MODEL,
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
  },
};

const VALID_PROVIDER_IDS: AiProviderType[] = ['gemini', 'openai'];

function normalizeGeminiModel(rawModel?: string): string {
  const m = (rawModel || '').trim();
  if (!m) return DEFAULT_GEMINI_MODEL;
  if (AI_PROVIDERS_INFO.gemini.availableModels.includes(m)) return m;
  return DEFAULT_GEMINI_MODEL;
}

export function maskApiKey(key?: string): string {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-4);
  return `${head}••••••••${tail}`;
}

export function loadStoredAiConfig(): StoredAiAgentConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const activeProvider: AiProviderType =
          parsed.activeProvider === 'openai' ? 'openai' : 'gemini';
        const parsedFallback = Array.isArray(parsed.fallbackOrder)
          ? (parsed.fallbackOrder.filter((id: unknown): id is AiProviderType =>
              VALID_PROVIDER_IDS.includes(id as AiProviderType)
            ) as AiProviderType[])
          : [];
        const fallbackOrder: AiProviderType[] =
          parsedFallback.length > 0 ? parsedFallback : ['gemini', 'openai'];
        const rawProviders = parsed.providers || {};
        const providers: Partial<Record<AiProviderType, StoredAiProvider>> = {};
        if (rawProviders.gemini) {
          providers.gemini = {
            ...rawProviders.gemini,
            model: normalizeGeminiModel(rawProviders.gemini.model),
          };
        }
        if (rawProviders.openai) {
          providers.openai = {
            ...rawProviders.openai,
            model: rawProviders.openai.model || AI_PROVIDERS_INFO.openai.defaultModel,
          };
        }

        return {
          activeProvider,
          fallbackOrder,
          providers,
          updatedAt: parsed.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn('Could not read .ai-agent-config.json:', err);
  }

  const geminiEnv = (process.env.GEMINI_API_KEY || '').trim();
  return {
    activeProvider: 'gemini',
    fallbackOrder: ['gemini', 'openai'],
    providers: {
      gemini: {
        apiKey: geminiEnv && geminiEnv !== 'MY_GEMINI_API_KEY' ? geminiEnv : undefined,
        model: DEFAULT_GEMINI_MODEL,
        isConfigured: Boolean(geminiEnv && geminiEnv !== 'MY_GEMINI_API_KEY'),
      },
    },
  };
}

export function saveStoredAiConfig(config: StoredAiAgentConfig): void {
  try {
    const normalized: StoredAiAgentConfig = {
      activeProvider: config.activeProvider === 'openai' ? 'openai' : 'gemini',
      fallbackOrder: ['gemini', 'openai'],
      providers: {
        ...(config.providers.gemini ? { gemini: config.providers.gemini } : {}),
        ...(config.providers.openai ? { openai: config.providers.openai } : {}),
      },
      updatedAt: config.updatedAt,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(normalized, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write .ai-agent-config.json:', err);
    throw new Error('Không thể lưu tệp cấu hình Agent trên máy chủ.');
  }
}

export function getClientSafeAgentConfig() {
  const stored = loadStoredAiConfig();
  const clientProviders: Record<string, any> = {};

  VALID_PROVIDER_IDS.forEach(id => {
    const info = AI_PROVIDERS_INFO[id];
    const prov = stored.providers[id];
    const hasKey = Boolean(prov?.apiKey && prov.apiKey.trim().length > 0);
    const envKeyAvailable =
      id === 'gemini' &&
      Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    clientProviders[id] = {
      ...info,
      model: id === 'gemini' ? normalizeGeminiModel(prov?.model) : prov?.model || info.defaultModel,
      isConfigured: hasKey || envKeyAvailable,
      apiKeyMasked: hasKey
        ? maskApiKey(prov?.apiKey)
        : envKeyAvailable
          ? 'AIzaSy••••••••(Biến môi trường)'
          : '',
      updatedAt: prov?.updatedAt,
    };
  });

  return {
    activeProvider: stored.activeProvider || 'gemini',
    fallbackOrder: stored.fallbackOrder || ['gemini', 'openai'],
    providers: clientProviders,
    updatedAt: stored.updatedAt,
  };
}

export function exportAiAgentConfigForBackup(): {
  hasConfigured: boolean;
  record: Record<string, any> | null;
} {
  let fileExists = false;
  try {
    fileExists = fs.existsSync(CONFIG_FILE);
  } catch {
    fileExists = false;
  }
  const stored = loadStoredAiConfig();
  const hasProviderKeys = VALID_PROVIDER_IDS.some(id => {
    const prov = stored.providers?.[id];
    return Boolean(prov?.apiKey && prov.apiKey.trim().length > 0);
  });
  const hasConfigured = Boolean(
    fileExists ||
      hasProviderKeys ||
      stored.updatedAt ||
      stored.activeProvider !== 'gemini'
  );
  if (!hasConfigured) {
    return { hasConfigured: false, record: null };
  }
  return {
    hasConfigured: true,
    record: {
      id: 'ai_agent_config',
      activeProvider: stored.activeProvider || 'gemini',
      fallbackOrder: stored.fallbackOrder || ['gemini', 'openai'],
      providers: stored.providers || {},
      updatedAt: stored.updatedAt || new Date().toISOString(),
    },
  };
}

export function restoreAiAgentConfigFromBackup(rawRecord: Record<string, any>): void {
  if (!rawRecord || typeof rawRecord !== 'object') {
    throw new Error('Dữ liệu cấu hình Agent AI sao lưu không hợp lệ.');
  }
  const existing = loadStoredAiConfig();
  const activeProvider: AiProviderType =
    rawRecord.activeProvider === 'openai'
      ? 'openai'
      : rawRecord.activeProvider === 'gemini'
      ? 'gemini'
      : existing.activeProvider || 'gemini';

  const incomingFallback = Array.isArray(rawRecord.fallbackOrder)
    ? rawRecord.fallbackOrder.filter((id: unknown): id is AiProviderType =>
        VALID_PROVIDER_IDS.includes(id as AiProviderType)
      )
    : [];
  const fallbackOrder: AiProviderType[] =
    incomingFallback.length > 0 ? incomingFallback : existing.fallbackOrder || ['gemini', 'openai'];

  const nextProviders: Partial<Record<AiProviderType, StoredAiProvider>> = {
    ...(existing.providers || {}),
  };
  const rawProviders = rawRecord.providers && typeof rawRecord.providers === 'object'
    ? rawRecord.providers
    : {};

  for (const id of VALID_PROVIDER_IDS) {
    const inc = rawProviders[id];
    if (!inc || typeof inc !== 'object') continue;
    const prevProv = nextProviders[id] || {};
    const incKey = typeof inc.apiKey === 'string' && inc.apiKey.trim() && !inc.apiKey.includes('••••')
      ? inc.apiKey.trim()
      : prevProv.apiKey;
    const incModel =
      typeof inc.model === 'string' && inc.model.trim()
        ? id === 'gemini'
          ? normalizeGeminiModel(inc.model)
          : inc.model.trim()
        : prevProv.model || AI_PROVIDERS_INFO[id].defaultModel;

    nextProviders[id] = {
      ...(prevProv || {}),
      model: incModel,
      ...(incKey ? { apiKey: incKey, isConfigured: true } : { isConfigured: Boolean(prevProv.isConfigured) }),
      updatedAt:
        typeof inc.updatedAt === 'string' && inc.updatedAt
          ? inc.updatedAt
          : prevProv.updatedAt || new Date().toISOString(),
    };
  }

  saveStoredAiConfig({
    activeProvider,
    fallbackOrder,
    providers: nextProviders,
    updatedAt:
      typeof rawRecord.updatedAt === 'string' && rawRecord.updatedAt
        ? rawRecord.updatedAt
        : new Date().toISOString(),
  });
}

export async function callSpecificAiProvider(options: {
  provider: AiProviderType;
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  timeoutMs?: number;
  fileBase64?: string;
  mimeType?: string;
}): Promise<{ text: string }> {
  const {
    provider,
    apiKey,
    model,
    prompt,
    systemPrompt,
    jsonMode,
    timeoutMs = 15000,
    fileBase64,
    mimeType,
  } = options;
  const cleanKey = apiKey.trim();

  if (!cleanKey) {
    throw new Error(`Chưa cấu hình API Key cho nhà cung cấp ${provider}.`);
  }

  const hasInlineMedia =
    typeof fileBase64 === 'string' &&
    fileBase64.length > 0 &&
    typeof mimeType === 'string' &&
    (mimeType === 'application/pdf' || mimeType.startsWith('image/'));

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const contentsPayload: any = hasInlineMedia
        ? {
            parts: [
              { inlineData: { mimeType: String(mimeType), data: String(fileBase64) } },
              { text: fullPrompt },
            ],
          }
        : fullPrompt;
      const resp = await ai.models.generateContent({
        model: normalizeGeminiModel(model),
        contents: contentsPayload,
        config: jsonMode
          ? {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
            }
          : undefined,
      });
      return { text: resp.text || '' };
    }

    if (provider === 'openai') {
      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      if (hasInlineMedia && mimeType?.startsWith('image/')) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
          ],
        });
      } else {
        messages.push({ role: 'user', content: prompt });
      }

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OpenAI HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data: any = await resp.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return { text: content };
    }

    throw new Error(`Nhà cung cấp AI không được hỗ trợ: ${provider}`);
  } finally {
    clearTimeout(timeoutTimer);
  }
}

export async function testProviderConnection(
  provider: AiProviderType,
  apiKey: string,
  model?: string
): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
  responsePreview?: string;
}> {
  const startTime = Date.now();
  const testPrompt =
    'Hãy trả về đúng chuỗi JSON: {"status": "ok", "agent": "connected"}. Không kèm giải thích.';

  try {
    const res = await callSpecificAiProvider({
      provider,
      apiKey,
      model: model || AI_PROVIDERS_INFO[provider].defaultModel,
      prompt: testPrompt,
      systemPrompt: 'Bạn là Agent kiểm tra kết nối API hệ thống y tế.',
      jsonMode: true,
      timeoutMs: 12000,
    });

    const latencyMs = Date.now() - startTime;
    return {
      ok: true,
      latencyMs,
      message: `Kết nối thành công đến ${AI_PROVIDERS_INFO[provider].name} (Độ trễ: ${latencyMs}ms)`,
      responsePreview: res.text.slice(0, 160),
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      latencyMs,
      message: err?.message || `Không thể kết nối đến ${AI_PROVIDERS_INFO[provider].name}.`,
    };
  }
}

export async function executeAgentRequest(options: {
  prompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  fileBase64?: string;
  mimeType?: string;
}): Promise<{ text: string; providerUsed: string; modelUsed: string }> {
  const config = loadStoredAiConfig();
  const primaryProvider: AiProviderType =
    config.activeProvider === 'openai' ? 'openai' : 'gemini';
  const order: AiProviderType[] = [
    primaryProvider,
    ...VALID_PROVIDER_IDS.filter(p => p !== primaryProvider),
  ];

  let lastError: any = null;

  for (const provId of order) {
    const prov = config.providers[provId];
    let key = prov?.apiKey?.trim() || '';
    if (!key && provId === 'gemini') {
      key = (process.env.GEMINI_API_KEY || '').trim();
      if (key === 'MY_GEMINI_API_KEY') key = '';
    }

    if (!key) continue;

    const model =
      provId === 'gemini'
        ? normalizeGeminiModel(prov?.model)
        : prov?.model || AI_PROVIDERS_INFO[provId].defaultModel;

    try {
      const res = await callSpecificAiProvider({
        provider: provId,
        apiKey: key,
        model,
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        jsonMode: options.jsonMode,
        fileBase64: options.fileBase64,
        mimeType: options.mimeType,
        timeoutMs: 14000,
      });

      if (res.text && res.text.trim().length > 0) {
        return {
          text: res.text,
          providerUsed: AI_PROVIDERS_INFO[provId].name,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      console.warn(`Provider ${provId} failed in Agent pipeline:`, err?.message || err);
      lastError = err;
    }
  }

  const envGemini = (process.env.GEMINI_API_KEY || '').trim();
  if (envGemini && envGemini !== 'MY_GEMINI_API_KEY') {
    try {
      const res = await callSpecificAiProvider({
        provider: 'gemini',
        apiKey: envGemini,
        model: DEFAULT_GEMINI_MODEL,
        prompt: options.prompt,
        systemPrompt: options.systemPrompt,
        jsonMode: options.jsonMode,
        fileBase64: options.fileBase64,
        mimeType: options.mimeType,
        timeoutMs: 12000,
      });
      return {
        text: res.text,
        providerUsed: 'Google Gemini (Môi trường máy chủ)',
        modelUsed: DEFAULT_GEMINI_MODEL,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    lastError?.message || 'Không có nhà cung cấp Agent AI nào khả dụng hoặc tất cả đều hết hạn mức.'
  );
}

function safeParseJsonObject(rawText?: string): Record<string, any> | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const stripped = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!stripped) return null;
  try {
    const parsed = JSON.parse(stripped);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const firstBrace = stripped.indexOf('{');
    const lastBrace = stripped.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const BOOTSTRAP_ADMIN_SET = new Set([
  'sonlyhongduc@gmail.com',
  'sonlyhongduc2003@gmail.com',
  'tytvtd@gmail.com',
  'bmassk3@gmail.com',
]);

function getFirebaseAppletCfg() {
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(process.cwd(), 'firebase-applet-config.json'),
      path.resolve(moduleDir, '..', '..', 'firebase-applet-config.json'),
    ];
    const cfgPath = candidates.find(p => fs.existsSync(p));
    if (cfgPath) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    }
  } catch {
    // ignore
  }
  const envApiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
  const envProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
  const envDatabaseId =
    process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || '';
  if (envApiKey || envProjectId) {
    return {
      apiKey: envApiKey,
      projectId: envProjectId,
      firestoreDatabaseId: envDatabaseId || '(default)',
    };
  }
  return {};
}

async function verifyAdminBearer(authHeader?: string): Promise<{ isAdmin: boolean; error?: string }> {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { isAdmin: false, error: 'Thiếu mã xác thực Quản trị viên (Bearer token).' };
  }
  const fbCfg = getFirebaseAppletCfg();
  if (!fbCfg?.apiKey) {
    return { isAdmin: false, error: 'Không tìm thấy cấu hình Firebase API Key máy chủ.' };
  }
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(fbCfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!resp.ok) {
      return { isAdmin: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' };
    }
    const data = (await resp.json()) as { users?: Array<{ localId?: string; email?: string }> };
    const user = data?.users?.[0];
    if (!user?.localId) {
      return { isAdmin: false, error: 'Không xác minh được danh tính tài khoản Firebase.' };
    }
    const email = String(user.email || '').trim().toLowerCase();
    if (BOOTSTRAP_ADMIN_SET.has(email)) {
      return { isAdmin: true };
    }
    if (fbCfg.projectId && fbCfg.firestoreDatabaseId) {
      const adminUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        fbCfg.projectId
      )}/databases/${encodeURIComponent(fbCfg.firestoreDatabaseId)}/documents/admins/${encodeURIComponent(
        user.localId
      )}`;
      const adminResp = await fetch(adminUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (adminResp.ok) return { isAdmin: true };

      const userUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        fbCfg.projectId
      )}/databases/${encodeURIComponent(fbCfg.firestoreDatabaseId)}/documents/users/${encodeURIComponent(
        user.localId
      )}`;
      const userResp = await fetch(userUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (userResp.ok) {
        const userDoc = (await userResp.json().catch(() => ({}))) as {
          fields?: { role?: { stringValue?: string }; accountType?: { stringValue?: string } };
        };
        const role = userDoc?.fields?.role?.stringValue || '';
        const accountType = userDoc?.fields?.accountType?.stringValue || '';
        if (role === 'admin' || role === 'super_admin' || accountType === 'admin') {
          return { isAdmin: true };
        }
      }
    }
    return { isAdmin: false, error: 'Chỉ Quản trị viên hệ thống mới có quyền thao tác cấu hình Agent AI.' };
  } catch (err: any) {
    return { isAdmin: false, error: err?.message || 'Lỗi xác minh quyền Quản trị viên.' };
  }
}

function resolveAction(req: any): string {
  const rawQueryAction = req.query?.action;
  if (typeof rawQueryAction === 'string' && rawQueryAction.trim()) {
    return rawQueryAction.trim().toLowerCase();
  }
  if (Array.isArray(rawQueryAction) && rawQueryAction[0]) {
    return String(rawQueryAction[0]).trim().toLowerCase();
  }
  try {
    const pathname = new URL(req.url || '', 'http://localhost').pathname;
    const segments = pathname.split('/').filter(Boolean);
    return (segments[segments.length - 1] || '').toLowerCase();
  } catch {
    return '';
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = resolveAction(req);

  if (action === 'status') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức GET' });
    }
    const config = getClientSafeAgentConfig();
    const activeInfo = config.providers[config.activeProvider];
    const configured = Boolean(activeInfo?.isConfigured);
    return res.json({
      ok: true,
      configured,
      activeProvider: config.activeProvider,
      providerName: activeInfo?.name || 'Agent AI',
      model: activeInfo?.model || 'Default',
      provider: activeInfo?.name || 'Google Gemini AI',
      configuredVia: `Hệ thống Agent AI (${activeInfo?.name || 'Gemini'})`,
      statusMessage: configured
        ? `Agent sẵn sàng qua ${activeInfo?.name} (${activeInfo?.model})`
        : 'Chưa cấu hình API Key cho Agent (vào Bảng quản trị > Agent để thiết lập)',
      capabilities: [
        'Tự động đọc & quét tài liệu đa phương thức (PDF, Word, Ảnh văn bản)',
        'Trích xuất tự động: Số hiệu, Tiêu đề, Ngày ban hành, Cơ quan ban hành, Thể loại, Tóm tắt',
        'Giao diện hiển thị văn bản 1 dòng chuẩn hóa kèm chức năng xem chi tiết',
        'Trợ lý Agent thông minh phân loại và gợi ý dịch vụ y tế cho công dân',
        'Hỗ trợ 2 nền tảng AI chính: Google Gemini và ChatGPT (OpenAI) với dự phòng tự động',
      ],
      updatedAt: new Date().toISOString(),
    });
  }

  if (action === 'agent-config') {
    const roleCheck = await verifyAdminBearer(req.headers?.authorization);
    if (!roleCheck.isAdmin) {
      return res.status(403).json({ error: roleCheck.error || 'Chỉ Quản trị viên mới có quyền truy cập cấu hình Agent AI.' });
    }
    if (req.method === 'GET') {
      try {
        return res.json(getClientSafeAgentConfig());
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Lỗi đọc cấu hình Agent' });
      }
    }
    if (req.method === 'POST') {
      try {
        const { activeProvider, providers, fallbackOrder } = req.body || {};
        const current = loadStoredAiConfig();

        if (activeProvider && AI_PROVIDERS_INFO[activeProvider as AiProviderType]) {
          current.activeProvider = activeProvider as AiProviderType;
        }
        if (Array.isArray(fallbackOrder) && fallbackOrder.length > 0) {
          current.fallbackOrder = fallbackOrder.filter(id => AI_PROVIDERS_INFO[id as AiProviderType]);
        }
        if (providers && typeof providers === 'object') {
          (Object.keys(providers) as AiProviderType[]).forEach(id => {
            if (!AI_PROVIDERS_INFO[id]) return;
            const incoming = providers[id];
            if (!incoming) return;
            current.providers[id] = current.providers[id] || {};
            if (incoming.model && typeof incoming.model === 'string') {
              current.providers[id]!.model = incoming.model.trim();
            }
            const rawKey = incoming.apiKey;
            if (typeof rawKey === 'string' && rawKey.trim() && !rawKey.includes('••••')) {
              current.providers[id]!.apiKey = rawKey.trim();
              current.providers[id]!.isConfigured = true;
              current.providers[id]!.updatedAt = new Date().toISOString();
            }
          });
        }
        current.updatedAt = new Date().toISOString();
        saveStoredAiConfig(current);
        return res.json({
          ok: true,
          message: 'Đã lưu thành công cấu hình Agent AI (Gemini & ChatGPT).',
          config: getClientSafeAgentConfig(),
        });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Không thể lưu cấu hình Agent' });
      }
    }
    return res.status(405).json({ error: 'Phương thức không hợp lệ' });
  }

  if (action === 'backup-export') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức GET' });
    }
    const roleCheck = await verifyAdminBearer(req.headers?.authorization);
    if (!roleCheck.isAdmin) {
      return res.status(403).json({
        error: roleCheck.error || 'Chỉ Quản trị viên mới có quyền sao lưu cấu hình Agent AI.',
      });
    }
    try {
      const exported = exportAiAgentConfigForBackup();
      return res.json({ ok: true, ...exported });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Không thể xuất cấu hình Agent AI.' });
    }
  }

  if (action === 'backup-restore') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
    }
    const roleCheck = await verifyAdminBearer(req.headers?.authorization);
    if (!roleCheck.isAdmin) {
      return res.status(403).json({
        error: roleCheck.error || 'Chỉ Quản trị viên mới có quyền khôi phục cấu hình Agent AI.',
      });
    }
    try {
      const record = req.body?.record || req.body || {};
      restoreAiAgentConfigFromBackup(record);
      return res.json({ ok: true });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Không thể khôi phục cấu hình Agent AI.' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST' });
  }

  if (action === 'test-provider') {
    const roleCheck = await verifyAdminBearer(req.headers?.authorization);
    if (!roleCheck.isAdmin) {
      return res.status(403).json({ error: roleCheck.error || 'Chỉ Quản trị viên mới có quyền kiểm tra kết nối Agent AI.' });
    }
    try {
      const { provider, apiKey, model } = req.body || {};
      if (!provider || !AI_PROVIDERS_INFO[provider as AiProviderType]) {
        return res.status(400).json({ error: 'Nhà cung cấp AI không hợp lệ.' });
      }
      let effectiveKey = typeof apiKey === 'string' ? apiKey.trim() : '';
      if (!effectiveKey || effectiveKey.includes('••••')) {
        const stored = loadStoredAiConfig();
        effectiveKey = stored.providers[provider as AiProviderType]?.apiKey || '';
        if (!effectiveKey && provider === 'gemini') {
          const envKey = (process.env.GEMINI_API_KEY || '').trim();
          effectiveKey = envKey && envKey !== 'MY_GEMINI_API_KEY' ? envKey : '';
        }
      }
      if (!effectiveKey) {
        return res.status(400).json({
          error: `Vui lòng nhập API Key cho ${AI_PROVIDERS_INFO[provider as AiProviderType].name}.`,
        });
      }
      const result = await testProviderConnection(provider as AiProviderType, effectiveKey, model);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ ok: false, message: err?.message || 'Lỗi khi kiểm tra kết nối API' });
    }
  }

  if (action === 'suggest-needs') {
    try {
      const { userQuery, role } = req.body || {};
      if (!userQuery || typeof userQuery !== 'string') {
        return res.status(400).json({ error: 'Nhu cầu không được để trống' });
      }

      const prompt = `Bạn là Trợ lý Agent Phân Loại Nhu Cầu của Cổng Thông Tin Điện Tử Trạm Y Tế Xã/Phường.
Người dùng (vai trò: ${role || 'công dân'}) nhập yêu cầu: "${userQuery}".

Hãy phân tích nhu cầu và trả về JSON gợi ý tính năng phù hợp nhất trong hệ thống.
Các target có thể chọn:
- portal: Trang chủ & Giới thiệu trạm
- duty: Lịch trực 24/7 công khai trạm y tế
- map: Bản đồ định vị & Chỉ đường trạm y tế
- telehealth: Ứng dụng Bác sĩ cho mọi nhà (tư vấn trực tuyến)
- news: Tin tức truyền thông y tế
- documents: Văn bản biểu mẫu khai báo
- feedback: Gửi ý kiến phản ánh BHYT, dịch vụ
- tracking: Tra cứu tiến độ giải quyết phản ánh
- apps: Kho ứng dụng tiện ích
- workspace: Bàn làm việc y tế (dành cho cán bộ)

Định dạng JSON bắt buộc:
{
  "suggestedTarget": "tên_target",
  "reasoning": "Lý do gợi ý",
  "recommendedActions": [
    { "label": "Nhãn hành động", "target": "tên_target" }
  ]
}`;

      const aiResponse = await executeAgentRequest({
        prompt,
        systemPrompt: 'Bạn là Agent phân tích dữ liệu y tế, luôn trả về JSON hợp lệ.',
        jsonMode: true,
      });

      const parsedData = safeParseJsonObject(aiResponse.text);
      if (!parsedData || !parsedData.suggestedTarget) {
        return res.status(502).json({ error: 'Agent AI trả về định dạng JSON không hợp lệ.' });
      }
      return res.json({
        ...parsedData,
        _meta: { provider: aiResponse.providerUsed, model: aiResponse.modelUsed },
      });
    } catch (error: any) {
      console.error('AI Suggestion error:', error?.message || error);
      return res.status(502).json({ error: error?.message || 'Lỗi xử lý yêu cầu Agent AI.' });
    }
  }

  if (action === 'scan-document') {
    const docNameRaw = req.body?.fileName || req.body?.filename || '';
    const cleanBaseTitle = docNameRaw
      ? String(docNameRaw).replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
      : 'Văn bản y tế';

    try {
      const { textContent, filename, fileName, fileBase64, mimeType } = req.body || {};
      const effectiveFilename = String(filename || fileName || 'van-ban.txt');
      const normalizedText = typeof textContent === 'string' ? textContent.trim() : '';
      const hasInlineMedia =
        typeof fileBase64 === 'string' &&
        fileBase64.length > 0 &&
        typeof mimeType === 'string' &&
        (mimeType === 'application/pdf' || mimeType.startsWith('image/'));

      if (!normalizedText && !hasInlineMedia && !docNameRaw) {
        return res.status(400).json({ error: 'Nội dung tệp không được để trống' });
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const prompt = `Bạn là Trợ lý Agent Phân Tích Văn Bản Y Tế.
Hãy đọc thông tin tập tin (tên tệp: ${effectiveFilename}) và nội dung kèm theo dưới đây:
---
${(normalizedText || effectiveFilename).slice(0, 6000)}
---

Hãy trích xuất các thông tin văn bản y tế hành chính dưới dạng JSON:
{
  "title": "Tên hoặc tiêu đề văn bản rõ ràng, có dấu",
  "docNumber": "Số hiệu văn bản (vd: 12/TB-TYT hoặc 456/QĐ-BYT)",
  "issueDate": "Ngày ban hành định dạng YYYY-MM-DD (mặc định: ${todayIso})",
  "issuingAuthority": "Cơ quan phát hành (vd: Bộ Y tế, Sở Y tế, Trạm Y tế, UBND)",
  "summary": "Tóm tắt ngắn gọn 1-2 câu về nội dung chính",
  "category": "Chỉ đạo điều hành | Tiêm chủng BHYT | Phòng chống dịch | Biểu mẫu kê khai"
}`;

      const aiResponse = await executeAgentRequest({
        prompt,
        systemPrompt: 'Bạn là chuyên viên số hóa văn bản y tế, trả về JSON chính xác không kèm markdown rác.',
        jsonMode: true,
        fileBase64: hasInlineMedia ? String(fileBase64) : undefined,
        mimeType: hasInlineMedia ? String(mimeType) : undefined,
      });

      const parsedData = safeParseJsonObject(aiResponse.text);
      if (!parsedData) {
        return res.status(502).json({ error: 'Agent AI trả về định dạng JSON không hợp lệ.' });
      }

      return res.json({
        title:
          typeof parsedData.title === 'string' && parsedData.title.trim()
            ? parsedData.title.trim()
            : cleanBaseTitle,
        docNumber:
          typeof parsedData.docNumber === 'string' && parsedData.docNumber.trim()
            ? parsedData.docNumber.trim()
            : '01/CV-TYT',
        issueDate:
          typeof parsedData.issueDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(parsedData.issueDate.trim())
            ? parsedData.issueDate.trim()
            : todayIso,
        issuingAuthority:
          typeof parsedData.issuingAuthority === 'string' && parsedData.issuingAuthority.trim()
            ? parsedData.issuingAuthority.trim()
            : 'Trạm Y tế',
        summary:
          typeof parsedData.summary === 'string' && parsedData.summary.trim()
            ? parsedData.summary.trim()
            : '',
        category:
          typeof parsedData.category === 'string' && parsedData.category.trim()
            ? parsedData.category.trim()
            : 'Chỉ đạo điều hành',
        _meta: { provider: aiResponse.providerUsed, model: aiResponse.modelUsed },
      });
    } catch (error: any) {
      console.error('AI Document Scan error:', error?.message || error);
      return res.status(502).json({ error: error?.message || 'Lỗi khi quét văn bản với Agent.' });
    }
  }

  return res.status(404).json({ error: 'Endpoint AI không tồn tại' });
}
