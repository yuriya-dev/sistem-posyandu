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
): 'Sangat Kurang' | 'Kurang' | 'Normal' | 'Lebih' {
  const zScore = hitungZScoreBBU(beratBadan, usiaBulan, jenisKelamin);

  if (zScore < -3) return 'Sangat Kurang';
  if (zScore < -2) return 'Kurang';
  if (zScore <= 1) return 'Normal';
  return 'Lebih';
}

export function hitungStatusTbU(
  tinggiBadan: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): 'Sangat Pendek' | 'Pendek' | 'Normal' | 'Tinggi' {
  const zScore = hitungZScoreTBU(tinggiBadan, usiaBulan, jenisKelamin);

  if (zScore < -3) return 'Sangat Pendek';
  if (zScore < -2) return 'Pendek';
  if (zScore <= 2) return 'Normal'; // Sesuai Permenkes No. 2 Th 2020: Normal (-2 SD s.d. +2 SD)
  return 'Tinggi';
}

export function hitungStatusBbTb(
  beratBadan: number,
  tinggiBadan: number,
  jenisKelamin: 'L' | 'P'
): 'Sangat Kurus' | 'Kurus' | 'Normal' | 'Gemuk' {
  const zScore = hitungZScoreBBTB(beratBadan, tinggiBadan, jenisKelamin);

  if (zScore < -3) return 'Sangat Kurus';
  if (zScore < -2) return 'Kurus';
  if (zScore <= 1) return 'Normal';
  return 'Gemuk';
}

export function hitungIMT(beratBadan: number, tinggiBadan: number): number {
  const bb = Number(beratBadan);
  const tb = Number(tinggiBadan);
  if (isNaN(bb) || isNaN(tb) || tb <= 0 || bb <= 0) return 0;
  const tbMeter = tb / 100;
  const imt = bb / (tbMeter * tbMeter);
  return isNaN(imt) ? 0 : Number(imt.toFixed(1));
}

export function hitungStatusBbUCode(
  beratBadan: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): 'SK' | 'K' | 'N' | 'L' {
  const zScore = hitungZScoreBBU(beratBadan, usiaBulan, jenisKelamin);
  if (zScore < -3) return 'SK';
  if (zScore < -2) return 'K';
  if (zScore <= 1) return 'N';
  return 'L';
}

export function hitungStatusTbUCode(
  tinggiBadan: number,
  usiaBulan: number,
  jenisKelamin: 'L' | 'P'
): 'SP' | 'P' | 'N' | 'T' {
  const zScore = hitungZScoreTBU(tinggiBadan, usiaBulan, jenisKelamin);
  if (zScore < -3) return 'SP';
  if (zScore < -2) return 'P';
  if (zScore <= 2) return 'N';
  return 'T';
}

export function hitungStatusBbTbCode(
  beratBadan: number,
  tinggiBadan: number,
  jenisKelamin: 'L' | 'P'
): 'SK' | 'K' | 'N' | 'G' {
  const zScore = hitungZScoreBBTB(beratBadan, tinggiBadan, jenisKelamin);
  if (zScore < -3) return 'SK';
  if (zScore < -2) return 'K';
  if (zScore <= 1) return 'N';
  return 'G';
}

// Helper functions untuk convert label ke enum code
export function convertStatusBbUToCode(label: string): 'SK' | 'K' | 'N' | 'L' {
  if (!label) return 'N';
  const s = label.trim().toUpperCase();
  if (s === 'SK' || s.includes('SANGAT KURANG') || s.includes('SEVERELY')) return 'SK';
  if (s === 'K' || s.includes('KURANG') || s.includes('UNDERWEIGHT')) return 'K';
  if (s === 'L' || s.includes('LEBIH') || s.includes('RISIKO')) return 'L';
  return 'N';
}

export function convertStatusTbUToCode(label: string): 'SP' | 'P' | 'N' | 'T' {
  if (!label) return 'N';
  const s = label.trim().toUpperCase();
  if (s === 'SP' || s.includes('SANGAT PENDEK') || s.includes('SEVERELY')) return 'SP';
  if (s === 'P' || s.includes('PENDEK') || s.includes('STUNT')) return 'P';
  if (s === 'T' || s.includes('TINGGI')) return 'T';
  return 'N';
}

export function convertStatusBbTbToCode(label: string): 'SK' | 'K' | 'N' | 'G' {
  if (!label) return 'N';
  const s = label.trim().toUpperCase();
  if (s === 'SK' || s.includes('SANGAT KURUS') || s.includes('GIZI BURUK') || s.includes('SEVERE')) return 'SK';
  if (s === 'K' || s.includes('KURUS') || s.includes('GIZI KURANG') || s.includes('WASTED')) return 'K';
  if (s === 'G' || s === 'L' || s.includes('GEMUK') || s.includes('LEBIH') || s.includes('OBESITAS')) return 'G';
  return 'N';
}

export function normalizeStatusBbUCode(
  rawStatus?: string | null,
  beratBadan?: number,
  usiaBulan?: number,
  jenisKelamin?: string
): 'SK' | 'K' | 'N' | 'L' {
  if (rawStatus && typeof rawStatus === 'string' && rawStatus.trim() !== '' && rawStatus !== '-') {
    return convertStatusBbUToCode(rawStatus);
  }
  const bb = Number(beratBadan);
  if (!isNaN(bb) && bb > 0 && usiaBulan !== undefined && usiaBulan >= 0) {
    const jk = (jenisKelamin === 'P' || jenisKelamin === 'p') ? 'P' : 'L';
    return hitungStatusBbUCode(bb, usiaBulan, jk);
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
    return convertStatusTbUToCode(rawStatus);
  }
  const tb = Number(tinggiBadan);
  if (!isNaN(tb) && tb > 0 && usiaBulan !== undefined && usiaBulan >= 0) {
    const jk = (jenisKelamin === 'P' || jenisKelamin === 'p') ? 'P' : 'L';
    return hitungStatusTbUCode(tb, usiaBulan, jk);
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
    return convertStatusBbTbToCode(rawStatus);
  }
  const bb = Number(beratBadan);
  const tb = Number(tinggiBadan);
  if (!isNaN(bb) && bb > 0 && !isNaN(tb) && tb > 0) {
    const jk = (jenisKelamin === 'P' || jenisKelamin === 'p') ? 'P' : 'L';
    return hitungStatusBbTbCode(bb, tb, jk);
  }
  return 'N';
}

export function getStatusBbUText(code?: string): string {
  if (!code) return 'Normal';
  const c = convertStatusBbUToCode(code);
  switch (c) {
    case 'SK': return 'Sangat Kurang';
    case 'K': return 'Kurang';
    case 'N': return 'Normal';
    case 'L': return 'Risiko BB Lebih';
    default: return code;
  }
}

export function getStatusTbUText(code?: string): string {
  if (!code) return 'Normal';
  const c = convertStatusTbUToCode(code);
  switch (c) {
    case 'SP': return 'Sangat Pendek (Stunting)';
    case 'P': return 'Pendek (Stunting)';
    case 'N': return 'Normal';
    case 'T': return 'Tinggi';
    default: return code;
  }
}

export function getStatusBbTbText(code?: string): string {
  if (!code) return 'Normal';
  const c = convertStatusBbTbToCode(code);
  switch (c) {
    case 'SK': return 'Gizi Buruk (Severe Wasting)';
    case 'K': return 'Gizi Kurang (Wasting)';
    case 'N': return 'Gizi Baik (Normal)';
    case 'G': return 'Gizi Lebih / Gemuk';
    default: return code;
  }
}

