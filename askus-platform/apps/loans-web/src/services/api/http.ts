import { refreshSession, tokenStore } from '@askus/authentication'

/** Base URL of the central AskUs API (NestJS + PostgreSQL). */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

interface Options {
  method?: string
  /** JSON body. */
  body?: unknown
  /** Multipart body (file uploads). */
  form?: FormData
}

async function send(path: string, opts: Options, token: string | null | undefined) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  return fetch(`${API_BASE}${path}`, { method: opts.method ?? 'GET', headers, body })
}

async function request(path: string, opts: Options = {}) {
  let res = await send(path, opts, tokenStore.get()?.accessToken)
  if (res.status === 401 && tokenStore.get()) {
    const fresh = await refreshSession(API_BASE)
    if (fresh) res = await send(path, opts, fresh)
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const message = Array.isArray(err?.message) ? err.message.join(', ') : err?.message
    throw new ApiError(res.status, message ?? (res.status === 401 ? 'Sign in is required.' : res.statusText || 'Request failed.'))
  }
  return res
}

/** JSON request to the API with the signed-in user's token (refreshed automatically). */
export async function http<T = void>(path: string, opts: Options = {}): Promise<T> {
  const res = await request(path, opts)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Downloads a private file and returns a temporary local URL the browser can open. */
export async function fileObjectUrl(storageKey: string): Promise<string> {
  const res = await request(`/loans/files?key=${encodeURIComponent(storageKey)}`)
  return URL.createObjectURL(await res.blob())
}

/** Id and roles of the signed-in user, read from the access token (for the UI only; the API enforces access). */
export function currentToken(): { sub: string; roles: string[] } | null {
  const token = tokenStore.get()?.accessToken
  if (!token) return null
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(atob(part)))) as { sub: string; roles?: string[] }
    return { sub: payload.sub, roles: payload.roles ?? [] }
  } catch {
    return null
  }
}

export const isSelf = (uid: string) => currentToken()?.sub === uid
