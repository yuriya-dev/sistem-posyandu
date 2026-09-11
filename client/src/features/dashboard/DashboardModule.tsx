"use client";

import { useState, useEffect } from "react";
import { dashboardApi, DashboardSummary, DistribusiKehadiran, balitaApi, lansiaApi, TrenGiziItem, AktivitasKunjunganData, ItemAktivitasKunjungan, periodeApi, PeriodePelayanan } from "../../lib/api";
import { formatTanggalIndonesia } from "../../lib/dateUtils";
import Modal from "../../components/Modal";
import PageHelmet from "../../components/PageHelmet";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import {
  ArrowUpRight,
  SlidersHorizontal,
  Download,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  Search,
  Heart,
  X,
  UserCheck2,
  TrendingUp,
  Activity,
  RefreshCw,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import ActionMenu from "../../components/ActionMenu";
import LansiaIcon from "../../components/LansiaIcon";
import BalitaIcon from "../../components/BalitaIcon";
import toast from "react-hot-toast";
import { hitungStatusBbU, hitungStatusTbU, hitungStatusBbTb, hitungIMT } from "../../lib/zScoreCalculator";
import { useAuth } from "../../contexts/AuthContext";

interface DashboardModuleProps {
  searchQuery: string;
  onNavigate: (menu: string, patientId?: string) => void;
  posyanduId: string;
  activePeriode?: PeriodePelayanan | null;
}

interface Kunjungan {
  id: string;
  nama: string;
  tipe: "Balita" | "Lansia";
  detail: string;
  status: string;
  statusType: "success" | "warning" | "info";
  waktu: string;
}

// Patient interface for modal selection
interface Pasien {
  id: string;
  nama: string;
  tipe: "Balita" | "Lansia";
  detailInfo: string; // "12 Bulan" or "RT 02"
  tanggalLahir?: string;
  jenisKelamin?: "L" | "P";
  currentPeriodExam?: any;
}

import { DashboardSkeleton, Skeleton } from "../../components/Skeleton";

export default function DashboardModule({ searchQuery, onNavigate, posyanduId, activePeriode }: DashboardModuleProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"Semua" | "Balita" | "Lansia">("Semua");

  // ── API state ──────────────────────────────────────────────
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [dbPasiens, setDbPasiens] = useState<Pasien[]>([]);
  const [distribusiKehadiran, setDistribusiKehadiran] = useState<DistribusiKehadiran[]>([]);
  const [isDistribusiLoading, setIsDistribusiLoading] = useState(false);

  // ── Aktivitas Kunjungan State ─────────────────────────────
  const [aktivitasData, setAktivitasData] = useState<AktivitasKunjunganData | null>(null);
  const [isAktivitasLoading, setIsAktivitasLoading] = useState(false);
  const [aktivitasTab, setAktivitasTab] = useState<"balita" | "lansia" | "belum_balita" | "belum_lansia">("balita");
  const [aktivitasSearch, setAktivitasSearch] = useState("");

  const fetchAktivitas = () => {
    setIsAktivitasLoading(true);
    dashboardApi
      .getAktivitasKunjungan(posyanduId)
      .then((res) => {
        if (res.success && res.data) {
          setAktivitasData(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsAktivitasLoading(false));
  };

  useEffect(() => {
    fetchAktivitas();
  }, [posyanduId, activePeriode]);

  // ── Action Menu & Detail Modals ──
  const [showDetailAktivitas, setShowDetailAktivitas] = useState(false);
  const [showDetailDistribusi, setShowDetailDistribusi] = useState(false);

  const handleDetailAktivitas = () => setShowDetailAktivitas(true);
  const handleExportAktivitas = () => {
    window.print();
  };

  const handleDetailDistribusi = () => setShowDetailDistribusi(true);
  const handleExportDistribusi = () => {
    window.print();
  };

  // ── Tren Gizi & Z-Score State ──
  const [trenPeriod, setTrenPeriod] = useState<"bulanan" | "tahunan">("bulanan");
  const [trenViewMode, setTrenViewMode] = useState<"status" | "zscore">("status");
  const [trenGiziData, setTrenGiziData] = useState<TrenGiziItem[]>([]);
  const [isTrenGiziLoading, setIsTrenGiziLoading] = useState(false);

  useEffect(() => {
    setIsTrenGiziLoading(true);
    dashboardApi
      .getTrenGizi(posyanduId, trenPeriod)
      .then((res) => {
        if (res.success && res.data) {
          setTrenGiziData(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsTrenGiziLoading(false));
  }, [posyanduId, trenPeriod]);

  const fetchSummary = () => {
    dashboardApi
      .getSummary(posyanduId)
      .then((res) => {
        if (res.success) setSummary(res.data);
      })
      .catch(console.error)
      .finally(() => setIsSummaryLoading(false));
  };

  useEffect(() => {
    setIsSummaryLoading(true);
    fetchSummary();
  }, [posyanduId, activePeriode]);

  useEffect(() => {
    const targetMonth = activePeriode ? activePeriode.bulan : (new Date().getMonth() + 1);
    const targetYear = activePeriode ? activePeriode.tahun : new Date().getFullYear();

    Promise.all([
      balitaApi.getAll(posyanduId),
      lansiaApi.getAll(posyanduId)
    ])
      .then(([balitaRes, lansiaRes]) => {
        const balitas: Pasien[] = (balitaRes.data || []).map((b) => {
          const currentExam = (b.pemeriksaans || []).find((exam) => {
            const d = new Date(exam.tanggalPeriksa);
            return (d.getMonth() + 1) === targetMonth && d.getFullYear() === targetYear;
          });

          return {
            id: b.id,
            nama: b.nama,
            tipe: "Balita",
            detailInfo: `Usia ${b.usiaBulan || calculateAgeInMonths(b.tanggalLahir)} Bulan, Ibu: ${b.namaIbu}`,
            tanggalLahir: b.tanggalLahir,
            jenisKelamin: b.jenisKelamin,
            currentPeriodExam: currentExam,
          };
        });

        const lansias: Pasien[] = (lansiaRes.data || []).map((l) => {
          const currentExam = (l.pemeriksaans || []).find((exam) => {
            const d = new Date(exam.tanggalPeriksa);
            return (d.getMonth() + 1) === targetMonth && d.getFullYear() === targetYear;
          });

          return {
            id: l.id,
            nama: l.nama,
            tipe: "Lansia",
            detailInfo: `RT/RW ${l.rtRw || "-"}`,
            tanggalLahir: l.tanggalLahir,
            jenisKelamin: l.jenisKelamin,
            currentPeriodExam: currentExam,
          };
        });

        setDbPasiens([...balitas, ...lansias]);
      })
      .catch(console.error);
  }, [posyanduId, activePeriode]);

  // Fetch Distribusi Kehadiran RT/RW (Poin 20)
  useEffect(() => {
    setIsDistribusiLoading(true);
    dashboardApi
      .getDistribusiKehadiran(posyanduId)
      .then((res) => {
        if (res.success && res.data) {
          setDistribusiKehadiran(res.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsDistribusiLoading(false));
  }, [posyanduId]);

  const targetMonth = activePeriode ? activePeriode.bulan : (new Date().getUTCMonth() + 1);
  const targetYear = activePeriode ? activePeriode.tahun : new Date().getUTCFullYear();

  const isMatchingPeriod = (tanggalStr?: string) => {
    if (!tanggalStr) return true;
    const d = new Date(tanggalStr);
    return (d.getUTCMonth() + 1) === targetMonth && d.getUTCFullYear() === targetYear;
  };

  const formatJamDanTanggal = (tanggalStr?: string, createdAtStr?: string) => {
    const raw = createdAtStr || tanggalStr;
    if (!raw) return "-";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "-";
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const jamStr = `${hours}:${minutes} WIB`;
    const tglStr = formatTanggalIndonesia(tanggalStr || raw);
    return `${jamStr} • ${tglStr}`;
  };

  const filteredBalitaTerbaru = (summary?.pemeriksaanTerbaru.balita ?? []).filter((p) => isMatchingPeriod(p.tanggalPeriksa));
  const filteredLansiaTerbaru = (summary?.pemeriksaanTerbaru.lansia ?? []).filter((p) => isMatchingPeriod(p.tanggalPeriksa));

  // Build kunjungan list from API data (recent pemeriksaan matching active period)
  const apiKunjungans: Kunjungan[] = [
    ...filteredBalitaTerbaru.map((p, i) => ({
      id: `b-${p.id ?? i}`,
      nama: p.balita.nama,
      tipe: "Balita" as const,
      detail: p.statusBbU ? `BB/U: ${p.statusBbU}` : "-",
      status: "Selesai Periksa",
      statusType: "success" as const,
      waktu: formatJamDanTanggal(p.tanggalPeriksa, p.createdAt),
    })),
    ...filteredLansiaTerbaru.map((p, i) => ({
      id: `l-${p.id ?? i}`,
      nama: p.lansia.nama,
      tipe: "Lansia" as const,
      detail: `${p.tekananDarahSistol}/${p.tekananDarahDiastol} mmHg`,
      status: "Selesai Periksa",
      statusType: "success" as const,
      waktu: formatJamDanTanggal(p.tanggalPeriksa, p.createdAt),
    })),
  ];

  // Real-time additions from quick-exam modal go here
  const [localKunjungans, setLocalKunjungans] = useState<Kunjungan[]>([]);
  const kunjungans = [...localKunjungans, ...apiKunjungans];

  // Popover State 3-Dots Menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Modal State
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);

  // Form Fields - Common
  const [examDate, setExamDate] = useState("2026-07-28");
  const [examBB, setExamBB] = useState("");
  const [examTB, setExamTB] = useState("");

  // Form Fields - Balita
  const [examLK, setExamLK] = useState("");
  const [examBBU, setExamBBU] = useState("Normal");
  const [examTBU, setExamTBU] = useState("Normal");
  const [examBBTB, setExamBBTB] = useState("Normal");
  const [examVitA, setExamVitA] = useState(false);
  const [examLiLA, setExamLiLA] = useState("");
  const [examKms, setExamKms] = useState("N");
  const [examAsi, setExamAsi] = useState(false);
  const [examCacing, setExamCacing] = useState(false);
  const [examImunisasi, setExamImunisasi] = useState("");

  // Form Fields - Lansia
  const [examSistol, setExamSistol] = useState("");
  const [examDiastol, setExamDiastol] = useState("");
  const [examGds, setExamGds] = useState("");
  const [examLp, setExamLp] = useState("");
  const [examCholesterol, setExamCholesterol] = useState("");
  const [examUricAcid, setExamUricAcid] = useState("");
  const [examKeluhan, setExamKeluhan] = useState("");
  const [examTindakan, setExamTindakan] = useState("");

  // Pre-fill form modal jika pasien sudah memiliki data di periode ini
  useEffect(() => {
    if (!selectedPasien) {
      setExamBB("");
      setExamTB("");
      setExamLK("");
      setExamLiLA("");
      setExamVitA(false);
      setExamAsi(false);
      setExamCacing(false);
      setExamImunisasi("");
      setExamSistol("");
      setExamDiastol("");
      setExamGds("");
      setExamLp("");
      setExamCholesterol("");
      setExamUricAcid("");
      setExamKeluhan("");
      setExamTindakan("");
      return;
    }

    const exam = selectedPasien.currentPeriodExam;
    if (exam) {
      if (exam.tanggalPeriksa) {
        setExamDate(new Date(exam.tanggalPeriksa).toISOString().slice(0, 10));
      }
      setExamBB(exam.beratBadan ? String(exam.beratBadan) : "");
      setExamTB(exam.tinggiBadan ? String(exam.tinggiBadan) : "");

      if (selectedPasien.tipe === "Balita") {
        setExamLK(exam.lingkarKepala ? String(exam.lingkarKepala) : "");
        setExamLiLA(exam.lingkarLengan ? String(exam.lingkarLengan) : "");
        setExamKms(exam.statusKms || "N");
        setExamVitA(Boolean(exam.vitaminA));
        setExamAsi(Boolean(exam.asiEksklusif));
        setExamCacing(Boolean(exam.obatCacing));
        setExamImunisasi(exam.statusImunisasi || "");
      } else {
        setExamSistol(exam.tekananDarahSistol ? String(exam.tekananDarahSistol) : "");
        setExamDiastol(exam.tekananDarahDiastol ? String(exam.tekananDarahDiastol) : "");
        setExamGds(exam.gulaDarahSewaktu ? String(exam.gulaDarahSewaktu) : "");
        setExamLp(exam.lingkarPerut ? String(exam.lingkarPerut) : "");
        setExamCholesterol(exam.kolesterol ? String(exam.kolesterol) : "");
        setExamUricAcid(exam.asamUrat ? String(exam.asamUrat) : "");
        setExamKeluhan(exam.keluhan || "");
        setExamTindakan(exam.tindakan || "");
      }
    } else {
      setExamBB("");
      setExamTB("");
      setExamLK("");
      setExamLiLA("");
      setExamVitA(false);
      setExamAsi(false);
      setExamCacing(false);
      setExamImunisasi("");
      setExamSistol("");
      setExamDiastol("");
      setExamGds("");
      setExamLp("");
      setExamCholesterol("");
      setExamUricAcid("");
      setExamKeluhan("");
      setExamTindakan("");
    }
  }, [selectedPasien]);

  // Helper Hitung Usia (Bulan)
  const calculateAgeInMonths = (birthDateStr: string, refDate: Date = new Date()): number => {
    const birth = new Date(birthDateStr);
    let months = (refDate.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += refDate.getMonth();
    return months <= 0 ? 0 : months;
  };

  useEffect(() => {
    if (!selectedPasien || selectedPasien.tipe !== "Balita" || !selectedPasien.tanggalLahir) return;
    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);
    const usia = calculateAgeInMonths(selectedPasien.tanggalLahir, new Date(examDate));
    const jk = selectedPasien.jenisKelamin || "L";
    if (!isNaN(bb) && bb > 0) {
      setExamBBU(hitungStatusBbU(bb, usia, jk as "L" | "P"));
    }
    if (!isNaN(tb) && tb > 0) {
      setExamTBU(hitungStatusTbU(tb, usia, jk as "L" | "P"));
    }
    if (!isNaN(bb) && bb > 0 && !isNaN(tb) && tb > 0) {
      setExamBBTB(hitungStatusBbTb(bb, tb, jk as "L" | "P"));
    }
  }, [examBB, examTB, examDate, selectedPasien]);

  // Warning & Success State
  const [modalError, setModalError] = useState("");
  const [modalWarning, setModalWarning] = useState("");

  // Filter Kunjungan
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  const filteredKunjungan = kunjungans.filter((k) => {
    const matchesSearch = k.nama.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "Semua" || k.tipe === activeTab;
    return matchesSearch && matchesTab;
  });

  const totalPages = Math.ceil(filteredKunjungan.length / itemsPerPage) || 1;
  const paginatedKunjungan = filteredKunjungan.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset pagination to page 1 when filter tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Filter Pasien in Modal
  const filteredPasiens = dbPasiens.filter((p) =>
    p.nama.toLowerCase().includes(modalSearch.toLowerCase())
  );

  // Warning Check
  const checkWarnings = (bbVal: string, sistolVal: string) => {
    setModalWarning("");
    if (!selectedPasien) return;

    const bb = parseFloat(bbVal);
    const sistol = parseInt(sistolVal);

    if (selectedPasien.tipe === "Balita" && bb > 25) {
      setModalWarning("Apakah Berat Badan (>25 kg) sudah sesuai untuk balita ini? Cek kembali.");
    } else if (selectedPasien.tipe === "Lansia" && sistol > 200) {
      setModalWarning("Tekanan darah sistol >200 mmHg sangat tinggi. Mohon rujuk lansia ke puskesmas.");
    }
  };

  // Submit Quick Exam
  const handleQuickExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (!selectedPasien) return;

    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);

    if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0) {
      setModalError("Berat Badan dan Tinggi Badan wajib diisi angka positif.");
      return;
    }

    try {
      if (selectedPasien.tipe === "Balita") {
        const age = calculateAgeInMonths(selectedPasien.tanggalLahir || examDate, new Date(examDate));
        const data = {
          tanggalPeriksa: examDate,
          usiaBulan: age,
          beratBadan: bb,
          tinggiBadan: tb,
          lingkarKepala: examLK ? parseFloat(examLK) : undefined,
          lingkarLengan: examLiLA ? parseFloat(examLiLA) : undefined,
          statusBbU: examBBU,
          statusTbU: examTBU,
          statusBbTb: examBBTB,
          statusKms: examKms,
          vitaminA: examVitA,
          asiEksklusif: examAsi,
          obatCacing: examCacing,
          statusImunisasi: examImunisasi || undefined,
          petugas: user?.nama || "Kader Posyandu",
        };
        await balitaApi.createPemeriksaan(posyanduId, selectedPasien.id, data);
      } else {
        const sis = parseInt(examSistol);
        const dia = parseInt(examDiastol);
        const gds = parseInt(examGds);
        const lp = parseInt(examLp);

        if (isNaN(sis) || isNaN(dia) || isNaN(gds) || isNaN(lp)) {
          setModalError("Kolom tekanan darah, GDS, dan lingkar perut wajib diisi.");
          return;
        }

        const data = {
          tanggalPeriksa: examDate,
          beratBadan: bb,
          tinggiBadan: tb,
          tekananDarahSistol: sis,
          tekananDarahDiastol: dia,
          gulaDarahSewaktu: gds,
          lingkarPerut: lp,
          kolesterol: examCholesterol ? parseInt(examCholesterol) : undefined,
          asamUrat: examUricAcid ? parseFloat(examUricAcid) : undefined,
          keluhan: examKeluhan || undefined,
          tindakan: examTindakan || undefined,
          petugas: user?.nama || "Kader Posyandu",
        };
        await lansiaApi.createPemeriksaan(posyanduId, selectedPasien.id, data);
      }

      toast.success(`Pemeriksaan untuk ${selectedPasien.nama} berhasil dicatat.`);
      fetchSummary();
      fetchAktivitas();

      // Close & Reset
      setIsOpenModal(false);
      setSelectedPasien(null);
      setModalSearch("");
      setExamBB("");
      setExamTB("");
      setExamLK("");
      setExamSistol("");
      setExamDiastol("");
      setExamGds("");
      setExamLp("");
      setExamLiLA("");
      setExamCholesterol("");
      setExamUricAcid("");
      setExamKeluhan("");
      setExamTindakan("");
      setExamKms("N");
      setExamAsi(false);
      setExamCacing(false);
      setExamImunisasi("");
      setModalWarning("");
    } catch (err: any) {
      const msg = err.message || "Gagal menyimpan pemeriksaan.";
      setModalError(msg);
      toast.error(msg);
    }
  };

  if (isSummaryLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <PageHelmet
        title="Dashboard Overview"
        description="Ringkasan statistik data balita, lansia, dan grafik status gizi Posyandu."
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-hairline pb-4 sm:pb-6">
        <div>
          <span className="inline-block px-2.5 py-0.5 bg-teal-50 text-saas-primary rounded-pill text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase mb-1">
            Ringkasan Real-Time
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold sm:font-normal text-saas-dark tracking-tight">Dashboard Overview</h2>
          <p className="text-xs sm:text-sm text-saas-muted mt-0.5 sm:mt-1 font-normal">
            Pantau pertumbuhan anak dan kondisi kesehatan lansia secara terpusat.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsOpenModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-saas-primary hover:bg-saas-primary-active text-white text-xs font-semibold rounded-pill transition-all shadow-md shadow-teal-500/10"
          >
            <Plus className="w-4 h-4" /> Catat Pemeriksaan
          </button>
          <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 border border-hairline rounded-pill bg-white text-xs font-semibold text-saas-dark hover:bg-surface-soft transition-all">
            <Download className="w-3.5 h-3.5 text-saas-muted" /> Export
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards Grid — Unified Coinbase Feature Card Layout (2x2 di Mobile) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {/* Card 1: Toska / Mint (Total Balita) */}
        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-card p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between h-36 sm:h-44 shadow-soft-card group text-white">
          <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <button 
            onClick={() => onNavigate("Balita")}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/30 transition-colors z-10"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </button>
          
          <div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-white/80 font-medium">Total Balita</span>
            <h3 className="text-2xl sm:text-3xl font-mono font-medium mt-0.5 sm:mt-1">
              {isSummaryLoading ? "…" : `${summary?.totalBalita ?? 0}`}
            </h3>
            <span className="text-[11px] sm:text-xs text-white/70 font-sans block">Anak Terdaftar</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-white/90 z-10">
            <span className="px-2 py-0.5 rounded-pill bg-white/20 text-white text-[9px] sm:text-[10px] font-mono">LIVE</span>
            <span className="hidden sm:inline">Update Hari Ini</span>
          </div>
        </div>

        {/* Card 2: Royal Blue / Indigo (Total Lansia) */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-card p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between h-36 sm:h-44 shadow-soft-card group text-white">
          <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <button 
            onClick={() => onNavigate("Lansia")}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/30 transition-colors z-10"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </button>

          <div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-white/80 font-medium">Total Lansia</span>
            <h3 className="text-2xl sm:text-3xl font-mono font-medium mt-0.5 sm:mt-1">
              {isSummaryLoading ? "…" : `${summary?.totalLansia ?? 0}`}
            </h3>
            <span className="text-[11px] sm:text-xs text-white/70 font-sans block">Jiwa Terdaftar</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-white/90 z-10">
            <span className="px-2 py-0.5 rounded-pill bg-white/20 text-white text-[9px] sm:text-[10px] font-mono">TERPANTAU</span>
            <span className="hidden sm:inline">Pemeriksaan Rutin</span>
          </div>
        </div>

        {/* Card 3: Rose / Crimson (Balita Gizi Kurang) */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-card p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between h-36 sm:h-44 shadow-soft-card group text-white">
          <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <button 
            onClick={() => onNavigate("Balita")}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/30 transition-colors z-10"
          >
            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </button>

          <div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-white/80 font-medium">Perhatian Gizi</span>
            <h3 className="text-2xl sm:text-3xl font-mono font-medium mt-0.5 sm:mt-1">
              {isSummaryLoading ? "…" : `${(summary?.statusGizi?.bbU?.["Kurang"] ?? 0) + (summary?.statusGizi?.bbU?.["Sangat Kurang"] ?? 0) + (summary?.statusGizi?.bbU?.["K"] ?? 0) + (summary?.statusGizi?.bbU?.["SK"] ?? 0)}`}
            </h3>
            <span className="text-[11px] sm:text-xs text-white/70 font-sans block">Gizi Kurang / Buruk</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-white/90 z-10">
            <span className="px-2 py-0.5 rounded-pill bg-white/20 text-white text-[9px] sm:text-[10px] font-mono">ALERT</span>
            <span className="hidden sm:inline">Pendampingan</span>
          </div>
        </div>

        {/* Card 4: Slate Dark (Lansia Hipertensi) */}
        <div className="bg-gradient-to-br from-slate-900 to-surface-dark rounded-card p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between h-36 sm:h-44 shadow-elevated group text-white border border-white/10">
          <div className="absolute -right-4 -bottom-4 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500" />
          <button 
            onClick={() => onNavigate("Lansia")}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          </button>

          <div>
            <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-saas-muted-soft font-medium">Hipertensi</span>
            <h3 className="text-2xl sm:text-3xl font-mono font-medium mt-0.5 sm:mt-1 text-white">
              {isSummaryLoading ? "…" : `${summary?.lansiaHtDm?.totalHt ?? 0}`}
            </h3>
            <span className="text-[11px] sm:text-xs text-saas-muted-soft font-sans block">Lansia Terdiagnosa</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium text-amber-300 z-10">
            <span className="px-2 py-0.5 rounded-pill bg-amber-500/20 text-amber-300 text-[9px] sm:text-[10px] font-mono font-semibold">MONITOR</span>
            <span className="hidden sm:inline text-saas-muted-soft">Berkala</span>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tren Status Gizi Balita (Recharts & WHO Z-Score) */}
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="font-bold text-base text-saas-dark flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-saas-primary" />
                Tren Status Gizi & Z-Score Balita
              </h3>
              <p className="text-xs text-saas-muted mt-0.5">
                Agregasi data historis {trenPeriod === "bulanan" ? "bulanan" : "tahunan"} & kurva presisi Z-score WHO
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle Mode Display */}
              <div className="flex items-center gap-1 bg-gray-100/80 rounded-lg p-1">
                <button
                  onClick={() => setTrenViewMode("status")}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                    trenViewMode === "status"
                      ? "bg-white text-saas-dark shadow-sm"
                      : "text-saas-muted hover:text-saas-dark"
                  }`}
                >
                  Status Gizi
                </button>
                <button
                  onClick={() => setTrenViewMode("zscore")}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                    trenViewMode === "zscore"
                      ? "bg-white text-saas-dark shadow-sm"
                      : "text-saas-muted hover:text-saas-dark"
                  }`}
                >
                  Kurva Z-Score WHO
                </button>
              </div>

              {/* Toggle Period */}
              <div className="flex items-center gap-1 bg-gray-100/80 rounded-lg p-1">
                <button
                  onClick={() => setTrenPeriod("bulanan")}
                  className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all ${
                    trenPeriod === "bulanan"
                      ? "bg-saas-primary text-white shadow-sm"
                      : "text-saas-muted hover:text-saas-dark"
                  }`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => setTrenPeriod("tahunan")}
                  className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all ${
                    trenPeriod === "tahunan"
                      ? "bg-saas-primary text-white shadow-sm"
                      : "text-saas-muted hover:text-saas-dark"
                  }`}
                >
                  Tahunan
                </button>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            {isTrenGiziLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-saas-muted">
                Memuat data grafik tren gizi...
              </div>
            ) : trenGiziData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-saas-muted">
                Belum ada data pemeriksaan balita untuk periode ini.
              </div>
            ) : trenViewMode === "status" ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trenGiziData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", fontSize: "12px" }}
                    formatter={(value: any, name: any) => [
                      value,
                      name === "normal"
                        ? "Gizi Normal (BB/U)"
                        : name === "kurang"
                        ? "Gizi Kurang (BB/U)"
                        : name === "sangatKurang"
                        ? "Gizi Buruk/SK (BB/U)"
                        : name === "stunting"
                        ? "Stunting (TB/U)"
                        : String(name || ""),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <Bar dataKey="normal" name="Gizi Normal" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="kurang" name="Gizi Kurang" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sangatKurang" name="Gizi Buruk" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="stunting" name="Stunting (TB/U)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trenGiziData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis domain={[-4, 4]} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", fontSize: "12px" }}
                    formatter={(val: any, name: any) => [
                      `${val} SD`,
                      name === "avgZScoreBBU"
                        ? "Rata-rata Z-Score BB/U"
                        : name === "avgZScoreTBU"
                        ? "Rata-rata Z-Score TB/U"
                        : String(name || ""),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                  <ReferenceLine y={0} label={{ value: "Median WHO (0 SD)", fill: "#10b981", fontSize: 10 }} stroke="#10b981" strokeDasharray="4 4" />
                  <ReferenceLine y={-2} label={{ value: "Batas Stunting/K (-2 SD)", fill: "#ef4444", fontSize: 10 }} stroke="#ef4444" strokeDasharray="4 4" />
                  <ReferenceLine y={2} label={{ value: "Batas Lebih (+2 SD)", fill: "#f59e0b", fontSize: 10 }} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="avgZScoreBBU" name="Rata-rata Z-Score BB/U" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="avgZScoreTBU" name="Rata-rata Z-Score TB/U" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Aktivitas Kunjungan (Donut Chart) */}
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base text-saas-dark">Aktivitas Kunjungan</h3>
              <p className="text-xs text-saas-muted mt-0.5">Tingkat partisipasi kader & posyandu</p>
            </div>
            <button
              onClick={() => handleDetailAktivitas()}
              className="p-1.5 hover:bg-gray-100 text-saas-muted hover:text-saas-dark rounded-lg transition-colors"
              title="Lihat Detail Aktivitas"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>

          {isAktivitasLoading ? (
            <div className="py-12 text-center text-xs text-saas-muted">Memuat data aktivitas...</div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#F3F4F6"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#14B8A6"
                    strokeWidth="10"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * (aktivitasData?.persentaseSelesai ?? 0)) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center text-center">
                  <span className="text-2xl font-black text-saas-dark leading-none">
                    {aktivitasData?.persentaseSelesai ?? 0}%
                  </span>
                  <span className="text-[10px] text-saas-muted font-bold uppercase tracking-wider mt-1">Selesai</span>
                </div>
              </div>

              <div className="w-full space-y-2 mt-6">
                {[
                  {
                    key: "balita" as const,
                    label: "Balita Selesai Periksa",
                    count: `${aktivitasData?.balitaSelesaiCount ?? 0} Anak`,
                    color: "bg-sky-500",
                  },
                  {
                    key: "lansia" as const,
                    label: "Lansia Selesai Periksa",
                    count: `${aktivitasData?.lansiaSelesaiCount ?? 0} Lansia`,
                    color: "bg-emerald-500",
                  },
                  {
                    key: "belum_balita" as const,
                    label: "Balita Belum Periksa",
                    count: `${(aktivitasData?.belumMengisiList ?? []).filter(i => i.tipe === 'Balita').length} Anak`,
                    color: "bg-amber-400",
                  },
                  {
                    key: "belum_lansia" as const,
                    label: "Lansia Belum Periksa",
                    count: `${(aktivitasData?.belumMengisiList ?? []).filter(i => i.tipe === 'Lansia').length} Lansia`,
                    color: "bg-orange-400",
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setAktivitasTab(item.key);
                      setShowDetailAktivitas(true);
                    }}
                    className="w-full flex items-center justify-between text-xs border-b border-gray-50 pb-2.5 pt-1.5 hover:bg-gray-50/80 px-2 rounded-lg transition-colors group cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}></span>
                      <span className="text-saas-muted group-hover:text-saas-dark font-semibold transition-colors">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-saas-dark">{item.count}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-saas-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kunjungan Terakhir Table */}
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
              <div>
                <h3 className="font-bold text-base text-saas-dark flex items-center gap-2">
                  Riwayat Antrean & Kunjungan Terkini
                </h3>
                <p className="text-xs text-saas-muted mt-0.5">Umpan aktivitas pemeriksaan pelayanan posyandu terbaru</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => onNavigate("Riwayat")}
                  className="text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100/70 border border-teal-200/60 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0"
                  title="Buka Halaman Riwayat Lengkap"
                >
                  Lihat Semua di Riwayat &rarr;
                </button>

                <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100/50">
                  {(["Semua", "Balita", "Lansia"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-xs px-3.5 py-1.5 rounded-md font-bold transition-all ${
                        activeTab === tab 
                          ? "bg-white text-saas-primary shadow-sm" 
                          : "text-saas-muted hover:text-saas-dark"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                  <th className="px-4 pb-3 text-left whitespace-nowrap">Nama</th>
                  <th className="px-4 pb-3 text-left whitespace-nowrap">Kategori</th>
                  <th className="px-4 pb-3 text-left whitespace-nowrap">Keterangan</th>
                  <th className="px-4 pb-3 text-right whitespace-nowrap">Jam &amp; Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {paginatedKunjungan.length > 0 ? (
                  paginatedKunjungan.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40 transition-colors text-sm">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            const realId = item.id.replace(/^(b-|l-)/, '');
                            onNavigate(item.tipe === "Balita" ? "Balita" : "Lansia", realId);
                          }}
                          className="font-bold text-saas-dark hover:text-saas-primary hover:underline transition-colors text-left"
                          title={`Lihat Profil ${item.nama}`}
                        >
                          {item.nama}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-saas-muted font-medium whitespace-nowrap">{item.tipe}</td>
                      <td className="px-4 py-3.5 text-saas-muted font-medium whitespace-nowrap">{item.detail}</td>
                      <td className="px-4 py-3.5 text-right text-saas-muted font-semibold whitespace-nowrap">{item.waktu}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-saas-muted font-medium">
                      Tidak menemukan data kunjungan yang cocok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredKunjungan.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 mt-4 text-xs">
              <p className="text-saas-muted font-semibold">
                Menampilkan{" "}
                <span className="text-saas-dark font-bold">
                  {Math.min((currentPage - 1) * itemsPerPage + 1, filteredKunjungan.length)}
                </span>{" "}
                -{" "}
                <span className="text-saas-dark font-bold">
                  {Math.min(currentPage * itemsPerPage, filteredKunjungan.length)}
                </span>{" "}
                dari <span className="text-saas-dark font-bold">{filteredKunjungan.length}</span> data
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-saas-dark hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Halaman Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      currentPage === page
                        ? "bg-saas-primary text-white shadow-sm"
                        : "text-saas-muted hover:text-saas-dark hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-saas-dark hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Halaman Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Distribusi RT/RW */}
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base text-saas-dark">Distribusi Kehadiran RT/RW</h3>
              <p className="text-xs text-saas-muted mt-0.5">Tingkat kehadiran per wilayah</p>
            </div>
          </div>

          <div className="space-y-6">
            {isDistribusiLoading ? (
              <div className="flex items-center justify-center py-8 text-xs text-saas-muted">
                Memuat data distribusi kehadiran...
              </div>
            ) : distribusiKehadiran.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-saas-muted">
                Belum ada data kehadiran tersedia.
              </div>
            ) : (
              distribusiKehadiran.map((row, i) => {
                // Dynamic color based on percentage
                let color = "bg-saas-primary";
                if (row.persentase < 30) color = "bg-red-400";
                else if (row.persentase < 50) color = "bg-yellow-400";
                else if (row.persentase < 70) color = "bg-indigo-500";
                else if (row.persentase < 85) color = "bg-green-500";

                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-saas-dark font-bold">{row.rtRw}</span>
                      <span className="text-saas-muted font-bold">{row.persentase}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100/20">
                        <div style={{ width: `${row.persentase}%` }} className={`h-full rounded-full ${color}`}></div>
                      </div>
                      <span className="text-[10px] text-saas-muted font-semibold whitespace-nowrap">{row.hadir}/{row.total}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE MODAL: QUICK EXAMINATION INPUT */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isOpenModal}
        onClose={() => {
          setIsOpenModal(false);
          setSelectedPasien(null);
          setModalSearch("");
        }}
        title="Catat Pemeriksaan Cepat"
        description="Input rekam medis bulanan langsung tanpa membuka detail profil."
        type="modal"
      >
        {!selectedPasien ? (
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ketik nama balita atau lansia..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                  />
                  <Search className="absolute left-3.5 top-3 text-saas-muted w-4 h-4" />
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredPasiens.length > 0 ? (
                    filteredPasiens.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPasien(p)}
                        className="w-full text-left p-3 border border-gray-100 hover:border-saas-primary/30 hover:bg-gray-50/50 rounded-xl flex items-center justify-between text-xs transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            p.tipe === "Balita" ? "bg-teal-50 text-saas-primary" : "bg-red-50 text-red-500"
                          }`}>
                            {p.tipe === "Balita" ? <BalitaIcon className="w-4 h-4" gender={p.jenisKelamin} /> : <LansiaIcon className="w-4 h-4" gender={p.jenisKelamin} />}
                          </div>
                          <div>
                            <p className="font-bold text-saas-dark group-hover:text-saas-primary transition-colors">{p.nama}</p>
                            <p className="text-[10px] text-saas-muted font-semibold mt-0.5">{p.detailInfo}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-saas-muted group-hover:text-saas-primary transition-colors">Pilih & Lanjut →</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-center text-xs text-saas-muted py-6 font-semibold">Nama warga tidak ditemukan.</p>
                  )}
                </div>
              </div>
            ) : (
              // Step 2: Show Form based on Patient Type
              <form onSubmit={handleQuickExamSubmit} className="space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {modalError}
                  </div>
                )}
                {modalWarning && (
                  <div className="p-3 bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-lg text-xs font-semibold flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {modalWarning}
                  </div>
                )}

                {/* Selected patient preview box */}
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-saas-dark">Mencatat data untuk:</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      selectedPasien.tipe === "Balita" ? "bg-teal-50 text-saas-primary" : "bg-red-50 text-red-500"
                    }`}>
                      {selectedPasien.nama} ({selectedPasien.tipe})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPasien(null);
                      setModalWarning("");
                      setModalError("");
                    }}
                    className="text-xs text-saas-primary font-bold hover:underline"
                  >
                    Ganti
                  </button>
                </div>

                <div className={`grid grid-cols-1 ${selectedPasien.tipe === "Lansia" ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4 border-t border-gray-50 pt-3`}>
                  {/* Tanggal */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted uppercase">Tanggal Periksa</label>
                    <input
                      type="date"
                      value={examDate}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                    />
                  </div>

                  {/* BB */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted uppercase">Berat Badan (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Cth: 8.5"
                      value={examBB}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/-/g, "");
                        setExamBB(val);
                        checkWarnings(val, examSistol);
                      }}
                      className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* TB */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted uppercase">Tinggi Badan (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Cth: 72"
                      value={examTB}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamTB(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* IMT - Calculated Live */}
                  {selectedPasien.tipe === "Lansia" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-teal-600 uppercase">IMT (Otomatis)</label>
                      <input
                        type="text"
                        disabled
                        value={
                          parseFloat(examBB) > 0 && parseFloat(examTB) > 0
                            ? hitungIMT(parseFloat(examBB), parseFloat(examTB))
                            : "-"
                        }
                        className="w-full p-2 bg-teal-50/50 border border-teal-150 rounded-lg text-xs font-bold text-teal-700 cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>

                {/* Balita Specific Inputs */}
                {selectedPasien.tipe === "Balita" && (
                  <div className="space-y-4 border-t border-gray-50 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Lingkar Kepala */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Lingkar Kepala (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="Opsional, cth: 44"
                          value={examLK}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamLK(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>

                      {/* Lingkar Lengan (LiLA) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Lingkar Lengan (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="Cth: 12.5"
                          value={examLiLA}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamLiLA(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>

                      {/* Status Imunisasi */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Imunisasi</label>
                        <input
                          type="text"
                          placeholder="Cth: BCG, Polio 1"
                          value={examImunisasi}
                          onChange={(e) => setExamImunisasi(e.target.value)}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      {/* Checkboxes: Vitamin A, ASI Eksklusif, Obat Cacing */}
                      <div className="flex items-center pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={examVitA}
                            onChange={(e) => setExamVitA(e.target.checked)}
                            className="w-4.5 h-4.5 text-saas-primary focus:ring-saas-primary/30"
                          />
                          <span className="text-xs font-bold text-saas-dark">Pemberian Vitamin A</span>
                        </label>
                      </div>

                      <div className="flex items-center pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={examAsi}
                            onChange={(e) => setExamAsi(e.target.checked)}
                            className="w-4.5 h-4.5 text-saas-primary focus:ring-saas-primary/30"
                          />
                          <span className="text-xs font-bold text-saas-dark">ASI Eksklusif</span>
                        </label>
                      </div>

                      <div className="flex items-center pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={examCacing}
                            onChange={(e) => setExamCacing(e.target.checked)}
                            className="w-4.5 h-4.5 text-saas-primary focus:ring-saas-primary/30"
                          />
                          <span className="text-xs font-bold text-saas-dark">Obat Cacing</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      {/* WHO Statuses (Calculated) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Status BB/U (Otomatis)</label>
                        <select
                          value={examBBU}
                          disabled
                          className="w-full p-2 bg-gray-150 border border-gray-150 rounded-lg text-xs font-bold text-saas-dark focus:outline-none cursor-not-allowed"
                        >
                          <option value="Normal">Normal</option>
                          <option value="Kurang">Kurang</option>
                          <option value="Sangat Kurang">Sangat Kurang</option>
                          <option value="Lebih">Lebih</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Status TB/U (Otomatis)</label>
                        <select
                          value={examTBU}
                          disabled
                          className="w-full p-2 bg-gray-150 border border-gray-150 rounded-lg text-xs font-bold text-saas-dark focus:outline-none cursor-not-allowed"
                        >
                          <option value="Normal">Normal</option>
                          <option value="Pendek">Pendek</option>
                          <option value="Sangat Pendek">Sangat Pendek</option>
                          <option value="Tinggi">Tinggi</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Status BB/TB (Otomatis)</label>
                        <select
                          value={examBBTB}
                          disabled
                          className="w-full p-2 bg-gray-150 border border-gray-150 rounded-lg text-xs font-bold text-saas-dark focus:outline-none cursor-not-allowed"
                        >
                          <option value="Normal">Normal</option>
                          <option value="Kurus">Kurus</option>
                          <option value="Sangat Kurus">Sangat Kurus</option>
                          <option value="Gemuk">Gemuk</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lansia Specific Inputs */}
                {selectedPasien.tipe === "Lansia" && (
                  <div className="space-y-4 border-t border-gray-50 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* Sistol */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Sistol (mmHg)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="TD atas, cth: 130"
                          value={examSistol}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/-/g, "");
                            setExamSistol(val);
                            checkWarnings(examBB, val);
                          }}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>

                      {/* Diastol */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Diastol (mmHg)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="TD bawah, cth: 85"
                          value={examDiastol}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamDiastol(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>

                      {/* GDS */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">GDS (mg/dL)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Cth: 120"
                          value={examGds}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamGds(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>

                      {/* Lingkar Perut */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Lingkar Perut (cm)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Cth: 90"
                          value={examLp}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamLp(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Kolesterol */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Kolesterol (mg/dL)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="cth: 180"
                          value={examCholesterol}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamCholesterol(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>

                      {/* Asam Urat */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Asam Urat (mg/dL)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          placeholder="cth: 6.2"
                          value={examUricAcid}
                          onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                          onChange={(e) => setExamUricAcid(e.target.value.replace(/-/g, ""))}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Keluhan */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Keluhan Saat Ini</label>
                        <textarea
                          placeholder="Tulis keluhan atau sakit yang dirasakan..."
                          rows={2}
                          value={examKeluhan}
                          onChange={(e) => setExamKeluhan(e.target.value)}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50 resize-none"
                        />
                      </div>

                      {/* Tindakan */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-saas-muted uppercase">Tindakan / Rujukan</label>
                        <textarea
                          placeholder="Tulis rujukan, obat, atau tindakan..."
                          rows={2}
                          value={examTindakan}
                          onChange={(e) => setExamTindakan(e.target.value)}
                          className="w-full p-2 bg-gray-50 border border-gray-150 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-gray-50 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPasien(null);
                      setModalError("");
                      setModalWarning("");
                    }}
                    className="px-4 py-2 border border-gray-200 text-saas-dark text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-lg shadow-md shadow-teal-500/10 transition-colors"
                  >
                    Simpan Hasil Pemeriksaan
                  </button>
                </div>
              </form>
            )}
      </Modal>

      {/* Modal Detail Aktivitas Kunjungan */}
      <Modal
        isOpen={showDetailAktivitas}
        onClose={() => setShowDetailAktivitas(false)}
        title="Detail Aktivitas Kunjungan Posyandu"
      >
        <div className="space-y-4 max-w-xl">
          {/* Header Stats Selector Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setAktivitasTab("balita")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                aktivitasTab === "balita"
                  ? "bg-sky-50 border-sky-300 ring-2 ring-sky-400/20"
                  : "bg-gray-50/60 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1 text-sky-700 font-bold text-[11px] mb-0.5 truncate">
                <BalitaIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Balita Selesai</span>
              </div>
              <div className="text-base font-black text-saas-dark">
                {aktivitasData?.balitaSelesaiCount ?? 0} <span className="text-[10px] font-normal text-saas-muted">Anak</span>
              </div>
            </button>

            <button
              onClick={() => setAktivitasTab("lansia")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                aktivitasTab === "lansia"
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20"
                  : "bg-gray-50/60 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px] mb-0.5 truncate">
                <LansiaIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Lansia Selesai</span>
              </div>
              <div className="text-base font-black text-saas-dark">
                {aktivitasData?.lansiaSelesaiCount ?? 0} <span className="text-[10px] font-normal text-saas-muted">Lansia</span>
              </div>
            </button>

            <button
              onClick={() => setAktivitasTab("belum_balita")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                aktivitasTab === "belum_balita"
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/20"
                  : "bg-gray-50/60 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1 text-amber-700 font-bold text-[11px] mb-0.5 truncate">
                <BalitaIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Balita Belum</span>
              </div>
              <div className="text-base font-black text-saas-dark">
                {(aktivitasData?.belumMengisiList ?? []).filter(i => i.tipe === "Balita").length}{" "}
                <span className="text-[10px] font-normal text-saas-muted">Anak</span>
              </div>
            </button>

            <button
              onClick={() => setAktivitasTab("belum_lansia")}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                aktivitasTab === "belum_lansia"
                  ? "bg-orange-50 border-orange-300 ring-2 ring-orange-400/20"
                  : "bg-gray-50/60 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1 text-orange-700 font-bold text-[11px] mb-0.5 truncate">
                <LansiaIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Lansia Belum</span>
              </div>
              <div className="text-base font-black text-saas-dark">
                {(aktivitasData?.belumMengisiList ?? []).filter(i => i.tipe === "Lansia").length}{" "}
                <span className="text-[10px] font-normal text-saas-muted">Lansia</span>
              </div>
            </button>
          </div>

          {/* Search filter in modal */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama pasien atau keterangan..."
              value={aktivitasSearch}
              onChange={(e) => setAktivitasSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-saas-primary"
            />
            {aktivitasSearch && (
              <button
                onClick={() => setAktivitasSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* List display */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {aktivitasTab === "balita" && (
              <>
                {(aktivitasData?.balitaSelesaiList ?? [])
                  .filter((item) =>
                    item.nama.toLowerCase().includes(aktivitasSearch.toLowerCase()) ||
                    item.detailInfo.toLowerCase().includes(aktivitasSearch.toLowerCase())
                  )
                  .map((item) => {
                    const isFemale = item.jenisKelamin === "P" || item.jenisKelamin === "Perempuan";
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-white border border-gray-150 rounded-xl shadow-xs flex items-center justify-between hover:border-sky-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setShowDetailAktivitas(false);
                              onNavigate("Balita", item.id);
                            }}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              isFemale ? "bg-pink-50 border-pink-100" : "bg-blue-50 border-blue-100"
                            }`}
                            title="Lihat Profil Balita"
                          >
                            <BalitaIcon className="w-5 h-5" gender={item.jenisKelamin} />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setShowDetailAktivitas(false);
                                  onNavigate("Balita", item.id);
                                }}
                                className="font-bold text-xs text-saas-dark hover:text-saas-primary hover:underline text-left cursor-pointer"
                              >
                                {item.nama}
                              </button>
                              <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-semibold">
                                Balita
                              </span>
                            </div>
                            <p className="text-[11px] text-saas-muted">{item.detailInfo}</p>
                            {item.detailPemeriksaan && (
                              <p className="text-[11px] font-semibold text-sky-700 mt-0.5">
                                {item.detailPemeriksaan}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right hidden sm:block">
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md inline-block mb-1">
                              Selesai Periksa
                            </span>
                            {item.tanggalPeriksa && (
                              <p className="text-[10px] text-saas-muted">
                                {formatTanggalIndonesia(item.tanggalPeriksa)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setShowDetailAktivitas(false);
                              onNavigate("Balita", item.id);
                            }}
                            className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Buka profil lengkap balita"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Profil</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {(aktivitasData?.balitaSelesaiList ?? []).filter((item) =>
                  item.nama.toLowerCase().includes(aktivitasSearch.toLowerCase()) ||
                  item.detailInfo.toLowerCase().includes(aktivitasSearch.toLowerCase())
                ).length === 0 && (
                  <div className="py-8 text-center text-xs text-saas-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Tidak ada balita selesai periksa ditemukan.
                  </div>
                )}
              </>
            )}

            {aktivitasTab === "lansia" && (
              <>
                {(aktivitasData?.lansiaSelesaiList ?? [])
                  .filter((item) =>
                    item.nama.toLowerCase().includes(aktivitasSearch.toLowerCase()) ||
                    item.detailInfo.toLowerCase().includes(aktivitasSearch.toLowerCase())
                  )
                  .map((item) => {
                    const isFemale = item.jenisKelamin === "P" || item.jenisKelamin === "Perempuan";
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-white border border-gray-150 rounded-xl shadow-xs flex items-center justify-between hover:border-emerald-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setShowDetailAktivitas(false);
                              onNavigate("Lansia", item.id);
                            }}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              isFemale ? "bg-pink-50 border-pink-100" : "bg-blue-50 border-blue-100"
                            }`}
                            title="Lihat Profil Lansia"
                          >
                            <LansiaIcon className="w-5 h-5" gender={item.jenisKelamin} />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setShowDetailAktivitas(false);
                                  onNavigate("Lansia", item.id);
                                }}
                                className="font-bold text-xs text-saas-dark hover:text-saas-primary hover:underline text-left cursor-pointer"
                              >
                                {item.nama}
                              </button>
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                                Lansia
                              </span>
                            </div>
                            <p className="text-[11px] text-saas-muted">{item.detailInfo}</p>
                            {item.detailPemeriksaan && (
                              <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                                {item.detailPemeriksaan}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right hidden sm:block">
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md inline-block mb-1">
                              Selesai Periksa
                            </span>
                            {item.tanggalPeriksa && (
                              <p className="text-[10px] text-saas-muted">
                                {formatTanggalIndonesia(item.tanggalPeriksa)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setShowDetailAktivitas(false);
                              onNavigate("Lansia", item.id);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Buka profil lengkap lansia"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Profil</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {(aktivitasData?.lansiaSelesaiList ?? []).filter((item) =>
                  item.nama.toLowerCase().includes(aktivitasSearch.toLowerCase()) ||
                  item.detailInfo.toLowerCase().includes(aktivitasSearch.toLowerCase())
                ).length === 0 && (
                  <div className="py-8 text-center text-xs text-saas-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Tidak ada lansia selesai periksa ditemukan.
                  </div>
                )}
              </>
            )}

            {(aktivitasTab === "belum_balita" || aktivitasTab === "belum_lansia") && (
              <>
                {(aktivitasData?.belumMengisiList ?? [])
                  .filter((item) => item.tipe === (aktivitasTab === "belum_balita" ? "Balita" : "Lansia"))
                  .filter((item) =>
                    item.nama.toLowerCase().includes(aktivitasSearch.toLowerCase()) ||
                    item.detailInfo.toLowerCase().includes(aktivitasSearch.toLowerCase())
                  )
                  .map((item) => {
                    const isFemale = item.jenisKelamin === "P" || item.jenisKelamin === "Perempuan";
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-white border border-amber-150 rounded-xl shadow-xs flex items-center justify-between hover:border-amber-300 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setShowDetailAktivitas(false);
                              onNavigate(item.tipe, item.id);
                            }}
                            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                              isFemale ? "bg-pink-50 border-pink-100" : "bg-blue-50 border-blue-100"
                            }`}
                            title={`Lihat Profil ${item.tipe}`}
                          >
                            {item.tipe === "Balita" ? <BalitaIcon className="w-5 h-5" gender={item.jenisKelamin} /> : <LansiaIcon className="w-5 h-5" gender={item.jenisKelamin} />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setShowDetailAktivitas(false);
                                  onNavigate(item.tipe, item.id);
                                }}
                                className="font-bold text-xs text-saas-dark hover:text-saas-primary hover:underline text-left cursor-pointer"
                              >
                                {item.nama}
                              </button>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  item.tipe === "Balita"
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {item.tipe}
                              </span>
                            </div>
                            <p className="text-[11px] text-saas-muted">{item.detailInfo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setShowDetailAktivitas(false);
                              onNavigate(item.tipe, item.id);
                            }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-saas-dark font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Buka profil lengkap"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Profil</span>
                          </button>
                          <button
                            onClick={() => {
                              const targetPasien = dbPasiens.find((p) => p.id === item.id) || {
                                id: item.id,
                                nama: item.nama,
                                tipe: item.tipe,
                                detailInfo: item.detailInfo,
                              };
                              setSelectedPasien(targetPasien);
                              setShowDetailAktivitas(false);
                              setIsOpenModal(true);
                            }}
                            className="px-2.5 py-1 bg-saas-primary hover:bg-teal-600 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Input Data</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                {(aktivitasData?.belumMengisiList ?? [])
                  .filter((item) => item.tipe === (aktivitasTab === "belum_balita" ? "Balita" : "Lansia"))
                  .filter((item) =>
                    item.nama.toLowerCase().includes(aktivitasSearch.toLowerCase()) ||
                    item.detailInfo.toLowerCase().includes(aktivitasSearch.toLowerCase())
                  ).length === 0 && (
                  <div className="py-8 text-center text-xs text-emerald-600 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200 font-semibold">
                    🎉 Luar biasa! Semua {aktivitasTab === "belum_balita" ? "balita" : "lansia"} telah mengisi data pemeriksaan.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal Detail Distribusi Kehadiran */}
      <Modal
        isOpen={showDetailDistribusi}
        onClose={() => setShowDetailDistribusi(false)}
        title="Detail Distribusi Kehadiran per RT/RW"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {distribusiKehadiran.length > 0 ? (
            distribusiKehadiran.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 text-xs">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-saas-dark">{item.rtRw}</span>
                  <span className="bg-saas-primary/10 text-saas-primary px-2.5 py-0.5 rounded-full text-xs font-bold">{item.persentase}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                  <div style={{ width: `${item.persentase}%` }} className="h-full bg-saas-primary rounded-full"></div>
                </div>
                <div className="text-[11px] text-saas-muted text-right font-medium">{item.hadir} dari {item.total} Warga Hadir</div>
              </div>
            ))
          ) : (
            <p className="text-xs text-saas-muted text-center py-4">Belum ada data distribusi kehadiran.</p>
          )}
        </div>
      </Modal>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-saas-dark text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
