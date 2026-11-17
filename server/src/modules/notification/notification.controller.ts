import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    const data = await notificationService.getNotifications(posyanduId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const markNotificationsAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const { notificationIds } = req.body;

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    await notificationService.markAllAsRead(posyanduId, Array.isArray(notificationIds) ? notificationIds : []);
    res.json({ success: true, message: 'Notifikasi berhasil ditandai dibaca' });
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;

    if (req.user?.posyanduId !== posyanduId) {
      res.status(403).json({ success: false, message: 'Akses ditolak ke posyandu ini' });
      return;
    }

    await notificationService.deleteNotification(posyanduId, id);
    res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
  } catch (err) {
    next(err);
  }
};
