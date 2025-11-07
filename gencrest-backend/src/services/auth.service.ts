import { User, IUser } from '../models/user.model';
import jwt, { SignOptions } from 'jsonwebtoken';
import config from '../config';
import { logger } from '../utils/logger';
import { redisConnection } from '../lib/redis';
import crypto from 'crypto';

// Custom Error
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface ITokens {
  accessToken: string;
  refreshToken: string;
}

class AuthService {

  /**
   * Generates Access and Refresh tokens
   */
  public generateTokens(user: IUser): ITokens {
    const accessToken = jwt.sign(
      { sub: user.id, role: user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessTokenExpiresIn } as SignOptions
    );
    
    const refreshToken = jwt.sign(
      { sub: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshTokenExpiresIn } as SignOptions
    );
    
    return { accessToken, refreshToken };
  }

  /**
   * Handles user login
   */
  public async login(email: string, password: string): Promise<{ tokens: ITokens; user: IUser; isPasswordSet: boolean }> {
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new AuthError('Invalid credentials');
    }
    
    if (!user.isActive) {
      throw new AuthError('Account is disabled');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AuthError('Invalid credentials');
    }

    const tokens = this.generateTokens(user);
    
    // Clean user object (remove password)
    const userResponse = user.toObject();
    delete userResponse.password;

    return {
      tokens,
      user: userResponse,
      isPasswordSet: user.isPasswordSet,
    };
  }
  
  /**
   * Sets the password for the first time or resets it
   */
  public async setInitialPassword(userId: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.isPasswordSet) {
        throw new Error('Password has already been set');
    }

    user.password = newPassword; // Pre-save hook will hash it
    user.isPasswordSet = true;
    await user.save();
    
    logger.info(`User ${user.email} has set their initial password.`);
  }

  /**
   * Changes an existing password
   */
  public async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      throw new AuthError('Incorrect old password');
    }

    user.password = newPassword; // Pre-save hook will hash it
    await user.save();
    
    logger.info(`User ${user.email} has changed their password.`);
  }

  /**
   * Handles user logout by blocklisting the refresh token
   */
  public async logout(refreshToken: string): Promise<void> {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { sub: string, exp: number };
      const expiry = payload.exp * 1000 - Date.now(); // Get expiry in ms
      
      // Store token in Redis to blocklist it until it expires
      await redisConnection.set(`blocklist:${refreshToken}`, 'true', 'PX', expiry);
    } catch (error) {
      logger.error({ err: error }, 'Error logging out');
    }
  }

  /**
   * Generates a new access token from a valid refresh token
   */
  public async refreshToken(token: string): Promise<{ accessToken: string }> {
    // Check if token is blocklisted
    const isBlocked = await redisConnection.get(`blocklist:${token}`);
    if (isBlocked) {
      throw new AuthError('Token is invalid');
    }

    const payload = jwt.verify(token, config.jwt.refreshSecret) as { sub: string };
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new AuthError('User not found or inactive');
    }

    const { accessToken } = this.generateTokens(user);
    return { accessToken };
  }
  
  /**
   * Generates a password reset token
   */
  public async forgotPassword(email: string): Promise<void> {
      const user = await User.findOne({ email });
      if (!user) {
          logger.warn(`Password reset attempt for non-existent email: ${email}`);
          return; // Don't reveal that the user doesn't exist
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash token and save to DB
      user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();
      
      // TODO: Send email to user
      const resetURL = `${config.clientURL}/reset-password/${resetToken}`;
      logger.info(`Password reset link for ${email}: ${resetURL}`);
      // Implement your email service call here (e.g., using BullMQ)
      // await emailQueue.add('sendPasswordReset', { to: user.email, url: resetURL });
  }

  /**
   * Resets password using a valid token
   */
  public async resetPassword(token: string, newPassword: string): Promise<void> {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
          passwordResetToken: hashedToken,
          passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
          throw new AuthError('Token is invalid or has expired');
      }

      user.password = newPassword; // Pre-save hook hashes it
      user.isPasswordSet = true; // Mark as set
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      logger.info(`Password for ${user.email} has been reset.`);
  }
}

export const authService = new AuthService();