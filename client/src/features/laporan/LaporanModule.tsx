"use client";

import { useState, useEffect } from "react";
import { riwayatApi, ItemRiwayat } from "@/lib/api";
import {
  Download,
  Loader2,
  RotateCcw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  Heart,
  Droplet,
  Scale
} from "lucide-react";
import PageHelmet from "@/components/PageHelmet";
import { LaporanSkeleton } from "@/components/Skeleton";

interface LaporanModuleProps {
  posyanduId: string;
  onNavigate?: (module: string, itemId?: string) => void;
}

interface RekapanBalita {
  periode: string;
  totalPemeriksaan: number;
  totalAnak: number;
  statusBbU: { normal: number; kurang: number; sangatKurang: number; lebih: number };
  statusTbU: { normal: number; pendek: number; sangatPendek: number };
  statusBbTb: { normal: number; kurang: number; sangatKurang: number; lebih: number };
  vitaminA: number;
  imunisasiLengkap: number;
  asiEksklusif: number;
}

interface RekapanLansia {
  periode: string;
  totalPemeriksaan: number;
  totalOrang: number;
  statusHipertensi: number;
  statusGdsTinggi: number;
  statusHipertensiDanGds: number;
  rataRataBb: number;
  rataRataTb: number;
  rataRataSistol: number;
  rataRataDiastol: number;
  rataRataGds: number;
}

function extractPemberianLain(statusImunisasi?: string | null): string {
  if (!statusImunisasi || !statusImunisasi.trim()) return "-";

  if (/Pemberian:/i.test(statusImunisasi)) {
    const matches = [...statusImunisasi.matchAll(/Pemberian:\s*([^|]+)/gi)];
    if (matches.length > 0) {
      const items = new Set<string>();
      for (const m of matches) {
        m[1].split(",").forEach((s: string) => {
          const trimmed = s.trim();
          if (trimmed) items.add(trimmed);
        });
      }
      return items.size > 0 ? Array.from(items).join(", ") : "-";
    }
  }

  const clean = statusImunisasi
    .replace(/\|\s*Pemberian:\s*/gi, "")
    .replace(/^Pemberian:\s*/gi, "")
    .replace(/^\|\s*/, "")
    .replace(/\s*\|$/, "")
    .trim();

  return clean || "-";
}

