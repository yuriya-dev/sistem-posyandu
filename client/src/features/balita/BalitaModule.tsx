"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "../../components/Modal";
import PageHelmet from "../../components/PageHelmet";
import {
  ArrowLeft,
  Plus,
  Search,
  Calendar,
  User,
  MapPin,
  Heart,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  ChevronRight,
  Phone,
  TrendingUp
} from "lucide-react";
import BalitaIcon from "../../components/BalitaIcon";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { hitungStatusBbU, hitungStatusTbU, hitungStatusBbTb, convertStatusBbUToCode, convertStatusTbUToCode, convertStatusBbTbToCode } from "../../lib/zScoreCalculator";
import { formatTanggalIndonesia, formatTanggalInput } from "../../lib/dateUtils";
import { getExamDraft, saveExamDraft, clearExamDraft } from "../../lib/draftStorage";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

// Tipe Data
export interface PemeriksaanBalita {
  id: string;
  tanggalPeriksa: string;
  usiaBulan: number;
  beratBadan: number; // kg
  tinggiBadan: number; // cm
  lingkarKepala?: number; // cm
  lingkarLengan?: number; // cm
  statusBBU: "Sangat Kurang" | "Kurang" | "Normal" | "Lebih";
  statusTBU: "Sangat Pendek" | "Pendek" | "Normal" | "Tinggi";
  statusBBTB: "Sangat Kurus" | "Kurus" | "Normal" | "Gemuk";
  statusKms?: string;
  vitaminA: boolean;
  asiEksklusif?: boolean;
  obatCacing?: boolean;
  statusImunisasi?: string;
}

export interface Balita {
  id: string;
  nama: string;
  nik?: string;
  noHp?: string;
  tanggalLahir: string;
  jenisKelamin: "L" | "P";
  namaIbu: string;
  alamat: string;
  pemeriksaan: PemeriksaanBalita[];
}

import { TableSkeleton, DetailViewSkeleton } from "../../components/Skeleton";
import { balitaApi, PeriodePelayanan } from "../../lib/api";

// Initial Mock Data
const initialBalitas: Balita[] = [
  {
    id: "b1",
    nama: "Andi Pratama",
    nik: "3301021207250001",
    tanggalLahir: "2025-07-12", // 12 Bulan pada Juli 2026
    jenisKelamin: "L",
    namaIbu: "Siti Rahmawati",
    alamat: "RT 01 / RW 02, Desa Karanggayam",
    pemeriksaan: [
      { id: "e1", tanggalPeriksa: "2026-07-10", usiaBulan: 12, beratBadan: 9.5, tinggiBadan: 74.2, lingkarKepala: 45.2, statusBBU: "Normal", statusTBU: "Normal", statusBBTB: "Normal", vitaminA: true },
      { id: "e2", tanggalPeriksa: "2026-06-10", usiaBulan: 11, beratBadan: 9.1, tinggiBadan: 73.0, lingkarKepala: 44.8, statusBBU: "Normal", statusTBU: "Normal", statusBBTB: "Normal", vitaminA: false },
      { id: "e3", tanggalPeriksa: "2026-05-10", usiaBulan: 10, beratBadan: 8.6, tinggiBadan: 71.5, lingkarKepala: 44.2, statusBBU: "Kurang", statusTBU: "Normal", statusBBTB: "Normal", vitaminA: false },
    ],
  },
  {
    id: "b2",
    nama: "Citra Lestari",
    nik: "3301024507240003",
    tanggalLahir: "2024-07-24", // 24 Bulan
    jenisKelamin: "P",
    namaIbu: "Endah Lestari",
    alamat: "RT 02 / RW 02, Desa Karanggayam",
    pemeriksaan: [
      { id: "e4", tanggalPeriksa: "2026-07-10", usiaBulan: 24, beratBadan: 11.8, tinggiBadan: 86.5, lingkarKepala: 48.0, statusBBU: "Normal", statusTBU: "Normal", statusBBTB: "Normal", vitaminA: true },
      { id: "e5", tanggalPeriksa: "2026-06-10", usiaBulan: 23, beratBadan: 11.4, tinggiBadan: 85.0, lingkarKepala: 47.6, statusBBU: "Normal", statusTBU: "Normal", statusBBTB: "Normal", vitaminA: false },
    ],
  },
  {
    id: "b3",
    nama: "Aisyah Putri",
    nik: "3301025801260002",
    tanggalLahir: "2026-01-28", // 6 Bulan
    jenisKelamin: "P",
    namaIbu: "Aminah Purwati",
    alamat: "RT 03 / RW 02, Desa Karanggayam",
    pemeriksaan: [
      { id: "e6", tanggalPeriksa: "2026-07-10", usiaBulan: 6, beratBadan: 7.2, tinggiBadan: 64.0, lingkarKepala: 42.5, statusBBU: "Normal", statusTBU: "Normal", statusBBTB: "Normal", vitaminA: true },
    ],
  },
  {
    id: "b4",
    nama: "Budi Raharjo",
    nik: "3301021908220005",
    tanggalLahir: "2022-08-19", // 47 Bulan
    jenisKelamin: "L",
    namaIbu: "Purwati Ningsih",
    alamat: "RT 01 / RW 02, Desa Karanggayam",
    pemeriksaan: [
      { id: "e7", tanggalPeriksa: "2026-07-10", usiaBulan: 47, beratBadan: 13.5, tinggiBadan: 98.2, lingkarKepala: 50.1, statusBBU: "Normal", statusTBU: "Normal", statusBBTB: "Kurus", vitaminA: false },
    ],
  },
];

// Helper Hitung Usia (Bulan)
function calculateAgeInMonths(birthDateStr: string, refDate: Date = new Date()): number {
  const birth = new Date(birthDateStr);
  let months = (refDate.getFullYear() - birth.getFullYear()) * 12;
  months -= birth.getMonth();
  months += refDate.getMonth();
  return months <= 0 ? 0 : months;
}

function getStatusBadgeStyle(type: 'BBU' | 'TBU' | 'BBTB', status: string) {
  const s = (status || '').toLowerCase();
  
  if (type === 'BBU') {
    if (s.includes('sangat kurang') || s === 'sk') return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
    if (s.includes('kurang') || s === 'k') return 'bg-red-50 text-red-700 border-red-200 font-bold';
    if (s.includes('lebih') || s === 'l') return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
  }
  
  if (type === 'TBU') {
    if (s.includes('sangat pendek') || s === 'sp') return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
    if (s.includes('pendek') || s === 'p') return 'bg-red-50 text-red-700 border-red-200 font-bold';
    if (s.includes('tinggi') || s === 't') return 'bg-teal-50 text-teal-800 border-teal-200 font-bold';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
  }

  if (type === 'BBTB') {
    if (s.includes('sangat kurus') || s === 'sk') return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
    if (s.includes('kurus') || s === 'k') return 'bg-red-50 text-red-700 border-red-200 font-bold';
    if (s.includes('gemuk') || s.includes('obesitas') || s === 'g') return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
  }

  return 'bg-gray-100 text-gray-800 border-gray-200';
}

