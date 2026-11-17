import { Request, Response } from 'express';
import { getPublicPosyanduList, getPublicPemeriksaanData, getPublicDataByNik } from './public.service';

export const getPosyanduListController = async (_req: Request, res: Response) => {
  try {
    const data = await getPublicPosyanduList();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Gagal memuat daftar posyandu.' });
  }
};

export const getPemeriksaanPuskesmasController = async (req: Request, res: Response) => {
  try {
    const { posyanduId, kategori, status, search, startDate, endDate } = req.query;

    const data = await getPublicPemeriksaanData({
      posyanduId: posyanduId as string,
      kategori: kategori as 'Balita' | 'Lansia' | 'Semua',
      status: status as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({
      success: true,
      data,
      meta: {
        total: data.length,
        privacyProtected: true,
        note: 'Portal Puskesmas khusus petugas terautentikasi.',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Gagal memuat data pemeriksaan puskesmas.' });
  }
};

export const getCekNikController = async (req: Request, res: Response) => {
  try {
    const nik = (req.query.nik as string) || (req.body?.nik as string);
    const tanggalLahir = (req.query.tanggalLahir as string) || (req.body?.tanggalLahir as string);

    if (!nik || typeof nik !== 'string' || nik.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Nomor Induk Kependudukan (NIK) wajib diisi.',
      });
      return;
    }

    if (!tanggalLahir || typeof tanggalLahir !== 'string' || tanggalLahir.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Tanggal Lahir wajib diisi untuk verifikasi identitas data kesehatan.',
      });
      return;
    }

    const cleanNik = nik.trim().replace(/[^0-9]/g, '');
    if (cleanNik.length !== 16) {
      res.status(400).json({
        success: false,
        message: 'Format NIK tidak valid. NIK harus terdiri dari 16 digit angka.',
      });
      return;
    }

    // Validasi format tanggalLahir: harus YYYY-MM-DD atau variasi yang bisa di-parse
    const cleanTanggal = tanggalLahir.trim().slice(0, 20); // batasi panjang input
    const tglParsed = new Date(cleanTanggal);
    if (isNaN(tglParsed.getTime()) || tglParsed.getFullYear() < 1900 || tglParsed.getFullYear() > new Date().getFullYear()) {
      res.status(400).json({
        success: false,
        message: 'Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD.',
      });
      return;
    }

    const result = await getPublicDataByNik(cleanNik, cleanTanggal);
    if (!result) {
      res.json({
        success: true,
        data: null,
        message: 'Data pemeriksaan dengan kombinasi NIK dan Tanggal Lahir tersebut tidak ditemukan di Posyandu.',
      });
      return;
    }

    res.json({
      success: true,
      data: result,
      message: 'Data pemeriksaan berhasil ditemukan.',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat memeriksa data NIK.',
    });
  }
};
