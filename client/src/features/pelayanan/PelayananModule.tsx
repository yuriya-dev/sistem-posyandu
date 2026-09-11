"use client";

import { useState, useEffect, useRef } from "react";
import { formatTanggalIndonesia, formatTanggalInput } from "../../lib/dateUtils";
import {
  Heart,
  Search,
  Plus,
  AlertCircle,
  ChevronRight,
  UserPlus,
  SlidersHorizontal,
  UserCheck2,
  Loader2,
  Calendar,
  Settings,
  Edit2,
  Trash2,
  User,
  MoreHorizontal,
  CheckCircle2
} from "lucide-react";
import ActionMenu from "../../components/ActionMenu";
import { hitungStatusBbU, hitungStatusTbU, hitungStatusBbTb, hitungIMT, convertStatusBbUToCode, convertStatusTbUToCode, convertStatusBbTbToCode } from "../../lib/zScoreCalculator";
import { balitaApi, lansiaApi, periodeApi, Balita, Lansia, PeriodePelayanan } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

// Reusable Modal Component
import Modal from "../../components/Modal";
import PageHelmet from "../../components/PageHelmet";
import toast from "react-hot-toast";
import { getExamDraft, saveExamDraft, clearExamDraft, getActivePatientId, setActivePatientId, FormExamDraft } from "../../lib/draftStorage";
import { PelayananSkeleton } from "../../components/Skeleton";
import LansiaIcon from "../../components/LansiaIcon";
import BalitaIcon from "../../components/BalitaIcon";

// Tipe Data Pasien
interface Pasien {
  id: string;
  nama: string;
  tipe: "Balita" | "Lansia";
  subInfo: string; // Age or RT/RW
  detail1: string; // Mother's name for child, BPJS for senior
  detail2: string; // Address
  tanggalLahir?: string;
  jenisKelamin?: "L" | "P";
  isCheckedInCurrentPeriod?: boolean;
  currentPeriodExam?: any;
}



// Session Log (Today's entered checkups)
interface SessionLog {
  id: string;
  pasienId?: string;
  nama: string;
  tipe: "Balita" | "Lansia";
  waktu: string;
  summary: string;
  parameter?: string;
  status: string;
  statusType?: "success" | "warning" | "info";
  petugas?: string;
}

// Helper Hitung Usia (Bulan)
function calculateAgeInMonths(birthDateStr: string, refDateStr: string = "2026-07-28"): number {
  const birth = new Date(birthDateStr);
  const ref = new Date(refDateStr);
  let months = (ref.getFullYear() - birth.getFullYear()) * 12;
  months -= birth.getMonth();
  months += ref.getMonth();
  return months <= 0 ? 0 : months;
}

// Helper Hitung Umur (Tahun)
function calculateAgeInYears(birthDateStr: string, refDateStr: string = "2026-07-28"): number {
  const birth = new Date(birthDateStr);
  const ref = new Date(refDateStr);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age <= 0 ? 0 : age;
}

function getStatusBadgeStyle(type: 'BBU' | 'TBU' | 'BBTB', status: string) {
  const s = (status || '').toLowerCase();
  
  if (type === 'BBU') {
    // BB/U: Sangat Kurang | Kurang | Normal | Lebih
    if (s.includes('sangat kurang')) return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
    if (s.includes('kurang')) return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
    if (s.includes('lebih')) return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
  }
  
  if (type === 'TBU') {
    // TB/U: Sangat Pendek | Pendek | Normal | Tinggi
    if (s.includes('sangat pendek')) return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
    if (s.includes('pendek')) return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
    if (s.includes('tinggi')) return 'bg-teal-50 text-teal-800 border-teal-200 font-bold';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
  }

  if (type === 'BBTB') {
    // BB/TB: Sangat Kurus | Kurus | Normal | Gemuk
    if (s.includes('sangat kurus')) return 'bg-red-100 text-red-800 border-red-300 font-extrabold';
    if (s.includes('kurus')) return 'bg-orange-100 text-orange-800 border-orange-300 font-bold';
    if (s.includes('gemuk')) return 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold';
  }

  return 'bg-gray-100 text-gray-800 border-gray-200';
}

interface PelayananModuleProps {
  posyanduId: string;
  activePeriode?: PeriodePelayanan | null;
  onOpenPeriodeModal?: () => void;
  onNavigate?: (menu: string, patientId?: string) => void;
}

