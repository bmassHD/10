export {
  getZaloEnvConfig,
  resolvePublicOrigin,
  getZaloRedirectUri,
  generateZaloCodeVerifier,
  generateZaloCodeChallenge,
  computeZaloAppSecretProof,
  normalizeVietnamesePhone,
  getZaloStatusPayload,
  createZaloAuthorizationUrl,
  refreshZaloAccessToken,
  handleZaloOAuthCallback,
  pollZaloOAuthResult,
  completeZaloExchange,
  getZaloSessionFromRequest,
  logoutZaloSession,
  resolveZaloMiniAppPhone,
} from '../../api/auth/zalo/[action]';

export type {
  ZaloAuthMode,
  ZaloUserProfilePayload,
  ZaloCompletionResponse,
} from '../../api/auth/zalo/[action]';
