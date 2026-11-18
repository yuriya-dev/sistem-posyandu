"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  TrendingUp,
} from "lucide-react";
import BalitaIcon from "@/components/BalitaIcon";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
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
import { formatTanggalIndonesia } from "@/lib/dateUtils";
import { extractPemberianLain } from "@/features/laporan/types";
import { calculateAgeInMonths, getStatusBadgeStyle } from "@/features/pelayanan/types";
import { BBU_DATA } from "@/lib/antropometriData";
import { Balita, PemeriksaanBalita } from "../types";

export interface BalitaDetailViewProps {
  activeBalita: Balita;
  onBack: () => void;
  backLabel?: string;
  onEditProfile: (balita: Balita) => void;
  onDeleteProfile: () => void;
  currentPeriodExam?: PemeriksaanBalita | null;
  examDate: string;
  setExamDate: (d: string) => void;
  examBB: string;
  setExamBB: (v: string) => void;
  examTB: string;
  setExamTB: (v: string) => void;
  examBBU: string;
  examTBU: string;
  examBBTB: string;
  examLK: string;
  setExamLK: (v: string) => void;
  examLiLA: string;
  setExamLiLA: (v: string) => void;
  examAsi: boolean;
  setExamAsi: (v: boolean) => void;
  examVitA: boolean;
  setExamVitA: (v: boolean) => void;
  examVitB1: boolean;
  setExamVitB1: (v: boolean) => void;
  examVitB6: boolean;
  setExamVitB6: (v: boolean) => void;
  examCacing: boolean;
  setExamCacing: (v: boolean) => void;
  masterPemberianOptions: string[];
  checkedPemberianMap: Record<string, boolean>;
  setCheckedPemberianMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onDeleteMasterPemberian: (opt: string) => void;
  showAddPemberianInput: boolean;
  setShowAddPemberianInput: (v: boolean) => void;
  newPemberianInput: string;
  setNewPemberianInput: (v: string) => void;
  onAddCustomPemberian: () => void;
  examError: string;
  examWarning: string;
  checkExamWarning: (bbVal: string, tbVal?: string) => void;
  onAddExamSubmit: (e: React.FormEvent) => void;
  onEditExam: (exam: PemeriksaanBalita) => void;
  onDeleteExam: (examId: string) => void;
}

