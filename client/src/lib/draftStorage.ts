export interface FormExamDraft {
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
  updatedAt?: number;
}

const STORAGE_KEY_PREFIX = "posyandu_exam_drafts_";
const ACTIVE_PATIENT_KEY_PREFIX = "posyandu_active_patient_";

export function getAllExamDrafts(posyanduId: string): Record<string, FormExamDraft> {
  if (typeof window === "undefined" || !posyanduId) return {};
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${posyanduId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Gagal membaca drafts dari sessionStorage:", e);
    return {};
  }
}

export function getExamDraft(posyanduId: string, patientId: string): FormExamDraft | null {
  if (!patientId) return null;
  const all = getAllExamDrafts(posyanduId);
  return all[patientId] || null;
}

export function saveExamDraft(
  posyanduId: string,
  patientId: string,
  draft: FormExamDraft
): void {
  if (typeof window === "undefined" || !posyanduId || !patientId) return;
  try {
    const all = getAllExamDrafts(posyanduId);
    all[patientId] = {
      ...all[patientId],
      ...draft,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${posyanduId}`, JSON.stringify(all));
  } catch (e) {
    console.error("Gagal menyimpan draft ke sessionStorage:", e);
  }
}

export function clearExamDraft(posyanduId: string, patientId: string): void {
  if (typeof window === "undefined" || !posyanduId || !patientId) return;
  try {
    const all = getAllExamDrafts(posyanduId);
    if (all[patientId]) {
      delete all[patientId];
      sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${posyanduId}`, JSON.stringify(all));
    }
  } catch (e) {
    console.error("Gagal menghapus draft dari sessionStorage:", e);
  }
}

export function getActivePatientId(posyanduId: string): string | null {
  if (typeof window === "undefined" || !posyanduId) return null;
  try {
    return sessionStorage.getItem(`${ACTIVE_PATIENT_KEY_PREFIX}${posyanduId}`);
  } catch (e) {
    return null;
  }
}

export function setActivePatientId(posyanduId: string, patientId: string | null): void {
  if (typeof window === "undefined" || !posyanduId) return;
  try {
    if (patientId) {
      sessionStorage.setItem(`${ACTIVE_PATIENT_KEY_PREFIX}${posyanduId}`, patientId);
    } else {
      sessionStorage.removeItem(`${ACTIVE_PATIENT_KEY_PREFIX}${posyanduId}`);
    }
  } catch (e) {
    console.error("Gagal memperbarui active patient di sessionStorage:", e);
  }
}
