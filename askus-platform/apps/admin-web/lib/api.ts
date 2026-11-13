import { createApiClient } from '@askus/api-client';
import { refreshSession, tokenStore } from '@askus/authentication';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export const api = createApiClient({
  baseUrl,
  getAccessToken: () => tokenStore.get()?.accessToken ?? null,
  refreshAccessToken: () => refreshSession(baseUrl),
});
