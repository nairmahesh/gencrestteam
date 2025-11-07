import { Request, Response } from 'express';
import { authService, AuthError } from '../services/auth.service';
import config from '../config';
import { logger } from '../utils/logger';

// Cookie options
const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth', // --- IMPORTANT: Limit cookie scope
};

class AuthController {
  public async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;
      const { tokens, user, isPasswordSet } = await authService.login(email, password);

      // Set refresh token in cookie
      res.cookie('refreshToken', tokens.refreshToken, refreshTokenCookieOptions);

      return res.status(200).json({
        accessToken: tokens.accessToken,
        user: {
          ...user,
          name: user.firstName + ' ' + user.lastName,
          id: user.employeeId
        },
        isPasswordSet,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(401).json({ message: error.message });
      }
      logger.error({ err: error }, 'Login error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async setInitialPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { newPassword } = req.body;
      const userId = req.user!.id; // From requireAuth middleware

      if (req.user!.isPasswordSet) {
        return res.status(400).json({ message: 'Password has already been set' });
      }

      await authService.setInitialPassword(userId, newPassword);
      return res.status(200).json({ message: 'Password set successfully' });
    } catch (error) {
      logger.error({ err: error }, 'Set initial password error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async changePassword(req: Request, res: Response): Promise<Response> {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user!.id;

      await authService.changePassword(userId, oldPassword, newPassword);
      return res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(400).json({ message: error.message });
      }
      logger.error({ err: error }, 'Change password error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async refreshToken(req: Request, res: Response): Promise<Response> {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    try {
      const { accessToken } = await authService.refreshToken(token);
      return res.status(200).json({ accessToken });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
  }

  public async logout(req: Request, res: Response): Promise<Response> {
    const token = req.cookies.refreshToken;
    if (token) {
      await authService.logout(token);
    }

    // Clear the cookie
    res.clearCookie('refreshToken', refreshTokenCookieOptions);
    return res.status(200).json({ message: 'Logged out successfully' });
  }

  public async forgotPassword(req: Request, res: Response): Promise<Response> {
    try {
      await authService.forgotPassword(req.body.email);
      return res.status(200).json({ message: 'If a user exists with that email, a reset link has been sent.' });
    } catch (error) {
      logger.error({ err: error }, 'Forgot password error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public async resetPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { token } = req.params;
      const { password } = req.body;
      await authService.resetPassword(token, password);
      return res.status(200).json({ message: 'Password reset successfully.' });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(400).json({ message: error.message });
      }
      logger.error({ err: error }, 'Reset password error');
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}

export const authController = new AuthController();