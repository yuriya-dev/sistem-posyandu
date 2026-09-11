'use client';

import { useState, useEffect, useCallback } from "react";
import Modal from "../../components/Modal";
import PageHelmet from "../../components/PageHelmet";
import { TableSkeleton } from "../../components/Skeleton";
import LansiaIcon from "../../components/LansiaIcon";
import { lansiaApi } from "../../lib/api";
import { formatTanggalIndonesia, formatTanggalInput } from "../../lib/dateUtils";
import { getExamDraft, saveExamDraft, clearExamDraft } from "../../lib/draftStorage";
import { useAuth } from "../../contexts/AuthContext";
import {
  ArrowLeft,
  Plus,
  Search,
  Heart,
  Calendar,
  User,
  MapPin,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ChevronRight,
  ClipboardList,
  ShieldCheck,
  BrainCircuit,
  Phone,
  TrendingUp
} from "lucide-react";
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
import { hitungIMT } from "../../lib/zScoreCalculator";

// Tipe Data
export interface PemeriksaanLansia {
  id: string;
  tanggalPeriksa: string;
  beratBadan: number; // kg
  tinggiBadan: number; // cm
  tekananDarahSistol: number; // mmHg
  tekananDarahDiastol: number; // mmHg
  gulaDarahSewaktu: number; // mg/dL
  lingkarPerut: number; // cm
  kolesterol?: number;
  asamUrat?: number;
  keluhan?: string;
  tindakan?: string;
}

export interface Lansia {
  id: string;
  nama: string;
  nik: string;
  noHp?: string;
  noBpjs?: string;
  tanggalLahir: string;
  jenisKelamin: "L" | "P";
  rtRw: string;
  alamat: string;
  riwayatHt: boolean; // Hipertensi
  riwayatDm: boolean; // Diabetes
  tingkatKemandirian: "A" | "B" | "C"; // A: Mandiri, B: Bantuan Sebagian, C: Tergantung Total
  gangguanMentalEmosional?: string;
  pemeriksaan: PemeriksaanLansia[];
}

// Helper Hitung Umur (Tahun)
function calculateAgeInYears(birthDateStr: string, refDate: Date = new Date()): number {
  const birth = new Date(birthDateStr);
  let age = refDate.getFullYear() - birth.getFullYear();
  const m = refDate.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birth.getDate())) {
    age--;
  }
  return age <= 0 ? 0 : age;
}

interface LansiaModuleProps {
  posyanduId: string;
  searchQuery?: string;
  selectedId?: string;
  onBack?: () => void;
  backLabel?: string;
}

