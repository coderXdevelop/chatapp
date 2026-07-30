import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';

export function requireAdminSecret(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const adminSecret = process.env.ADMIN_SECRET_KEY;
  const providedSecret = req.headers['x-admin-secret'] || req.headers['x-admin-key'];

  if (!adminSecret) {
    console.warn('[Admin Middleware] ADMIN_SECRET_KEY is not configured in environment variables.');
  }

  // If ADMIN_SECRET_KEY is configured, enforce matching header
  if (adminSecret && providedSecret !== adminSecret) {
    return res.status(403).json({ success: false, message: 'Forbidden: Invalid or missing admin authorization secret key' });
  }

  next();
}
