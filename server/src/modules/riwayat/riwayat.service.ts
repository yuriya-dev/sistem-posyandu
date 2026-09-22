import prisma from '../../shared/config/prisma';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  normalizeStatusBbUCode,
  normalizeStatusTbUCode,
  normalizeStatusBbTbCode,
} from '../../shared/utils/zScoreCalculator';

export interface FilterRiwayat {
  tipe?: 'semua' | 'Balita' | 'Lansia';
  search?: string;
  status?: 'semua' | 'success' | 'warning';
  bulan?: number;
  tahun?: number;
}

export interface ItemRiwayat {
  id: string;
  pasienId?: string;
  nama: string;
  tipe: 'Balita' | 'Lansia';
  tanggal: string;
  petugas: string;
  parameter: string;
  status: string;
  statusType: 'success' | 'warning' | 'info';
  tanggalLahir?: string;
  nik?: string;
  namaIbu?: string;
  usiaBulan?: number;
  jenisKelamin?: string;
  beratBadan?: number;
  tinggiBadan?: number;
  lingkarKepala?: number;
  lingkarLengan?: number;
  statusBbU?: string;
  statusTbU?: string;
  statusBbTb?: string;
  statusKms?: string;
  vitaminA?: boolean;
  asiEksklusif?: boolean;
  obatCacing?: boolean;
  vitB1?: boolean;
  vitB6?: boolean;
  statusImunisasi?: string;
  tekananDarahSistol?: number;
  tekananDarahDiastol?: number;
  gulaDarahSewaktu?: number;
  riwayatHt?: boolean;
  riwayatDm?: boolean;
  kolesterol?: number;
  asamUrat?: number;
  lingkarPerut?: number;
  keluhan?: string;
  tindakan?: string;
}

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function getUsiaText(tanggalLahir?: string, tanggalPeriksa?: string, tipe?: string): string {
  if (!tanggalLahir || !tanggalPeriksa) return '-';
  const tLahir = new Date(tanggalLahir);
  const tPeriksa = new Date(tanggalPeriksa);
  let months = (tPeriksa.getFullYear() - tLahir.getFullYear()) * 12 + (tPeriksa.getMonth() - tLahir.getMonth());
  if (tPeriksa.getDate() < tLahir.getDate()) months--;
  if (months < 0) months = 0;
  if (tipe === 'Balita') return `${months} bln`;
  const years = Math.floor(months / 12);
  return `${years} thn`;
}

function getStatusBbUText(code?: string): string {
  if (!code) return '-';
  switch (code) {
    case 'SK': return 'Sangat Kurang';
    case 'K': return 'Kurang';
    case 'N': return 'Normal';
    case 'L': return 'Lebih';
    default: return code;
  }
}

function getStatusTbUText(code?: string): string {
  if (!code) return '-';
  switch (code) {
    case 'SP': return 'Sangat Pendek';
    case 'P': return 'Pendek';
    case 'N': return 'Normal';
    case 'T': return 'Tinggi';
    default: return code;
  }
}

function getStatusBbTbText(code?: string): string {
  if (!code) return '-';
  switch (code) {
    case 'SK': return 'Sangat Kurus';
    case 'K': return 'Kurus';
    case 'N': return 'Normal';
    case 'G': return 'Gemuk';
    default: return code;
  }
}

export function extractPemberianLain(statusImunisasi?: string | null): string {
  if (!statusImunisasi || !statusImunisasi.trim()) return '-';

  if (/Pemberian:/i.test(statusImunisasi)) {
    const matches = [...statusImunisasi.matchAll(/Pemberian:\s*([^|]+)/gi)];
    if (matches.length > 0) {
      const items = new Set<string>();
      for (const m of matches) {
        m[1].split(',').forEach((s) => {
          const trimmed = s.trim();
          if (trimmed) items.add(trimmed);
        });
      }
      return items.size > 0 ? Array.from(items).join(', ') : '-';
    }
  }

  const clean = statusImunisasi
    .replace(/\|\s*Pemberian:\s*/gi, '')
    .replace(/^Pemberian:\s*/gi, '')
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .trim();

  return clean || '-';
}

