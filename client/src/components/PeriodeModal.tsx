"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, Check, AlertCircle, X, Trash2, FolderPlus } from "lucide-react";
import { periodeApi, PeriodePelayanan } from "../lib/api";
import Modal from "./Modal";
import toast from "react-hot-toast";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

interface PeriodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  posyanduId: string;
  activePeriode: PeriodePelayanan | null;
  onSelectPeriode: (periode: PeriodePelayanan) => void;
  onRefreshPeriode: () => void;
}

export default function PeriodeModal({
  isOpen,
  onClose,
  posyanduId,
  activePeriode,
  onSelectPeriode,
  onRefreshPeriode,
}: PeriodeModalProps) {
  const [periodes, setPeriodes] = useState<PeriodePelayanan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Form State
  const today = new Date();
  const currentMonthIdx = today.getMonth();
  const currentYearNum = today.getFullYear();

  const [nama, setNama] = useState(`Pelayanan ${NAMA_BULAN[currentMonthIdx]} ${currentYearNum}`);
  const [bulan, setBulan] = useState(currentMonthIdx + 1);
  const [tahun, setTahun] = useState(currentYearNum);
  const [tanggal, setTanggal] = useState(today.toISOString().slice(0, 10));
  const [status, setStatus] = useState<"AKTIF" | "SELESAI">("AKTIF");
  const [catatan, setCatatan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPeriodes = async () => {
    if (!posyanduId) return;
    setIsLoading(true);
    try {
      const res = await periodeApi.getAll(posyanduId);
      if (res.success && res.data) {
        setPeriodes(res.data);
      }
    } catch (err: any) {
      console.error("Gagal memuat daftar periode:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPeriodes();
      setErrorMsg("");
      setSuccessMsg("");
      setShowAddForm(!activePeriode);
    }
  }, [isOpen, posyanduId, activePeriode]);

  // Update automatic nama when month/year changes
  const handleBulanYearChange = (newBulan: number, newTahun: number) => {
    setBulan(newBulan);
    setTahun(newTahun);
    setNama(`Pelayanan ${NAMA_BULAN[newBulan - 1]} ${newTahun}`);
  };

  const handleCreatePeriode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!nama.trim() || !tanggal) {
      setErrorMsg("Mohon isi nama periode dan tanggal pelayanan.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await periodeApi.create(posyanduId, {
        nama: nama.trim(),
        bulan,
        tahun,
        tanggal,
        status,
        catatan: catatan.trim() || undefined,
      });

      if (res.success && res.data) {
        setSuccessMsg("Periode pelayanan baru berhasil dibuka!");
        toast.success("Periode pelayanan baru berhasil dibuka!");
        onSelectPeriode(res.data);
        onRefreshPeriode();
        setShowAddForm(false);
        fetchPeriodes();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal membuka periode pelayanan baru.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (p: PeriodePelayanan) => {
    try {
      setErrorMsg("");
      const res = await periodeApi.activate(posyanduId, p.id);
      if (res.success && res.data) {
        onSelectPeriode(res.data);
        onRefreshPeriode();
        const msg = `Periode "${p.nama}" sekarang aktif.`;
        setSuccessMsg(msg);
        toast.success(msg);
        fetchPeriodes();
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mengaktifkan periode pelayanan.";
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nama: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await periodeApi.delete(posyanduId, deleteTarget.id);
      fetchPeriodes();
      onRefreshPeriode();
      const msg = `Periode "${deleteTarget.nama}" berhasil dihapus.`;
      setSuccessMsg(msg);
      toast.success(msg);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      const msg = err.message || "Gagal menghapus periode.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kelola Periode Pelayanan Posyandu"
    >
      <div className="space-y-5">
        {/* Header Summary */}
        <div className="bg-white border border-gray-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Periode Aktif Saat Ini</p>
              <h4 className="font-extrabold text-sm text-gray-900">
                {activePeriode ? activePeriode.nama : "Belum Ada Periode Aktif"}
              </h4>
              {activePeriode ? (
                <p className="text-[11px] text-gray-600 font-medium mt-0.5">
                  Pelaksanaan: <strong className="text-teal-700">{new Date(activePeriode.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong>
                </p>
              ) : (
                <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                  ⚠️ Belum ada periode aktif. Mohon buat periode baru di bawah ini.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setErrorMsg("");
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-all shrink-0 cursor-pointer"
          >
            {showAddForm ? (
              <>
                <X className="w-4 h-4" /> Batal
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Buka Periode Baru
              </>
            )}
          </button>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" /> {successMsg}
          </div>
        )}

        {/* FORM Buka Periode Baru */}
        {showAddForm && (
          <form onSubmit={handleCreatePeriode} className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
              <h5 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5 uppercase tracking-wider">
                <FolderPlus className="w-4 h-4 text-teal-700" /> Form Pembukaan Periode Pelayanan Baru
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Bulan Pelayanan</label>
                <select
                  value={bulan}
                  onChange={(e) => handleBulanYearChange(Number(e.target.value), tahun)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 shadow-2xs"
                >
                  {NAMA_BULAN.map((m, idx) => {
                    const monthNum = idx + 1;
                    const isFuture = tahun > currentYearNum || (tahun === currentYearNum && monthNum > (currentMonthIdx + 1));
                    return (
                      <option key={m} value={monthNum} disabled={isFuture}>
                        {m} {isFuture ? "(Belum Dapat Dibuat)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Tahun</label>
                <select
                  value={tahun}
                  onChange={(e) => {
                    const newYear = Number(e.target.value);
                    const newBulan = newYear === currentYearNum && bulan > (currentMonthIdx + 1) ? (currentMonthIdx + 1) : bulan;
                    handleBulanYearChange(newBulan, newYear);
                  }}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 shadow-2xs"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                    <option key={y} value={y} disabled={y > currentYearNum}>
                      {y} {y > currentYearNum ? "(Masa Mendatang)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Nama Periode</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Pelayanan Agustus 2026"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Tanggal Pelaksanaan Kegiatan</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Status Langsung</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "AKTIF" | "SELESAI")}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 shadow-2xs"
                >
                  <option value="AKTIF">Aktif (Jadikan Periode Kerja Utama)</option>
                  <option value="SELESAI">Selesai (Simpan sebagai riwayat)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Catatan/Keterangan Kegiatan (Opsional)</label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Posyandu Rutin Serentak + Pembagian PMT"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan & Buka Periode"}
              </button>
            </div>
          </form>
        )}

        {/* DAFTAR PERIODE PELAYANAN */}
        <div className="space-y-2.5">
          <h5 className="font-bold text-xs text-gray-500 uppercase tracking-wider">
            Daftar Periode Pelayanan ({periodes.length})
          </h5>

          {isLoading ? (
            <div className="text-center py-6 text-xs text-gray-500 font-medium">Memuat daftar periode...</div>
          ) : periodes.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200/80 p-4">
              <p className="text-xs text-gray-500 font-semibold">Belum ada periode pelayanan yang dibuat.</p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-xs font-bold text-teal-700 hover:underline cursor-pointer"
              >
                + Buka Periode Pelayanan Pertama
              </button>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {periodes.map((p) => {
                const isAktif = p.status === "AKTIF";

                return (
                  <div
                    key={p.id}
                    className={`p-3.5 border rounded-xl flex items-center justify-between transition-all ${
                      isAktif
                        ? "border-teal-500 bg-teal-50/30 ring-1 ring-teal-500/20 shadow-2xs"
                        : "border-gray-200/80 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 border ${
                        isAktif ? "bg-teal-700 text-white border-teal-800" : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h6 className="font-extrabold text-xs text-gray-900">{p.nama}</h6>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isAktif ? "bg-teal-50 text-teal-800 border-teal-200/80" : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}>
                            {isAktif ? "Aktif" : "Selesai"}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                          Pelaksanaan: <span className="font-semibold text-gray-700">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                          {p.catatan ? ` • ${p.catatan}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isAktif ? (
                        <button
                          type="button"
                          onClick={() => handleActivate(p)}
                          className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 hover:text-teal-700 hover:border-teal-300 text-[11px] font-bold rounded-lg transition-all shadow-2xs cursor-pointer"
                        >
                          Pilih / Aktifkan
                        </button>
                      ) : (
                        <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-bold rounded-lg flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-teal-700" /> Sedang Dipilih
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: p.id, nama: p.nama })}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Periode"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Periode */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Konfirmasi Hapus Periode"
        >
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900">
              <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-extrabold text-sm text-red-950">Hapus Periode Pelayanan?</h5>
                <p className="text-xs text-red-800 mt-1 leading-relaxed">
                  Apakah Anda yakin ingin menghapus periode <span className="font-bold underline text-red-950">"{deleteTarget.nama}"</span>?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? "Menghapus..." : "Ya, Hapus Periode"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
