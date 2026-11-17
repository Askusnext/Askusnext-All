export function isValidIndianMobile(mobile: string): boolean {
  const clean = mobile.replace(/\D/g, '')
  if (clean.length === 10) {
    return /^[6-9]\d{9}$/.test(clean)
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return /^[6-9]\d{9}$/.test(clean.slice(2))
  }
  return false
}

export function isValidPan(pan: string): boolean {
  if (!pan) return false
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase().trim())
}

export function isValidPincode(pincode: string): boolean {
  if (!pincode) return false
  return /^[1-9][0-9]{5}$/.test(pincode.trim())
}

export function isValidEmail(email: string): boolean {
  if (!email) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
]

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export function validateUploadFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' }
  }

  const isTypeAllowed =
    ALLOWED_MIME_TYPES.includes(file.type) ||
    file.name.toLowerCase().endsWith('.pdf') ||
    file.name.toLowerCase().endsWith('.jpg') ||
    file.name.toLowerCase().endsWith('.jpeg') ||
    file.name.toLowerCase().endsWith('.png')

  if (!isTypeAllowed) {
    return {
      valid: false,
      error: 'Invalid file format. Only PDF, JPG, and PNG files are accepted.'
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit. Please compress or select a smaller file.'
    }
  }

  return { valid: true }
}
