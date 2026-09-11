'use client';

import { useState, useEffect } from "react";
import { formatTanggalIndonesia, formatTanggalInput } from "../../lib/dateUtils";
import Modal from "../../components/Modal";
import LansiaIcon from "../../components/LansiaIcon";
import BalitaIcon from "../../components/BalitaIcon";
import { RiwayatTableSkeleton } from "../../components/Skeleton";
import { riwayatApi, ItemRiwayat, balitaApi, lansiaApi, PeriodePelayanan } from "@/lib/api";
import {
  hitungStatusBbU,
  hitungStatusTbU,
  hitungStatusBbTb,
  convertStatusBbUToCode,
  convertStatusTbUToCode,
  convertStatusBbTbToCode,
} from "../../lib/zScoreCalculator";
import {
  Search,
  Heart,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  FileSpreadsheet,
  LineChart as LineChartIcon,
  Edit2,
  Trash2,
  Eye,
  Activity,
  User
} from "lucide-react";
import ActionMenu from "@/components/ActionMenu";
import PageHelmet from "@/components/PageHelmet";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

interface RiwayatModuleProps {
  posyanduId: string;
  activePeriode?: PeriodePelayanan | null;
  onNavigate?: (module: string, itemId?: string) => void;
}

export default function RiwayatModule({ posyanduId, activePeriode, onNavigate }: RiwayatModuleProps) {
  const [logs, setLogs] = useState<ItemRiwayat[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"semua" | "Balita" | "Lansia">("semua");
  const [statusFilter, setStatusFilter] = useState<"semua" | "success" | "warning">("semua");
  const [selectedBulan, setSelectedBulan] = useState<number | "semua">(
    activePeriode ? activePeriode.bulan : "semua"
  );
  const [selectedTahun, setSelectedTahun] = useState<number | "semua">(
    activePeriode ? activePeriode.tahun : "semua"
  );

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, typeFilter, statusFilter, selectedBulan, selectedTahun]);

  // Tab mode: "tabel" vs "grafik"
  const [viewMode, setViewMode] = useState<"tabel" | "grafik">("tabel");

  // Modal Detail & Grafik Perkembangan Peserta State
  const [selectedDetailLog, setSelectedDetailLog] = useState<ItemRiwayat | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Modal Edit & Delete State
  const [selectedLog, setSelectedLog] = useState<ItemRiwayat | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form Fields - Balita
  const [bDate, setBDate] = useState("");
  const [bBB, setBBB] = useState("");
  const [bTB, setBTB] = useState("");
  const [bLK, setBLK] = useState("");
  const [bLiLA, setBLiLA] = useState("");
  const [bBBU, setBBBU] = useState<any>("Normal");
  const [bTBU, setBTBU] = useState<any>("Normal");
  const [bBBTB, setBBBTB] = useState<any>("Normal");
  const [bKms, setBKms] = useState("N (Naik)");
  const [bVitA, setBVitA] = useState(false);
  const [bAsi, setBAsi] = useState(false);
  const [bCacing, setBCacing] = useState(false);
  const [bImunisasi, setBImunisasi] = useState("");
  const [bPetugas, setBPetugas] = useState("");

  // Form Fields - Lansia
  const [lDate, setLDate] = useState("");
  const [lBB, setLBB] = useState("");
  const [lTB, setLTB] = useState("");
  const [lSistol, setLSistol] = useState("");
  const [lDiastol, setLDiastol] = useState("");
  const [lGds, setLGds] = useState("");
  const [lLp, setLLp] = useState("");
  const [lKol, setLKol] = useState("");
  const [lUrat, setLUrat] = useState("");
  const [lKeluhan, setLKeluhan] = useState("");
  const [lTindakan, setLTindakan] = useState("");
  const [lPetugas, setLPetugas] = useState("");

  // Open Detail & Grafik Perkembangan Modal
  const openDetailModal = (log: ItemRiwayat) => {
    setSelectedDetailLog(log);
    setIsDetailModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (log: ItemRiwayat) => {
    setSelectedLog(log);
    setFormError("");
    if (log.tipe === "Balita") {
      setBDate(formatTanggalInput(log.tanggal));
      setBBB(log.beratBadan ? String(log.beratBadan) : "");
      setBTB(log.tinggiBadan ? String(log.tinggiBadan) : "");
      setBLK(log.lingkarKepala ? String(log.lingkarKepala) : "");
      setBLiLA(log.lingkarLengan ? String(log.lingkarLengan) : "");
      setBBBU((log.statusBbU as any) || "Normal");
      setBTBU((log.statusTbU as any) || "Normal");
      setBBBTB((log.statusBbTb as any) || "Normal");
      setBKms(log.statusKms || "N (Naik)");
      setBVitA(Boolean(log.vitaminA));
      setBAsi(Boolean(log.asiEksklusif));
      setBCacing(Boolean(log.obatCacing));
      setBImunisasi(log.statusImunisasi || "");
      setBPetugas(log.petugas || "");
    } else {
      setLDate(formatTanggalInput(log.tanggal));
      setLBB(log.beratBadan ? String(log.beratBadan) : "");
      setLTB(log.tinggiBadan ? String(log.tinggiBadan) : "");
      setLSistol(log.tekananDarahSistol ? String(log.tekananDarahSistol) : "");
      setLDiastol(log.tekananDarahDiastol ? String(log.tekananDarahDiastol) : "");
      setLGds(log.gulaDarahSewaktu ? String(log.gulaDarahSewaktu) : "");
      setLLp(log.lingkarPerut ? String(log.lingkarPerut) : "");
      setLKol(log.kolesterol ? String(log.kolesterol) : "");
      setLUrat(log.asamUrat ? String(log.asamUrat) : "");
      setLKeluhan(log.keluhan || "");
      setLTindakan(log.tindakan || "");
      setLPetugas(log.petugas || "");
    }
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (log: ItemRiwayat) => {
    setSelectedLog(log);
    setIsDeleteModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLog) return;
    setFormError("");
    setSaving(true);
    try {
      if (selectedLog.tipe === "Balita") {
        const bb = parseFloat(bBB);
        const tb = parseFloat(bTB);
        if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0) {
          setFormError("Berat Badan dan Tinggi Badan harus diisi angka positif yang valid.");
          setSaving(false);
          return;
        }
        const pasienId = selectedLog.pasienId || selectedLog.id;
        await balitaApi.updatePemeriksaan(posyanduId, pasienId, selectedLog.id, {
          tanggalPeriksa: bDate,
          beratBadan: bb,
          tinggiBadan: tb,
          lingkarKepala: bLK ? parseFloat(bLK) : undefined,
          lingkarLengan: bLiLA ? parseFloat(bLiLA) : undefined,
          statusBbU: convertStatusBbUToCode(bBBU),
          statusTbU: convertStatusTbUToCode(bTBU),
          statusBbTb: convertStatusBbTbToCode(bBBTB),
          statusKms: bKms,
          vitaminA: bVitA,
          asiEksklusif: bAsi,
          obatCacing: bCacing,
          statusImunisasi: bImunisasi || undefined,
          petugas: bPetugas || undefined,
        } as any);
      } else {
        const bb = parseFloat(lBB);
        const tb = parseFloat(lTB);
        const sistol = parseInt(lSistol);
        const diastol = parseInt(lDiastol);
        const gds = parseFloat(lGds);
        const lp = parseFloat(lLp);
        if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0 || isNaN(sistol) || isNaN(diastol) || isNaN(gds) || isNaN(lp)) {
          setFormError("Mohon isi semua data pemeriksaan lansia dengan angka positif yang valid.");
          setSaving(false);
          return;
        }
        const pasienId = selectedLog.pasienId || selectedLog.id;
        await lansiaApi.updatePemeriksaan(posyanduId, pasienId, selectedLog.id, {
          tanggalPeriksa: lDate,
          beratBadan: bb,
          tinggiBadan: tb,
          tekananDarahSistol: sistol,
          tekananDarahDiastol: diastol,
          gulaDarahSewaktu: gds,
          lingkarPerut: lp,
          kolesterol: lKol ? parseFloat(lKol) : undefined,
          asamUrat: lUrat ? parseFloat(lUrat) : undefined,
          keluhan: lKeluhan || undefined,
          tindakan: lTindakan || undefined,
          petugas: lPetugas || undefined,
        } as any);
      }
      fetchRiwayat();
      window.dispatchEvent(new Event("pemeriksaanSaved"));
      setIsEditModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Gagal mengedit data pemeriksaan.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!selectedLog) return;
    setSaving(true);
    try {
      const pasienId = selectedLog.pasienId || selectedLog.id;
      if (selectedLog.tipe === "Balita") {
        await balitaApi.deletePemeriksaan(posyanduId, pasienId, selectedLog.id);
      } else {
        await lansiaApi.deletePemeriksaan(posyanduId, pasienId, selectedLog.id);
      }
      fetchRiwayat();
      window.dispatchEvent(new Event("pemeriksaanSaved"));
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Gagal menghapus riwayat periksa.");
    } finally {
      setSaving(false);
    }
  };

  // Load data riwayat dari backend API
  const fetchRiwayat = async () => {
    try {
      setLoading(true);
      const res = await riwayatApi.getAll(posyanduId, {
        tipe: typeFilter,
        search: query,
        status: statusFilter,
        bulan: selectedBulan === "semua" ? undefined : String(selectedBulan),
        tahun: selectedTahun === "semua" ? undefined : String(selectedTahun),
      });
      if (res.success) {
        setLogs(res.data);
      }
    } catch (err) {
      console.error("Gagal mengambil data riwayat:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, [posyanduId, typeFilter, statusFilter, selectedBulan, selectedTahun]);

  // Debounced search submit
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRiwayat();
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Listen for pemeriksaanSaved event from Balita/Lansia modules
  useEffect(() => {
    const handlePemeriksaanSaved = () => {
      fetchRiwayat();
    };
    window.addEventListener("pemeriksaanSaved", handlePemeriksaanSaved);
    return () => window.removeEventListener("pemeriksaanSaved", handlePemeriksaanSaved);
  }, []);

  // Olah data untuk Grafik Trend Pertumbuhan / Pemeriksaan (Agregasi Tanggal Global)
  const chartData = (() => {
    const dateMap: Record<string, { tanggal: string; balita: number; lansia: number; warning: number }> = {};

    logs.forEach((log) => {
      if (!dateMap[log.tanggal]) {
        dateMap[log.tanggal] = { tanggal: log.tanggal, balita: 0, lansia: 0, warning: 0 };
      }
      if (log.tipe === "Balita") dateMap[log.tanggal].balita += 1;
      if (log.tipe === "Lansia") dateMap[log.tanggal].lansia += 1;
      if (log.statusType === "warning") dateMap[log.tanggal].warning += 1;
    });

    return Object.values(dateMap).sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );
  })();

  // Olah data untuk Grafik Individual Peserta (Detail Modal)
  const participantHistory = selectedDetailLog
    ? logs
        .filter((l) =>
          selectedDetailLog.pasienId
            ? l.pasienId === selectedDetailLog.pasienId
            : l.nama === selectedDetailLog.nama
        )
        .sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime())
    : [];

  const latestRecord = participantHistory.length > 0 ? participantHistory[participantHistory.length - 1] : null;
  const prevRecord = participantHistory.length > 1 ? participantHistory[participantHistory.length - 2] : null;

  // Trend Kenaikan / Penurunan BB & TB
  const bbLatest = latestRecord?.beratBadan ?? 0;
  const bbPrev = prevRecord?.beratBadan ?? 0;
  const bbDiff = prevRecord && latestRecord ? Number((bbLatest - bbPrev).toFixed(2)) : 0;

  const tbLatest = latestRecord?.tinggiBadan ?? 0;
  const tbPrev = prevRecord?.tinggiBadan ?? 0;
  const tbDiff = prevRecord && latestRecord ? Number((tbLatest - tbPrev).toFixed(2)) : 0;

  return (
    <div className="space-y-6">
      <PageHelmet
        title="Riwayat & Laporan"
        description="Laporan riwayat pemeriksaan bulanan terpadu dengan fitur cetak Excel dan PDF."
      />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-saas-dark tracking-tight">Riwayat Pemeriksaan Bulanan</h2>
          <p className="text-xs sm:text-sm text-saas-muted mt-0.5">
            Data terpadu perkembangan kesehatan Balita &amp; Lansia beserta statistik grafik bulanan.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          {/* Switch Mode Tabel / Grafik */}
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1 w-full sm:w-auto">
            <button
              onClick={() => setViewMode("tabel")}
              className={`flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === "tabel"
                  ? "bg-white text-saas-dark shadow-sm"
                  : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> Tabel Riwayat
            </button>
            <button
              onClick={() => setViewMode("grafik")}
              className={`flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === "grafik"
                  ? "bg-white text-saas-dark shadow-sm"
                  : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5 shrink-0" /> Grafik Trend
            </button>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 sm:p-6 rounded-card border border-gray-100/50 shadow-soft-card space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full lg:w-80">
            <input
              type="text"
              placeholder="Cari nama warga atau parameter..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-100 rounded-input text-sm text-saas-dark placeholder-saas-muted/70 focus:outline-none focus:border-saas-primary/50 focus:bg-white transition-all"
            />
            <Search className="absolute left-3.5 top-3 text-saas-muted/80 w-4 h-4" />
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
            {/* Filter Periode Bulan & Tahun */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-saas-muted shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Periode:
              </span>
              <select
                value={selectedBulan}
                onChange={(e) => setSelectedBulan(e.target.value === "semua" ? "semua" : Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-bold text-saas-dark focus:outline-none focus:border-saas-primary"
              >
                <option value="semua">Semua Bulan</option>
                {[
                  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
                  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
                ].map((m, idx) => (
                  <option key={m} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(e.target.value === "semua" ? "semua" : Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg font-bold text-saas-dark focus:outline-none focus:border-saas-primary"
              >
                <option value="semua">Semua Tahun</option>
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Tipe filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-saas-muted shrink-0">Kategori:</span>
              <div className="flex gap-1 w-full sm:w-auto overflow-x-auto pb-0.5">
                {(["semua", "Balita", "Lansia"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 ${
                      typeFilter === t
                        ? "bg-saas-primary/10 text-saas-primary border border-saas-primary/20"
                        : "bg-gray-50 text-saas-muted hover:text-saas-dark border border-transparent"
                    }`}
                  >
                    {t === "semua" ? "Semua" : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Status filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-saas-muted shrink-0">Kondisi Hasil:</span>
              <div className="flex gap-1 w-full sm:w-auto overflow-x-auto pb-0.5">
                {[
                  { label: "Semua", val: "semua" },
                  { label: "Normal / Sehat", val: "success" },
                  { label: "Perlu Perhatian / Rawan", val: "warning" },
                ].map((s) => (
                  <button
                    key={s.val}
                    onClick={() => setStatusFilter(s.val as any)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 ${
                      statusFilter === s.val
                        ? "bg-saas-primary/10 text-saas-primary border border-saas-primary/20"
                        : "bg-gray-50 text-saas-muted hover:text-saas-dark border border-transparent"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW: GRAFIK TREND GLOBAL */}
      {viewMode === "grafik" && (
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-saas-dark flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-saas-primary" /> Trend Jumlah Pemeriksaan &amp; Temuan Risiko
              </h3>
              <p className="text-xs text-saas-muted mt-0.5">
                Grafik pergerakan jumlah kunjungan Balita, Lansia, serta temuan gizi/penyakit rawan dari waktu ke waktu.
              </p>
            </div>
          </div>

          <div className="h-80 w-full pt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFF",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="balita"
                    name="Pemeriksaan Balita"
                    stroke="#0D9488"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="lansia"
                    name="Pemeriksaan Lansia"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="warning"
                    name="Kasus Rawan / Rujukan"
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-saas-muted">
                Belum ada data grafik untuk ditampilkan.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: TABEL RIWAYAT */}
      {viewMode === "tabel" && (
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-4 sm:p-6 overflow-hidden">
          {loading ? (
            <RiwayatTableSkeleton rows={7} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                    <th className="pb-3 px-3 whitespace-nowrap">Tanggal Periksa</th>
                    <th className="pb-3 px-3 whitespace-nowrap">Nama Lengkap</th>
                    <th className="pb-3 px-3 whitespace-nowrap">Kategori</th>
                    <th className="pb-3 px-3 whitespace-nowrap">Parameter Fisik &amp; Medis</th>
                    <th className="pb-3 px-3 whitespace-nowrap">Kondisi Hasil</th>
                    <th className="pb-3 px-3 whitespace-nowrap">Petugas</th>
                    <th className="pb-3 px-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredLogs = logs.filter((log) => {
                      if (!query) return true;
                      const q = query.toLowerCase();
                      return (
                        log.nama.toLowerCase().includes(q) ||
                        log.parameter.toLowerCase().includes(q) ||
                        log.status.toLowerCase().includes(q) ||
                        log.petugas.toLowerCase().includes(q)
                      );
                    });

                    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
                    const paginatedLogs = filteredLogs.slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage
                    );

                    return paginatedLogs.length > 0 ? (
                      paginatedLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40 transition-colors text-sm"
                        >
                          <td className="py-4 px-3 font-bold text-saas-dark whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-saas-muted shrink-0" />
                              {formatTanggalIndonesia(log.tanggal)}
                            </div>
                          </td>
                          <td className="py-4 px-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigate && log.pasienId) {
                                  onNavigate(log.tipe, log.pasienId);
                                } else {
                                  openDetailModal(log);
                                }
                              }}
                              className="font-extrabold text-saas-dark hover:text-saas-primary text-left transition-colors cursor-pointer hover:underline"
                              title={`Lihat Profil ${log.nama}`}
                            >
                              {log.nama}
                            </button>
                          </td>
                          <td className="py-4 px-3 font-semibold text-saas-muted whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {log.tipe === "Balita" ? (
                                <BalitaIcon className="w-3.5 h-3.5 text-saas-primary shrink-0" />
                              ) : (
                                <LansiaIcon className="w-3.5 h-3.5 shrink-0" />
                              )}
                              {log.tipe}
                            </div>
                          </td>
                          <td className="py-4 px-3 text-xs font-semibold text-saas-dark/95 leading-normal max-w-xs truncate whitespace-nowrap">
                            {log.parameter}
                          </td>
                          <td className="py-4 px-3 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                                log.statusType === "success"
                                  ? "bg-trend-successBg text-trend-successText"
                                  : log.statusType === "warning"
                                  ? "bg-trend-dangerBg text-trend-dangerText"
                                  : "bg-blue-50 text-saas-primary"
                              }`}
                            >
                              {log.statusType === "success" && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                              {log.statusType === "warning" && <AlertCircle className="w-3 h-3 shrink-0" />}
                              {log.statusType === "info" && <Clock className="w-3 h-3 shrink-0" />}
                              {log.status}
                            </span>
                          </td>
                          <td className="py-4 px-3 text-xs text-saas-muted font-bold whitespace-nowrap">{log.petugas}</td>
                          <td className="py-4 px-3 text-right whitespace-nowrap">
                            <ActionMenu
                              items={[
                                ...(onNavigate && log.pasienId ? [{
                                  label: `Lihat Profil ${log.tipe}`,
                                  icon: <User className="w-4 h-4" />,
                                  onClick: () => onNavigate(log.tipe, log.pasienId)
                                }] : []),
                                {
                                  label: "Grafik & Detail",
                                  icon: <Eye className="w-4 h-4" />,
                                  onClick: () => openDetailModal(log)
                                },
                                {
                                  label: "Edit Record",
                                  icon: <Edit2 className="w-4 h-4" />,
                                  onClick: () => openEditModal(log)
                                },
                                {
                                  label: "Hapus Record",
                                  icon: <Trash2 className="w-4 h-4" />,
                                  variant: "danger",
                                  onClick: () => openDeleteModal(log)
                                }
                              ]}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-saas-muted font-medium whitespace-nowrap">
                          Tidak ada catatan riwayat pemeriksaan yang cocok.
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {(() => {
                const filteredLogs = logs.filter((log) => {
                  if (!query) return true;
                  const q = query.toLowerCase();
                  return (
                    log.nama.toLowerCase().includes(q) ||
                    log.parameter.toLowerCase().includes(q) ||
                    log.status.toLowerCase().includes(q) ||
                    log.petugas.toLowerCase().includes(q)
                  );
                });
                const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;

                return filteredLogs.length > 0 ? (
                  <div className="pt-4 mt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-saas-muted font-medium">
                    <div className="flex items-center gap-2">
                      <span>Tampilkan</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                        className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-md font-bold text-saas-dark focus:outline-none focus:border-saas-primary"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <span>data per halaman</span>
                      <span className="ml-2 font-medium">
                        (Menampilkan {filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLogs.length)} dari {filteredLogs.length} data)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-md border border-gray-200 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Sebelumnya
                      </button>
                      <span className="px-3 py-1.5 font-bold text-saas-dark">
                        Halaman {currentPage} dari {totalPages || 1}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-1.5 rounded-md border border-gray-200 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETAIL & GRAFIK PERKEMBANGAN PESERTA (1 BALITA / LANSIA) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Grafik Perkembangan & Riwayat: ${selectedDetailLog?.nama || ""}`}
      >
        {selectedDetailLog && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
            {/* Header Identity Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent border border-teal-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
                  selectedDetailLog.tipe === "Balita" ? "bg-saas-primary shadow-teal-500/20" : "bg-indigo-600 shadow-indigo-500/20"
                }`}>
                  {selectedDetailLog.tipe === "Balita" ? <BalitaIcon className="w-6 h-6" gender={selectedDetailLog.jenisKelamin} /> : <LansiaIcon className="w-6 h-6" gender={selectedDetailLog.jenisKelamin} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-saas-dark">{selectedDetailLog.nama}</h3>
                    {onNavigate && selectedDetailLog.pasienId && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          onNavigate(selectedDetailLog.tipe, selectedDetailLog.pasienId);
                        }}
                        className="text-xs font-bold text-saas-primary hover:underline cursor-pointer"
                        title={`Lihat Profil Lengkap ${selectedDetailLog.nama}`}
                      >
                        (Lihat Profil &rarr;)
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-saas-muted font-semibold mt-0.5">
                    Kategori: <strong className="text-saas-dark">{selectedDetailLog.tipe}</strong> | Total Periksa: <strong className="text-saas-primary">{participantHistory.length}x</strong>
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-white border border-gray-200 text-saas-dark font-extrabold text-xs rounded-full shadow-2xs self-start sm:self-auto">
                Status: {latestRecord?.status || selectedDetailLog.status}
              </span>
            </div>

            {/* TREND INDICATOR BANNER (Kenaikan / Penurunan) */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-saas-muted">
                Ringkasan Trend Perkembangan Terakhir
              </h4>

              {selectedDetailLog.tipe === "Balita" ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Berat Badan Trend Box */}
                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-saas-muted uppercase">Berat Badan (BB)</span>
                    <p className="text-base font-extrabold text-saas-dark">{bbLatest} kg</p>
                    {prevRecord ? (
                      <div className="pt-0.5">
                        {bbDiff > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3" /> Naik +{bbDiff} kg
                          </span>
                        ) : bbDiff < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full">
                            <TrendingDown className="w-3 h-3" /> Turun {bbDiff} kg
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                            <Minus className="w-3 h-3" /> Stagnan (0 kg)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-saas-muted font-bold">Pemeriksaan Pertama</span>
                    )}
                  </div>

                  {/* Tinggi Badan Trend Box */}
                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-saas-muted uppercase">Tinggi Badan (TB)</span>
                    <p className="text-base font-extrabold text-saas-dark">{tbLatest} cm</p>
                    {prevRecord ? (
                      <div className="pt-0.5">
                        {tbDiff > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            <TrendingUp className="w-3 h-3" /> Tumbuh +{tbDiff} cm
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                            <Minus className="w-3 h-3" /> Tetap ({tbDiff} cm)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-saas-muted font-bold">Pemeriksaan Pertama</span>
                    )}
                  </div>

                  {/* Status Z-Score Box */}
                  <div className="p-3.5 bg-teal-50/50 border border-teal-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-saas-primary uppercase">Status Gizi (WHO)</span>
                    <p className="text-xs font-extrabold text-teal-900 leading-snug">
                      {latestRecord?.statusBbU ? `BB/U: ${latestRecord.statusBbU}` : "Normal"}
                    </p>
                    <p className="text-[10px] font-bold text-teal-700">
                      TB/U: {latestRecord?.statusTbU || "N"} | BB/TB: {latestRecord?.statusBbTb || "N"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tekanan Darah Box */}
                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-saas-muted uppercase">Tekanan Darah (TD)</span>
                    <p className="text-base font-extrabold text-saas-dark">
                      {latestRecord?.tekananDarahSistol || 0}/{latestRecord?.tekananDarahDiastol || 0} <span className="text-xs font-normal">mmHg</span>
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      (latestRecord?.tekananDarahSistol || 0) >= 140 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {(latestRecord?.tekananDarahSistol || 0) >= 140 ? "Hipertensi" : "Normal"}
                    </span>
                  </div>

                  {/* Gula Darah Box */}
                  <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-saas-muted uppercase">Gula Darah (GDS)</span>
                    <p className="text-base font-extrabold text-saas-dark">
                      {latestRecord?.gulaDarahSewaktu || 0} <span className="text-xs font-normal">mg/dL</span>
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      (latestRecord?.gulaDarahSewaktu || 0) >= 200 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {(latestRecord?.gulaDarahSewaktu || 0) >= 200 ? "GDS Tinggi" : "Normal"}
                    </span>
                  </div>

                  {/* Kolesterol & Asam Urat Box */}
                  <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/80 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase">Kolesterol / Asam Urat</span>
                    <p className="text-xs font-extrabold text-indigo-950">
                      Kol: {latestRecord?.kolesterol || "-"} | Urat: {latestRecord?.asamUrat || "-"}
                    </p>
                    <p className="text-[10px] font-bold text-indigo-700">LP: {latestRecord?.lingkarPerut || "-"} cm</p>
                  </div>
                </div>
              )}
            </div>

            {/* GRAFIK PERKEMBANGAN PESERTA (LINE CHART) */}
            <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-saas-dark flex items-center gap-1.5">
                  <LineChartIcon className="w-4 h-4 text-saas-primary" />
                  Grafik Perkembangan {selectedDetailLog.tipe === "Balita" ? "Berat & Tinggi Badan" : "Tekanan Darah & GDS"}
                </h4>
                <span className="text-[10px] font-bold text-saas-muted bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  {participantHistory.length} Titik Data
                </span>
              </div>

              <div className="h-64 w-full">
                {participantHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={participantHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFF",
                          borderRadius: "12px",
                          border: "1px solid #E5E7EB",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      {selectedDetailLog.tipe === "Balita" ? (
                        <>
                          <Line
                            type="monotone"
                            dataKey="beratBadan"
                            name="Berat Badan (kg)"
                            stroke="#0D9488"
                            strokeWidth={3}
                            dot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="tinggiBadan"
                            name="Tinggi Badan (cm)"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            dot={{ r: 5 }}
                          />
                        </>
                      ) : (
                        <>
                          <Line
                            type="monotone"
                            dataKey="tekananDarahSistol"
                            name="TD Sistol (mmHg)"
                            stroke="#EF4444"
                            strokeWidth={3}
                            dot={{ r: 5 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="tekananDarahDiastol"
                            name="TD Diastol (mmHg)"
                            stroke="#3B82F6"
                            strokeWidth={2}
                            dot={{ r: 4 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="gulaDarahSewaktu"
                            name="GDS (mg/dL)"
                            stroke="#F59E0B"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={{ r: 4 }}
                          />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-saas-muted">
                    Belum ada riwayat grafik untuk peserta ini.
                  </div>
                )}
              </div>
            </div>

            {/* TABEL HISTORI PERIKSA INDIVIDUAL */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-saas-muted">
                Riwayat Histori Pemeriksaan Lengkap ({participantHistory.length})
              </h4>
              <div className="overflow-x-auto border border-gray-150 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 font-bold text-saas-dark">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Parameter Ukur</th>
                      <th className="py-2.5 px-3">Kondisi / Status</th>
                      <th className="py-2.5 px-3">Petugas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantHistory.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-bold text-saas-dark">{item.tanggal}</td>
                        <td className="py-2.5 px-3 font-medium text-saas-dark">{item.parameter}</td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                            item.statusType === "warning" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-saas-muted font-semibold">{item.petugas || "Kader Posyandu"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2 bg-saas-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-teal-600 transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL EDIT PEMERIKSAAN (BALITA / LANSIA) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Riwayat Periksa - ${selectedLog?.nama || ""}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}

          {selectedLog?.tipe === "Balita" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-saas-muted">Tanggal Periksa</label>
                  <input
                    type="date"
                    required
                    value={bDate}
                    onChange={(e) => setBDate(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Berat Badan (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={bBB}
                    onChange={(e) => setBBB(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Tinggi Badan (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={bTB}
                    onChange={(e) => setBTB(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-saas-muted">Lingkar Kepala (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bLK}
                    onChange={(e) => setBLK(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">LiLA (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bLiLA}
                    onChange={(e) => setBLiLA(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-150 rounded text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bVitA}
                    onChange={(e) => setBVitA(e.target.checked)}
                    className="w-4 h-4 text-saas-primary rounded"
                  />
                  Vitamin A
                </label>
                <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-150 rounded text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bAsi}
                    onChange={(e) => setBAsi(e.target.checked)}
                    className="w-4 h-4 text-saas-primary rounded"
                  />
                  ASI Eksklusif
                </label>
                <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-150 rounded text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bCacing}
                    onChange={(e) => setBCacing(e.target.checked)}
                    className="w-4 h-4 text-saas-primary rounded"
                  />
                  Obat Cacing
                </label>
                <div>
                  <input
                    type="text"
                    placeholder="Pemberian Lain / Imunisasi..."
                    value={bImunisasi}
                    onChange={(e) => setBImunisasi(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-saas-muted">Nama Petugas / Kader Pemeriksa</label>
                <input
                  type="text"
                  placeholder="Nama Petugas..."
                  value={bPetugas}
                  onChange={(e) => setBPetugas(e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary mt-1"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-saas-muted">Tanggal Periksa</label>
                  <input
                    type="date"
                    required
                    value={lDate}
                    onChange={(e) => setLDate(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Berat Badan (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={lBB}
                    onChange={(e) => setLBB(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Tinggi Badan (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={lTB}
                    onChange={(e) => setLTB(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-saas-muted">Sistol (mmHg)</label>
                  <input
                    type="number"
                    required
                    value={lSistol}
                    onChange={(e) => setLSistol(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Diastol (mmHg)</label>
                  <input
                    type="number"
                    required
                    value={lDiastol}
                    onChange={(e) => setLDiastol(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">GDS (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={lGds}
                    onChange={(e) => setLGds(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-saas-muted">Lingkar Perut (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={lLp}
                    onChange={(e) => setLLp(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Kolesterol (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lKol}
                    onChange={(e) => setLKol(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Asam Urat (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lUrat}
                    onChange={(e) => setLUrat(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-saas-muted">Keluhan</label>
                  <textarea
                    rows={2}
                    value={lKeluhan}
                    onChange={(e) => setLKeluhan(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-saas-muted">Tindakan</label>
                  <textarea
                    rows={2}
                    value={lTindakan}
                    onChange={(e) => setLTindakan(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-hairline rounded-pill text-xs font-semibold text-saas-dark hover:bg-surface-soft"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-saas-primary text-white rounded-pill text-xs font-semibold hover:bg-saas-primary-active disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL KONFIRMASI HAPUS PEMERIKSAAN */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Record Riwayat Periksa"
      >
        <div className="space-y-4">
          <p className="text-sm text-saas-dark font-medium">
            Apakah Anda yakin ingin menghapus catatan riwayat pemeriksaan untuk{" "}
            <span className="font-bold text-trend-dangerText">{selectedLog?.nama}</span>?
          </p>
          <p className="text-xs text-saas-muted">
            Catatan pemeriksaan ini akan terhapus secara permanen dari sistem Posyandu.
          </p>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 border border-hairline rounded-pill text-xs font-semibold text-saas-dark hover:bg-surface-soft"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDeleteSubmit}
              disabled={saving}
              className="px-4 py-2 bg-trend-dangerText text-white rounded-pill text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Menghapus..." : "Ya, Hapus Record"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
