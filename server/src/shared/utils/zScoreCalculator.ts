import { BBU_DATA, TBU_DATA, BBTB_DATA, SDArray } from './antropometriData';

function getBBUsds(usiaBulan: number, jenisKelamin: 'L' | 'P'): SDArray {
  const ageKey = Math.min(60, Math.max(0, Math.round(usiaBulan)));
  const data = BBU_DATA[jenisKelamin] || BBU_DATA['L'];
  return data[ageKey] || data[0];
}

function getTBUsds(usiaBulan: number, jenisKelamin: 'L' | 'P'): SDArray {
  const ageKey = Math.min(60, Math.max(0, Math.round(usiaBulan)));
  const data = TBU_DATA[jenisKelamin] || TBU_DATA['L'];
  return data[ageKey] || data[0];
}

function getBBTBSDs(tinggiBadan: number, jenisKelamin: 'L' | 'P'): SDArray {
  const list = BBTB_DATA[jenisKelamin] || BBTB_DATA['L'];
  if (tinggiBadan <= list[0].tb) return list[0].sds;
  if (tinggiBadan >= list[list.length - 1].tb) return list[list.length - 1].sds;

  for (let i = 0; i < list.length - 1; i++) {
    const item1 = list[i];
    const item2 = list[i + 1];
    if (tinggiBadan >= item1.tb && tinggiBadan <= item2.tb) {
      const ratio = (tinggiBadan - item1.tb) / (item2.tb - item1.tb);
      const interpolatedSds: SDArray = [0, 0, 0, 0, 0, 0, 0];
      for (let j = 0; j < 7; j++) {
        interpolatedSds[j] = item1.sds[j] + ratio * (item2.sds[j] - item1.sds[j]);
      }
      return interpolatedSds;
    }
  }
  return list[0].sds;
}

export function hitungZScoreFromSD(val: number, sds: SDArray): number {
  const [sdM3, sdM2, sdM1, median, sdP1, sdP2, sdP3] = sds;
  if (val === median) return 0;

  if (val > median) {
    const sdUnit = sdP1 - median;
    if (sdUnit === 0) return 0;
    return (val - median) / sdUnit;
  } else {
    const sdUnit = median - sdM1;
    if (sdUnit === 0) return 0;
    return (val - median) / sdUnit;
  }
}

export function hitungZScoreBBU(beratBadan: number, usiaBulan: number, jenisKelamin: 'L' | 'P'): number {
  const sds = getBBUsds(usiaBulan, jenisKelamin);
  return Number(hitungZScoreFromSD(beratBadan, sds).toFixed(2));
}

export function hitungZScoreTBU(tinggiBadan: number, usiaBulan: number, jenisKelamin: 'L' | 'P'): number {
  const sds = getTBUsds(usiaBulan, jenisKelamin);
  return Number(hitungZScoreFromSD(tinggiBadan, sds).toFixed(2));
}

export function hitungZScoreBBTB(beratBadan: number, tinggiBadan: number, jenisKelamin: 'L' | 'P'): number {
  const sds = getBBTBSDs(tinggiBadan, jenisKelamin);
  return Number(hitungZScoreFromSD(beratBadan, sds).toFixed(2));
}

export function hitungStatusBbU(
  beratBadan: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): 'SK' | 'K' | 'N' | 'L' {
  const zScore = hitungZScoreBBU(beratBadan, usiaBulan, jenisKelamin);

  if (zScore < -3) return 'SK'; // Sangat Kurang
  if (zScore < -2) return 'K';  // Kurang
  if (zScore <= 1) return 'N';  // Normal
  return 'L';                   // Lebih
}

export function hitungStatusTbU(
  tinggiBadan: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): 'SP' | 'P' | 'N' | 'T' {
  const zScore = hitungZScoreTBU(tinggiBadan, usiaBulan, jenisKelamin);

  if (zScore < -3) return 'SP'; // Sangat Pendek
  if (zScore < -2) return 'P';  // Pendek
  if (zScore <= 2) return 'N';  // Normal (Sesuai Permenkes No. 2 Th 2020: Normal -2 SD s.d. +2 SD)
  return 'T';                   // Tinggi
}

