"use client";

import * as XLSX from "xlsx";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Globe,
  Building2,
  ShieldCheck,
  Lock,
  User,
  AlertCircle,
  Loader2,
  LogOut,
  Search,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import PageHelmet from "@/components/PageHelmet";
import { useAuth } from "@/contexts/AuthContext";
import { publicPuskesmasApi, PublicPemeriksaanItem, PublicPosyanduInfo, ItemRiwayat } from "@/lib/api";
import { SearchIndex } from "@/lib/searchIndex";
import LaporanFilterCard from "@/features/laporan/components/LaporanFilterCard";
import BalitaLaporanView from "@/features/laporan/components/BalitaLaporanView";
import LansiaLaporanView from "@/features/laporan/components/LansiaLaporanView";
import PuskesmasParticipantModal, { ParticipantHistoryItem } from "./components/PuskesmasParticipantModal";
import PuskesmasPreviewModal from "./components/PuskesmasPreviewModal";
import { LaporanSkeleton } from "@/components/Skeleton";
import {
  calculateRekapanBalita,
  calculateRekapanLansia,
  formatPeriodeText,
} from "@/features/laporan/utils/laporanCalculators";
import { extractPemberianLain } from "@/features/laporan/types";

function toItemRiwayat(item: PublicPemeriksaanItem): ItemRiwayat {
  let usiaBulan: number | undefined = undefined;
  if (item.usiaInfo) {
    const match = item.usiaInfo.match(/(\d+)\s*(?:bln|bulan)/i);
    if (match) usiaBulan = parseInt(match[1], 10);
  }

  let sistol = item.sistol;
  let diastol = item.diastol;
  if ((!sistol || !diastol) && item.tekananDarah && item.tekananDarah.includes("/")) {
    const parts = item.tekananDarah.split("/");
    sistol = sistol || parseInt(parts[0], 10) || undefined;
    diastol = diastol || parseInt(parts[1], 10) || undefined;
  }

  const maskedNik = item.nik && item.nik.length >= 8
    ? `${item.nik.slice(0, 6)}******${item.nik.slice(-4)}`
    : item.nik;

  return {
    id: item.id,
    pasienId: item.nik || item.namaWarga,
    nama: item.namaWarga,
    tipe: item.kategori,
    tanggal: item.tanggalPeriksa,
    petugas: item.posyanduNama,
    parameter: `${item.beratBadan} kg / ${item.tinggiBadan} cm`,
    status: item.statusRingkasan,
    statusType: item.isPerluRujukan ? "warning" : "success",
    nik: maskedNik,
    namaIbu: item.namaIbu,
    usiaBulan,
    jenisKelamin: item.jenisKelamin,
    beratBadan: item.beratBadan,
    tinggiBadan: item.tinggiBadan,
    lingkarKepala: item.lingkarKepala,
    lingkarLengan: item.lingkarLengan,
    statusBbU: item.statusBbU,
    statusTbU: item.statusTbU,
    statusBbTb: item.statusBbTb,
    vitaminA: item.vitaminA,
    asiEksklusif: item.asiEksklusif,
    obatCacing: item.obatCacing,
    vitB1: item.vitB1,
    vitB6: item.vitB6,
    statusImunisasi: item.statusImunisasi,
    tekananDarahSistol: sistol,
    tekananDarahDiastol: diastol,
    gulaDarahSewaktu: item.gds,
    kolesterol: item.kolesterol,
    asamUrat: item.asamUrat,
    lingkarPerut: item.lingkarPerut,
    riwayatHt: item.riwayatHt,
    riwayatDm: item.riwayatDm,
    keluhan: item.keluhan,
    tindakan: item.tindakan,
    ...(item.usiaInfo ? { usiaInfo: item.usiaInfo } : {}),
  } as ItemRiwayat;
}