export default function LansiaModule({ posyanduId, searchQuery = "", selectedId, onBack, backLabel }: LansiaModuleProps) {
  const { user } = useAuth();
  const [lansias, setLansias] = useState<Lansia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [view, setView] = useState<"list" | "detail" | "add">("list");
  const [selectedLansiaId, setSelectedLansiaId] = useState<string | null>(selectedId || null);

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
      setSelectedLansiaId(selectedId);
      setView("detail");
      if (posyanduId) {
        lansiaApi.getById(posyanduId, selectedId).then((res) => {
          if (res.success && res.data) {
            const l = res.data;
            const mappedSingle: Lansia = {
              ...l,
              tanggalLahir: typeof l.tanggalLahir === "string" ? l.tanggalLahir.split("T")[0] : new Date(l.tanggalLahir).toISOString().split("T")[0],
              pemeriksaan: (l.pemeriksaans ?? []).map((p: any) => ({
                ...p,
                tanggalPeriksa: typeof p.tanggalPeriksa === "string" ? p.tanggalPeriksa.split("T")[0] : new Date(p.tanggalPeriksa).toISOString().split("T")[0],
              })),
            };
            setLansias((prev) => {
              const idx = prev.findIndex((item) => item.id === l.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = mappedSingle;
                return next;
              }
              return [mappedSingle, ...prev];
            });
          }
        }).catch((err) => console.error("Gagal mengambil detail lansia:", err));
      }
    } else {
      setSelectedLansiaId(null);
      setView("list");
    }
  }, [selectedId, posyanduId]);
  const [ageFilter, setAgeFilter] = useState<"semua" | "45-59" | "60-69" | "70+">("semua");
  const [diseaseFilter, setDiseaseFilter] = useState<"semua" | "ht" | "dm">("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Edit & Delete Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editNama, setEditNama] = useState("");
  const [editNik, setEditNik] = useState("");
  const [editNoHp, setEditNoHp] = useState("");
  const [editBpjs, setEditBpjs] = useState("");
  const [editTglLahir, setEditTglLahir] = useState("");
  const [editJk, setEditJk] = useState<"L" | "P">("L");
  const [editRtRw, setEditRtRw] = useState("");
  const [editAlamat, setEditAlamat] = useState("");
  const [editHt, setEditHt] = useState(false);
  const [editDm, setEditDm] = useState(false);
  const [editKemandirian, setEditKemandirian] = useState<"A" | "B" | "C">("A");
  const [editMental, setEditMental] = useState("");
  const [editError, setEditError] = useState("");

  // Edit & Delete Examination State
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);
  const [isDeleteExamModalOpen, setIsDeleteExamModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);

  const [editExamDate, setEditExamDate] = useState("");
  const [editExamBB, setEditExamBB] = useState("");
  const [editExamTB, setEditExamTB] = useState("");
  const [editExamSistol, setEditExamSistol] = useState("");
  const [editExamDiastol, setEditExamDiastol] = useState("");
  const [editExamGds, setEditExamGds] = useState("");
  const [editExamLp, setEditExamLp] = useState("");
  const [editExamCholesterol, setEditExamCholesterol] = useState("");
  const [editExamUricAcid, setEditExamUricAcid] = useState("");
  const [editExamKeluhan, setEditExamKeluhan] = useState("");
  const [editExamTindakan, setEditExamTindakan] = useState("");
  const [editExamError, setEditExamError] = useState("");

  // Fetch lansia from API
  const fetchLansias = useCallback(() => {
    setIsLoading(true);
    setApiError(null);

    const kelompokUmurParam =
      ageFilter === "45-59" ? "Pra Lansia (45-59th)" :
      ageFilter === "60-69" ? "Lansia (60-69th)" :
      ageFilter === "70+" ? "Lansia Risti (70th+)" : undefined;

    const htParam = diseaseFilter === "ht" ? "true" : undefined;
    const dmParam = diseaseFilter === "dm" ? "true" : undefined;

    lansiaApi
      .getAll(posyanduId, {
        search: debouncedQuery || undefined,
        kelompokUmur: kelompokUmurParam,
        ht: htParam,
        dm: dmParam,
        page: currentPage,
        limit: limit,
      })
      .then((res) => {
        if (res.success) {
          const mapped: Lansia[] = res.data.map((l) => ({
            ...l,
            tanggalLahir: typeof l.tanggalLahir === "string" ? l.tanggalLahir : new Date(l.tanggalLahir).toISOString().split("T")[0],
            pemeriksaan: (l.pemeriksaans ?? []).map((p) => ({
              ...p,
              tanggalPeriksa: typeof p.tanggalPeriksa === "string" ? p.tanggalPeriksa : new Date(p.tanggalPeriksa).toISOString().split("T")[0],
            })),
          }));
          setLansias(mapped);
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
  }, [posyanduId, debouncedQuery, ageFilter, diseaseFilter, currentPage, limit]);

  useEffect(() => {
    fetchLansias();
  }, [fetchLansias]);

  // Filter List Lansia (client-side)
  const filteredLansias = lansias.filter((l) => {
    const ageYears = calculateAgeInYears(l.tanggalLahir);
    let matchesAge = true;
    if (ageFilter === "45-59") matchesAge = ageYears >= 45 && ageYears <= 59;
    else if (ageFilter === "60-69") matchesAge = ageYears >= 60 && ageYears <= 69;
    else if (ageFilter === "70+") matchesAge = ageYears >= 70;
    let matchesDisease = true;
    if (diseaseFilter === "ht") matchesDisease = l.riwayatHt;
    else if (diseaseFilter === "dm") matchesDisease = l.riwayatDm;
    return matchesAge && matchesDisease;
  });

  // Form State Tambah Lansia
  const [formNama, setFormNama] = useState("");
  const [formNik, setFormNik] = useState("");
  const [formNoHp, setFormNoHp] = useState("");
  const [formBpjs, setFormBpjs] = useState("");
  const [formTglLahir, setFormTglLahir] = useState("1960-01-01");
  const [formJk, setFormJk] = useState<"L" | "P">("L");
  const [formRtRw, setFormRtRw] = useState("");
  const [formAlamat, setFormAlamat] = useState("Desa Karanggayam");
  const [formHt, setFormHt] = useState(false);
  const [formDm, setFormDm] = useState(false);
  const [formKemandirian, setFormKemandirian] = useState<"A" | "B" | "C">("A");
  const [formMental, setFormMental] = useState("");
  const [formError, setFormError] = useState("");

  // Form State Tambah Pemeriksaan
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [examBB, setExamBB] = useState("");
  const [examTB, setExamTB] = useState("");
  const [examSistol, setExamSistol] = useState("");
  const [examDiastol, setExamDiastol] = useState("");
  const [examGds, setExamGds] = useState("");
  const [examLp, setExamLp] = useState("");
  const [examCholesterol, setExamCholesterol] = useState("");
  const [examUricAcid, setExamUricAcid] = useState("");
  const [examKeluhan, setExamKeluhan] = useState("");
  const [examTindakan, setExamTindakan] = useState("");
  const [examWarning, setExamWarning] = useState("");
  const [examError, setExamError] = useState("");
  const activeLansia = lansias.find((l) => l.id === selectedLansiaId);

  // Auto-save form draft for selected lansia ke shared storage
  useEffect(() => {
    if (!selectedLansiaId) return;
    saveExamDraft(posyanduId, selectedLansiaId, {
      examDate,
      examBB,
      examTB,
      examSistol,
      examDiastol,
      examGds,
      examLp,
      examCholesterol,
      examUricAcid,
      examKeluhan,
      examTindakan,
    });
  }, [
    posyanduId,
    selectedLansiaId,
    examDate,
    examBB,
    examTB,
    examSistol,
    examDiastol,
    examGds,
    examLp,
    examCholesterol,
    examUricAcid,
    examKeluhan,
    examTindakan,
  ]);

  // Populate Edit Lansia
  const openEditModal = (l: Lansia) => {
    setEditNama(l.nama);
    setEditNik(l.nik);
    setEditNoHp(l.noHp || "");
    setEditBpjs(l.noBpjs || "");
    setEditTglLahir(formatTanggalInput(l.tanggalLahir));
    setEditJk(l.jenisKelamin);
    setEditRtRw(l.rtRw);
    setEditAlamat(l.alamat);
    setEditHt(l.riwayatHt);
    setEditDm(l.riwayatDm);
    setEditKemandirian(l.tingkatKemandirian);
    setEditMental(l.gangguanMentalEmosional || "");
    setEditError("");
    setIsEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditLansiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    if (!selectedLansiaId) return;

    if (!editNama.trim() || !editNik.trim() || !editRtRw.trim() || !editAlamat.trim()) {
      setEditError("Mohon isi nama lengkap, NIK, RT/RW, dan alamat.");
      return;
    }

    setIsSaving(true);
    try {
      await lansiaApi.update(posyanduId, selectedLansiaId, {
        nama: editNama,
        nik: editNik,
        noHp: editNoHp || undefined,
        noBpjs: editBpjs || undefined,
        tanggalLahir: editTglLahir,
        jenisKelamin: editJk,
        rtRw: editRtRw,
        alamat: editAlamat,
        riwayatHt: editHt,
        riwayatDm: editDm,
        tingkatKemandirian: editKemandirian,
        gangguanMentalEmosional: editMental || undefined,
      });
      fetchLansias();
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Gagal mengedit data lansia.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Lansia
  const handleDeleteLansia = async () => {
    if (!selectedLansiaId) return;
    setIsSaving(true);
    try {
      await lansiaApi.delete(posyanduId, selectedLansiaId);
      fetchLansias();
      setIsDeleteModalOpen(false);
      setSelectedLansiaId(null);
      setView("list");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus data lansia.");
    } finally {
      setIsSaving(false);
    }
  };

  // Open Edit Exam Modal
  const openEditExamModal = (exam: PemeriksaanLansia) => {
    setEditingExamId(exam.id);
    setEditExamDate(formatTanggalInput(exam.tanggalPeriksa));
    setEditExamBB(String(exam.beratBadan));
    setEditExamTB(String(exam.tinggiBadan));
    setEditExamSistol(String(exam.tekananDarahSistol));
    setEditExamDiastol(String(exam.tekananDarahDiastol));
    setEditExamGds(String(exam.gulaDarahSewaktu));
    setEditExamLp(String(exam.lingkarPerut));
    setEditExamCholesterol(exam.kolesterol ? String(exam.kolesterol) : "");
    setEditExamUricAcid(exam.asamUrat ? String(exam.asamUrat) : "");
    setEditExamKeluhan(exam.keluhan || "");
    setEditExamTindakan(exam.tindakan || "");
    setEditExamError("");
    setIsEditExamModalOpen(true);
  };

  // Open Delete Exam Modal
  const openDeleteExamModal = (examId: string) => {
    setDeletingExamId(examId);
    setIsDeleteExamModalOpen(true);
  };

  // Handle Edit Exam Submit
  const handleEditExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditExamError("");

    const bb = parseFloat(editExamBB);
    const tb = parseFloat(editExamTB);
    const sistol = parseInt(editExamSistol);
    const diastol = parseInt(editExamDiastol);
    const gds = parseFloat(editExamGds);
    const lp = parseFloat(editExamLp);
    const kol = editExamCholesterol ? parseFloat(editExamCholesterol) : undefined;
    const urat = editExamUricAcid ? parseFloat(editExamUricAcid) : undefined;

    if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0 || isNaN(sistol) || isNaN(diastol) || isNaN(gds) || isNaN(lp)) {
      setEditExamError("Mohon isi semua data pemeriksaan dengan angka positif yang valid.");
      return;
    }

    if (!activeLansia || !editingExamId) return;

    setIsSaving(true);
    try {
      await lansiaApi.updatePemeriksaan(posyanduId, activeLansia.id, editingExamId, {
        tanggalPeriksa: editExamDate,
        beratBadan: bb,
        tinggiBadan: tb,
        tekananDarahSistol: sistol,
        tekananDarahDiastol: diastol,
        gulaDarahSewaktu: gds,
        lingkarPerut: lp,
        kolesterol: kol,
        asamUrat: urat,
        keluhan: editExamKeluhan || undefined,
        tindakan: editExamTindakan || undefined,
      } as any);

      const res = await lansiaApi.getById(posyanduId, activeLansia.id);
      if (res.success) {
        const updated: Lansia = {
          ...res.data,
          tanggalLahir: formatTanggalInput(res.data.tanggalLahir),
          pemeriksaan: (res.data.pemeriksaans ?? []).map((p) => ({
            ...p,
            tanggalPeriksa: formatTanggalInput(p.tanggalPeriksa),
          })),
        };
        setLansias((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
      setIsEditExamModalOpen(false);
    } catch {
      setLansias((prev) =>
        prev.map((l) => {
          if (l.id !== activeLansia.id) return l;
          return {
            ...l,
            pemeriksaan: l.pemeriksaan.map((p) => {
              if (p.id !== editingExamId) return p;
              return {
                ...p,
                tanggalPeriksa: editExamDate,
                beratBadan: bb,
                tinggiBadan: tb,
                tekananDarahSistol: sistol,
                tekananDarahDiastol: diastol,
                gulaDarahSewaktu: gds,
                lingkarPerut: lp,
                kolesterol: kol,
                asamUrat: urat,
                keluhan: editExamKeluhan,
                tindakan: editExamTindakan,
              };
            }),
          };
        })
      );
      setIsEditExamModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Exam Submit
  const handleDeleteExamSubmit = async () => {
    if (!activeLansia || !deletingExamId) return;
    setIsSaving(true);
    try {
      await lansiaApi.deletePemeriksaan(posyanduId, activeLansia.id, deletingExamId);
      const res = await lansiaApi.getById(posyanduId, activeLansia.id);
      if (res.success) {
        const updated: Lansia = {
          ...res.data,
          tanggalLahir: formatTanggalInput(res.data.tanggalLahir),
          pemeriksaan: (res.data.pemeriksaans ?? []).map((p) => ({
            ...p,
            tanggalPeriksa: formatTanggalInput(p.tanggalPeriksa),
          })),
        };
        setLansias((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
      setIsDeleteExamModalOpen(false);
    } catch {
      setLansias((prev) =>
        prev.map((l) => {
          if (l.id !== activeLansia.id) return l;
          return {
            ...l,
            pemeriksaan: l.pemeriksaan.filter((p) => p.id !== deletingExamId),
          };
        })
      );
      setIsDeleteExamModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler Submit Tambah Lansia (via API)
  const handleAddLansiaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formNama.trim() || !formNik.trim() || !formRtRw.trim() || !formAlamat.trim()) {
      setFormError("Mohon isi nama lengkap, NIK, RT/RW, dan alamat.");
      return;
    }

    if (formNik.length !== 16) {
      setFormError("NIK harus tepat 16 digit angka.");
      return;
    }

    setIsSaving(true);
    try {
      await lansiaApi.create(posyanduId, {
        nama: formNama,
        nik: formNik,
        noHp: formNoHp || undefined,
        noBpjs: formBpjs || undefined,
        tanggalLahir: formTglLahir,
        jenisKelamin: formJk,
        rtRw: formRtRw,
        alamat: formAlamat,
        riwayatHt: formHt,
        riwayatDm: formDm,
        tingkatKemandirian: formKemandirian,
        gangguanMentalEmosional: formMental || undefined,
      });
      fetchLansias();
      setFormNama("");
      setFormNik("");
      setFormNoHp("");
      setFormBpjs("");
      setFormTglLahir("1960-01-01");
      setFormJk("L");
      setFormRtRw("");
      setFormAlamat("Desa Karanggayam");
      setFormHt(false);
      setFormDm(false);
      setFormKemandirian("A");
      setFormMental("");
      setView("list");
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  // Check input values warning
  const handleExamInputCheck = (sistolVal: string, gdsVal: string) => {
    setExamWarning("");
    const sistol = parseInt(sistolVal);
    const gds = parseInt(gdsVal);

    if (sistol > 200) {
      setExamWarning("Tekanan darah sistol di atas 200 mmHg sangat tinggi. Mohon cek kembali inputan atau rujuk lansia ke puskesmas.");
    } else if (gds > 300) {
      setExamWarning("Kadar Gula Darah (GDS) di atas 300 mg/dL sangat tinggi. Mohon cek kembali inputan Ibu.");
    }
  };

  // Handler Submit Tambah Pemeriksaan (via API)
  const handleAddExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamError("");

    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);
    const sistol = parseInt(examSistol);
    const diastol = parseInt(examDiastol);
    const gds = parseFloat(examGds);
    const lp = parseFloat(examLp);
    const kol = examCholesterol ? parseFloat(examCholesterol) : undefined;
    const urat = examUricAcid ? parseFloat(examUricAcid) : undefined;

    if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0 || isNaN(sistol) || isNaN(diastol) || isNaN(gds) || isNaN(lp)) {
      setExamError("Mohon isi semua data pemeriksaan dengan angka positif yang valid.");
      return;
    }

    if (!activeLansia) return;

    setIsSaving(true);
    try {
      await lansiaApi.createPemeriksaan(posyanduId, activeLansia.id, {
        tanggalPeriksa: examDate,
        beratBadan: bb,
        tinggiBadan: tb,
        tekananDarahSistol: sistol,
        tekananDarahDiastol: diastol,
        gulaDarahSewaktu: gds,
        lingkarPerut: lp,
        kolesterol: kol,
        asamUrat: urat,
        keluhan: examKeluhan || undefined,
        tindakan: examTindakan || undefined,
        petugas: user?.nama || "Kader Posyandu",
      } as any);
      // Refresh lansia detail
      const res = await lansiaApi.getById(posyanduId, activeLansia.id);
      if (res.success) {
        const updated: Lansia = {
          ...res.data,
          tanggalLahir: new Date(res.data.tanggalLahir).toISOString().split("T")[0],
          pemeriksaan: (res.data.pemeriksaans ?? []).map((p) => ({
            ...p,
            tanggalPeriksa: new Date(p.tanggalPeriksa).toISOString().split("T")[0],
          })),
        };
        setLansias((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
      clearExamDraft(posyanduId, activeLansia.id);
      setExamBB(""); setExamTB(""); setExamSistol(""); setExamDiastol("");
      setExamGds(""); setExamLp(""); setExamCholesterol(""); setExamUricAcid("");
      setExamKeluhan(""); setExamTindakan(""); setExamWarning("");
    } catch (err: unknown) {
      setExamError(err instanceof Error ? err.message : "Gagal menyimpan pemeriksaan.");
    } finally {
      setIsSaving(false);
    }
  };

  // Pre-fill form pemeriksaan jika lansia sudah memiliki data pemeriksaan atau draft tersimpan
  useEffect(() => {
    if (!activeLansia) {
      setExamBB(""); setExamTB(""); setExamSistol(""); setExamDiastol("");
      setExamGds(""); setExamLp(""); setExamCholesterol(""); setExamUricAcid("");
      setExamKeluhan(""); setExamTindakan(""); setExamWarning("");
      return;
    }

    const draft = getExamDraft(posyanduId, activeLansia.id);
    const hasDraftContent = Boolean(
      draft && (
        draft.examBB ||
        draft.examTB ||
        draft.examSistol ||
        draft.examDiastol ||
        draft.examGds ||
        draft.examLp ||
        draft.examCholesterol ||
        draft.examUricAcid ||
        draft.examKeluhan ||
        draft.examTindakan
      )
    );

    if (hasDraftContent && draft) {
      if (draft.examDate) setExamDate(draft.examDate);
      setExamBB(draft.examBB ?? "");
      setExamTB(draft.examTB ?? "");
      setExamSistol(draft.examSistol ?? "");
      setExamDiastol(draft.examDiastol ?? "");
      setExamGds(draft.examGds ?? "");
      setExamLp(draft.examLp ?? "");
      setExamCholesterol(draft.examCholesterol ?? "");
      setExamUricAcid(draft.examUricAcid ?? "");
      setExamKeluhan(draft.examKeluhan ?? "");
      setExamTindakan(draft.examTindakan ?? "");
      return;
    }

    const latest = activeLansia.pemeriksaan?.[0];
    if (latest) {
      if (latest.tanggalPeriksa) {
        setExamDate(formatTanggalInput(latest.tanggalPeriksa));
      }
      setExamBB(latest.beratBadan ? String(latest.beratBadan) : "");
      setExamTB(latest.tinggiBadan ? String(latest.tinggiBadan) : "");
      setExamSistol(latest.tekananDarahSistol ? String(latest.tekananDarahSistol) : "");
      setExamDiastol(latest.tekananDarahDiastol ? String(latest.tekananDarahDiastol) : "");
      setExamGds(latest.gulaDarahSewaktu ? String(latest.gulaDarahSewaktu) : "");
      setExamLp(latest.lingkarPerut ? String(latest.lingkarPerut) : "");
      setExamCholesterol(latest.kolesterol ? String(latest.kolesterol) : "");
      setExamUricAcid(latest.asamUrat ? String(latest.asamUrat) : "");
      setExamKeluhan(latest.keluhan || "");
      setExamTindakan(latest.tindakan || "");
    } else {
      setExamBB(""); setExamTB(""); setExamSistol(""); setExamDiastol("");
      setExamGds(""); setExamLp(""); setExamCholesterol(""); setExamUricAcid("");
      setExamKeluhan(""); setExamTindakan(""); setExamWarning("");
    }
  }, [activeLansia, posyanduId]);

  return (
    <div className="space-y-6">
      <PageHelmet
        title={activeLansia ? `Lansia: ${activeLansia.nama}` : "Manajemen Data Lansia"}
        description="Pengelolaan data lansia, riwayat penyakit Hipertensi/Diabetes, dan tingkat kemandirian."
      />
      {/* ========================================================================= */}
      {/* 1. VIEW: LIST LANSIA */}
      {/* ========================================================================= */}
      {view === "list" && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-saas-dark tracking-tight">Data Lansia</h2>
              <p className="text-sm text-saas-muted mt-0.5">Kelola data kesehatan berkala lansia posyandu.</p>
            </div>
            <button
              onClick={() => setView("add")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Lansia Baru
            </button>
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-6 rounded-card border border-gray-100/50 shadow-soft-card space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Cari nama, NIK, No. HP, atau BPJS..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50/70 border border-gray-100 rounded-input text-sm text-saas-dark placeholder-saas-muted/70 focus:outline-none focus:border-saas-primary/50 focus:bg-white transition-all"
                />
                <Search className="absolute left-3.5 top-2.5 text-saas-muted/80 w-4 h-4" />
              </div>

              {/* Disease Filter */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full shrink-0">
                <span className="text-xs font-bold text-saas-muted whitespace-nowrap shrink-0">Riwayat Penyakit:</span>
                {[
                  { label: "Semua", val: "semua" },
                  { label: "Hipertensi (HT)", val: "ht" },
                  { label: "Diabetes (DM)", val: "dm" },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => {
                      setDiseaseFilter(item.val as any);
                      setCurrentPage(1);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 ${
                      diseaseFilter === item.val
                        ? "bg-saas-primary/10 text-saas-primary border border-saas-primary/20"
                        : "bg-gray-50 text-saas-muted hover:text-saas-dark border border-transparent"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Age Filter */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
              <span className="text-xs font-bold text-saas-muted mr-1">Kelompok Umur:</span>
              {[
                { label: "Semua Umur", val: "semua" },
                { label: "45-59 Tahun (Pra-Lansia)", val: "45-59" },
                { label: "60-69 Tahun (Lansia)", val: "60-69" },
                { label: "≥70 Tahun (Lansia Risiko)", val: "70+" },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => {
                    setAgeFilter(item.val as any);
                    setCurrentPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
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
                      <th className="pb-3">Nama Lansia</th>
                      <th className="pb-3">No. HP / WA</th>
                      <th className="pb-3">Usia (Tahun)</th>
                      <th className="pb-3">RT/RW</th>
                      <th className="pb-3">Penyakit Bawaan</th>
                      <th className="pb-3">Kemandirian</th>
                      <th className="pb-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLansias.length > 0 ? (
                      filteredLansias.map((item) => {
                        const ageYears = calculateAgeInYears(item.tanggalLahir);
                        const cleanPhone = item.noHp ? item.noHp.replace(/\D/g, "") : "";
                        const waNumber = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                        return (
                          <tr key={item.id} className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/40 transition-colors text-sm">
                            <td className="py-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLansiaId(item.id);
                                  setView("detail");
                                }}
                                className="font-bold text-saas-dark hover:text-saas-primary hover:underline text-left transition-colors cursor-pointer"
                                title={`Lihat Profil ${item.nama}`}
                              >
                                {item.nama}
                              </button>
                              <p className="text-[11px] text-saas-muted font-medium mt-0.5">NIK: {item.nik}</p>
                            </td>
                            <td className="py-4">
                              {item.noHp ? (
                                <a
                                  href={`https://wa.me/${waNumber}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg text-xs transition-colors border border-emerald-200/60"
                                  title="Hubungi via WhatsApp"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  {item.noHp}
                                </a>
                              ) : (
                                <span className="text-xs text-saas-muted font-medium">-</span>
                              )}
                            </td>
                            <td className="py-4 font-bold text-saas-dark">{ageYears} Tahun</td>
                            <td className="py-4 text-saas-muted font-semibold">{item.rtRw}</td>
                            <td className="py-4">
                              <div className="flex gap-1.5">
                                {item.riwayatHt && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-trend-dangerText">HT</span>
                                )}
                                {item.riwayatDm && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">DM</span>
                                )}
                                {!item.riwayatHt && !item.riwayatDm && (
                                  <span className="text-xs text-saas-muted font-semibold">-</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  item.tingkatKemandirian === "A"
                                    ? "bg-trend-successBg text-trend-successText"
                                    : item.tingkatKemandirian === "B"
                                    ? "bg-yellow-50 text-yellow-600"
                                    : "bg-trend-dangerBg text-trend-dangerText"
                                }`}
                              >
                                Kategori {item.tingkatKemandirian}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => {
                                  setSelectedLansiaId(item.id);
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
                          Tidak ada data lansia yang cocok.
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
      {/* 2. VIEW: DETAIL LANSIA & RIWAYAT PEMERIKSAAN */}
      {/* ========================================================================= */}
      {view === "detail" && activeLansia && (
        <div className="space-y-8">
          {/* Back Button */}
          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                setView("list");
              }
            }}
            className="flex items-center gap-2 text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> {backLabel || "Kembali ke Daftar Lansia"}
          </button>

          {/* Profile & Form Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profil Lansia Card */}
            <div className="bg-white rounded-card shadow-soft-card border border-hairline p-6 flex flex-col justify-between h-fit space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <LansiaIcon className="w-6 h-6" gender={activeLansia.jenisKelamin} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(activeLansia)}
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
                <h3 className="text-xl font-bold text-saas-dark tracking-tight">{activeLansia.nama}</h3>
                <p className="text-xs text-saas-muted font-mono mt-1">NIK: {activeLansia.nik}</p>
                {activeLansia.noBpjs && (
                  <p className="text-xs text-saas-muted font-mono mt-0.5">BPJS: {activeLansia.noBpjs}</p>
                )}
                {activeLansia.noHp && (
                  <div className="mt-2">
                    <a
                      href={`https://wa.me/${activeLansia.noHp.replace(/\D/g, "").startsWith("0") ? "62" + activeLansia.noHp.replace(/\D/g, "").slice(1) : activeLansia.noHp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg text-xs transition-colors border border-emerald-200"
                    >
                      <Phone className="w-3.5 h-3.5" /> WA: {activeLansia.noHp}
                    </a>
                  </div>
                )}
              </div>

              {/* Detail Items */}
              <div className="space-y-4 border-t border-gray-50 pt-4 text-sm font-semibold">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Tanggal Lahir &amp; Usia</p>
                    <p className="text-saas-dark text-xs mt-0.5">
                      {formatTanggalIndonesia(activeLansia.tanggalLahir)} ({calculateAgeInYears(activeLansia.tanggalLahir)} Tahun)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">No. HP / WhatsApp</p>
                    {activeLansia.noHp ? (
                      <a
                        href={`https://wa.me/${activeLansia.noHp.replace(/\D/g, "").startsWith("0") ? "62" + activeLansia.noHp.replace(/\D/g, "").slice(1) : activeLansia.noHp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 hover:text-emerald-800 text-xs mt-0.5 font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {activeLansia.noHp} (Hubungi WA)
                      </a>
                    ) : (
                      <p className="text-saas-dark text-xs mt-0.5 text-saas-muted font-medium">Belum ada nomor HP</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ClipboardList className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Status Kemandirian</p>
                    <p className="text-saas-dark text-xs mt-0.5">
                      Kategori {activeLansia.tingkatKemandirian} — {
                        activeLansia.tingkatKemandirian === "A" ? "Mandiri Sepenuhnya" :
                        activeLansia.tingkatKemandirian === "B" ? "Bantuan Sebagian" : "Ketergantungan Total"
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Riwayat Penyakit</p>
                    <p className="text-saas-dark text-xs mt-0.5">
                      HT: {activeLansia.riwayatHt ? "Ada (Hipertensi)" : "Tidak ada"} | DM: {activeLansia.riwayatDm ? "Ada (Diabetes)" : "Tidak ada"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <BrainCircuit className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Skrining Mental Emosional</p>
                    <p className="text-saas-dark text-xs mt-0.5 leading-snug font-medium italic">
                      "{activeLansia.gangguanMentalEmosional || "Tidak ada catatan khusus"}"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-saas-muted">Alamat Rumah</p>
                    <p className="text-saas-dark text-xs mt-0.5 leading-snug">
                      {activeLansia.rtRw}, {activeLansia.alamat}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Pemeriksaan Baru */}
            <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 lg:col-span-2 space-y-6">
              <div>
                <h3 className="font-bold text-base text-saas-dark">Input Pemeriksaan Bulanan Lansia</h3>
                <p className="text-xs text-saas-muted mt-0.5">Masukkan data pengukuran fisik dan skrining gula darah.</p>
              </div>

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

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Tanggal */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Tanggal Periksa</label>
                    <input
                      type="date"
                      value={examDate}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                    />
                  </div>

                  {/* Berat Badan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Berat Badan (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Contoh: 60"
                      value={examBB}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamBB(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* Tinggi Badan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Tinggi Badan (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Contoh: 160"
                      value={examTB}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamTB(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* IMT - Calculated Live */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-teal-600">IMT (Otomatis)</label>
                    <input
                      type="text"
                      disabled
                      value={
                        parseFloat(examBB) > 0 && parseFloat(examTB) > 0
                          ? hitungIMT(parseFloat(examBB), parseFloat(examTB))
                          : "-"
                      }
                      className="w-full p-2.5 bg-teal-50/50 border border-teal-150 rounded-input text-xs font-bold text-teal-700 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-t border-gray-50 pt-4">
                  {/* TD Sistol */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Sistol (mmHg)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="TD atas, cth: 130"
                      value={examSistol}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/-/g, "");
                        setExamSistol(val);
                        handleExamInputCheck(val, examGds);
                      }}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* TD Diastol */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Diastol (mmHg)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="TD bawah, cth: 85"
                      value={examDiastol}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamDiastol(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* Gula Darah Sewaktu */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">GDS (mg/dL)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Contoh: 120"
                      value={examGds}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => {
                        const val = e.target.value.replace(/-/g, "");
                        setExamGds(val);
                        handleExamInputCheck(examSistol, val);
                      }}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* Lingkar Perut */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Lingkar Perut (cm)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Contoh: 90"
                      value={examLp}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamLp(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                  {/* Kolesterol */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Kolesterol (mg/dL - opsional)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="cth: 180"
                      value={examCholesterol}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamCholesterol(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  {/* Asam Urat */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Asam Urat (mg/dL - opsional)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="cth: 6.2"
                      value={examUricAcid}
                      onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                      onChange={(e) => setExamUricAcid(e.target.value.replace(/-/g, ""))}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                  {/* Keluhan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Keluhan / Riwayat Penyakit Saat Ini</label>
                    <textarea
                      placeholder="Tulis keluhan atau sakit yang dirasakan lansia saat ini..."
                      rows={2}
                      value={examKeluhan}
                      onChange={(e) => setExamKeluhan(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 resize-none"
                    />
                  </div>

                  {/* Tindakan */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted">Tindakan / Rujukan / Pemberian Obat</label>
                    <textarea
                      placeholder="Tulis tindakan medis, rujukan puskesmas, atau obat/kapsul yang diberikan..."
                      rows={2}
                      value={examTindakan}
                      onChange={(e) => setExamTindakan(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Simpan Hasil Periksa
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* GRAFIK MONITORING KESEHATAN LANSIA (LINE CHART) */}
          <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-saas-dark flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Grafik Monitoring Kesehatan Lansia (Tensi &amp; Gula Darah)
                </h3>
                <p className="text-xs text-saas-muted mt-0.5">
                  Grafik tren tekanan darah (Sistol/Diastol mmHg), gula darah sewaktu (mg/dL), dan berat badan (kg).
                </p>
              </div>
              <span className="text-xs font-bold text-saas-muted bg-gray-50 px-2.5 py-1 rounded-full border border-gray-150">
                {activeLansia.pemeriksaan.length} Data Periksa
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              {activeLansia.pemeriksaan.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...activeLansia.pemeriksaan]
                      .sort((a, b) => new Date(a.tanggalPeriksa).getTime() - new Date(b.tanggalPeriksa).getTime())
                      .map(p => ({
                        tanggal: formatTanggalIndonesia(p.tanggalPeriksa),
                        "TD Sistol (mmHg)": p.tekananDarahSistol || null,
                        "TD Diastol (mmHg)": p.tekananDarahDiastol || null,
                        "Gula Darah (mg/dL)": p.gulaDarahSewaktu || null,
                        "Berat Badan (kg)": p.beratBadan,
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
                      dataKey="TD Sistol (mmHg)"
                      stroke="#EF4444"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="TD Diastol (mmHg)"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Gula Darah (mg/dL)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Berat Badan (kg)"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-saas-muted font-medium bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  Belum ada riwayat pemeriksaan lansia untuk menampilkan grafik.
                </div>
              )}
            </div>
          </div>

          {/* Tabel Riwayat Pemeriksaan Lansia */}
          <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-base text-saas-dark">Riwayat Pemeriksaan Bulanan</h3>
                <p className="text-xs text-saas-muted mt-0.5">Daftar rekaman kesehatan lansia dari bulan ke bulan.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                    <th className="pb-3">Tanggal Periksa</th>
                    <th className="pb-3">Berat (kg)</th>
                    <th className="pb-3">Tinggi (cm)</th>
                    <th className="pb-3">IMT</th>
                    <th className="pb-3">Tekanan Darah</th>
                    <th className="pb-3">GDS</th>
                    <th className="pb-3">Kolesterol</th>
                    <th className="pb-3">Asam Urat</th>
                    <th className="pb-3">Lingkar Perut</th>
                    <th className="pb-3">Keluhan</th>
                    <th className="pb-3">Tindakan</th>
                    <th className="pb-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLansia.pemeriksaan.length > 0 ? (
                    activeLansia.pemeriksaan.map((exam) => (
                      <tr key={exam.id} className="border-b border-gray-50 last:border-b-0 text-xs text-saas-dark">
                        <td className="py-4 font-bold">{formatTanggalIndonesia(exam.tanggalPeriksa)}</td>
                        <td className="py-4 font-bold">{exam.beratBadan} kg</td>
                        <td className="py-4 font-bold">{exam.tinggiBadan} cm</td>
                        <td className="py-4 font-bold text-teal-600">
                          {hitungIMT(Number(exam.beratBadan), Number(exam.tinggiBadan))}
                        </td>
                        <td className="py-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              exam.tekananDarahSistol >= 140
                                ? "bg-trend-dangerBg text-trend-dangerText"
                                : "bg-trend-successBg text-trend-successText"
                            }`}
                          >
                            {exam.tekananDarahSistol}/{exam.tekananDarahDiastol} mmHg
                          </span>
                        </td>
                        <td className="py-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] ${
                              Number(exam.gulaDarahSewaktu) >= 200
                                ? "bg-trend-dangerBg text-trend-dangerText"
                                : "bg-trend-successBg text-trend-successText"
                            }`}
                          >
                            {exam.gulaDarahSewaktu} mg/dL
                          </span>
                        </td>
                        <td className="py-4 font-semibold text-saas-dark">
                          {exam.kolesterol ? `${exam.kolesterol} mg/dL` : "-"}
                        </td>
                        <td className="py-4 font-semibold text-saas-dark">
                          {exam.asamUrat ? `${exam.asamUrat} mg/dL` : "-"}
                        </td>
                        <td className="py-4 font-semibold text-saas-muted">{exam.lingkarPerut} cm</td>
                        <td className="py-4 max-w-xs font-semibold text-saas-muted leading-tight truncate">
                          {exam.keluhan || "-"}
                        </td>
                        <td className="py-4 max-w-xs font-semibold text-saas-muted leading-tight truncate">
                          {exam.tindakan || "-"}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openEditExamModal(exam)}
                              className="px-2 py-1 text-xs font-bold text-saas-primary hover:bg-teal-50 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openDeleteExamModal(exam.id)}
                              className="px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-xs text-saas-muted font-medium">
                        Belum ada riwayat pemeriksaan lansia. Silakan input form di atas.
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
      {/* 3. VIEW: ADD LANSIA */}
      {/* ========================================================================= */}
      {view === "add" && (
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 sm:p-8 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-saas-dark tracking-tight">Formulir Pendaftaran Lansia Baru</h2>
              <p className="text-xs text-saas-muted mt-0.5">Isi data profil dan kondisi kesehatan lansia secara lengkap.</p>
            </div>
            <button
              onClick={() => setView("list")}
              className="text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors"
            >
              Batal &amp; Kembali
            </button>
          </div>

          <form onSubmit={handleAddLansiaSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold">
                {formError}
              </div>
            )}

            {/* Nama Lengkap */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nama Lengkap Lansia *</label>
              <input
                type="text"
                placeholder="Contoh: Mbah Joyo"
                value={formNama}
                onChange={(e) => setFormNama(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            {/* NIK, No. HP, No BPJS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">NIK (16 digit angka) *</label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="330102xxxxxxxxxx"
                  value={formNik}
                  onChange={(e) => setFormNik(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">No. WhatsApp / HP (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={formNoHp}
                  onChange={(e) => setFormNoHp(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">No. BPJS (Opsional)</label>
                <input
                  type="text"
                  placeholder="000123456789"
                  value={formBpjs}
                  onChange={(e) => setFormBpjs(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>
            </div>

            {/* Tgl Lahir, JK & Kemandirian */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Tanggal Lahir *</label>
                <input
                  type="date"
                  value={formTglLahir}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setFormTglLahir(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Jenis Kelamin *</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer">
                    <input
                      type="radio"
                      name="formJkLansia"
                      checked={formJk === "L"}
                      onChange={() => setFormJk("L")}
                    />
                    Laki-laki
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer">
                    <input
                      type="radio"
                      name="formJkLansia"
                      checked={formJk === "P"}
                      onChange={() => setFormJk("P")}
                    />
                    Perempuan
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">RT / RW *</label>
                <input
                  type="text"
                  placeholder="RT 02 / RW 02"
                  value={formRtRw}
                  onChange={(e) => setFormRtRw(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>
            </div>

            {/* Status Kemandirian */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Tingkat Kemandirian (Kategori ADL)</label>
              <select
                value={formKemandirian}
                onChange={(e) => setFormKemandirian(e.target.value as any)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              >
                <option value="A">Kategori A (Mandiri Sepenuhnya)</option>
                <option value="B">Kategori B (Bantuan Sebagian)</option>
                <option value="C">Kategori C (Ketergantungan Total)</option>
              </select>
            </div>

            {/* Riwayat Penyakit */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Riwayat Diagnosa Penyakit (HT / DM)</label>
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formHt}
                    onChange={(e) => setFormHt(e.target.checked)}
                    className="w-4.5 h-4.5 text-saas-primary border-gray-250 rounded focus:ring-saas-primary/30"
                  />
                  <span className="text-xs font-bold text-saas-dark">Hipertensi (Tekanan Darah Tinggi)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formDm}
                    onChange={(e) => setFormDm(e.target.checked)}
                    className="w-4.5 h-4.5 text-saas-primary border-gray-250 rounded focus:ring-saas-primary/30"
                  />
                  <span className="text-xs font-bold text-saas-dark">Diabetes Melitus (Gula Darah)</span>
                </label>
              </div>
            </div>

            {/* Catatan Mental Emosional */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Catatan Skrining Mental Emosional (Opsional)</label>
              <input
                type="text"
                placeholder="Misal: Cenderung pikun, sering cemas, dll."
                value={formMental}
                onChange={(e) => setFormMental(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            {/* Alamat */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Alamat Wilayah / Dusun</label>
              <input
                type="text"
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
                <Plus className="w-3.5 h-3.5" /> Daftarkan Lansia
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIT LANSIA */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profil Lansia"
      >
        <form onSubmit={handleEditLansiaSubmit} className="space-y-4">
          {editError && (
            <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold">
              {editError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">Nama Lengkap Lansia</label>
            <input
              type="text"
              required
              value={editNama}
              onChange={(e) => setEditNama(e.target.value)}
              className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">NIK (16 digit)</label>
              <input
                type="text"
                required
                maxLength={16}
                value={editNik}
                onChange={(e) => setEditNik(e.target.value)}
                className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">No. HP / WA (Opsional)</label>
              <input
                type="text"
                value={editNoHp}
                onChange={(e) => setEditNoHp(e.target.value)}
                placeholder="081234567890"
                className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">No. BPJS (Opsional)</label>
              <input
                type="text"
                value={editBpjs}
                onChange={(e) => setEditBpjs(e.target.value)}
                className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
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
                    name="editJkLansia"
                    checked={editJk === "L"}
                    onChange={() => setEditJk("L")}
                  />
                  Laki-laki
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-saas-dark cursor-pointer">
                  <input
                    type="radio"
                    name="editJkLansia"
                    checked={editJk === "P"}
                    onChange={() => setEditJk("P")}
                  />
                  Perempuan
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">RT / RW</label>
              <input
                type="text"
                required
                value={editRtRw}
                onChange={(e) => setEditRtRw(e.target.value)}
                className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-saas-dark">Tingkat Kemandirian</label>
              <select
                value={editKemandirian}
                onChange={(e) => setEditKemandirian(e.target.value as any)}
                className="w-full p-2.5 border border-hairline rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              >
                <option value="A">Kategori A (Mandiri)</option>
                <option value="B">Kategori B (Bantuan Sebagian)</option>
                <option value="C">Kategori C (Ketergantungan Total)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">Riwayat Penyakit</label>
            <div className="flex gap-6 pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-saas-dark cursor-pointer">
                <input
                  type="checkbox"
                  checked={editHt}
                  onChange={(e) => setEditHt(e.target.checked)}
                />
                Hipertensi (HT)
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-saas-dark cursor-pointer">
                <input
                  type="checkbox"
                  checked={editDm}
                  onChange={(e) => setEditDm(e.target.checked)}
                />
                Diabetes Mellitus (DM)
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-saas-dark">Alamat / Dusun</label>
            <input
              type="text"
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

      {/* MODAL KONFIRMASI HAPUS LANSIA */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Hapus Profil Lansia"
      >
        <div className="space-y-4">
          <p className="text-sm text-saas-dark font-medium">
            Apakah Anda yakin ingin menghapus data profil lansia <span className="font-bold text-trend-dangerText">{activeLansia?.nama}</span>?
          </p>
          <p className="text-xs text-saas-muted">
            Seluruh riwayat pemeriksaan medis lansia ini juga akan dihapus secara permanen dari sistem.
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
              onClick={handleDeleteLansia}
              disabled={isSaving}
              className="px-4 py-2 bg-trend-dangerText text-white rounded-pill text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {isSaving ? "Menghapus..." : "Ya, Hapus Permanen"}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL EDIT PEMERIKSAAN LANSIA */}
      <Modal
        isOpen={isEditExamModalOpen}
        onClose={() => setIsEditExamModalOpen(false)}
        title="Edit Riwayat Pemeriksaan Lansia"
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
                onChange={(e) => setEditExamBB(e.target.value)}
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
                onChange={(e) => setEditExamTB(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-saas-muted">Tekanan Darah (Sistol)</label>
              <input
                type="number"
                required
                placeholder="mmHg"
                value={editExamSistol}
                onChange={(e) => setEditExamSistol(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Tekanan Darah (Diastol)</label>
              <input
                type="number"
                required
                placeholder="mmHg"
                value={editExamDiastol}
                onChange={(e) => setEditExamDiastol(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">GDS (mg/dL)</label>
              <input
                type="number"
                step="0.1"
                required
                value={editExamGds}
                onChange={(e) => setEditExamGds(e.target.value)}
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
                value={editExamLp}
                onChange={(e) => setEditExamLp(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Kolesterol Total (opsional)</label>
              <input
                type="number"
                step="0.1"
                placeholder="mg/dL"
                value={editExamCholesterol}
                onChange={(e) => setEditExamCholesterol(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Asam Urat (opsional)</label>
              <input
                type="number"
                step="0.1"
                placeholder="mg/dL"
                value={editExamUricAcid}
                onChange={(e) => setEditExamUricAcid(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-saas-muted">Keluhan Utama</label>
              <textarea
                rows={2}
                placeholder="Contoh: Pusing, keluhan sendi..."
                value={editExamKeluhan}
                onChange={(e) => setEditExamKeluhan(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-saas-muted">Tindakan / Intervensi</label>
              <textarea
                rows={2}
                placeholder="Contoh: Edukasi pola makan, rujukan..."
                value={editExamTindakan}
                onChange={(e) => setEditExamTindakan(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary"
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

      {/* MODAL KONFIRMASI HAPUS PEMERIKSAAN LANSIA */}
      <Modal
        isOpen={isDeleteExamModalOpen}
        onClose={() => setIsDeleteExamModalOpen(false)}
        title="Hapus Data Pemeriksaan"
      >
        <div className="space-y-4">
          <p className="text-sm text-saas-dark font-medium">
            Apakah Anda yakin ingin menghapus catatan pemeriksaan kesehatan lansia ini?
          </p>
          <p className="text-xs text-saas-muted">
            Tindakan ini tidak dapat dibatalkan dan catatan pemeriksaan akan terhapus dari riwayat lansia.
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
