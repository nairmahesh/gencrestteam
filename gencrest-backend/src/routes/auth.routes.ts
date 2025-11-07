import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth, checkPasswordSet } from '../middlewares/auth.middleware';

const router = Router();

// --- Public Routes ---
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

// --- Protected Routes ---
router.use(requireAuth);
router.post('/set-password', checkPasswordSet, authController.setInitialPassword);
router.post('/change-password', checkPasswordSet, authController.changePassword);

export default router;