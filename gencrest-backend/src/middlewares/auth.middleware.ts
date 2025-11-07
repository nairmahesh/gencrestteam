import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: import('../models/user.model').IUser;
    }
  }
}

/**
 * Verifies JWT and attaches user to req object
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret) as { sub: string };
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Unauthorized: User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.warn({ err: error }, 'Invalid access token');
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

/**
 * Checks if the authenticated user has set their initial password.
 * This should run AFTER requireAuth.
 */
export const checkPasswordSet = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    // Allow access if password is set
    if (req.user.isPasswordSet) {
        return next();
    }
    
    // If password is NOT set, only allow access to the 'set-password' route
    if (req.path === '/set-password') {
        return next();
    }

    // Block all other routes
    return res.status(403).json({
        message: 'Forbidden: Initial password must be set',
        code: 'PASSWORD_CHANGE_REQUIRED',
    });
};