import { Router } from 'express';
import { getDashboardSummary, getTrenGizi, getDistribusiKehadiran, getAktivitasKunjungan } from './dashboard.controller';
import { authenticate } from '../../shared/middlewares/auth.middleware';
import { requireTenantAccess } from '../../shared/middlewares/tenant.middleware';

const router = Router({ mergeParams: true });

// GET /api/dashboard/:posyanduId (dilindungi otentikasi & tenant isolation)
router.get('/:posyanduId', authenticate, requireTenantAccess, getDashboardSummary);
// GET /api/dashboard/:posyanduId/tren-gizi
router.get('/:posyanduId/tren-gizi', authenticate, requireTenantAccess, getTrenGizi);
// GET /api/dashboard/:posyanduId/distribusi-kehadiran (Poin 20)
router.get('/:posyanduId/distribusi-kehadiran', authenticate, requireTenantAccess, getDistribusiKehadiran);
// GET /api/dashboard/:posyanduId/aktivitas-kunjungan
router.get('/:posyanduId/aktivitas-kunjungan', authenticate, requireTenantAccess, getAktivitasKunjungan);

export default router;
