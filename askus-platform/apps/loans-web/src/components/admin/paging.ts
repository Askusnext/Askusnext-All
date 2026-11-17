export type LoadState = 'loading' | 'ready' | 'error'

export const PAGE_SIZE = 15

/** Keeps the current page inside the valid range after the list shrinks (search, filters). */
export const clampPage = (page: number, total: number, pageSize = PAGE_SIZE) =>
  Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1))
