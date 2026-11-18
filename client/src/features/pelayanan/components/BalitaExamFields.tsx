"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Pasien, calculateAgeInMonths, getStatusBadgeStyle } from "../types";
import Modal from "@/components/Modal";

export interface BalitaExamFieldsProps {
  selectedPasien: Pasien;
  examDate: string;
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
  examImunisasi: string;
  setExamImunisasi: (v: string) => void;
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
  checkWarnings: (bb: string, sistol: string, gds: string) => void;
  examSistol: string;
  examGds: string;
}

export default function BalitaExamFields({
  selectedPasien,
  examDate,
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
  examImunisasi,
  setExamImunisasi,
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
  checkWarnings,
  examSistol,
  examGds,
}: BalitaExamFieldsProps) {
  const [deletingPemberian, setDeletingPemberian] = useState<string | null>(null);

  return (
    <div className="space-y-4 pt-1">
      {/* Umur & Jenis Kelamin (Otomatis) */}
      <div className="grid grid-cols-2 gap-3 p-3 bg-teal-50/70 rounded-xl border border-teal-150">
        <div>
          <span className="text-[11px] font-bold text-teal-800 block">Umur:</span>
          <span className="text-xs font-extrabold text-teal-950">
            {selectedPasien.tanggalLahir
              ? `${calculateAgeInMonths(selectedPasien.tanggalLahir, examDate)} Bulan`
              : "-"}
          </span>
          <span className="text-[10px] text-teal-600 ml-1 font-semibold">(otomatis)</span>
        </div>
        <div>
          <span className="text-[11px] font-bold text-teal-800 block">Jenis Kelamin:</span>
          <span className="text-xs font-extrabold text-teal-950">
            {selectedPasien.jenisKelamin === "L"
              ? "Laki-laki (L)"
              : selectedPasien.jenisKelamin === "P"
              ? "Perempuan (P)"
              : "-"}
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
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
              }}
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
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
              }}
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
                <span className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle("BBU", examBBU)}`}>
                  {examBBU}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-saas-muted">TB/U:</span>
                <span className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle("TBU", examTBU)}`}>
                  {examTBU}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-saas-muted">BB/TB:</span>
                <span className={`px-2.5 py-1 rounded border text-[11px] ${getStatusBadgeStyle("BBTB", examBBTB)}`}>
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
          <label className="text-xs font-bold text-saas-muted">Lingkar Lengan (cm)</label>
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
          <label className="text-xs font-bold text-saas-muted">Lingkar Kepala (cm)</label>
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

        {/* Add Dynamic Option Controls */}
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
