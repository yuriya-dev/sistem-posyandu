import { Request, Response, NextFunction } from 'express';

/**
 * Middleware untuk memverifikasi isolasi multi-tenant data Posyandu (IDOR Prevention).
 * Memastikan:
 * 1. User dengan role PUSKESMAS tidak dapat mengakses endpoint operasional posyandu.
 * 2. User KADER atau OWNER hanya dapat mengakses posyandu miliknya sendiri.
 */
export const requireTenantAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    return;
  }

  // Akun Puskesmas hanya boleh mengakses Portal Puskesmas
  if (req.user.role === 'PUSKESMAS') {
    res.status(403).json({
      success: false,
      message: 'Akses ditolak: Akun Puskesmas tidak berwenang mengakses data internal posyandu.',
    });
    return;
  }

  const targetPosyanduId = req.params.posyanduId || req.params.id;
  if (targetPosyanduId && req.user.posyanduId && targetPosyanduId !== req.user.posyanduId) {
    res.status(403).json({
      success: false,
      message: 'Akses ditolak: Anda tidak memiliki akses ke Posyandu lain.',
    });
    return;
  }

  next();
};
