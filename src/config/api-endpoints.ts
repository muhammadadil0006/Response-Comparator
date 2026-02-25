// ─── API Endpoint Constants ───────────────────────────────────────────────────

export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_ME: '/auth/me',

  // Comparisons
  COMPARISONS: '/comparisons',
  COMPARISON_BY_ID: (id: string) => `/comparisons/${id}`,
} as const;

export const API_BASE_URL = '/api';

// ─── Vercel AI Gateway ───────────────────────────────────────────────────────

export const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
