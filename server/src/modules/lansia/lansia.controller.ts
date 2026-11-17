import { Request, Response, NextFunction } from 'express';
import prisma from '../../shared/config/prisma';
import { lansiaService } from './lansia.service';
import { kelompokUmurLansia } from './lansia.helper';

// ─────────────────────────────────────────────────────────────
// LANSIA CRUD
// ─────────────────────────────────────────────────────────────

export const getAllLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const { search, kelompokUmur, ht, dm, page, limit } = req.query as {
      search?: string;
      kelompokUmur?: string;
      ht?: string;
      dm?: string;
      page?: string;
      limit?: string;
    };

    const filterHt = ht !== undefined ? ht === 'true' : undefined;
    const filterDm = dm !== undefined ? dm === 'true' : undefined;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const { data, meta } = await lansiaService.findAll(
      posyanduId,
      search,
      kelompokUmur,
      filterHt,
      filterDm,
      pageNum,
      limitNum
    );
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
};

export const getLansiaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const lansia = await lansiaService.findById(id, posyanduId);

    if (!lansia) {
      res.status(404).json({ success: false, message: 'Lansia tidak ditemukan' });
      return;
    }

    const now = new Date();
    const usiaTahun = now.getFullYear() - lansia.tanggalLahir.getFullYear();

    res.json({
      success: true,
      data: {
        ...lansia,
        usiaTahun,
        kelompokUmur: kelompokUmurLansia(usiaTahun),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const {
      nama, nik, noBpjs, rtRw, tanggalLahir, jenisKelamin,
      alamat, riwayatHt, riwayatDm, tingkatKemandirian, gangguanMentalEmosional,
    } = req.body;

    const data = await lansiaService.create(posyanduId, {
      nama,
      nik,
      noBpjs: noBpjs || null,
      rtRw,
      tanggalLahir: new Date(tanggalLahir),
      jenisKelamin,
      alamat,
      riwayatHt: riwayatHt ?? false,
      riwayatDm: riwayatDm ?? false,
      tingkatKemandirian,
      gangguanMentalEmosional: gangguanMentalEmosional || null,
    });

    res.status(201).json({ success: true, message: 'Data lansia berhasil ditambahkan', data });
  } catch (err) {
    next(err);
  }
};

export const updateLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const { tanggalLahir, ...rest } = req.body;

    const data = await lansiaService.update(id, posyanduId, {
      ...rest,
      ...(tanggalLahir && { tanggalLahir: new Date(tanggalLahir) }),
    });

    res.json({ success: true, message: 'Data lansia berhasil diperbarui', data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('tidak ditemukan')) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

export const deleteLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    await lansiaService.delete(id, posyanduId);
    res.json({ success: true, message: 'Data lansia berhasil dihapus' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('tidak ditemukan')) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PEMERIKSAAN LANSIA
// ─────────────────────────────────────────────────────────────

export const getAllPemeriksaanLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const lansiaId = req.params.lansiaId as string;
    const data = await lansiaService.findAllPemeriksaan(lansiaId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createPemeriksaanLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const lansiaId = req.params.lansiaId as string;
    const {
      tanggalPeriksa, beratBadan, tinggiBadan,
      tekananDarahSistol, tekananDarahDiastol, gulaDarahSewaktu, lingkarPerut,
      kolesterol, asamUrat, keluhan, tindakan, petugas,
    } = req.body;

    let petugasNama = petugas || req.user?.nama;
    if (!petugasNama && req.user?.userId) {
      const kader = await prisma.kader.findUnique({ where: { id: req.user.userId }, select: { nama: true } });
      petugasNama = kader?.nama;
    }

    const data = await lansiaService.createPemeriksaan(
      lansiaId,
      {
        tanggalPeriksa: new Date(tanggalPeriksa),
        beratBadan: Number(beratBadan),
        tinggiBadan: Number(tinggiBadan),
        tekananDarahSistol: Number(tekananDarahSistol),
        tekananDarahDiastol: Number(tekananDarahDiastol),
        gulaDarahSewaktu: Number(gulaDarahSewaktu),
        lingkarPerut: Number(lingkarPerut),
        kolesterol: kolesterol ? Number(kolesterol) : undefined,
        asamUrat: asamUrat ? Number(asamUrat) : undefined,
        keluhan,
        tindakan,
        petugas: petugasNama || 'Kader Posyandu',
      },
      posyanduId
    );

    res.status(201).json({ success: true, message: 'Pemeriksaan lansia berhasil ditambahkan', data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('tidak ditemukan')) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

export const updatePemeriksaanLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const { tanggalPeriksa, ...rest } = req.body;

    const data = await lansiaService.updatePemeriksaan(id, posyanduId, {
      ...rest,
      ...(tanggalPeriksa && { tanggalPeriksa: new Date(tanggalPeriksa) }),
    });

    res.json({ success: true, message: 'Pemeriksaan lansia berhasil diperbarui', data });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('tidak ditemukan') || err.message.includes('akses ditolak'))) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

export const deletePemeriksaanLansia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    await lansiaService.deletePemeriksaan(id, posyanduId);
    res.json({ success: true, message: 'Pemeriksaan lansia berhasil dihapus' });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('tidak ditemukan') || err.message.includes('akses ditolak'))) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};