export function hitungStatusBbTb(
  beratBadan: number,
  tinggiBadan: number,
  jenisKelamin: 'L' | 'P'
): 'SK' | 'K' | 'N' | 'G' {
  const zScore = hitungZScoreBBTB(beratBadan, tinggiBadan, jenisKelamin);

  if (zScore < -3) return 'SK'; // Sangat Kurus / Gizi Buruk
  if (zScore < -2) return 'K';  // Kurus / Gizi Kurang
  if (zScore <= 1) return 'N';  // Normal / Gizi Baik
  return 'G';                   // Gemuk / Gizi Lebih
}

// Hitung IMT Lansia
export function hitungIMT(beratBadan: number, tinggiBadan: number): number {
  if (tinggiBadan <= 0) return 0;
  const tbMeter = tinggiBadan / 100;
  return Number((beratBadan / (tbMeter * tbMeter)).toFixed(1));
}

export function normalizeStatusBbUCode(
  rawStatus?: string | null,
  beratBadan?: number,
  usiaBulan?: number,
  jenisKelamin?: string
): 'SK' | 'K' | 'N' | 'L' {
  if (rawStatus && typeof rawStatus === 'string' && rawStatus.trim() !== '' && rawStatus !== '-') {
    const s = rawStatus.trim().toUpperCase();
    if (s === 'SK' || s.includes('SANGAT KURANG') || s.includes('SEVERELY')) return 'SK';
    if (s === 'K' || s.includes('KURANG') || s.includes('UNDERWEIGHT')) return 'K';
    if (s === 'L' || s.includes('LEBIH') || s.includes('RISIKO')) return 'L';
    if (s === 'N' || s.includes('NORMAL')) return 'N';
  }
  const bb = Number(beratBadan);
  if (!isNaN(bb) && bb > 0 && usiaBulan !== undefined && usiaBulan >= 0) {
    const jk = (jenisKelamin === 'P' || jenisKelamin === 'p') ? 'P' : 'L';
    return hitungStatusBbU(bb, usiaBulan, jk);
  }
  return 'N';
}

export function normalizeStatusTbUCode(
  rawStatus?: string | null,
  tinggiBadan?: number,
  usiaBulan?: number,
  jenisKelamin?: string
): 'SP' | 'P' | 'N' | 'T' {
  if (rawStatus && typeof rawStatus === 'string' && rawStatus.trim() !== '' && rawStatus !== '-') {
    const s = rawStatus.trim().toUpperCase();
    if (s === 'SP' || s.includes('SANGAT PENDEK') || s.includes('SEVERELY')) return 'SP';
    if (s === 'P' || s.includes('PENDEK') || s.includes('STUNT')) return 'P';
    if (s === 'T' || s.includes('TINGGI')) return 'T';
    if (s === 'N' || s.includes('NORMAL')) return 'N';
  }
  const tb = Number(tinggiBadan);
  if (!isNaN(tb) && tb > 0 && usiaBulan !== undefined && usiaBulan >= 0) {
    const jk = (jenisKelamin === 'P' || jenisKelamin === 'p') ? 'P' : 'L';
    return hitungStatusTbU(tb, usiaBulan, jk);
  }
  return 'N';
}

export function normalizeStatusBbTbCode(
  rawStatus?: string | null,
  beratBadan?: number,
  tinggiBadan?: number,
  jenisKelamin?: string
): 'SK' | 'K' | 'N' | 'G' {
  if (rawStatus && typeof rawStatus === 'string' && rawStatus.trim() !== '' && rawStatus !== '-') {
    const s = rawStatus.trim().toUpperCase();
    if (s === 'SK' || s.includes('SANGAT KURUS') || s.includes('GIZI BURUK') || s.includes('SEVERE')) return 'SK';
    if (s === 'K' || s.includes('KURUS') || s.includes('GIZI KURANG') || s.includes('WASTED')) return 'K';
    if (s === 'G' || s === 'L' || s.includes('GEMUK') || s.includes('LEBIH') || s.includes('OBESITAS')) return 'G';
    if (s === 'N' || s.includes('NORMAL') || s.includes('BAIK')) return 'N';
  }
  const bb = Number(beratBadan);
  const tb = Number(tinggiBadan);
  if (!isNaN(bb) && bb > 0 && !isNaN(tb) && tb > 0) {
    const jk = (jenisKelamin === 'P' || jenisKelamin === 'p') ? 'P' : 'L';
    return hitungStatusBbTb(bb, tb, jk);
  }
  return 'N';
}

