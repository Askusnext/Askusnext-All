import { createApiClient } from '@askus/api-client'
import { refreshSession, tokenStore } from '@askus/authentication'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

// One client for the central AskUs backend: identity, customer profile and the insurance module.
export const api = createApiClient({
  baseUrl: API_BASE,
  getAccessToken: () => tokenStore.get()?.accessToken ?? null,
  refreshAccessToken: () => refreshSession(API_BASE),
})

export { tokenStore }
