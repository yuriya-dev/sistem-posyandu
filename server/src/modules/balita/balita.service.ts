import prisma from '../../shared/config/prisma';
import { hitungStatusBbU, hitungStatusTbU, hitungStatusBbTb } from '../../shared/utils/zScoreCalculator';
import { hitungUsiaBulan, kelompokUsiaBulan } from './balita.helper';

export const balitaService = {
  async findAll(
    posyanduId: string,
    search?: string,
    kelompokUsia?: string,
    page: number = 1,
    limit: number = 10
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      posyanduId,
      ...(search && { nama: { contains: search, mode: 'insensitive' } }),
    };

    if (!kelompokUsia) {
      const [total, balitas] = await Promise.all([
        prisma.balita.count({ where }),
        prisma.balita.findMany({
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

      const data = balitas.map((b) => {
        const usiaBulan = hitungUsiaBulan(b.tanggalLahir);
        const kelompok = kelompokUsiaBulan(usiaBulan);
        return { ...b, usiaBulan, kelompokUsia: kelompok };
      });

      const totalPages = Math.ceil(total / limit) || 1;
      return { data, meta: { page, limit, total, totalPages } };
    } else {
      const allBalitas = await prisma.balita.findMany({
        where,
        orderBy: { nama: 'asc' },
        include: {
          pemeriksaans: {
            orderBy: { tanggalPeriksa: 'desc' },
          },
        },
      });

      const filtered = allBalitas
        .map((b) => {
          const usiaBulan = hitungUsiaBulan(b.tanggalLahir);
          const kelompok = kelompokUsiaBulan(usiaBulan);
          return { ...b, usiaBulan, kelompokUsia: kelompok };
        })
        .filter((b) => b.kelompokUsia === kelompokUsia);

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const data = filtered.slice(skip, skip + limit);

      return { data, meta: { page, limit, total, totalPages } };
    }
  },

  async findById(id: string, posyanduId: string) {
    return prisma.balita.findFirst({
      where: { id, posyanduId },
      include: {
        pemeriksaans: {
          orderBy: { tanggalPeriksa: 'desc' },
        },
      },
    });
  },

  async create(posyanduId: string, data: any) {
    return prisma.balita.create({
      data: { ...data, posyanduId },
    });
  },

  async update(id: string, posyanduId: string, data: Parameters<typeof prisma.balita.update>[0]['data']) {
    return prisma.balita.update({ where: { id }, data });
  },

  async delete(id: string, posyanduId: string) {
    const balita = await prisma.balita.findFirst({ where: { id, posyanduId } });
    if (!balita) throw new Error('Balita tidak ditemukan');
    return prisma.balita.delete({ where: { id } });
  },

  // ── Pemeriksaan Balita ─────────────────────────────────────
  async findAllPemeriksaan(balitaId: string) {
    return prisma.pemeriksaanBalita.findMany({
      where: { balitaId },
      orderBy: { tanggalPeriksa: 'desc' },
    });
  },

  async createPemeriksaan(
    balitaId: string,
    data: {
      tanggalPeriksa: Date;
      beratBadan: number;
      tinggiBadan: number;
      lingkarKepala?: number;
      lingkarLengan?: number;
      statusBbU?: 'SK' | 'K' | 'N' | 'L';
      statusTbU?: 'SP' | 'P' | 'N' | 'T';
      statusBbTb?: 'SK' | 'K' | 'N' | 'G';
      statusKms?: string;
      vitaminA: boolean;
      asiEksklusif?: boolean;
      obatCacing?: boolean;
      statusImunisasi?: string;
      petugas?: string;
    }
  ) {
    const balita = await prisma.balita.findUnique({ where: { id: balitaId } });
    if (!balita) throw new Error('Balita tidak ditemukan');

    const usiaBulan = hitungUsiaBulan(balita.tanggalLahir, data.tanggalPeriksa);

    const statusBbU = hitungStatusBbU(Number(data.beratBadan), usiaBulan, balita.jenisKelamin);
    const statusTbU = hitungStatusTbU(Number(data.tinggiBadan), usiaBulan, balita.jenisKelamin);
    const statusBbTb = hitungStatusBbTb(Number(data.beratBadan), Number(data.tinggiBadan), balita.jenisKelamin);

    const periksaDate = new Date(data.tanggalPeriksa);
    const startOfMonth = new Date(Date.UTC(periksaDate.getUTCFullYear(), periksaDate.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(periksaDate.getUTCFullYear(), periksaDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const existingExam = await prisma.pemeriksaanBalita.findFirst({
      where: {
        balitaId,
        tanggalPeriksa: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingExam) {
      return prisma.pemeriksaanBalita.update({
        where: { id: existingExam.id },
        data: {
          ...data,
          statusBbU,
          statusTbU,
          statusBbTb,
          usiaBulan,
        },
      });
    }

    return prisma.pemeriksaanBalita.create({
      data: {
        ...data,
        statusBbU,
        statusTbU,
        statusBbTb,
        balitaId,
        usiaBulan,
      },
    });
  },

  async updatePemeriksaan(
    id: string,
    data: Partial<Parameters<typeof prisma.pemeriksaanBalita.update>[0]['data']>
  ) {
    return prisma.pemeriksaanBalita.update({ where: { id }, data });
  },

  async deletePemeriksaan(id: string) {
    return prisma.pemeriksaanBalita.delete({ where: { id } });
  },
};