export default function BalitaDetailView({
  activeBalita,
  onBack,
  backLabel,
  onEditProfile,
  onDeleteProfile,
  currentPeriodExam,
  examDate,
  setExamDate,
  examBB,
  setExamBB,
  examTB,
  setExamTB,
  examBBU,
  examTBU,
  examBBTB,
  examLK,
  setExamLK,
  examLiLA,
  setExamLiLA,
  examAsi,
  setExamAsi,
  examVitA,
  setExamVitA,
  examVitB1,
  setExamVitB1,
  examVitB6,
  setExamVitB6,
  examCacing,
  setExamCacing,
  masterPemberianOptions,
  checkedPemberianMap,
  setCheckedPemberianMap,
  onDeleteMasterPemberian,
  showAddPemberianInput,
  setShowAddPemberianInput,
  newPemberianInput,
  setNewPemberianInput,
  onAddCustomPemberian,
  examError,
  examWarning,
  checkExamWarning,
  onAddExamSubmit,
  onEditExam,
  onDeleteExam,
}: BalitaDetailViewProps) {
  // Pagination State untuk Riwayat Perkembangan Bulanan
  const [pageRiwayat, setPageRiwayat] = useState(1);
  const [pageSizeRiwayat, setPageSizeRiwayat] = useState(5);
  const [chartMode, setChartMode] = useState<"kms" | "tinggi">("kms");
  const [deletingPemberian, setDeletingPemberian] = useState<string | null>(null);

  useEffect(() => {
    setPageRiwayat(1);
  }, [activeBalita.id]);

  const listPemeriksaan = activeBalita.pemeriksaan || [];
  const totalItemsRiwayat = listPemeriksaan.length;
  const totalPagesRiwayat = Math.max(1, Math.ceil(totalItemsRiwayat / pageSizeRiwayat));
  const paginatedPemeriksaan = listPemeriksaan.slice(
    (pageRiwayat - 1) * pageSizeRiwayat,
    pageRiwayat * pageSizeRiwayat
  );

  return (
    <div className="space-y-8">
      {/* Back Action Header */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-saas-muted hover:text-saas-dark transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> {backLabel || "Kembali ke Daftar Balita"}
      </button>

      {/* Profile Card & Input Pemeriksaan Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profil Balita */}
        <div className="bg-white rounded-card shadow-soft-card border border-gray-150 p-6 flex flex-col justify-between h-fit space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-saas-primary">
                <BalitaIcon className="w-6 h-6" gender={activeBalita.jenisKelamin} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditProfile(activeBalita)}
                  className="px-3 py-1.5 border border-gray-200 text-saas-dark rounded-lg text-xs font-semibold hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={onDeleteProfile}
                  className="px-3 py-1.5 border border-red-200 text-trend-dangerText rounded-lg text-xs font-semibold hover:bg-red-50 transition-all cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-saas-dark tracking-tight">{activeBalita.nama}</h3>
            <p className="text-xs text-saas-muted font-mono mt-1">
              NIK: {activeBalita.nik || "Tidak terdaftar"}
            </p>
          </div>

          <div className="space-y-4 border-t border-gray-50 pt-4 text-sm font-semibold">
            <div className="flex items-start gap-3">
              <Calendar className="w-4.5 h-4.5 text-saas-muted mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-saas-muted">Tanggal Lahir & Usia</p>
                <p className="text-saas-dark text-xs mt-0.5">
                  {formatTanggalIndonesia(activeBalita.tanggalLahir)} (
                  {calculateAgeInMonths(activeBalita.tanggalLahir)} Bulan)
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
                  <p className="text-saas-dark text-xs mt-0.5 leading-snug text-saas-muted italic">
                    Belum diisi
                  </p>
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
              <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sudah Diisi Periode Ini
              </span>
            ) : (
              <span className="self-start sm:self-auto text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                Belum Diisi Periode Ini
              </span>
            )}
          </div>

          {/* Form Input */}
          <form onSubmit={onAddExamSubmit} className="space-y-4">
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

            {/* Umur & Jenis Kelamin (Otomatis) */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/70 rounded-xl border border-teal-150">
              <div>
                <span className="text-[11px] font-bold text-teal-800 block">Umur:</span>
                <span className="text-xs font-extrabold text-teal-950">
                  {calculateAgeInMonths(activeBalita.tanggalLahir, examDate)} Bulan
                </span>
                <span className="text-[10px] text-teal-600 ml-1 font-semibold">(otomatis)</span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-teal-800 block">Jenis Kelamin:</span>
                <span className="text-xs font-extrabold text-teal-950">
                  {activeBalita.jenisKelamin === "L" ? "Laki-laki (L)" : "Perempuan (P)"}
                </span>
                <span className="text-[10px] text-teal-600 ml-1 font-semibold">(otomatis)</span>
              </div>
            </div>

            {/* Layout BB, TB & Status Gizi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-saas-dark">BB (Berat Badan - kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Contoh: 9.5"
                    value={examBB}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/-/g, "");
                      setExamBB(val);
                      checkExamWarning(val, examTB);
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
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                    }}
                    onChange={(e) => {
                      const val = e.target.value.replace(/-/g, "");
                      setExamTB(val);
                      checkExamWarning(examBB, val);
                    }}
                    className="w-full p-2.5 bg-white border border-gray-250 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                  />
                </div>
              </div>

              {/* Status Gizi Box */}
              <div className="bg-white p-3 rounded-lg border border-teal-200 shadow-2xs flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between border-b border-teal-100 pb-1.5">
                  <h4 className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">
                    Status Gizi
                  </h4>
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
                      <span
                        className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle(
                          "BBU",
                          examBBU
                        )}`}
                      >
                        {examBBU}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-saas-muted">TB/U:</span>
                      <span
                        className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle(
                          "TBU",
                          examTBU
                        )}`}
                      >
                        {examTBU}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-saas-muted">BB/TB:</span>
                      <span
                        className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle(
                          "BBTB",
                          examBBTB
                        )}`}
                      >
                        {examBBTB}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lingkar Lengan & Lingkar Kepala */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Lingkar Lengan (LiLA - cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Contoh: 12.5"
                  value={examLiLA}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                  }}
                  onChange={(e) => setExamLiLA(e.target.value.replace(/-/g, ""))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-saas-muted">Lingkar Kepala (LK - cm)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Contoh: 45"
                  value={examLK}
                  onKeyDown={(e) => {
                    if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
                  }}
                  onChange={(e) => setExamLK(e.target.value.replace(/-/g, ""))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-150 rounded-input text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                />
              </div>
            </div>

            {/* ASI Eksklusif */}
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-saas-dark block">ASI Eksklusif:</label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="detail-asi"
                    checked={examAsi === true}
                    onChange={() => setExamAsi(true)}
                    className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                  />
                  <span className="text-xs font-semibold text-saas-dark">Masih</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="detail-asi"
                    checked={examAsi === false}
                    onChange={() => setExamAsi(false)}
                    className="w-4 h-4 text-saas-primary focus:ring-saas-primary/30"
                  />
                  <span className="text-xs font-semibold text-saas-dark">Tidak</span>
                </label>
              </div>
            </div>

            {/* Vitamin & Pemberian Lain */}
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

                {masterPemberianOptions.map((opt) => (
                  <label
                    key={opt}
                    className="flex items-center gap-1.5 cursor-pointer select-none bg-teal-50 px-2.5 py-1.5 rounded-md border border-teal-200 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checkedPemberianMap[opt])}
                      onChange={(e) => {
                        setCheckedPemberianMap((prev) => ({ ...prev, [opt]: e.target.checked }));
                      }}
                      className="w-4 h-4 text-saas-primary rounded focus:ring-saas-primary/30"
                    />
                    <span>{opt}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPemberian(opt);
                      }}
                      className="text-gray-400 hover:text-red-500 text-[11px] ml-1 font-bold cursor-pointer"
                      title={`Hapus opsi ${opt} secara permanen`}
                    >
                      ✕
                    </button>
                  </label>
                ))}
              </div>

              {showAddPemberianInput ? (
                <div className="flex items-center gap-2 pt-1.5">
                  <input
                    type="text"
                    placeholder="Nama opsi pemberian lain (contoh: Zinc, Taburia)"
                    value={newPemberianInput}
                    onChange={(e) => setNewPemberianInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onAddCustomPemberian();
                      }
                    }}
                    className="p-1.5 border border-gray-250 rounded text-xs w-64 focus:outline-none focus:border-saas-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={onAddCustomPemberian}
                    className="px-2.5 py-1.5 bg-saas-primary text-white text-xs font-bold rounded hover:bg-teal-600 cursor-pointer"
                  >
                    Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPemberianInput(false);
                      setNewPemberianInput("");
                    }}
                    className="px-2.5 py-1.5 bg-gray-100 text-saas-muted text-xs font-bold rounded hover:bg-gray-200 cursor-pointer"
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
                <Plus className="w-3.5 h-3.5" />{" "}
                {currentPeriodExam ? "Perbarui Hasil Periksa" : "Simpan Hasil Periksa"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* GRAFIK PERTUMBUHAN BALITA */}
      <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              Kurva Pertumbuhan Balita (Standar WHO &amp; Kemenkes)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Grafik pertumbuhan individu anak dengan garis acuan median, ambang gizi kurang (-2 SD), dan bawah garis merah (-3 SD).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setChartMode("kms")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  chartMode === "kms"
                    ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Kurva KMS (Berat Badan)
              </button>
              <button
                type="button"
                onClick={() => setChartMode("tinggi")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  chartMode === "tinggi"
                    ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Tinggi &amp; Lingkar Kepala
              </button>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          {activeBalita.pemeriksaan.length > 0 ? (() => {
            const jk: 'L' | 'P' = (activeBalita.jenisKelamin || '').toUpperCase().startsWith('P') ? 'P' : 'L';
            const sortedExams = [...activeBalita.pemeriksaan]
              .sort((a, b) => new Date(a.tanggalPeriksa).getTime() - new Date(b.tanggalPeriksa).getTime());

            if (chartMode === "kms") {
              const kmsChartData = sortedExams.map((p) => {
                const ageM = calculateAgeInMonths(activeBalita.tanggalLahir, p.tanggalPeriksa);
                const std = BBU_DATA[jk]?.[Math.min(60, Math.max(0, ageM))];
                return {
                  tanggal: `${formatTanggalIndonesia(p.tanggalPeriksa)} (${ageM} bln)`,
                  "Berat Badan Balita (kg)": p.beratBadan,
                  "Median WHO (Gizi Baik)": std ? std[3] : null,
                  "Batas Gizi Kurang (-2 SD)": std ? std[1] : null,
                  "Bawah Garis Merah / BGM (-3 SD)": std ? std[0] : null,
                  "Batas Berat Lebih (+2 SD)": std ? std[5] : null,
                };
              });

              return (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kmsChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      domain={['auto', 'auto']}
                      unit=" kg"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFF",
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line
                      type="monotone"
                      dataKey="Berat Badan Balita (kg)"
                      stroke="#0F766E"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "#0F766E" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Median WHO (Gizi Baik)"
                      stroke="#16A34A"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Batas Gizi Kurang (-2 SD)"
                      stroke="#D97706"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Bawah Garis Merah / BGM (-3 SD)"
                      stroke="#DC2626"
                      strokeWidth={1.5}
                      strokeDasharray="2 2"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              );
            }

            const tinggiChartData = sortedExams.map((p) => ({
              tanggal: formatTanggalIndonesia(p.tanggalPeriksa),
              "Tinggi Badan (cm)": p.tinggiBadan,
              "Lingkar Kepala (cm)": p.lingkarKepala || null,
            }));

            return (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tinggiChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} unit=" cm" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFF",
                      borderRadius: "8px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="Tinggi Badan (cm)"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Lingkar Kepala (cm)"
                    stroke="#D97706"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            );
          })() : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
              Belum ada riwayat pemeriksaan untuk menampilkan kurva pertumbuhan.
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
              {paginatedPemeriksaan.length > 0 ? (
                paginatedPemeriksaan.map((exam) => (
                  <tr key={exam.id} className="border-b border-gray-50 last:border-b-0 text-xs text-saas-dark">
                    <td className="py-4 font-bold">{formatTanggalIndonesia(exam.tanggalPeriksa)}</td>
                    <td className="py-4 font-semibold">{exam.usiaBulan} Bulan</td>
                    <td className="py-4 font-bold">{exam.beratBadan} kg</td>
                    <td className="py-4 font-bold">{exam.tinggiBadan} cm</td>
                    <td className="py-4 text-saas-muted">{exam.lingkarKepala ? `${exam.lingkarKepala} cm` : "-"}</td>
                    <td className="py-4 text-saas-muted">{exam.lingkarLengan ? `${exam.lingkarLengan} cm` : "-"}</td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold ${
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
                        className={`px-2 py-0.5 rounded-md font-bold ${
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
                        className={`px-2 py-0.5 rounded-md font-bold ${
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
                          type="button"
                          onClick={() => onEditExam(exam)}
                          className="px-2.5 py-1 text-xs font-bold border border-gray-200 text-saas-dark rounded hover:bg-saas-primary/10 hover:text-saas-primary transition-all cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExam(exam.id)}
                          className="px-2.5 py-1 text-xs font-bold border border-red-200 text-trend-dangerText rounded hover:bg-red-50 transition-all cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-xs text-saas-muted font-medium">
                    Belum ada riwayat pemeriksaan. Silakan input pada form di atas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Riwayat Perkembangan Bulanan */}
        {totalItemsRiwayat > 0 && (
          <Pagination
            currentPage={pageRiwayat}
            totalPages={totalPagesRiwayat}
            pageSize={pageSizeRiwayat}
            totalItems={totalItemsRiwayat}
            onPageChange={setPageRiwayat}
            onPageSizeChange={(newSize) => {
              setPageSizeRiwayat(newSize);
              setPageRiwayat(1);
            }}
            pageSizeOptions={[5, 10, 20]}
          />
        )}
      </div>

      {/* Modal Konfirmasi Hapus Opsi Pemberian */}
      <Modal
        isOpen={Boolean(deletingPemberian)}
        onClose={() => setDeletingPemberian(null)}
        title="Hapus Opsi Pemberian"
      >
        <div className="space-y-4">
          <p className="text-sm text-saas-dark font-medium leading-relaxed">
            Apakah Anda yakin ingin menghapus opsi pemberian{" "}
            <strong className="text-trend-dangerText font-bold">
              &quot;{deletingPemberian}&quot;
            </strong>
            ?
          </p>
          <p className="text-xs text-saas-muted">
            Tindakan ini tidak dapat dibatalkan. Opsi ini akan dihapus secara permanen dari daftar pilihan pemberian untuk posyandu ini.
          </p>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDeletingPemberian(null)}
              className="px-4 py-2 border border-hairline rounded-lg text-xs font-semibold text-saas-dark hover:bg-gray-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (deletingPemberian) {
                  onDeleteMasterPemberian(deletingPemberian);
                  setDeletingPemberian(null);
                }
              }}
              className="px-4 py-2 bg-trend-dangerText text-white rounded-lg text-xs font-semibold hover:bg-red-700 cursor-pointer"
            >
              Ya, Hapus Opsi
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
