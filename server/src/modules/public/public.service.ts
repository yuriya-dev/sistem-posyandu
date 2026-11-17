import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface PublicPemeriksaanFilter {
  posyanduId?: string;
  kategori?: 'Balita' | 'Lansia' | 'Semua';
  status?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface PublicPemeriksaanItem {
  id: string;
  kategori: 'Balita' | 'Lansia';
  tanggalPeriksa: string;
  namaWarga: string;
  jenisKelamin: 'L' | 'P';
  usiaInfo: string;
  posyanduId: string;
  posyanduNama: string;
  desa: string;
  wilayah: string;
  // Measurements
  beratBadan: number;
  tinggiBadan: number;
  // Balita specific
  lingkarKepala?: number;
  lingkarLengan?: number;
  nik?: string;
  namaIbu?: string;
  statusBbU?: string;
  statusTbU?: string;
  statusBbTb?: string;
  vitaminA?: boolean;
  asiEksklusif?: boolean;
  obatCacing?: boolean;
  vitB1?: boolean;
  vitB6?: boolean;
  statusImunisasi?: string;
  // Lansia specific
  tekananDarah?: string;
  sistol?: number;
  diastol?: number;
  gds?: number;
  kolesterol?: number;
  asamUrat?: number;
  lingkarPerut?: number;
  riwayatHt?: boolean;
  riwayatDm?: boolean;
  rtRw?: string;
  imt?: string;
  keluhan?: string;
  tindakan?: string;
  // General status & notes
  statusRingkasan: string;
  isPerluRujukan: boolean;
  tindakanCatatan?: string;
  petugas?: string;
  tanggalLahir?: string;
}

export const getPublicPosyanduList = async () => {
  const posyandus = await prisma.posyandu.findMany({
    select: {
      id: true,
      nama: true,
      desa: true,
      kecamatan: true,
    },
    orderBy: { nama: 'asc' },
  });
  return posyandus;
};

export const getPublicPemeriksaanData = async (filter: PublicPemeriksaanFilter) => {
  const { posyanduId, kategori = 'Semua', status, search, startDate, endDate } = filter;

  const dateFilter: any = {};
  if (startDate) {
    dateFilter.gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.lte = new Date(endDate);
  }

  const hasDateFilter = startDate || endDate;

  let balitaItems: PublicPemeriksaanItem[] = [];
  let lansiaItems: PublicPemeriksaanItem[] = [];

  // 1. Fetch Balita Examinations if kategori is 'Semua' or 'Balita'
  if (kategori === 'Semua' || kategori === 'Balita') {
    const whereBalita: any = {};
    if (posyanduId && posyanduId !== 'semua') {
      whereBalita.balita = { posyanduId };
    }
    if (hasDateFilter) {
      whereBalita.tanggalPeriksa = dateFilter;
    }
    if (search) {
      whereBalita.balita = {
        ...(whereBalita.balita || {}),
        nama: { contains: search, mode: 'insensitive' },
      };
    }

    const records = await prisma.pemeriksaanBalita.findMany({
      where: whereBalita,
      include: {
        balita: {
          select: {
            id: true,
            nama: true,
            jenisKelamin: true,
            posyandu: {
              select: { id: true, nama: true, desa: true },
            },
          },
        },
      },
      orderBy: { tanggalPeriksa: 'desc' },
      take: 500,
    });

    balitaItems = records.map((r: any) => {
      const isPerluRujukan =
        r.statusBbU === 'SK' ||
        r.statusTbU === 'SP' ||
        r.statusBbTb === 'SK' ||
        r.statusBbTb === 'G';

      let statusBbUText = r.statusBbU === 'SK' ? 'Sangat Kurang' : r.statusBbU === 'K' ? 'Kurang' : r.statusBbU === 'L' ? 'Lebih' : 'Normal';
      let statusTbUText = r.statusTbU === 'SP' ? 'Sangat Pendek (Stunting)' : r.statusTbU === 'P' ? 'Pendek' : r.statusTbU === 'T' ? 'Tinggi' : 'Normal';

      let statusRingkasan = 'Normal';
      if (r.statusTbU === 'SP') statusRingkasan = 'Stunting (Sangat Pendek)';
      else if (r.statusTbU === 'P') statusRingkasan = 'Pendek';
      else if (r.statusBbU === 'SK') statusRingkasan = 'Gizi Sangat Kurang';
      else if (r.statusBbU === 'K') statusRingkasan = 'Gizi Kurang';
      else if (r.statusBbTb === 'G') statusRingkasan = 'Obesitas/Gemuk';

      return {
        id: `balita-exam-${r.id}`,
        kategori: 'Balita',
        tanggalPeriksa: r.tanggalPeriksa.toISOString().split('T')[0],
        namaWarga: r.balita.nama,
        jenisKelamin: r.balita.jenisKelamin as 'L' | 'P',
        usiaInfo: `${r.usiaBulan} Bulan`,
        posyanduId: r.balita.posyandu.id,
        posyanduNama: r.balita.posyandu.nama,
        desa: r.balita.posyandu.desa,
        wilayah: `Desa ${r.balita.posyandu.desa}`,
        beratBadan: Number(r.beratBadan),
        tinggiBadan: Number(r.tinggiBadan),
        lingkarKepala: r.lingkarKepala ? Number(r.lingkarKepala) : undefined,
        lingkarLengan: r.lingkarLengan ? Number(r.lingkarLengan) : undefined,
        statusBbU: statusBbUText,
        statusTbU: statusTbUText,
        statusBbTb: r.statusBbTb,
        vitaminA: r.vitaminA,
        asiEksklusif: r.asiEksklusif,
        obatCacing: r.obatCacing,
        vitB1: r.vitB1,
        vitB6: r.vitB6,
        statusImunisasi: r.statusImunisasi || undefined,
        petugas: r.petugas || 'Kader Posyandu',
        statusRingkasan,
        isPerluRujukan,
      };
    });
  }

  // 2. Fetch Lansia Examinations if kategori is 'Semua' or 'Lansia'
  if (kategori === 'Semua' || kategori === 'Lansia') {
    const whereLansia: any = {};
    if (posyanduId && posyanduId !== 'semua') {
      whereLansia.lansia = { posyanduId };
    }
    if (hasDateFilter) {
      whereLansia.tanggalPeriksa = dateFilter;
    }
    if (search) {
      whereLansia.lansia = {
        ...(whereLansia.lansia || {}),
        nama: { contains: search, mode: 'insensitive' },
      };
    }

    const records = await prisma.pemeriksaanLansia.findMany({
      where: whereLansia,
      include: {
        lansia: {
          select: {
            id: true,
            nama: true,
            jenisKelamin: true,
            tanggalLahir: true, // Dibutuhkan hanya untuk kalkulasi usia tahun di backend
            rtRw: true,
            riwayatHt: true,
            riwayatDm: true,
            posyandu: {
              select: { id: true, nama: true, desa: true },
            },
          },
        },
      },
      orderBy: { tanggalPeriksa: 'desc' },
      take: 500,
    });

    lansiaItems = records.map((r: any) => {
      const sis = r.tekananDarahSistol;
      const dia = r.tekananDarahDiastol;
      const gds = Number(r.gulaDarahSewaktu);

      const isPerluRujukan = sis >= 140 || gds >= 200 || (r.kolesterol ? Number(r.kolesterol) >= 200 : false);

      let statusRingkasan = 'Normal';
      if (sis >= 180) statusRingkasan = 'Hipertensi Berat (Sistol >180)';
      else if (sis >= 140) statusRingkasan = 'Hipertensi Ringan-Sedang';
      else if (gds >= 200) statusRingkasan = 'Diabetes (GDS >200)';
      else if (gds >= 140) statusRingkasan = 'Pre-Diabetes';

      let usiaStr = 'Lansia';
      if (r.lansia.tanggalLahir) {
        const lahir = new Date(r.lansia.tanggalLahir);
        const periksa = new Date(r.tanggalPeriksa);
        const th = Math.floor((periksa.getTime() - lahir.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        usiaStr = `${th} Tahun`;
      }

      return {
        id: `lansia-exam-${r.id}`,
        kategori: 'Lansia',
        tanggalPeriksa: r.tanggalPeriksa.toISOString().split('T')[0],
        namaWarga: r.lansia.nama,
        jenisKelamin: r.lansia.jenisKelamin as 'L' | 'P',
        usiaInfo: usiaStr,
        posyanduId: r.lansia.posyandu.id,
        posyanduNama: r.lansia.posyandu.nama,
        desa: r.lansia.posyandu.desa,
        wilayah: `${r.lansia.rtRw || ''}, Desa ${r.lansia.posyandu.desa}`.replace(/^,\s*/, ''),
        rtRw: r.lansia.rtRw || undefined,
        riwayatHt: r.lansia.riwayatHt,
        riwayatDm: r.lansia.riwayatDm,
        beratBadan: Number(r.beratBadan),
        tinggiBadan: Number(r.tinggiBadan),
        tekananDarah: `${sis}/${dia} mmHg`,
        sistol: sis,
        diastol: dia,
        gds,
        kolesterol: r.kolesterol ? Number(r.kolesterol) : undefined,
        asamUrat: r.asamUrat ? Number(r.asamUrat) : undefined,
        lingkarPerut: r.lingkarPerut ? Number(r.lingkarPerut) : undefined,
        keluhan: r.keluhan || undefined,
        tindakan: r.tindakan || undefined,
        petugas: r.petugas || 'Kader Posyandu',
        statusRingkasan,
        isPerluRujukan,
        tindakanCatatan: r.tindakan || r.keluhan || undefined,
      };
    });
  }

  // Combine and sort by date descending
  let combined = [...balitaItems, ...lansiaItems].sort((a, b) => 
    new Date(b.tanggalPeriksa).getTime() - new Date(a.tanggalPeriksa).getTime()
  );

  // Filter by status keyword if provided
  if (status && status !== 'semua') {
    const sLower = status.toLowerCase();
    combined = combined.filter((item) => {
      if (sLower === 'rujukan' || sLower === 'rawan') return item.isPerluRujukan;
      if (sLower === 'normal') return item.statusRingkasan.toLowerCase().includes('normal');
      if (sLower === 'stunting') return item.statusRingkasan.toLowerCase().includes('stunting');
      if (sLower === 'hipertensi') return item.statusRingkasan.toLowerCase().includes('hipertensi');
      if (sLower === 'diabetes') return item.statusRingkasan.toLowerCase().includes('diabetes');
      return item.statusRingkasan.toLowerCase().includes(sLower);
    });
  }

  return combined;
};

export interface PublicNikCheckResult {
  kategori: 'Balita' | 'Lansia';
  nama: string;
  nik: string;
  maskedNik: string;
  jenisKelamin: 'L' | 'P';
  tanggalLahir: string;
  usiaDeskripsi: string;
  namaIbu?: string;
  alamat: string;
  rtRw?: string;
  posyandu: {
    id: string;
    nama: string;
    desa: string;
    kecamatan: string;
    alamat?: string;
  };
  ringkasanKesehatan: {
    statusUtama: string;
    statusType: 'success' | 'warning' | 'danger' | 'info';
    perluPerhatian: boolean;
    pesanEdukasi: string;
    tanggalPeriksaTerakhir?: string;
  };
  pemeriksaanTerakhir?: any;
  riwayatPemeriksaan: any[];
}

function normalizeDateStr(val: Date | string): string {
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const matchIso = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
  }
  const matchDmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (matchDmy) {
    return `${matchDmy[3]}-${matchDmy[2].padStart(2, '0')}-${matchDmy[1].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str;
}

function maskName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => {
      if (p.length <= 2) return p;
      return `${p[0]}${'*'.repeat(Math.min(p.length - 1, 4))}`;
    })
    .join(' ');
}

export const getPublicDataByNik = async (nik: string, tanggalLahir?: string): Promise<PublicNikCheckResult | null> => {
  const cleanNik = nik.trim().replace(/[^0-9]/g, '');
  if (!cleanNik || cleanNik.length !== 16) {
    return null;
  }

  const maskedNik = `${cleanNik.slice(0, 6)}******${cleanNik.slice(-4)}`;

  // 1. Cari data di Balita
  const balita = await prisma.balita.findFirst({
    where: { nik: cleanNik },
    include: {
      posyandu: {
        select: { id: true, nama: true, desa: true, kecamatan: true, alamat: true },
      },
      pemeriksaans: {
        orderBy: { tanggalPeriksa: 'desc' },
      },
    },
  });

  if (balita) {
    if (tanggalLahir && tanggalLahir.trim()) {
      const inputTgl = normalizeDateStr(tanggalLahir);
      const balitaTgl = normalizeDateStr(balita.tanggalLahir);
      // Validasi ketat kecocokan tanggal lahir untuk mencegah enumerasi NIK
      if (inputTgl !== balitaTgl) {
        return null;
      }
    }

    const lahir = new Date(balita.tanggalLahir);
    const now = new Date();
    const diffMonth =
      (now.getFullYear() - lahir.getFullYear()) * 12 +
      (now.getMonth() - lahir.getMonth());
    const usiaTahun = Math.floor(diffMonth / 12);
    const sisaBulan = diffMonth % 12;
    const usiaDeskripsi =
      usiaTahun > 0
        ? `${usiaTahun} Tahun ${sisaBulan > 0 ? `${sisaBulan} Bulan` : ''}`.trim()
        : `${Math.max(0, diffMonth)} Bulan`;

    const riwayat = balita.pemeriksaans.map((p) => {
      let statusBbUText =
        p.statusBbU === 'SK' ? 'Sangat Kurang' : p.statusBbU === 'K' ? 'Kurang' : p.statusBbU === 'L' ? 'Lebih' : 'Normal';
      let statusTbUText =
        p.statusTbU === 'SP'
          ? 'Sangat Pendek (Stunting)'
          : p.statusTbU === 'P'
          ? 'Pendek'
          : p.statusTbU === 'T'
          ? 'Tinggi'
          : 'Normal';
      let statusBbTbText =
        p.statusBbTb === 'SK'
          ? 'Gizi Buruk'
          : p.statusBbTb === 'K'
          ? 'Gizi Kurang'
          : p.statusBbTb === 'G'
          ? 'Obesitas'
          : 'Gizi Baik';

      return {
        id: p.id,
        tanggalPeriksa: normalizeDateStr(p.tanggalPeriksa),
        usiaBulan: p.usiaBulan,
        beratBadan: Number(p.beratBadan),
        tinggiBadan: Number(p.tinggiBadan),
        lingkarKepala: p.lingkarKepala ? Number(p.lingkarKepala) : undefined,
        lingkarLengan: p.lingkarLengan ? Number(p.lingkarLengan) : undefined,
        statusBbU: statusBbUText,
        statusTbU: statusTbUText,
        statusBbTb: statusBbTbText,
        vitaminA: p.vitaminA,
        asiEksklusif: p.asiEksklusif,
        obatCacing: p.obatCacing,
        vitB1: p.vitB1,
        vitB6: p.vitB6,
        statusImunisasi: p.statusImunisasi || 'Sesuai Usia',
        petugas: p.petugas || 'Kader Posyandu',
      };
    });

    const latest = riwayat[0];
    let statusUtama = 'Gizi Baik (Normal)';
    let statusType: 'success' | 'warning' | 'danger' | 'info' = 'success';
    let perluPerhatian = false;
    let pesanEdukasi = 'Tumbuh kembang anak berada dalam rentang normal. Tetap jaga pola makan bergizi seimbang dan hadir posyandu rutin setiap bulan.';

    if (latest) {
      if (latest.statusTbU.includes('Sangat Pendek')) {
        statusUtama = 'Stunting (Sangat Pendek)';
        statusType = 'danger';
        perluPerhatian = true;
        pesanEdukasi = 'Perlu intervensi gizi dan konsultasi dengan tenaga kesehatan Puskesmas/Posyandu untuk pemantauan tinggi badan intensif.';
      } else if (latest.statusTbU === 'Pendek') {
        statusUtama = 'Tinggi Badan Kurang (Pendek)';
        statusType = 'warning';
        perluPerhatian = true;
        pesanEdukasi = 'Perhatikan asupan protein hewani (telur, ikan, daging) dan pantau kenaikan berat serta tinggi badan bulan berikutnya.';
      } else if (latest.statusBbU === 'Sangat Kurang' || latest.statusBbTb === 'Gizi Buruk') {
        statusUtama = 'Gizi Sangat Kurang';
        statusType = 'danger';
        perluPerhatian = true;
        pesanEdukasi = 'Berat badan sangat kurang. Segera hubungi kader posyandu atau puskesmas untuk mendapatkan makanan tambahan pemulihan.';
      } else if (latest.statusBbU === 'Kurang' || latest.statusBbTb === 'Gizi Kurang') {
        statusUtama = 'Berat Badan Kurang';
        statusType = 'warning';
        perluPerhatian = true;
        pesanEdukasi = 'Tingkatkan frekuensi dan porsi makan bergizi kaya kalori dan protein.';
      }
    }

    return {
      kategori: 'Balita',
      nama: balita.nama,
      nik: maskedNik,
      maskedNik,
      jenisKelamin: balita.jenisKelamin as 'L' | 'P',
      tanggalLahir: normalizeDateStr(balita.tanggalLahir),
      usiaDeskripsi,
      namaIbu: balita.namaIbu ? maskName(balita.namaIbu) : undefined,
      alamat: balita.posyandu.desa ? `Desa ${balita.posyandu.desa}, Kec. ${balita.posyandu.kecamatan}` : 'Wilayah Posyandu',
      posyandu: {
        id: balita.posyandu.id,
        nama: balita.posyandu.nama,
        desa: balita.posyandu.desa,
        kecamatan: balita.posyandu.kecamatan,
        alamat: balita.posyandu.alamat,
      },
      ringkasanKesehatan: {
        statusUtama,
        statusType,
        perluPerhatian,
        pesanEdukasi,
        tanggalPeriksaTerakhir: latest ? latest.tanggalPeriksa : undefined,
      },
      pemeriksaanTerakhir: latest || null,
      riwayatPemeriksaan: riwayat,
    };
  }

  // 2. Cari data di Lansia
  const lansia = await prisma.lansia.findFirst({
    where: { nik: cleanNik },
    include: {
      posyandu: {
        select: { id: true, nama: true, desa: true, kecamatan: true, alamat: true },
      },
      pemeriksaans: {
        orderBy: { tanggalPeriksa: 'desc' },
      },
    },
  });

  if (lansia) {
    if (tanggalLahir && tanggalLahir.trim()) {
      const inputTgl = normalizeDateStr(tanggalLahir);
      const lansiaTgl = normalizeDateStr(lansia.tanggalLahir);
      if (inputTgl !== lansiaTgl) {
        return null;
      }
    }

    const lahir = new Date(lansia.tanggalLahir);
    const now = new Date();
    const th = Math.floor(
      (now.getTime() - lahir.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    const usiaDeskripsi = `${th} Tahun`;

    const riwayat = lansia.pemeriksaans.map((p) => {
      const sis = p.tekananDarahSistol;
      const dia = p.tekananDarahDiastol;
      const gds = Number(p.gulaDarahSewaktu);

      let statusTensi = 'Normal';
      if (sis >= 180 || dia >= 110) statusTensi = 'Hipertensi Berat (Tingkat 3)';
      else if (sis >= 160 || dia >= 100) statusTensi = 'Hipertensi Sedang (Tingkat 2)';
      else if (sis >= 140 || dia >= 90) statusTensi = 'Hipertensi Ringan (Tingkat 1)';
      else if (sis >= 120 && sis < 140) statusTensi = 'Pre-Hipertensi';

      let statusGula = 'Normal';
      if (gds >= 200) statusGula = 'Diabetes (Tinggi)';
      else if (gds >= 140) statusGula = 'Pre-Diabetes (Waspada)';

      return {
        id: p.id,
        tanggalPeriksa: normalizeDateStr(p.tanggalPeriksa),
        beratBadan: Number(p.beratBadan),
        tinggiBadan: Number(p.tinggiBadan),
        tekananDarahSistol: sis,
        tekananDarahDiastol: dia,
        tekananDarah: `${sis}/${dia} mmHg`,
        statusTensi,
        gulaDarahSewaktu: gds,
        statusGula,
        lingkarPerut: p.lingkarPerut ? Number(p.lingkarPerut) : undefined,
        kolesterol: p.kolesterol ? Number(p.kolesterol) : undefined,
        asamUrat: p.asamUrat ? Number(p.asamUrat) : undefined,
        keluhan: p.keluhan || undefined,
        tindakan: p.tindakan || undefined,
        petugas: p.petugas || 'Kader Posyandu',
      };
    });

    const latest = riwayat[0];
    let statusUtama = 'Kondisi Kesehatan Stabil';
    let statusType: 'success' | 'warning' | 'danger' | 'info' = 'success';
    let perluPerhatian = false;
    let pesanEdukasi = 'Tekanan darah dan hasil pemeriksaan dalam batas aman. Pertahankan pola makan sehat rendah garam dan olahraga ringan teratur.';

    if (latest) {
      if (latest.tekananDarahSistol >= 180 || latest.gulaDarahSewaktu >= 250) {
        statusUtama = 'Kondisi Perlu Rujukan (Tensi / Gula Sangat Tinggi)';
        statusType = 'danger';
        perluPerhatian = true;
        pesanEdukasi = 'Tekanan darah atau gula darah sangat tinggi. Sangat disarankan segera memeriksakan diri ke Puskesmas atau dokter terdekat.';
      } else if (latest.tekananDarahSistol >= 140 || latest.gulaDarahSewaktu >= 200) {
        statusUtama = 'Hipertensi / Gula Darah Tinggi';
        statusType = 'warning';
        perluPerhatian = true;
        pesanEdukasi = 'Kurangi konsumsi makanan asin, manis, dan berlemak. Minum obat rutin jika ada resep dokter dan periksa tensi berkala.';
      } else if (latest.statusTensi === 'Pre-Hipertensi' || latest.statusGula.includes('Pre-Diabetes')) {
        statusUtama = 'Perlu Pengawasan Rutin';
        statusType = 'info';
        pesanEdukasi = 'Tanda-tanda pre-hipertensi atau peningkatan gula darah terdeteksi. Disiplin minum air putih dan cukupi istirahat.';
      }
    }

    return {
      kategori: 'Lansia',
      nama: lansia.nama,
      nik: maskedNik,
      maskedNik,
      jenisKelamin: lansia.jenisKelamin as 'L' | 'P',
      tanggalLahir: normalizeDateStr(lansia.tanggalLahir),
      usiaDeskripsi,
      alamat: lansia.posyandu.desa ? `Desa ${lansia.posyandu.desa}, Kec. ${lansia.posyandu.kecamatan}` : 'Wilayah Posyandu',
      rtRw: lansia.rtRw,
      posyandu: {
        id: lansia.posyandu.id,
        nama: lansia.posyandu.nama,
        desa: lansia.posyandu.desa,
        kecamatan: lansia.posyandu.kecamatan,
        alamat: lansia.posyandu.alamat,
      },
      ringkasanKesehatan: {
        statusUtama,
        statusType,
        perluPerhatian,
        pesanEdukasi,
        tanggalPeriksaTerakhir: latest ? latest.tanggalPeriksa : undefined,
      },
      pemeriksaanTerakhir: latest || null,
      riwayatPemeriksaan: riwayat,
    };
  }

  return null;
};
