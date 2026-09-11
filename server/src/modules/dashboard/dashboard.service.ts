import prisma from '../../shared/config/prisma';
import { hitungZScoreBBU, hitungZScoreTBU } from '../../shared/utils/zScoreCalculator';
import cacheService from '../../shared/services/cache.service';

export const dashboardService = {
  /**
   * Mengambil semua metrik ringkasan untuk satu posyandu (FR-05 sd FR-09).
   */
  async getSummary(posyanduId: string) {
    return cacheService.getOrSet(`dashboard:summary:${posyanduId}`, async () => {
      const [
        totalBalita,
        totalLansia,
        pemeriksaanBalitaTerbaru,
        pemeriksaanLansiaTerbaru,
        lansiaHtDm,
      ] = await Promise.all([
        prisma.balita.count({ where: { posyanduId } }),
        prisma.lansia.count({ where: { posyanduId } }),
        prisma.pemeriksaanBalita.findMany({
          where: { balita: { posyanduId } },
          orderBy: { tanggalPeriksa: 'desc' },
          take: 10,
          include: { balita: { select: { nama: true, tanggalLahir: true } } },
        }),
        prisma.pemeriksaanLansia.findMany({
          where: { lansia: { posyanduId } },
          orderBy: { tanggalPeriksa: 'desc' },
          take: 10,
          include: { lansia: { select: { nama: true, tanggalLahir: true } } },
        }),
        prisma.lansia.findMany({
          where: { posyanduId },
          select: { riwayatHt: true, riwayatDm: true },
        }),
      ]);

      const balitasLatestExam = await prisma.$queryRaw<
        Array<{ status_bb_u: string; status_tb_u: string; status_bb_tb: string }>
      >`
        SELECT DISTINCT ON (pb.balita_id) pb.status_bb_u, pb.status_tb_u, pb.status_bb_tb
        FROM pemeriksaan_balita pb
        INNER JOIN balita b ON b.id = pb.balita_id
        WHERE b.posyandu_id = ${posyanduId}
        ORDER BY pb.balita_id, pb.tanggal_periksa DESC
      `;

      const statusGiziSummary = balitasLatestExam.reduce(
        (acc, exam) => {
          acc.bbU[exam.status_bb_u] = (acc.bbU[exam.status_bb_u] || 0) + 1;
          acc.tbU[exam.status_tb_u] = (acc.tbU[exam.status_tb_u] || 0) + 1;
          acc.bbTb[exam.status_bb_tb] = (acc.bbTb[exam.status_bb_tb] || 0) + 1;
          return acc;
        },
        { bbU: {} as Record<string, number>, tbU: {} as Record<string, number>, bbTb: {} as Record<string, number> }
      );

      const totalHt = lansiaHtDm.filter((l) => l.riwayatHt).length;
      const totalDm = lansiaHtDm.filter((l) => l.riwayatDm).length;
      const totalHtDm = lansiaHtDm.filter((l) => l.riwayatHt && l.riwayatDm).length;

      return {
        totalBalita,
        totalLansia,
        statusGizi: statusGiziSummary,
        lansiaHtDm: { totalHt, totalDm, totalHtDm },
        pemeriksaanTerbaru: {
          balita: pemeriksaanBalitaTerbaru,
          lansia: pemeriksaanLansiaTerbaru,
        },
      };
    }, 180);
  },

  /**
   * Agregasi tren historis status gizi balita & Z-score WHO (Bulanan vs Tahunan)
   */
  async getTrenGizi(posyanduId: string, period: 'bulanan' | 'tahunan' = 'bulanan') {
    return cacheService.getOrSet(`dashboard:tren:${posyanduId}:${period}`, async () => {
      const examinations = await prisma.pemeriksaanBalita.findMany({
      where: { balita: { posyanduId } },
      include: {
        balita: {
          select: { jenisKelamin: true },
        },
      },
      orderBy: { tanggalPeriksa: 'asc' },
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const aggregatedMap = new Map<
      string,
      {
        periodKey: string;
        label: string;
        total: number;
        normal: number;
        kurang: number;
        sangatKurang: number;
        lebih: number;
        stunting: number;
        avgZScoreBBU: number;
        avgZScoreTBU: number;
        sumZScoreBBU: number;
        sumZScoreTBU: number;
      }
    >();

    const now = new Date();

    if (period === 'bulanan') {
      // Seed default 6 months of current year if empty
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        aggregatedMap.set(key, {
          periodKey: key,
          label,
          total: 0,
          normal: 0,
          kurang: 0,
          sangatKurang: 0,
          lebih: 0,
          stunting: 0,
          avgZScoreBBU: 0,
          avgZScoreTBU: 0,
          sumZScoreBBU: 0,
          sumZScoreTBU: 0,
        });
      }
    } else {
      // Seed default 3 years
      for (let i = 2; i >= 0; i--) {
        const y = now.getFullYear() - i;
        const key = `${y}`;
        aggregatedMap.set(key, {
          periodKey: key,
          label: `${y}`,
          total: 0,
          normal: 0,
          kurang: 0,
          sangatKurang: 0,
          lebih: 0,
          stunting: 0,
          avgZScoreBBU: 0,
          avgZScoreTBU: 0,
          sumZScoreBBU: 0,
          sumZScoreTBU: 0,
        });
      }
    }

    for (const exam of examinations) {
      const date = new Date(exam.tanggalPeriksa);
      const key = period === 'bulanan'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : `${date.getFullYear()}`;
      
      const label = period === 'bulanan'
        ? `${monthNames[date.getMonth()]} ${date.getFullYear()}`
        : `${date.getFullYear()}`;

      if (!aggregatedMap.has(key)) {
        aggregatedMap.set(key, {
          periodKey: key,
          label,
          total: 0,
          normal: 0,
          kurang: 0,
          sangatKurang: 0,
          lebih: 0,
          stunting: 0,
          avgZScoreBBU: 0,
          avgZScoreTBU: 0,
          sumZScoreBBU: 0,
          sumZScoreTBU: 0,
        });
      }

      const item = aggregatedMap.get(key)!;
      item.total += 1;
      const bbu = (exam.statusBbU || '').toString();
      if (bbu === 'N' || bbu === 'Normal') item.normal += 1;
      else if (bbu === 'K' || bbu === 'Kurang') item.kurang += 1;
      else if (bbu === 'SK' || bbu === 'Sangat Kurang') item.sangatKurang += 1;
      else if (bbu === 'L' || bbu === 'Lebih') item.lebih += 1;

      const tbu = (exam.statusTbU || '').toString();
      if (tbu === 'SP' || tbu === 'P' || tbu === 'Sangat Pendek' || tbu === 'Pendek') {
        item.stunting += 1;
      }

      const zBBU = hitungZScoreBBU(Number(exam.beratBadan), exam.usiaBulan, exam.balita.jenisKelamin);
      const zTBU = hitungZScoreTBU(Number(exam.tinggiBadan), exam.usiaBulan, exam.balita.jenisKelamin);

      item.sumZScoreBBU += zBBU;
      item.sumZScoreTBU += zTBU;
    }

    const result = Array.from(aggregatedMap.values()).map((item) => {
      const avgZScoreBBU = item.total > 0 ? Number((item.sumZScoreBBU / item.total).toFixed(2)) : 0;
      const avgZScoreTBU = item.total > 0 ? Number((item.sumZScoreTBU / item.total).toFixed(2)) : 0;
      const pctNormal = item.total > 0 ? Math.round((item.normal / item.total) * 100) : 0;
      const pctKurang = item.total > 0 ? Math.round(((item.kurang + item.sangatKurang) / item.total) * 100) : 0;

      return {
        periodKey: item.periodKey,
        label: item.label,
        total: item.total,
        normal: item.normal,
        kurang: item.kurang,
        sangatKurang: item.sangatKurang,
        lebih: item.lebih,
        stunting: item.stunting,
        pctNormal,
        pctKurang,
        avgZScoreBBU,
        avgZScoreTBU,
      };
    });

    return result;
    }, 300);
  },

  /**
   * Poin 20: Agregasi distribusi kehadiran per RT/RW (menggantikan mockup)
   */
  async getDistribusiKehadiran(posyanduId: string) {
    return cacheService.getOrSet(`dashboard:kehadiran:${posyanduId}`, async () => {
      // Fetch semua Balita & Lansia
    const [balitas, lansias] = await Promise.all([
      prisma.balita.findMany({
        where: { posyanduId },
        select: { id: true, alamat: true },
      }),
      prisma.lansia.findMany({
        where: { posyanduId },
        select: { id: true, rtRw: true },
      }),
    ]);

    const activePeriode = await prisma.periodePelayanan.findFirst({
      where: { posyanduId, status: 'AKTIF' },
      orderBy: { tanggal: 'desc' },
    });

    const now = new Date();
    const targetMonth = activePeriode ? activePeriode.bulan : (now.getMonth() + 1);
    const targetYear = activePeriode ? activePeriode.tahun : now.getFullYear();

    // Fetch pemeriksaan Balita pada periode aktif
    const balitaExams = await prisma.pemeriksaanBalita.findMany({
      where: { balita: { posyanduId } },
      orderBy: { tanggalPeriksa: 'desc' },
      distinct: ['balitaId'],
      select: {
        balitaId: true,
        tanggalPeriksa: true,
        balita: { select: { alamat: true } },
      },
    });

    // Fetch pemeriksaan Lansia pada periode aktif
    const lansiaExams = await prisma.pemeriksaanLansia.findMany({
      where: { lansia: { posyanduId } },
      orderBy: { tanggalPeriksa: 'desc' },
      distinct: ['lansiaId'],
      select: {
        lansiaId: true,
        tanggalPeriksa: true,
        lansia: { select: { rtRw: true } },
      },
    });

    // Aggregate kehadiran per RT/RW (hanya yang periksa di periode ini)
    const rtRwMap = new Map<string, { total: number; hadir: number }>();

    balitaExams.forEach((exam) => {
      const examDate = new Date(exam.tanggalPeriksa);
      if ((examDate.getMonth() + 1) === targetMonth && examDate.getFullYear() === targetYear) {
        const match = exam.balita.alamat?.match(/RT\s*\d+\s*\/\s*RW\s*\d+/);
        const rtRw = match ? match[0] : 'RT ?/RW ?';
        const current = rtRwMap.get(rtRw) || { total: 0, hadir: 0 };
        current.hadir += 1;
        rtRwMap.set(rtRw, current);
      }
    });

    lansiaExams.forEach((exam) => {
      const examDate = new Date(exam.tanggalPeriksa);
      if ((examDate.getMonth() + 1) === targetMonth && examDate.getFullYear() === targetYear) {
        const rtRw = exam.lansia.rtRw || 'RT ?/RW ?';
        const current = rtRwMap.get(rtRw) || { total: 0, hadir: 0 };
        current.hadir += 1;
        rtRwMap.set(rtRw, current);
      }
    });

    // Set total count untuk setiap RT/RW
    const allRtRw = new Set<string>();
    balitas.forEach((b) => {
      const match = b.alamat?.match(/RT\s*\d+\s*\/\s*RW\s*\d+/);
      const rtRw = match ? match[0] : 'RT ?/RW ?';
      allRtRw.add(rtRw);
    });
    lansias.forEach((l) => {
      allRtRw.add(l.rtRw || 'RT ?/RW ?');
    });

    allRtRw.forEach((rtRw) => {
      const balitaCount = balitas.filter((b) => {
        const match = b.alamat?.match(/RT\s*\d+\s*\/\s*RW\s*\d+/);
        return (match ? match[0] : 'RT ?/RW ?') === rtRw;
      }).length;
      const lansiaCount = lansias.filter((l) => (l.rtRw || 'RT ?/RW ?') === rtRw).length;
      const totalOrang = balitaCount + lansiaCount;

      if (!rtRwMap.has(rtRw)) {
        rtRwMap.set(rtRw, { total: totalOrang, hadir: 0 });
      } else {
        const current = rtRwMap.get(rtRw)!;
        current.total = Math.max(current.total, totalOrang);
      }
    });

    // Calculate persentase dan return
    const result = Array.from(rtRwMap.entries())
      .map(([rtRw, data]) => ({
        rtRw,
        total: data.total || 1,
        hadir: data.hadir,
        persentase: Math.round((data.hadir / (data.total || 1)) * 100),
      }))
      .sort((a, b) => b.persentase - a.persentase);

    return result;
    }, 300);
  },

  /**
   * Agregasi Aktivitas Kunjungan (Balita Selesai, Lansia Selesai, Belum Mengisi Data beserta daftar pasien)
   */
  async getAktivitasKunjungan(posyanduId: string) {
    return cacheService.getOrSet(`dashboard:aktivitas:${posyanduId}`, async () => {
      const [balitas, lansias] = await Promise.all([
      prisma.balita.findMany({
        where: { posyanduId },
        include: {
          pemeriksaans: {
            orderBy: { tanggalPeriksa: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.lansia.findMany({
        where: { posyanduId },
        include: {
          pemeriksaans: {
            orderBy: { tanggalPeriksa: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const balitaSelesaiList: Array<{
      id: string;
      nama: string;
      tipe: 'Balita' | 'Lansia';
      jenisKelamin?: string;
      detailInfo: string;
      statusPeriksa: 'Selesai Periksa' | 'Belum Mengisi Data';
      tanggalPeriksa?: string | null;
      detailPemeriksaan?: string | null;
    }> = [];

    const lansiaSelesaiList: Array<{
      id: string;
      nama: string;
      tipe: 'Balita' | 'Lansia';
      jenisKelamin?: string;
      detailInfo: string;
      statusPeriksa: 'Selesai Periksa' | 'Belum Mengisi Data';
      tanggalPeriksa?: string | null;
      detailPemeriksaan?: string | null;
    }> = [];

    const belumMengisiList: Array<{
      id: string;
      nama: string;
      tipe: 'Balita' | 'Lansia';
      jenisKelamin?: string;
      detailInfo: string;
      statusPeriksa: 'Selesai Periksa' | 'Belum Mengisi Data';
      tanggalPeriksa?: string | null;
      detailPemeriksaan?: string | null;
    }> = [];

    const activePeriode = await prisma.periodePelayanan.findFirst({
      where: { posyanduId, status: 'AKTIF' },
      orderBy: { tanggal: 'desc' },
    });

    const now = new Date();
    const targetMonth = activePeriode ? activePeriode.bulan : (now.getMonth() + 1);
    const targetYear = activePeriode ? activePeriode.tahun : now.getFullYear();

    balitas.forEach((b) => {
      const birthDate = new Date(b.tanggalLahir);
      const ageMonths = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
      const latestExam = b.pemeriksaans[0];
      const detailInfo = `Usia ${ageMonths} Bln • Ibu: ${b.namaIbu}`;

      const examDate = latestExam ? new Date(latestExam.tanggalPeriksa) : null;
      const isExamInCurrentPeriod = examDate && 
        (examDate.getMonth() + 1) === targetMonth && 
        examDate.getFullYear() === targetYear;

      if (latestExam && isExamInCurrentPeriod) {
        balitaSelesaiList.push({
          id: b.id,
          nama: b.nama,
          tipe: 'Balita',
          jenisKelamin: b.jenisKelamin,
          detailInfo,
          statusPeriksa: 'Selesai Periksa',
          tanggalPeriksa: latestExam.tanggalPeriksa.toISOString().split('T')[0],
          detailPemeriksaan: `BB: ${latestExam.beratBadan} kg, TB: ${latestExam.tinggiBadan} cm (BB/U: ${latestExam.statusBbU})`,
        });
      } else {
        belumMengisiList.push({
          id: b.id,
          nama: b.nama,
          tipe: 'Balita',
          jenisKelamin: b.jenisKelamin,
          detailInfo,
          statusPeriksa: 'Belum Mengisi Data',
          tanggalPeriksa: null,
          detailPemeriksaan: 'Belum ada data pemeriksaan periode ini',
        });
      }
    });

    lansias.forEach((l) => {
      const birthDate = new Date(l.tanggalLahir);
      const ageYears = Math.floor((now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
      const latestExam = l.pemeriksaans[0];
      const detailInfo = `Usia ${ageYears} Thn • ${l.rtRw || 'RT/RW -'}`;

      const examDate = latestExam ? new Date(latestExam.tanggalPeriksa) : null;
      const isExamInCurrentPeriod = examDate && 
        (examDate.getMonth() + 1) === targetMonth && 
        examDate.getFullYear() === targetYear;

      if (latestExam && isExamInCurrentPeriod) {
        lansiaSelesaiList.push({
          id: l.id,
          nama: l.nama,
          tipe: 'Lansia',
          jenisKelamin: l.jenisKelamin,
          detailInfo,
          statusPeriksa: 'Selesai Periksa',
          tanggalPeriksa: latestExam.tanggalPeriksa.toISOString().split('T')[0],
          detailPemeriksaan: `TD: ${latestExam.tekananDarahSistol}/${latestExam.tekananDarahDiastol} mmHg, GDS: ${latestExam.gulaDarahSewaktu || '-'}`,
        });
      } else {
        belumMengisiList.push({
          id: l.id,
          nama: l.nama,
          tipe: 'Lansia',
          jenisKelamin: l.jenisKelamin,
          detailInfo,
          statusPeriksa: 'Belum Mengisi Data',
          tanggalPeriksa: null,
          detailPemeriksaan: 'Belum ada data pemeriksaan',
        });
      }
    });

    const balitaSelesaiCount = balitaSelesaiList.length;
    const lansiaSelesaiCount = lansiaSelesaiList.length;
    const belumMengisiCount = belumMengisiList.length;
    const totalSasaran = balitaSelesaiCount + lansiaSelesaiCount + belumMengisiCount;
    const persentaseSelesai = totalSasaran > 0 ? Math.round(((balitaSelesaiCount + lansiaSelesaiCount) / totalSasaran) * 100) : 0;

    return {
      balitaSelesaiCount,
      lansiaSelesaiCount,
      belumMengisiCount,
      totalSasaran,
      persentaseSelesai,
      balitaSelesaiList,
      lansiaSelesaiList,
      belumMengisiList,
    };
    }, 180);
  },

  /**
   * Menghapus semua cache dashboard untuk posyandu tertentu saat data pemeriksaan/pasien diperbarui.
   */
  async invalidateDashboardCache(posyanduId: string) {
    await cacheService.delByPattern(`dashboard:*:${posyanduId}*`);
  },
};

