import { validateUploadFile } from '../../utils/validation'
import { fetchApplicationById, fetchQuoteDocuments } from './loansApi'
import { fileObjectUrl, http } from './http'

export interface UploadResult {
  fileName: string
  fileSize: number
  mimeType: string
  storageKey: string
  fileId: string
  fileFormat: string
  storageKind: 'raw'
  fileVersion: number
}

/** Uploads one document to the AskUs API, which stores it privately on the server. */
export async function uploadApplicationDocument(
  draftId: string,
  document: { type: string },
  file: File,
): Promise<UploadResult> {
  const validation = validateUploadFile(file)
  if (!validation.valid) throw new Error(validation.error || 'Invalid file format.')
  const form = new FormData()
  form.append('draftId', draftId)
  form.append('documentType', document.type)
  form.append('file', file)
  const saved = await http<Omit<UploadResult, 'storageKind'>>('/loans/files', { method: 'POST', form })
  return { ...saved, storageKind: 'raw' }
}

export async function deleteDraftDocument(_draftId: string, document: { type: string; storageKey?: string }): Promise<void> {
  if (!document.storageKey) return
  await http(`/loans/files?key=${encodeURIComponent(document.storageKey)}`, { method: 'DELETE' })
}

/** Temporary link to a document attached to a submitted application form. */
export async function getApplicationDocumentUrl(applicationId: string, documentId: string): Promise<string> {
  const application = await fetchApplicationById(applicationId)
  const document = application?.documents.find((item) => item.id === documentId)
  if (!document?.storageKey) throw new Error('This document has no uploaded file.')
  return fileObjectUrl(document.storageKey)
}

/** Temporary link to a document uploaded from the loan quotes flow. */
export async function getQuoteDocumentUrl(appId: string, slot: string, userId?: string): Promise<string> {
  const docs = await fetchQuoteDocuments(userId ?? '', appId)
  const document = docs.find((item) => item.slot === slot)
  if (!document) throw new Error('Document not found.')
  return fileObjectUrl(document.storageKey)
}