export default function PuskesmasPublicPage() {
  const { user, isLoading: isAuthLoading, login, logout } = useAuth();

  const now = new Date();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, "0");
  const currentYearStr = String(now.getFullYear());

  const [data, setData] = useState<PublicPemeriksaanItem[]>([]);
  const [posyandus, setPosyandus] = useState<PublicPosyanduInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  // Local login state for unauthenticated users
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handlePuskesmasLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setLoginError(err.message || "Gagal masuk. Periksa kembali email/username dan kata sandi Anda.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Active Tab: "Balita" | "Lansia"
  const [activeTab, setActiveTab] = useState<"Balita" | "Lansia">("Balita");

  // Filters State
  const [selectedPosyandu, setSelectedPosyandu] = useState<string>("semua");
  const [filterMonth, setFilterMonth] = useState<string>(currentMonthStr);
  const [filterYear, setFilterYear] = useState<string>(currentYearStr);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Search States
  const [searchBalita, setSearchBalita] = useState<string>("");
  const [searchLansia, setSearchLansia] = useState<string>("");

  // Pagination states
  const [pageSizeBalita, setPageSizeBalita] = useState<number>(10);
  const [pageBalita, setPageBalita] = useState<number>(1);
  const [pageSizeLansia, setPageSizeLansia] = useState<number>(10);
  const [pageLansia, setPageLansia] = useState<number>(1);

  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<PublicPemeriksaanItem | null>(null);

  // Print & PDF Preview Modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // Search Indexes
  const balitaIndexRef = useRef<SearchIndex<PublicPemeriksaanItem>>(
    new SearchIndex<PublicPemeriksaanItem>((l) => [
      l.namaWarga,
      l.posyanduNama,
      l.desa,
      l.wilayah,
      l.nik,
      l.namaIbu,
      l.petugas,
      l.statusBbU,
      l.statusTbU,
      l.statusBbTb,
      l.statusImunisasi,
      l.statusRingkasan,
    ])
  );

  const lansiaIndexRef = useRef<SearchIndex<PublicPemeriksaanItem>>(
    new SearchIndex<PublicPemeriksaanItem>((l) => [
      l.namaWarga,
      l.posyanduNama,
      l.desa,
      l.wilayah,
      l.nik,
      l.petugas,
      l.keluhan,
      l.tindakan,
      l.tindakanCatatan,
      l.statusRingkasan,
    ])
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [posList, records] = await Promise.all([
        publicPuskesmasApi.getPosyandus(),
        publicPuskesmasApi.getPemeriksaanData({
          posyanduId: selectedPosyandu,
          kategori: "Semua",
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      ]);
      setPosyandus(posList);
      setData(records);
    } catch (err) {
      console.error("Gagal memuat data publik puskesmas:", err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === "PUSKESMAS") {
      loadData();
    }
  }, [user, selectedPosyandu, startDate, endDate]);

  // Client-side filtering
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (selectedPosyandu !== "semua" && item.posyanduId !== selectedPosyandu) {
        return false;
      }
      if (filterYear) {
        const itemYear = new Date(item.tanggalPeriksa).getFullYear().toString();
        if (itemYear !== filterYear) return false;
      }
      if (filterMonth) {
        const itemMonth = String(new Date(item.tanggalPeriksa).getMonth() + 1).padStart(2, "0");
        if (itemMonth !== filterMonth) return false;
      }
      if (startDate && item.tanggalPeriksa < startDate) return false;
      if (endDate && item.tanggalPeriksa > endDate) return false;
      return true;
    });
  }, [data, selectedPosyandu, filterYear, filterMonth, startDate, endDate]);

  // Update Search Indexes
  useEffect(() => {
    balitaIndexRef.current.setSource(filteredData.filter((l) => l.kategori === "Balita"));
    lansiaIndexRef.current.setSource(filteredData.filter((l) => l.kategori === "Lansia"));
  }, [filteredData]);

  // Filtered raw items
  const filteredBalitaRaw = useMemo(() => {
    if (!searchBalita.trim()) {
      return filteredData.filter((l) => l.kategori === "Balita");
    }
    return balitaIndexRef.current.search(searchBalita);
  }, [filteredData, searchBalita]);

  const filteredLansiaRaw = useMemo(() => {
    if (!searchLansia.trim()) {
      return filteredData.filter((l) => l.kategori === "Lansia");
    }
    return lansiaIndexRef.current.search(searchLansia);
  }, [filteredData, searchLansia]);

  // Converted to ItemRiwayat for reporting components
  const filteredBalitaLogs = useMemo(() => {
    return filteredBalitaRaw.map(toItemRiwayat);
  }, [filteredBalitaRaw]);

  const filteredLansiaLogs = useMemo(() => {
    return filteredLansiaRaw.map(toItemRiwayat);
  }, [filteredLansiaRaw]);

  // Participant specific history & trend for detail modal
  const participantHistory: ParticipantHistoryItem[] = useMemo(() => {
    if (!selectedItem) return [];
    const items = data
      .filter(
        (d) =>
          d.namaWarga.toLowerCase() === selectedItem.namaWarga.toLowerCase() &&
          d.kategori === selectedItem.kategori
      )
      .sort((a, b) => new Date(a.tanggalPeriksa).getTime() - new Date(b.tanggalPeriksa).getTime());

    return items.map((item) => ({
      ...item,
      tanggal: item.tanggalPeriksa,
      bb: item.beratBadan,
      tb: item.tinggiBadan,
      sistol: item.sistol || (item.tekananDarah ? parseInt(item.tekananDarah.split("/")[0]) : undefined),
      diastol: item.diastol || (item.tekananDarah ? parseInt(item.tekananDarah.split("/")[1]) : undefined),
      gds: item.gds,
    }));
  }, [selectedItem, data]);

  const prevRecord = participantHistory.length > 1 ? participantHistory[participantHistory.length - 2] : null;
  const currentBB = Number(selectedItem?.beratBadan);
  const prevBB = Number(prevRecord?.beratBadan ?? (prevRecord as any)?.bb);
  const rawBbDiff = prevRecord && selectedItem && !isNaN(currentBB) && !isNaN(prevBB) ? currentBB - prevBB : 0;
  const bbDiff = isNaN(rawBbDiff) ? 0 : Number(rawBbDiff.toFixed(2));

  const currentTB = Number(selectedItem?.tinggiBadan);
  const prevTB = Number(prevRecord?.tinggiBadan ?? (prevRecord as any)?.tb);
  const rawTbDiff = prevRecord && selectedItem && !isNaN(currentTB) && !isNaN(prevTB) ? currentTB - prevTB : 0;
  const tbDiff = isNaN(rawTbDiff) ? 0 : Number(rawTbDiff.toFixed(1));

  // Periode text representation
  const periodeText = useMemo(() => {
    return formatPeriodeText(filterMonth, filterYear);
  }, [filterMonth, filterYear]);

  // Rekapan Balita & Lansia Calculations
  const rekapanBalita = useMemo(() => {
    const balitaLogs = filteredData.filter((l) => l.kategori === "Balita").map(toItemRiwayat);
    const totalAnak = new Set(balitaLogs.map((l) => l.pasienId || l.nama)).size;
    return calculateRekapanBalita(balitaLogs, totalAnak, periodeText);
  }, [filteredData, periodeText]);

  const rekapanLansia = useMemo(() => {
    const lansiaLogs = filteredData.filter((l) => l.kategori === "Lansia").map(toItemRiwayat);
    const totalLansia = new Set(lansiaLogs.map((l) => l.pasienId || l.nama)).size;
    return calculateRekapanLansia(lansiaLogs, totalLansia, periodeText);
  }, [filteredData, periodeText]);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const selectedPosyanduName =
    selectedPosyandu === "semua"
      ? "Semua Posyandu"
      : posyandus.find((p) => p.id === selectedPosyandu)?.nama || selectedPosyandu;

  // Export to Excel (.xlsx) menggunakan SheetJS
  const handleExportExcel = () => {
    try {
      setExportingExcel(true);
      const activeRaw = activeTab === "Balita" ? filteredBalitaRaw : filteredLansiaRaw;
      if (activeRaw.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
      }

      // ── Build rows ──────────────────────────────────────────
      const rows =
        activeTab === "Balita"
          ? activeRaw.map((item, idx) => ({
              No: idx + 1,
              "Nama Balita": item.namaWarga || "",
              Posyandu: item.posyanduNama || "",
              Wilayah: item.wilayah || "",
              "Tanggal Periksa": item.tanggalPeriksa || "",
              "Jenis Kelamin": item.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
              "Usia (Bulan)": item.usiaInfo || "",
              "BB (kg)": item.beratBadan ?? "",
              "TB (cm)": item.tinggiBadan ?? "",
              "LK (cm)": item.lingkarKepala ?? "",
              "LiLA (cm)": item.lingkarLengan ?? "",
              "Status BB/U": item.statusBbU || "-",
              "Status TB/U": item.statusTbU || "-",
              "Status BB/TB": item.statusBbTb || "-",
              "Pemberian Lain": extractPemberianLain(item.statusImunisasi),
              "Vit B1": item.vitB1 ? "Ya" : "Tidak",
              "Vit B6": item.vitB6 ? "Ya" : "Tidak",
              "ASI Eksklusif": item.asiEksklusif ? "Ya" : "Tidak",
              "Vitamin A": item.vitaminA ? "Ya" : "Tidak",
              "Obat Cacing": item.obatCacing ? "Ya" : "Tidak",
              Petugas: item.petugas || "Kader Posyandu",
            }))
          : activeRaw.map((item, idx) => ({
              No: idx + 1,
              "Nama Lansia": item.namaWarga || "",
              Posyandu: item.posyanduNama || "",
              Wilayah: item.wilayah || "",
              "Tanggal Periksa": item.tanggalPeriksa || "",
              "Jenis Kelamin": item.jenisKelamin === "L" ? "Laki-laki" : "Perempuan",
              Usia: item.usiaInfo || "-",
              "Riw. HT": item.riwayatHt ? "Ya" : "Tidak",
              "Riw. DM": item.riwayatDm ? "Ya" : "Tidak",
              "BB (kg)": item.beratBadan ?? "",
              "TB (cm)": item.tinggiBadan ?? "",
              "Tekanan Darah": item.tekananDarah || (item.sistol ? `${item.sistol}/${item.diastol}` : "-"),
              "GDS (mg/dL)": item.gds ?? "",
              "Kolesterol (mg/dL)": item.kolesterol ?? "",
              "Asam Urat (mg/dL)": item.asamUrat ?? "",
              "Lingkar Perut (cm)": item.lingkarPerut ?? "",
              Keluhan: item.keluhan || "-",
              "Tindakan Medis": item.tindakan || item.tindakanCatatan || "-",
              "Status Ringkasan": item.statusRingkasan || "-",
              Petugas: item.petugas || "Kader Posyandu",
            }));

      // ── Build worksheet ──────────────────────────────────────
      const ws = XLSX.utils.json_to_sheet(rows);

      // Auto-width: hitung lebar kolom berdasarkan konten
      const colKeys = Object.keys(rows[0] || {});
      const colWidths = colKeys.map((key) => {
        const maxLen = Math.max(
          key.length,
          ...rows.map((r) => String((r as any)[key] ?? "").length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      ws["!cols"] = colWidths;

      // Bold header row
      const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellAddr]) {
          ws[cellAddr].s = { font: { bold: true } };
        }
      }

      // ── Build workbook & download ────────────────────────────
      const wb = XLSX.utils.book_new();
      const sheetName = activeTab === "Balita" ? "Data Balita" : "Data Lansia";
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `Laporan_${activeTab}_${periodeText.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("Gagal export Excel:", err);
      alert("Gagal mengunduh file Excel.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleOpenPreview = () => {
    setIsPreviewOpen(true);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const handleSelectLog = (log: ItemRiwayat) => {
    const raw = data.find((d) => d.id === log.id);
    if (raw) {
      setSelectedItem(raw);
    }
  };

  const handleResetCurrentPeriod = () => {
    setFilterMonth(currentMonthStr);
    setFilterYear(currentYearStr);
    setStartDate("");
    setEndDate("");
    setPageBalita(1);
    setPageLansia(1);
  };

  const handleResetAllPeriods = () => {
    setFilterMonth("");
    setFilterYear("");
    setStartDate("");
    setEndDate("");
    setPageBalita(1);
    setPageLansia(1);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-9 h-9 text-teal-600 animate-spin" />
          <p className="text-sm font-semibold text-slate-700">Memeriksa autentikasi Portal Puskesmas...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
        <PageHelmet
          title="Masuk ke Portal Puskesmas — SIIP"
          description="Portal internal Puskesmas untuk rekapitulasi data pemeriksaan pelayanan Posyandu terintegrasi."
        />

        {/* Top Header */}
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
              <img src="/logo.svg" alt="Logo SIIP" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">SIIP</h1>
              <span className="text-[11px] text-slate-500">Portal Puskesmas</span>
            </div>
          </div>

          <Link
            href="/publik"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Portal Publik →</span>
          </Link>
        </header>

        {/* Main Content Card */}
        <main className="max-w-md w-full mx-auto my-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Masuk ke Portal Puskesmas
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Khusus petugas Puskesmas dan kader Posyandu untuk mengakses rekapitulasi data pelayanan kesehatan.
            </p>
          </div>

          {/* Form Login */}
          <form onSubmit={handlePuskesmasLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email atau Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="email@gmail.com atau username"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-900 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <span>Masuk ke Portal Puskesmas</span>
              )}
            </button>
          </form>

          {/* Citizen Redirect Info Box */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Warga masyarakat yang ingin mengecek catatan pelayanan kesehatan mandiri:
            </p>
            <Link
              href="/publik"
              className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
            >
              <span>Buka Portal Publik</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 py-3">
          SIIP © 2026 · Sistem Informasi Posyandu &amp; Puskesmas
        </footer>
      </div>
    );
  }

  // User Posyandu (Kader/Owner) tidak boleh mengakses Portal Puskesmas
  if (user && user.role !== "PUSKESMAS") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6">
        <header className="max-w-xl w-full mx-auto flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
              <img src="/logo.svg" alt="Logo SIIP" className="w-5 h-5 object-contain" />
            </div>
            <span className="font-bold text-slate-900 text-sm">SIIP</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
          >
            Keluar
          </button>
        </header>

        <main className="max-w-md w-full mx-auto my-auto bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs text-center">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Akses Ditolak: Khusus Petugas Puskesmas
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Portal Rekapitulasi Puskesmas hanya dapat diakses oleh akun <strong>Petugas Puskesmas</strong>. Akun Anda saat ini ({user.nama} · {user.posyandu?.nama}) terdaftar sebagai kader Posyandu.
          </p>
          <div className="mt-5 space-y-2">
            <Link
              href="/"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Kembali ke Aplikasi Posyandu →</span>
            </Link>
            <button
              onClick={logout}
              className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer"
            >
              Keluar dan Masuk sebagai Petugas Puskesmas
            </button>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-400 py-3">
          SIIP © 2026 · Sistem Informasi Posyandu &amp; Puskesmas
        </footer>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-gray-50 p-4 sm:p-6 space-y-6 print:p-0 print:bg-white ${
        isPreviewOpen ? "print:hidden" : ""
      }`}
    >
      <PageHelmet
        title={`Portal Puskesmas — Laporan Rekapitulasi ${activeTab} SIIP`}
        description={`Portal rekapitulasi data pemeriksaan kesehatan ${activeTab} seluruh Posyandu binaan Puskesmas terintegrasi SIIP.`}
      />

      {/* Header Halaman */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-gray-200/80 shadow-2xs">
        <div className="flex items-start gap-4">
          {/* Logo SIIP */}
          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200/90 shadow-2xs flex items-center justify-center p-2 shrink-0 mt-0.5">
            <img src="/logo.svg" alt="Logo SIIP" className="w-7 h-7 object-contain" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold text-teal-800">
                Portal Puskesmas
              </span>
              {user && (
                <span className="text-xs text-slate-500">
                  · Petugas: <strong className="text-slate-800 font-semibold">{user.nama}</strong> ({user.posyandu?.nama || "Puskesmas"})
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              Rekapitulasi Pelayanan Posyandu
            </h2>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Monitoring dan rekapitulasi data pemeriksaan kesehatan Balita &amp; Lansia seluruh Posyandu binaan Puskesmas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 sm:self-center flex-wrap">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
          >
            <span>Aplikasi Posyandu</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/publik"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <span>Portal Publik ↗</span>
          </Link>

          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            title="Keluar dari sesi ini"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="print:hidden">
        <LaporanFilterCard
          filterCategory={activeTab}
          setFilterCategory={(cat) => {
            setActiveTab(cat);
            setPageBalita(1);
            setPageLansia(1);
          }}
          posyandus={posyandus}
          selectedPosyandu={selectedPosyandu}
          setSelectedPosyandu={(p) => {
            setSelectedPosyandu(p);
            setPageBalita(1);
            setPageLansia(1);
          }}
          filterMonth={filterMonth}
          setFilterMonth={(m) => {
            setFilterMonth(m);
            setPageBalita(1);
            setPageLansia(1);
          }}
          filterYear={filterYear}
          setFilterYear={(y) => {
            setFilterYear(y);
            setPageBalita(1);
            setPageLansia(1);
          }}
          filterFromDate={startDate}
          setFilterFromDate={(d) => {
            setStartDate(d);
            setPageBalita(1);
            setPageLansia(1);
          }}
          filterToDate={endDate}
          setFilterToDate={(d) => {
            setEndDate(d);
            setPageBalita(1);
            setPageLansia(1);
          }}
          yearOptions={yearOptions}
          onResetCurrentPeriod={handleResetCurrentPeriod}
          onResetAllPeriods={handleResetAllPeriods}
          isLoading={isLoading}
          hasData={activeTab === "Balita" ? filteredBalitaRaw.length > 0 : filteredLansiaRaw.length > 0}
          onOpenPreview={handleOpenPreview}
          onExportExcel={handleExportExcel}
          isExportingExcel={exportingExcel}
        />
      </div>

      {/* Main Report View / Skeleton Loading */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-2xs">
          <LaporanSkeleton />
        </div>
      ) : activeTab === "Balita" ? (
        <BalitaLaporanView
          rekapanBalita={rekapanBalita}
          filteredBalitaLogs={filteredBalitaLogs}
          pageBalita={pageBalita}
          setPageBalita={setPageBalita}
          pageSizeBalita={pageSizeBalita}
          setPageSizeBalita={setPageSizeBalita}
          searchBalita={searchBalita}
          setSearchBalita={setSearchBalita}
          onSelectLog={handleSelectLog}
          isPublic={true}
          isUpdating={isLoading}
        />
      ) : (
        <LansiaLaporanView
          rekapanLansia={rekapanLansia}
          filteredLansiaLogs={filteredLansiaLogs}
          pageLansia={pageLansia}
          setPageLansia={setPageLansia}
          pageSizeLansia={pageSizeLansia}
          setPageSizeLansia={setPageSizeLansia}
          searchLansia={searchLansia}
          setSearchLansia={setSearchLansia}
          onSelectLog={handleSelectLog}
          isPublic={true}
          isUpdating={isLoading}
        />
      )}

      {/* Footer Puskesmas Page */}
      <footer className="print:hidden border-t border-gray-200/80 pt-6 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
        <p>© 2026 SIIP · Sistem Informasi Posyandu</p>
        <div className="flex items-center gap-1.5 text-gray-600 font-medium">
          <span>Created by</span>
          <span className="font-semibold text-gray-800">Universitas Putra Bangsa</span>
          <img
            src="/logoupb.webp"
            alt="Logo Universitas Putra Bangsa"
            className="w-4 h-4 object-contain inline-block"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      </footer>

      {/* Participant Detail Modal with Growth Trend Chart */}
      <PuskesmasParticipantModal
        selectedItem={selectedItem}
        onClose={() => setSelectedItem(null)}
        participantHistory={participantHistory}
        prevRecord={prevRecord}
        bbDiff={bbDiff}
        tbDiff={tbDiff}
      />

      {/* Modal Pratinjau Dokumen Laporan Resmi */}
      <PuskesmasPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        activeTab={activeTab}
        periodeText={periodeText}
        selectedPosyanduName={selectedPosyanduName}
        rekapanBalita={rekapanBalita}
        rekapanLansia={rekapanLansia}
        filteredBalitaLogs={filteredBalitaRaw}
        filteredLansiaLogs={filteredLansiaRaw}
        exportingExcel={exportingExcel}
        onExportExcel={handleExportExcel}
        onPrintPdf={handlePrintPdf}
      />
    </div>
  );
}
