"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { formatTanggalIndonesia } from "../../lib/dateUtils";
import {
  AlertCircle,
  Loader2,
  Edit2,
  Plus,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import {
  hitungStatusBbU,
  hitungStatusTbU,
  hitungStatusBbTb,
  convertStatusBbUToCode,
  convertStatusTbUToCode,
  convertStatusBbTbToCode,
} from "../../lib/zScoreCalculator";
import { balitaApi, lansiaApi, Balita, Lansia, PeriodePelayanan } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { SearchIndex } from "../../lib/searchIndex";
import { clientDataCache } from "../../lib/dataCache";
import Modal from "../../components/Modal";
import PageHelmet from "../../components/PageHelmet";
import toast from "react-hot-toast";
import {
  getExamDraft,
  saveExamDraft,
  clearExamDraft,
  getActivePatientId,
  setActivePatientId,
} from "../../lib/draftStorage";
import { PelayananSkeleton } from "../../components/Skeleton";
import LansiaIcon from "../../components/LansiaIcon";
import BalitaIcon from "../../components/BalitaIcon";

// Extracted Subcomponents & Types
import {
  Pasien,
  SessionLog,
  calculateAgeInMonths,
  calculateAgeInYears,
} from "./types";
import PeriodeBanner from "./components/PeriodeBanner";
import PelayananQueue from "./components/PelayananQueue";
import BalitaExamFields from "./components/BalitaExamFields";
import LansiaExamFields from "./components/LansiaExamFields";
import SessionLogsTable from "./components/SessionLogsTable";
import AddBalitaModal from "./components/AddBalitaModal";
import AddLansiaModal from "./components/AddLansiaModal";

interface PelayananModuleProps {
  posyanduId: string;
  activePeriode?: PeriodePelayanan | null;
  onOpenPeriodeModal?: () => void;
  onNavigate?: (menu: string, patientId?: string) => void;
}

export default function PelayananModule({
  posyanduId,
  activePeriode,
  onOpenPeriodeModal,
  onNavigate,
}: PelayananModuleProps) {
  const { user } = useAuth();
  const cacheKey = `pelayanan_pasiens_${posyanduId}`;
  const [pasiens, setPasiens] = useState<Pasien[]>(() => {
    if (typeof window !== "undefined" && posyanduId) {
      const cached = clientDataCache.get<Pasien[]>(cacheKey);
      if (cached && cached.length > 0) return cached;
    }
    return [];
  });
  const [query, setQuery] = useState("");
  const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);
  const [activeTab, setActiveTab] = useState<"Balita" | "Lansia">("Balita");
  const formRef = useRef<HTMLDivElement>(null);

  // In-Memory Search Index
  const pelayananIndexRef = useRef<SearchIndex<Pasien>>(
    new SearchIndex<Pasien>((p) => [
      p.nama,
      p.detail1,
      p.detail2,
      p.subInfo,
      p.tipe,
    ])
  );

  useEffect(() => {
    pelayananIndexRef.current.setSource(pasiens);
  }, [pasiens]);

  // Session Log state for deleting
  const [deletingLog, setDeletingLog] = useState<SessionLog | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  const confirmDeleteSessionLog = async () => {
    if (!deletingLog || !deletingLog.pasienId) return;
    try {
      setIsDeletingLog(true);
      if (deletingLog.tipe === "Balita") {
        await balitaApi.deletePemeriksaan(posyanduId, deletingLog.pasienId, deletingLog.id);
      } else {
        await lansiaApi.deletePemeriksaan(posyanduId, deletingLog.pasienId, deletingLog.id);
      }

      setSessionLogs((prev) => prev.filter((l) => l.id !== deletingLog.id));

      if (selectedPasien?.id === deletingLog.pasienId) {
        setSelectedPasien((prev) =>
          prev
            ? {
                ...prev,
                isCheckedInCurrentPeriod: false,
                currentPeriodExam: undefined,
              }
            : null
        );
      }

      clientDataCache.invalidate("pelayanan_pasiens_" + posyanduId);
      fetchPatients(true);
      toast.success(`Record pemeriksaan ${deletingLog.nama} berhasil dihapus.`);
      setDeletingLog(null);
    } catch (err: any) {
      console.error("Gagal menghapus record pemeriksaan:", err);
      const errMsg = err?.message || "Gagal menghapus record pemeriksaan.";
      toast.error(errMsg);
    } finally {
      setIsDeletingLog(false);
    }
  };

  // Modals Visibility
  const [showAddBalitaModal, setShowAddBalitaModal] = useState(false);
  const [showAddLansiaModal, setShowAddLansiaModal] = useState(false);

  // Session Log State
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionLimit, setSessionLimit] = useState(5);

  useEffect(() => {
    setSessionPage(1);
  }, [activeTab, activePeriode]);

  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== "undefined" && posyanduId) {
      const cached = clientDataCache.get<Pasien[]>(cacheKey);
      if (cached && cached.length > 0) return false;
    }
    return true;
  });

  const fetchPatients = (silent = false) => {
    const cached = clientDataCache.get<Pasien[]>(cacheKey);
    if (cached && cached.length > 0) {
      setIsLoading(false);
    } else if (!silent && pasiens.length === 0) {
      setIsLoading(true);
    }
    const targetMonth = activePeriode ? activePeriode.bulan : new Date().getMonth() + 1;
    const targetYear = activePeriode ? activePeriode.tahun : new Date().getFullYear();

    Promise.all([
      balitaApi.getAll(posyanduId, { limit: 1000 }),
      lansiaApi.getAll(posyanduId, { limit: 1000 }),
    ])
      .then(([balitaRes, lansiaRes]) => {
        const gatheredCustoms = new Set<string>();
        (balitaRes.data || []).forEach((b: Balita) => {
          (b.pemeriksaans || []).forEach((exam) => {
            if (exam.statusImunisasi) {
              const matches = [...exam.statusImunisasi.matchAll(/Pemberian:\s*([^|]+)/gi)];
              for (const m of matches) {
                m[1].split(",").forEach((s: string) => {
                  const t = s.trim();
                  if (t) gatheredCustoms.add(t);
                });
              }
            }
          });
        });

        if (gatheredCustoms.size > 0) {
          setMasterPemberianOptions((prev) => {
            const lowerSet = new Set(prev.map((p) => p.toLowerCase()));
            const toAdd = Array.from(gatheredCustoms).filter((item) => !lowerSet.has(item.toLowerCase()));
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

        const balitas: Pasien[] = (balitaRes.data || []).map((b: Balita) => {
          const currentExam = (b.pemeriksaans || []).find((exam) => {
            const d = new Date(exam.tanggalPeriksa);
            return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
          });

          return {
            id: b.id,
            nama: b.nama,
            tipe: "Balita",
            subInfo: `Usia ${b.usiaBulan || calculateAgeInMonths(b.tanggalLahir, "2026-07-28")} Bulan`,
            detail1: b.namaIbu,
            detail2: b.alamat,
            tanggalLahir: b.tanggalLahir,
            jenisKelamin: b.jenisKelamin,
            isCheckedInCurrentPeriod: Boolean(currentExam),
            currentPeriodExam: currentExam,
          };
        });

        const lansias: Pasien[] = (lansiaRes.data || []).map((l: Lansia) => {
          const currentExam = (l.pemeriksaans || []).find((exam) => {
            const d = new Date(exam.tanggalPeriksa);
            return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
          });

          return {
            id: l.id,
            nama: l.nama,
            tipe: "Lansia",
            subInfo: `Usia ${l.usiaTahun || calculateAgeInYears(l.tanggalLahir, "2026-07-28")} Tahun`,
            detail1: `BPJS: ${l.noBpjs || "Tidak Ada"}`,
            detail2: l.alamat,
            tanggalLahir: l.tanggalLahir,
            jenisKelamin: l.jenisKelamin,
            isCheckedInCurrentPeriod: Boolean(currentExam),
            currentPeriodExam: currentExam,
          };
        });

        const allPasiens = [...balitas, ...lansias];
        setPasiens(allPasiens);
        clientDataCache.set(cacheKey, allPasiens);

        setSelectedPasien((prev) => {
          const activeId = prev?.id || getActivePatientId(posyanduId);
          if (activeId) {
            return allPasiens.find((p) => p.id === activeId) || prev || null;
          }
          return null;
        });

        const periodLogs: SessionLog[] = [];
        allPasiens.forEach((p) => {
          if (p.isCheckedInCurrentPeriod && p.currentPeriodExam) {
            const exam = p.currentPeriodExam;
            const isWarning =
              p.tipe === "Balita"
                ? exam.statusBbU === "SK" ||
                  exam.statusBbU === "K" ||
                  exam.statusTbU === "SP" ||
                  exam.statusTbU === "P" ||
                  exam.statusBbTb === "SK" ||
                  exam.statusBbTb === "K" ||
                  exam.statusBbTb === "G"
                : exam.tekananDarahSistol >= 140 ||
                  exam.tekananDarahDiastol >= 90 ||
                  Number(exam.gulaDarahSewaktu) >= 200;

            let statusDesc =
              p.tipe === "Balita" ? `Normal (BB/U: ${exam.statusBbU || "Normal"})` : "Sehat & Normal";
            if (p.tipe === "Balita") {
              if (exam.statusBbU === "K") statusDesc = "BB Kurang";
              else if (exam.statusBbU === "SK") statusDesc = "BB Sangat Kurang";
              else if (exam.statusTbU === "P") statusDesc = "Stunting (Pendek)";
              else if (exam.statusTbU === "SP") statusDesc = "Sangat Pendek";
              else if (exam.statusBbTb === "G") statusDesc = "Gizi Lebih / Obesitas";
            } else {
              const isHipertensi = exam.tekananDarahSistol >= 140 || exam.tekananDarahDiastol >= 90;
              const isGdsTinggi = Number(exam.gulaDarahSewaktu) >= 200;
              if (isHipertensi && isGdsTinggi) statusDesc = "Hipertensi & GDS Tinggi";
              else if (isHipertensi) statusDesc = "Hipertensi";
              else if (isGdsTinggi) statusDesc = "GDS Tinggi";
            }

            const paramStr =
              p.tipe === "Balita"
                ? `BB: ${exam.beratBadan}kg, TB: ${exam.tinggiBadan}cm${
                    exam.lingkarKepala ? `, LK: ${exam.lingkarKepala}cm` : ""
                  }`
                : `BB: ${exam.beratBadan}kg, TB: ${exam.tinggiBadan}cm, TD: ${exam.tekananDarahSistol}/${
                    exam.tekananDarahDiastol
                  } mmHg, GDS: ${exam.gulaDarahSewaktu || "-"}`;

            periodLogs.push({
              id: exam.id,
              pasienId: p.id,
              nama: p.nama,
              tipe: p.tipe as "Balita" | "Lansia",
              waktu: formatTanggalIndonesia(exam.tanggalPeriksa),
              petugas: exam.petugas || "Kader Posyandu",
              summary: paramStr,
              parameter: paramStr,
              status: statusDesc,
              statusType: isWarning ? "warning" : "success",
            });
          }
        });

        setSessionLogs(periodLogs);
      })
      .catch(console.error)
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchPatients();
  }, [posyanduId, activePeriode]);

  // Form Fields - Common
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

  // Form Fields - Balita
  const [examLK, setExamLK] = useState("");
  const [examBBU, setExamBBU] = useState("Normal");
  const [examTBU, setExamTBU] = useState("Normal");
  const [examBBTB, setExamBBTB] = useState("Normal");
  const [examVitA, setExamVitA] = useState(false);
  const [examVitB1, setExamVitB1] = useState(false);
  const [examVitB6, setExamVitB6] = useState(false);
  const [examLiLA, setExamLiLA] = useState("");
  const [examKms, setExamKms] = useState("N");
  const [examAsi, setExamAsi] = useState<boolean>(true);
  const [examCacing, setExamCacing] = useState(false);
  const [examImunisasi, setExamImunisasi] = useState("");

  // Custom Pemberian Options
  const [masterPemberianOptions, setMasterPemberianOptions] = useState<string[]>([]);
  const [checkedPemberianMap, setCheckedPemberianMap] = useState<Record<string, boolean>>({});
  const [newPemberianInput, setNewPemberianInput] = useState("");
  const [showAddPemberianInput, setShowAddPemberianInput] = useState(false);

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
    const existing = masterPemberianOptions.find((opt) => opt.toLowerCase() === trimmed.toLowerCase());
    const finalKey = existing || trimmed;
    if (!existing) {
      const updated = [...masterPemberianOptions, trimmed];
      updateMasterPemberianOptions(updated);
    }
    setCheckedPemberianMap((prev) => ({ ...prev, [finalKey]: true }));
    setNewPemberianInput("");
    setShowAddPemberianInput(false);
  };

  const handleDeleteMasterPemberian = (optToDelete: string) => {
    const updated = masterPemberianOptions.filter((opt) => opt !== optToDelete);
    updateMasterPemberianOptions(updated);
    setCheckedPemberianMap((prev) => {
      const next = { ...prev };
      delete next[optToDelete];
      return next;
    });
  };

  // Form Fields - Lansia
  const [examSistol, setExamSistol] = useState("");
  const [examDiastol, setExamDiastol] = useState("");
  const [examGds, setExamGds] = useState("");
  const [examLp, setExamLp] = useState("");
  const [examCholesterol, setExamCholesterol] = useState("");
  const [examUricAcid, setExamUricAcid] = useState("");
  const [examKeluhan, setExamKeluhan] = useState("");
  const [examTindakan, setExamTindakan] = useState("");

  const loadedPatientIdRef = useRef<string | null>(null);

  // Auto-save form draft for active patient
  useEffect(() => {
    if (!selectedPasien?.id) return;
    if (loadedPatientIdRef.current !== selectedPasien.id) return;

    saveExamDraft(posyanduId, selectedPasien.id, {
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
    selectedPasien?.id,
    posyanduId,
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
    examSistol,
    examDiastol,
    examGds,
    examLp,
    examCholesterol,
    examUricAcid,
    examKeluhan,
    examTindakan,
  ]);

  // Pre-fill form
  useEffect(() => {
    if (!selectedPasien) {
      loadedPatientIdRef.current = null;
      setExamBB("");
      setExamTB("");
      setExamLK("");
      setExamLiLA("");
      setExamVitA(false);
      setExamVitB1(false);
      setExamVitB6(false);
      setExamAsi(true);
      setExamCacing(false);
      setExamImunisasi("");
      setCheckedPemberianMap({});
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
      clearExamDraft(posyanduId, selectedPasien.id);
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
        setExamVitB1(Boolean(exam.vitB1));
        setExamVitB6(Boolean(exam.vitB6));
        setExamAsi(Boolean(exam.asiEksklusif));
        setExamCacing(Boolean(exam.obatCacing));
        const rawImun = exam.statusImunisasi || "";
        const matches = [...rawImun.matchAll(/Pemberian:\s*([^|]+)/gi)];
        const newChecked: Record<string, boolean> = {};
        const itemsFound: string[] = [];
        for (const m of matches) {
          m[1].split(",").forEach((s: string) => {
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
            const lowerSet = new Set(prev.map((p) => p.toLowerCase()));
            const toAdd = itemsFound.filter((item) => !lowerSet.has(item.toLowerCase()));
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
      loadedPatientIdRef.current = selectedPasien.id;
      return;
    }

    const draft = getExamDraft(posyanduId, selectedPasien.id);
    const hasDraftContent = Boolean(
      draft &&
        (draft.examBB ||
          draft.examTB ||
          draft.examLK ||
          draft.examLiLA ||
          draft.examSistol ||
          draft.examDiastol ||
          draft.examGds ||
          draft.examLp ||
          draft.examCholesterol ||
          draft.examUricAcid ||
          draft.examKeluhan ||
          draft.examTindakan ||
          draft.examImunisasi ||
          (draft.checkedPemberianMap && Object.values(draft.checkedPemberianMap).some(Boolean)))
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
      setExamSistol(draft.examSistol ?? "");
      setExamDiastol(draft.examDiastol ?? "");
      setExamGds(draft.examGds ?? "");
      setExamLp(draft.examLp ?? "");
      setExamCholesterol(draft.examCholesterol ?? "");
      setExamUricAcid(draft.examUricAcid ?? "");
      setExamKeluhan(draft.examKeluhan ?? "");
      setExamTindakan(draft.examTindakan ?? "");
      loadedPatientIdRef.current = selectedPasien.id;
      return;
    }

    const defaultDate = activePeriode?.tanggal
      ? new Date(activePeriode.tanggal).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setExamDate(defaultDate);
    setExamBB("");
    setExamTB("");
    setExamLK("");
    setExamLiLA("");
    setExamVitA(false);
    setExamVitB1(false);
    setExamVitB6(false);
    setExamAsi(true);
    setExamCacing(false);
    setExamImunisasi("");
    setCheckedPemberianMap({});
    setExamSistol("");
    setExamDiastol("");
    setExamGds("");
    setExamLp("");
    setExamCholesterol("");
    setExamUricAcid("");
    setExamKeluhan("");
    setExamTindakan("");
    setFormWarning("");
    loadedPatientIdRef.current = selectedPasien.id;
  }, [selectedPasien, posyanduId, activePeriode]);

  // Otomatisasi Status Gizi Balita (Z-Score)
  useEffect(() => {
    if (!selectedPasien || selectedPasien.tipe !== "Balita" || !selectedPasien.tanggalLahir) return;
    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);
    const usia = calculateAgeInMonths(selectedPasien.tanggalLahir, examDate);
    const jk = selectedPasien.jenisKelamin || "L";
    if (!isNaN(bb) && bb > 0) {
      setExamBBU(hitungStatusBbU(bb, usia, jk));
    }
    if (!isNaN(tb) && tb > 0) {
      setExamTBU(hitungStatusTbU(tb, usia, jk));
    }
    if (!isNaN(bb) && bb > 0 && !isNaN(tb) && tb > 0) {
      setExamBBTB(hitungStatusBbTb(bb, tb, jk));
    }
  }, [examBB, examTB, examDate, selectedPasien]);

  // Error & Feedback
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");

  const [statusFilter, setStatusFilter] = useState<"semua" | "selesai" | "belum">("semua");

  const filteredPasiens = useMemo(() => {
    const source = query && query.trim() ? pelayananIndexRef.current.search(query) : pasiens;

    return source.filter((p) => {
      const matchesType = p.tipe === activeTab;
      const matchesStatus =
        statusFilter === "semua"
          ? true
          : statusFilter === "selesai"
          ? p.isCheckedInCurrentPeriod
          : !p.isCheckedInCurrentPeriod;
      return matchesType && matchesStatus;
    });
  }, [query, pasiens, activeTab, statusFilter]);

  // Warning Check
  const checkWarnings = (bbVal: string, sistolVal: string, gdsVal: string) => {
    setFormWarning("");
    if (!selectedPasien) return;

    const bb = parseFloat(bbVal);
    const sistol = parseInt(sistolVal);
    const gds = parseInt(gdsVal);

    if (selectedPasien.tipe === "Balita" && bb > 25) {
      setFormWarning("Konfirmasi: Apakah Berat Badan Balita (>25 kg) sudah benar? Mohon cek kembali.");
    } else if (selectedPasien.tipe === "Lansia") {
      if (sistol > 200) {
        setFormWarning("Peringatan: Tekanan darah sistol >200 mmHg sangat tinggi. Mohon lakukan rujukan segera.");
      } else if (gds > 300) {
        setFormWarning("Peringatan: Gula darah GDS >300 mg/dL sangat tinggi. Segera konsultasikan ke Bidan Desa.");
      }
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedPasien) return;

    const bb = parseFloat(examBB);
    const tb = parseFloat(examTB);

    if (isNaN(bb) || bb <= 0 || isNaN(tb) || tb <= 0) {
      setFormError("Berat Badan (kg) dan Tinggi Badan (cm) harus diisi dengan angka positif.");
      return;
    }

    const now = new Date();
    const curBulan = now.getMonth() + 1;
    const curTahun = now.getFullYear();
    const isPeriodeBulanIniAktif =
      activePeriode &&
      activePeriode.status === "AKTIF" &&
      activePeriode.bulan === curBulan &&
      activePeriode.tahun === curTahun;

    if (!isPeriodeBulanIniAktif) {
      toast.error("Periode pelayanan bulan ini belum aktif. Silakan kelola periode pelayanan terlebih dahulu.");
      if (onOpenPeriodeModal) {
        onOpenPeriodeModal();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      let summaryText = `BB: ${bb}kg, TB: ${tb}cm`;
      let statusText = "Selesai (Normal)";

      if (selectedPasien.tipe === "Balita") {
        const lk = examLK ? parseFloat(examLK) : undefined;
        const lila = examLiLA ? parseFloat(examLiLA) : undefined;
        const usiaBulan = calculateAgeInMonths(selectedPasien.tanggalLahir || "2025-01-01", examDate);

        const selectedCustoms = masterPemberianOptions.filter((opt) => checkedPemberianMap[opt]);
        let cleanImunisasi = examImunisasi
          .replace(/(^|\|\s*)Pemberian:.*$/gi, "")
          .replace(/\|\s*$/, "")
          .trim();

        selectedCustoms.forEach((opt) => {
          const esc = opt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          cleanImunisasi = cleanImunisasi.replace(new RegExp(`(^|[,|\\s]+)${esc}([,|\\s]+|$)`, "gi"), "$1$2").trim();
        });
        cleanImunisasi = cleanImunisasi.replace(/^[,|\s]+/, "").replace(/[,|\s]+$/, "").trim();

        const combinedImunisasiPemberian = [
          cleanImunisasi,
          selectedCustoms.length > 0 ? `Pemberian: ${selectedCustoms.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" | ");

        const balitaPayload = {
          tanggalPeriksa: examDate,
          usiaBulan,
          beratBadan: bb,
          tinggiBadan: tb,
          lingkarKepala: lk,
          lingkarLengan: lila,
          statusBbU: convertStatusBbUToCode(examBBU as any),
          statusTbU: convertStatusTbUToCode(examTBU as any),
          statusBbTb: convertStatusBbTbToCode(examBBTB as any),
          statusKms: examKms || "N",
          vitaminA: examVitA,
          vitB1: examVitB1,
          vitB6: examVitB6,
          asiEksklusif: examAsi,
          obatCacing: examCacing,
          statusImunisasi: combinedImunisasiPemberian || undefined,
          petugas: user?.nama || "Kader Posyandu",
        };

        if (selectedPasien.currentPeriodExam?.id) {
          await balitaApi.updatePemeriksaan(
            posyanduId,
            selectedPasien.id,
            selectedPasien.currentPeriodExam.id,
            balitaPayload as any
          );
        } else {
          await balitaApi.createPemeriksaan(posyanduId, selectedPasien.id, balitaPayload as any);
        }

        summaryText += `${lk ? `, LK: ${lk}cm` : ""}${lila ? `, LiLA: ${lila}cm` : ""}${
          examVitA ? ", Vit A" : ""
        }${examVitB1 ? ", B1" : ""}${examVitB6 ? ", B6" : ""}${
          examAsi ? ", ASI: Masih" : ", ASI: Tidak"
        }${examCacing ? ", Obat Cacing" : ""}${
          selectedCustoms.length > 0 ? `, ${selectedCustoms.join(", ")}` : ""
        }${cleanImunisasi ? `, Imunisasi: ${cleanImunisasi}` : ""}`;
        statusText = `Selesai (${examBBU})`;
      } else {
        const sis = parseInt(examSistol);
        const dia = parseInt(examDiastol);
        const gds = parseInt(examGds);
        const lp = parseInt(examLp);
        const kol = examCholesterol ? parseInt(examCholesterol) : undefined;
        const urat = examUricAcid ? parseFloat(examUricAcid) : undefined;

        if (isNaN(sis) || isNaN(dia) || isNaN(gds) || isNaN(lp)) {
          setFormError("Silakan isi data Tekanan Darah, GDS, dan Lingkar Perut lansia secara lengkap.");
          setIsSubmitting(false);
          return;
        }

        const lansiaPayload = {
          tanggalPeriksa: examDate,
          beratBadan: bb,
          tinggiBadan: tb,
          tekananDarahSistol: sis,
          tekananDarahDiastol: dia,
          gulaDarahSewaktu: gds,
          lingkarPerut: lp,
          kolesterol: kol,
          asamUrat: urat,
          keluhan: examKeluhan || undefined,
          tindakan: examTindakan || undefined,
          petugas: user?.nama || "Kader Posyandu",
        };

        if (selectedPasien.currentPeriodExam?.id) {
          await lansiaApi.updatePemeriksaan(
            posyanduId,
            selectedPasien.id,
            selectedPasien.currentPeriodExam.id,
            lansiaPayload as any
          );
        } else {
          await lansiaApi.createPemeriksaan(posyanduId, selectedPasien.id, lansiaPayload as any);
        }

        summaryText += `, TD: ${sis}/${dia}, GDS: ${gds}, LP: ${lp}cm${
          kol ? `, Kolesterol: ${kol}` : ""
        }${urat ? `, Asam Urat: ${urat}` : ""}`;
        statusText = sis >= 140 || gds >= 200 || (kol && kol >= 200) ? "Selesai (Rawan)" : "Selesai (Normal)";
      }

      const timeNow = new Date();
      const timeStr = `${String(timeNow.getHours()).padStart(2, "0")}:${String(
        timeNow.getMinutes()
      ).padStart(2, "0")} WIB`;

      const newLog: SessionLog = {
        id: `s-${Date.now()}`,
        pasienId: selectedPasien.id,
        nama: selectedPasien.nama,
        tipe: selectedPasien.tipe,
        waktu: timeStr,
        summary: summaryText,
        status: statusText,
      };

      clearExamDraft(posyanduId, selectedPasien.id);

      setSessionLogs([newLog, ...sessionLogs.filter((l) => l.pasienId !== selectedPasien.id)]);
      toast.success(
        selectedPasien.isCheckedInCurrentPeriod
          ? `Hasil pemeriksaan untuk ${selectedPasien.nama} berhasil diperbarui!`
          : `Hasil pemeriksaan untuk ${selectedPasien.nama} berhasil disimpan!`
      );
      clientDataCache.invalidate("pelayanan_pasiens_" + posyanduId);
      fetchPatients(true);
      setFormWarning("");
    } catch (err: any) {
      console.error("Gagal menyimpan data pemeriksaan ke API:", err);
      const msg = err.message || "Gagal menyimpan data pemeriksaan ke database.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSessionLog = (log: SessionLog) => {
    const p = pasiens.find((item) => item.id === log.pasienId);
    if (p) {
      setActiveTab(p.tipe);
      setSelectedPasien(p);
      setFormError("");
      setFormWarning("");
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHelmet
          title={activeTab === "Balita" ? "Pelayanan Balita — SIIP" : "Pelayanan Lansia — SIIP"}
          description="Pencatatan pelayanan dan pemeriksaan SIIP."
        />
        <PelayananSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHelmet
        title={activeTab === "Balita" ? "Pelayanan Balita — SIIP" : "Pelayanan Lansia — SIIP"}
        description={
          activeTab === "Balita"
            ? "Pencatatan pelayanan dan pemeriksaan tumbuh kembang balita SIIP."
            : "Pencatatan pelayanan dan skrining kesehatan fisik lansia SIIP."
        }
      />

      {/* Banner Periode Pelayanan Aktif */}
      <PeriodeBanner activePeriode={activePeriode} onOpenPeriodeModal={onOpenPeriodeModal} />

      {/* Header & Segmented Control Switch */}
      <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                activeTab === "Balita"
                  ? "bg-teal-50 text-saas-primary border border-teal-200/50"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-200/50"
              }`}
            >
              {activeTab === "Balita" ? "Halaman Balita" : "Halaman Lansia"}
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-saas-dark tracking-tight mt-1">
            {activeTab === "Balita" ? "Pencatatan Pelayanan Balita" : "Pencatatan Pelayanan Lansia"}
          </h2>
          <p className="text-xs text-saas-muted mt-0.5">
            {activeTab === "Balita"
              ? "Input data penimbangan, tinggi badan, lingkar kepala, ASI eksklusif, & imunisasi balita."
              : "Input tekanan darah, gula darah, asam urat, kolesterol, & skrining kesehatan lansia."}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/80">
            <button
              type="button"
              onClick={() => {
                setActiveTab("Balita");
                if (selectedPasien?.tipe !== "Balita") {
                  setSelectedPasien(null);
                  setFormError("");
                  setFormWarning("");
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 select-none cursor-pointer ${
                activeTab === "Balita"
                  ? "bg-saas-primary text-white shadow-sm shadow-teal-500/20 scale-[1.02]"
                  : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <BalitaIcon className="w-4 h-4" />
              <span>Balita</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                  activeTab === "Balita" ? "bg-white/20 text-white" : "bg-gray-200/70 text-saas-muted"
                }`}
              >
                {pasiens.filter((p) => p.tipe === "Balita").length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("Lansia");
                if (selectedPasien?.tipe !== "Lansia") {
                  setSelectedPasien(null);
                  setFormError("");
                  setFormWarning("");
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 select-none cursor-pointer ${
                activeTab === "Lansia"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 scale-[1.02]"
                  : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <LansiaIcon className="w-4 h-4" />
              <span>Lansia</span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                  activeTab === "Lansia" ? "bg-white/20 text-white" : "bg-gray-200/70 text-saas-muted"
                }`}
              >
                {pasiens.filter((p) => p.tipe === "Lansia").length}
              </span>
            </button>
          </div>

          {activeTab === "Balita" ? (
            <button
              type="button"
              onClick={() => setShowAddBalitaModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> + Balita Baru
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddLansiaModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-input shadow-md shadow-indigo-500/10 transition-all shrink-0 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> + Lansia Baru
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KOLOM KIRI: Cari & Pilih Warga */}
        <PelayananQueue
          activeTab={activeTab}
          pasiens={pasiens}
          filteredPasiens={filteredPasiens}
          selectedPasien={selectedPasien}
          onSelectPasien={(p) => {
            setSelectedPasien(p);
            setFormError("");
            setFormWarning("");
          }}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          query={query}
          setQuery={setQuery}
          onAddNew={() =>
            activeTab === "Balita" ? setShowAddBalitaModal(true) : setShowAddLansiaModal(true)
          }
        />

        {/* KOLOM KANAN: Formulir Input Pemeriksaan */}
        <div
          ref={formRef}
          className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 lg:col-span-2 h-[600px] overflow-y-auto flex flex-col justify-between"
        >
          {!selectedPasien ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center border ${
                  activeTab === "Balita"
                    ? "bg-teal-50 border-teal-100 text-saas-primary"
                    : "bg-indigo-50 border-indigo-100 text-indigo-600"
                }`}
              >
                {activeTab === "Balita" ? <BalitaIcon className="w-8 h-8" /> : <LansiaIcon className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-saas-dark">
                  {activeTab === "Balita" ? "Pencatatan Pemeriksaan Balita" : "Pencatatan Pemeriksaan Lansia"}
                </h3>
                <p className="text-xs text-saas-muted mt-1 max-w-sm leading-relaxed">
                  {activeTab === "Balita"
                    ? "Pilih salah satu balita dari daftar di panel sebelah kiri atau daftarkan balita baru untuk memasukkan data penimbangan, tinggi badan, & imunisasi."
                    : "Pilih salah satu lansia dari daftar di panel sebelah kiri atau daftarkan lansia baru untuk memasukkan data tekanan darah, gula darah, & asam urat."}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  activeTab === "Balita" ? setShowAddBalitaModal(true) : setShowAddLansiaModal(true)
                }
                className={`mt-2 px-4 py-2 text-xs font-bold rounded-input text-white shadow-sm transition-all cursor-pointer ${
                  activeTab === "Balita" ? "bg-saas-primary hover:bg-teal-600" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {activeTab === "Balita" ? "+ Daftarkan Balita Baru" : "+ Daftarkan Lansia Baru"}
              </button>
            </div>
          ) : (
            <div className="flex-grow flex flex-col justify-between h-full">
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">
                      Warga Terpilih
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPasien?.id) {
                          clearExamDraft(posyanduId, selectedPasien.id);
                        }
                        setActivePatientId(posyanduId, null);
                        setSelectedPasien(null);
                      }}
                      className="text-[10px] text-trend-dangerText font-bold hover:underline cursor-pointer"
                    >
                      Batal Pilih
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          selectedPasien.tipe === "Balita"
                            ? "bg-teal-100 text-saas-primary"
                            : "bg-indigo-100 text-indigo-600"
                        }`}
                      >
                        {selectedPasien.tipe === "Balita" ? (
                          <BalitaIcon className="w-4 h-4" gender={selectedPasien.jenisKelamin} />
                        ) : (
                          <LansiaIcon className="w-4 h-4" gender={selectedPasien.jenisKelamin} />
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigate) {
                              onNavigate(selectedPasien.tipe, selectedPasien.id);
                            }
                          }}
                          className="font-extrabold text-saas-dark text-sm leading-none hover:text-saas-primary hover:underline text-left cursor-pointer flex items-center gap-1 group/link"
                          title={`Lihat profil lengkap ${selectedPasien.nama}`}
                        >
                          <span>{selectedPasien.nama}</span>
                          <span className="text-[10px] text-saas-primary opacity-0 group-hover/link:opacity-100 transition-opacity font-bold">
                            ↗
                          </span>
                        </button>
                        <p className="text-[10px] text-saas-muted font-bold mt-1">
                          {selectedPasien.subInfo} |{" "}
                          {selectedPasien.tipe === "Balita"
                            ? `Ibu: ${selectedPasien.detail1}`
                            : selectedPasien.detail1}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-saas-muted">Alamat</p>
                      <p className="text-[11px] text-saas-dark font-semibold mt-0.5 leading-snug">
                        {selectedPasien.detail2}
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                  {formError && (
                    <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
                    </div>
                  )}
                  {formWarning && (
                    <div className="p-3 bg-yellow-50 text-yellow-700 border border-yellow-100 rounded-lg text-xs font-semibold flex gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {formWarning}
                    </div>
                  )}

                  {/* Display Tanggal Periksa */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-saas-muted flex items-center justify-between">
                      <span>Tanggal Periksa</span>
                      <span className="text-[10px] text-teal-600 font-normal">
                        (mengikuti tanggal periode pelayanan)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={examDate}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                    />
                  </div>

                  {selectedPasien.tipe === "Balita" ? (
                    <BalitaExamFields
                      selectedPasien={selectedPasien}
                      examDate={examDate}
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
                      examImunisasi={examImunisasi}
                      setExamImunisasi={setExamImunisasi}
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
                      checkWarnings={checkWarnings}
                      examSistol={examSistol}
                      examGds={examGds}
                    />
                  ) : (
                    <LansiaExamFields
                      examBB={examBB}
                      setExamBB={setExamBB}
                      examTB={examTB}
                      setExamTB={setExamTB}
                      examSistol={examSistol}
                      setExamSistol={setExamSistol}
                      examDiastol={examDiastol}
                      setExamDiastol={setExamDiastol}
                      examGds={examGds}
                      setExamGds={setExamGds}
                      examLp={examLp}
                      setExamLp={setExamLp}
                      examCholesterol={examCholesterol}
                      setExamCholesterol={setExamCholesterol}
                      examUricAcid={examUricAcid}
                      setExamUricAcid={setExamUricAcid}
                      examKeluhan={examKeluhan}
                      setExamKeluhan={setExamKeluhan}
                      examTindakan={examTindakan}
                      setExamTindakan={setExamTindakan}
                      checkWarnings={checkWarnings}
                    />
                  )}

                  <div className="flex justify-end pt-4 border-t border-gray-50">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : selectedPasien.currentPeriodExam ? (
                        <Edit2 className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {isSubmitting
                        ? "Menyimpan..."
                        : selectedPasien.currentPeriodExam
                        ? "Perbarui Pemeriksaan"
                        : "Simpan Pemeriksaan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DATA YANG SELESAI HARI INI */}
      <SessionLogsTable
        sessionLogs={sessionLogs}
        activeTab={activeTab}
        sessionPage={sessionPage}
        setSessionPage={setSessionPage}
        sessionLimit={sessionLimit}
        setSessionLimit={setSessionLimit}
        onEditLog={handleEditSessionLog}
        onDeleteLog={(log) => setDeletingLog(log)}
        onNavigate={onNavigate}
      />

      {/* Modal Tambah Balita Baru */}
      <AddBalitaModal
        isOpen={showAddBalitaModal}
        onClose={() => setShowAddBalitaModal(false)}
        posyanduId={posyanduId}
        onSuccess={(data) => {
          const ageMonths = calculateAgeInMonths(data.tanggalLahir);
          const newPasien: Pasien = {
            id: data.id,
            nama: data.nama,
            tipe: "Balita",
            subInfo: `Usia ${ageMonths} Bulan`,
            detail1: data.namaIbu,
            detail2: data.alamat,
            tanggalLahir: data.tanggalLahir,
            jenisKelamin: data.jenisKelamin,
          };
          setPasiens((prev) => [newPasien, ...prev]);
          setActiveTab("Balita");
          setSelectedPasien(newPasien);
        }}
      />

      {/* Modal Tambah Lansia Baru */}
      <AddLansiaModal
        isOpen={showAddLansiaModal}
        onClose={() => setShowAddLansiaModal(false)}
        posyanduId={posyanduId}
        onSuccess={(data) => {
          const ageYears = calculateAgeInYears(data.tanggalLahir);
          const newPasien: Pasien = {
            id: data.id,
            nama: data.nama,
            tipe: "Lansia",
            subInfo: `Usia ${ageYears} Tahun`,
            detail1: data.noBpjs ? `BPJS: ${data.noBpjs}` : "BPJS: Tidak Ada",
            detail2: `${data.rtRw}, ${data.alamat}`,
            tanggalLahir: data.tanggalLahir,
            jenisKelamin: data.jenisKelamin,
          };
          setPasiens((prev) => [newPasien, ...prev]);
          setActiveTab("Lansia");
          setSelectedPasien(newPasien);
        }}
      />

      {/* Modal Konfirmasi Hapus Record Pemeriksaan */}
      <Modal
        isOpen={Boolean(deletingLog)}
        onClose={() => setDeletingLog(null)}
        title="Hapus Record Pemeriksaan"
      >
        <div className="space-y-4 text-xs">
          <p className="text-saas-dark leading-relaxed">
            Apakah Anda yakin ingin menghapus record pemeriksaan periode ini untuk{" "}
            <strong className="text-red-600">{deletingLog?.nama}</strong>? Data yang dihapus tidak dapat
            dikembalikan.
          </p>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDeletingLog(null)}
              className="px-4 py-2 bg-gray-100 font-bold rounded-input text-saas-muted hover:bg-gray-200 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmDeleteSessionLog}
              disabled={isDeletingLog}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-input flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isDeletingLog ? "Menghapus..." : "Hapus Record"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