export const riwayatService = {
  async getRiwayat(posyanduId: string, filter: FilterRiwayat): Promise<ItemRiwayat[]> {
    const { tipe = 'semua', search, status = 'semua', bulan, tahun } = filter;

    const results: ItemRiwayat[] = [];

    if (tipe === 'semua' || tipe === 'Balita') {
      const meBalita = await prisma.pemeriksaanBalita.findMany({
        where: {
          balita: {
            posyanduId,
            ...(search && { nama: { contains: search, mode: 'insensitive' } }),
          },
        },
        include: {
          balita: {
            select: { id: true, nama: true, nik: true, namaIbu: true, tanggalLahir: true, jenisKelamin: true, posyandu: { select: { nama: true } } },
          },
        },
        orderBy: [{ tanggalPeriksa: 'desc' }, { createdAt: 'desc' }],
      });

      const seenBalitaByMonth = new Set<string>();
      for (const item of meBalita) {
        if (!item.balita) continue;

        // Pengecekan Filter Bulan & Tahun Presisi (Timezone UTC Safe)
        const itemDate = new Date(item.tanggalPeriksa);
        const itemBulan = itemDate.getUTCMonth() + 1; // 1 - 12
        const itemTahun = itemDate.getUTCFullYear();

        if (bulan && itemBulan !== bulan) continue;
        if (tahun && itemTahun !== tahun) continue;

        // Dalam 1 periode bulan, setiap pengunjung hanya memiliki 1 data terbaru
        const visitorKey = `${item.balitaId}_${itemTahun}_${itemBulan}`;
        if (seenBalitaByMonth.has(visitorKey)) continue;
        seenBalitaByMonth.add(visitorKey);

        const codeBbU = normalizeStatusBbUCode(item.statusBbU, Number(item.beratBadan), item.usiaBulan, item.balita.jenisKelamin);
        const codeTbU = normalizeStatusTbUCode(item.statusTbU, Number(item.tinggiBadan), item.usiaBulan, item.balita.jenisKelamin);
        const codeBbTb = normalizeStatusBbTbCode(item.statusBbTb, Number(item.beratBadan), Number(item.tinggiBadan), item.balita.jenisKelamin);

        const isWarning = codeBbU === 'SK' || codeBbU === 'K' || codeTbU === 'SP' || codeTbU === 'P' || codeBbTb === 'SK' || codeBbTb === 'K' || codeBbTb === 'G';
        const statusType: 'success' | 'warning' = isWarning ? 'warning' : 'success';

        let statusDesc = `Normal (BB/U: ${getStatusBbUText(codeBbU)})`;
        if (codeBbU === 'K') statusDesc = 'BB Kurang';
        else if (codeBbU === 'SK') statusDesc = 'BB Sangat Kurang';
        else if (codeTbU === 'P') statusDesc = 'Stunting (Pendek)';
        else if (codeTbU === 'SP') statusDesc = 'Sangat Pendek';
        else if (codeBbTb === 'G') statusDesc = 'Gizi Lebih / Obesitas';

        const paramStr = `BB: ${item.beratBadan}kg, TB: ${item.tinggiBadan}cm${item.lingkarKepala ? `, LK: ${item.lingkarKepala}cm` : ''}${item.vitaminA ? ', Vit A' : ''}`;

        results.push({
          id: item.id,
          pasienId: item.balitaId,
          nama: item.balita.nama,
          nik: item.balita.nik || undefined,
          namaIbu: item.balita.namaIbu || undefined,
          usiaBulan: item.usiaBulan,
          tipe: 'Balita',
          tanggal: item.tanggalPeriksa.toISOString().split('T')[0],
          petugas: item.petugas || 'Kader Posyandu',
          parameter: paramStr,
          status: statusDesc,
          statusType,
          tanggalLahir: item.balita.tanggalLahir ? item.balita.tanggalLahir.toISOString().split('T')[0] : undefined,
          jenisKelamin: item.balita.jenisKelamin,
          beratBadan: Number(item.beratBadan),
          tinggiBadan: Number(item.tinggiBadan),
          lingkarKepala: item.lingkarKepala ? Number(item.lingkarKepala) : undefined,
          lingkarLengan: item.lingkarLengan ? Number(item.lingkarLengan) : undefined,
          statusBbU: codeBbU,
          statusTbU: codeTbU,
          statusBbTb: codeBbTb,
          statusKms: item.statusKms || undefined,
          vitaminA: item.vitaminA,
          asiEksklusif: item.asiEksklusif || undefined,
          obatCacing: item.obatCacing || undefined,
          vitB1: (item as any).vitB1 || undefined,
          vitB6: (item as any).vitB6 || undefined,
          statusImunisasi: item.statusImunisasi || undefined,
        });
      }
    }

    if (tipe === 'semua' || tipe === 'Lansia') {
      const meLansia = await prisma.pemeriksaanLansia.findMany({
        where: {
          lansia: {
            posyanduId,
            ...(search && { nama: { contains: search, mode: 'insensitive' } }),
          },
        },
        include: {
          lansia: {
            select: { id: true, nama: true, nik: true, tanggalLahir: true, jenisKelamin: true, riwayatHt: true, riwayatDm: true },
          },
        },
        orderBy: [{ tanggalPeriksa: 'desc' }, { createdAt: 'desc' }],
      });

      const seenLansiaByMonth = new Set<string>();
      for (const item of meLansia) {
        if (!item.lansia) continue;

        // Pengecekan Filter Bulan & Tahun Presisi (Timezone UTC Safe)
        const itemDate = new Date(item.tanggalPeriksa);
        const itemBulan = itemDate.getUTCMonth() + 1; // 1 - 12
        const itemTahun = itemDate.getUTCFullYear();

        if (bulan && itemBulan !== bulan) continue;
        if (tahun && itemTahun !== tahun) continue;

        // Dalam 1 periode bulan, setiap pengunjung hanya memiliki 1 data terbaru
        const visitorKey = `${item.lansiaId}_${itemTahun}_${itemBulan}`;
        if (seenLansiaByMonth.has(visitorKey)) continue;
        seenLansiaByMonth.add(visitorKey);

        const isHipertensi = item.tekananDarahSistol >= 140 || item.tekananDarahDiastol >= 90;
        const isGdsTinggi = Number(item.gulaDarahSewaktu) >= 200;
        const isWarning = isHipertensi || isGdsTinggi;
        const statusType: 'success' | 'warning' = isWarning ? 'warning' : 'success';

        let statusDesc = 'Sehat & Normal';
        if (isHipertensi && isGdsTinggi) statusDesc = 'Hipertensi & GDS Tinggi';
        else if (isHipertensi) statusDesc = 'Hipertensi';
        else if (isGdsTinggi) statusDesc = 'GDS Tinggi';

        const paramStr = `BB: ${item.beratBadan}kg, TB: ${item.tinggiBadan}cm, TD: ${item.tekananDarahSistol}/${item.tekananDarahDiastol} mmHg, GDS: ${item.gulaDarahSewaktu}`;

        results.push({
          id: item.id,
          pasienId: item.lansiaId,
          nama: item.lansia.nama,
          nik: item.lansia.nik || undefined,
          riwayatHt: item.lansia.riwayatHt,
          riwayatDm: item.lansia.riwayatDm,
          tipe: 'Lansia',
          tanggal: item.tanggalPeriksa.toISOString().split('T')[0],
          petugas: item.petugas || 'Kader Posyandu',
          parameter: paramStr,
          status: statusDesc,
          statusType,
          tanggalLahir: item.lansia.tanggalLahir ? item.lansia.tanggalLahir.toISOString().split('T')[0] : undefined,
          jenisKelamin: item.lansia.jenisKelamin,
          beratBadan: Number(item.beratBadan),
          tinggiBadan: Number(item.tinggiBadan),
          tekananDarahSistol: item.tekananDarahSistol,
          tekananDarahDiastol: item.tekananDarahDiastol,
          gulaDarahSewaktu: Number(item.gulaDarahSewaktu),
          kolesterol: item.kolesterol ? Number(item.kolesterol) : undefined,
          asamUrat: item.asamUrat ? Number(item.asamUrat) : undefined,
          lingkarPerut: Number(item.lingkarPerut),
          keluhan: item.keluhan || undefined,
          tindakan: item.tindakan || undefined,
        });
      }
    }

    results.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    if (status && status !== 'semua') {
      return results.filter((r) => r.statusType === status);
    }

    return results;
  },

  async generateExcelExport(posyanduId: string, filter: FilterRiwayat): Promise<ExcelJS.Workbook> {
    const posyandu = await prisma.posyandu.findUnique({ where: { id: posyanduId } });
    if (!posyandu) {
      throw new Error('Posyandu tidak ditemukan');
    }

    // Ambil data yang sudah terfilter secara tepat
    const data = await this.getRiwayat(posyanduId, filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistem Informasi Posyandu';
    workbook.created = new Date();

    const rawDesa = (posyandu.desa || 'WATULAWANG').trim();
    const cleanDesa = rawDesa.replace(/^DESA\s+/i, '').trim();

    const rawKec = (posyandu.kecamatan || 'PEJAGOAN').trim();
    const cleanKec = rawKec.replace(/^(PUSKESMAS|KECAMATAN)\s+/i, '').trim();

    const tahunVal = filter.tahun || new Date().getFullYear();
    const rawPosName = posyandu.nama.toUpperCase().replace(/^POSYANDU\s+/i, '').trim();
    const desaKecStr = `DESA ${cleanDesa.toUpperCase()} KECAMATAN ${cleanKec.toUpperCase()}`;
    const tahunStr = `TAHUN ${tahunVal}`;
    const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Subtitle Filter untuk Excel Header
    const filterInfoArr = [];
    if (filter.bulan) filterInfoArr.push(`Bulan: ${NAMA_BULAN[filter.bulan - 1]}`);
    if (filter.tahun) filterInfoArr.push(`Tahun: ${filter.tahun}`);
    if (filter.status && filter.status !== 'semua') filterInfoArr.push(`Status: ${filter.status === 'warning' ? 'Perlu Perhatian' : 'Normal'}`);
    if (filter.search) filterInfoArr.push(`Pencarian: "${filter.search}"`);

    const subTitleStr = filterInfoArr.length > 0
      ? `Filter Aktif: ${filterInfoArr.join(' | ')}   •   Tanggal Cetak: ${todayFormatted}`
      : `Tanggal Cetak Laporan: ${todayFormatted}`;

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    const applyBordersToRange = (
      sheet: ExcelJS.Worksheet,
      startRow: number,
      startCol: number,
      endRow: number,
      endCol: number,
      border: Partial<ExcelJS.Borders>
    ) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          sheet.getCell(r, c).border = border;
        }
      }
    };

    const styleHeaderCell = (
      cell: ExcelJS.Cell,
      bgColorArgb: string,
      borderColorArgb: string,
      fontSize = 8.5
    ) => {
      cell.font = { name: 'Arial', size: fontSize, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColorArgb } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: borderColorArgb } },
        left: { style: 'thin', color: { argb: borderColorArgb } },
        bottom: { style: 'thin', color: { argb: borderColorArgb } },
        right: { style: 'thin', color: { argb: borderColorArgb } },
      };
    };

    // ─────────────────────────────────────────────────────────────
    // WORKSHEET BALITA (PERSIS DENGAN FORMAT REGISTER PDF)
    // ─────────────────────────────────────────────────────────────
    const createBalitaWorksheet = (sheetName: string, items: ItemRiwayat[]) => {
      const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      sheet.views = [{ showGridLines: true }];

      // Kop Surat Resmi (Persis PDF)
      sheet.mergeCells('A1:AC1');
      sheet.getCell('A1').value = `REGISTER POSYANDU BALITA ${rawPosName}`;
      sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
      sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 22;

      sheet.mergeCells('A2:AC2');
      sheet.getCell('A2').value = desaKecStr;
      sheet.getCell('A2').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 18;

      sheet.mergeCells('A3:AC3');
      sheet.getCell('A3').value = tahunStr;
      sheet.getCell('A3').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
      sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(3).height = 16;

      sheet.mergeCells('A4:AC4');
      sheet.getCell('A4').value = subTitleStr;
      sheet.getCell('A4').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
      sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(4).height = 16;

      sheet.getRow(5).height = 10;

      // Header Bertingkat (Baris 6, 7, 8)
      // Style semua sel di range header terlebih dahulu
      for (let r = 6; r <= 8; r++) {
        sheet.getRow(r).height = 20;
        for (let c = 1; c <= 29; c++) {
          styleHeaderCell(sheet.getCell(r, c), 'FF0F766E', 'FF0D9488', 8);
        }
      }

      // Baris 6 (Header Group Level 1)
      sheet.getCell('A6').value = 'NO';
      sheet.getCell('B6').value = 'INFORMASI BALITA';
      sheet.getCell('H6').value = 'PENGUKURAN';
      sheet.getCell('J6').value = 'STATUS GIZI';
      sheet.getCell('V6').value = 'PELAYANAN YANG DIBERIKAN';
      sheet.getCell('AB6').value = 'FISIK';

      // Baris 7 (Header Sub-Kolom Level 2)
      sheet.getCell('B7').value = 'Nama Balita';
      sheet.getCell('C7').value = 'Tgl Lahir';
      sheet.getCell('D7').value = 'NIK';
      sheet.getCell('E7').value = 'Nama Ibu';
      sheet.getCell('F7').value = 'JK';
      sheet.getCell('G7').value = 'Usia';
      sheet.getCell('H7').value = 'BB (kg)';
      sheet.getCell('I7').value = 'TB (cm)';
      sheet.getCell('J7').value = 'BB/U';
      sheet.getCell('N7').value = 'TB/U';
      sheet.getCell('R7').value = 'BB/TB';
      sheet.getCell('V7').value = 'B1';
      sheet.getCell('W7').value = 'B6';
      sheet.getCell('X7').value = 'ASI';
      sheet.getCell('Y7').value = 'Vit A';
      sheet.getCell('Z7').value = 'Cacing';
      sheet.getCell('AA7').value = 'Pemberian Lain';
      sheet.getCell('AB7').value = 'LK (cm)';
      sheet.getCell('AC7').value = 'LiLA';

      // Baris 8 (Header Sub-Kolom Level 3 - Status Gizi)
      sheet.getCell('J8').value = 'SK';
      sheet.getCell('K8').value = 'K';
      sheet.getCell('L8').value = 'N';
      sheet.getCell('M8').value = 'L';
      sheet.getCell('N8').value = 'SP';
      sheet.getCell('O8').value = 'P';
      sheet.getCell('P8').value = 'N';
      sheet.getCell('Q8').value = 'T';
      sheet.getCell('R8').value = 'SK';
      sheet.getCell('S8').value = 'K';
      sheet.getCell('T8').value = 'N';
      sheet.getCell('U8').value = 'G';

      // Penggabungan Sel (Merges)
      sheet.mergeCells('A6:A8');
      sheet.mergeCells('B6:G6');
      sheet.mergeCells('H6:I6');
      sheet.mergeCells('J6:U6');
      sheet.mergeCells('V6:AA6');
      sheet.mergeCells('AB6:AC6');

      sheet.mergeCells('B7:B8');
      sheet.mergeCells('C7:C8');
      sheet.mergeCells('D7:D8');
      sheet.mergeCells('E7:E8');
      sheet.mergeCells('F7:F8');
      sheet.mergeCells('G7:G8');
      sheet.mergeCells('H7:H8');
      sheet.mergeCells('I7:I8');
      sheet.mergeCells('J7:M7');
      sheet.mergeCells('N7:Q7');
      sheet.mergeCells('R7:U7');
      sheet.mergeCells('V7:V8');
      sheet.mergeCells('W7:W8');
      sheet.mergeCells('X7:X8');
      sheet.mergeCells('Y7:Y8');
      sheet.mergeCells('Z7:Z8');
      sheet.mergeCells('AA7:AA8');
      sheet.mergeCells('AB7:AB8');
      sheet.mergeCells('AC7:AC8');

      // Isi Baris Data Balita
      let currentRow = 9;
      if (items.length === 0) {
        sheet.mergeCells(`A${currentRow}:AC${currentRow}`);
        const emptyCell = sheet.getCell(`A${currentRow}`);
        emptyCell.value = 'Tidak ada data pemeriksaan balita pada periode ini';
        emptyCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(currentRow).height = 24;
        applyBordersToRange(sheet, currentRow, 1, currentRow, 29, thinBorder);
        currentRow++;
      } else {
        items.forEach((item, idx) => {
          let ageMonths = item.usiaBulan;
          if (ageMonths === undefined && item.tanggalLahir) {
            const tL = new Date(item.tanggalLahir);
            const tP = new Date(item.tanggal);
            ageMonths = (tP.getFullYear() - tL.getFullYear()) * 12 + (tP.getMonth() - tL.getMonth());
            if (tP.getDate() < tL.getDate()) ageMonths--;
            if (ageMonths < 0) ageMonths = 0;
          }
          const usiaStr = ageMonths !== undefined ? `${ageMonths} bln` : '-';

          const rowData = [
            idx + 1,
            item.nama || '-',
            item.tanggalLahir ? item.tanggalLahir.substring(0, 10) : '-',
            item.nik || '-',
            item.namaIbu || '-',
            item.jenisKelamin || '-',
            usiaStr,
            item.beratBadan !== undefined ? item.beratBadan : '-',
            item.tinggiBadan !== undefined ? item.tinggiBadan : '-',
            item.statusBbU === 'SK' ? '✓' : '-',
            item.statusBbU === 'K' ? '✓' : '-',
            item.statusBbU === 'N' ? '✓' : '-',
            item.statusBbU === 'L' ? '✓' : '-',
            item.statusTbU === 'SP' ? '✓' : '-',
            item.statusTbU === 'P' ? '✓' : '-',
            item.statusTbU === 'N' ? '✓' : '-',
            item.statusTbU === 'T' ? '✓' : '-',
            item.statusBbTb === 'SK' ? '✓' : '-',
            item.statusBbTb === 'K' ? '✓' : '-',
            item.statusBbTb === 'N' ? '✓' : '-',
            item.statusBbTb === 'G' ? '✓' : '-',
            item.vitB1 ? '✓' : '-',
            item.vitB6 ? '✓' : '-',
            item.asiEksklusif ? '✓' : '-',
            item.vitaminA ? '✓' : '-',
            item.obatCacing ? '✓' : '-',
            extractPemberianLain(item.statusImunisasi),
            item.lingkarKepala !== undefined ? item.lingkarKepala : '-',
            item.lingkarLengan !== undefined ? item.lingkarLengan : '-'
          ];

          const row = sheet.getRow(currentRow);
          row.values = rowData;
          row.height = 20;

          const isEven = idx % 2 === 0;
          const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

          for (let c = 1; c <= 29; c++) {
            const cell = sheet.getCell(currentRow, c);
            cell.font = { name: 'Arial', size: 8.5, bold: c === 2 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
            cell.border = thinBorder;

            if (c === 2 || c === 5) {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          }

          currentRow++;
        });
      }

      // Lebar Kolom
      const balitaColWidths = [
        6,   // 1: No
        24,  // 2: Nama Balita
        13,  // 3: Tgl Lahir
        18,  // 4: NIK
        20,  // 5: Nama Ibu
        6,   // 6: JK
        10,  // 7: Usia
        9,   // 8: BB (kg)
        9,   // 9: TB (cm)
        5,   // 10: BB/U SK
        5,   // 11: BB/U K
        5,   // 12: BB/U N
        5,   // 13: BB/U L
        5,   // 14: TB/U SP
        5,   // 15: TB/U P
        5,   // 16: TB/U N
        5,   // 17: TB/U T
        5,   // 18: BB/TB SK
        5,   // 19: BB/TB K
        5,   // 20: BB/TB N
        5,   // 21: BB/TB G
        6,   // 22: B1
        6,   // 23: B6
        7,   // 24: ASI
        8,   // 25: Vit A
        9,   // 26: Cacing
        22,  // 27: Pemberian Lain
        9,   // 28: LK (cm)
        9    // 29: LiLA
      ];

      balitaColWidths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
      });

      // ─────────────────────────────────────────────────────────────
      // SUMMARY BOX LENGKAP BALITA (PERSIS FORMAT PDF)
      // ─────────────────────────────────────────────────────────────
      const getAgeInfo = (item: ItemRiwayat) => {
        let m = item.usiaBulan;
        if (m === undefined && item.tanggalLahir) {
          const tL = new Date(item.tanggalLahir);
          const tP = new Date(item.tanggal);
          m = (tP.getFullYear() - tL.getFullYear()) * 12 + (tP.getMonth() - tL.getMonth());
          if (tP.getDate() < tL.getDate()) m--;
          if (m < 0) m = 0;
        }
        const months = m ?? 0;
        return { months };
      };

      const age0_6 = items.filter(i => getAgeInfo(i).months >= 0 && getAgeInfo(i).months <= 6).length;
      const age7_12 = items.filter(i => getAgeInfo(i).months >= 7 && getAgeInfo(i).months <= 12).length;
      const age13_24 = items.filter(i => getAgeInfo(i).months >= 13 && getAgeInfo(i).months <= 24).length;
      const age25_60 = items.filter(i => getAgeInfo(i).months >= 25 && getAgeInfo(i).months <= 60).length;

      const bbUNormal = items.filter(i => normalizeStatusBbUCode(i.statusBbU, Number(i.beratBadan), i.usiaBulan, i.jenisKelamin) === 'N').length;
      const bbUKurang = items.filter(i => normalizeStatusBbUCode(i.statusBbU, Number(i.beratBadan), i.usiaBulan, i.jenisKelamin) === 'K').length;
      const bbUSgKurang = items.filter(i => normalizeStatusBbUCode(i.statusBbU, Number(i.beratBadan), i.usiaBulan, i.jenisKelamin) === 'SK').length;

      const tbUNormal = items.filter(i => normalizeStatusTbUCode(i.statusTbU, Number(i.tinggiBadan), i.usiaBulan, i.jenisKelamin) === 'N').length;
      const tbUPendek = items.filter(i => normalizeStatusTbUCode(i.statusTbU, Number(i.tinggiBadan), i.usiaBulan, i.jenisKelamin) === 'P').length;
      const tbUSgPendek = items.filter(i => normalizeStatusTbUCode(i.statusTbU, Number(i.tinggiBadan), i.usiaBulan, i.jenisKelamin) === 'SP').length;
      const tbUStunting = tbUPendek + tbUSgPendek;

      const bbTbNormal = items.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'N').length;
      const bbTbKurus = items.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'K').length;
      const bbTbSgKurus = items.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'SK').length;
      const bbTbGemuk = items.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'G').length;
      const bbTbWasting = bbTbKurus + bbTbSgKurus;

      const vitACount = items.filter(i => i.vitaminA).length;
      const asiCount = items.filter(i => i.asiEksklusif).length;
      const obatCacingCount = items.filter(i => i.obatCacing).length;
      const pemberianLainCount = items.filter(i => i.statusImunisasi && i.statusImunisasi.trim() !== '').length;

      const sRow = currentRow + 1;

      // Background Box Summary (Putih Bersih & Profesional)
      for (let r = sRow; r <= sRow + 5; r++) {
        sheet.getRow(r).height = 18;
        for (let c = 1; c <= 29; c++) {
          const cell = sheet.getCell(r, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      }

      // Title Summary
      sheet.mergeCells(`A${sRow}:AC${sRow}`);
      const sumTitleCell = sheet.getCell(`A${sRow}`);
      sumTitleCell.value = 'REKAPITULASI PELAYANAN KESEHATAN BALITA';
      sumTitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      sumTitleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      sheet.getRow(sRow).height = 22;

      // Group Subtitles
      sheet.mergeCells(`B${sRow + 1}:H${sRow + 1}`);
      const g1 = sheet.getCell(`B${sRow + 1}`);
      g1.value = 'Distribusi Sasaran Usia Balita:';
      g1.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };

      sheet.mergeCells(`J${sRow + 1}:U${sRow + 1}`);
      const g2 = sheet.getCell(`J${sRow + 1}`);
      g2.value = 'Status Gizi Antropometri (BB/U, TB/U, TB/BB):';
      g2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };

      sheet.mergeCells(`V${sRow + 1}:AC${sRow + 1}`);
      const g3 = sheet.getCell(`V${sRow + 1}`);
      g3.value = 'Pelayanan Kesehatan & Suplementasi:';
      g3.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };

      // Row 1 Values
      sheet.mergeCells(`B${sRow + 2}:D${sRow + 2}`);
      sheet.getCell(`B${sRow + 2}`).value = '• 0 - 6 Bulan';
      sheet.mergeCells(`E${sRow + 2}:H${sRow + 2}`);
      sheet.getCell(`E${sRow + 2}`).value = `:  ${age0_6} Anak`;

      sheet.mergeCells(`J${sRow + 2}:M${sRow + 2}`);
      sheet.getCell(`J${sRow + 2}`).value = '• BB/U';
      sheet.mergeCells(`N${sRow + 2}:U${sRow + 2}`);
      sheet.getCell(`N${sRow + 2}`).value = `:  ${bbUNormal} Normal | ${bbUKurang} Kurang | ${bbUSgKurang} S.Kurang`;

      sheet.mergeCells(`V${sRow + 2}:X${sRow + 2}`);
      sheet.getCell(`V${sRow + 2}`).value = '• Vitamin A (Kapsul)';
      sheet.mergeCells(`Y${sRow + 2}:AC${sRow + 2}`);
      sheet.getCell(`Y${sRow + 2}`).value = `:  ${vitACount} Balita`;

      // Row 2 Values
      sheet.mergeCells(`B${sRow + 3}:D${sRow + 3}`);
      sheet.getCell(`B${sRow + 3}`).value = '• 7 - 12 Bulan';
      sheet.mergeCells(`E${sRow + 3}:H${sRow + 3}`);
      sheet.getCell(`E${sRow + 3}`).value = `:  ${age7_12} Anak`;

      sheet.mergeCells(`J${sRow + 3}:M${sRow + 3}`);
      sheet.getCell(`J${sRow + 3}`).value = '• TB/U';
      sheet.mergeCells(`N${sRow + 3}:U${sRow + 3}`);
      sheet.getCell(`N${sRow + 3}`).value = `:  ${tbUNormal} Normal | ${tbUPendek} Pendek | ${tbUSgPendek} S.Pendek`;

      sheet.mergeCells(`V${sRow + 3}:X${sRow + 3}`);
      sheet.getCell(`V${sRow + 3}`).value = '• ASI Eksklusif';
      sheet.mergeCells(`Y${sRow + 3}:AC${sRow + 3}`);
      sheet.getCell(`Y${sRow + 3}`).value = `:  ${asiCount} Bayi`;

      // Row 3 Values
      sheet.mergeCells(`B${sRow + 4}:D${sRow + 4}`);
      sheet.getCell(`B${sRow + 4}`).value = '• 13 - 24 Bulan';
      sheet.mergeCells(`E${sRow + 4}:H${sRow + 4}`);
      sheet.getCell(`E${sRow + 4}`).value = `:  ${age13_24} Anak`;

      sheet.mergeCells(`J${sRow + 4}:M${sRow + 4}`);
      sheet.getCell(`J${sRow + 4}`).value = '• TB/BB';
      sheet.mergeCells(`N${sRow + 4}:U${sRow + 4}`);
      sheet.getCell(`N${sRow + 4}`).value = `:  ${bbTbNormal} Normal | ${bbTbKurus} Kurus | ${bbTbGemuk} Gemuk`;

      sheet.mergeCells(`V${sRow + 4}:X${sRow + 4}`);
      sheet.getCell(`V${sRow + 4}`).value = '• Pemberian Obat Cacing';
      sheet.mergeCells(`Y${sRow + 4}:AC${sRow + 4}`);
      sheet.getCell(`Y${sRow + 4}`).value = `:  ${obatCacingCount} Balita`;

      // Row 4 Values
      sheet.mergeCells(`B${sRow + 5}:D${sRow + 5}`);
      sheet.getCell(`B${sRow + 5}`).value = '• 25 - 60 Bulan';
      sheet.mergeCells(`E${sRow + 5}:H${sRow + 5}`);
      sheet.getCell(`E${sRow + 5}`).value = `:  ${age25_60} Anak`;

      sheet.mergeCells(`J${sRow + 5}:M${sRow + 5}`);
      sheet.getCell(`J${sRow + 5}`).value = '• Rekap Stunting & Wasting';
      sheet.mergeCells(`N${sRow + 5}:U${sRow + 5}`);
      sheet.getCell(`N${sRow + 5}`).value = `:  ${tbUStunting} Stunting (TB/U) | ${bbTbWasting} Wasting (TB/BB)`;

      sheet.mergeCells(`V${sRow + 5}:X${sRow + 5}`);
      sheet.getCell(`V${sRow + 5}`).value = '• Imunisasi / Tambahan Lain';
      sheet.mergeCells(`Y${sRow + 5}:AC${sRow + 5}`);
      sheet.getCell(`Y${sRow + 5}`).value = `:  ${pemberianLainCount} Balita`;

      for (let r = sRow + 2; r <= sRow + 5; r++) {
        for (let c = 1; c <= 29; c++) {
          const cell = sheet.getCell(r, c);
          if (cell.value) {
            cell.font = { name: 'Arial', size: 8.5, color: { argb: 'FF0F172A' } };
          }
        }
      }

      // Border luar Summary Box
      const summaryBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
      applyBordersToRange(sheet, sRow, 1, sRow + 5, 29, summaryBorder);

      // ─────────────────────────────────────────────────────────────
      // SIGNATURE BLOCK (PERSIS FORMAT PDF)
      // ─────────────────────────────────────────────────────────────
      const sigRow = sRow + 7;
      sheet.mergeCells(`V${sigRow}:AC${sigRow}`);
      const sigDate = sheet.getCell(`V${sigRow}`);
      sigDate.value = `${posyandu.desa || 'Desa'}, ${todayFormatted}`;
      sigDate.font = { name: 'Arial', size: 9 };
      sigDate.alignment = { horizontal: 'center' };

      sheet.mergeCells(`V${sigRow + 1}:AC${sigRow + 1}`);
      const sigMengetahui = sheet.getCell(`V${sigRow + 1}`);
      sigMengetahui.value = 'Mengetahui,';
      sigMengetahui.font = { name: 'Arial', size: 9 };
      sigMengetahui.alignment = { horizontal: 'center' };

      sheet.mergeCells(`V${sigRow + 2}:AC${sigRow + 2}`);
      const sigKader = sheet.getCell(`V${sigRow + 2}`);
      sigKader.value = 'Ketua / Kader Posyandu';
      sigKader.font = { name: 'Arial', size: 9, bold: true };
      sigKader.alignment = { horizontal: 'center' };

      sheet.mergeCells(`V${sigRow + 7}:AC${sigRow + 7}`);
      const sigName = sheet.getCell(`V${sigRow + 7}`);
      sigName.value = '( ............................................ )';
      sigName.font = { name: 'Arial', size: 9, bold: true };
      sigName.alignment = { horizontal: 'center' };
    };

    // ─────────────────────────────────────────────────────────────
    // WORKSHEET LANSIA (PERSIS DENGAN FORMAT REGISTER PDF)
    // ─────────────────────────────────────────────────────────────
    const createLansiaWorksheet = (sheetName: string, items: ItemRiwayat[]) => {
      const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });
      sheet.views = [{ showGridLines: true }];

      // Kop Surat Resmi (Persis PDF)
      sheet.mergeCells('A1:Q1');
      sheet.getCell('A1').value = `REGISTER POSYANDU LANSIA ${rawPosName}`;
      sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF0F172A' } };
      sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 22;

      sheet.mergeCells('A2:Q2');
      sheet.getCell('A2').value = desaKecStr;
      sheet.getCell('A2').font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(2).height = 18;

      sheet.mergeCells('A3:Q3');
      sheet.getCell('A3').value = tahunStr;
      sheet.getCell('A3').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF334155' } };
      sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(3).height = 16;

      sheet.mergeCells('A4:Q4');
      sheet.getCell('A4').value = subTitleStr;
      sheet.getCell('A4').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
      sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(4).height = 16;

      sheet.getRow(5).height = 10;

      // Header Bertingkat (Baris 6 & 7) - Style Senada Balita (Teal Emerald)
      for (let r = 6; r <= 7; r++) {
        sheet.getRow(r).height = 20;
        for (let c = 1; c <= 17; c++) {
          styleHeaderCell(sheet.getCell(r, c), 'FF0F766E', 'FF0D9488', 8.5);
        }
      }

      // Baris 6 (Header Group Level 1)
      sheet.getCell('A6').value = 'NO';
      sheet.getCell('B6').value = 'IDENTITAS LANSIA';
      sheet.getCell('G6').value = 'RIWAYAT PENYAKIT';
      sheet.getCell('I6').value = 'PEMERIKSAAN FISIK & VITAL';
      sheet.getCell('L6').value = 'PEMERIKSAAN LAB & LINGKAR PERUT';
      sheet.getCell('P6').value = 'KELUHAN & TINDAKAN MEDIS';

      // Baris 7 (Header Sub-Kolom Level 2)
      sheet.getCell('B7').value = 'Nama Lansia';
      sheet.getCell('C7').value = 'Tgl Lahir';
      sheet.getCell('D7').value = 'NIK';
      sheet.getCell('E7').value = 'JK';
      sheet.getCell('F7').value = 'Usia';
      sheet.getCell('G7').value = 'Riw HT';
      sheet.getCell('H7').value = 'Riw DM';
      sheet.getCell('I7').value = 'BB (kg)';
      sheet.getCell('J7').value = 'TB (cm)';
      sheet.getCell('K7').value = 'TD (mmHg)';
      sheet.getCell('L7').value = 'GDS (mg/dL)';
      sheet.getCell('M7').value = 'Kolesterol';
      sheet.getCell('N7').value = 'Asam Urat';
      sheet.getCell('O7').value = 'L.Perut (cm)';
      sheet.getCell('P7').value = 'Keluhan';
      sheet.getCell('Q7').value = 'Tindakan Medis';

      // Merges
      sheet.mergeCells('A6:A7');
      sheet.mergeCells('B6:F6');
      sheet.mergeCells('G6:H6');
      sheet.mergeCells('I6:K6');
      sheet.mergeCells('L6:O6');
      sheet.mergeCells('P6:Q6');

      // Isi Data Lansia
      let currentRow = 8;
      if (items.length === 0) {
        sheet.mergeCells(`A${currentRow}:Q${currentRow}`);
        const emptyCell = sheet.getCell(`A${currentRow}`);
        emptyCell.value = 'Tidak ada data pemeriksaan lansia pada periode ini';
        emptyCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(currentRow).height = 24;
        applyBordersToRange(sheet, currentRow, 1, currentRow, 17, thinBorder);
        currentRow++;
      } else {
        items.forEach((item, idx) => {
          const usiaText = getUsiaText(item.tanggalLahir, item.tanggal, 'Lansia');
          const tdText = item.tekananDarahSistol ? `${item.tekananDarahSistol}/${item.tekananDarahDiastol}` : '-';

          const rowData = [
            idx + 1,
            item.nama || '-',
            item.tanggalLahir ? item.tanggalLahir.substring(0, 10) : '-',
            item.nik || '-',
            item.jenisKelamin || '-',
            usiaText,
            item.riwayatHt ? 'Ya' : 'Tdk',
            item.riwayatDm ? 'Ya' : 'Tdk',
            item.beratBadan !== undefined ? item.beratBadan : '-',
            item.tinggiBadan !== undefined ? item.tinggiBadan : '-',
            tdText,
            item.gulaDarahSewaktu !== undefined ? item.gulaDarahSewaktu : '-',
            item.kolesterol !== undefined ? item.kolesterol : '-',
            item.asamUrat !== undefined ? item.asamUrat : '-',
            item.lingkarPerut !== undefined ? item.lingkarPerut : '-',
            item.keluhan || '-',
            item.tindakan || '-'
          ];

          const row = sheet.getRow(currentRow);
          row.values = rowData;
          row.height = 22;

          const isEven = idx % 2 === 0;
          const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

          for (let c = 1; c <= 17; c++) {
            const cell = sheet.getCell(currentRow, c);
            cell.font = { name: 'Arial', size: 8.5, bold: c === 2 || c === 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
            cell.border = thinBorder;

            if (c === 2 || c === 16 || c === 17) {
              cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            } else {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          }

          currentRow++;
        });
      }

      // Lebar Kolom Lansia (17 Kolom)
      const lansiaColWidths = [
        6,   // 1: No
        24,  // 2: Nama Lansia
        13,  // 3: Tgl Lahir
        18,  // 4: NIK
        6,   // 5: JK
        10,  // 6: Usia
        10,  // 7: Riw HT
        10,  // 8: Riw DM
        9,   // 9: BB (kg)
        9,   // 10: TB (cm)
        14,  // 11: TD (mmHg)
        14,  // 12: GDS (mg/dL)
        12,  // 13: Kolesterol
        12,  // 14: Asam Urat
        12,  // 15: L.Perut (cm)
        24,  // 16: Keluhan
        26   // 17: Tindakan Medis
      ];

      lansiaColWidths.forEach((w, i) => {
        sheet.getColumn(i + 1).width = w;
      });

      // ─────────────────────────────────────────────────────────────
      // SUMMARY BOX LENGKAP LANSIA (PERSIS FORMAT PDF)
      // ─────────────────────────────────────────────────────────────
      const getAgeInfo = (item: ItemRiwayat) => {
        let m = item.usiaBulan;
        if (m === undefined && item.tanggalLahir) {
          const tL = new Date(item.tanggalLahir);
          const tP = new Date(item.tanggal);
          m = (tP.getFullYear() - tL.getFullYear()) * 12 + (tP.getMonth() - tL.getMonth());
          if (tP.getDate() < tL.getDate()) m--;
          if (m < 0) m = 0;
        }
        const months = m ?? 0;
        const years = Math.floor(months / 12);
        return { years };
      };

      const age45_59 = items.filter(i => getAgeInfo(i).years >= 45 && getAgeInfo(i).years <= 59).length;
      const age60_69 = items.filter(i => getAgeInfo(i).years >= 60 && getAgeInfo(i).years <= 69).length;
      const age70Plus = items.filter(i => getAgeInfo(i).years >= 70).length;

      const totalHt = items.filter(i => (i.tekananDarahSistol || 0) >= 140 || (i.tekananDarahDiastol || 0) >= 90).length;
      const totalTdNormal = items.filter(i => (i.tekananDarahSistol || 0) > 0 && (i.tekananDarahSistol || 0) < 140 && (i.tekananDarahDiastol || 0) < 90).length;

      const totalDm = items.filter(i => (i.gulaDarahSewaktu || 0) >= 200).length;
      const totalGdsNormal = items.filter(i => (i.gulaDarahSewaktu || 0) > 0 && (i.gulaDarahSewaktu || 0) < 200).length;

      const totalKolest = items.filter(i => (i.kolesterol || 0) >= 200).length;
      const totalKolestNormal = items.filter(i => (i.kolesterol || 0) > 0 && (i.kolesterol || 0) < 200).length;

      const totalAsamUrat = items.filter(i => (i.asamUrat || 0) >= 7).length;
      const totalAsamUratNormal = items.filter(i => (i.asamUrat || 0) > 0 && (i.asamUrat || 0) < 7).length;

      const lansiaPria = items.filter(i => i.jenisKelamin === 'L').length;
      const lansiaWanita = items.filter(i => i.jenisKelamin === 'P').length;

      const sRow = currentRow + 1;

      // Background Box Summary (Putih Bersih & Profesional)
      for (let r = sRow; r <= sRow + 5; r++) {
        sheet.getRow(r).height = 18;
        for (let c = 1; c <= 17; c++) {
          const cell = sheet.getCell(r, c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      }

      // Title Summary
      sheet.mergeCells(`A${sRow}:Q${sRow}`);
      const sumTitleCell = sheet.getCell(`A${sRow}`);
      sumTitleCell.value = 'REKAPITULASI PELAYANAN KESEHATAN LANSIA';
      sumTitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      sumTitleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      sheet.getRow(sRow).height = 22;

      // Group Subtitles
      sheet.mergeCells(`B${sRow + 1}:G${sRow + 1}`);
      const g1 = sheet.getCell(`B${sRow + 1}`);
      g1.value = 'Distribusi Sasaran Usia Lansia:';
      g1.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };

      sheet.mergeCells(`I${sRow + 1}:Q${sRow + 1}`);
      const g2 = sheet.getCell(`I${sRow + 1}`);
      g2.value = 'Hasil Skrining Fisik & Laboratorium:';
      g2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF334155' } };

      // Row 1 Values
      sheet.mergeCells(`B${sRow + 2}:D${sRow + 2}`);
      sheet.getCell(`B${sRow + 2}`).value = '• Pra-Lansia (45 - 59 Tahun)';
      sheet.mergeCells(`E${sRow + 2}:G${sRow + 2}`);
      sheet.getCell(`E${sRow + 2}`).value = `:  ${age45_59} Orang`;

      sheet.mergeCells(`I${sRow + 2}:L${sRow + 2}`);
      sheet.getCell(`I${sRow + 2}`).value = '• Tekanan Darah (TD)';
      sheet.mergeCells(`M${sRow + 2}:Q${sRow + 2}`);
      sheet.getCell(`M${sRow + 2}`).value = `:  ${totalTdNormal} Normal | ${totalHt} Hipertensi (>= 140/90)`;

      // Row 2 Values
      sheet.mergeCells(`B${sRow + 3}:D${sRow + 3}`);
      sheet.getCell(`B${sRow + 3}`).value = '• Lansia (60 - 69 Tahun)';
      sheet.mergeCells(`E${sRow + 3}:G${sRow + 3}`);
      sheet.getCell(`E${sRow + 3}`).value = `:  ${age60_69} Orang`;

      sheet.mergeCells(`I${sRow + 3}:L${sRow + 3}`);
      sheet.getCell(`I${sRow + 3}`).value = '• Gula Darah Sewaktu (GDS)';
      sheet.mergeCells(`M${sRow + 3}:Q${sRow + 3}`);
      sheet.getCell(`M${sRow + 3}`).value = `:  ${totalGdsNormal} Normal | ${totalDm} Tinggi (>= 200 mg/dL)`;

      // Row 3 Values
      sheet.mergeCells(`B${sRow + 4}:D${sRow + 4}`);
      sheet.getCell(`B${sRow + 4}`).value = '• Lansia Risti (>= 70 Tahun)';
      sheet.mergeCells(`E${sRow + 4}:G${sRow + 4}`);
      sheet.getCell(`E${sRow + 4}`).value = `:  ${age70Plus} Orang`;

      sheet.mergeCells(`I${sRow + 4}:L${sRow + 4}`);
      sheet.getCell(`I${sRow + 4}`).value = '• Kolesterol Total';
      sheet.mergeCells(`M${sRow + 4}:Q${sRow + 4}`);
      sheet.getCell(`M${sRow + 4}`).value = `:  ${totalKolestNormal} Normal (< 200) | ${totalKolest} Tinggi (>= 200 mg/dL)`;

      // Row 4 Values
      sheet.mergeCells(`B${sRow + 5}:D${sRow + 5}`);
      sheet.getCell(`B${sRow + 5}`).value = '• Total Kunjungan Lansia';
      sheet.mergeCells(`E${sRow + 5}:G${sRow + 5}`);
      sheet.getCell(`E${sRow + 5}`).value = `:  ${items.length} Orang (L: ${lansiaPria} / P: ${lansiaWanita})`;

      sheet.mergeCells(`I${sRow + 5}:L${sRow + 5}`);
      sheet.getCell(`I${sRow + 5}`).value = '• Asam Urat';
      sheet.mergeCells(`M${sRow + 5}:Q${sRow + 5}`);
      sheet.getCell(`M${sRow + 5}`).value = `:  ${totalAsamUratNormal} Normal (< 7) | ${totalAsamUrat} Tinggi (>= 7 mg/dL)`;

      for (let r = sRow + 2; r <= sRow + 5; r++) {
        for (let c = 1; c <= 17; c++) {
          const cell = sheet.getCell(r, c);
          if (cell.value) {
            cell.font = { name: 'Arial', size: 8.5, color: { argb: 'FF0F172A' } };
          }
        }
      }

      // Border luar Summary Box
      const summaryBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
      applyBordersToRange(sheet, sRow, 1, sRow + 5, 17, summaryBorder);

      // ─────────────────────────────────────────────────────────────
      // SIGNATURE BLOCK (PERSIS FORMAT PDF)
      // ─────────────────────────────────────────────────────────────
      const sigRow = sRow + 7;
      sheet.mergeCells(`M${sigRow}:Q${sigRow}`);
      const sigDate = sheet.getCell(`M${sigRow}`);
      sigDate.value = `${posyandu.desa || 'Desa'}, ${todayFormatted}`;
      sigDate.font = { name: 'Arial', size: 9 };
      sigDate.alignment = { horizontal: 'center' };

      sheet.mergeCells(`M${sigRow + 1}:Q${sigRow + 1}`);
      const sigMengetahui = sheet.getCell(`M${sigRow + 1}`);
      sigMengetahui.value = 'Mengetahui,';
      sigMengetahui.font = { name: 'Arial', size: 9 };
      sigMengetahui.alignment = { horizontal: 'center' };

      sheet.mergeCells(`M${sigRow + 2}:Q${sigRow + 2}`);
      const sigKader = sheet.getCell(`M${sigRow + 2}`);
      sigKader.value = 'Ketua / Kader Posyandu';
      sigKader.font = { name: 'Arial', size: 9, bold: true };
      sigKader.alignment = { horizontal: 'center' };

      sheet.mergeCells(`M${sigRow + 7}:Q${sigRow + 7}`);
      const sigName = sheet.getCell(`M${sigRow + 7}`);
      sigName.value = '( ............................................ )';
      sigName.font = { name: 'Arial', size: 9, bold: true };
      sigName.alignment = { horizontal: 'center' };
    };

    if (filter.tipe === 'Balita') {
      createBalitaWorksheet('Data Balita', data.filter(d => d.tipe === 'Balita'));
    } else if (filter.tipe === 'Lansia') {
      createLansiaWorksheet('Data Lansia', data.filter(d => d.tipe === 'Lansia'));
    } else {
      const balitaData = data.filter((d) => d.tipe === 'Balita');
      const lansiaData = data.filter((d) => d.tipe === 'Lansia');
      if (balitaData.length > 0 || lansiaData.length === 0) {
        createBalitaWorksheet('Data Balita', balitaData);
      }
      if (lansiaData.length > 0) {
        createLansiaWorksheet('Data Lansia', lansiaData);
      }
    }

    return workbook;
  },

  async generatePdfExport(posyanduId: string, filter: FilterRiwayat): Promise<any> {
    const posyandu = await prisma.posyandu.findUnique({ where: { id: posyanduId } });
    if (!posyandu) {
      throw new Error('Posyandu tidak ditemukan');
    }

    // Ambil data yang sudah terfilter secara tepat
    const data = await this.getRiwayat(posyanduId, filter);

    // Document setup: LANDSCAPE A4 (Width: 841.89, Height: 595.28)
    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
      margin: 30,
      bufferPages: true
    });

    const startX = 30;
    const pageWidth = doc.page.width;
    const printableWidth = pageWidth - startX * 2; // ~781.89 pt
    const endX = startX + printableWidth;

    const isBalitaOnly = filter.tipe === 'Balita';
    const isLansiaOnly = filter.tipe === 'Lansia';

    const rawDesa = (posyandu.desa || 'WATULAWANG').trim();
    const cleanDesa = rawDesa.replace(/^DESA\s+/i, '').trim();
    const desaStr = `DESA ${cleanDesa.toUpperCase()}`;

    const rawKec = (posyandu.kecamatan || 'PEJAGOAN').trim();
    const cleanKec = rawKec.replace(/^(PUSKESMAS|KECAMATAN)\s+/i, '').trim();
    const kecStr = `PUSKESMAS KECAMATAN ${cleanKec.toUpperCase()}`;

    const tahunVal = filter.tahun || new Date().getFullYear();

    const tipeJudul = isLansiaOnly
      ? 'REGISTER & REKAPITULASI CATATAN KUNJUNGAN LANSIA'
      : isBalitaOnly
      ? 'REGISTER & REKAPITULASI CATATAN KUNJUNGAN BALITA'
      : 'REGISTER & REKAPITULASI KUNJUNGAN POSYANDU (BALITA & LANSIA)';

    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // HEADER KOP SURAT RESMI POSYANDU (Sesuai Standar Register)
    // ─────────────────────────────────────────────────────────────
    const rawPosName = posyandu.nama.toUpperCase().replace(/^POSYANDUs+/i, '').trim();
    const judulRegister = isLansiaOnly
      ? `REGISTER POSYANDU LANSIA ${rawPosName}`
      : isBalitaOnly
      ? `REGISTER POSYANDU BALITA ${rawPosName}`
      : `REGISTER POSYANDU ${rawPosName}`;

    const desaKecStr = `DESA ${cleanDesa.toUpperCase()} KECAMATAN ${cleanKec.toUpperCase()}`;
    const tahunStr = `TAHUN ${tahunVal}`;

    doc.fontSize(13.5).font('Helvetica-Bold').fillColor('#0f172a').text(judulRegister, { align: 'center' });
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(desaKecStr, { align: 'center' });
    doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#334155').text(tahunStr, { align: 'center' });
    doc.moveDown(0.3);

    // Kop Separator Line (Garis Ganda Penutup Kop Surat)
    const lineY = doc.y;
    doc.lineWidth(1.5).moveTo(startX, lineY).lineTo(endX, lineY).strokeColor('#0f766e').stroke();
    doc.lineWidth(0.5).moveTo(startX, lineY + 2.5).lineTo(endX, lineY + 2.5).strokeColor('#0f766e').stroke();

    doc.y = lineY + 7;

    const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const filterInfoArr = [];
    if (filter.bulan) filterInfoArr.push(`Bulan: ${NAMA_BULAN[filter.bulan - 1]}`);
    if (filter.tahun) filterInfoArr.push(`Tahun: ${filter.tahun}`);
    if (filter.status && filter.status !== 'semua') filterInfoArr.push(`Status: ${filter.status === 'warning' ? 'Perlu Perhatian' : 'Normal'}`);
    if (filter.search) filterInfoArr.push(`Pencarian: "${filter.search}"`);

    const subTitleStr = filterInfoArr.length > 0
      ? `Filter Aktif: ${filterInfoArr.join(' | ')}   •   Tanggal Cetak: ${todayFormatted}`
      : `Tanggal Cetak Laporan: ${todayFormatted}`;

    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text(subTitleStr, startX, doc.y, { align: 'left' });
    doc.moveDown(0.4);

    // Data lists
    const balitaList = data.filter((d) => d.tipe === 'Balita');
    const lansiaList = data.filter((d) => d.tipe === 'Lansia');
    const renderBalitaTable = (items: ItemRiwayat[]) => {
      const balitaTableWidth = printableWidth;

      // Definition of column X coordinates and widths (Total = 781.89 pt)
      const cNo = startX;              // 30  (w: 16)
      const cNama = startX + 16;       // 46  (w: 88)
      const cTglLahir = startX + 104;  // 134 (w: 60)
      const cNik = startX + 164;       // 194 (w: 80)
      const cIbu = startX + 244;       // 274 (w: 65)
      const cJK = startX + 309;        // 339 (w: 18)
      const cUsia = startX + 327;      // 357 (w: 35)

      const cBB = startX + 362;        // 392 (w: 26)
      const cTB = startX + 388;        // 418 (w: 26)

      // STATUS GIZI 12 Sub-columns (BB/U: SK, K, N, L | TB/U: SP, P, N, T | BB/TB: SK, K, N, G) (Total 144 pt)
      const cBbU_SK = startX + 414;    // 444 (w: 12)
      const cBbU_K = startX + 426;     // 456 (w: 12)
      const cBbU_N = startX + 438;     // 468 (w: 12)
      const cBbU_L = startX + 450;     // 480 (w: 12)

      const cTbU_SP = startX + 462;    // 492 (w: 12)
      const cTbU_P = startX + 474;     // 504 (w: 12)
      const cTbU_N = startX + 486;     // 516 (w: 12)
      const cTbU_T = startX + 498;     // 528 (w: 12)

      const cBbTb_SK = startX + 510;   // 540 (w: 12)
      const cBbTb_K = startX + 522;    // 552 (w: 12)
      const cBbTb_N = startX + 534;    // 564 (w: 12)
      const cBbTb_G = startX + 546;    // 576 (w: 12)

      // PELAYANAN YANG DIBERIKAN (Total 175 pt)
      const cB1 = startX + 558;        // 588 (w: 16)
      const cB6 = startX + 574;        // 604 (w: 16)
      const cAsi = startX + 590;       // 620 (w: 24)
      const cVitA = startX + 614;      // 644 (w: 24)
      const cCacing = startX + 638;    // 668 (w: 30)
      const cPemberianLain = startX + 668; // 698 (w: 65)

      // FISIK (Total 48.89 pt)
      const cLK = startX + 733;        // 763 (w: 24)
      const cLiLA = startX + 757;      // 787 (w: 24.89)

      const balitaCols = [
        cNama, cTglLahir, cNik, cIbu, cJK, cUsia,
        cBB, cTB,
        cBbU_SK, cBbU_K, cBbU_N, cBbU_L,
        cTbU_SP, cTbU_P, cTbU_N, cTbU_T,
        cBbTb_SK, cBbTb_K, cBbTb_N, cBbTb_G,
        cB1, cB6, cAsi, cVitA, cCacing, cPemberianLain,
        cLK, cLiLA
      ];

      const drawTableHeader = (y: number) => {
        const headerHeight = 30;
        doc.rect(startX, y, printableWidth, headerHeight).fillAndStroke('#0f766e', '#0d9488');
        doc.fillColor('#ffffff').fontSize(6).font('Helvetica-Bold');

        // Vertical divider lines for main sections (full height 30pt)
        const fullHeightCols = [
          cNama, cBB, cBbU_SK, cB1, cLK
        ];
        fullHeightCols.forEach(x => {
          doc.moveTo(x, y).lineTo(x, y + headerHeight).strokeColor('#0d9488').lineWidth(0.5).stroke();
        });

        // Vertical divider lines for Row 2 sub-headers (from y+10 to y+30)
        [
          cTglLahir, cNik, cIbu, cJK, cUsia,
          cTB,
          cTbU_SP, cBbTb_SK,
          cB6, cAsi, cVitA, cCacing, cPemberianLain,
          cLiLA
        ].forEach(x => {
          doc.moveTo(x, y + 10).lineTo(x, y + headerHeight).strokeColor('#0d9488').lineWidth(0.5).stroke();
        });

        // Vertical divider lines for Row 3 sub-columns (from y+20 to y+30)
        [
          cBbU_K, cBbU_N, cBbU_L,
          cTbU_P, cTbU_N, cTbU_T,
          cBbTb_K, cBbTb_N, cBbTb_G
        ].forEach(x => {
          doc.moveTo(x, y + 20).lineTo(x, y + headerHeight).strokeColor('#0d9488').lineWidth(0.5).stroke();
        });

        // Horizontal line separating Row 1 group header and Row 2
        doc.moveTo(cNama, y + 10).lineTo(endX, y + 10).strokeColor('#0d9488').lineWidth(0.5).stroke();

        // Horizontal line separating Row 2 and Row 3 (Status Gizi)
        doc.moveTo(cBbU_SK, y + 20).lineTo(cB1, y + 20).strokeColor('#0d9488').lineWidth(0.5).stroke();

        // Row 1 Grouping Titles
        doc.text('NO', cNo, y + 11, { width: 16, align: 'center' });
        doc.text('INFORMASI BALITA', cNama, y + 2, { width: 346, align: 'center' });
        doc.text('PENGUKURAN', cBB, y + 2, { width: 52, align: 'center' });
        doc.text('STATUS GIZI', cBbU_SK, y + 2, { width: 144, align: 'center' });
        doc.text('PELAYANAN YANG DIBERIKAN', cB1, y + 2, { width: 175, align: 'center' });
        doc.text('FISIK', cLK, y + 2, { width: 48.89, align: 'center' });

        // Row 2 Sub-headers
        doc.fontSize(5.5);
        doc.text('Nama Balita', cNama + 2, y + 16, { width: 84 });
        doc.text('Tgl Lahir', cTglLahir, y + 16, { width: 60, align: 'center' });
        doc.text('NIK', cNik, y + 16, { width: 80, align: 'center' });
        doc.text('Nama Ibu', cIbu + 2, y + 16, { width: 61 });
        doc.text('JK', cJK, y + 16, { width: 18, align: 'center' });
        doc.text('Usia', cUsia, y + 16, { width: 35, align: 'center' });

        // Pengukuran Row 2 Sub-headers
        doc.text('BB(kg)', cBB, y + 16, { width: 26, align: 'center' });
        doc.text('TB(cm)', cTB, y + 16, { width: 26, align: 'center' });

        // Status Gizi Row 2 Sub-headers
        doc.text('BB/U', cBbU_SK, y + 12, { width: 48, align: 'center' });
        doc.text('TB/U', cTbU_SP, y + 12, { width: 48, align: 'center' });
        doc.text('BB/TB', cBbTb_SK, y + 12, { width: 48, align: 'center' });

        // Status Gizi Row 3 Sub-headers
        doc.fontSize(4.8);
        doc.text('SK', cBbU_SK, y + 22, { width: 12, align: 'center' });
        doc.text('K', cBbU_K, y + 22, { width: 12, align: 'center' });
        doc.text('N', cBbU_N, y + 22, { width: 12, align: 'center' });
        doc.text('L', cBbU_L, y + 22, { width: 12, align: 'center' });

        doc.text('SP', cTbU_SP, y + 22, { width: 12, align: 'center' });
        doc.text('P', cTbU_P, y + 22, { width: 12, align: 'center' });
        doc.text('N', cTbU_N, y + 22, { width: 12, align: 'center' });
        doc.text('T', cTbU_T, y + 22, { width: 12, align: 'center' });

        doc.text('SK', cBbTb_SK, y + 22, { width: 12, align: 'center' });
        doc.text('K', cBbTb_K, y + 22, { width: 12, align: 'center' });
        doc.text('N', cBbTb_N, y + 22, { width: 12, align: 'center' });
        doc.text('G', cBbTb_G, y + 22, { width: 12, align: 'center' });
        doc.fontSize(5.5);

        // Pelayanan Row 2 Sub-headers
        doc.text('B1', cB1, y + 16, { width: 16, align: 'center' });
        doc.text('B6', cB6, y + 16, { width: 16, align: 'center' });
        doc.text('ASI', cAsi, y + 16, { width: 24, align: 'center' });
        doc.text('Vit A', cVitA, y + 16, { width: 24, align: 'center' });
        doc.text('Cacing', cCacing, y + 16, { width: 30, align: 'center' });
        doc.text('Pemberian Lain', cPemberianLain, y + 16, { width: 65, align: 'center' });

        // Fisik Row 2 Sub-headers
        doc.text('LK(cm)', cLK, y + 16, { width: 24, align: 'center' });
        doc.text('LiLA', cLiLA, y + 16, { width: 24.89, align: 'center' });

        doc.fillColor('#000000');
      };

      let yPos = doc.y;
      drawTableHeader(yPos);
      yPos += 30;

      const rowHeight = 18;

      items.forEach((item, idx) => {
        if (yPos > doc.page.height - 120) {
          doc.addPage();
          yPos = 30;
          drawTableHeader(yPos);
          yPos += 30;
        }

        const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(startX, yPos, printableWidth, rowHeight).fillAndStroke(bg, '#cbd5e1');

        balitaCols.forEach(x => {
          doc.moveTo(x, yPos).lineTo(x, yPos + rowHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        });

        doc.font('Helvetica').fontSize(5.5);

        // Usia kalkulasi & Jenis Kelamin
        let ageMonths = item.usiaBulan;
        if (ageMonths === undefined && item.tanggalLahir) {
          const tL = new Date(item.tanggalLahir);
          const tP = new Date(item.tanggal);
          ageMonths = (tP.getFullYear() - tL.getFullYear()) * 12 + (tP.getMonth() - tL.getMonth());
          if (tP.getDate() < tL.getDate()) ageMonths--;
          if (ageMonths < 0) ageMonths = 0;
        }

        doc.fillColor('#0f172a');

        doc.text(String(idx + 1), cNo, yPos + 5, { width: 16, align: 'center' });
        doc.font('Helvetica-Bold').text((item.nama || '-').substring(0, 20), cNama + 2, yPos + 5, { width: 84 });
        
        // Tgl Lahir & NIK dipisahkan
        doc.font('Helvetica').fontSize(5.5);
        const tglStr = item.tanggalLahir ? item.tanggalLahir.substring(0, 10) : '-';
        const nikStr = item.nik ? item.nik : '-';
        doc.text(tglStr, cTglLahir, yPos + 5, { width: 60, align: 'center' });
        doc.text(nikStr, cNik, yPos + 5, { width: 80, align: 'center' });

        doc.text((item.namaIbu || '-').substring(0, 16), cIbu + 2, yPos + 5, { width: 61 });
        doc.text(item.jenisKelamin || '-', cJK, yPos + 5, { width: 18, align: 'center' });

        // Usia Balita (Bln)
        const usiaStr = ageMonths !== undefined ? `${ageMonths} bln` : '-';
        doc.font('Helvetica-Bold').text(usiaStr, cUsia, yPos + 5, { width: 35, align: 'center' });
        doc.font('Helvetica');

        // Pengukuran (BB, TB)
        doc.text(item.beratBadan !== undefined ? String(item.beratBadan) : '-', cBB, yPos + 5, { width: 26, align: 'center' });
        doc.text(item.tinggiBadan !== undefined ? String(item.tinggiBadan) : '-', cTB, yPos + 5, { width: 26, align: 'center' });

        // Helper for rendering crisp vector checkmark ✓ or dash -
        const renderCheck = (isChecked: boolean, x: number, width: number) => {
          if (isChecked) {
            const cx = x + width / 2;
            const cy = yPos + 7.5;
            doc.save();
            doc.lineWidth(1.2)
               .strokeColor('#0f766e')
               .moveTo(cx - 3, cy - 0.5)
               .lineTo(cx - 1, cy + 2.5)
               .lineTo(cx + 3.5, cy - 3)
               .stroke();
            doc.restore();
          } else {
            doc.font('Helvetica').fontSize(6).fillColor('#64748b').text('-', x, yPos + 5, { width, align: 'center' });
            doc.fillColor('#0f172a');
          }
        };

        // Status Gizi (BB/U: SK, K, N, L | TB/U: SP, P, N, T | BB/TB: SK, K, N, G)
        renderCheck(item.statusBbU === 'SK', cBbU_SK, 12);
        renderCheck(item.statusBbU === 'K', cBbU_K, 12);
        renderCheck(item.statusBbU === 'N', cBbU_N, 12);
        renderCheck(item.statusBbU === 'L', cBbU_L, 12);

        renderCheck(item.statusTbU === 'SP', cTbU_SP, 12);
        renderCheck(item.statusTbU === 'P', cTbU_P, 12);
        renderCheck(item.statusTbU === 'N', cTbU_N, 12);
        renderCheck(item.statusTbU === 'T', cTbU_T, 12);

        renderCheck(item.statusBbTb === 'SK', cBbTb_SK, 12);
        renderCheck(item.statusBbTb === 'K', cBbTb_K, 12);
        renderCheck(item.statusBbTb === 'N', cBbTb_N, 12);
        renderCheck(item.statusBbTb === 'G', cBbTb_G, 12);

        // Pelayanan & Suplimen (B1, B6, ASI, VIT A, Obat Cacing, Pemberian Lain)
        renderCheck(!!item.vitB1, cB1, 16);
        renderCheck(!!item.vitB6, cB6, 16);
        renderCheck(!!item.asiEksklusif, cAsi, 24);
        renderCheck(!!item.vitaminA, cVitA, 24);
        renderCheck(!!item.obatCacing, cCacing, 30);

        // Opsi Pemberian Lain
        const cleanPemberian = extractPemberianLain(item.statusImunisasi);
        doc.font('Helvetica').fontSize(5).fillColor('#0f172a');
        doc.text(cleanPemberian === '-' ? '-' : cleanPemberian.substring(0, 24), cPemberianLain + 1, yPos + 5, { width: 63, align: 'center' });
        doc.fontSize(5.5);

        // Fisik (LK, LiLA)
        doc.text(item.lingkarKepala !== undefined ? String(item.lingkarKepala) : '-', cLK, yPos + 5, { width: 24, align: 'center' });
        doc.text(item.lingkarLengan !== undefined ? String(item.lingkarLengan) : '-', cLiLA, yPos + 5, { width: 24.89, align: 'center' });

        doc.fillColor('#000000');
        yPos += rowHeight;
      });

      doc.y = yPos;
    };

    const renderLansiaTable = (items: ItemRiwayat[]) => {
      // Definition of column X coordinates and widths (Total = 781.89 pt)
      const cNo = startX;              // 30  (w: 16)
      const cNama = startX + 16;       // 46  (w: 84)
      const cTglLahir = startX + 100;  // 130 (w: 54)
      const cNik = startX + 154;       // 184 (w: 76)
      const cJK = startX + 230;        // 260 (w: 16)
      const cUsia = startX + 246;      // 276 (w: 28)

      const cRiwHt = startX + 274;     // 304 (w: 24)
      const cRiwDm = startX + 298;     // 328 (w: 24)

      const cBB = startX + 322;        // 352 (w: 26)
      const cTB = startX + 348;        // 378 (w: 26)
      const cTD = startX + 374;        // 404 (w: 46)

      const cGds = startX + 420;       // 450 (w: 38)
      const cKolest = startX + 458;    // 488 (w: 40)
      const cAsamUrat = startX + 498;  // 528 (w: 40)
      const cLPerut = startX + 538;    // 568 (w: 36)

      const cKeluhan = startX + 574;   // 604 (w: 88)
      const cTindakan = startX + 662;  // 692 (w: 119.89)

      const lansiaCols = [
        cNama, cTglLahir, cNik, cJK, cUsia,
        cRiwHt, cRiwDm,
        cBB, cTB, cTD,
        cGds, cKolest, cAsamUrat, cLPerut,
        cKeluhan, cTindakan
      ];

      const drawTableHeader = (y: number) => {
        // Multi-level Header: Height = 30pt (Row 1: 12pt, Row 2: 18pt) - Style Senada Balita (Teal Emerald)
        const headerHeight = 30;
        doc.rect(startX, y, printableWidth, headerHeight).fillAndStroke('#0f766e', '#0d9488');
        doc.fillColor('#ffffff').fontSize(6).font('Helvetica-Bold');

        // Vertical divider lines for main sections (full height 30pt)
        const fullHeightCols = [cNama, cRiwHt, cBB, cGds, cKeluhan];
        fullHeightCols.forEach(x => {
          doc.moveTo(x, y).lineTo(x, y + headerHeight).strokeColor('#0d9488').lineWidth(0.5).stroke();
        });

        // Vertical divider lines for Row 2 sub-headers (from y+12 to y+30)
        [
          cTglLahir, cNik, cJK, cUsia,
          cRiwDm,
          cTB, cTD,
          cKolest, cAsamUrat, cLPerut,
          cTindakan
        ].forEach(x => {
          doc.moveTo(x, y + 12).lineTo(x, y + headerHeight).strokeColor('#0d9488').lineWidth(0.5).stroke();
        });

        // Horizontal line separating Row 1 group header and Row 2
        doc.moveTo(cNama, y + 12).lineTo(endX, y + 12).strokeColor('#0d9488').lineWidth(0.5).stroke();

        // Row 1 Grouping Titles
        doc.text('NO', cNo, y + 11, { width: 16, align: 'center' });
        doc.text('IDENTITAS LANSIA', cNama, y + 3, { width: 258, align: 'center' });
        doc.text('RIWAYAT PENYAKIT', cRiwHt, y + 3, { width: 48, align: 'center' });
        doc.text('PEMERIKSAAN FISIK & VITAL', cBB, y + 3, { width: 98, align: 'center' });
        doc.text('PEMERIKSAAN LAB & LINGKAR PERUT', cGds, y + 3, { width: 154, align: 'center' });
        doc.text('KELUHAN & TINDAKAN MEDIS', cKeluhan, y + 3, { width: 207.89, align: 'center' });

        // Row 2 Sub-headers
        doc.fontSize(5.5);
        doc.text('Nama Lansia', cNama + 2, y + 16, { width: 80, align: 'left' });
        doc.text('Tgl Lahir', cTglLahir, y + 16, { width: 54, align: 'center' });
        doc.text('NIK', cNik, y + 16, { width: 76, align: 'center' });
        doc.text('JK', cJK, y + 16, { width: 16, align: 'center' });
        doc.text('Usia', cUsia, y + 16, { width: 28, align: 'center' });

        doc.text('Riw HT', cRiwHt, y + 16, { width: 24, align: 'center' });
        doc.text('Riw DM', cRiwDm, y + 16, { width: 24, align: 'center' });

        doc.text('BB(kg)', cBB, y + 16, { width: 26, align: 'center' });
        doc.text('TB(cm)', cTB, y + 16, { width: 26, align: 'center' });
        doc.text('TD(mmHg)', cTD, y + 16, { width: 46, align: 'center' });

        doc.text('GDS', cGds, y + 16, { width: 38, align: 'center' });
        doc.text('Kolest', cKolest, y + 16, { width: 40, align: 'center' });
        doc.text('As.Urat', cAsamUrat, y + 16, { width: 40, align: 'center' });
        doc.text('L.Perut', cLPerut, y + 16, { width: 36, align: 'center' });

        doc.text('Keluhan', cKeluhan + 2, y + 16, { width: 84, align: 'left' });
        doc.text('Tindakan Medis', cTindakan + 2, y + 16, { width: 115, align: 'left' });

        doc.fillColor('#000000');
      };

      let yPos = doc.y;
      drawTableHeader(yPos);
      yPos += 30;

      const rowHeight = 20;

      if (items.length === 0) {
        doc.rect(startX, yPos, printableWidth, 24).fillAndStroke('#ffffff', '#cbd5e1');
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748b').text('Tidak ada data pemeriksaan lansia pada periode ini', startX, yPos + 8, { width: printableWidth, align: 'center' });
        doc.fillColor('#000000');
        yPos += 24;
      } else {
        items.forEach((item, idx) => {
          if (yPos > doc.page.height - 120) {
            doc.addPage();
            yPos = 30;
            drawTableHeader(yPos);
            yPos += 30;
          }

          const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
          doc.rect(startX, yPos, printableWidth, rowHeight).fillAndStroke(bg, '#cbd5e1');

          lansiaCols.forEach(x => {
            doc.moveTo(x, yPos).lineTo(x, yPos + rowHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
          });

          doc.font('Helvetica').fontSize(5.5);

          const usiaText = getUsiaText(item.tanggalLahir, item.tanggal, 'Lansia');
          const tdText = item.tekananDarahSistol ? `${item.tekananDarahSistol}/${item.tekananDarahDiastol}` : '-';

          doc.fillColor('#0f172a');

          doc.text(String(idx + 1), cNo, yPos + 6, { width: 16, align: 'center' });
          doc.font('Helvetica-Bold').text((item.nama || '-').substring(0, 22), cNama + 2, yPos + 6, { width: 80, lineBreak: false });

          // Tgl Lahir & NIK dipisahkan
          doc.font('Helvetica').fontSize(5.5);
          const tglStr = item.tanggalLahir ? item.tanggalLahir.substring(0, 10) : '-';
          const nikStr = item.nik || '-';
          doc.text(tglStr, cTglLahir, yPos + 6, { width: 54, align: 'center' });
          doc.text(nikStr, cNik, yPos + 6, { width: 76, align: 'center' });

          doc.text(item.jenisKelamin || '-', cJK, yPos + 6, { width: 16, align: 'center' });
          doc.font('Helvetica-Bold').text(usiaText, cUsia, yPos + 6, { width: 28, align: 'center' });
          doc.font('Helvetica');

          // Riwayat HT & DM
          doc.text(item.riwayatHt ? 'Ya' : 'Tdk', cRiwHt, yPos + 6, { width: 24, align: 'center' });
          doc.text(item.riwayatDm ? 'Ya' : 'Tdk', cRiwDm, yPos + 6, { width: 24, align: 'center' });

          // Pengukuran Fisik (BB, TB, TD)
          doc.text(item.beratBadan !== undefined ? String(item.beratBadan) : '-', cBB, yPos + 6, { width: 26, align: 'center' });
          doc.text(item.tinggiBadan !== undefined ? String(item.tinggiBadan) : '-', cTB, yPos + 6, { width: 26, align: 'center' });
          doc.font('Helvetica-Bold').text(tdText, cTD, yPos + 6, { width: 46, align: 'center' });
          doc.font('Helvetica');

          // Laboratorium & Lingkar Perut
          const gdsStr = item.gulaDarahSewaktu !== undefined ? String(item.gulaDarahSewaktu) : '-';
          const kolestStr = item.kolesterol !== undefined ? String(item.kolesterol) : '-';
          const asamUratStr = item.asamUrat !== undefined ? String(item.asamUrat) : '-';
          const lpStr = item.lingkarPerut !== undefined ? String(item.lingkarPerut) : '-';

          doc.text(gdsStr, cGds, yPos + 6, { width: 38, align: 'center' });
          doc.text(kolestStr, cKolest, yPos + 6, { width: 40, align: 'center' });
          doc.text(asamUratStr, cAsamUrat, yPos + 6, { width: 40, align: 'center' });
          doc.text(lpStr, cLPerut, yPos + 6, { width: 36, align: 'center' });

          // Keluhan & Tindakan Medis - Terpisah, Efisien, & Bounded tanpa overflow
          const keluhan = item.keluhan?.trim() || '-';
          const tindakan = item.tindakan?.trim() || '-';

          if (keluhan === '-') {
            doc.text('-', cKeluhan, yPos + 6, { width: 88, align: 'center' });
          } else {
            doc.fontSize(5.5).text(keluhan, cKeluhan + 2, yPos + 3.5, { width: 84, height: 14, ellipsis: true });
          }

          if (tindakan === '-') {
            doc.text('-', cTindakan, yPos + 6, { width: 119.89, align: 'center' });
          } else {
            doc.fontSize(5.5).text(tindakan, cTindakan + 2, yPos + 3.5, { width: 115, height: 14, ellipsis: true });
          }

          doc.fillColor('#000000');
          yPos += rowHeight;
        });
      }

      doc.y = yPos;
    };

    // ─────────────────────────────────────────────────────────────
    // SUMMARY BOX LENGKAP KELOMPOK UMUR & REKAPITULASI PEMERIKSAAN
    // ─────────────────────────────────────────────────────────────
    const renderSummaryBox = (allItems: ItemRiwayat[]) => {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }

      const yPos = doc.y + 10;

      const getAgeInfo = (item: ItemRiwayat) => {
        let m = item.usiaBulan;
        if (m === undefined && item.tanggalLahir) {
          const tL = new Date(item.tanggalLahir);
          const tP = new Date(item.tanggal);
          m = (tP.getFullYear() - tL.getFullYear()) * 12 + (tP.getMonth() - tL.getMonth());
          if (tP.getDate() < tL.getDate()) m--;
          if (m < 0) m = 0;
        }
        const months = m ?? 0;
        const years = Math.floor(months / 12);
        return { months, years };
      };

      const balitaItems = allItems.filter(i => i.tipe === 'Balita');
      const lansiaItems = allItems.filter(i => i.tipe === 'Lansia');

      const age0_6 = balitaItems.filter(i => getAgeInfo(i).months >= 0 && getAgeInfo(i).months <= 6).length;
      const age7_12 = balitaItems.filter(i => getAgeInfo(i).months >= 7 && getAgeInfo(i).months <= 12).length;
      const age13_24 = balitaItems.filter(i => getAgeInfo(i).months >= 13 && getAgeInfo(i).months <= 24).length;
      const age25_60 = balitaItems.filter(i => getAgeInfo(i).months >= 25 && getAgeInfo(i).months <= 60).length;

      const age45_59 = lansiaItems.filter(i => getAgeInfo(i).years >= 45 && getAgeInfo(i).years <= 59).length;
      const age60_69 = lansiaItems.filter(i => getAgeInfo(i).years >= 60 && getAgeInfo(i).years <= 69).length;
      const age70Plus = lansiaItems.filter(i => getAgeInfo(i).years >= 70).length;

      const lansiaPria = lansiaItems.filter(i => (i.jenisKelamin || '').toUpperCase().startsWith('L')).length;
      const lansiaWanita = lansiaItems.filter(i => (i.jenisKelamin || '').toUpperCase().startsWith('P')).length;

      const totalHt = lansiaItems.filter(i => (i.tekananDarahSistol || 0) >= 140 || (i.tekananDarahDiastol || 0) >= 90).length;
      const totalTdNormal = lansiaItems.filter(i => (i.tekananDarahSistol || 0) > 0 && (i.tekananDarahSistol || 0) < 140 && (i.tekananDarahDiastol || 0) < 90).length;

      const totalDm = lansiaItems.filter(i => (i.gulaDarahSewaktu || 0) >= 200).length;
      const totalGdsNormal = lansiaItems.filter(i => (i.gulaDarahSewaktu || 0) > 0 && (i.gulaDarahSewaktu || 0) < 200).length;

      const totalKolest = lansiaItems.filter(i => (i.kolesterol || 0) >= 200).length;
      const totalKolestNormal = lansiaItems.filter(i => (i.kolesterol || 0) > 0 && (i.kolesterol || 0) < 200).length;

      const totalAsamUrat = lansiaItems.filter(i => (i.asamUrat || 0) >= 7).length;
      const totalAsamUratNormal = lansiaItems.filter(i => (i.asamUrat || 0) > 0 && (i.asamUrat || 0) < 7).length;

      const vitACount = balitaItems.filter(i => i.vitaminA).length;
      const asiCount = balitaItems.filter(i => i.asiEksklusif).length;
      const obatCacingCount = balitaItems.filter(i => i.obatCacing).length;
      const pemberianLainCount = balitaItems.filter(i => i.statusImunisasi && i.statusImunisasi.trim() !== '').length;

      const boxHeight = 84;
      // Background Putih Bersih & Border Formal Slate (Standar Laporan Profesional)
      doc.rect(startX, yPos, printableWidth, boxHeight).fillAndStroke('#ffffff', '#94a3b8');

      // Garis pemisah tipis bawah judul
      doc.moveTo(startX, yPos + 18).lineTo(startX + printableWidth, yPos + 18).strokeColor('#e2e8f0').lineWidth(0.75).stroke();

      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold');
      const boxTitle = isBalitaOnly
        ? 'REKAPITULASI PELAYANAN KESEHATAN BALITA'
        : isLansiaOnly
        ? 'REKAPITULASI PELAYANAN KESEHATAN LANSIA'
        : 'REKAPITULASI PELAYANAN KESEHATAN POSYANDU (BALITA & LANSIA)';
      doc.text(boxTitle, startX + 10, yPos + 5.5);

      doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a');

      if (isBalitaOnly) {
        // Kolom 1: Rentang Umur Balita
        const col1LabelX = startX + 12;
        const col1ColonX = startX + 105;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Rentang Usia Balita:', col1LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• 0 - 6 Bulan', col1LabelX, yPos + 34);
        doc.text(`:  ${age0_6} Anak`, col1ColonX, yPos + 34);

        doc.text('• 7 - 12 Bulan', col1LabelX, yPos + 46);
        doc.text(`:  ${age7_12} Anak`, col1ColonX, yPos + 46);

        doc.text('• 13 - 24 Bulan', col1LabelX, yPos + 58);
        doc.text(`:  ${age13_24} Anak`, col1ColonX, yPos + 58);

        doc.text('• 25 - 60 Bulan', col1LabelX, yPos + 70);
        doc.text(`:  ${age25_60} Anak`, col1ColonX, yPos + 70);

        // Kolom 2: Status Gizi Balita (BB/U, TB/U, TB/BB)
        const col2LabelX = startX + 225;
        const col2ColonX = startX + 315;

        const bbUNormal = balitaItems.filter(i => normalizeStatusBbUCode(i.statusBbU, Number(i.beratBadan), i.usiaBulan, i.jenisKelamin) === 'N').length;
        const bbUKurang = balitaItems.filter(i => normalizeStatusBbUCode(i.statusBbU, Number(i.beratBadan), i.usiaBulan, i.jenisKelamin) === 'K').length;
        const bbUSgKurang = balitaItems.filter(i => normalizeStatusBbUCode(i.statusBbU, Number(i.beratBadan), i.usiaBulan, i.jenisKelamin) === 'SK').length;

        const tbUNormal = balitaItems.filter(i => normalizeStatusTbUCode(i.statusTbU, Number(i.tinggiBadan), i.usiaBulan, i.jenisKelamin) === 'N').length;
        const tbUPendek = balitaItems.filter(i => normalizeStatusTbUCode(i.statusTbU, Number(i.tinggiBadan), i.usiaBulan, i.jenisKelamin) === 'P').length;
        const tbUSgPendek = balitaItems.filter(i => normalizeStatusTbUCode(i.statusTbU, Number(i.tinggiBadan), i.usiaBulan, i.jenisKelamin) === 'SP').length;
        const tbUStunting = tbUPendek + tbUSgPendek;

        const bbTbNormal = balitaItems.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'N').length;
        const bbTbKurus = balitaItems.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'K').length;
        const bbTbSgKurus = balitaItems.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'SK').length;
        const bbTbGemuk = balitaItems.filter(i => normalizeStatusBbTbCode(i.statusBbTb, Number(i.beratBadan), Number(i.tinggiBadan), i.jenisKelamin) === 'G').length;
        const bbTbWasting = bbTbKurus + bbTbSgKurus;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Status Gizi Antropometri (BB/U, TB/U, TB/BB):', col2LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        // Row 1: BB/U
        doc.text('• BB/U', col2LabelX, yPos + 34);
        doc.text(`:  ${bbUNormal} Normal | ${bbUKurang} Kurang | ${bbUSgKurang} S.Kurang`, col2ColonX, yPos + 34);

        // Row 2: TB/U
        doc.text('• TB/U', col2LabelX, yPos + 46);
        doc.text(`:  ${tbUNormal} Normal | ${tbUPendek} Pendek | ${tbUSgPendek} S.Pendek`, col2ColonX, yPos + 46);

        // Row 3: TB/BB
        doc.text('• TB/BB', col2LabelX, yPos + 58);
        doc.text(`:  ${bbTbNormal} Normal | ${bbTbKurus} Kurus | ${bbTbGemuk} Gemuk`, col2ColonX, yPos + 58);

        // Row 4: Rekap Masalah Gizi
        doc.text('• Rekap Masalah Gizi', col2LabelX, yPos + 70);
        doc.text(`:  ${tbUStunting} Stunting (TB/U) | ${bbTbWasting} Wasting (TB/BB)`, col2ColonX, yPos + 70);

        // Kolom 3: Pelayanan Kesehatan & Suplementasi
        const col3LabelX = startX + 540;
        const col3ColonX = startX + 665;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Pelayanan Kesehatan & Suplementasi:', col3LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• Vitamin A (Kapsul)', col3LabelX, yPos + 34);
        doc.text(`:  ${vitACount} Balita`, col3ColonX, yPos + 34);

        doc.text('• ASI Eksklusif (0-6 Bln)', col3LabelX, yPos + 46);
        doc.text(`:  ${asiCount} Bayi`, col3ColonX, yPos + 46);

        doc.text('• Pemberian Obat Cacing', col3LabelX, yPos + 58);
        doc.text(`:  ${obatCacingCount} Balita`, col3ColonX, yPos + 58);

        doc.text('• Imunisasi / Tambahan', col3LabelX, yPos + 70);
        doc.text(`:  ${pemberianLainCount} Balita`, col3ColonX, yPos + 70);
      } else if (isLansiaOnly) {
        // Kolom 1: Rentang Umur Lansia & Demografi
        const col1LabelX = startX + 12;
        const col1ColonX = startX + 175;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Distribusi Sasaran Usia Lansia:', col1LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• Pra-Lansia (45 - 59 Tahun)', col1LabelX, yPos + 34);
        doc.text(`:  ${age45_59} Orang`, col1ColonX, yPos + 34);

        doc.text('• Lansia (60 - 69 Tahun)', col1LabelX, yPos + 46);
        doc.text(`:  ${age60_69} Orang`, col1ColonX, yPos + 46);

        doc.text('• Lansia Risti (>= 70 Tahun)', col1LabelX, yPos + 58);
        doc.text(`:  ${age70Plus} Orang`, col1ColonX, yPos + 58);

        doc.text('• Total Kunjungan Lansia', col1LabelX, yPos + 70);
        doc.text(`:  ${lansiaItems.length} Orang (L: ${lansiaPria} / P: ${lansiaWanita})`, col1ColonX, yPos + 70);

        // Kolom 2: Hasil Skrining Fisik & Laboratorium
        const col2LabelX = startX + 350;
        const col2ColonX = startX + 480;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Hasil Skrining Fisik & Pemeriksaan Lab:', col2LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• Tekanan Darah (TD)', col2LabelX, yPos + 34);
        doc.text(`:  ${totalTdNormal} Normal  |  ${totalHt} Hipertensi (>= 140/90 mmHg)`, col2ColonX, yPos + 34);

        doc.text('• Gula Darah Sewaktu (GDS)', col2LabelX, yPos + 46);
        doc.text(`:  ${totalGdsNormal} Normal  |  ${totalDm} Tinggi (>= 200 mg/dL)`, col2ColonX, yPos + 46);

        doc.text('• Kolesterol Total', col2LabelX, yPos + 58);
        doc.text(`:  ${totalKolestNormal} Normal (< 200)  |  ${totalKolest} Tinggi (>= 200 mg/dL)`, col2ColonX, yPos + 58);

        doc.text('• Asam Urat', col2LabelX, yPos + 70);
        doc.text(`:  ${totalAsamUratNormal} Normal (< 7)  |  ${totalAsamUrat} Tinggi (>= 7 mg/dL)`, col2ColonX, yPos + 70);
      } else {
        // Rekap Semua (Balita + Lansia)
        const col1LabelX = startX + 12;
        const col1ColonX = startX + 90;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Rentang Usia Balita:', col1LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• 0 - 6 Bulan', col1LabelX, yPos + 34);
        doc.text(`:  ${age0_6} Anak`, col1ColonX, yPos + 34);

        doc.text('• 7 - 12 Bulan', col1LabelX, yPos + 46);
        doc.text(`:  ${age7_12} Anak`, col1ColonX, yPos + 46);

        doc.text('• 13 - 24 Bulan', col1LabelX, yPos + 58);
        doc.text(`:  ${age13_24} Anak`, col1ColonX, yPos + 58);

        doc.text('• 25 - 60 Bulan', col1LabelX, yPos + 70);
        doc.text(`:  ${age25_60} Anak`, col1ColonX, yPos + 70);

        const col2LabelX = startX + 180;
        const col2ColonX = startX + 315;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Rentang Usia Lansia:', col2LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• Pra-Lansia (45 - 59 Th)', col2LabelX, yPos + 34);
        doc.text(`:  ${age45_59} Orang`, col2ColonX, yPos + 34);

        doc.text('• Lansia (60 - 69 Th)', col2LabelX, yPos + 46);
        doc.text(`:  ${age60_69} Orang`, col2ColonX, yPos + 46);

        doc.text('• Lansia Risti (>= 70 Th)', col2LabelX, yPos + 58);
        doc.text(`:  ${age70Plus} Orang`, col2ColonX, yPos + 58);

        doc.text('• Total Lansia', col2LabelX, yPos + 70);
        doc.text(`:  ${lansiaItems.length} Orang (L:${lansiaPria}/P:${lansiaWanita})`, col2ColonX, yPos + 70);

        const col3LabelX = startX + 440;
        const col3ColonX = startX + 575;

        doc.font('Helvetica-Bold').fillColor('#334155').text('Rekap Layanan & Skrining Kesehatan:', col3LabelX, yPos + 22);
        doc.font('Helvetica').fillColor('#0f172a');

        doc.text('• Layanan Balita (Vit A/ASI/Cacing)', col3LabelX, yPos + 34);
        doc.text(`:  ${vitACount} Vit A | ${asiCount} ASI | ${obatCacingCount} Cacing`, col3ColonX, yPos + 34);

        doc.text('• Imunisasi / Tambahan Balita', col3LabelX, yPos + 46);
        doc.text(`:  ${pemberianLainCount} Balita`, col3ColonX, yPos + 46);

        doc.text('• Lansia: TD & GDS Tinggi', col3LabelX, yPos + 58);
        doc.text(`:  ${totalHt} Hipertensi (>= 140/90) | ${totalDm} GDS >= 200`, col3ColonX, yPos + 58);

        doc.text('• Lansia: Kolesterol & Asam Urat', col3LabelX, yPos + 70);
        doc.text(`:  ${totalKolest} Kolesterol >= 200 | ${totalAsamUrat} Asam Urat >= 7`, col3ColonX, yPos + 70);
      }

      doc.fillColor('#000000');
      doc.y = yPos + boxHeight + 10;
    };

    // Eksekusi Render Sesuai Filter Tipe
    if (isBalitaOnly) {
      renderBalitaTable(balitaList);
      renderSummaryBox(balitaList);
    } else if (isLansiaOnly) {
      renderLansiaTable(lansiaList);
      renderSummaryBox(lansiaList);
    } else {
      if (balitaList.length > 0) {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f766e').text('A. DATA PEMERIKSAAN & REGISTER BALITA', startX, doc.y);
        doc.fillColor('#000000');
        doc.moveDown(0.3);
        renderBalitaTable(balitaList);
      }
      if (lansiaList.length > 0) {
        if (doc.y > doc.page.height - 140) doc.addPage();
        else doc.moveDown(1);
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f766e').text('B. DATA PEMERIKSAAN & REGISTER LANSIA', startX, doc.y);
        doc.fillColor('#000000');
        doc.moveDown(0.3);
        renderLansiaTable(lansiaList);
      }
      renderSummaryBox(data);
    }

    // Signature Block di bagian kanan bawah
    let finalY = doc.y;
    if (finalY > doc.page.height - 145) {
      doc.addPage();
      finalY = 35;
    }

    finalY += 8;
    const signX = endX - 220;

    doc.fontSize(8.5).font('Helvetica').fillColor('#0f172a');
    doc.text(`${posyandu.desa || 'Desa'}, ${todayFormatted}`, signX, finalY, { align: 'center', width: 220, lineBreak: false });
    doc.text('Mengetahui,', signX, finalY + 11, { align: 'center', width: 220, lineBreak: false });
    doc.font('Helvetica-Bold').text('Ketua / Kader Posyandu', signX, finalY + 22, { align: 'center', width: 220, lineBreak: false });

    doc.font('Helvetica-Bold').text('( ............................................ )', signX, finalY + 82, { align: 'center', width: 220, lineBreak: false });

    // Page Numbers Footer
    const pages = doc.bufferedPageRange().count;
    doc.page.margins.bottom = 0;
    for (let i = 0; i < pages; i++) {
      doc.switchToPage(i);
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#64748b').text(
        `Halaman ${i + 1} dari ${pages} — Sistem Informasi Posyandu (Format Landscape Register Resmi)`,
        startX,
        doc.page.height - 22,
        { align: 'center', width: printableWidth, lineBreak: false }
      );
    }

    return doc;
  },
};

