import type { DocRef } from '@askus/shared-types'
import { api } from './api'

export type UploadedDoc = DocRef

/** Uploads one file straight to the private R2 bucket with a URL signed by our API. */
export async function uploadDocument(requestId: string, index: number, file: File): Promise<UploadedDoc> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const signed = await api.insurance.signUpload({ requestId, index, extension, size: file.size })
  const res = await fetch(signed.url, { method: 'PUT', headers: { 'Content-Type': signed.contentType }, body: file })
  if (!res.ok) throw new Error('The file could not be uploaded. Please try again.')
  return {
    name: file.name,
    size: file.size,
    mimeType: signed.contentType,
    key: signed.key,
    format: extension === 'jpeg' ? 'jpg' : extension,
  }
}

/** Opens a private document in a new tab through a link that expires after 10 minutes. */
export async function openDocument(key: string) {
  const { url } = await api.insurance.downloadUrl(key)
  window.open(url, '_blank', 'noopener')
}
