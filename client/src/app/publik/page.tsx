"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Building2,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  Printer,
  RotateCcw,
  ArrowRight,
  Loader2,
  FileText,
  ClipboardCheck,
  Shield,
} from "lucide-react";
import PageHelmet from "@/components/PageHelmet";
import { publicPuskesmasApi, PublicNikCheckResult } from "@/lib/api";

export default function PortalPublikPage() {
  const [nikInput, setNikInput] = useState("");
  const [tanggalLahirInput, setTanggalLahirInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [result, setResult] = useState<PublicNikCheckResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent, customNik?: string, customTgl?: string) => {
    if (e) e.preventDefault();
    const queryNik = (customNik !== undefined ? customNik : nikInput).trim().replace(/[^0-9]/g, "");
    const queryTgl = customTgl !== undefined ? customTgl : tanggalLahirInput;

    if (!queryNik) {
      setErrorMessage("Silakan masukkan Nomor Induk Kependudukan (NIK).");
      return;
    }

    if (queryNik.length < 8) {
      setErrorMessage("Nomor NIK harus berupa minimal 8 digit angka.");
      return;
    }

    if (!queryTgl || !queryTgl.trim()) {
      setErrorMessage("Silakan masukkan Tanggal Lahir untuk memverifikasi data.");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await publicPuskesmasApi.cekNik(queryNik, queryTgl.trim());
      setResult(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal memproses data. Silakan coba kembali.");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (demoNik: string, demoTgl?: string) => {
    setNikInput(demoNik);
    if (demoTgl) setTanggalLahirInput(demoTgl);
    handleSearch(undefined, demoNik, demoTgl);
  };

  const handleReset = () => {
    setNikInput("");
    setTanggalLahirInput("");
    setResult(null);
    setHasSearched(false);
    setErrorMessage(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <PageHelmet
        title="Portal Publik — Pelayanan Posyandu"
        description="Portal publik resmi untuk memeriksa catatan riwayat pemeriksaan kesehatan Balita & Lansia perorangan."
      />

      {/* Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs shrink-0">
              <img src="/logo.svg" alt="Logo SIIP" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm leading-none">SIIP</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-semibold text-teal-800">Portal Publik</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sistem Informasi Posyandu &amp; Pelayanan Warga
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/puskesmas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Portal Puskesmas</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 space-y-6">
        {/* Search Card */}
        <section className="print:hidden bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-xs mb-1.5">
              <Shield className="w-4 h-4 text-teal-700" />
              <span>Layanan Mandiri Warga</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Pengecekan Data Pemeriksaan Posyandu
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              Masukkan Nomor Induk Kependudukan (NIK) Balita atau Lansia yang terdaftar di Posyandu untuk melihat riwayat tumbuh kembang dan hasil pemeriksaan.
            </p>
          </div>

          {/* Form Pencarian */}
          <form onSubmit={handleSearch} className="mt-6 max-w-xl space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nomor Induk Kependudukan (NIK) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={16}
                  required
                  value={nikInput}
                  onChange={(e) => {
                    setNikInput(e.target.value.replace(/[^0-9]/g, ""));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Contoh: 3216011203240001"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Tanggal Lahir <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={tanggalLahirInput}
                  onChange={(e) => {
                    setTanggalLahirInput(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition-colors"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Kombinasi NIK dan Tanggal Lahir diperlukan untuk verifikasi identitas dan perlindungan privasi data kesehatan.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-900 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengecek Data...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Cari Data Pemeriksaan</span>
                  </>
                )}
              </button>

              {/* Quick Sample Links */}
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="text-slate-400">Contoh data:</span>
                <button
                  type="button"
                  onClick={() => handleQuickDemo("3216011203240001", "2024-03-12")}
                  className="text-teal-700 hover:text-teal-900 underline font-medium cursor-pointer"
                >
                  Balita
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleQuickDemo("3216011405520001", "1952-05-14")}
                  className="text-teal-700 hover:text-teal-900 underline font-medium cursor-pointer"
                >
                  Lansia
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* RESULTS AREA */}
        {isLoading && (
          <div className="bg-white rounded-xl p-10 border border-slate-200 text-center shadow-xs">
            <Loader2 className="w-8 h-8 text-teal-700 animate-spin mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-slate-800">Sedang memeriksa data pemeriksaan...</p>
            <p className="text-xs text-slate-500 mt-0.5">Mencari rekaman pada basis data Posyandu</p>
          </div>
        )}

        {!isLoading && hasSearched && !result && (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center shadow-xs max-w-lg mx-auto">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-500">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Data Pemeriksaan Tidak Ditemukan
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Nomor NIK yang dimasukkan belum terdaftar pada sistem pemeriksaan Posyandu, atau tanggal lahir verifikasi tidak cocok.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Petunjuk:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Periksa kembali nomor NIK pada Kartu Keluarga (KK) atau KTP.</li>
                <li>Pastikan warga telah terdaftar dalam kegiatan Posyandu setempat.</li>
              </ul>
            </div>
            <button
              onClick={handleReset}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba Kembali</span>
            </button>
          </div>
        )}

        {!isLoading && result && (
          <div className="space-y-6">
            {/* Header Result Bar */}
            <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-xs text-slate-600">
                Hasil pencarian untuk NIK: <strong className="text-slate-900 font-semibold">{result.maskedNik}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak PDF</span>
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pencarian Baru</span>
                </button>
              </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-4 border-b pb-3 text-center">
              <h2 className="text-base font-bold">SISTEM INFORMASI POSYANDU (SIIP)</h2>
              <p className="text-xs text-gray-600">Kartu Hasil Pemeriksaan Kesehatan Perorangan</p>
            </div>

            {/* Identitas Pasien */}
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-semibold text-teal-800">Kategori {result.kategori}</span>
                    <span>·</span>
                    <span>NIK: {result.maskedNik}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {result.nama}
                  </h2>
                  {result.namaIbu && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nama Ibu: <span className="text-slate-700 font-medium">{result.namaIbu}</span>
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-500 block">Usia</span>
                  <span className="text-sm font-bold text-slate-900">
                    {result.usiaDeskripsi}
                  </span>
                </div>
              </div>

              {/* Rincian Identitas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Jenis Kelamin</span>
                  <span className="font-medium text-slate-800">
                    {result.jenisKelamin === "L" ? "Laki-laki" : "Perempuan"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Tanggal Lahir</span>
                  <span className="font-medium text-slate-800">
                    {new Date(result.tanggalLahir).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Posyandu</span>
                  <span className="font-medium text-slate-800">
                    {result.posyandu.nama}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Wilayah</span>
                  <span className="font-medium text-slate-800">
                    Desa {result.posyandu.desa}, Kec. {result.posyandu.kecamatan}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Kesehatan Terkini */}
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Status Pemeriksaan Terakhir
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kesimpulan kondisi kesehatan pada pemeriksaan terbaru
                    </p>
                  </div>
                </div>

                {result.ringkasanKesehatan.tanggalPeriksaTerakhir && (
                  <span className="text-xs text-slate-500">
                    Tanggal: {new Date(result.ringkasanKesehatan.tanggalPeriksaTerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-lg border text-xs sm:text-sm leading-relaxed ${
                  result.ringkasanKesehatan.statusType === "danger"
                    ? "bg-red-50 border-red-200 text-red-900"
                    : result.ringkasanKesehatan.statusType === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-teal-50 border-teal-200 text-teal-950"
                }`}
              >
                <div className="font-bold mb-1">
                  Kondisi: {result.ringkasanKesehatan.statusUtama}
                </div>
                <div className="text-xs opacity-90">
                  {result.ringkasanKesehatan.pesanEdukasi}
                </div>
              </div>

              {/* Parameter Pengukuran Terakhir */}
              {result.pemeriksaanTerakhir && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {result.kategori === "Balita" ? (
                    <>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Berat Badan</span>
                        <p className="text-base font-bold text-slate-900 mt-0.5">
                          {result.pemeriksaanTerakhir.beratBadan} kg
                        </p>
                        <span className="text-[11px] text-slate-600 block mt-0.5">
                          BB/U: {result.pemeriksaanTerakhir.statusBbU || "-"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Tinggi / Panjang</span>
                        <p className="text-base font-bold text-slate-900 mt-0.5">
                          {result.pemeriksaanTerakhir.tinggiBadan} cm
                        </p>
                        <span className="text-[11px] text-slate-600 block mt-0.5">
                          TB/U: {result.pemeriksaanTerakhir.statusTbU || "-"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Lingkar Fisik</span>
                        <p className="text-xs font-semibold text-slate-800 mt-1">
                          LK: {result.pemeriksaanTerakhir.lingkarKepala || "-"} cm
                        </p>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                          LiLA: {result.pemeriksaanTerakhir.lingkarLengan || "-"} cm
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Imunisasi / Vit A</span>
                        <p className="text-xs font-semibold text-slate-800 mt-1">
                          {result.pemeriksaanTerakhir.statusImunisasi || "Sesuai Usia"}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Vit A: {result.pemeriksaanTerakhir.vitaminA ? "Diberikan" : "Tidak"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Tekanan Darah (Tensi)</span>
                        <p className="text-base font-bold text-slate-900 mt-0.5">
                          {result.pemeriksaanTerakhir.tekananDarah || `${result.pemeriksaanTerakhir.tekananDarahSistol}/${result.pemeriksaanTerakhir.tekananDarahDiastol} mmHg`}
                        </p>
                        <span className="text-[11px] text-slate-600 block mt-0.5">
                          {result.pemeriksaanTerakhir.statusTensi || "Normal"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Gula Darah Sewaktu</span>
                        <p className="text-base font-bold text-slate-900 mt-0.5">
                          {result.pemeriksaanTerakhir.gulaDarahSewaktu} mg/dL
                        </p>
                        <span className="text-[11px] text-slate-600 block mt-0.5">
                          {result.pemeriksaanTerakhir.statusGula || "Normal"}
                        </span>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">BB / TB</span>
                        <p className="text-xs font-semibold text-slate-800 mt-1">
                          {result.pemeriksaanTerakhir.beratBadan} kg / {result.pemeriksaanTerakhir.tinggiBadan} cm
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          LP: {result.pemeriksaanTerakhir.lingkarPerut ? `${result.pemeriksaanTerakhir.lingkarPerut} cm` : "-"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                        <span className="text-[11px] text-slate-500 block">Kolesterol / Asam Urat</span>
                        <p className="text-xs font-semibold text-slate-800 mt-1">
                          Kol: {result.pemeriksaanTerakhir.kolesterol ? `${result.pemeriksaanTerakhir.kolesterol} mg/dL` : "-"}
                        </p>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                          AU: {result.pemeriksaanTerakhir.asamUrat ? `${result.pemeriksaanTerakhir.asamUrat} mg/dL` : "-"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Riwayat Pemeriksaan Berkala */}
            <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Riwayat Pemeriksaan Berkala
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data pemeriksaan Posyandu yang tercatat dari waktu ke waktu
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {result.riwayatPemeriksaan.length} Pemeriksaan
                </span>
              </div>

              {result.riwayatPemeriksaan.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Belum ada catatan riwayat pemeriksaan tersimpan.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-5 sm:mx-0">
                  <table className="w-full text-xs text-left border-collapse min-w-[550px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                        <th className="py-2.5 px-3 font-semibold">Tanggal</th>
                        {result.kategori === "Balita" ? (
                          <>
                            <th className="py-2.5 px-3 font-semibold">Usia</th>
                            <th className="py-2.5 px-3 font-semibold">Berat (kg)</th>
                            <th className="py-2.5 px-3 font-semibold">Tinggi (cm)</th>
                            <th className="py-2.5 px-3 font-semibold">Status Gizi</th>
                            <th className="py-2.5 px-3 font-semibold">Imunisasi</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2.5 px-3 font-semibold">Tensi</th>
                            <th className="py-2.5 px-3 font-semibold">Gula Darah</th>
                            <th className="py-2.5 px-3 font-semibold">BB / TB</th>
                            <th className="py-2.5 px-3 font-semibold">Keluhan / Tindakan</th>
                          </>
                        )}
                        <th className="py-2.5 px-3 font-semibold">Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.riwayatPemeriksaan.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                            {new Date(item.tanggalPeriksa).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>

                          {result.kategori === "Balita" ? (
                            <>
                              <td className="py-2.5 px-3 text-slate-600">
                                {item.usiaBulan ? `${item.usiaBulan} bln` : "-"}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {item.beratBadan}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {item.tinggiBadan}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {item.statusTbU || item.statusBbU || "Normal"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {item.statusImunisasi || (item.vitaminA ? "Vit A" : "-")}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {item.tekananDarah || `${item.tekananDarahSistol}/${item.tekananDarahDiastol}`}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800">
                                {item.gulaDarahSewaktu ? `${item.gulaDarahSewaktu} mg/dL` : "-"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {item.beratBadan} kg / {item.tinggiBadan} cm
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={item.keluhan || item.tindakan || ""}>
                                {item.keluhan || item.tindakan || "-"}
                              </td>
                            </>
                          )}

                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {item.petugas || "Kader Posyandu"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="print:hidden flex items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-500">
                Informasi lebih lanjut dapat dikonsultasikan dengan kader Posyandu {result.posyandu.nama}.
              </span>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Ringkasan</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            SIIP © 2026 · Sistem Informasi Posyandu · Portal Publik
          </span>
          <div className="flex items-center gap-4">
            <Link href="/puskesmas" className="hover:text-teal-800 font-medium transition-colors">
              Portal Puskesmas
            </Link>
            <Link href="/" className="hover:text-teal-800 font-medium transition-colors">
              Aplikasi Posyandu
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
