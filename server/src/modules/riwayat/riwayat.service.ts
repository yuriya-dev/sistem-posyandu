import prisma from '../../shared/config/prisma';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

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

        const isWarning = item.statusBbU === 'SK' || item.statusBbU === 'K' || item.statusTbU === 'SP' || item.statusTbU === 'P' || item.statusBbTb === 'SK' || item.statusBbTb === 'K' || item.statusBbTb === 'G';
        const statusType: 'success' | 'warning' = isWarning ? 'warning' : 'success';

        let statusDesc = `Normal (BB/U: ${getStatusBbUText(item.statusBbU)})`;
        if (item.statusBbU === 'K') statusDesc = 'BB Kurang';
        else if (item.statusBbU === 'SK') statusDesc = 'BB Sangat Kurang';
        else if (item.statusTbU === 'P') statusDesc = 'Stunting (Pendek)';
        else if (item.statusTbU === 'SP') statusDesc = 'Sangat Pendek';
        else if (item.statusBbTb === 'G') statusDesc = 'Gizi Lebih / Obesitas';

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
          statusBbU: item.statusBbU,
          statusTbU: item.statusTbU,
          statusBbTb: item.statusBbTb,
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

    // Subtitle Filter untuk Excel Header
    const filterInfoArr = [];
    if (filter.tipe && filter.tipe !== 'semua') filterInfoArr.push(`Kategori: ${filter.tipe}`);
    if (filter.bulan) filterInfoArr.push(`Bulan: ${NAMA_BULAN[filter.bulan - 1]}`);
    if (filter.tahun) filterInfoArr.push(`Tahun: ${filter.tahun}`);
    if (filter.status && filter.status !== 'semua') filterInfoArr.push(`Status: ${filter.status === 'warning' ? 'Perlu Perhatian' : 'Normal'}`);
    if (filter.search) filterInfoArr.push(`Pencarian: "${filter.search}"`);
    
    const filterInfoStr = filterInfoArr.length > 0 ? ` [Filter: ${filterInfoArr.join(' | ')}]` : '';

    // Helper untuk membuat worksheet dengan format Landscape & Kolom Mandiri
    const createBalitaWorksheet = (sheetName: string, items: ItemRiwayat[]) => {
      const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      // Header Judul Laporan
      sheet.mergeCells('A1:T1');
      sheet.getCell('A1').value = `LAPORAN PEMERIKSAAN BALITA${filterInfoStr}`;
      sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:T2');
      sheet.getCell('A2').value = `Posyandu: ${posyandu?.nama || '-'} | Desa: ${posyandu?.desa || '-'} | Kecamatan: ${posyandu?.kecamatan || '-'}`;
      sheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
      sheet.getCell('A2').alignment = { horizontal: 'center' };

      sheet.addRow([]);

      const headerRow = sheet.addRow([
        'No',
        'Nama Balita',
        'Tanggal Lahir',
        'NIK',
        'Nama Ibu',
        'JK',
        'Usia',
        'BB (kg)',
        'TB (cm)',
        'BB/U',
        'TB/U',
        'BB/TB',
        'LK (cm)',
        'LiLA (cm)',
        'B1',
        'B6',
        'ASI SKS',
        'Vitamin A',
        'Obat Cacing',
        'Pemberian Lain'
      ]);

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '0D9488' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      items.forEach((item, index) => {
        const usiaText = getUsiaText(item.tanggalLahir, item.tanggal, item.tipe);
        const row = sheet.addRow([
          index + 1,
          item.nama,
          item.tanggalLahir || '-',
          item.nik || '-',
          item.namaIbu || '-',
          item.jenisKelamin || '-',
          usiaText,
          item.beratBadan ?? '-',
          item.tinggiBadan ?? '-',
          getStatusBbUText(item.statusBbU),
          getStatusTbUText(item.statusTbU),
          getStatusBbTbText(item.statusBbTb),
          item.lingkarKepala ?? '-',
          item.lingkarLengan ?? '-',
          item.vitB1 ? 'Ya' : 'Tdk',
          item.vitB6 ? 'Ya' : 'Tdk',
          item.asiEksklusif ? 'Ya' : 'Tdk',
          item.vitaminA ? 'Ya' : 'Tdk',
          item.obatCacing ? 'Ya' : 'Tdk',
          extractPemberianLain(item.statusImunisasi)
        ]);

        row.eachCell((cell, colNum) => {
          if (colNum === 1 || colNum === 3 || colNum === 4 || colNum === 6 || colNum === 7 || colNum >= 10) {
            cell.alignment = { horizontal: 'center' };
          } else if (colNum === 8 || colNum === 9) {
            cell.alignment = { horizontal: 'right' };
          } else {
            cell.alignment = { horizontal: 'left' };
          }
        });
      });

      if (sheet.columns) {
        (sheet.columns as Array<Partial<ExcelJS.Column>>).forEach((column) => {
          let maxLength = 0;
          if (column && typeof column.eachCell === 'function') {
            column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            });
          }
          column.width = Math.max(maxLength + 3, 10);
        });
      }
    };

    const createLansiaWorksheet = (sheetName: string, items: ItemRiwayat[]) => {
      const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      sheet.mergeCells('A1:J1');
      sheet.getCell('A1').value = `LAPORAN PEMERIKSAAN LANSIA${filterInfoStr}`;
      sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
      sheet.getCell('A1').alignment = { horizontal: 'center' };

      sheet.mergeCells('A2:J2');
      sheet.getCell('A2').value = `Posyandu: ${posyandu?.nama || '-'} | Desa: ${posyandu?.desa || '-'} | Kecamatan: ${posyandu?.kecamatan || '-'}`;
      sheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true };
      sheet.getCell('A2').alignment = { horizontal: 'center' };

      sheet.addRow([]);

      const headerRow = sheet.addRow([
        'No',
        'Nama Lansia',
        'Tanggal Lahir',
        'NIK',
        'JK',
        'Usia',
        'DM',
        'HT',
        'Tekanan Darah (mmHg)',
        'GDS (mg/dL)'
      ]);

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '4F46E5' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      items.forEach((item, index) => {
        const usiaText = getUsiaText(item.tanggalLahir, item.tanggal, 'Lansia');
        const row = sheet.addRow([
          index + 1,
          item.nama,
          item.tanggalLahir || '-',
          item.nik || '-',
          item.jenisKelamin || '-',
          usiaText,
          item.riwayatDm ? 'Ya' : 'Tdk',
          item.riwayatHt ? 'Ya' : 'Tdk',
          item.tekananDarahSistol ? `${item.tekananDarahSistol}/${item.tekananDarahDiastol}` : '-',
          item.gulaDarahSewaktu ?? '-'
        ]);

        row.eachCell((cell) => {
          cell.alignment = { horizontal: 'center' };
        });
        row.getCell(2).alignment = { horizontal: 'left' };
      });

      if (sheet.columns) {
        (sheet.columns as Array<Partial<ExcelJS.Column>>).forEach((column) => {
          let maxLength = 0;
          if (column && typeof column.eachCell === 'function') {
            column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
              const columnLength = cell.value ? cell.value.toString().length : 10;
              if (columnLength > maxLength) {
                maxLength = columnLength;
              }
            });
          }
          column.width = Math.max(maxLength + 3, 10);
        });
      }
    };

    if (filter.tipe === 'Balita') {
      createBalitaWorksheet('Data Balita', data.filter(d => d.tipe === 'Balita'));
    } else if (filter.tipe === 'Lansia') {
      createLansiaWorksheet('Data Lansia', data.filter(d => d.tipe === 'Lansia'));
    } else {
      const balitaData = data.filter((d) => d.tipe === 'Balita');
      if (balitaData.length > 0) {
        createBalitaWorksheet('Data Balita', balitaData);
      }
      const lansiaData = data.filter((d) => d.tipe === 'Lansia');
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
      const cNo = startX;              // 30  (w: 18)
      const cNama = startX + 18;       // 48  (w: 88)
      const cTglLahir = startX + 106;  // 136 (w: 58)
      const cNik = startX + 164;       // 194 (w: 80)
      const cJK = startX + 244;        // 274 (w: 18)
      const cUsia = startX + 262;      // 292 (w: 30)
      const cRiwHt = startX + 292;     // 322 (w: 32)
      const cRiwDm = startX + 324;     // 354 (w: 32)
      const cBB = startX + 356;        // 386 (w: 32)
      const cTB = startX + 388;        // 418 (w: 32)
      const cTD = startX + 420;        // 450 (w: 60)
      const cGds = startX + 480;       // 510 (w: 48)
      const cKolest = startX + 528;    // 558 (w: 48)
      const cAsamUrat = startX + 576;  // 606 (w: 48)
      const cLPerut = startX + 624;    // 654 (w: 44)
      const cKeluhan = startX + 668;   // 698 (w: 113.89)

      const lansiaCols = [
        cNama, cTglLahir, cNik, cJK, cUsia, cRiwHt, cRiwDm, cBB, cTB, cTD, cGds, cKolest, cAsamUrat, cLPerut, cKeluhan
      ];

      const drawTableHeader = (y: number) => {
        // Multi-level Header: Height = 28pt (Row 1: 13pt, Row 2: 15pt)
        const headerHeight = 28;
        doc.rect(startX, y, printableWidth, headerHeight).fillAndStroke('#4338ca', '#3730a3');
        doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold');

        const fullHeightCols = [cNama, cRiwHt, cBB, cGds, cKeluhan];
        fullHeightCols.forEach(x => {
          doc.moveTo(x, y).lineTo(x, y + headerHeight).strokeColor('#3730a3').lineWidth(0.5).stroke();
        });

        [
          cTglLahir, cNik, cJK, cUsia,
          cRiwDm,
          cTB, cTD,
          cKolest, cAsamUrat, cLPerut
        ].forEach(x => {
          doc.moveTo(x, y + 13).lineTo(x, y + headerHeight).strokeColor('#3730a3').lineWidth(0.5).stroke();
        });

        doc.moveTo(cNama, y + 13).lineTo(cKeluhan, y + 13).strokeColor('#3730a3').lineWidth(0.5).stroke();

        // Row 1 Grouping
        doc.text('NO', cNo, y + 10, { width: 18, align: 'center' });
        doc.text('IDENTITAS LANSIA', cNama, y + 4, { width: 274, align: 'center' });
        doc.text('RIWAYAT PENYAKIT', cRiwHt, y + 4, { width: 64, align: 'center' });
        doc.text('PEMERIKSAAN FISIK & VITAL', cBB, y + 4, { width: 124, align: 'center' });
        doc.text('PEMERIKSAAN LAB & LINGKAR PERUT', cGds, y + 4, { width: 188, align: 'center' });
        doc.text('KELUHAN & TINDAKAN MEDIS', cKeluhan, y + 10, { width: 113.89, align: 'center' });

        // Row 2 Sub-headers
        doc.fontSize(6);
        doc.text('Nama Lansia', cNama + 2, y + 16, { width: 84 });
        doc.text('Tgl Lahir', cTglLahir, y + 16, { width: 58, align: 'center' });
        doc.text('NIK', cNik, y + 16, { width: 80, align: 'center' });
        doc.text('JK', cJK, y + 16, { width: 18, align: 'center' });
        doc.text('Usia', cUsia, y + 16, { width: 30, align: 'center' });

        doc.text('Riw HT', cRiwHt, y + 16, { width: 32, align: 'center' });
        doc.text('Riw DM', cRiwDm, y + 16, { width: 32, align: 'center' });

        doc.text('BB(kg)', cBB, y + 16, { width: 32, align: 'center' });
        doc.text('TB(cm)', cTB, y + 16, { width: 32, align: 'center' });
        doc.text('TD (mmHg)', cTD, y + 16, { width: 60, align: 'center' });

        doc.text('GDS(mg/dL)', cGds, y + 16, { width: 48, align: 'center' });
        doc.text('Kolesterol', cKolest, y + 16, { width: 48, align: 'center' });
        doc.text('Asam Urat', cAsamUrat, y + 16, { width: 48, align: 'center' });
        doc.text('L.Perut(cm)', cLPerut, y + 16, { width: 44, align: 'center' });

        doc.fillColor('#000000');
      };

      let yPos = doc.y;
      drawTableHeader(yPos);
      yPos += 28;

      const rowHeight = 18;

      items.forEach((item, idx) => {
        if (yPos > doc.page.height - 120) {
          doc.addPage();
          yPos = 30;
          drawTableHeader(yPos);
          yPos += 28;
        }

        const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(startX, yPos, printableWidth, rowHeight).fillAndStroke(bg, '#cbd5e1');

        lansiaCols.forEach(x => {
          doc.moveTo(x, yPos).lineTo(x, yPos + rowHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        });

        doc.font('Helvetica').fontSize(6.5);

        const usiaText = getUsiaText(item.tanggalLahir, item.tanggal, 'Lansia');
        const tdText = item.tekananDarahSistol ? `${item.tekananDarahSistol}/${item.tekananDarahDiastol}` : '-';

        doc.fillColor('#0f172a');

        doc.text(String(idx + 1), cNo, yPos + 5, { width: 18, align: 'center' });
        doc.font('Helvetica-Bold').text((item.nama || '-').substring(0, 20), cNama + 2, yPos + 5, { width: 84 });

        // Tgl Lahir & NIK dipisahkan
        doc.font('Helvetica').fontSize(6);
        const tglStr = item.tanggalLahir ? item.tanggalLahir.substring(0, 10) : '-';
        const nikStr = item.nik || '-';
        doc.text(tglStr, cTglLahir, yPos + 5, { width: 58, align: 'center' });
        doc.text(nikStr, cNik, yPos + 5, { width: 80, align: 'center' });
        doc.fontSize(6.5);

        doc.text(item.jenisKelamin || '-', cJK, yPos + 5, { width: 18, align: 'center' });
        doc.text(usiaText, cUsia, yPos + 5, { width: 30, align: 'center' });

        // Riwayat HT & DM
        doc.text(item.riwayatHt ? 'Ya' : 'Tdk', cRiwHt, yPos + 5, { width: 32, align: 'center' });
        doc.text(item.riwayatDm ? 'Ya' : 'Tdk', cRiwDm, yPos + 5, { width: 32, align: 'center' });

        // Pengukuran Fisik (BB, TB, TD)
        doc.text(item.beratBadan !== undefined ? String(item.beratBadan) : '-', cBB, yPos + 5, { width: 32, align: 'center' });
        doc.text(item.tinggiBadan !== undefined ? String(item.tinggiBadan) : '-', cTB, yPos + 5, { width: 32, align: 'center' });
        doc.font('Helvetica-Bold').text(tdText, cTD, yPos + 5, { width: 60, align: 'center' });
        doc.font('Helvetica');

        // Laboratorium & Lingkar Perut
        const gdsStr = item.gulaDarahSewaktu !== undefined ? String(item.gulaDarahSewaktu) : '-';
        const kolestStr = item.kolesterol !== undefined ? String(item.kolesterol) : '-';
        const asamUratStr = item.asamUrat !== undefined ? String(item.asamUrat) : '-';
        const lpStr = item.lingkarPerut !== undefined ? String(item.lingkarPerut) : '-';

        doc.text(gdsStr, cGds, yPos + 5, { width: 48, align: 'center' });
        doc.text(kolestStr, cKolest, yPos + 5, { width: 48, align: 'center' });
        doc.text(asamUratStr, cAsamUrat, yPos + 5, { width: 48, align: 'center' });
        doc.text(lpStr, cLPerut, yPos + 5, { width: 44, align: 'center' });

        // Keluhan / Tindakan
        const keluhanStr = item.keluhan ? `Keluhan: ${item.keluhan}` : '';
        const tindakanStr = item.tindakan ? `Tindakan: ${item.tindakan}` : '';
        const combinedDesc = [keluhanStr, tindakanStr].filter(Boolean).join(' | ') || '-';

        doc.fontSize(6).text(combinedDesc.substring(0, 48), cKeluhan + 2, yPos + 5, { width: 156 });

        doc.fillColor('#000000');
        yPos += rowHeight;
      });

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

      const boxHeight = 84;
      doc.rect(startX, yPos, printableWidth, boxHeight).fillAndStroke('#f0fdf4', '#0f766e');

      doc.fillColor('#065f46').fontSize(9).font('Helvetica-Bold');
      doc.text('SUMMARY KELOMPOK UMUR & REKAPITULASI PEMERIKSAAN POSYANDU', startX + 10, yPos + 8);

      doc.fontSize(7.5).font('Helvetica').fillColor('#0f172a');

      if (isBalitaOnly) {
        // Kolom 1: Rentang Umur Balita
        const col1LabelX = startX + 12;
        const col1ColonX = startX + 110;

        doc.font('Helvetica-Bold').text('Rentang Umur Balita:', col1LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• 0 - 6 Bulan', col1LabelX, yPos + 34);
        doc.text(`:  ${age0_6} Anak`, col1ColonX, yPos + 34);

        doc.text('• 7 - 12 Bulan', col1LabelX, yPos + 46);
        doc.text(`:  ${age7_12} Anak`, col1ColonX, yPos + 46);

        doc.text('• 13 - 24 Bulan', col1LabelX, yPos + 58);
        doc.text(`:  ${age13_24} Anak`, col1ColonX, yPos + 58);

        doc.text('• 25 - 60 Bulan', col1LabelX, yPos + 70);
        doc.text(`:  ${age25_60} Anak`, col1ColonX, yPos + 70);

        // Kolom 2: Status Gizi Balita
        const col2LabelX = startX + 260;
        const col2ColonX = startX + 380;

        const bbUNormal = balitaItems.filter(i => i.statusBbU === 'N').length;
        const bbUKurang = balitaItems.filter(i => i.statusBbU === 'K').length;
        const bbUSgKurang = balitaItems.filter(i => i.statusBbU === 'SK').length;
        const tbUPendek = balitaItems.filter(i => i.statusTbU === 'P' || i.statusTbU === 'SP').length;

        doc.font('Helvetica-Bold').text('Status Gizi & Perkembangan:', col2LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• BB/U Normal', col2LabelX, yPos + 34);
        doc.text(`:  ${bbUNormal} Anak`, col2ColonX, yPos + 34);

        doc.text('• BB/U Kurang / Sangat Kurang', col2LabelX, yPos + 46);
        doc.text(`:  ${bbUKurang} Kurang / ${bbUSgKurang} S.Kurang`, col2ColonX, yPos + 46);

        doc.text('• TB/U Stunting (P / SP)', col2LabelX, yPos + 58);
        doc.text(`:  ${tbUPendek} Anak`, col2ColonX, yPos + 58);

        // Kolom 3: Intervensi & Pemberian Lain Balita
        const col3LabelX = startX + 530;
        const col3ColonX = startX + 665;

        const vitACount = balitaItems.filter(i => i.vitaminA).length;
        const asiCount = balitaItems.filter(i => i.asiEksklusif).length;
        const obatCacingCount = balitaItems.filter(i => i.obatCacing).length;
        const pemberianLainCount = balitaItems.filter(i => i.statusImunisasi && i.statusImunisasi.trim() !== '').length;

        doc.font('Helvetica-Bold').text('Intervensi & Pemberian Lain:', col3LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• Vit A / ASI SKS / Obat Cacing', col3LabelX, yPos + 34);
        doc.text(`:  VitA(${vitACount}) | ASI(${asiCount}) | Cacing(${obatCacingCount})`, col3ColonX, yPos + 34);

        doc.text('• Pemberian Lain / Imunisasi', col3LabelX, yPos + 46);
        doc.text(`:  ${pemberianLainCount} Balita`, col3ColonX, yPos + 46);
      } else if (isLansiaOnly) {
        // Kolom 1: Rentang Umur Lansia
        const col1LabelX = startX + 12;
        const col1ColonX = startX + 165;

        doc.font('Helvetica-Bold').text('Rentang Umur Lansia:', col1LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• 45 - 59 Tahun (Pra-Lansia)', col1LabelX, yPos + 34);
        doc.text(`:  ${age45_59} Orang`, col1ColonX, yPos + 34);

        doc.text('• 60 - 69 Tahun (Lansia)', col1LabelX, yPos + 46);
        doc.text(`:  ${age60_69} Orang`, col1ColonX, yPos + 46);

        doc.text('• ≥ 70 Tahun (Lansia Risiko)', col1LabelX, yPos + 58);
        doc.text(`:  ${age70Plus} Orang`, col1ColonX, yPos + 58);

        // Kolom 2: Ringkasan Kesehatan Lansia
        const col2LabelX = startX + 380;
        const col2ColonX = startX + 520;

        const totalHt = lansiaItems.filter(i => (i.tekananDarahSistol || 0) >= 140 || (i.tekananDarahDiastol || 0) >= 90).length;
        const totalDm = lansiaItems.filter(i => (i.gulaDarahSewaktu || 0) >= 200).length;
        const totalKolest = lansiaItems.filter(i => (i.kolesterol || 0) >= 200).length;
        const totalAsamUrat = lansiaItems.filter(i => (i.asamUrat || 0) >= 7).length;

        doc.font('Helvetica-Bold').text('Ringkasan Kesehatan & Hasil Lab Lansia:', col2LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• Hipertensi (TD ≥ 140/90)', col2LabelX, yPos + 34);
        doc.text(`:  ${totalHt} Orang`, col2ColonX, yPos + 34);

        doc.text('• Diabetes (GDS ≥ 200 mg/dL)', col2LabelX, yPos + 46);
        doc.text(`:  ${totalDm} Orang`, col2ColonX, yPos + 46);

        doc.text('• Kolesterol Tinggi (≥ 200) / Asam Urat (≥ 7)', col2LabelX, yPos + 58);
        doc.text(`:  Kolest(${totalKolest}) | Asam Urat(${totalAsamUrat})`, col2ColonX, yPos + 58);
      } else {
        // Rekap Semua (Balita + Lansia)
        const col1LabelX = startX + 12;
        const col1ColonX = startX + 85;

        doc.font('Helvetica-Bold').text('Rentang Umur Balita:', col1LabelX, yPos + 22);
        doc.font('Helvetica');

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

        doc.font('Helvetica-Bold').text('Rentang Umur Lansia:', col2LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• 45 - 59 Tahun (Pra-Lansia)', col2LabelX, yPos + 34);
        doc.text(`:  ${age45_59} Orang`, col2ColonX, yPos + 34);

        doc.text('• 60 - 69 Tahun (Lansia)', col2LabelX, yPos + 46);
        doc.text(`:  ${age60_69} Orang`, col2ColonX, yPos + 46);

        doc.text('• ≥ 70 Tahun (Lansia Risiko)', col2LabelX, yPos + 58);
        doc.text(`:  ${age70Plus} Orang`, col2ColonX, yPos + 58);

        const col3LabelX = startX + 440;
        const col3ColonX = startX + 575;

        const vitACount = balitaItems.filter(i => i.vitaminA).length;
        const asiCount = balitaItems.filter(i => i.asiEksklusif).length;
        const obatCacingCount = balitaItems.filter(i => i.obatCacing).length;
        const pemberianLainCount = balitaItems.filter(i => i.statusImunisasi && i.statusImunisasi.trim() !== '').length;

        const totalHt = lansiaItems.filter(i => (i.tekananDarahSistol || 0) >= 140 || (i.tekananDarahDiastol || 0) >= 90).length;
        const totalDm = lansiaItems.filter(i => (i.gulaDarahSewaktu || 0) >= 200).length;

        doc.font('Helvetica-Bold').text('Ringkasan Intervensi & Kesehatan:', col3LabelX, yPos + 22);
        doc.font('Helvetica');

        doc.text('• Vit A / ASI SKS / Obat Cacing', col3LabelX, yPos + 34);
        doc.text(`:  VitA(${vitACount}) | ASI(${asiCount}) | Cacing(${obatCacingCount})`, col3ColonX, yPos + 34);

        doc.text('• Pemberian Lain / Imunisasi', col3LabelX, yPos + 46);
        doc.text(`:  ${pemberianLainCount} Balita`, col3ColonX, yPos + 46);

        doc.text('• Lansia Hipertensi / Diabetes', col3LabelX, yPos + 58);
        doc.text(`:  HT(${totalHt}) | GDS >200(${totalDm})`, col3ColonX, yPos + 58);
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
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#4338ca').text('B. DATA PEMERIKSAAN & REGISTER LANSIA', startX, doc.y);
        doc.fillColor('#000000');
        doc.moveDown(0.3);
        renderLansiaTable(lansiaList);
      }
      renderSummaryBox(data);
    }

    // Signature Block di bagian kanan bawah
    let finalY = doc.y;
    if (finalY > doc.page.height - 120) {
      doc.addPage();
      finalY = 30;
    }

    finalY += 6;
    const signX = endX - 220;

    doc.fontSize(8.5).font('Helvetica').fillColor('#0f172a');
    doc.text(`${posyandu.desa || 'Desa'}, ${todayFormatted}`, signX, finalY, { align: 'center', width: 220, lineBreak: false });
    doc.text('Mengetahui,', signX, finalY + 10, { align: 'center', width: 220, lineBreak: false });
    doc.font('Helvetica-Bold').text('Ketua / Kader Posyandu', signX, finalY + 20, { align: 'center', width: 220, lineBreak: false });

    doc.font('Helvetica-Bold').text('( ............................................ )', signX, finalY + 52, { align: 'center', width: 220, lineBreak: false });

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

