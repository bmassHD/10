import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

export type AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'blackbox' | 'grok';

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

export const AI_PROVIDERS_INFO: Record<AiProviderType, AiProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    label: 'Google Gemini (Khuyên dùng)',
    defaultModel: 'gemini-2.5-flash',
    availableModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    docsUrl: 'https://aistudio.google.com/app/apikey',
    freeGuideSteps: [
      '1. Truy cập trang Google AI Studio: https://aistudio.google.com/app/apikey',
      '2. Đăng nhập bằng tài khoản Google (Gmail) cá nhân hoặc tổ chức',
      '3. Nhấn vào nút xanh "Create API key" (Tạo khóa API)',
      '4. Chọn một dự án Google Cloud miễn phí hoặc nhấn "Create API key in new project"',
      '5. Sao chép chuỗi mã khóa bắt đầu bằng "AIzaSy..." và dán vào ô Khóa API bên dưới',
    ],
    freeGuideNotes: 'Miễn phí Free Tier 15 RPM, xử lý cực nhanh đa phương thức văn bản, PDF và hình ảnh y tế.',
  },
  openai: {
    id: 'openai',
    name: 'ChatGPT (OpenAI)',
    label: 'OpenAI ChatGPT (GPT-4o / GPT-4o-mini)',
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
    docsUrl: 'https://platform.openai.com/api-keys',
    freeGuideSteps: [
      '1. Truy cập cổng quản lý OpenAI Platform: https://platform.openai.com/api-keys',
      '2. Đăng nhập hoặc đăng ký tài khoản OpenAI',
      '3. Chuyển đến mục "API keys" trong menu điều hướng bên trái',
      '4. Nhấn nút "+ Create new secret key", đặt tên gợi nhớ (ví dụ: "TYT-Agent-Portal")',
      '5. Sao chép chuỗi mã bí mật bắt đầu bằng "sk-proj-..." và lưu vào ô cấu hình',
    ],
    freeGuideNotes: 'Tài khoản OpenAI đăng ký lần đầu thường có credits dùng thử miễn phí hoặc có thể nạp tối thiểu $5 để dùng gpt-4o-mini với chi phí cực thấp.',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    label: 'Anthropic Claude 3.5',
    defaultModel: 'claude-3-haiku-20240307',
    availableModels: ['claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    docsUrl: 'https://console.anthropic.com/settings/keys',
    freeGuideSteps: [
      '1. Truy cập Anthropic Console: https://console.anthropic.com/settings/keys',
      '2. Đăng nhập bằng tài khoản Google hoặc Email của bạn',
      '3. Chọn menu Settings > API Keys',
      '4. Nhấn "Create Key", đặt tên khóa và sao chép chuỗi bắt đầu bằng "sk-ant-..."',
      '5. Dán vào ô Khóa API của Claude trên cổng thông tin',
    ],
    freeGuideNotes: 'Anthropic cấp $5 tín dụng miễn phí ban đầu cho tài khoản xác thực số điện thoại để trải nghiệm các mô hình Claude 3.5.',
  },
  blackbox: {
    id: 'blackbox',
    name: 'Blackbox AI',
    label: 'Blackbox AI Engine',
    defaultModel: 'blackboxai',
    availableModels: ['blackboxai', 'gpt-4o', 'gemini-flash'],
    docsUrl: 'https://www.blackbox.ai/',
    freeGuideSteps: [
      '1. Truy cập trang chủ Blackbox AI: https://www.blackbox.ai/',
      '2. Đăng nhập qua tài khoản GitHub hoặc Google',
      '3. Vào mục Profile / Developer Settings để kích hoạt quyền truy cập API',
      '4. Khởi tạo mã API Key miễn phí cho ứng dụng',
      '5. Sao chép và dán khóa API vào mục cấu hình Agent',
    ],
    freeGuideNotes: 'Blackbox AI hỗ trợ các gói miễn phí cho lập trình viên và cộng đồng mã nguồn mở.',
  },
  grok: {
    id: 'grok',
    name: 'Grok (xAI)',
    label: 'xAI Grok (Grok-2)',
    defaultModel: 'grok-2-latest',
    availableModels: ['grok-2-latest', 'grok-beta'],
    docsUrl: 'https://console.x.ai/',
    freeGuideSteps: [
      '1. Truy cập trang xAI Console: https://console.x.ai/',
      '2. Đăng nhập bằng tài khoản X (Twitter)',
      '3. Điều hướng đến mục "API Keys" trong bảng điều khiển',
      '4. Nhấn "Create API Key", đặt tên và sao chép chuỗi mã bắt đầu bằng "xai-..."',
      '5. Dán mã khóa vào hệ thống và nhấn "Kiểm tra kết nối"',
    ],
    freeGuideNotes: 'xAI cung cấp $25 credits miễn phí mỗi tháng cho các tài khoản nhà phát triển đăng ký ban đầu.',
  },
};

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
        return {
          activeProvider: parsed.activeProvider || 'gemini',
          fallbackOrder: parsed.fallbackOrder || ['gemini', 'openai', 'anthropic', 'blackbox', 'grok'],
          providers: parsed.providers || {},
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
    fallbackOrder: ['gemini', 'openai', 'anthropic', 'blackbox', 'grok'],
    providers: {
      gemini: {
        apiKey: geminiEnv && geminiEnv !== 'MY_GEMINI_API_KEY' ? geminiEnv : undefined,
        model: 'gemini-2.5-flash',
        isConfigured: Boolean(geminiEnv && geminiEnv !== 'MY_GEMINI_API_KEY'),
      },
    },
  };
}

