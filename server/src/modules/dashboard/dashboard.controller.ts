import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';

export const getDashboardSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    const data = await dashboardService.getSummary(posyanduId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTrenGizi = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const period = (req.query.period as 'bulanan' | 'tahunan') || 'bulanan';

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    const data = await dashboardService.getTrenGizi(posyanduId, period);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getDistribusiKehadiran = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const kategori = (req.query.kategori || req.query.tipe) as string | undefined;

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    const data = await dashboardService.getDistribusiKehadiran(posyanduId, kategori);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getAktivitasKunjungan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    const data = await dashboardService.getAktivitasKunjungan(posyanduId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
