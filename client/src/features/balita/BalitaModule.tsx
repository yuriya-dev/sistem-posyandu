"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import PageHelmet from "../../components/PageHelmet";
import { hitungStatusBbU, hitungStatusTbU, hitungStatusBbTb, convertStatusBbUToCode, convertStatusTbUToCode, convertStatusBbTbToCode } from "../../lib/zScoreCalculator";
import { formatTanggalInput } from "../../lib/dateUtils";
import { getExamDraft, saveExamDraft, clearExamDraft } from "../../lib/draftStorage";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import { balitaApi, PeriodePelayanan } from "../../lib/api";
import { SearchIndex } from "../../lib/searchIndex";
import { clientDataCache } from "../../lib/dataCache";
import { Balita, PemeriksaanBalita } from "./types";
import { calculateAgeInMonths } from "../pelayanan/types";
import BalitaListTable from "./components/BalitaListTable";
import BalitaDetailView from "./components/BalitaDetailView";
import BalitaAddForm from "./components/BalitaAddForm";
import BalitaModals from "./components/BalitaModals";

export type { Balita, PemeriksaanBalita };

interface BalitaModuleProps {
  posyanduId: string;
  activePeriode?: PeriodePelayanan | null;
  onNavigateToPelayanan?: (id: string) => void;
  searchQuery?: string;
  selectedId?: string;
  onBack?: () => void;
  backLabel?: string;
}