export function saveStoredAiConfig(config: StoredAiAgentConfig): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write .ai-agent-config.json:', err);
    throw new Error('Không thể lưu tệp cấu hình Agent trên máy chủ.');
  }
}

export function getClientSafeAgentConfig() {
  const stored = loadStoredAiConfig();
  const clientProviders: Record<string, any> = {};

  (Object.keys(AI_PROVIDERS_INFO) as AiProviderType[]).forEach(id => {
    const info = AI_PROVIDERS_INFO[id];
    const prov = stored.providers[id];
    const hasKey = Boolean(prov?.apiKey && prov.apiKey.trim().length > 0);
    const envKeyAvailable = id === 'gemini' && Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    clientProviders[id] = {
      ...info,
      model: prov?.model || info.defaultModel,
      isConfigured: hasKey || envKeyAvailable,
      apiKeyMasked: hasKey ? maskApiKey(prov?.apiKey) : envKeyAvailable ? 'AIzaSy••••••••(Biến môi trường)' : '',
      updatedAt: prov?.updatedAt,
    };
  });

  return {
    activeProvider: stored.activeProvider || 'gemini',
    fallbackOrder: stored.fallbackOrder || ['gemini', 'openai', 'anthropic', 'blackbox', 'grok'],
    providers: clientProviders,
    updatedAt: stored.updatedAt,
  };
}

export async function testProviderConnection(provider: AiProviderType, apiKey: string, model?: string): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
  responsePreview?: string;
}> {
  const startTime = Date.now();
  const testPrompt = 'Hãy trả về đúng chuỗi JSON: {"status": "ok", "agent": "connected"}. Không kèm giải thích.';

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
        model: model || 'gemini-2.5-flash',
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

    if (provider === 'anthropic') {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cleanKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model || 'claude-3-haiku-20240307',
          max_tokens: 2048,
          system: systemPrompt || undefined,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Anthropic HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data: any = await resp.json();
      const text = data?.content?.[0]?.text || '';
      return { text };
    }

    if (provider === 'blackbox') {
      // Blackbox AI API
      const resp = await fetch('https://api.blackbox.ai/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          model: model || 'blackboxai',
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Blackbox AI HTTP ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data: any = await resp.json();
      const text = data?.text || data?.choices?.[0]?.message?.content || (typeof data === 'string' ? data : JSON.stringify(data));
      return { text };
    }

    if (provider === 'grok') {
      // xAI Grok (OpenAI compatible API)
      const messages: any[] = [];
      if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
      messages.push({ role: 'user', content: prompt });

      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: model || 'grok-2-latest',
          messages,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`xAI Grok HTTP ${resp.status}: ${errText.slice(0, 200)}`);
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
  const primaryProvider = config.activeProvider || 'gemini';
  const order = [primaryProvider, ...(config.fallbackOrder || []).filter(p => p !== primaryProvider)];

  let lastError: any = null;

  for (const provId of order) {
    const prov = config.providers[provId];
    let key = prov?.apiKey?.trim() || '';
    if (!key && provId === 'gemini') {
      key = (process.env.GEMINI_API_KEY || '').trim();
      if (key === 'MY_GEMINI_API_KEY') key = '';
    }

    if (!key) continue;

    const model = prov?.model || AI_PROVIDERS_INFO[provId]?.defaultModel || 'gemini-2.5-flash';

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
        model: 'gemini-2.5-flash',
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
        modelUsed: 'gemini-2.5-flash',
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(lastError?.message || 'Không có nhà cung cấp Agent AI nào khả dụng hoặc tất cả đều hết hạn mức.');
}
