import fs from 'fs';
import path from 'path';
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

  // Default fallback
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

  // Final fallback to Gemini environment key if not already tried
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
