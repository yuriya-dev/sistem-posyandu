import { Router } from 'express';
import {
  register,
  login,
  googleLogin,
  getMe,
  registerPosyandu,
  updateProfile,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from './auth.controller';
import { authenticate } from '../../shared/middlewares/auth.middleware';
import { validate } from '../../shared/middlewares/validate.middleware';
import { authRateLimiter } from '../../shared/middlewares/rateLimit.middleware';
import { registerSchema, loginSchema, googleAuthSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schema';

const router = Router();

// POST /api/auth/register
router.post('/register', authRateLimiter, validate(registerSchema), register);

// POST /api/auth/register-posyandu  (publik — buat posyandu baru + owner)
router.post('/register-posyandu', authRateLimiter, registerPosyandu);

// POST /api/auth/login
router.post('/login', authRateLimiter, validate(loginSchema), login);

// POST /api/auth/google
router.post('/google', authRateLimiter, validate(googleAuthSchema), googleLogin);

// POST /api/auth/forgot-password
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), forgotPassword);

// GET /api/auth/verify-reset-token/:token
router.get('/verify-reset-token/:token', authRateLimiter, verifyResetToken);

// POST /api/auth/reset-password
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), resetPassword);

// GET /api/auth/me  (dilindungi JWT)
router.get('/me', authenticate, getMe);

// PUT /api/auth/profile (dilindungi JWT)
router.put('/profile', authenticate, updateProfile);

export default router;

