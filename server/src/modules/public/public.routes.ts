import { Router } from 'express';
import {
  getPosyanduListController,
  getPemeriksaanPuskesmasController,
  getCekNikController,
} from './public.controller';
import { authenticate, authorize } from '../../shared/middlewares/auth.middleware';
import { publicNikRateLimiter } from '../../shared/middlewares/rateLimit.middleware';

const router = Router();

// GET /api/public/posyandu - Public list of Posyandu locations
router.get('/posyandu', getPosyanduListController);

// GET /api/public/cek-nik - Portal publik: Cek mandiri data kesehatan perorangan berdasarkan NIK (dengan Rate Limiting)
router.get('/cek-nik', publicNikRateLimiter, getCekNikController);

// GET /api/public/puskesmas/pemeriksaan - Portal Puskesmas: Khusus petugas Puskesmas (role PUSKESMAS)
router.get('/puskesmas/pemeriksaan', authenticate, authorize('PUSKESMAS'), getPemeriksaanPuskesmasController);

export default router;
