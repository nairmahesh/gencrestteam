import { Request, Response, NextFunction } from 'express';

/**
 * Checks if the authenticated user is an ADMIN.
 * This middleware MUST run *after* requireAuth.
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: You do not have administrator privileges.' });
  }

  next();
};