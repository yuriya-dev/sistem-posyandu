import { Request, Response, NextFunction } from 'express';
import { ownerService } from './owner.service';

export const exportBackupData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;

    if (req.user?.role !== 'OWNER' || req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke fitur backup ini' });
      return;
    }

    const backupPayload = await ownerService.exportBackupData(
      posyanduId,
      req.user?.userId || req.user?.id,
      req.user?.nama || 'Owner'
    );

    const filename = `backup-posyandu-${posyanduId}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backupPayload);
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;

    if (req.user?.role !== 'OWNER' || req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke audit log' });
      return;
    }

    const logs = await ownerService.getAuditLogs(posyanduId);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

export const resetPosyanduData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const { confirmText, password } = req.body;

    if (req.user?.role !== 'OWNER' || req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Hanya OWNER Posyandu ini yang dapat melakukan reset data' });
      return;
    }

    const result = await ownerService.resetPosyanduData({
      posyanduId,
      ownerKaderId: req.user?.userId || req.user?.id || '',
      ownerNama: req.user?.nama || 'Owner',
      passwordInput: password,
      confirmText,
      ipAddress: req.ip,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || 'Gagal mereset data Posyandu' });
  }
};