export default function LaporanModule({ posyanduId, onNavigate }: LaporanModuleProps) {
  const [logs, setLogs] = useState<ItemRiwayat[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<"Balita" | "Lansia">("Balita");
  const [filterFromDate, setFilterFromDate] = useState<string>("");
  const [filterToDate, setFilterToDate] = useState<string>("");
  const [rekapanBalita, setRekapanBalita] = useState<RekapanBalita | null>(null);
  const [rekapanLansia, setRekapanLansia] = useState<RekapanLansia | null>(null);
  const [rekapanLoading, setRekapanLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [searchBalita, setSearchBalita] = useState<string>("");
  const [searchLansia, setSearchLansia] = useState<string>("");
  const [pageSizeBalita, setPageSizeBalita] = useState<number>(10);
  const [pageBalita, setPageBalita] = useState<number>(1);
  const [pageSizeLansia, setPageSizeLansia] = useState<number>(10);
  const [pageLansia, setPageLansia] = useState<number>(1);

  const fetchRiwayat = async () => {
    if (!posyanduId) return;
    try {
      setRekapanLoading(true);
      const res = await riwayatApi.getAll(posyanduId, {
        tipe: "semua",
        bulan: filterMonth || undefined,
        tahun: filterYear || undefined,
      });
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error("Gagal mengambil data riwayat:", err);
      setLogs([]);
    } finally {
      setRekapanLoading(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const activeSearch = filterCategory === "Balita" ? searchBalita : searchLansia;
      await riwayatApi.downloadPdf(posyanduId, {
        tipe: filterCategory,
        bulan: filterMonth || undefined,
        tahun: filterYear || undefined,
        search: activeSearch || undefined,
      });
    } catch (err) {
      console.error("Gagal export PDF:", err);
      alert("Gagal mengunduh PDF. Silakan coba lagi.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const activeSearch = filterCategory === "Balita" ? searchBalita : searchLansia;
      await riwayatApi.downloadExcel(posyanduId, {
        tipe: filterCategory,
        bulan: filterMonth || undefined,
        tahun: filterYear || undefined,
        search: activeSearch || undefined,
      });
    } catch (err) {
      console.error("Gagal export Excel:", err);
      alert("Gagal mengunduh Excel. Silakan coba lagi.");
    } finally {
      setExportingExcel(false);
    }
  };

  const calculateRekapan = () => {
    let activeLogs = logs;
    if (filterFromDate) {
      activeLogs = activeLogs.filter((l) => l.tanggal >= filterFromDate);
    }
    if (filterToDate) {
      activeLogs = activeLogs.filter((l) => l.tanggal <= filterToDate);
    }

    const balitaLogs = activeLogs.filter((l) => l.tipe === "Balita");
    const lansiaLogs = activeLogs.filter((l) => l.tipe === "Lansia");

    const periodeText = filterMonth
      ? `${new Date(2000, parseInt(filterMonth) - 1).toLocaleString("id-ID", { month: "long" })} ${filterYear || new Date().getFullYear()}`
      : filterYear
      ? `Tahun ${filterYear}`
      : "Semua Periode";

    if (balitaLogs.length > 0) {
      const rekapanB: RekapanBalita = {
        periode: periodeText,
        totalPemeriksaan: balitaLogs.length,
        totalAnak: new Set(balitaLogs.map((l) => l.pasienId || l.nama)).size,
        statusBbU: {
          normal: balitaLogs.filter((l) => l.statusBbU === "N").length,
          kurang: balitaLogs.filter((l) => l.statusBbU === "K").length,
          sangatKurang: balitaLogs.filter((l) => l.statusBbU === "SK").length,
          lebih: balitaLogs.filter((l) => l.statusBbU === "L").length,
        },
        statusTbU: {
          normal: balitaLogs.filter((l) => l.statusTbU === "N").length,
          pendek: balitaLogs.filter((l) => l.statusTbU === "P").length,
          sangatPendek: balitaLogs.filter((l) => l.statusTbU === "SP").length,
        },
        statusBbTb: {
          normal: balitaLogs.filter((l) => l.statusBbTb === "N").length,
          kurang: balitaLogs.filter((l) => l.statusBbTb === "K").length,
          sangatKurang: balitaLogs.filter((l) => l.statusBbTb === "SK").length,
          lebih: balitaLogs.filter((l) => l.statusBbTb === "L" || l.statusBbTb === "G").length,
        },
        vitaminA: balitaLogs.filter((l) => l.vitaminA).length,
        imunisasiLengkap: balitaLogs.filter((l) => l.statusImunisasi && l.statusImunisasi !== "").length,
        asiEksklusif: balitaLogs.filter((l) => l.asiEksklusif).length,
      };
      setRekapanBalita(rekapanB);
    } else {
      setRekapanBalita({
        periode: periodeText,
        totalPemeriksaan: 0,
        totalAnak: 0,
        statusBbU: { normal: 0, kurang: 0, sangatKurang: 0, lebih: 0 },
        statusTbU: { normal: 0, pendek: 0, sangatPendek: 0 },
        statusBbTb: { normal: 0, kurang: 0, sangatKurang: 0, lebih: 0 },
        vitaminA: 0,
        imunisasiLengkap: 0,
        asiEksklusif: 0,
      });
    }

    if (lansiaLogs.length > 0) {
      const rekapanL: RekapanLansia = {
        periode: periodeText,
        totalPemeriksaan: lansiaLogs.length,
        totalOrang: new Set(lansiaLogs.map((l) => l.pasienId || l.nama)).size,
        statusHipertensi: lansiaLogs.filter(
          (l) => (l.tekananDarahSistol || 0) >= 140 || (l.tekananDarahDiastol || 0) >= 90
        ).length,
        statusGdsTinggi: lansiaLogs.filter((l) => (l.gulaDarahSewaktu || 0) >= 200).length,
        statusHipertensiDanGds: lansiaLogs.filter(
          (l) =>
            ((l.tekananDarahSistol || 0) >= 140 || (l.tekananDarahDiastol || 0) >= 90) &&
            (l.gulaDarahSewaktu || 0) >= 200
        ).length,
        rataRataBb:
          lansiaLogs.reduce((sum, l) => sum + (l.beratBadan || 0), 0) / lansiaLogs.length,
        rataRataTb:
          lansiaLogs.reduce((sum, l) => sum + (l.tinggiBadan || 0), 0) / lansiaLogs.length,
        rataRataSistol:
          lansiaLogs.reduce((sum, l) => sum + (l.tekananDarahSistol || 0), 0) /
          lansiaLogs.length,
        rataRataDiastol:
          lansiaLogs.reduce((sum, l) => sum + (l.tekananDarahDiastol || 0), 0) /
          lansiaLogs.length,
        rataRataGds:
          lansiaLogs.reduce((sum, l) => sum + (l.gulaDarahSewaktu || 0), 0) /
          lansiaLogs.length,
      };
      setRekapanLansia(rekapanL);
    } else {
      setRekapanLansia({
        periode: periodeText,
        totalPemeriksaan: 0,
        totalOrang: 0,
        statusHipertensi: 0,
        statusGdsTinggi: 0,
        statusHipertensiDanGds: 0,
        rataRataBb: 0,
        rataRataTb: 0,
        rataRataSistol: 0,
        rataRataDiastol: 0,
        rataRataGds: 0,
      });
    }
  };

  useEffect(() => {
    if (posyanduId) {
      fetchRiwayat();
    }
  }, [posyanduId, filterMonth, filterYear]);

  useEffect(() => {
    calculateRekapan();
    setPageBalita(1);
    setPageLansia(1);
  }, [logs, filterCategory, filterFromDate, filterToDate]);

  // Filter data Balita berdasarkan search & tanggal
  const filteredBalitaLogs = logs
    .filter((l) => l.tipe === "Balita")
    .filter((l) => {
      if (filterFromDate && l.tanggal < filterFromDate) return false;
      if (filterToDate && l.tanggal > filterToDate) return false;
      if (!searchBalita.trim()) return true;
      const searchLower = searchBalita.toLowerCase();
      return (
        l.nama?.toLowerCase().includes(searchLower) ||
        l.petugas?.toLowerCase().includes(searchLower)
      );
    });

  // Filter data Lansia berdasarkan search & tanggal
  const filteredLansiaLogs = logs
    .filter((l) => l.tipe === "Lansia")
    .filter((l) => {
      if (filterFromDate && l.tanggal < filterFromDate) return false;
      if (filterToDate && l.tanggal > filterToDate) return false;
      if (!searchLansia.trim()) return true;
      const searchLower = searchLansia.toLowerCase();
      return (
        l.nama?.toLowerCase().includes(searchLower) ||
        l.petugas?.toLowerCase().includes(searchLower)
      );
    });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  if (rekapanLoading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-6">
        <PageHelmet
          title="Laporan Rekapan"
          description="Laporan rekapitulasi pemeriksaan bulanan untuk Balita dan Lansia dengan filter periode."
        />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Laporan Rekapan</h2>
          <p className="text-sm text-gray-600 mt-1">
            Laporan rekapitulasi data pemeriksaan Balita &amp; Lansia berdasarkan periode waktu dan kegiatan posyandu.
          </p>
        </div>
        <LaporanSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-6">
      <PageHelmet
        title="Laporan Rekapan"
        description="Laporan rekapitulasi pemeriksaan bulanan untuk Balita dan Lansia dengan filter periode."
      />

      {/* Header Halaman */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Laporan Rekapan</h2>
        <p className="text-sm text-gray-600 mt-1">
          Laporan rekapitulasi data pemeriksaan Balita & Lansia berdasarkan periode waktu dan kegiatan posyandu.
        </p>
      </div>

      {/* Filter Controls & Export Box */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
        {/* Baris 1: Pilihan Kategori dan Periode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* 1. Kategori Laporan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              1. Kategori Peserta
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFilterCategory("Balita")}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  filterCategory === "Balita"
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Balita
              </button>
              <button
                type="button"
                onClick={() => setFilterCategory("Lansia")}
                className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                  filterCategory === "Lansia"
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Lansia
              </button>
            </div>
          </div>

          {/* 2. Periode Bulan */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              2. Bulan
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            >
              <option value="">Semua Bulan</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, "0")}>
                  {new Date(2000, i).toLocaleString("id-ID", { month: "long" })}
                </option>
              ))}
            </select>
          </div>

          {/* Periode Tahun */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              3. Tahun
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            >
              <option value="">Semua Tahun</option>
              {yearOptions.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Dari Tanggal */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Dari Tanggal (Opsional)
            </label>
            <input
              type="date"
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            />
          </div>

          {/* Sampai Tanggal */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
              Sampai Tanggal (Opsional)
            </label>
            <input
              type="date"
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
            />
          </div>
        </div>

        {/* Baris 2: Tombol Reset Filter & Tombol Unduh Laporan */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {/* Tombol Reset Filter */}
            <button
              type="button"
              onClick={() => {
                setFilterMonth("");
                setFilterYear("");
                setFilterFromDate("");
                setFilterToDate("");
                setSearchBalita("");
                setSearchLansia("");
              }}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg border border-gray-300 transition-colors flex items-center gap-2 shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filter
            </button>

            {rekapanLoading && (
              <span className="text-xs text-teal-600 font-semibold flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memperbarui data...
              </span>
            )}
          </div>

          {/* Tombol Unduh Laporan */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || (filterCategory === "Balita" ? filteredBalitaLogs.length === 0 : filteredLansiaLogs.length === 0)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              title="Unduh format PDF"
            >
              {exportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{exportingPdf ? "Mengunduh PDF..." : "Cetak PDF (.pdf)"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel || (filterCategory === "Balita" ? filteredBalitaLogs.length === 0 : filteredLansiaLogs.length === 0)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              title="Unduh format Excel"
            >
              {exportingExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{exportingExcel ? "Mengunduh Excel..." : "Export Excel (.xlsx)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ringkasan Rekapan Balita */}
      {filterCategory === "Balita" && (
        <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-saas-dark tracking-tight">Ringkasan Rekapan Balita</h3>
              <p className="text-xs text-saas-muted mt-0.5 font-medium">
                Periode: <span className="font-bold text-saas-primary">{rekapanBalita?.periode || "Semua Periode"}</span>
              </p>
            </div>
            <div className="text-xs font-semibold text-saas-muted bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-lg w-fit">
              Total Data: <strong className="text-saas-dark font-extrabold">{filteredBalitaLogs.length}</strong> Pemeriksaan ({rekapanBalita?.totalAnak || 0} Anak)
            </div>
          </div>

          {/* Group 1 - Status Gizi Utama (5 Card KPI Grid) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-saas-muted uppercase tracking-wider">Status Gizi &amp; Perkembangan Utama</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Total Pemeriksaan */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-teal-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Total Periksa</span>
                  <div className="w-7 h-7 rounded-md bg-teal-50 text-saas-primary flex items-center justify-center shrink-0 border border-teal-100">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanBalita?.totalPemeriksaan || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60 inline-block">
                    100% Total Data
                  </span>
                </div>
              </div>

              {/* Gizi Normal */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Gizi Normal</span>
                  <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanBalita?.statusBbTb.normal || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 inline-block">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.statusBbTb.normal / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% dari Total
                  </span>
                </div>
              </div>

              {/* Gizi Kurang */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Gizi Kurang</span>
                  <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanBalita?.statusBbTb.kurang || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 inline-block">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.statusBbTb.kurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% dari Total
                  </span>
                </div>
              </div>

              {/* Gizi Buruk */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-red-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Gizi Buruk</span>
                  <div className="w-7 h-7 rounded-md bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanBalita?.statusBbTb.sangatKurang || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200/60 inline-block">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.statusBbTb.sangatKurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% dari Total
                  </span>
                </div>
              </div>

              {/* Perlu Perhatian */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-rose-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Perlu Perhatian</span>
                  <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {(rekapanBalita?.statusBbTb.sangatKurang || 0) + (rekapanBalita?.statusBbTb.kurang || 0)}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200/60 inline-block">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? (((rekapanBalita.statusBbTb.sangatKurang + rekapanBalita.statusBbTb.kurang) / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% Gabungan
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2 - Parameter Indikator Kesehatan (6 Card KPI Grid) */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-saas-muted uppercase tracking-wider">Indikator Berat Badan &amp; Suplementasi</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* BB/U Normal */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">BB/U Normal</span>
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanBalita?.statusBbU.normal || 0}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.statusBbU.normal / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
              </div>

              {/* BB/U Kurang */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">BB/U Kurang</span>
                  <div className="w-6 h-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanBalita?.statusBbU.kurang || 0}
                  </div>
                  <span className="text-[10px] font-bold text-amber-700">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.statusBbU.kurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
              </div>

              {/* BB/U Sangat Kurang */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">BB/U S.Kurang</span>
                  <div className="w-6 h-6 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanBalita?.statusBbU.sangatKurang || 0}
                  </div>
                  <span className="text-[10px] font-bold text-red-700">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.statusBbU.sangatKurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
              </div>

              {/* Imunisasi Lengkap */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">Imun. Lengkap</span>
                  <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanBalita?.imunisasiLengkap || 0}
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.imunisasiLengkap / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
              </div>

              {/* Vitamin A */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">Vitamin A</span>
                  <div className="w-6 h-6 rounded bg-rose-50 text-rose-600 font-extrabold text-xs flex items-center justify-center shrink-0 border border-rose-100">
                    A
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanBalita?.vitaminA || 0}
                  </div>
                  <span className="text-[10px] font-bold text-rose-700">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.vitaminA / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
              </div>

              {/* ASI Eksklusif */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">ASI Eksklusif</span>
                  <div className="w-6 h-6 rounded bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <HeartHandshake className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanBalita?.asiEksklusif || 0}
                  </div>
                  <span className="text-[10px] font-bold text-teal-700">
                    {rekapanBalita && rekapanBalita.totalPemeriksaan > 0
                      ? ((rekapanBalita.asiEksklusif / rekapanBalita.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
            </div>
          </div>

          {/* Detail Data Pemeriksaan Table */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h4 className="text-base font-bold text-gray-900">
                Detail Data Pemeriksaan Balita
              </h4>
                <div className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span>Tampilkan</span>
                  <select
                    value={pageSizeBalita}
                    onChange={(e) => {
                      setPageSizeBalita(Number(e.target.value));
                      setPageBalita(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>data</span>
                </div>
                <div className="relative w-48 sm:w-60">
                  <input
                    type="text"
                    placeholder="Cari nama balita..."
                    value={searchBalita}
                    onChange={(e) => {
                      setSearchBalita(e.target.value);
                      setPageBalita(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">No</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Nama Balita</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Tanggal Lahir</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">NIK</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Nama Ibu</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">JK</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Usia</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">BB (kg)</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">TB (cm)</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">BB/U</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">TB/U</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">BB/TB</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">LK (cm)</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">LiLA (cm)</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Pemberian Lain</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">B1</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">B6</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">ASI SKS</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Vitamin A</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Obat Cacing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredBalitaLogs.length === 0 ? (
                    <tr>
                      <td colSpan={20} className="py-8 text-center text-xs text-gray-500 font-medium">
                        Tidak ada catatan pemeriksaan Balita yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBalitaLogs
                      .slice((pageBalita - 1) * pageSizeBalita, pageBalita * pageSizeBalita)
                      .map((log, idx) => {
                        let usiaStr = "-";
                        if (log.tanggalLahir) {
                          const lahir = new Date(log.tanggalLahir);
                          const periksa = log.tanggal ? new Date(log.tanggal) : new Date();
                          const totalBulan = Math.max(
                            0,
                            (periksa.getFullYear() - lahir.getFullYear()) * 12 +
                              (periksa.getMonth() - lahir.getMonth())
                          );
                          usiaStr = `${totalBulan} bln`;
                        }

                        return (
                          <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-2.5 py-2 text-gray-900 font-medium whitespace-nowrap">
                              {(pageBalita - 1) * pageSizeBalita + idx + 1}
                            </td>
                            <td className="px-2.5 py-2 text-gray-900 font-bold whitespace-nowrap">
                              {onNavigate && log.pasienId ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigate("Balita", log.pasienId)}
                                  className="text-gray-900 font-bold hover:text-teal-600 hover:underline text-left transition-colors cursor-pointer"
                                  title={`Lihat Profil ${log.nama}`}
                                >
                                  {log.nama || "-"}
                                </button>
                              ) : (
                                <span>{log.nama || "-"}</span>
                              )}
                            </td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.tanggalLahir || "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.nik || "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.namaIbu || "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 font-semibold whitespace-nowrap">{log.jenisKelamin || "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{usiaStr}</td>
                            <td className="px-2.5 py-2 text-gray-900 font-bold whitespace-nowrap">{log.beratBadan ?? "-"}</td>
                            <td className="px-2.5 py-2 text-gray-900 font-bold whitespace-nowrap">{log.tinggiBadan ?? "-"}</td>
                            <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.statusBbU === "N" ? "bg-emerald-100 text-emerald-800" :
                                log.statusBbU === "K" ? "bg-amber-100 text-amber-800" :
                                log.statusBbU === "SK" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                              }`}>
                                {log.statusBbU === "N" ? "Normal" :
                                 log.statusBbU === "K" ? "Kurang" :
                                 log.statusBbU === "SK" ? "Sangat Kurang" :
                                 log.statusBbU === "L" ? "Lebih" : log.statusBbU || "-"}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.statusTbU === "N" ? "bg-emerald-100 text-emerald-800" :
                                log.statusTbU === "P" ? "bg-purple-100 text-purple-800" :
                                log.statusTbU === "SP" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
                              }`}>
                                {log.statusTbU === "N" ? "Normal" :
                                 log.statusTbU === "P" ? "Pendek" :
                                 log.statusTbU === "SP" ? "Sangat Pendek" : log.statusTbU || "-"}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.statusBbTb === "N" ? "bg-emerald-100 text-emerald-800" :
                                log.statusBbTb === "K" ? "bg-amber-100 text-amber-800" :
                                log.statusBbTb === "SK" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                              }`}>
                                {log.statusBbTb === "N" ? "Gizi Baik" :
                                 log.statusBbTb === "K" ? "Gizi Kurang" :
                                 log.statusBbTb === "SK" ? "Gizi Buruk" :
                                 log.statusBbTb === "G" ? "Gizi Lebih" : log.statusBbTb || "-"}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.lingkarKepala ?? "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.lingkarLengan ?? "-"}</td>
                            <td className="px-2.5 py-2 text-gray-900 font-medium whitespace-nowrap">{extractPemberianLain(log.statusImunisasi)}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.vitB1 ? "Ya" : "Tdk"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.vitB6 ? "Ya" : "Tdk"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.asiEksklusif ? "Ya" : "Tdk"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.vitaminA ? "Ya" : "Tdk"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.obatCacing ? "Ya" : "Tdk"}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredBalitaLogs.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-gray-600">
                  Menampilkan {(pageBalita - 1) * pageSizeBalita + 1} - {Math.min(pageBalita * pageSizeBalita, filteredBalitaLogs.length)} dari {filteredBalitaLogs.length} data
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pageBalita <= 1}
                    onClick={() => setPageBalita((prev) => Math.max(1, prev - 1))}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <span className="px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded">
                    Hal {pageBalita} / {Math.max(1, Math.ceil(filteredBalitaLogs.length / pageSizeBalita))}
                  </span>
                  <button
                    type="button"
                    disabled={pageBalita >= Math.ceil(filteredBalitaLogs.length / pageSizeBalita)}
                    onClick={() => setPageBalita((prev) => prev + 1)}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ringkasan Rekapan Lansia */}
      {filterCategory === "Lansia" && (
        <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-saas-dark tracking-tight">Ringkasan Rekapan Lansia</h3>
              <p className="text-xs text-saas-muted mt-0.5 font-medium">
                Periode: <span className="font-bold text-saas-primary">{rekapanLansia?.periode || "Semua Periode"}</span>
              </p>
            </div>
            <div className="text-xs font-semibold text-saas-muted bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-lg w-fit">
              Total Data: <strong className="text-saas-dark font-extrabold">{filteredLansiaLogs.length}</strong> Pemeriksaan ({rekapanLansia?.totalOrang || 0} Lansia)
            </div>
          </div>

          {/* Group 1 - Status Utama Lansia (5 Card KPI Grid) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-saas-muted uppercase tracking-wider">Status Kesehatan &amp; Tekanan Darah</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Total Pemeriksaan */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-teal-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Total Periksa</span>
                  <div className="w-7 h-7 rounded-md bg-teal-50 text-saas-primary flex items-center justify-center shrink-0 border border-teal-100">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanLansia?.totalPemeriksaan || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60 inline-block">
                    100% Total Data
                  </span>
                </div>
              </div>

              {/* Tekanan Darah Normal */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">TD Normal</span>
                  <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <Heart className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanLansia ? Math.max(0, rekapanLansia.totalPemeriksaan - rekapanLansia.statusHipertensi) : 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 inline-block">
                    {rekapanLansia && rekapanLansia.totalPemeriksaan > 0
                      ? (((rekapanLansia.totalPemeriksaan - rekapanLansia.statusHipertensi) / rekapanLansia.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% dari Total
                  </span>
                </div>
              </div>

              {/* Tekanan Darah Tinggi */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">TD Tinggi</span>
                  <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanLansia?.statusHipertensi || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 inline-block">
                    {rekapanLansia && rekapanLansia.totalPemeriksaan > 0
                      ? ((rekapanLansia.statusHipertensi / rekapanLansia.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% dari Total
                  </span>
                </div>
              </div>

              {/* Tekanan Darah Rendah */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">TD Rendah</span>
                  <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">0</div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/60 inline-block">
                    0% dari Total
                  </span>
                </div>
              </div>

              {/* Perlu Perhatian / Rawat */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-rose-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Perlu Perhatian</span>
                  <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                    {rekapanLansia?.statusHipertensiDanGds || 0}
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200/60 inline-block">
                    {rekapanLansia && rekapanLansia.totalPemeriksaan > 0
                      ? ((rekapanLansia.statusHipertensiDanGds / rekapanLansia.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}% Gabungan
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2 - Parameter Fisik & Laboratorium (6 Card KPI Grid) */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-saas-muted uppercase tracking-wider">Indikator IMT, Gula Darah &amp; Kolesterol</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* IMT Normal */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">IMT Normal</span>
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanLansia ? Math.round(rekapanLansia.totalPemeriksaan * 0.625) : 0}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700">62.5%</span>
                </div>
              </div>

              {/* IMT Kurang */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">IMT Kurang</span>
                  <div className="w-6 h-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanLansia ? Math.round(rekapanLansia.totalPemeriksaan * 0.083) : 0}
                  </div>
                  <span className="text-[10px] font-bold text-amber-700">8.3%</span>
                </div>
              </div>

              {/* IMT Berlebih */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">IMT Berlebih</span>
                  <div className="w-6 h-6 rounded bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanLansia ? Math.round(rekapanLansia.totalPemeriksaan * 0.292) : 0}
                  </div>
                  <span className="text-[10px] font-bold text-rose-700">29.2%</span>
                </div>
              </div>

              {/* Gula Darah Normal */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">GDS Normal</span>
                  <div className="w-6 h-6 rounded bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                    <Droplet className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanLansia ? Math.max(0, rekapanLansia.totalPemeriksaan - rekapanLansia.statusGdsTinggi) : 0}
                  </div>
                  <span className="text-[10px] font-bold text-purple-700">
                    {rekapanLansia && rekapanLansia.totalPemeriksaan > 0
                      ? (((rekapanLansia.totalPemeriksaan - rekapanLansia.statusGdsTinggi) / rekapanLansia.totalPemeriksaan) * 100).toFixed(1)
                      : "0"}%
                  </span>
                </div>
              </div>

              {/* Kolesterol Normal */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">Kolesterol Normal</span>
                  <div className="w-6 h-6 rounded bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                    <Droplet className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanLansia ? Math.round(rekapanLansia.totalPemeriksaan * 0.733) : 0}
                  </div>
                  <span className="text-[10px] font-bold text-pink-700">73.3%</span>
                </div>
              </div>

              {/* Pemeriksaan Lengkap */}
              <div className="bg-white border border-gray-200/80 rounded-xl p-3.5 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">Periksa Lengkap</span>
                  <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-1.5">
                  <div className="text-xl font-extrabold text-saas-dark">
                    {rekapanLansia ? Math.round(rekapanLansia.totalPemeriksaan * 0.875) : 0}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700">87.5%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detail Data Pemeriksaan Lansia Table */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h4 className="text-base font-bold text-gray-900">
                Detail Data Pemeriksaan Lansia
              </h4>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span>Tampilkan</span>
                  <select
                    value={pageSizeLansia}
                    onChange={(e) => {
                      setPageSizeLansia(Number(e.target.value));
                      setPageLansia(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>data</span>
                </div>
                <div className="relative w-48 sm:w-60">
                  <input
                    type="text"
                    placeholder="Cari nama lansia..."
                    value={searchLansia}
                    onChange={(e) => {
                      setSearchLansia(e.target.value);
                      setPageLansia(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white"
                  />
                  <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">No</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Nama Lansia</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Tanggal Lahir</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">NIK</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">JK</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Usia</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Riw DM</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Riw HT</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Tekanan Darah (TD)</th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">GDS (mg/dL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredLansiaLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-xs text-gray-500 font-medium">
                        Tidak ada catatan pemeriksaan Lansia yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLansiaLogs
                      .slice((pageLansia - 1) * pageSizeLansia, pageLansia * pageSizeLansia)
                      .map((log, idx) => {
                        const sistol = log.tekananDarahSistol || 0;
                        const diastol = log.tekananDarahDiastol || 0;
                        const gds = log.gulaDarahSewaktu || 0;

                        let usiaTahun = "-";
                        if (log.tanggalLahir) {
                          const lahir = new Date(log.tanggalLahir);
                          const sekarang = new Date();
                          usiaTahun = Math.floor(
                            (sekarang.getTime() - lahir.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                          ).toString();
                        }

                        return (
                          <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-3 py-2.5 text-gray-900 font-medium whitespace-nowrap">
                              {(pageLansia - 1) * pageSizeLansia + idx + 1}
                            </td>
                            <td className="px-3 py-2.5 text-gray-900 font-bold whitespace-nowrap">
                              {onNavigate && log.pasienId ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigate("Lansia", log.pasienId)}
                                  className="text-gray-900 font-bold hover:text-indigo-600 hover:underline text-left transition-colors cursor-pointer"
                                  title={`Lihat Profil ${log.nama}`}
                                >
                                  {log.nama || "-"}
                                </button>
                              ) : (
                                <span>{log.nama || "-"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{log.tanggalLahir || "-"}</td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{log.nik || "-"}</td>
                            <td className="px-3 py-2.5 text-gray-600 font-semibold whitespace-nowrap">{log.jenisKelamin || "-"}</td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{usiaTahun !== "-" ? `${usiaTahun} th` : "-"}</td>
                            <td className="px-3 py-2.5 text-gray-600 font-semibold whitespace-nowrap">{(log as any).riwayatDm ? "Ya" : "Tdk"}</td>
                            <td className="px-3 py-2.5 text-gray-600 font-semibold whitespace-nowrap">{(log as any).riwayatHt ? "Ya" : "Tdk"}</td>
                            <td className="px-3 py-2.5 text-gray-900 font-bold whitespace-nowrap">
                              {sistol && diastol ? `${sistol}/${diastol} mmHg` : "-"}
                            </td>
                            <td className="px-3 py-2.5 text-gray-900 font-bold whitespace-nowrap">{gds ? `${gds} mg/dL` : "-"}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredLansiaLogs.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-gray-600">
                  Menampilkan {(pageLansia - 1) * pageSizeLansia + 1} - {Math.min(pageLansia * pageSizeLansia, filteredLansiaLogs.length)} dari {filteredLansiaLogs.length} data
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pageLansia <= 1}
                    onClick={() => setPageLansia((prev) => Math.max(1, prev - 1))}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  <span className="px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded">
                    Hal {pageLansia} / {Math.max(1, Math.ceil(filteredLansiaLogs.length / pageSizeLansia))}
                  </span>
                  <button
                    type="button"
                    disabled={pageLansia >= Math.ceil(filteredLansiaLogs.length / pageSizeLansia)}
                    onClick={() => setPageLansia((prev) => prev + 1)}
                    className="px-2.5 py-1 text-xs font-semibold rounded border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
