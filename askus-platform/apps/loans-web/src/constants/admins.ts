export const ADMIN_EMAILS = ['sanjaympatel8523@gmail.com', 'rajesh8523@gmail.com'] as const

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.trim().toLowerCase() as typeof ADMIN_EMAILS[number]))
}
