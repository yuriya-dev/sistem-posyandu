import prisma from '../../shared/config/prisma';
import { CreatePeriodeInput, UpdatePeriodeInput } from './periode.schema';

export const periodeService = {
  async findAllByPosyandu(posyanduId: string) {
    return prisma.periodePelayanan.findMany({
      where: { posyanduId },
      orderBy: [
        { status: 'asc' }, // AKTIF first
        { tanggal: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  },

  async getActiveByPosyandu(posyanduId: string) {
    // Return whichever period is marked AKTIF for this posyandu
    return prisma.periodePelayanan.findFirst({
      where: { posyanduId, status: 'AKTIF' },
      orderBy: { tanggal: 'desc' },
    });
  },

  async create(posyanduId: string, input: CreatePeriodeInput) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // Prevent creating future periods
    if (input.tahun > currentYear || (input.tahun === currentYear && input.bulan > currentMonth)) {
      throw new Error('Periode bulan depan/masa mendatang belum dapat dibuat sebelum tanggal 1 bulan tersebut.');
    }

    const status = input.status || 'AKTIF';

    // If setting to AKTIF, mark existing AKTIF periods as SELESAI
    if (status === 'AKTIF') {
      await prisma.periodePelayanan.updateMany({
        where: { posyanduId, status: 'AKTIF' },
        data: { status: 'SELESAI' },
      });
    }

    return prisma.periodePelayanan.create({
      data: {
        posyanduId,
        nama: input.nama,
        bulan: input.bulan,
        tahun: input.tahun,
        tanggal: new Date(input.tanggal),
        status,
        catatan: input.catatan || null,
      },
    });
  },

  async update(id: string, input: UpdatePeriodeInput, posyanduId?: string) {
    const existing = await prisma.periodePelayanan.findFirst({
      where: {
        id,
        ...(posyanduId ? { posyanduId } : {}),
      },
    });

    if (!existing) {
      throw new Error('Periode pelayanan tidak ditemukan');
    }

    if (input.status === 'AKTIF' && existing.status !== 'AKTIF') {
      // Set others to SELESAI
      await prisma.periodePelayanan.updateMany({
        where: { posyanduId: existing.posyanduId, status: 'AKTIF' },
        data: { status: 'SELESAI' },
      });
    }

    return prisma.periodePelayanan.update({
      where: { id },
      data: {
        ...(input.nama !== undefined && { nama: input.nama }),
        ...(input.bulan !== undefined && { bulan: input.bulan }),
        ...(input.tahun !== undefined && { tahun: input.tahun }),
        ...(input.tanggal !== undefined && { tanggal: new Date(input.tanggal) }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.catatan !== undefined && { catatan: input.catatan }),
      },
    });
  },

  async activate(posyanduId: string, id: string) {
    const existing = await prisma.periodePelayanan.findFirst({
      where: { id, posyanduId },
    });
    if (!existing) {
      throw new Error('Periode pelayanan tidak ditemukan');
    }

    await prisma.periodePelayanan.updateMany({
      where: { posyanduId, status: 'AKTIF' },
      data: { status: 'SELESAI' },
    });

    return prisma.periodePelayanan.update({
      where: { id },
      data: { status: 'AKTIF' },
    });
  },

  async delete(id: string, posyanduId?: string) {
    const existing = await prisma.periodePelayanan.findFirst({
      where: {
        id,
        ...(posyanduId ? { posyanduId } : {}),
      },
    });

    if (!existing) {
      throw new Error('Periode pelayanan tidak ditemukan');
    }

    return prisma.periodePelayanan.delete({
      where: { id },
    });
  },
};
