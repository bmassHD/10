import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getClientSafeAgentConfig,
  loadStoredAiConfig,
  saveStoredAiConfig,
  testProviderConnection,
  executeAgentRequest,
  AI_PROVIDERS_INFO,
  AiProviderType,
} from '../../src/server/aiAgentService';

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
