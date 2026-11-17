import { Request, Response, NextFunction } from 'express';
import { periodeService } from './periode.service';

export const getPeriodeList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const data = await periodeService.findAllByPosyandu(posyanduId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getActivePeriode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const data = await periodeService.getActiveByPosyandu(posyanduId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createPeriode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const data = await periodeService.create(posyanduId, req.body);
    res.status(201).json({ success: true, message: 'Periode pelayanan berhasil dibuka', data });
  } catch (err) {
    next(err);
  }
};

export const updatePeriode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const data = await periodeService.update(id, req.body, posyanduId);
    res.json({ success: true, message: 'Periode pelayanan berhasil diperbarui', data });
  } catch (err) {
    next(err);
  }
};

export const activatePeriode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const data = await periodeService.activate(posyanduId, id);
    res.json({ success: true, message: 'Periode pelayanan berhasil diaktifkan', data });
  } catch (err) {
    next(err);
  }
};

export const deletePeriode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    await periodeService.delete(id, posyanduId);
    res.json({ success: true, message: 'Periode pelayanan berhasil dihapus' });
  } catch (err) {
    next(err);
  }
};