export default function BalitaModule({ posyanduId, activePeriode, onNavigateToPelayanan, selectedId, searchQuery = "", onBack, backLabel }: BalitaModuleProps) {
  const { user } = useAuth();
  const initialCacheKey = `balitas_${posyanduId}_p1_lim10`;
  const [balitas, setBalitas] = useState<Balita[]>(() => {
    if (typeof window !== "undefined" && posyanduId) {
      const cached = clientDataCache.get<Balita[]>(initialCacheKey);
      if (cached && cached.length > 0) return cached;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== "undefined" && posyanduId) {
      const cached = clientDataCache.get<Balita[]>(initialCacheKey);
      if (cached && cached.length > 0) return false;
    }
    return true;
  });
  const [isFetching, setIsFetching] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<"list" | "detail" | "add">("list");
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | null>(selectedId || null);
  const [detailBalita, setDetailBalita] = useState<Balita | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(Boolean(selectedId));

  // In-Memory Search Index for instant O(1) query lookups by token/prefix
  const balitaIndexRef = useRef<SearchIndex<Balita>>(
    new SearchIndex<Balita>((b) => [
      b.nama,
      b.nik,
      b.noHp,
      b.namaIbu,
      b.alamat,
      b.jenisKelamin === "L" ? "laki-laki l" : "perempuan p",
    ])
  );
  const balitasPoolRef = useRef<Map<string, Balita>>(new Map());

  // Keep in-memory search index updated with all discovered items
  useEffect(() => {
    balitas.forEach((b) => {
      balitasPoolRef.current.set(b.id, b);
    });
    balitaIndexRef.current.setSource(Array.from(balitasPoolRef.current.values()));
  }, [balitas]);

  // Search, Filter & Pagination State
  const [query, setQuery] = useState(searchQuery || "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery || "");

  useEffect(() => {
    if (searchQuery !== undefined) {
      setQuery(searchQuery || "");
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
      setIsDetailLoading(true);
      if (posyanduId) {
        balitaApi
          .getById(posyanduId, selectedId)
          .then((res) => {
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
              setDetailBalita(mappedSingle);
              setBalitas((prev) => {
                const idx = prev.findIndex((item) => item.id === b.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = mappedSingle;
                  return next;
                }
                return [mappedSingle, ...prev];
              });
            } else {
              setDetailBalita(null);
            }
          })
          .catch((err) => {
            console.error("Gagal mengambil detail balita:", err);
            setDetailBalita(null);
          })
          .finally(() => {
            setIsDetailLoading(false);
          });
      }
    } else {
      setSelectedBalitaId(null);
      setDetailBalita(null);
      setIsDetailLoading(false);
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
  const [tindakLanjutFilter, setTindakLanjutFilter] = useState<"semua" | "perlu_tindak_lanjut" | "normal" | "belum_periksa">("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Helper identifikasi balita berisiko / perlu tindak lanjut
  const isPerluTindakLanjut = useCallback((b: Balita) => {
    const latestExam = b.pemeriksaan?.[0];
    if (!latestExam) return false;
    const bbu = String(latestExam.statusBBU || "").toLowerCase();
    const tbu = String(latestExam.statusTBU || "").toLowerCase();
    const bbtb = String(latestExam.statusBBTB || "").toLowerCase();
    return (
      tbu.includes("pendek") || tbu === "sp" || tbu === "p" ||
      bbtb.includes("kurus") || bbtb.includes("kurang") || bbtb.includes("buruk") || bbtb.includes("gemuk") || bbtb === "sk" || bbtb === "k" || bbtb === "g" ||
      bbu.includes("kurang") || bbu === "sk" || bbu === "k"
    );
  }, []);

  // Fetch balita from API
  const fetchBalitas = useCallback(() => {
    const kelompokUsiaParam =
      ageFilter === "0-6" ? "0-6 bulan" :
      ageFilter === "7-12" ? "7-12 bulan" :
      ageFilter === "13-24" ? "13-24 bulan" :
      ageFilter === "25-60" ? "25-60 bulan" : undefined;

    const tindakLanjutParam = tindakLanjutFilter !== "semua" ? tindakLanjutFilter : undefined;

    const pageCacheKey = `balitas_${posyanduId}_p${currentPage}_q${debouncedQuery || ""}_a${ageFilter}_t${tindakLanjutFilter}_lim${limit}`;
    const cachedPage = clientDataCache.get<{ data: Balita[]; total: number; totalPages: number }>(pageCacheKey);

    if (cachedPage) {
      setBalitas(cachedPage.data);
      setTotalItems(cachedPage.total);
      setTotalPages(cachedPage.totalPages);
      setIsLoading(false);
      return;
    }

    // Only show skeleton on initial cold load when there is no data to show
    if (balitas.length === 0) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    setApiError(null);

    balitaApi
      .getAll(posyanduId, {
        search: debouncedQuery || undefined,
        kelompokUsia: kelompokUsiaParam,
        tindakLanjut: tindakLanjutParam,
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
          const total = res.meta ? res.meta.total : mapped.length;
          const totPages = res.meta ? res.meta.totalPages : 1;
          setTotalItems(total);
          setTotalPages(totPages);

          // Save page in cache
          clientDataCache.set(pageCacheKey, { data: mapped, total, totalPages: totPages });
          if (currentPage === 1 && !debouncedQuery && ageFilter === "semua" && tindakLanjutFilter === "semua" && limit === 10) {
            clientDataCache.set(initialCacheKey, mapped);
          }
        }
      })
      .catch((err) => setApiError(err.message))
      .finally(() => {
        setIsLoading(false);
        setIsFetching(false);
      });
  }, [posyanduId, debouncedQuery, ageFilter, tindakLanjutFilter, currentPage, limit, balitas.length, initialCacheKey]);

  useEffect(() => {
    fetchBalitas();
  }, [fetchBalitas]);

  // Filter List Balita (Search by Index + Client-side age & tindak lanjut filter)
  const filteredBalitas = useMemo(() => {
    const source = query && query.trim()
      ? balitaIndexRef.current.search(query)
      : balitas;

    return source.filter((b) => {
      const ageMonths = calculateAgeInMonths(b.tanggalLahir);
      let matchesAge = true;
      if (ageFilter === "0-6") matchesAge = ageMonths >= 0 && ageMonths <= 6;
      else if (ageFilter === "7-12") matchesAge = ageMonths >= 7 && ageMonths <= 12;
      else if (ageFilter === "13-24") matchesAge = ageMonths >= 13 && ageMonths <= 24;
      else if (ageFilter === "25-60") matchesAge = ageMonths >= 25 && ageMonths <= 60;
      if (!matchesAge) return false;

      if (tindakLanjutFilter === "perlu_tindak_lanjut") {
        return isPerluTindakLanjut(b);
      }
      if (tindakLanjutFilter === "normal") {
        const latestExam = b.pemeriksaan?.[0];
        return Boolean(latestExam && !isPerluTindakLanjut(b));
      }
      if (tindakLanjutFilter === "belum_periksa") {
        return !b.pemeriksaan || b.pemeriksaan.length === 0;
      }

      return true;
    });
  }, [query, balitas, ageFilter, tindakLanjutFilter, isPerluTindakLanjut]);
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
    toast.success(`Opsi "${optToDelete}" berhasil dihapus.`);
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

  const activeBalita = (detailBalita && detailBalita.id === selectedBalitaId)
    ? detailBalita
    : balitas.find((b) => b.id === selectedBalitaId);

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
      clientDataCache.invalidate("balitas_" + posyanduId);
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
      clientDataCache.invalidate("balitas_" + posyanduId);
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
      clientDataCache.invalidate("balitas_" + posyanduId);
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
  const checkExamWarning = (bbVal: string, tbVal?: string) => {
    setExamWarning("");
    if (!activeBalita) return;

    const bb = parseFloat(bbVal);
    const tb = parseFloat(tbVal !== undefined ? tbVal : examTB);
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
  const handleExamInputCheck = checkExamWarning;

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

      {/* 1. VIEW: LIST BALITA */}
      {view === "list" && (
        <BalitaListTable
          balitas={balitas}
          filteredBalitas={filteredBalitas}
          isLoading={isLoading}
          query={query}
          setQuery={setQuery}
          ageFilter={ageFilter}
          setAgeFilter={setAgeFilter}
          tindakLanjutFilter={tindakLanjutFilter}
          setTindakLanjutFilter={setTindakLanjutFilter}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          limit={limit}
          setLimit={setLimit}
          totalItems={totalItems}
          totalPages={totalPages}
          onAddNew={() => setView("add")}
          onSelectDetail={(id) => {
            setSelectedBalitaId(id);
            const found = balitas.find((b) => b.id === id);
            if (found) setDetailBalita(found);
            setView("detail");
          }}
        />
      )}

      {/* 2. VIEW: DETAIL BALITA & RIWAYAT BULANAN */}
      {view === "detail" && (
        isDetailLoading && !activeBalita ? (
          <div className="space-y-6 animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                setView("list");
                setSelectedBalitaId(null);
                setDetailBalita(null);
                if (onBack) onBack();
              }}
              className="flex items-center gap-2 text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> {backLabel || "Kembali ke Daftar Balita"}
            </button>
            <div className="bg-white rounded-card shadow-soft-card border border-gray-100 p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-saas-primary mx-auto mb-3"></div>
              <p className="text-sm font-semibold text-saas-dark">Memuat data profil balita...</p>
              <p className="text-xs text-saas-muted mt-1">Mohon tunggu sebentar.</p>
            </div>
          </div>
        ) : activeBalita ? (
          <BalitaDetailView
            activeBalita={activeBalita}
            onBack={() => {
              setView("list");
              setSelectedBalitaId(null);
              setDetailBalita(null);
              if (onBack) onBack();
            }}
            backLabel={backLabel}
            onEditProfile={openEditModal}
            onDeleteProfile={() => setIsDeleteModalOpen(true)}
            currentPeriodExam={currentPeriodExam}
            examDate={examDate}
            setExamDate={setExamDate}
            examBB={examBB}
            setExamBB={setExamBB}
            examTB={examTB}
            setExamTB={setExamTB}
            examBBU={examBBU}
            examTBU={examTBU}
            examBBTB={examBBTB}
            examLK={examLK}
            setExamLK={setExamLK}
            examLiLA={examLiLA}
            setExamLiLA={setExamLiLA}
            examAsi={examAsi}
            setExamAsi={setExamAsi}
            examVitA={examVitA}
            setExamVitA={setExamVitA}
            examVitB1={examVitB1}
            setExamVitB1={setExamVitB1}
            examVitB6={examVitB6}
            setExamVitB6={setExamVitB6}
            examCacing={examCacing}
            setExamCacing={setExamCacing}
            masterPemberianOptions={masterPemberianOptions}
            checkedPemberianMap={checkedPemberianMap}
            setCheckedPemberianMap={setCheckedPemberianMap}
            onDeleteMasterPemberian={handleDeleteMasterPemberian}
            showAddPemberianInput={showAddPemberianInput}
            setShowAddPemberianInput={setShowAddPemberianInput}
            newPemberianInput={newPemberianInput}
            setNewPemberianInput={setNewPemberianInput}
            onAddCustomPemberian={handleAddCustomPemberian}
            examError={examError}
            examWarning={examWarning}
            checkExamWarning={checkExamWarning}
            onAddExamSubmit={handleAddExamSubmit}
            onEditExam={openEditExamModal}
            onDeleteExam={openDeleteExamModal}
          />
        ) : (
          <div className="space-y-6 animate-fadeIn">
            <button
              type="button"
              onClick={() => {
                setView("list");
                setSelectedBalitaId(null);
                setDetailBalita(null);
                if (onBack) onBack();
              }}
              className="flex items-center gap-2 text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> {backLabel || "Kembali ke Daftar Balita"}
            </button>
            <div className="bg-white rounded-card shadow-soft-card border border-gray-100 p-12 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-saas-dark">Data profil balita tidak ditemukan</p>
              <p className="text-xs text-saas-muted mt-1 mb-4">Balita mungkin telah dihapus atau tidak terdaftar pada posyandu ini.</p>
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setSelectedBalitaId(null);
                  setDetailBalita(null);
                  if (onBack) onBack();
                }}
                className="px-4 py-2 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
              >
                Kembali ke Daftar Balita
              </button>
            </div>
          </div>
        )
      )}

      {/* 3. VIEW: TAMBAH BALITA FORM */}
      {view === "add" && (
        <BalitaAddForm
          onBack={() => setView("list")}
          formNama={formNama}
          setFormNama={setFormNama}
          formNik={formNik}
          setFormNik={setFormNik}
          formNoHp={formNoHp}
          setFormNoHp={setFormNoHp}
          formTglLahir={formTglLahir}
          setFormTglLahir={setFormTglLahir}
          formJk={formJk}
          setFormJk={setFormJk}
          formNamaIbu={formNamaIbu}
          setFormNamaIbu={setFormNamaIbu}
          formAlamat={formAlamat}
          setFormAlamat={setFormAlamat}
          formError={formError}
          onSubmit={handleAddBalitaSubmit}
        />
      )}

      {/* MODALS */}
      <BalitaModals
        isEditModalOpen={isEditModalOpen}
        setIsEditModalOpen={setIsEditModalOpen}
        editNama={editNama}
        setEditNama={setEditNama}
        editNik={editNik}
        setEditNik={setEditNik}
        editNoHp={editNoHp}
        setEditNoHp={setEditNoHp}
        editTglLahir={editTglLahir}
        setEditTglLahir={setEditTglLahir}
        editJk={editJk}
        setEditJk={setEditJk}
        editNamaIbu={editNamaIbu}
        setEditNamaIbu={setEditNamaIbu}
        editAlamat={editAlamat}
        setEditAlamat={setEditAlamat}
        editError={editError}
        isSaving={isSaving}
        onEditBalitaSubmit={handleEditBalitaSubmit}
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        activeBalita={activeBalita || null}
        onDeleteBalita={handleDeleteBalita}
        isEditExamModalOpen={isEditExamModalOpen}
        setIsEditExamModalOpen={setIsEditExamModalOpen}
        editExamError={editExamError}
        editExamDate={editExamDate}
        setEditExamDate={setEditExamDate}
        editExamBB={editExamBB}
        editExamTB={editExamTB}
        editExamLK={editExamLK}
        setEditExamLK={setEditExamLK}
        editExamLiLA={editExamLiLA}
        setEditExamLiLA={setEditExamLiLA}
        editExamBBU={editExamBBU}
        editExamTBU={editExamTBU}
        editExamBBTB={editExamBBTB}
        editExamVitA={editExamVitA}
        setEditExamVitA={setEditExamVitA}
        editExamAsi={editExamAsi}
        setEditExamAsi={setEditExamAsi}
        editExamCacing={editExamCacing}
        setEditExamCacing={setEditExamCacing}
        editExamImunisasi={editExamImunisasi}
        setEditExamImunisasi={setEditExamImunisasi}
        onEditExamMeasurementsChange={handleEditExamMeasurementsChange}
        onEditExamSubmit={handleEditExamSubmit}
        isDeleteExamModalOpen={isDeleteExamModalOpen}
        setIsDeleteExamModalOpen={setIsDeleteExamModalOpen}
        onDeleteExamSubmit={handleDeleteExamSubmit}
      />
    </div>
  );
}
