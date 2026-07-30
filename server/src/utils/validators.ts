export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function isValidPassword(password: string, minLength = 6): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.length >= minLength;
}

export function sanitizeEmail(email: string): string {
  return email ? email.trim().toLowerCase() : '';
}

export function isValidOTP(otp: string): boolean {
  if (!otp || typeof otp !== 'string') return false;
  return /^\d{4,8}$/.test(otp.trim());
}
