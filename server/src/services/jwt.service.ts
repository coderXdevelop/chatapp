import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.warn('[JWT Service Warning] JWT secrets are not fully configured in environment variables.');
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_ACCESS_SECRET is missing');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function generateRefreshToken(payload: TokenPayload): string {
  if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is missing');
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): TokenPayload {
  if (!JWT_SECRET) throw new Error('JWT_ACCESS_SECRET is missing');
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is missing');
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
}
