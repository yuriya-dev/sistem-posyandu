import { ItemRiwayat } from "@/lib/api";
import { RekapanBalita, RekapanLansia, LansiaPerluPerhatian } from "../types";
import {
  normalizeStatusBbUCode,
  normalizeStatusTbUCode,
  normalizeStatusBbTbCode,
} from "@/lib/zScoreCalculator";

export function formatPeriodeText(filterMonth?: string, filterYear?: string): string {
  if (filterMonth) {
    const monthName = new Date(2000, parseInt(filterMonth) - 1).toLocaleString("id-ID", { month: "long" });
    return `${monthName} ${filterYear || new Date().getFullYear()}`;
  }
  if (filterYear) {
    return `Tahun ${filterYear}`;
  }
  return "Semua Periode";
}

export function filterLogsByDateRange(logs: ItemRiwayat[], fromDate?: string, toDate?: string): ItemRiwayat[] {
  let result = logs;
  if (fromDate) {
    result = result.filter((l) => l.tanggal >= fromDate);
  }
  if (toDate) {
    result = result.filter((l) => l.tanggal <= toDate);
  }
  return result;
}

export function calculateRekapanBalita(
  balitaLogs: ItemRiwayat[],
  totalTerdaftar: number,
  periodeText: string
): RekapanBalita {
  if (balitaLogs.length === 0) {
    return {
      periode: periodeText,
      totalPemeriksaan: 0,
      totalAnak: 0,
      totalTerdaftar,
      cakupanPersen: 0,
      tidakHadir: totalTerdaftar,
      perluTindakLanjut: 0,
      kasusStunting: 0,
      kasusWasting: 0,
      statusBbU: { normal: 0, kurang: 0, sangatKurang: 0, lebih: 0 },
      statusTbU: { normal: 0, pendek: 0, sangatPendek: 0, tinggi: 0 },
      statusBbTb: { normal: 0, kurang: 0, sangatKurang: 0, lebih: 0 },
      vitaminA: 0,
      imunisasiLengkap: 0,
      obatCacing: 0,
      asiEksklusif: 0,
      totalBayiAsiEligible: 0,
      distribusiUsia: { u0_6: 0, u7_12: 0, u13_24: 0, u25_60: 0 },
      balitaPerluPerhatianList: [],
    };
  }

  const uniqueAnakCount = new Set(balitaLogs.map((l) => l.pasienId || l.nama)).size;
  const finalTerdaftar = Math.max(totalTerdaftar, uniqueAnakCount);
  const cakupanPersen = finalTerdaftar > 0 ? Number(((uniqueAnakCount / finalTerdaftar) * 100).toFixed(1)) : 100;
  const tidakHadirCount = Math.max(0, finalTerdaftar - uniqueAnakCount);

  let u0_6 = 0;
  let u7_12 = 0;
  let u13_24 = 0;
  let u25_60 = 0;
  let bayiAsiCount = 0;
  let asiEksklusifCount = 0;

  const attentionList: RekapanBalita["balitaPerluPerhatianList"] = [];

  const countsBbU = { normal: 0, kurang: 0, sangatKurang: 0, lebih: 0 };
  const countsTbU = { normal: 0, pendek: 0, sangatPendek: 0, tinggi: 0 };
  const countsBbTb = { normal: 0, kurang: 0, sangatKurang: 0, lebih: 0 };
  let stuntingCount = 0;
  let wastingCount = 0;

  balitaLogs.forEach((l) => {
    let usiaBln = l.usiaBulan !== undefined && l.usiaBulan >= 0 ? l.usiaBulan : -1;
    if (usiaBln < 0 && l.tanggalLahir) {
      const lahir = new Date(l.tanggalLahir);
      const periksa = l.tanggal ? new Date(l.tanggal) : new Date();
      usiaBln = Math.max(
        0,
        (periksa.getFullYear() - lahir.getFullYear()) * 12 +
          (periksa.getMonth() - lahir.getMonth())
      );
    }

    if (usiaBln >= 0) {
      if (usiaBln <= 6) {
        u0_6++;
        bayiAsiCount++;
        if (l.asiEksklusif) asiEksklusifCount++;
      } else if (usiaBln <= 12) {
        u7_12++;
      } else if (usiaBln <= 24) {
        u13_24++;
      } else {
        u25_60++;
      }
    } else {
      if (l.asiEksklusif) asiEksklusifCount++;
    }

    // Normalisasi kode status antropometri (termasuk fallback hitung dari BB, TB, Usia jika belum ada)
    const rawBbU = l.statusBbU || (l as any).statusBBU;
    const rawTbU = l.statusTbU || (l as any).statusTBU;
    const rawBbTb = l.statusBbTb || (l as any).statusBBTB;

    const codeBbU = normalizeStatusBbUCode(rawBbU, l.beratBadan, usiaBln, l.jenisKelamin);
    const codeTbU = normalizeStatusTbUCode(rawTbU, l.tinggiBadan, usiaBln, l.jenisKelamin);
    const codeBbTb = normalizeStatusBbTbCode(rawBbTb, l.beratBadan, l.tinggiBadan, l.jenisKelamin);

    // Hitung distribusi BB/U
    if (codeBbU === "N") countsBbU.normal++;
    else if (codeBbU === "K") countsBbU.kurang++;
    else if (codeBbU === "SK") countsBbU.sangatKurang++;
    else if (codeBbU === "L") countsBbU.lebih++;

    // Hitung distribusi TB/U
    if (codeTbU === "N") countsTbU.normal++;
    else if (codeTbU === "P") countsTbU.pendek++;
    else if (codeTbU === "SP") countsTbU.sangatPendek++;
    else if (codeTbU === "T") countsTbU.tinggi++;

    // Hitung distribusi BB/TB
    if (codeBbTb === "N") countsBbTb.normal++;
    else if (codeBbTb === "K") countsBbTb.kurang++;
    else if (codeBbTb === "SK") countsBbTb.sangatKurang++;
    else if (codeBbTb === "G") countsBbTb.lebih++;

    if (codeTbU === "P" || codeTbU === "SP") stuntingCount++;
    if (codeBbTb === "K" || codeBbTb === "SK") wastingCount++;

    // Cek indikator risiko / tindak lanjut
    const masalah: string[] = [];
    let saran = "Pemantauan rutin posyandu";

    if (codeTbU === "SP") {
      masalah.push("Sangat Pendek (Severe Stunting)");
      saran = "Rujukan Puskesmas & PMT Pemulihan Tinggi Protein";
    } else if (codeTbU === "P") {
      masalah.push("Pendek (Stunting)");
      saran = "Intervensi PMT Pemulihan & Konseling Sanitasi/Gizi";
    }

    if (codeBbTb === "SK") {
      masalah.push("Gizi Buruk (Severe Wasting)");
      saran = "Rujukan Segera ke Puskesmas / Rawat Inap";
    } else if (codeBbTb === "K") {
      masalah.push("Gizi Kurang (Wasting)");
      if (saran === "Pemantauan rutin posyandu") saran = "PMT Pemulihan 90 Hari & Edukasi MP-ASI";
    } else if (codeBbTb === "G") {
      masalah.push("Berisiko Gizi Lebih / Gemuk");
      if (saran === "Pemantauan rutin posyandu") saran = "Konseling Pola Makan Sehat & Aktivitas Fisik";
    }

    if (codeBbU === "SK") {
      masalah.push("BB Sangat Kurang");
    } else if (codeBbU === "K") {
      masalah.push("BB Kurang");
    }

    if (masalah.length > 0) {
      const usiaDisplay = usiaBln >= 0 ? `${usiaBln} bln` : "-";
      attentionList.push({
        id: l.id,
        pasienId: l.pasienId,
        nama: l.nama || "Balita",
        usia: usiaDisplay,
        masalah,
        tanggal: l.tanggal || "-",
        petugas: l.petugas || "Kader",
        saran,
      });
    }
  });

  return {
    periode: periodeText,
    totalPemeriksaan: balitaLogs.length,
    totalAnak: uniqueAnakCount,
    totalTerdaftar: finalTerdaftar,
    cakupanPersen,
    tidakHadir: tidakHadirCount,
    perluTindakLanjut: attentionList.length,
    kasusStunting: stuntingCount,
    kasusWasting: wastingCount,
    statusBbU: countsBbU,
    statusTbU: countsTbU,
    statusBbTb: countsBbTb,
    vitaminA: balitaLogs.filter((l) => l.vitaminA).length,
    imunisasiLengkap: balitaLogs.filter((l) => l.statusImunisasi && l.statusImunisasi !== "").length,
    obatCacing: balitaLogs.filter((l) => l.obatCacing).length,
    asiEksklusif: asiEksklusifCount,
    totalBayiAsiEligible: bayiAsiCount,
    distribusiUsia: {
      u0_6,
      u7_12,
      u13_24,
      u25_60,
    },
    balitaPerluPerhatianList: attentionList,
  };
}

