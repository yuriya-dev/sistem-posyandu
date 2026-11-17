import { Request, Response, NextFunction } from 'express';
import prisma from '../../shared/config/prisma';
import { balitaService } from './balita.service';
import { hitungUsiaBulan, kelompokUsiaBulan } from './balita.helper';

// ─────────────────────────────────────────────────────────────
// BALITA CRUD
// ─────────────────────────────────────────────────────────────

export const getAllBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const { search, kelompokUsia, tindakLanjut, page, limit } = req.query as {
      search?: string;
      kelompokUsia?: string;
      tindakLanjut?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const { data, meta } = await balitaService.findAll(posyanduId, search, kelompokUsia, tindakLanjut, pageNum, limitNum);
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
};

export const getBalitaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const balita = await balitaService.findById(id, posyanduId);

    if (!balita) {
      res.status(404).json({ success: false, message: 'Balita tidak ditemukan' });
      return;
    }

    const usiaBulan = hitungUsiaBulan(balita.tanggalLahir);
    res.json({
      success: true,
      data: {
        ...balita,
        usiaBulan,
        kelompokUsia: kelompokUsiaBulan(usiaBulan),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const { nama, nik, tanggalLahir, jenisKelamin, namaIbu, alamat } = req.body;

    const data = await balitaService.create(posyanduId, {
      nama,
      nik: nik || null,
      tanggalLahir: new Date(tanggalLahir),
      jenisKelamin,
      namaIbu,
      alamat,
    });

    res.status(201).json({ success: true, message: 'Data balita berhasil ditambahkan', data });
  } catch (err) {
    next(err);
  }
};

export const updateBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const { tanggalLahir, ...rest } = req.body;

    const data = await balitaService.update(id, posyanduId, {
      ...rest,
      ...(tanggalLahir && { tanggalLahir: new Date(tanggalLahir) }),
    });

    res.json({ success: true, message: 'Data balita berhasil diperbarui', data });
  } catch (err) {
    next(err);
  }
};

export const deleteBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    await balitaService.delete(id, posyanduId);
    res.json({ success: true, message: 'Data balita berhasil dihapus' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('tidak ditemukan')) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PEMERIKSAAN BALITA
// ─────────────────────────────────────────────────────────────

export const getAllPemeriksaanBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const balitaId = req.params.balitaId as string;
    const data = await balitaService.findAllPemeriksaan(balitaId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createPemeriksaanBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const balitaId = req.params.balitaId as string;
    const {
      tanggalPeriksa,
      beratBadan,
      tinggiBadan,
      lingkarKepala,
      lingkarLengan,
      statusBbU,
      statusTbU,
      statusBbTb,
      statusKms,
      vitaminA,
      asiEksklusif,
      obatCacing,
      statusImunisasi,
      petugas,
    } = req.body;

    let petugasNama = petugas || req.user?.nama;
    if (!petugasNama && req.user?.userId) {
      const kader = await prisma.kader.findUnique({ where: { id: req.user.userId }, select: { nama: true } });
      petugasNama = kader?.nama;
    }

    const data = await balitaService.createPemeriksaan(
      balitaId,
      {
        tanggalPeriksa: new Date(tanggalPeriksa),
        beratBadan: Number(beratBadan),
        tinggiBadan: Number(tinggiBadan),
        lingkarKepala: lingkarKepala ? Number(lingkarKepala) : undefined,
        lingkarLengan: lingkarLengan ? Number(lingkarLengan) : undefined,
        statusBbU,
        statusTbU,
        statusBbTb,
        statusKms,
        vitaminA: !!vitaminA,
        asiEksklusif: asiEksklusif !== undefined ? !!asiEksklusif : undefined,
        obatCacing: obatCacing !== undefined ? !!obatCacing : undefined,
        statusImunisasi,
        petugas: petugasNama || 'Kader Posyandu',
      },
      posyanduId
    );

    res.status(201).json({ success: true, message: 'Pemeriksaan balita berhasil ditambahkan', data });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('tidak ditemukan')) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

export const updatePemeriksaanBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    const { tanggalPeriksa, ...rest } = req.body;

    const data = await balitaService.updatePemeriksaan(id, posyanduId, {
      ...rest,
      ...(tanggalPeriksa && { tanggalPeriksa: new Date(tanggalPeriksa) }),
    });

    res.json({ success: true, message: 'Pemeriksaan balita berhasil diperbarui', data });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('tidak ditemukan') || err.message.includes('akses ditolak'))) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};

export const deletePemeriksaanBalita = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const posyanduId = req.params.posyanduId as string;
    const id = req.params.id as string;
    await balitaService.deletePemeriksaan(id, posyanduId);
    res.json({ success: true, message: 'Pemeriksaan balita berhasil dihapus' });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes('tidak ditemukan') || err.message.includes('akses ditolak'))) {
      res.status(404).json({ success: false, message: err.message });
      return;
    }
    next(err);
  }
};
