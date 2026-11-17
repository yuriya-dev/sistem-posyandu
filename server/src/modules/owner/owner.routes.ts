import { Router } from 'express';
import { exportBackupData, getAuditLogs, resetPosyanduData } from './owner.controller';
import { authenticate, authorizeRole } from '../../shared/middlewares/auth.middleware';
import { requireTenantAccess } from '../../shared/middlewares/tenant.middleware';

const router = Router();

// GET /api/owner/backup/:posyanduId (Khusus OWNER posyandu terkait)
router.get('/backup/:posyanduId', authenticate, requireTenantAccess, authorizeRole('OWNER'), exportBackupData);

// GET /api/owner/audit-logs/:posyanduId (Khusus OWNER posyandu terkait)
router.get('/audit-logs/:posyanduId', authenticate, requireTenantAccess, authorizeRole('OWNER'), getAuditLogs);

// POST /api/owner/reset-data/:posyanduId (Khusus OWNER posyandu terkait)
router.post('/reset-data/:posyanduId', authenticate, requireTenantAccess, authorizeRole('OWNER'), resetPosyanduData);

export default router;