export default function PelayananModule({ posyanduId, activePeriode, onOpenPeriodeModal, onNavigate }: PelayananModuleProps) {
  const { user } = useAuth();
  const [pasiens, setPasiens] = useState<Pasien[]>([]);
  const [query, setQuery] = useState("");
  const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);
  const [activeTab, setActiveTab] = useState<"Balita" | "Lansia">("Balita");
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivePatientId(posyanduId, selectedPasien ? selectedPasien.id : null);
  }, [selectedPasien, posyanduId]);

  const handleEditSessionLog = (log: SessionLog) => {
    const target = pasiens.find(
      (p) => (log.pasienId && p.id === log.pasienId) || (p.nama === log.nama && p.tipe === log.tipe)
    );
    if (target) {
      setSelectedPasien(target);
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      toast.success(`Memuat data pemeriksaan ${target.nama} untuk diedit.`);
    } else {
      setFormError(`Data pasien ${log.nama} tidak ditemukan.`);
      toast.error(`Data pasien ${log.nama} tidak ditemukan.`);
    }
  };

  const [deletingLog, setDeletingLog] = useState<SessionLog | null>(null);
  const [isDeletingLog, setIsDeletingLog] = useState(false);

  const confirmDeleteSessionLog = async () => {
    if (!deletingLog || !deletingLog.pasienId) {
      setDeletingLog(null);
      return;
    }
    setIsDeletingLog(true);
    try {
      if (deletingLog.tipe === "Balita") {
        await balitaApi.deletePemeriksaan(posyanduId, deletingLog.pasienId, deletingLog.id);
      } else {
        await lansiaApi.deletePemeriksaan(posyanduId, deletingLog.pasienId, deletingLog.id);
      }
      toast.success(`Record pemeriksaan ${deletingLog.nama} berhasil dihapus.`);
      fetchPatients(true);
      setDeletingLog(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Gagal menghapus record.";
      setFormError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsDeletingLog(false);
    }
  };

  // Registration Modals Visibility
  const [showAddBalitaModal, setShowAddBalitaModal] = useState(false);
  const [showAddLansiaModal, setShowAddLansiaModal] = useState(false);

  // Form State - Register Balita
  const [bNama, setBNama] = useState("");
  const [bNik, setBNik] = useState("");
  const [bTglLahir, setBTglLahir] = useState("2025-01-01");
  const [bJk, setBJk] = useState<"L" | "P">("L");
  const [bNamaIbu, setBNamaIbu] = useState("");
  const [bAlamat, setBAlamat] = useState("RT 01 / RW 02, Karanggayam");
  const [bError, setBError] = useState("");

  // Form State - Register Lansia
  const [lNama, setLNama] = useState("");
  const [lNik, setLNik] = useState("");
  const [lBpjs, setLBpjs] = useState("");
  const [lTglLahir, setLTglLahir] = useState("1960-01-01");
  const [lJk, setLJk] = useState<"L" | "P">("L");
  const [lRtRw, setLRtRw] = useState("");
  const [lAlamat, setLAlamat] = useState("Desa Karanggayam");
  const [lHt, setLHt] = useState(false);
  const [lDm, setLDm] = useState(false);
  const [lKemandirian, setLKemandirian] = useState<"A" | "B" | "C">("A");
  const [lMental, setLMental] = useState("");
  const [lError, setLError] = useState("");

  // Session Log State
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionLimit, setSessionLimit] = useState(5);

  useEffect(() => {
    setSessionPage(1);
  }, [activeTab, activePeriode]);

  const [isLoading, setIsLoading] = useState(true);

  const fetchPatients = (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    const targetMonth = activePeriode ? activePeriode.bulan : (new Date().getMonth() + 1);
    const targetYear = activePeriode ? activePeriode.tahun : new Date().getFullYear();

    Promise.all([
      balitaApi.getAll(posyanduId, { limit: 1000 }),
      lansiaApi.getAll(posyanduId, { limit: 1000 })
    ])
      .then(([balitaRes, lansiaRes]) => {
        // Kumpulkan semua opsi pemberian yang pernah ada di posyandu
        const gatheredCustoms = new Set<string>();
        (balitaRes.data || []).forEach((b: Balita) => {
          (b.pemeriksaans || []).forEach((exam) => {
            if (exam.statusImunisasi) {
              const matches = [...exam.statusImunisasi.matchAll(/Pemberian:\s*([^|]+)/gi)];
              for (const m of matches) {
                m[1].split(',').forEach((s: string) => {
                  const t = s.trim();
                  if (t) gatheredCustoms.add(t);
                });
              }
            }
          });
        });

        if (gatheredCustoms.size > 0) {
          setMasterPemberianOptions(prev => {
            const lowerSet = new Set(prev.map(p => p.toLowerCase()));
            const toAdd = Array.from(gatheredCustoms).filter(item => !lowerSet.has(item.toLowerCase()));
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
            return (d.getMonth() + 1) === targetMonth && d.getFullYear() === targetYear;
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
            return (d.getMonth() + 1) === targetMonth && d.getFullYear() === targetYear;
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

        // Restore selected patient jika sebelumnya ada pasien aktif yang tersimpan
        setSelectedPasien((prev) => {
          const activeId = prev?.id || getActivePatientId(posyanduId);
          if (activeId) {
            return allPasiens.find((p) => p.id === activeId) || prev || null;
          }
          return null;
        });

        // Populate sessionLogs untuk menampilkan seluruh pemeriksaan pada Periode Pelayanan Aktif
        const periodLogs: SessionLog[] = [];
        allPasiens.forEach((p) => {
          if (p.isCheckedInCurrentPeriod && p.currentPeriodExam) {
            const exam = p.currentPeriodExam;
            const isWarning = p.tipe === "Balita"
              ? (exam.statusBbU === 'SK' || exam.statusBbU === 'K' || exam.statusTbU === 'SP' || exam.statusTbU === 'P' || exam.statusBbTb === 'SK' || exam.statusBbTb === 'K' || exam.statusBbTb === 'G')
              : ((exam.tekananDarahSistol >= 140 || exam.tekananDarahDiastol >= 90) || (Number(exam.gulaDarahSewaktu) >= 200));

            let statusDesc = p.tipe === "Balita" ? `Normal (BB/U: ${exam.statusBbU || 'Normal'})` : "Sehat & Normal";
            if (p.tipe === "Balita") {
              if (exam.statusBbU === 'K') statusDesc = "BB Kurang";
              else if (exam.statusBbU === 'SK') statusDesc = "BB Sangat Kurang";
              else if (exam.statusTbU === 'P') statusDesc = "Stunting (Pendek)";
              else if (exam.statusTbU === 'SP') statusDesc = "Sangat Pendek";
              else if (exam.statusBbTb === 'G') statusDesc = "Gizi Lebih / Obesitas";
            } else {
              const isHipertensi = exam.tekananDarahSistol >= 140 || exam.tekananDarahDiastol >= 90;
              const isGdsTinggi = Number(exam.gulaDarahSewaktu) >= 200;
              if (isHipertensi && isGdsTinggi) statusDesc = "Hipertensi & GDS Tinggi";
              else if (isHipertensi) statusDesc = "Hipertensi";
              else if (isGdsTinggi) statusDesc = "GDS Tinggi";
            }

            const paramStr = p.tipe === "Balita"
              ? `BB: ${exam.beratBadan}kg, TB: ${exam.tinggiBadan}cm${exam.lingkarKepala ? `, LK: ${exam.lingkarKepala}cm` : ''}`
              : `BB: ${exam.beratBadan}kg, TB: ${exam.tinggiBadan}cm, TD: ${exam.tekananDarahSistol}/${exam.tekananDarahDiastol} mmHg, GDS: ${exam.gulaDarahSewaktu || '-'}`;

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

  // Form Fields - Common (Checkup)
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

  // Form Fields - Balita (Checkup)
  const [examLK, setExamLK] = useState("");
  const [examBBU, setExamBBU] = useState("Normal");
  const [examTBU, setExamTBU] = useState("Normal");
  const [examBBTB, setExamBBTB] = useState("Normal");
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
    const existing = masterPemberianOptions.find(opt => opt.toLowerCase() === trimmed.toLowerCase());
    const finalKey = existing || trimmed;
    if (!existing) {
      const updated = [...masterPemberianOptions, trimmed];
      updateMasterPemberianOptions(updated);
    }
    setCheckedPemberianMap(prev => ({ ...prev, [finalKey]: true }));
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

  // Form Fields - Lansia (Checkup)
  const [examSistol, setExamSistol] = useState("");
  const [examDiastol, setExamDiastol] = useState("");
  const [examGds, setExamGds] = useState("");
  const [examLp, setExamLp] = useState("");
  const [examCholesterol, setExamCholesterol] = useState("");
  const [examUricAcid, setExamUricAcid] = useState("");
  const [examKeluhan, setExamKeluhan] = useState("");
  const [examTindakan, setExamTindakan] = useState("");

  interface FormDraft {
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
    examSistol?: string;
    examDiastol?: string;
    examGds?: string;
    examLp?: string;
    examCholesterol?: string;
    examUricAcid?: string;
    examKeluhan?: string;
    examTindakan?: string;
  }

  const loadedPatientIdRef = useRef<string | null>(null);

  // Auto-save form draft for active patient ke shared storage
  useEffect(() => {
    if (!selectedPasien?.id) return;
    // PENTING: Hanya simpan draft jika form saat ini sudah tersinkron untuk pasien ini (mencegah data pasien lama menimpa pasien baru)
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

  // Pre-fill form jika pasien sudah memiliki data pemeriksaan atau draft tersimpan
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
    // 1. Prioritaskan data resmi dari database untuk periode ini
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

    // 2. Jika belum ada pemeriksaan resmi di periode ini, cek draft tersimpan khusus pasien ini
    const draft = getExamDraft(posyanduId, selectedPasien.id);
    const hasDraftContent = Boolean(
      draft && (
        draft.examBB ||
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

    // 3. Pasien belum pernah diperiksa pada periode ini dan tidak ada draft -> KOSONGKAN FORM!
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

  // Error & Feedback (Checkup)
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");

  // Filter Patients based on active page/tab, status periksa & search query
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"semua" | "selesai" | "belum">("semua");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const filteredPasiens = pasiens.filter((p) => {
    const matchesSearch = p.nama.toLowerCase().includes(debouncedQuery.toLowerCase());
    const matchesType = p.tipe === activeTab;
    const matchesStatus =
      statusFilter === "semua"
        ? true
        : statusFilter === "selesai"
        ? p.isCheckedInCurrentPeriod
        : !p.isCheckedInCurrentPeriod;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Warning Check (Checkup)
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

    setIsSubmitting(true);
    try {
      let summaryText = `BB: ${bb}kg, TB: ${tb}cm`;
      let statusText = "Selesai (Normal)";

      if (selectedPasien.tipe === "Balita") {
        const lk = examLK ? parseFloat(examLK) : undefined;
        const lila = examLiLA ? parseFloat(examLiLA) : undefined;
        const usiaBulan = calculateAgeInMonths(selectedPasien.tanggalLahir || "2025-01-01", examDate);

        const selectedCustoms = masterPemberianOptions.filter(opt => checkedPemberianMap[opt]);
        let cleanImunisasi = examImunisasi
          .replace(/(^|\|\s*)Pemberian:.*$/gi, "")
          .replace(/\|\s*$/, "")
          .trim();

        // Cegah duplikasi jika opsi pemberian sudah tercentang tapi juga diketik di input imunisasi
        selectedCustoms.forEach((opt) => {
          const esc = opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          cleanImunisasi = cleanImunisasi.replace(new RegExp(`(^|[,|\\s]+)${esc}([,|\\s]+|$)`, 'gi'), '$1$2').trim();
        });
        cleanImunisasi = cleanImunisasi.replace(/^[,|\s]+/, '').replace(/[,|\s]+$/, '').trim();

        const combinedImunisasiPemberian = [
          cleanImunisasi,
          selectedCustoms.length > 0 ? `Pemberian: ${selectedCustoms.join(", ")}` : ""
        ].filter(Boolean).join(" | ");

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
          await balitaApi.updatePemeriksaan(posyanduId, selectedPasien.id, selectedPasien.currentPeriodExam.id, balitaPayload as any);
        } else {
          await balitaApi.createPemeriksaan(posyanduId, selectedPasien.id, balitaPayload as any);
        }

        summaryText += `${lk ? `, LK: ${lk}cm` : ""}${lila ? `, LiLA: ${lila}cm` : ""}${examVitA ? ", Vit A" : ""}${examVitB1 ? ", B1" : ""}${examVitB6 ? ", B6" : ""}${examAsi ? ", ASI: Masih" : ", ASI: Tidak"}${examCacing ? ", Obat Cacing" : ""}${selectedCustoms.length > 0 ? `, ${selectedCustoms.join(", ")}` : ""}${cleanImunisasi ? `, Imunisasi: ${cleanImunisasi}` : ""}`;
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
          await lansiaApi.updatePemeriksaan(posyanduId, selectedPasien.id, selectedPasien.currentPeriodExam.id, lansiaPayload as any);
        } else {
          await lansiaApi.createPemeriksaan(posyanduId, selectedPasien.id, lansiaPayload as any);
        }

        summaryText += `, TD: ${sis}/${dia}, GDS: ${gds}, LP: ${lp}cm${kol ? `, Kolesterol: ${kol}` : ""}${urat ? `, Asam Urat: ${urat}` : ""}`;
        statusText = sis >= 140 || gds >= 200 || (kol && kol >= 200) ? "Selesai (Rawan)" : "Selesai (Normal)";
      }

      const timeNow = new Date();
      const timeStr = `${String(timeNow.getHours()).padStart(2, "0")}:${String(timeNow.getMinutes()).padStart(2, "0")} WIB`;

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

  // Submit Handler (Register Balita)
  const handleRegisterBalita = async (e: React.FormEvent) => {
    e.preventDefault();
    setBError("");

    if (!bNama.trim() || !bNamaIbu.trim() || !bAlamat.trim()) {
      setBError("Mohon lengkapi nama anak, nama ibu, dan alamat.");
      return;
    }

    if (bNik && bNik.length !== 16) {
      setBError("NIK harus tepat 16 digit angka.");
      return;
    }

    try {
      const res = await balitaApi.create(posyanduId, {
        nama: bNama,
        nik: bNik || undefined,
        tanggalLahir: bTglLahir,
        jenisKelamin: bJk,
        namaIbu: bNamaIbu,
        alamat: bAlamat,
      });

      if (res.success && res.data) {
        const ageMonths = calculateAgeInMonths(res.data.tanggalLahir);
        const newPasien: Pasien = {
          id: res.data.id,
          nama: res.data.nama,
          tipe: "Balita",
          subInfo: `Usia ${ageMonths} Bulan`,
          detail1: res.data.namaIbu,
          detail2: res.data.alamat,
          tanggalLahir: res.data.tanggalLahir,
          jenisKelamin: res.data.jenisKelamin,
        };

        setPasiens((prev) => [newPasien, ...prev]);
        setActiveTab("Balita");
        setSelectedPasien(newPasien);
        setShowAddBalitaModal(false);
        toast.success(`${bNama} berhasil didaftarkan & dipilih.`);

        setBNama("");
        setBNik("");
        setBTglLahir("2025-01-01");
        setBJk("L");
        setBNamaIbu("");
        setBAlamat("RT 01 / RW 02, Karanggayam");
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mendaftarkan balita.";
      setBError(msg);
      toast.error(msg);
    }
  };

  // Submit Handler (Register Lansia)
  const handleRegisterLansia = async (e: React.FormEvent) => {
    e.preventDefault();
    setLError("");

    if (!lNama.trim() || !lNik.trim() || !lRtRw.trim() || !lAlamat.trim()) {
      setLError("Mohon isi nama, NIK, RT/RW, dan alamat.");
      toast.error("Mohon isi nama, NIK, RT/RW, dan alamat.");
      return;
    }

    if (lNik.length !== 16) {
      setLError("NIK harus tepat 16 digit angka.");
      toast.error("NIK harus tepat 16 digit angka.");
      return;
    }

    try {
      const res = await lansiaApi.create(posyanduId, {
        nama: lNama,
        nik: lNik,
        noBpjs: lBpjs || undefined,
        tanggalLahir: lTglLahir,
        jenisKelamin: lJk,
        rtRw: lRtRw,
        alamat: lAlamat,
        riwayatHt: lHt,
        riwayatDm: lDm,
        tingkatKemandirian: lKemandirian,
        gangguanMentalEmosional: lMental || undefined,
      });

      if (res.success && res.data) {
        const ageYears = calculateAgeInYears(res.data.tanggalLahir);
        const newPasien: Pasien = {
          id: res.data.id,
          nama: res.data.nama,
          tipe: "Lansia",
          subInfo: `Usia ${ageYears} Tahun`,
          detail1: res.data.noBpjs ? `BPJS: ${res.data.noBpjs}` : "BPJS: Tidak Ada",
          detail2: `${res.data.rtRw}, ${res.data.alamat}`,
          tanggalLahir: res.data.tanggalLahir,
          jenisKelamin: res.data.jenisKelamin,
        };

        setPasiens((prev) => [newPasien, ...prev]);
        setActiveTab("Lansia");
        setSelectedPasien(newPasien);
        setShowAddLansiaModal(false);
        toast.success(`Lansia ${lNama} berhasil didaftarkan & dipilih.`);

        setLNama("");
        setLNik("");
        setLBpjs("");
        setLTglLahir("1960-01-01");
        setLJk("L");
        setLRtRw("");
        setLAlamat("Desa Karanggayam");
        setLHt(false);
        setLDm(false);
        setLKemandirian("A");
        setLMental("");
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mendaftarkan lansia.";
      setLError(msg);
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHelmet
          title={activeTab === "Balita" ? "Pelayanan Balita — PosyanduKita" : "Pelayanan Lansia — PosyanduKita"}
          description="Pencatatan pelayanan dan pemeriksaan PosyanduKita."
        />
        <PelayananSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHelmet
        title={activeTab === "Balita" ? "Pelayanan Balita — PosyanduKita" : "Pelayanan Lansia — PosyanduKita"}
        description={
          activeTab === "Balita"
            ? "Pencatatan pelayanan dan pemeriksaan tumbuh kembang balita PosyanduKita."
            : "Pencatatan pelayanan dan skrining kesehatan fisik lansia PosyanduKita."
        }
      />

      {/* Banner Periode Pelayanan Aktif */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-800 border border-teal-200/80 px-2 py-0.5 rounded-md">
                Periode Pelayanan
              </span>
              {activePeriode?.status === "AKTIF" ? (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                  AKTIF
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                  BELUM ADA PERIODE AKTIF
                </span>
              )}
            </div>
            <h3 className="text-base font-extrabold tracking-tight mt-1 text-gray-900">
              {activePeriode ? activePeriode.nama : "Periode Pelayanan Bulan Ini Belum Dibuat"}
            </h3>
            {activePeriode ? (
              <p className="text-xs text-gray-600 font-medium mt-0.5">
                Tanggal Pelaksanaan: <span className="font-bold text-teal-700">{new Date(activePeriode.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                {activePeriode.catatan ? ` • ${activePeriode.catatan}` : ""}
              </p>
            ) : (
              <p className="text-xs text-amber-700 font-semibold mt-0.5">
                Harap buat atau pilih periode baru bulan ini untuk memulai pencatatan pelayanan.
              </p>
            )}
          </div>
        </div>

        {onOpenPeriodeModal && (
          <button
            type="button"
            onClick={onOpenPeriodeModal}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-all shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4" /> Buka / Pilih Periode Pelayanan
          </button>
        )}
      </div>

      {/* Header & Tombol Switch Halaman */}
      <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
              activeTab === "Balita" ? "bg-teal-50 text-saas-primary border border-teal-200/50" : "bg-indigo-50 text-indigo-700 border border-indigo-200/50"
            }`}>
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
          {/* Tombol Switch Halaman (Segmented Control) */}
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 select-none ${
                activeTab === "Balita"
                  ? "bg-saas-primary text-white shadow-sm shadow-teal-500/20 scale-[1.02]"
                  : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <BalitaIcon className="w-4 h-4" />
              <span>Balita</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === "Balita" ? "bg-white/20 text-white" : "bg-gray-200/70 text-saas-muted"
              }`}>
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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 select-none ${
                activeTab === "Lansia"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 scale-[1.02]"
                  : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <LansiaIcon className="w-4 h-4" />
              <span>Lansia</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === "Lansia" ? "bg-white/20 text-white" : "bg-gray-200/70 text-saas-muted"
              }`}>
                {pasiens.filter((p) => p.tipe === "Lansia").length}
              </span>
            </button>
          </div>

          {/* Action Button sesuai halaman aktif */}
          {activeTab === "Balita" ? (
            <button
              type="button"
              onClick={() => setShowAddBalitaModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all shrink-0"
            >
              <UserPlus className="w-4 h-4" /> + Balita Baru
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddLansiaModal(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-input shadow-md shadow-indigo-500/10 transition-all shrink-0"
            >
              <UserPlus className="w-4 h-4" /> + Lansia Baru
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KOLOM KIRI: Cari & Pilih Warga Sesuai Halaman Aktif */}
        <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 flex flex-col h-[600px] space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-saas-dark">
                {activeTab === "Balita" ? "Pilih Balita" : "Pilih Lansia"}
              </h3>
              <span className="text-[10px] font-bold text-saas-muted bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredPasiens.length} Orang
              </span>
            </div>

            {/* Tab Status Periksa */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter("semua")}
                className={`flex-1 py-1 text-center rounded-md transition-all ${
                  statusFilter === "semua"
                    ? "bg-white text-saas-dark shadow-sm"
                    : "text-saas-muted hover:text-saas-dark"
                }`}
              >
                Semua ({pasiens.filter((p) => p.tipe === activeTab).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("selesai")}
                className={`flex-1 py-1 text-center rounded-md transition-all ${
                  statusFilter === "selesai"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-saas-muted hover:text-saas-dark"
                }`}
              >
                Selesai ({pasiens.filter((p) => p.tipe === activeTab && p.isCheckedInCurrentPeriod).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("belum")}
                className={`flex-1 py-1 text-center rounded-md transition-all ${
                  statusFilter === "belum"
                    ? "bg-white text-amber-700 shadow-sm"
                    : "text-saas-muted hover:text-saas-dark"
                }`}
              >
                Belum ({pasiens.filter((p) => p.tipe === activeTab && !p.isCheckedInCurrentPeriod).length})
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={activeTab === "Balita" ? "Cari nama balita..." : "Cari nama lansia..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 focus:bg-white transition-all"
            />
            <Search className="absolute left-3.5 top-2.5 text-saas-muted/80 w-4 h-4" />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {filteredPasiens.length > 0 ? (
              filteredPasiens.map((p) => {
                const isSelected = selectedPasien?.id === p.id;
                const isFemale = p.jenisKelamin === "P" || (p.jenisKelamin as string) === "Perempuan";
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPasien(p);
                      setFormError("");
                      setFormWarning("");
                    }}
                    className={`w-full text-left p-3 border rounded-xl flex items-center justify-between text-xs transition-all group ${
                      isSelected
                        ? activeTab === "Balita"
                          ? "border-saas-primary bg-saas-primary/5 shadow-sm shadow-teal-500/5"
                          : "border-indigo-500 bg-indigo-50/40 shadow-sm shadow-indigo-500/5"
                        : "border-gray-100 hover:border-saas-primary/30 hover:bg-gray-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected 
                          ? isFemale ? "bg-pink-200/80 border-pink-300" : "bg-blue-200/80 border-blue-300"
                          : isFemale ? "bg-pink-50 border-pink-100" : "bg-blue-50 border-blue-100"
                      }`}>
                        {p.tipe === "Balita" ? <BalitaIcon className="w-4 h-4" gender={p.jenisKelamin} /> : <LansiaIcon className="w-4 h-4" gender={p.jenisKelamin} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold truncate transition-colors ${
                            isSelected 
                              ? p.tipe === "Balita" ? "text-teal-900" : "text-indigo-950" 
                              : "text-saas-dark group-hover:text-saas-primary"
                          }`}>{p.nama}</p>
                          {p.isCheckedInCurrentPeriod ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-teal-100 text-teal-700 border border-teal-200 shrink-0">
                              Selesai
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-600 border border-amber-200/60 shrink-0">
                              Belum
                            </span>
                          )}
                        </div>
                        <p className={`text-[10px] font-semibold mt-0.5 ${
                          isSelected
                            ? p.tipe === "Balita" ? "text-teal-700" : "text-indigo-800"
                            : "text-saas-muted"
                        }`}>{p.subInfo}</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-transform ${
                      isSelected 
                        ? p.tipe === "Balita" ? "text-teal-700 translate-x-1" : "text-indigo-700 translate-x-1" 
                        : "text-saas-muted group-hover:translate-x-1"
                    }`} />
                  </button>
                );
              })
            ) : (
              <div className="text-center py-12 px-4 space-y-2">
                <p className="text-xs text-saas-muted font-medium">
                  {activeTab === "Balita" ? "Data balita tidak ditemukan." : "Data lansia tidak ditemukan."}
                </p>
                <button
                  type="button"
                  onClick={() => (activeTab === "Balita" ? setShowAddBalitaModal(true) : setShowAddLansiaModal(true))}
                  className="text-[11px] font-bold text-saas-primary hover:underline"
                >
                  {activeTab === "Balita" ? "+ Daftarkan Balita Baru" : "+ Daftarkan Lansia Baru"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KOLOM KANAN: Formulir Input Pemeriksaan */}
        <div ref={formRef} className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 lg:col-span-2 h-[600px] overflow-y-auto flex flex-col justify-between">
          {!selectedPasien ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border ${
                activeTab === "Balita" ? "bg-teal-50 border-teal-100 text-saas-primary" : "bg-indigo-50 border-indigo-100 text-indigo-600"
              }`}>
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
                onClick={() => (activeTab === "Balita" ? setShowAddBalitaModal(true) : setShowAddLansiaModal(true))}
                className={`mt-2 px-4 py-2 text-xs font-bold rounded-input text-white shadow-sm transition-all ${
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
                    <span className="text-[10px] font-bold text-saas-muted uppercase tracking-wider">Warga Terpilih</span>
                    <button 
                      onClick={() => {
                        if (selectedPasien?.id) {
                          clearExamDraft(posyanduId, selectedPasien.id);
                        }
                        setActivePatientId(posyanduId, null);
                        setSelectedPasien(null);
                      }}
                      className="text-[10px] text-trend-dangerText font-bold hover:underline"
                    >
                      Batal Pilih
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selectedPasien.tipe === "Balita" ? "bg-teal-100 text-saas-primary" : "bg-indigo-100 text-indigo-600"
                      }`}>
                        {selectedPasien.tipe === "Balita" ? <BalitaIcon className="w-4 h-4" gender={selectedPasien.jenisKelamin} /> : <LansiaIcon className="w-4 h-4" gender={selectedPasien.jenisKelamin} />}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigate) {
                              onNavigate(selectedPasien.tipe === "Balita" ? "Balita" : "Lansia", selectedPasien.id);
                            }
                          }}
                          className="font-extrabold text-saas-dark text-sm leading-none hover:text-saas-primary hover:underline text-left cursor-pointer flex items-center gap-1 group/link"
                          title={`Lihat profil lengkap ${selectedPasien.nama}`}
                        >
                          <span>{selectedPasien.nama}</span>
                          <span className="text-[10px] text-saas-primary opacity-0 group-hover/link:opacity-100 transition-opacity font-bold">↗</span>
                        </button>
                        <p className="text-[10px] text-saas-muted font-bold mt-1">
                          {selectedPasien.subInfo} | {selectedPasien.tipe === "Balita" ? `Ibu: ${selectedPasien.detail1}` : selectedPasien.detail1}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] text-saas-muted">Alamat</p>
                      <p className="text-[11px] text-saas-dark font-semibold mt-0.5 leading-snug">{selectedPasien.detail2}</p>
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

                  {selectedPasien.currentPeriodExam && (
                    <div className="p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
                      <span>Pemeriksaan untuk periode ini sudah tercatat. Menyimpan form akan <strong>memperbarui (edit)</strong> data pemeriksaan yang ada.</span>
                    </div>
                  )}

                  {/* Display Tanggal Periksa */}
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

                  {selectedPasien.tipe === "Balita" && (
                    <div className="space-y-4 pt-1">
                      {/* Umur & Jenis Kelamin (Otomatis) */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/70 rounded-xl border border-teal-150">
                        <div>
                          <span className="text-[11px] font-bold text-teal-800 block">Umur:</span>
                          <span className="text-xs font-extrabold text-teal-950">
                            {selectedPasien.tanggalLahir ? `${calculateAgeInMonths(selectedPasien.tanggalLahir, examDate)} Bulan` : "-"}
                          </span>
                          <span className="text-[10px] text-teal-600 ml-1 font-semibold">(otomatis)</span>
                        </div>
                        <div>
                          <span className="text-[11px] font-bold text-teal-800 block">Jenis Kelamin:</span>
                          <span className="text-xs font-extrabold text-teal-950">
                            {selectedPasien.jenisKelamin === 'L' ? 'Laki-laki (L)' : selectedPasien.jenisKelamin === 'P' ? 'Perempuan (P)' : '-'}
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
                              placeholder="Contoh: 9.5"
                              value={examBB}
                              onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                              onChange={(e) => {
                                const val = e.target.value.replace(/-/g, "");
                                setExamBB(val);
                                checkWarnings(val, examSistol, examGds);
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
                              placeholder="Contoh: 74.2"
                              value={examTB}
                              onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                              onChange={(e) => setExamTB(e.target.value.replace(/-/g, ""))}
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
                          {!examBB || !examTB || parseFloat(examBB) <= 0 || parseFloat(examTB) <= 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 text-center space-y-1">
                              <p className="text-xs text-gray-400 font-semibold">Menunggu pengukuran</p>
                              <p className="text-[10px] text-gray-400">Isi BB dan TB untuk menghitung status gizi</p>
                            </div>
                          ) : (
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-saas-muted">BB/U:</span>
                                <span className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle('BBU', examBBU)}`}>{examBBU}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-saas-muted">TB/U:</span>
                                <span className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle('TBU', examTBU)}`}>{examTBU}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-saas-muted">BB/TB:</span>
                                <span className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle('BBTB', examBBTB)}`}>{examBBTB}</span>
                              </div>
                            </div>
                          )}
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
                              name="asiEksklusif"
                              checked={examAsi === true}
                              onChange={() => setExamAsi(true)}
                              className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                            />
                            <span className="text-xs font-semibold text-saas-dark">Masih</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="asiEksklusif"
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
                    </div>
                  )}

                  {selectedPasien.tipe === "Lansia" && (
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Berat Badan (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="Contoh: 60.5"
                            value={examBB}
                            onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/-/g, "");
                              setExamBB(val);
                              checkWarnings(val, examSistol, examGds);
                            }}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Tinggi Badan (cm)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder="Contoh: 165.0"
                            value={examTB}
                            onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                            onChange={(e) => setExamTB(e.target.value.replace(/-/g, ""))}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Sistol (mmHg)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="cth: 120"
                            value={examSistol}
                            onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/-/g, "");
                              setExamSistol(val);
                              checkWarnings(examBB, val, examGds);
                            }}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Diastol (mmHg)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="cth: 80"
                            value={examDiastol}
                            onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                            onChange={(e) => setExamDiastol(e.target.value.replace(/-/g, ""))}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">GDS (mg/dL)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="cth: 120"
                            value={examGds}
                            onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                            onChange={(e) => {
                              const val = e.target.value.replace(/-/g, "");
                              setExamGds(val);
                              checkWarnings(examBB, examSistol, val);
                            }}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Lingkar Perut (cm)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="cth: 90"
                            value={examLp}
                            onKeyDown={(e) => { if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault(); }}
                            onChange={(e) => setExamLp(e.target.value.replace(/-/g, ""))}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Kolesterol (mg/dL)</label>
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

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Asam Urat (mg/dL)</label>
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Keluhan Saat Ini</label>
                          <textarea
                            placeholder="Tulis keluhan lansia saat ini..."
                            rows={2}
                            value={examKeluhan}
                            onChange={(e) => setExamKeluhan(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 resize-none"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-saas-muted">Tindakan / Rujukan</label>
                          <textarea
                            placeholder="Tulis tindakan medis atau rujukan..."
                            rows={2}
                            value={examTindakan}
                            onChange={(e) => setExamTindakan(e.target.value)}
                            className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-gray-50">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : selectedPasien.currentPeriodExam ? (
                        <Edit2 className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      {isSubmitting ? "Menyimpan..." : selectedPasien.currentPeriodExam ? "Perbarui Pemeriksaan" : "Simpan Pemeriksaan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DATA YANG SELESAI HARI INI */}
      <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-base text-saas-dark">Pencatatan Sesi Pelayanan Periode Ini ({activeTab})</h3>
            <p className="text-xs text-saas-muted mt-0.5">Daftar {activeTab.toLowerCase()} yang sudah selesai dimasukkan datanya dalam sesi pelayanan periode ini.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {(() => {
            const filteredSessionLogs = sessionLogs.filter((log) => log.tipe === activeTab);
            const totalSessionPages = Math.ceil(filteredSessionLogs.length / sessionLimit) || 1;
            const paginatedSessionLogs = filteredSessionLogs.slice(
              (sessionPage - 1) * sessionLimit,
              sessionPage * sessionLimit
            );

            return filteredSessionLogs.length > 0 ? (
              <>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                      <th className="pb-3">Nama</th>
                      <th className="pb-3">Kategori</th>
                      <th className="pb-3">Hasil Pengukuran</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Jam Input</th>
                      <th className="pb-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSessionLogs.map((log, idx) => (
                      <tr key={log.id} className="border-b border-gray-50 last:border-b-0 text-xs text-saas-dark hover:bg-gray-50/50 transition-colors">
                        <td className="py-3.5 font-bold">{log.nama}</td>
                        <td className="py-3.5 text-saas-muted font-semibold">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            log.tipe === "Balita" ? "bg-teal-50 text-saas-primary" : "bg-indigo-50 text-indigo-600"
                          }`}>
                            {log.tipe}
                          </span>
                        </td>
                        <td className="py-3.5 text-saas-muted font-semibold">{log.summary}</td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${
                            log.status.includes("Normal") 
                              ? "bg-trend-successBg text-trend-successText" 
                              : "bg-trend-dangerBg text-trend-dangerText"
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-3.5 font-bold text-saas-muted">{log.waktu}</td>
                        <td className="py-3.5 text-right whitespace-nowrap">
                          <ActionMenu
                            alignDirection={idx < 2 ? "bottom" : "top"}
                            items={[
                              {
                                label: "Edit Record",
                                icon: <Edit2 className="w-4 h-4 text-amber-600" />,
                                onClick: () => handleEditSessionLog(log),
                              },
                              ...(onNavigate && log.pasienId
                                ? [
                                    {
                                      label: `Profil ${log.tipe}`,
                                      icon: <User className="w-4 h-4 text-teal-600" />,
                                      onClick: () => onNavigate(log.tipe, log.pasienId),
                                    },
                                  ]
                                : []),
                              ...(log.pasienId ? [
                                {
                                  label: "Hapus Record",
                                  icon: <Trash2 className="w-4 h-4 text-red-600" />,
                                  variant: "danger" as const,
                                  onClick: () => setDeletingLog(log),
                                }
                              ] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination Controls - Style Sama Dengan Balita/Lansia */}
                <div className="pt-4 mt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-saas-muted font-medium">
                  <div className="flex items-center gap-2">
                    <span>Tampilkan</span>
                    <select
                      value={sessionLimit}
                      onChange={(e) => {
                        setSessionLimit(Number(e.target.value));
                        setSessionPage(1);
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
                      (Menampilkan {filteredSessionLogs.length === 0 ? 0 : (sessionPage - 1) * sessionLimit + 1} - {Math.min(sessionPage * sessionLimit, filteredSessionLogs.length)} dari {filteredSessionLogs.length} data)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSessionPage((p) => Math.max(p - 1, 1))}
                      disabled={sessionPage === 1}
                      className="px-3 py-1.5 rounded-md border border-gray-200 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Sebelumnya
                    </button>
                    <span className="px-3 py-1.5 font-bold text-saas-dark">
                      Halaman {sessionPage} dari {totalSessionPages || 1}
                    </span>
                    <button
                      onClick={() => setSessionPage((p) => Math.min(p + 1, totalSessionPages))}
                      disabled={sessionPage >= totalSessionPages}
                      className="px-3 py-1.5 rounded-md border border-gray-200 font-bold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Selanjutnya
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-saas-muted py-8 font-medium">
                Belum ada pemeriksaan yang dicatat dalam sesi periode ini.
              </p>
            );
          })()}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* REUSABLE DRAWER: DAFTAR BALITA BARU */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showAddBalitaModal}
        onClose={() => {
          setShowAddBalitaModal(false);
          setBError("");
        }}
        title="Daftarkan Balita Baru"
        description="Daftarkan identitas balita baru ke register sebelum mencatat data pemeriksaan bulanan."
        type="drawer"
      >
        <form onSubmit={handleRegisterBalita} className="space-y-4 pt-2 flex flex-col justify-between h-full">
          <div className="space-y-4">
            {bError && (
              <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {bError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nama Lengkap Anak</label>
              <input
                type="text"
                placeholder="Contoh: Rafif Athar"
                value={bNama}
                onChange={(e) => setBNama(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">NIK (16 Digit - Opsional)</label>
              <input
                type="text"
                maxLength={16}
                placeholder="330102xxxxxxxxxx"
                value={bNik}
                onChange={(e) => setBNik(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Tanggal Lahir</label>
                <input
                  type="date"
                  value={bTglLahir}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setBTglLahir(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Jenis Kelamin</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer select-none">
                    <input
                      type="radio"
                      name="b-jk-drawer"
                      checked={bJk === "L"}
                      onChange={() => setBJk("L")}
                      className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                    />
                    Laki-laki
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer select-none">
                    <input
                      type="radio"
                      name="b-jk-drawer"
                      checked={bJk === "P"}
                      onChange={() => setBJk("P")}
                      className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                    />
                    Perempuan
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nama Lengkap Ibu Kandung</label>
              <input
                type="text"
                placeholder="Contoh: Ibu Ranti"
                value={bNamaIbu}
                onChange={(e) => setBNamaIbu(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Alamat Rumah (Jalan / RT / RW)</label>
              <input
                type="text"
                value={bAlamat}
                onChange={(e) => setBAlamat(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-100 mt-8 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowAddBalitaModal(false);
                setBError("");
              }}
              className="flex-1 py-3 border border-gray-200 text-saas-dark text-xs font-bold rounded-input hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-colors"
            >
              Daftarkan & Pilih
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* REUSABLE DRAWER: DAFTAR LANSIA BARU */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showAddLansiaModal}
        onClose={() => {
          setShowAddLansiaModal(false);
          setLError("");
        }}
        title="Daftarkan Lansia Baru"
        description="Daftarkan identitas lansia baru sebelum melakukan skrining kesehatan berkala."
        type="drawer"
      >
        <form onSubmit={handleRegisterLansia} className="space-y-4 pt-2 flex flex-col justify-between h-full">
          <div className="space-y-4">
            {lError && (
              <div className="p-3 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {lError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Nama Lengkap Lansia</label>
              <input
                type="text"
                placeholder="Contoh: Mbah Joyo"
                value={lNama}
                onChange={(e) => setLNama(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">NIK (16 digit wajib)</label>
                <input
                  type="text"
                  maxLength={16}
                  placeholder="NIK sesuai KTP"
                  value={lNik}
                  onChange={(e) => setLNik(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">No BPJS (Opsional)</label>
                <input
                  type="text"
                  placeholder="Nomor kartu BPJS"
                  value={lBpjs}
                  onChange={(e) => setLBpjs(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Tanggal Lahir</label>
                <input
                  type="date"
                  value={lTglLahir}
                  onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                  onChange={(e) => setLTglLahir(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Jenis Kelamin</label>
                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer select-none">
                    <input
                      type="radio"
                      name="l-jk-drawer"
                      checked={lJk === "L"}
                      onChange={() => setLJk("L")}
                      className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                    />
                    Laki-laki
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-saas-dark cursor-pointer select-none">
                    <input
                      type="radio"
                      name="l-jk-drawer"
                      checked={lJk === "P"}
                      onChange={() => setLJk("P")}
                      className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                    />
                    Perempuan
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-gray-50 pt-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">RT / RW</label>
                <input
                  type="text"
                  placeholder="Cth: RT 02 / RW 02"
                  value={lRtRw}
                  onChange={(e) => setLRtRw(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Status Kemandirian</label>
                <select
                  value={lKemandirian}
                  onChange={(e) => setLKemandirian(e.target.value as any)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                >
                  <option value="A">Kategori A (Mandiri)</option>
                  <option value="B">Kategori B (Bantuan Sebagian)</option>
                  <option value="C">Kategori C (Tergantung Total)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Penyakit Bawaan (HT / DM)</label>
              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lHt}
                    onChange={(e) => setLHt(e.target.checked)}
                    className="w-4.5 h-4.5 text-saas-primary focus:ring-saas-primary/30"
                  />
                  <span className="text-xs font-bold text-saas-dark">Hipertensi</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={lDm}
                    onChange={(e) => setLDm(e.target.checked)}
                    className="w-4.5 h-4.5 text-saas-primary focus:ring-saas-primary/30"
                  />
                  <span className="text-xs font-bold text-saas-dark">Diabetes</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Catatan Skrining Mental (Opsional)</label>
              <input
                type="text"
                placeholder="Cth: Cenderung pikun"
                value={lMental}
                onChange={(e) => setLMental(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-saas-muted">Alamat Wilayah / Dusun</label>
              <input
                type="text"
                value={lAlamat}
                onChange={(e) => setLAlamat(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-100 mt-8 shrink-0">
            <button
              type="button"
              onClick={() => {
                setShowAddLansiaModal(false);
                setLError("");
              }}
              className="flex-1 py-3 border border-gray-200 text-saas-dark text-xs font-bold rounded-input hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-colors"
            >
              Daftarkan & Pilih
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus Record Pemeriksaan Sesi Ini */}
      <Modal
        isOpen={Boolean(deletingLog)}
        onClose={() => setDeletingLog(null)}
        title="Hapus Record Pemeriksaan"
      >
        <div className="space-y-4 text-xs">
          <p className="text-saas-dark leading-relaxed">
            Apakah Anda yakin ingin menghapus record pemeriksaan periode ini untuk <strong className="text-red-600">{deletingLog?.nama}</strong>? Data yang dihapus tidak dapat dikembalikan.
          </p>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDeletingLog(null)}
              className="px-4 py-2 bg-gray-100 font-bold rounded-input text-saas-muted hover:bg-gray-200"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={confirmDeleteSessionLog}
              disabled={isDeletingLog}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-input flex items-center gap-1.5 disabled:opacity-50"
            >
              {isDeletingLog ? "Menghapus..." : "Hapus Record"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
