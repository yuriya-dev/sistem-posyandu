import prisma from '../../shared/config/prisma';
import { kelompokUmurLansia } from './lansia.helper';

export const lansiaService = {
  async findAll(
    posyanduId: string,
    search?: string,
    kelompokUmur?: string,
    filterHt?: boolean,
    filterDm?: boolean,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      posyanduId,
      ...(search && { nama: { contains: search, mode: 'insensitive' } }),
      ...(filterHt !== undefined && { riwayatHt: filterHt }),
      ...(filterDm !== undefined && { riwayatDm: filterDm }),
    };

    if (!kelompokUmur) {
      const [total, lansias] = await Promise.all([
        prisma.lansia.count({ where }),
        prisma.lansia.findMany({
          where,
          orderBy: { nama: 'asc' },
          skip,
          take: limit,
          include: {
            pemeriksaans: {
              orderBy: { tanggalPeriksa: 'desc' },
            },
          },
        }),
      ]);

      const data = lansias.map((l) => {
        const now = new Date();
        const tahun = now.getFullYear() - l.tanggalLahir.getFullYear();
        const kelompok = kelompokUmurLansia(tahun);
        return { ...l, usiaTahun: tahun, kelompokUmur: kelompok };
      });

      const totalPages = Math.ceil(total / limit) || 1;
      return { data, meta: { page, limit, total, totalPages } };
    } else {
      const allLansias = await prisma.lansia.findMany({
        where,
        orderBy: { nama: 'asc' },
        include: {
          pemeriksaans: {
            orderBy: { tanggalPeriksa: 'desc' },
          },
        },
      });

      const filtered = allLansias
        .map((l) => {
          const now = new Date();
          const tahun = now.getFullYear() - l.tanggalLahir.getFullYear();
          const kelompok = kelompokUmurLansia(tahun);
          return { ...l, usiaTahun: tahun, kelompokUmur: kelompok };
        })
        .filter((l) => l.kelompokUmur === kelompokUmur);

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const data = filtered.slice(skip, skip + limit);

      return { data, meta: { page, limit, total, totalPages } };
    }
  },

  async findById(id: string, posyanduId: string) {
    return prisma.lansia.findFirst({
      where: { id, posyanduId },
      include: {
        pemeriksaans: {
          orderBy: { tanggalPeriksa: 'desc' },
        },
      },
    });
  },

  async create(posyanduId: string, data: any) {
    return prisma.lansia.create({
      data: { ...data, posyanduId },
    });
  },

  async update(id: string, posyanduId: string, data: Parameters<typeof prisma.lansia.update>[0]['data']) {
    const lansia = await prisma.lansia.findFirst({ where: { id, posyanduId } });
    if (!lansia) throw new Error('Lansia tidak ditemukan');
    return prisma.lansia.update({ where: { id }, data });
  },

  async delete(id: string, posyanduId: string) {
    const lansia = await prisma.lansia.findFirst({ where: { id, posyanduId } });
    if (!lansia) throw new Error('Lansia tidak ditemukan');
    return prisma.lansia.delete({ where: { id } });
  },

  // ── Pemeriksaan Lansia ─────────────────────────────────────
  async findAllPemeriksaan(lansiaId: string) {
    return prisma.pemeriksaanLansia.findMany({
      where: { lansiaId },
      orderBy: { tanggalPeriksa: 'desc' },
    });
  },

  async createPemeriksaan(
    lansiaId: string,
    data: {
      tanggalPeriksa: Date;
      beratBadan: number;
      tinggiBadan: number;
      tekananDarahSistol: number;
      tekananDarahDiastol: number;
      gulaDarahSewaktu: number;
      lingkarPerut: number;
      kolesterol?: number;
      asamUrat?: number;
      keluhan?: string;
      tindakan?: string;
      petugas?: string;
    }
  ) {
    const lansia = await prisma.lansia.findUnique({ where: { id: lansiaId } });
    if (!lansia) throw new Error('Lansia tidak ditemukan');
    const periksaDate = new Date(data.tanggalPeriksa);
    const startOfMonth = new Date(Date.UTC(periksaDate.getUTCFullYear(), periksaDate.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(periksaDate.getUTCFullYear(), periksaDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const existingExam = await prisma.pemeriksaanLansia.findFirst({
      where: {
        lansiaId,
        tanggalPeriksa: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingExam) {
      return prisma.pemeriksaanLansia.update({
        where: { id: existingExam.id },
        data,
      });
    }

    return prisma.pemeriksaanLansia.create({ data: { ...data, lansiaId } });
  },

  async updatePemeriksaan(
    id: string,
    data: Partial<Parameters<typeof prisma.pemeriksaanLansia.update>[0]['data']>
  ) {
    return prisma.pemeriksaanLansia.update({ where: { id }, data });
  },

  async deletePemeriksaan(id: string) {
    return prisma.pemeriksaanLansia.delete({ where: { id } });
  },
};