export function calculateRekapanLansia(
  lansiaLogs: ItemRiwayat[],
  totalTerdaftar: number,
  periodeText: string
): RekapanLansia {
  if (lansiaLogs.length === 0) {
    return {
      periode: periodeText,
      totalPemeriksaan: 0,
      totalOrang: 0,
      totalTerdaftar,
      cakupanPersen: 0,
      tidakHadir: totalTerdaftar,
      perluFollowUp: 0,
      kasusHipertensi: 0,
      kasusDiabetes: 0,
      kasusMetabolik: 0,
      riwayat: { hipertensi: 0, diabetes: 0, keduanya: 0, tanpaRiwayat: 0 },
      statusTd: { normal: 0, prehipertensi: 0, hipertensi1: 0, hipertensi2: 0 },
      statusImt: { kurang: 0, normal: 0, berlebih: 0, obesitas: 0 },
      statusLingkarPerut: { normal: 0, berisiko: 0 },
      statusGds: { dalamTarget: 0, perluPantau: 0, tinggi: 0 },
      statusKolesterol: { normal: 0, tinggi: 0, diperiksa: 0 },
      statusAsamUrat: { normal: 0, tinggi: 0, diperiksa: 0 },
      rataRataBb: 0,
      rataRataTb: 0,
      rataRataSistol: 0,
      rataRataDiastol: 0,
      rataRataGds: 0,
      rataRataKolesterol: 0,
      rataRataAsamUrat: 0,
      rataRataLingkarPerut: 0,
      keluhanList: [],
      tindakanList: [],
      totalMendapatTindakan: 0,
      lansiaPerluPerhatianList: [],
    };
  }

  const totalPemeriksaan = lansiaLogs.length;
  const totalOrang = new Set(lansiaLogs.map((l) => l.pasienId || l.nik || l.nama)).size;
  const finalTerdaftar = totalTerdaftar > 0 ? totalTerdaftar : totalOrang;
  const cakupanPersen = finalTerdaftar > 0
    ? Number(((totalOrang / finalTerdaftar) * 100).toFixed(1))
    : 100;
  const tidakHadir = Math.max(0, finalTerdaftar - totalOrang);

  let riwayatHtCount = 0;
  let riwayatDmCount = 0;
  let riwayatKeduanyaCount = 0;
  let tanpaRiwayatCount = 0;

  const statusTd = { normal: 0, prehipertensi: 0, hipertensi1: 0, hipertensi2: 0 };
  let sumSistol = 0;
  let countSistol = 0;
  let sumDiastol = 0;
  let countDiastol = 0;

  const statusImt = { kurang: 0, normal: 0, berlebih: 0, obesitas: 0 };
  const statusLingkarPerut = { normal: 0, berisiko: 0 };
  let sumBb = 0;
  let countBb = 0;
  let sumTb = 0;
  let countTb = 0;
  let sumLp = 0;
  let countLp = 0;

  const statusGds = { dalamTarget: 0, perluPantau: 0, tinggi: 0 };
  let sumGds = 0;
  let countGds = 0;

  const statusKolesterol = { normal: 0, tinggi: 0, diperiksa: 0 };
  let sumKol = 0;

  const statusAsamUrat = { normal: 0, tinggi: 0, diperiksa: 0 };
  let sumAu = 0;

  const keluhanCounts: Record<string, number> = {};
  const tindakanCounts: Record<string, number> = {};
  let totalMendapatTindakan = 0;

  const attentionMap = new Map<string, LansiaPerluPerhatian>();

  lansiaLogs.forEach((log) => {
    const hasHt = log.riwayatHt === true;
    const hasDm = log.riwayatDm === true;
    if (hasHt && hasDm) riwayatKeduanyaCount++;
    else if (hasHt) riwayatHtCount++;
    else if (hasDm) riwayatDmCount++;
    else tanpaRiwayatCount++;

    const sistol = log.tekananDarahSistol || 0;
    const diastol = log.tekananDarahDiastol || 0;
    if (sistol > 0 || diastol > 0) {
      if (sistol > 0) { sumSistol += sistol; countSistol++; }
      if (diastol > 0) { sumDiastol += diastol; countDiastol++; }

      if (sistol >= 160 || diastol >= 100) statusTd.hipertensi2++;
      else if (sistol >= 140 || diastol >= 90) statusTd.hipertensi1++;
      else if (sistol >= 120 || diastol >= 80) statusTd.prehipertensi++;
      else statusTd.normal++;
    }

    const bb = log.beratBadan || 0;
    const tb = log.tinggiBadan || 0;
    if (bb > 0) { sumBb += bb; countBb++; }
    if (tb > 0) { sumTb += tb; countTb++; }
    if (bb > 0 && tb > 0) {
      const imt = bb / ((tb / 100) ** 2);
      if (imt < 18.5) statusImt.kurang++;
      else if (imt < 23.0) statusImt.normal++;
      else if (imt < 25.0) statusImt.berlebih++;
      else statusImt.obesitas++;
    }

    const lp = log.lingkarPerut || 0;
    const jk = (log.jenisKelamin || "").toUpperCase().startsWith("P") ? "P" : "L";
    if (lp > 0) {
      sumLp += lp;
      countLp++;
      const limit = jk === "P" ? 80 : 90;
      if (lp > limit) statusLingkarPerut.berisiko++;
      else statusLingkarPerut.normal++;
    }

    const gds = log.gulaDarahSewaktu || 0;
    if (gds > 0) {
      sumGds += gds;
      countGds++;
      if (gds < 140) statusGds.dalamTarget++;
      else if (gds < 200) statusGds.perluPantau++;
      else statusGds.tinggi++;
    }

    if (log.kolesterol !== undefined && log.kolesterol !== null && Number(log.kolesterol) > 0) {
      const kol = Number(log.kolesterol);
      statusKolesterol.diperiksa++;
      sumKol += kol;
      if (kol >= 200) statusKolesterol.tinggi++;
      else statusKolesterol.normal++;
    }

    if (log.asamUrat !== undefined && log.asamUrat !== null && Number(log.asamUrat) > 0) {
      const au = Number(log.asamUrat);
      statusAsamUrat.diperiksa++;
      sumAu += au;
      const limitAu = jk === "P" ? 6.0 : 7.0;
      if (au > limitAu) statusAsamUrat.tinggi++;
      else statusAsamUrat.normal++;
    }

    const rawKeluhan = (log.keluhan || "").trim().toLowerCase();
    if (rawKeluhan && rawKeluhan !== "-" && rawKeluhan !== "tidak ada") {
      let cat = "Keluhan Lainnya";
      if (/pegal|sendi|linu|rematik|nyeri lutut|encok/.test(rawKeluhan)) cat = "Pegal / Nyeri Sendi";
      else if (/pusing|sakit kepala|migrain|kleyengan/.test(rawKeluhan)) cat = "Pusing / Sakit Kepala";
      else if (/lelah|lemas|capek|letih/.test(rawKeluhan)) cat = "Mudah Lelah / Lemas";
      else if (/pinggang|punggung/.test(rawKeluhan)) cat = "Nyeri Punggung / Pinggang";
      else if (/batuk|sesak|pilek|napas|flu/.test(rawKeluhan)) cat = "Batuk / Gangguan Napas";
      else if (/mata|kabur/.test(rawKeluhan)) cat = "Penglihatan Kabur";
      keluhanCounts[cat] = (keluhanCounts[cat] || 0) + 1;
    }

    const rawTindakan = (log.tindakan || "").trim().toLowerCase();
    if (rawTindakan && rawTindakan !== "-" && rawTindakan !== "tidak ada") {
      totalMendapatTindakan++;
      let catT = "Edukasi & Pemantauan";
      if (/konseling|gizi|makan|diet|nutrisi/.test(rawTindakan)) catT = "Konseling Pola Makan & Gizi";
      else if (/pantau|monitoring|kontrol|rutin/.test(rawTindakan)) catT = "Monitoring / Pemantauan Rutin";
      else if (/rujuk|puskesmas|faskes|rs/.test(rawTindakan)) catT = "Rujukan Puskesmas / Faskes";
      else if (/obat|vitamin|terapi|farmasi/.test(rawTindakan)) catT = "Pemberian Vitamin / Terapi";
      else if (/senam|olahraga|aktivitas/.test(rawTindakan)) catT = "Edukasi Aktivitas Fisik";
      tindakanCounts[catT] = (tindakanCounts[catT] || 0) + 1;
    }

    const temuan: string[] = [];
    const isHt2 = sistol >= 160 || diastol >= 100;
    const isHt1 = (sistol >= 140 || diastol >= 90) && !isHt2;
    const isGdsTinggi = gds >= 200;
    const isGdsWaspada = gds >= 140 && gds < 200;
    const kol = Number(log.kolesterol || 0);
    const isKolTinggi = kol >= 200;
    const au = Number(log.asamUrat || 0);
    const isAuTinggi = au > (jk === "P" ? 6.0 : 7.0);
    const isObesitasSentral = lp > (jk === "P" ? 80 : 90);

    if (isHt2) temuan.push(`TD: ${sistol}/${diastol} (HT Derajat 2)`);
    else if (isHt1) temuan.push(`TD: ${sistol}/${diastol} (HT Derajat 1)`);

    if (isGdsTinggi) temuan.push(`GDS: ${gds} mg/dL (Tinggi)`);
    else if (isGdsWaspada) temuan.push(`GDS: ${gds} mg/dL (Perlu Pantau)`);

    if (isKolTinggi) temuan.push(`Kolesterol: ${kol} mg/dL`);
    if (isAuTinggi) temuan.push(`Asam Urat: ${au} mg/dL`);
    if (isObesitasSentral) temuan.push(`Obesitas Sentral (${lp} cm)`);

    let usiaTahun = "-";
    if (log.tanggalLahir) {
      const lahir = new Date(log.tanggalLahir);
      const sekarang = new Date();
      usiaTahun = Math.floor((sekarang.getTime() - lahir.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) + " Thn";
    } else if ((log as any).usiaInfo) {
      usiaTahun = (log as any).usiaInfo;
    }

    if (temuan.length > 0) {
      const key = log.pasienId || log.nik || log.nama;
      let saran = "Konseling Pola Hidup & Monitoring Berkala";
      if (isHt2 || isGdsTinggi) {
        saran = "Segera Rujuk Puskesmas untuk Evaluasi Dokter";
      } else if (isKolTinggi || isAuTinggi) {
        saran = "Pemeriksaan Lab Lanjutan & Diet Rendah Lemak/Purin";
      } else if (isHt1) {
        saran = "Kontrol Tekanan Darah Rutin & Kurangi Asupan Garam";
      } else if (isObesitasSentral) {
        saran = "Konseling Pengaturan Pola Makan & Aktivitas Fisik Ringan";
      }

      attentionMap.set(key, {
        id: log.id,
        pasienId: log.pasienId,
        nama: log.nama,
        nik: log.nik,
        usia: usiaTahun,
        jenisKelamin: jk === "P" ? "Perempuan" : "Laki-laki",
        temuan,
        keluhan: log.keluhan || "-",
        tanggal: log.tanggal,
        petugas: log.petugas || "Kader",
        saran,
      });
    }
  });

  const keluhanList = Object.entries(keluhanCounts)
    .map(([nama, count]) => ({
      nama,
      count,
      persen: totalPemeriksaan > 0 ? Number(((count / totalPemeriksaan) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const tindakanList = Object.entries(tindakanCounts)
    .map(([nama, count]) => ({
      nama,
      count,
      persen: totalPemeriksaan > 0 ? Number(((count / totalPemeriksaan) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totalHipertensi = statusTd.hipertensi1 + statusTd.hipertensi2;
  const totalDiabetes = statusGds.tinggi;
  const totalMetabolik = attentionMap.size;

  return {
    periode: periodeText,
    totalPemeriksaan,
    totalOrang,
    totalTerdaftar: finalTerdaftar,
    cakupanPersen,
    tidakHadir,
    perluFollowUp: attentionMap.size,
    kasusHipertensi: totalHipertensi,
    kasusDiabetes: totalDiabetes,
    kasusMetabolik: totalMetabolik,
    riwayat: {
      hipertensi: riwayatHtCount + riwayatKeduanyaCount,
      diabetes: riwayatDmCount + riwayatKeduanyaCount,
      keduanya: riwayatKeduanyaCount,
      tanpaRiwayat: tanpaRiwayatCount,
    },
    statusTd,
    statusImt,
    statusLingkarPerut,
    statusGds,
    statusKolesterol,
    statusAsamUrat,
    rataRataBb: countBb > 0 ? Number((sumBb / countBb).toFixed(1)) : 0,
    rataRataTb: countTb > 0 ? Number((sumTb / countTb).toFixed(1)) : 0,
    rataRataSistol: countSistol > 0 ? Math.round(sumSistol / countSistol) : 0,
    rataRataDiastol: countDiastol > 0 ? Math.round(sumDiastol / countDiastol) : 0,
    rataRataGds: countGds > 0 ? Math.round(sumGds / countGds) : 0,
    rataRataKolesterol: statusKolesterol.diperiksa > 0 ? Math.round(sumKol / statusKolesterol.diperiksa) : 0,
    rataRataAsamUrat: statusAsamUrat.diperiksa > 0 ? Number((sumAu / statusAsamUrat.diperiksa).toFixed(1)) : 0,
    rataRataLingkarPerut: countLp > 0 ? Number((sumLp / countLp).toFixed(1)) : 0,
    keluhanList,
    tindakanList,
    totalMendapatTindakan,
    lansiaPerluPerhatianList: Array.from(attentionMap.values()),
  };
}