interface BalitaModuleProps {
  posyanduId: string;
  activePeriode?: PeriodePelayanan | null;
  onNavigateToPelayanan?: (id: string) => void;
  searchQuery?: string;
  selectedId?: string;
  onBack?: () => void;
  backLabel?: string;
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

export default function BalitaModule({ posyanduId, activePeriode, onNavigateToPelayanan, selectedId, searchQuery, onBack, backLabel }: BalitaModuleProps) {
  const { user } = useAuth();
  const [balitas, setBalitas] = useState<Balita[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<"list" | "detail" | "add">("list");
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | null>(selectedId || null);

  // Search, Filter & Pagination State
  const [query, setQuery] = useState(searchQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    if (searchQuery !== undefined) {
      setQuery(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (selectedId) {
      setSelectedBalitaId(selectedId);
      setView("detail");
      if (posyanduId) {
        balitaApi.getById(posyanduId, selectedId).then((res) => {
          if (res.success && res.data) {
            const b = res.data;
            const mappedSingle: Balita = {
              ...b,
              tanggalLahir: typeof b.tanggalLahir === "string" ? b.tanggalLahir.split("T")[0] : new Date(b.tanggalLahir).toISOString().split("T")[0],
              pemeriksaan: (b.pemeriksaans ?? []).map((p) => ({
                ...p,
                tanggalPeriksa: typeof p.tanggalPeriksa === "string" ? p.tanggalPeriksa.split("T")[0] : new Date(p.tanggalPeriksa).toISOString().split("T")[0],
                statusBBU: (p as unknown as Record<string, string>).statusBbU as PemeriksaanBalita["statusBBU"] ?? "Normal",
                statusTBU: (p as unknown as Record<string, string>).statusTbU as PemeriksaanBalita["statusTBU"] ?? "Normal",
                statusBBTB: (p as unknown as Record<string, string>).statusBbTb as PemeriksaanBalita["statusBBTB"] ?? "Normal",
              })),
            };
            setBalitas((prev) => {
              const idx = prev.findIndex((item) => item.id === b.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = mappedSingle;
                return next;
              }
              return [mappedSingle, ...prev];
            });
          }
        }).catch((err) => console.error("Gagal mengambil detail balita:", err));
      }
    } else {
      setSelectedBalitaId(null);
      setView("list");
    }
  }, [selectedId, posyanduId]);

  // Edit & Delete Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editNama, setEditNama] = useState("");
  const [editNik, setEditNik] = useState("");
  const [editNoHp, setEditNoHp] = useState("");
  const [editTglLahir, setEditTglLahir] = useState("");
  const [editJk, setEditJk] = useState<"L" | "P">("L");
  const [editNamaIbu, setEditNamaIbu] = useState("");
  const [editAlamat, setEditAlamat] = useState("");
  const [editError, setEditError] = useState("");

  // Edit & Delete Examination State
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);
  const [isDeleteExamModalOpen, setIsDeleteExamModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const [editExamDate, setEditExamDate] = useState("");
  const [editExamBB, setEditExamBB] = useState("");
  const [editExamTB, setEditExamTB] = useState("");
  const [editExamLK, setEditExamLK] = useState("");
  const [editExamLiLA, setEditExamLiLA] = useState("");
  const [editExamBBU, setEditExamBBU] = useState<PemeriksaanBalita["statusBBU"]>("Normal");
  const [editExamTBU, setEditExamTBU] = useState<PemeriksaanBalita["statusTBU"]>("Normal");
  const [editExamBBTB, setEditExamBBTB] = useState<PemeriksaanBalita["statusBBTB"]>("Normal");
  const [editExamKms, setEditExamKms] = useState("N (Naik)");
  const [editExamVitA, setEditExamVitA] = useState(false);
  const [editExamAsi, setEditExamAsi] = useState(false);
  const [editExamCacing, setEditExamCacing] = useState(false);
  const [editExamImunisasi, setEditExamImunisasi] = useState("");
  const [editExamError, setEditExamError] = useState("");

  // Filter & Pagination State
  const [ageFilter, setAgeFilter] = useState<"semua" | "0-6" | "7-12" | "13-24" | "25-60">("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch balita from API
  const fetchBalitas = useCallback(() => {
    setIsLoading(true);
    setApiError(null);
    const kelompokUsiaParam =
      ageFilter === "0-6" ? "0-6 bulan" :
      ageFilter === "7-12" ? "7-12 bulan" :
      ageFilter === "13-24" ? "13-24 bulan" :
      ageFilter === "25-60" ? "25-60 bulan" : undefined;

    balitaApi
      .getAll(posyanduId, {
        search: debouncedQuery || undefined,
        kelompokUsia: kelompokUsiaParam,
        page: currentPage,
        limit: limit,
      })
      .then((res) => {
        if (res.success) {
          // Map API shape to local shape (pemeriksaans → pemeriksaan)
          const mapped: Balita[] = res.data.map((b) => ({
            ...b,
            tanggalLahir: typeof b.tanggalLahir === "string" ? b.tanggalLahir.split("T")[0] : new Date(b.tanggalLahir).toISOString().split("T")[0],
            pemeriksaan: (b.pemeriksaans ?? []).map((p) => ({
              ...p,
              tanggalPeriksa: typeof p.tanggalPeriksa === "string" ? p.tanggalPeriksa.split("T")[0] : new Date(p.tanggalPeriksa).toISOString().split("T")[0],
              statusBBU: (p as unknown as Record<string, string>).statusBbU as PemeriksaanBalita["statusBBU"] ?? "Normal",
              statusTBU: (p as unknown as Record<string, string>).statusTbU as PemeriksaanBalita["statusTBU"] ?? "Normal",
              statusBBTB: (p as unknown as Record<string, string>).statusBbTb as PemeriksaanBalita["statusBBTB"] ?? "Normal",
            })),
          }));
          setBalitas(mapped);
          if (res.meta) {
            setTotalItems(res.meta.total);
            setTotalPages(res.meta.totalPages);
          } else {
            setTotalItems(mapped.length);
            setTotalPages(1);
          }
        }
      })
      .catch((err) => setApiError(err.message))
      .finally(() => setIsLoading(false));
  }, [posyanduId, debouncedQuery, ageFilter, currentPage, limit]);

  useEffect(() => {
    fetchBalitas();
  }, [fetchBalitas]);

  // Filter List Balita (client-side age filter)
  const filteredBalitas = balitas.filter((b) => {
    const ageMonths = calculateAgeInMonths(b.tanggalLahir);
    let matchesAge = true;
    if (ageFilter === "0-6") matchesAge = ageMonths >= 0 && ageMonths <= 6;
    else if (ageFilter === "7-12") matchesAge = ageMonths >= 7 && ageMonths <= 12;
    else if (ageFilter === "13-24") matchesAge = ageMonths >= 13 && ageMonths <= 24;
    else if (ageFilter === "25-60") matchesAge = ageMonths >= 25 && ageMonths <= 60;
    return matchesAge;
  });
  const [formNama, setFormNama] = useState("");
  const [formNik, setFormNik] = useState("");
  const [formNoHp, setFormNoHp] = useState("");
  const [formTglLahir, setFormTglLahir] = useState("2025-01-01");
  const [formJk, setFormJk] = useState<"L" | "P">("L");
  const [formNamaIbu, setFormNamaIbu] = useState("");
  const [formAlamat, setFormAlamat] = useState("");
  const [formError, setFormError] = useState("");

  // Form State Tambah Pemeriksaan
  const initialDate = activePeriode?.tanggal 
    ? new Date(activePeriode.tanggal).toISOString().slice(0, 10) 
    : new Date().toISOString().slice(0, 10);
  const [examDate, setExamDate] = useState(initialDate);

  useEffect(() => {
    if (activePeriode?.tanggal) {
      setExamDate(new Date(activePeriode.tanggal).toISOString().slice(0, 10));
    }
  }, [activePeriode]);
  const [examBB, setExamBB] = useState("");
  const [examTB, setExamTB] = useState("");
  const [examLK, setExamLK] = useState("");
  const [examBBU, setExamBBU] = useState<PemeriksaanBalita["statusBBU"]>("Normal");
  const [examTBU, setExamTBU] = useState<PemeriksaanBalita["statusTBU"]>("Normal");
  const [examBBTB, setExamBBTB] = useState<PemeriksaanBalita["statusBBTB"]>("Normal");
  const [examVitA, setExamVitA] = useState(false);
  const [examVitB1, setExamVitB1] = useState(false);
  const [examVitB6, setExamVitB6] = useState(false);
  const [examLiLA, setExamLiLA] = useState("");
  const [examKms, setExamKms] = useState("N");
  const [examAsi, setExamAsi] = useState<boolean>(true); // default 'masih' = true
  const [examCacing, setExamCacing] = useState(false);
  const [examImunisasi, setExamImunisasi] = useState("");

  // Permanent custom pemberian options per Posyandu
  const [masterPemberianOptions, setMasterPemberianOptions] = useState<string[]>([]);
  const [checkedPemberianMap, setCheckedPemberianMap] = useState<Record<string, boolean>>({});
  const [newPemberianInput, setNewPemberianInput] = useState("");
  const [showAddPemberianInput, setShowAddPemberianInput] = useState(false);
  const [examWarning, setExamWarning] = useState("");
  const [examError, setExamError] = useState("");

  // Load permanent custom options per Posyandu from localStorage
  useEffect(() => {
    if (!posyanduId) return;
    try {
      const saved = localStorage.getItem(`posyandu_pemberian_options_${posyanduId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMasterPemberianOptions(parsed);
      }
    } catch (err) {
      console.error("Gagal membaca opsi pemberian posyandu:", err);
    }
  }, [posyanduId]);

  const updateMasterPemberianOptions = (newList: string[]) => {
    setMasterPemberianOptions(newList);
    if (posyanduId) {
      try {
        localStorage.setItem(`posyandu_pemberian_options_${posyanduId}`, JSON.stringify(newList));
      } catch (err) {
        console.error("Gagal menyimpan opsi pemberian posyandu:", err);
      }
    }
  };

  const handleAddCustomPemberian = () => {
    const trimmed = newPemberianInput.trim();
    if (!trimmed) return;
    const exists = masterPemberianOptions.some(opt => opt.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const updated = [...masterPemberianOptions, trimmed];
      updateMasterPemberianOptions(updated);
    }
    setCheckedPemberianMap(prev => ({ ...prev, [trimmed]: true }));
    setNewPemberianInput("");
    setShowAddPemberianInput(false);
  };

  const handleDeleteMasterPemberian = (optToDelete: string) => {
    const updated = masterPemberianOptions.filter(opt => opt !== optToDelete);
    updateMasterPemberianOptions(updated);
    setCheckedPemberianMap(prev => {
      const next = { ...prev };
      delete next[optToDelete];
      return next;
    });
  };

  interface FormDraftBalita {
    examDate?: string;
    examBB?: string;
    examTB?: string;
    examLK?: string;
    examLiLA?: string;
    examKms?: string;
    examVitA?: boolean;
    examVitB1?: boolean;
    examVitB6?: boolean;
    examAsi?: boolean;
    examCacing?: boolean;
    examImunisasi?: string;
    checkedPemberianMap?: Record<string, boolean>;
  }

  const loadedBalitaIdRef = useRef<string | null>(null);

  // Auto-save form draft for selected balita ke shared storage
  useEffect(() => {
    if (!selectedBalitaId) return;
    // Mencegah data balita sebelumnya menimpa balita yang baru dipilih
    if (loadedBalitaIdRef.current !== selectedBalitaId) return;

    saveExamDraft(posyanduId, selectedBalitaId, {
      examDate,
      examBB,
      examTB,
      examLK,
      examLiLA,
      examKms,
      examVitA,
      examVitB1,
      examVitB6,
      examAsi,
      examCacing,
      examImunisasi,
      checkedPemberianMap,
    });
  }, [
    posyanduId,
    selectedBalitaId,
    examDate,
    examBB,
    examTB,
    examLK,
    examLiLA,
    examKms,
    examVitA,
    examVitB1,
    examVitB6,
    examAsi,
    examCacing,
    examImunisasi,
    checkedPemberianMap,
  ]);

  const activeBalita = balitas.find((b) => b.id === selectedBalitaId);

  // Otomatisasi Status Gizi Balita (Z-Score)
  useEffect(() => {
    if (!activeBalita) return;
    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);
    const usia = calculateAgeInMonths(activeBalita.tanggalLahir, new Date(examDate));
    if (!isNaN(bb) && bb > 0) {
      setExamBBU(hitungStatusBbU(bb, usia, activeBalita.jenisKelamin));
    }
    if (!isNaN(tb) && tb > 0) {
      setExamTBU(hitungStatusTbU(tb, usia, activeBalita.jenisKelamin));
    }
    if (!isNaN(bb) && bb > 0 && !isNaN(tb) && tb > 0) {
      setExamBBTB(hitungStatusBbTb(bb, tb, activeBalita.jenisKelamin));
    }
  }, [examBB, examTB, examDate, activeBalita]);

  // Populate Edit Form
  const openEditModal = (b: Balita) => {
    setEditNama(b.nama);
    setEditNik(b.nik || "");
    setEditNoHp(b.noHp || "");
    setEditTglLahir(formatTanggalInput(b.tanggalLahir));
    setEditJk(b.jenisKelamin);
    setEditNamaIbu(b.namaIbu);
    setEditAlamat(b.alamat);
    setEditError("");
    setIsEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditBalitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    if (!selectedBalitaId) return;

    if (!editNama.trim() || !editNamaIbu.trim() || !editAlamat.trim()) {
      setEditError("Mohon isi nama lengkap, nama ibu, dan alamat.");
      return;
    }

    setIsSaving(true);
    try {
      await balitaApi.update(posyanduId, selectedBalitaId, {
        nama: editNama,
        nik: editNik || undefined,
        noHp: editNoHp || undefined,
        tanggalLahir: editTglLahir,
        jenisKelamin: editJk,
        namaIbu: editNamaIbu,
        alamat: editAlamat,
      });
      fetchBalitas();
      setIsEditModalOpen(false);
      toast.success("Profil balita berhasil diperbarui!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengedit profil balita.";
      setEditError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Balita
  const handleDeleteBalita = async () => {
    if (!selectedBalitaId) return;
    setIsSaving(true);
    try {
      await balitaApi.delete(posyanduId, selectedBalitaId);
      fetchBalitas();
      setIsDeleteModalOpen(false);
      setSelectedBalitaId(null);
      setView("list");
      toast.success("Data balita berhasil dihapus!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus profil balita.";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Open Edit Exam Modal
  const openEditExamModal = (exam: PemeriksaanBalita) => {
    setEditingExamId(exam.id);
    setEditExamDate(formatTanggalInput(exam.tanggalPeriksa));
    setEditExamBB(String(exam.beratBadan));
    setEditExamTB(String(exam.tinggiBadan));
    setEditExamLK(exam.lingkarKepala ? String(exam.lingkarKepala) : "");
    setEditExamLiLA(exam.lingkarLengan ? String(exam.lingkarLengan) : "");
    setEditExamBBU(exam.statusBBU || "Normal");
    setEditExamTBU(exam.statusTBU || "Normal");
    setEditExamBBTB(exam.statusBBTB || "Normal");
    setEditExamKms(exam.statusKms || "N (Naik)");
    setEditExamVitA(Boolean(exam.vitaminA));
    setEditExamAsi(Boolean(exam.asiEksklusif));
    setEditExamCacing(Boolean(exam.obatCacing));
    setEditExamImunisasi(exam.statusImunisasi || "");
    setEditExamError("");
    setIsEditExamModalOpen(true);
  };

  // Open Delete Exam Modal
  const openDeleteExamModal = (examId: string) => {
    setDeletingExamId(examId);
    setIsDeleteExamModalOpen(true);
  };

  // Auto Recalculate Z-Score when BB/TB changes in Edit Exam Form
  const handleEditExamMeasurementsChange = (newBB: string, newTB: string, dateStr: string) => {
    setEditExamBB(newBB);
    setEditExamTB(newTB);
    const bb = parseFloat(newBB);
    const tb = parseFloat(newTB);
    if (!isNaN(bb) && !isNaN(tb) && activeBalita) {
      const age = calculateAgeInMonths(activeBalita.tanggalLahir, new Date(dateStr));
      const jk = activeBalita.jenisKelamin;
      setEditExamBBU(hitungStatusBbU(bb, age, jk));
      setEditExamTBU(hitungStatusTbU(tb, age, jk));
      setEditExamBBTB(hitungStatusBbTb(bb, tb, jk));
    }
  };

  // Handle Edit Exam Submit
  const handleEditExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditExamError("");

    const bb = parseFloat(editExamBB);
    const tb = parseFloat(editExamTB);
    const lk = editExamLK ? parseFloat(editExamLK) : undefined;
    const lila = editExamLiLA ? parseFloat(editExamLiLA) : undefined;

    if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0) {
      setEditExamError("Berat Badan dan Tinggi Badan harus diisi angka positif yang valid.");
      return;
    }

    if (!activeBalita || !editingExamId) return;

    setIsSaving(true);
    try {
      const payload = {
        tanggalPeriksa: editExamDate,
        usiaBulan: calculateAgeInMonths(activeBalita.tanggalLahir, new Date(editExamDate)),
        beratBadan: bb,
        tinggiBadan: tb,
        lingkarKepala: lk,
        lingkarLengan: lila,
        statusBbU: convertStatusBbUToCode(editExamBBU),
        statusTbU: convertStatusTbUToCode(editExamTBU),
        statusBbTb: convertStatusBbTbToCode(editExamBBTB),
        statusKms: editExamKms,
        vitaminA: editExamVitA,
        asiEksklusif: editExamAsi,
        obatCacing: editExamCacing,
        statusImunisasi: editExamImunisasi || undefined,
      };

      await balitaApi.updatePemeriksaan(posyanduId, activeBalita.id, editingExamId, payload as any);

      // Refresh balita detail
      const res = await balitaApi.getById(posyanduId, activeBalita.id);
      if (res.success) {
        const updated: Balita = {
          ...res.data,
          pemeriksaan: (res.data.pemeriksaans ?? []).map((p) => ({
            ...p,
            statusBBU: (p as unknown as Record<string, string>).statusBbU as PemeriksaanBalita["statusBBU"] ?? "Normal",
            statusTBU: (p as unknown as Record<string, string>).statusTbU as PemeriksaanBalita["statusTBU"] ?? "Normal",
            statusBBTB: (p as unknown as Record<string, string>).statusBbTb as PemeriksaanBalita["statusBBTB"] ?? "Normal",
          })),
        };
        setBalitas((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
      setIsEditExamModalOpen(false);
      toast.success("Riwayat pemeriksaan balita berhasil diperbarui!");
    } catch {
      // Fallback local update
      setBalitas((prev) =>
        prev.map((b) => {
          if (b.id !== activeBalita.id) return b;
          return {
            ...b,
            pemeriksaan: b.pemeriksaan.map((p) => {
              if (p.id !== editingExamId) return p;
              return {
                ...p,
                tanggalPeriksa: editExamDate,
                usiaBulan: calculateAgeInMonths(activeBalita.tanggalLahir, new Date(editExamDate)),
                beratBadan: bb,
                tinggiBadan: tb,
                lingkarKepala: lk,
                lingkarLengan: lila,
                statusBBU: editExamBBU,
                statusTBU: editExamTBU,
                statusBBTB: editExamBBTB,
                statusKms: editExamKms,
                vitaminA: editExamVitA,
                asiEksklusif: editExamAsi,
                obatCacing: editExamCacing,
                statusImunisasi: editExamImunisasi,
              };
            }),
          };
        })
      );
      setIsEditExamModalOpen(false);
      toast.success("Riwayat pemeriksaan balita berhasil diperbarui!");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Exam Submit
  const handleDeleteExamSubmit = async () => {
    if (!activeBalita || !deletingExamId) return;
    setIsSaving(true);
    try {
      await balitaApi.deletePemeriksaan(posyanduId, activeBalita.id, deletingExamId);
      const res = await balitaApi.getById(posyanduId, activeBalita.id);
      if (res.success) {
        const updated: Balita = {
          ...res.data,
          pemeriksaan: (res.data.pemeriksaans ?? []).map((p) => ({
            ...p,
            statusBBU: (p as unknown as Record<string, string>).statusBbU as PemeriksaanBalita["statusBBU"] ?? "Normal",
            statusTBU: (p as unknown as Record<string, string>).statusTbU as PemeriksaanBalita["statusTBU"] ?? "Normal",
            statusBBTB: (p as unknown as Record<string, string>).statusBbTb as PemeriksaanBalita["statusBBTB"] ?? "Normal",
          })),
        };
        setBalitas((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
      setIsDeleteExamModalOpen(false);
      toast.success("Riwayat pemeriksaan balita berhasil dihapus!");
    } catch {
      setBalitas((prev) =>
        prev.map((b) => {
          if (b.id !== activeBalita.id) return b;
          return {
            ...b,
            pemeriksaan: b.pemeriksaan.filter((p) => p.id !== deletingExamId),
          };
        })
      );
      setIsDeleteExamModalOpen(false);
      toast.success("Riwayat pemeriksaan balita berhasil dihapus!");
    } finally {
      setIsSaving(false);
    }
  };


  // Handler Submit Tambah Balita (via API)
  const handleAddBalitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formNama.trim() || !formNamaIbu.trim() || !formAlamat.trim()) {
      setFormError("Mohon isi nama lengkap, nama ibu, dan alamat.");
      return;
    }

    if (formNik && formNik.length !== 16) {
      setFormError("Format NIK salah. NIK harus berjumlah 16 digit angka.");
      return;
    }

    setIsSaving(true);
    try {
      await balitaApi.create(posyanduId, {
        nama: formNama,
        nik: formNik || undefined,
        noHp: formNoHp || undefined,
        tanggalLahir: formTglLahir,
        jenisKelamin: formJk,
        namaIbu: formNamaIbu,
        alamat: formAlamat,
      });
      // Refresh list
      fetchBalitas();
      setFormNama("");
      setFormNik("");
      setFormNoHp("");
      setFormTglLahir("2025-01-01");
      setFormJk("L");
      setFormNamaIbu("");
      setFormAlamat("");
      setView("list");
      toast.success("Data balita baru berhasil ditambahkan!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan data.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler Real-time Warning untuk input Pemeriksaan (Manusiawi)
  const handleExamInputCheck = (bbVal: string, tbVal: string) => {
    setExamWarning("");
    if (!activeBalita) return;

    const bb = parseFloat(bbVal);
    const tb = parseFloat(tbVal);
    const usia = calculateAgeInMonths(activeBalita.tanggalLahir, new Date(examDate));

    // Warning BB tidak masuk akal untuk bayi
    if (bb > 25 && usia < 18) {
      setExamWarning(`Apakah Berat Badan (${bb} kg) sudah benar untuk anak usia ${usia} bulan? Mohon cek kembali inputan Ibu.`);
    }
    // Warning TB tidak masuk akal
    else if (tb > 120 && usia < 24) {
      setExamWarning(`Apakah Tinggi Badan (${tb} cm) sudah benar untuk anak usia ${usia} bulan? Mohon cek kembali inputan Ibu.`);
    }
  };

  const targetMonth = activePeriode ? activePeriode.bulan : (new Date().getMonth() + 1);
  const targetYear = activePeriode ? activePeriode.tahun : new Date().getFullYear();

  const currentPeriodExam = (activeBalita?.pemeriksaan || []).find((exam) => {
    const d = new Date(exam.tanggalPeriksa);
    return (d.getMonth() + 1) === targetMonth && d.getFullYear() === targetYear;
  });

  // Handler Submit Tambah Pemeriksaan (via API)
  const handleAddExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamError("");

    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);
    const lk = examLK ? parseFloat(examLK) : undefined;

    if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0) {
      setExamError("Berat Badan dan Tinggi Badan harus diisi dengan angka positif.");
      return;
    }

    if (!activeBalita) return;

    setIsSaving(true);
    try {
      const selectedCustoms = masterPemberianOptions.filter(opt => checkedPemberianMap[opt]);
      const combinedImunisasiPemberian = [
        examImunisasi,
        selectedCustoms.length > 0 ? `Pemberian: ${selectedCustoms.join(", ")}` : ""
      ].filter(Boolean).join(" | ");

      await balitaApi.createPemeriksaan(posyanduId, activeBalita.id, {
        tanggalPeriksa: examDate,
        usiaBulan: calculateAgeInMonths(activeBalita.tanggalLahir, new Date(examDate)),
        beratBadan: bb,
        tinggiBadan: tb,
        lingkarKepala: lk,
        lingkarLengan: examLiLA ? parseFloat(examLiLA) : undefined,
        statusBbU: convertStatusBbUToCode(examBBU),
        statusTbU: convertStatusTbUToCode(examTBU),
        statusBbTb: convertStatusBbTbToCode(examBBTB),
        statusKms: examKms,
        vitaminA: examVitA,
        vitB1: examVitB1,
        vitB6: examVitB6,
        asiEksklusif: examAsi,
        obatCacing: examCacing,
        statusImunisasi: combinedImunisasiPemberian || undefined,
        petugas: user?.nama || "Kader Posyandu",
      } as any);
      // Refresh balita detail
      const res = await balitaApi.getById(posyanduId, activeBalita.id);
      if (res.success) {
        const updated: Balita = {
          ...res.data,
          pemeriksaan: (res.data.pemeriksaans ?? []).map((p) => ({
            ...p,
            statusBBU: (p as unknown as Record<string, string>).statusBbU as PemeriksaanBalita["statusBBU"] ?? "Normal",
            statusTBU: (p as unknown as Record<string, string>).statusTbU as PemeriksaanBalita["statusTBU"] ?? "Normal",
            statusBBTB: (p as unknown as Record<string, string>).statusBbTb as PemeriksaanBalita["statusBBTB"] ?? "Normal",
          })),
        };
        setBalitas((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      }
      
      clearExamDraft(posyanduId, activeBalita.id);

      // Emit event to notify Riwayat module to refresh
      window.dispatchEvent(new Event("pemeriksaanSaved"));
      setExamWarning("");
      toast.success(currentPeriodExam ? "Hasil pemeriksaan balita bulan ini berhasil diperbarui!" : "Hasil pemeriksaan balita berhasil disimpan!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pemeriksaan.";
      setExamError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Pre-fill form pemeriksaan jika balita sudah memiliki data pemeriksaan pada periode ini atau draft tersimpan
  useEffect(() => {
    if (!activeBalita) {
      loadedBalitaIdRef.current = null;
      return;
    }

    // 1. Prioritaskan data resmi database jika balita sudah diperiksa pada periode ini
    if (currentPeriodExam) {
      clearExamDraft(posyanduId, activeBalita.id);
      if (currentPeriodExam.tanggalPeriksa) {
        setExamDate(formatTanggalInput(currentPeriodExam.tanggalPeriksa));
      }
      setExamBB(currentPeriodExam.beratBadan ? String(currentPeriodExam.beratBadan) : "");
      setExamTB(currentPeriodExam.tinggiBadan ? String(currentPeriodExam.tinggiBadan) : "");
      setExamLK(currentPeriodExam.lingkarKepala ? String(currentPeriodExam.lingkarKepala) : "");
      setExamLiLA(currentPeriodExam.lingkarLengan ? String(currentPeriodExam.lingkarLengan) : "");
      setExamKms(currentPeriodExam.statusKms || "N");
      setExamVitA(Boolean(currentPeriodExam.vitaminA));
      setExamVitB1(Boolean((currentPeriodExam as any).vitB1));
      setExamVitB6(Boolean((currentPeriodExam as any).vitB6));
      setExamAsi(Boolean(currentPeriodExam.asiEksklusif));
      setExamCacing(Boolean(currentPeriodExam.obatCacing));
      const rawImun = currentPeriodExam.statusImunisasi || "";
      const matches = [...rawImun.matchAll(/Pemberian:\s*([^|]+)/gi)];
      const newChecked: Record<string, boolean> = {};
      const itemsFound: string[] = [];
      for (const m of matches) {
        m[1].split(',').forEach((s: string) => {
          const t = s.trim();
          if (t) {
            newChecked[t] = true;
            itemsFound.push(t);
          }
        });
      }
      setCheckedPemberianMap(newChecked);

      if (itemsFound.length > 0) {
        setMasterPemberianOptions((prev) => {
          const lowerSet = new Set(prev.map(p => p.toLowerCase()));
          const toAdd = itemsFound.filter(item => !lowerSet.has(item.toLowerCase()));
          if (toAdd.length === 0) return prev;
          const next = [...prev, ...toAdd];
          if (posyanduId) {
            try {
              localStorage.setItem(`posyandu_pemberian_options_${posyanduId}`, JSON.stringify(next));
            } catch (e) {}
          }
          return next;
        });
      }

      const pureImunisasi = rawImun
        .replace(/(^|\|\s*)Pemberian:.*$/gi, "")
        .replace(/\|\s*$/, "")
        .trim();
      setExamImunisasi(pureImunisasi);
      loadedBalitaIdRef.current = activeBalita.id;
      return;
    }

    // 2. Jika belum diperiksa, cek draft tersimpan khusus balita ini
    const draft = getExamDraft(posyanduId, activeBalita.id);
    const draftDate = draft?.examDate ? new Date(draft.examDate) : null;
    const isDraftForCurrentPeriod = draftDate
      ? (draftDate.getMonth() + 1) === targetMonth && draftDate.getFullYear() === targetYear
      : true;

    const hasDraftContent = Boolean(
      isDraftForCurrentPeriod &&
      draft && (
        draft.examBB ||
        draft.examTB ||
        draft.examLK ||
        draft.examLiLA ||
        draft.examImunisasi ||
        (draft.checkedPemberianMap && Object.values(draft.checkedPemberianMap).some(Boolean))
      )
    );

    if (hasDraftContent && draft) {
      if (draft.examDate) setExamDate(draft.examDate);
      setExamBB(draft.examBB ?? "");
      setExamTB(draft.examTB ?? "");
      setExamLK(draft.examLK ?? "");
      setExamLiLA(draft.examLiLA ?? "");
      setExamKms(draft.examKms ?? "N");
      setExamVitA(draft.examVitA ?? false);
      setExamVitB1(draft.examVitB1 ?? false);
      setExamVitB6(draft.examVitB6 ?? false);
      setExamAsi(draft.examAsi ?? true);
      setExamCacing(draft.examCacing ?? false);
      setExamImunisasi(draft.examImunisasi ?? "");
      setCheckedPemberianMap(draft.checkedPemberianMap ?? {});
      loadedBalitaIdRef.current = activeBalita.id;
      return;
    }

    // 3. Belum ada data pada periode ini -> form KOSONG
    const defaultDate = activePeriode?.tanggal 
      ? new Date(activePeriode.tanggal).toISOString().slice(0, 10) 
      : new Date().toISOString().slice(0, 10);
    setExamDate(defaultDate);
    setExamBB("");
    setExamTB("");
    setExamLK("");
    setExamLiLA("");
    setExamKms("N");
    setExamVitA(false);
    setExamVitB1(false);
    setExamVitB6(false);
    setExamAsi(true);
    setExamCacing(false);
    setExamImunisasi("");
    setCheckedPemberianMap({});
    loadedBalitaIdRef.current = activeBalita.id;
  }, [activeBalita, activePeriode, posyanduId, currentPeriodExam, targetMonth, targetYear]);

  return (
    <div className="space-y-6">
      <PageHelmet
        title={activeBalita ? `Balita: ${activeBalita.nama}` : "Manajemen Data Balita"}
        description="Pengelolaan data identitas, pengukuran fisik, dan grafik tumbuh kembang anak/balita."
      />
      {/* API Error Banner */}
      {apiError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
          Gagal memuat data: {apiError}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. VIEW: LIST BALITA */}
      {/* ========================================================================= */}
      {view === "list" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-saas-dark tracking-tight">Data Balita</h2>
              <p className="text-sm text-saas-muted mt-0.5">Kelola identitas dan riwayat tumbuh kembang anak.</p>
            </div>
            <button
              onClick={() => setView("add")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Balita Baru
            </button>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-card border border-gray-100/50 shadow-soft-card">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Cari nama, NIK, atau nama ibu..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-gray-50/70 border border-gray-100 rounded-input text-sm text-saas-dark placeholder-saas-muted/70 focus:outline-none focus:border-saas-primary/50 focus:bg-white transition-all"
              />
              <Search className="absolute left-3.5 top-2.5 text-saas-muted/80 w-4 h-4" />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full shrink-0">
              <span className="text-xs font-bold text-saas-muted mr-1 whitespace-nowrap shrink-0">Filter Usia:</span>
              {[
                { label: "Semua Usia", val: "semua" },
                { label: "0-6 Bulan", val: "0-6" },
                { label: "7-12 Bulan", val: "7-12" },
                { label: "13-24 Bulan", val: "13-24" },
                { label: "25-60 Bulan", val: "25-60" },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => {
                    setAgeFilter(item.val as any);
                    setCurrentPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 ${
                    ageFilter === item.val
                      ? "bg-saas-primary/10 text-saas-primary border border-saas-primary/20"
                      : "bg-gray-50 text-saas-muted hover:text-saas-dark border border-transparent"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          {isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (
            <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                    <th className="pb-3">Nama Lengkap</th>
                    <th className="pb-3">No. HP Orang Tua / WA</th>
                    <th className="pb-3">Usia (Bulan)</th>
                    <th className="pb-3">Jenis Kelamin</th>
                    <th className="pb-3">Nama Ibu</th>
                    <th className="pb-3">Status Gizi (BB/U)</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBalitas.length > 0 ? (
                    filteredBalitas.map((item) => {
                      const ageMonths = calculateAgeInMonths(item.tanggalLahir);
                      const latestExam = item.pemeriksaan[0]; // Teratas/terbaru
                      const cleanPhone = item.noHp ? item.noHp.replace(/\D/g, "") : "";
                      const waNumber = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                      return (
                        <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40 transition-colors text-sm">
                          <td className="py-4">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBalitaId(item.id);
                                setView("detail");
                              }}
                              className="font-bold text-saas-dark hover:text-saas-primary hover:underline text-left transition-colors cursor-pointer"
                              title={`Lihat Profil ${item.nama}`}
                            >
                              {item.nama}
                            </button>
                            <p className="text-[11px] text-saas-muted font-medium mt-0.5">NIK: {item.nik || "-"}</p>
                          </td>
                          <td className="py-4">
                            {item.noHp ? (
                              <a
                                href={`https://wa.me/${waNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg text-xs transition-colors border border-emerald-200/60"
                                title="Hubungi Orang Tua via WhatsApp"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                {item.noHp}
                              </a>
                            ) : (
                              <span className="text-xs text-saas-muted font-medium">-</span>
                            )}
                          </td>
                          <td className="py-4 font-bold text-saas-dark">{ageMonths} Bulan</td>
                          <td className="py-4 font-semibold text-saas-muted">{item.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"}</td>
                          <td className="py-4 text-saas-muted font-semibold">{item.namaIbu}</td>
                          <td className="py-4">
                            {latestExam ? (
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                                  latestExam.statusBBU === "Normal"
                                    ? "bg-trend-successBg text-trend-successText"
                                    : latestExam.statusBBU === "Kurang" || latestExam.statusBBU === "Sangat Kurang"
                                    ? "bg-trend-dangerBg text-trend-dangerText"
                                    : "bg-blue-50 text-saas-primary"
                                }`}
                              >
                                {latestExam.statusBBU === "Normal" ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <AlertCircle className="w-3 h-3" />
                                )}
                                {latestExam.statusBBU}
                              </span>
                            ) : (
                              <span className="text-xs text-saas-muted italic">Belum periksa</span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedBalitaId(item.id);
                                setView("detail");
                              }}
                              className="px-3 py-1.5 bg-gray-50 hover:bg-saas-primary/10 hover:text-saas-primary border border-gray-100 rounded-input text-xs font-bold text-saas-dark transition-all inline-flex items-center gap-1"
                            >
                              Detail Data <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-saas-muted font-medium">
                        Tidak ada data balita yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-saas-muted">
              <div className="flex flex-wrap items-center gap-2">
                <span>Tampilkan:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-md font-semibold text-saas-dark focus:outline-none focus:border-saas-primary/50"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>data per halaman</span>
                <span className="ml-2 font-medium">
                  (Menampilkan {totalItems === 0 ? 0 : (currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, totalItems)} dari {totalItems} data)
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
          </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VIEW: DETAIL BALITA & RIWAYAT BULANAN */}
      {/* ========================================================================= */}
      {view === "detail" && activeBalita && (
        <div className="space-y-8">
          {/* Back Action Header */}
          <button
            onClick={() => {
              setView("list");
              setSelectedBalitaId(null);
              if (onBack) {
                onBack();
              }
            }}
            className="flex items-center gap-2 text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel || "Kembali ke Daftar Balita"}
          </button>

          {/* Profile Card & Input Pemeriksaan Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profil Balita */}
            <div className="bg-white rounded-card shadow-soft-card border border-hairline p-6 flex flex-col justify-between h-fit space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-saas-primary">
                    <BalitaIcon className="w-6 h-6" gender={activeBalita.jenisKelamin} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(activeBalita)}
                      className="px-3 py-1.5 border border-hairline text-saas-dark rounded-pill text-xs font-semibold hover:bg-surface-soft transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="px-3 py-1.5 border border-red-200 text-trend-dangerText rounded-pill text-xs font-semibold hover:bg-red-50 transition-all"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-saas-dark tracking-tight">{activeBalita.nama}</h3>
                <p className="text-xs text-saas-muted font-mono mt-1">NIK: {activeBalita.nik || "Tidak terdaftar"}</p>
              </div>

              <div className="space-y-4 border-t border-gray-50 pt-4 text-sm font-semibold">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Tanggal Lahir & Usia</p>
                    <p className="text-saas-dark text-xs mt-0.5">
                      {formatTanggalIndonesia(activeBalita.tanggalLahir)} ({calculateAgeInMonths(activeBalita.tanggalLahir)} Bulan)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Nama Ibu</p>
                    <p className="text-saas-dark text-xs mt-0.5">{activeBalita.namaIbu}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">No. WA / HP Orang Tua</p>
                    {activeBalita.noHp ? (
                      <a
                        href={`https://wa.me/${activeBalita.noHp.replace(/^0/, "62").replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-saas-primary text-xs font-bold mt-0.5 hover:underline flex items-center gap-1"
                      >
                        {activeBalita.noHp} ↗
                      </a>
                    ) : (
                      <p className="text-saas-dark text-xs mt-0.5 leading-snug text-saas-muted italic">Belum diisi</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Alamat Rumah</p>
                    <p className="text-saas-dark text-xs mt-0.5 leading-snug">{activeBalita.alamat}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Pemeriksaan Baru Bulan Ini */}
            <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-saas-dark">Input Hasil Pemeriksaan Bulan Ini</h3>
                  <p className="text-xs text-saas-muted mt-0.5">Masukkan data pengukuran BB, TB, LK, dan vitamin.</p>
                </div>
                {currentPeriodExam ? (
                  <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Diisi Periode Ini
                  </span>
                ) : (
                  <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Belum Diisi Periode Ini
                  </span>
                )}
              </div>

              {/* Form Input */}
              <form onSubmit={handleAddExamSubmit} className="space-y-4">
                {examError && (
                  <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {examError}
                  </div>
                )}
                {examWarning && (
                  <div className="p-3 bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-lg text-xs font-semibold flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {examWarning}
                  </div>
                )}

                {/* Tanggal Periksa */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-saas-muted flex items-center justify-between">
                    <span>Tanggal Periksa</span>
                    <span className="text-[10px] text-teal-600 font-normal">(mengikuti tanggal periode pelayanan)</span>
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                  />
                </div>

                {/* Umur & Jenis Kelamin (Otomatis) */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/70 rounded-xl border border-teal-150">
                  <div>
                    <span className="text-[11px] font-bold text-teal-800 block">Umur:</span>
                    <span className="text-xs font-extrabold text-teal-950">
                      {activeBalita ? `${calculateAgeInMonths(activeBalita.tanggalLahir, new Date(examDate))} Bulan` : "-"}
                    </span>
                    <span className="text-[10px] text-teal-600 ml-1 font-semibold">(otomatis)</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-teal-800 block">Jenis Kelamin:</span>
                    <span className="text-xs font-extrabold text-teal-950">
                      {activeBalita?.jenisKelamin === 'L' ? 'Laki-laki (L)' : activeBalita?.jenisKelamin === 'P' ? 'Perempuan (P)' : '-'}
                    </span>
                    <span className="text-[10px] text-teal-600 ml-1 font-semibold">(otomatis)</span>
                  </div>
                </div>

                {/* Layout BB, TB & Status Gizi */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
                  {/* BB & TB Input */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-saas-dark">BB (Berat Badan - kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Contoh: 8.5"
                        value={examBB}
                        onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                        onChange={(e) => {
                          const val = e.target.value.replace(/-/g, "");
                          setExamBB(val);
                          handleExamInputCheck(val, examTB);
                        }}
                        className="w-full p-2.5 bg-white border border-gray-250 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-saas-dark">TB (Tinggi Badan - cm)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Contoh: 72.4"
                        value={examTB}
                        onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                        onChange={(e) => {
                          const val = e.target.value.replace(/-/g, "");
                          setExamTB(val);
                          handleExamInputCheck(examBB, val);
                        }}
                        className="w-full p-2.5 bg-white border border-gray-250 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                      />
                    </div>
                  </div>

                  {/* Status Gizi Box */}
                  <div className="bg-white p-3 rounded-lg border border-teal-200 shadow-2xs flex flex-col justify-between space-y-2">
                    <div className="flex items-center justify-between border-b border-teal-100 pb-1.5">
                      <h4 className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">Status Gizi</h4>
                      <span className="text-[10px] text-teal-600 font-semibold">(otomatis)</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-saas-muted">BB/U:</span>
                        <span className={`px-2.5 py-1 rounded border ${getStatusBadgeStyle('BBU', examBBU || '')}`}>{examBBU}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-saas-muted">TB/U:</span>
                        <span className={`px-2.5 py-1 rounded border ${getStatusBadgeStyle('TBU', examTBU || '')}`}>{examTBU}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-saas-muted">BB/TB:</span>
                        <span className={`px-2.5 py-1 rounded border ${getStatusBadgeStyle('BBTB', examBBTB || '')}`}>{examBBTB}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lingkar Lengan & Lingkar Kepala */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Lingkar Lengan (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Contoh: 12.5"
                      value={examLiLA}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamLiLA(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Lingkar Kepala (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Contoh: 45"
                      value={examLK}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamLK(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>
                </div>

                {/* Status Imunisasi Opsional */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-saas-muted">Status Imunisasi</label>
                  <input
                    type="text"
                    placeholder="Contoh: BCG, Polio 1"
                    value={examImunisasi}
                    onChange={(e) => setExamImunisasi(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                  />
                </div>

                {/* ASI Eksklusif */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="text-xs font-bold text-saas-dark block">ASI Eksklusif:</label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="asiEksklusifBalita"
                        checked={examAsi === true}
                        onChange={() => setExamAsi(true)}
                        className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                      />
                      <span className="text-xs font-semibold text-saas-dark">Masih</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="asiEksklusifBalita"
                        checked={examAsi === false}
                        onChange={() => setExamAsi(false)}
                        className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                      />
                      <span className="text-xs font-semibold text-saas-dark">Tidak</span>
                    </label>
                  </div>
                </div>

                {/* Vitamin & Opsi Pemberian Lain */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="text-xs font-bold text-saas-dark block">Vitamin & Pemberian Lain:</label>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-saas-dark hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={examVitA}
                        onChange={(e) => setExamVitA(e.target.checked)}
                        className="w-4 h-4 text-saas-primary rounded focus:ring-saas-primary/30"
                      />
                      <span>Vit A</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-saas-dark hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={examVitB1}
                        onChange={(e) => setExamVitB1(e.target.checked)}
                        className="w-4 h-4 text-saas-primary rounded focus:ring-saas-primary/30"
                      />
                      <span>Vit B1</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-saas-dark hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={examVitB6}
                        onChange={(e) => setExamVitB6(e.target.checked)}
                        className="w-4 h-4 text-saas-primary rounded focus:ring-saas-primary/30"
                      />
                      <span>Vit B6</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200 text-xs font-semibold text-saas-dark hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={examCacing}
                        onChange={(e) => setExamCacing(e.target.checked)}
                        className="w-4 h-4 text-saas-primary rounded focus:ring-saas-primary/30"
                      />
                      <span>Obat Cacing</span>
                    </label>

                    {/* Custom Pemberian Options (Permanen per Posyandu) */}
                    {masterPemberianOptions.map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none bg-teal-50 px-2.5 py-1.5 rounded-md border border-teal-200 text-xs font-semibold text-teal-900 hover:bg-teal-100">
                        <input
                          type="checkbox"
                          checked={Boolean(checkedPemberianMap[opt])}
                          onChange={(e) => {
                            setCheckedPemberianMap(prev => ({ ...prev, [opt]: e.target.checked }));
                          }}
                          className="w-4 h-4 text-saas-primary rounded focus:ring-saas-primary/30"
                        />
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMasterPemberian(opt);
                          }}
                          className="text-gray-400 hover:text-red-500 text-[11px] ml-1 font-bold"
                          title={`Hapus opsi ${opt} secara permanen`}
                        >
                          ✕
                        </button>
                      </label>
                    ))}
                  </div>

                  {/* Add Dynamic Option Controls */}
                  {showAddPemberianInput ? (
                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="text"
                        placeholder="Nama opsi pemberian lain (contoh: Zinc, Taburia)"
                        value={newPemberianInput}
                        onChange={(e) => setNewPemberianInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomPemberian();
                          }
                        }}
                        className="p-1.5 border border-gray-250 rounded text-xs w-64 focus:outline-none focus:border-saas-primary"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPemberian}
                        className="px-2.5 py-1.5 bg-saas-primary text-white text-xs font-bold rounded hover:bg-teal-600"
                      >
                        Tambah
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAddPemberianInput(false); setNewPemberianInput(""); }}
                        className="px-2.5 py-1.5 bg-gray-100 text-saas-muted text-xs font-bold rounded hover:bg-gray-200"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddPemberianInput(true)}
                      className="text-xs font-bold text-saas-primary hover:text-teal-700 flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambahkan fitur opsi pemberian lain
                    </button>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> {currentPeriodExam ? "Perbarui Hasil Periksa" : "Simpan Hasil Periksa"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* GRAFIK PERTUMBUHAN BALITA (LINE CHART) */}
          <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-saas-dark flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-saas-primary" />
                  Grafik Pertumbuhan Balita (BB, TB &amp; LK)
                </h3>
                <p className="text-xs text-saas-muted mt-0.5">
                  Grafik tren pertumbuhan berat badan (kg), tinggi badan (cm), dan lingkar kepala (cm) berdasarkan riwayat periksa.
                </p>
              </div>
              <span className="text-xs font-bold text-saas-muted bg-gray-50 px-2.5 py-1 rounded-full border border-gray-150">
                {activeBalita.pemeriksaan.length} Data Periksa
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              {activeBalita.pemeriksaan.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...activeBalita.pemeriksaan]
                      .sort((a, b) => new Date(a.tanggalPeriksa).getTime() - new Date(b.tanggalPeriksa).getTime())
                      .map(p => ({
                        tanggal: formatTanggalIndonesia(p.tanggalPeriksa),
                        "Berat Badan (kg)": p.beratBadan,
                        "Tinggi Badan (cm)": p.tinggiBadan,
                        "Lingkar Kepala (cm)": p.lingkarKepala || null,
                      }))}
                  >
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
                    <Line
                      type="monotone"
                      dataKey="Berat Badan (kg)"
                      stroke="#0D9488"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Tinggi Badan (cm)"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Lingkar Kepala (cm)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-saas-muted font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  Belum ada riwayat pemeriksaan untuk menampilkan grafik pertumbuhan.
                </div>
              )}
            </div>
          </div>

          {/* Tabel Riwayat Pemeriksaan Bulanan */}
          <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-base text-saas-dark">Riwayat Perkembangan Bulanan</h3>
                <p className="text-xs text-saas-muted mt-0.5">Catatan riwayat kesehatan yang sudah tersimpan sebelumnya.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                    <th className="pb-3">Tanggal Periksa</th>
                    <th className="pb-3">Usia Bulan</th>
                    <th className="pb-3">Berat (kg)</th>
                    <th className="pb-3">Tinggi (cm)</th>
                    <th className="pb-3">LKA</th>
                    <th className="pb-3">LiLA</th>
                    <th className="pb-3">BB/U</th>
                    <th className="pb-3">TB/U</th>
                    <th className="pb-3">BB/TB</th>
                    <th className="pb-3">Vit A</th>
                    <th className="pb-3">ASI Eksk.</th>
                    <th className="pb-3">Obat Cacing</th>
                    <th className="pb-3">Pemberian Lain</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBalita.pemeriksaan.length > 0 ? (
                    activeBalita.pemeriksaan.map((exam) => (
                      <tr key={exam.id} className="border-b border-gray-50 last:border-b-0 text-xs text-saas-dark">
                        <td className="py-4 font-bold">{formatTanggalIndonesia(exam.tanggalPeriksa)}</td>
                        <td className="py-4 font-semibold">{exam.usiaBulan} Bulan</td>
                        <td className="py-4 font-bold">{exam.beratBadan} kg</td>
                        <td className="py-4 font-bold">{exam.tinggiBadan} cm</td>
                        <td className="py-4 text-saas-muted">{exam.lingkarKepala ? `${exam.lingkarKepala} cm` : "-"}</td>
                        <td className="py-4 text-saas-muted">{exam.lingkarLengan ? `${exam.lingkarLengan} cm` : "-"}</td>
                        <td className="py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold ${
                              exam.statusBBU === "Normal"
                                ? "bg-trend-successBg text-trend-successText"
                                : "bg-trend-dangerBg text-trend-dangerText"
                            }`}
                          >
                            {exam.statusBBU}
                          </span>
                        </td>
                        <td className="py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold ${
                              exam.statusTBU === "Normal"
                                ? "bg-trend-successBg text-trend-successText"
                                : "bg-trend-dangerBg text-trend-dangerText"
                            }`}
                          >
                            {exam.statusTBU}
                          </span>
                        </td>
                        <td className="py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold ${
                              exam.statusBBTB === "Normal"
                                ? "bg-trend-successBg text-trend-successText"
                                : "bg-trend-dangerBg text-trend-dangerText"
                            }`}
                          >
                            {exam.statusBBTB}
                          </span>
                        </td>
                        <td className="py-4 font-semibold text-saas-muted">{exam.vitaminA ? "Ya" : "Tidak"}</td>
                        <td className="py-4 font-semibold text-saas-muted">{exam.asiEksklusif ? "Ya" : "Tidak"}</td>
                        <td className="py-4 font-semibold text-saas-muted">{exam.obatCacing ? "Ya" : "Tidak"}</td>
                        <td className="py-4 font-semibold text-saas-muted">{extractPemberianLain(exam.statusImunisasi)}</td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditExamModal(exam)}
                              className="px-2.5 py-1 text-xs font-bold border border-gray-200 text-saas-dark rounded hover:bg-saas-primary/10 hover:text-saas-primary transition-all"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openDeleteExamModal(exam.id)}
                              className="px-2.5 py-1 text-xs font-bold border border-red-200 text-trend-dangerText rounded hover:bg-red-50 transition-all"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={15} className="py-8 text-center text-xs text-saas-muted font-medium">
                        Belum ada riwayat pemeriksaan. Silakan input pada form di atas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW: TAMBAH BALITA FORM */}
      {/* ========================================================================= */}
      {view === "add" && (
        <div className="space-y-6 max-w-xl mx-auto bg-white p-6 rounded-card shadow-soft-card border border-gray-100/70">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-2 text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Batal & Kembali
          </button>

          <div>
            <h3 className="font-bold text-lg text-saas-dark">Daftarkan Balita Baru</h3>
            <p className="text-xs text-saas-muted mt-0.5">Masukkan data identitas anak yang akan didaftarkan di Posyandu.</p>
          </div>

          <form onSubmit={handleAddBalitaSubmit} className="space-y-4 pt-4">
            {formError && (
              <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
              </div>
            )}

            {/* Nama */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nama Lengkap Anak</label>
              <input
                type="text"
                placeholder="Contoh: Muhammad Rafif"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            {/* NIK */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nomor Induk Kependudukan (NIK - 16 digit, opsional)</label>
              <input
                type="text"
                maxLength={16}
                placeholder="Contoh: 330102xxxxxxxxxx"
                value={formNik}
                onChange={(e) => setFormNik(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            {/* No. HP / WA */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">No. WhatsApp / HP Orang Tua (Opsional)</label>
              <input
                type="text"
                placeholder="Contoh: 081234567890"
                value={formNoHp}
                onChange={(e) => setFormNoHp(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Tanggal Lahir */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Tanggal Lahir</label>
                <input
                  type="date"
                  value={formTglLahir}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setFormTglLahir(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                />
              </div>

              {/* Jenis Kelamin */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Jenis Kelamin</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer select-none">
                    <input
                      type="radio"
                      name="jk"
                      checked={formJk === "L"}
                      onChange={() => setFormJk("L")}
                      className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                    />
                    Laki-laki
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer select-none">
                    <input
                      type="radio"
                      name="jk"
                      checked={formJk === "P"}
                      onChange={() => setFormJk("P")}
                      className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                    />
                    Perempuan
                  </label>
                </div>
              </div>
            </div>

            {/* Nama Ibu */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nama Lengkap Ibu Kandung</label>
              <input
                type="text"
                placeholder="Contoh: Ibu Siti"
                value={formNamaIbu}
                onChange={(e) => setFormNamaIbu(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            {/* Alamat */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Alamat Rumah (RT/RW/Desa)</label>
              <textarea
                rows={2}
                placeholder="Contoh: RT 01 / RW 02, Desa Karanggayam"
                value={formAlamat}
                onChange={(e) => setFormAlamat(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Daftarkan Anak
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIT BALITA */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profil Balita"
      >
        <form onSubmit={handleEditBalitaSubmit} className="space-y-4">
          {editError && (
            <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold">
              {editError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">Nama Lengkap Anak</label>
            <input
              type="text"
              required
              value={editNama}
              onChange={(e) => setEditNama(e.target.value)}
              className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">NIK (16 digit, opsional)</label>
            <input
              type="text"
              maxLength={16}
              value={editNik}
              onChange={(e) => setEditNik(e.target.value)}
              className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">No. WhatsApp / HP Orang Tua (opsional)</label>
            <input
              type="text"
              placeholder="Contoh: 081234567890"
              value={editNoHp}
              onChange={(e) => setEditNoHp(e.target.value)}
              className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">Tanggal Lahir</label>
              <input
                type="date"
                required
                value={editTglLahir}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onChange={(e) => setEditTglLahir(e.target.value)}
                className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary cursor-pointer"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">Jenis Kelamin</label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-saas-dark cursor-pointer">
                  <input
                    type="radio"
                    name="editJk"
                    checked={editJk === "L"}
                    onChange={() => setEditJk("L")}
                  />
                  Laki-laki
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-saas-dark cursor-pointer">
                  <input
                    type="radio"
                    name="editJk"
                    checked={editJk === "P"}
                    onChange={() => setEditJk("P")}
                  />
                  Perempuan
                </label>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">Nama Ibu Kandung</label>
            <input
              type="text"
              required
              value={editNamaIbu}
              onChange={(e) => setEditNamaIbu(e.target.value)}
              className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">Alamat Rumah</label>
            <textarea
              rows={2}
              required
              value={editAlamat}
              onChange={(e) => setEditAlamat(e.target.value)}
              className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 border border-hairline rounded-pill text-xs font-semibold text-saas-dark hover:bg-surface-soft"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-saas-primary text-white rounded-pill text-xs font-semibold hover:bg-saas-primary-active disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL KONFIRMASI HAPUS BALITA */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Profil Balita"
      >
        <div className="space-y-4">
          <p className="text-sm text-saas-dark font-medium">
            Apakah Anda yakin ingin menghapus data profil balita <span className="font-bold text-trend-dangerText">{activeBalita?.nama}</span>?
          </p>
          <p className="text-xs text-saas-muted">
            Seluruh riwayat pemeriksaan anak ini juga akan dihapus secara permanen dari sistem.
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
              onClick={handleDeleteBalita}
              disabled={isSaving}
              className="px-4 py-2 bg-trend-dangerText text-white rounded-pill text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? "Menghapus..." : "Ya, Hapus Permanen"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL EDIT PEMERIKSAAN BALITA */}
      <Modal
        isOpen={isEditExamModalOpen}
        onClose={() => setIsEditExamModalOpen(false)}
        title="Edit Riwayat Pemeriksaan Balita"
      >
        <form onSubmit={handleEditExamSubmit} className="space-y-4">
          {editExamError && (
            <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {editExamError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-saas-muted">Tanggal Periksa</label>
              <input
                type="date"
                required
                value={editExamDate}
                onChange={(e) => setEditExamDate(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Berat Badan (kg)</label>
              <input
                type="number"
                step="0.1"
                required
                value={editExamBB}
                onChange={(e) => handleEditExamMeasurementsChange(e.target.value, editExamTB, editExamDate)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Tinggi Badan (cm)</label>
              <input
                type="number"
                step="0.1"
                required
                value={editExamTB}
                onChange={(e) => handleEditExamMeasurementsChange(editExamBB, e.target.value, editExamDate)}
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
                value={editExamLK}
                onChange={(e) => setEditExamLK(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Lingkar Lengan LiLA (cm)</label>
              <input
                type="number"
                step="0.1"
                value={editExamLiLA}
                onChange={(e) => setEditExamLiLA(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
          </div>

          {/* Status Gizi Auto Z-Score */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
            <p className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Status Gizi (Otomatis)</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-saas-muted block text-[10px]">BB/U:</span>
                <span className="font-bold text-saas-dark">{editExamBBU}</span>
              </div>
              <div>
                <span className="text-saas-muted block text-[10px]">TB/U:</span>
                <span className="font-bold text-saas-dark">{editExamTBU}</span>
              </div>
              <div>
                <span className="text-saas-muted block text-[10px]">BB/TB:</span>
                <span className="font-bold text-saas-dark">{editExamBBTB}</span>
              </div>
            </div>
          </div>

          {/* Intervensi Tambahan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-150 rounded text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={editExamVitA}
                onChange={(e) => setEditExamVitA(e.target.checked)}
                className="w-4 h-4 text-saas-primary rounded"
              />
              Vitamin A
            </label>
            <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-150 rounded text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={editExamAsi}
                onChange={(e) => setEditExamAsi(e.target.checked)}
                className="w-4 h-4 text-saas-primary rounded"
              />
              ASI Eksklusif
            </label>
            <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-150 rounded text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={editExamCacing}
                onChange={(e) => setEditExamCacing(e.target.checked)}
                className="w-4 h-4 text-saas-primary rounded"
              />
              Obat Cacing
            </label>
            <div>
              <input
                type="text"
                placeholder="Imunisasi..."
                value={editExamImunisasi}
                onChange={(e) => setEditExamImunisasi(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsEditExamModalOpen(false)}
              className="px-4 py-2 border border-hairline rounded-pill text-xs font-semibold text-saas-dark hover:bg-surface-soft"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-saas-primary text-white rounded-pill text-xs font-semibold hover:bg-saas-primary-active disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL KONFIRMASI HAPUS PEMERIKSAAN BALITA */}
      <Modal
        isOpen={isDeleteExamModalOpen}
        onClose={() => setIsDeleteExamModalOpen(false)}
        title="Hapus Data Pemeriksaan"
      >
        <div className="space-y-4">
          <p className="text-sm text-saas-dark font-medium">
            Apakah Anda yakin ingin menghapus data catatan pemeriksaan bulanan balita ini?
          </p>
          <p className="text-xs text-saas-muted">
            Tindakan ini tidak dapat dibatalkan dan catatan pemeriksaan akan terhapus dari riwayat balita.
          </p>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsDeleteExamModalOpen(false)}
              className="px-4 py-2 border border-hairline rounded-pill text-xs font-semibold text-saas-dark hover:bg-surface-soft"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDeleteExamSubmit}
              disabled={isSaving}
              className="px-4 py-2 bg-trend-dangerText text-white rounded-pill text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? "Menghapus..." : "Ya, Hapus Record"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
