"use client";

import React, { useState } from "react";
import { ItemRiwayat } from "@/lib/api";
import { RekapanBalita, extractPemberianLain } from "../types";
import BalitaIcon from "@/components/BalitaIcon";
import Pagination from "@/components/Pagination";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Scale,
  ShieldCheck,
  Users,
  AlertCircle,
  Search,
} from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";
import {
  normalizeStatusBbUCode,
  normalizeStatusTbUCode,
  normalizeStatusBbTbCode,
  getStatusBbUText,
  getStatusTbUText,
  getStatusBbTbText,
} from "@/lib/zScoreCalculator";

interface BalitaLaporanViewProps {
  rekapanBalita: RekapanBalita | null;
  filteredBalitaLogs: ItemRiwayat[];
  pageBalita: number;
  setPageBalita: React.Dispatch<React.SetStateAction<number>>;
  pageSizeBalita: number;
  setPageSizeBalita: (size: number) => void;
  searchBalita: string;
  setSearchBalita: (search: string) => void;
  onNavigate?: (module: string, itemId?: string) => void;
  onSelectLog?: (log: ItemRiwayat) => void;
  triggerKey?: string | number;
  isUpdating?: boolean;
  isPublic?: boolean;
}

export default function BalitaLaporanView({
  rekapanBalita,
  filteredBalitaLogs,
  pageBalita,
  setPageBalita,
  pageSizeBalita,
  setPageSizeBalita,
  searchBalita,
  setSearchBalita,
  onNavigate,
  onSelectLog,
  triggerKey,
  isUpdating,
  isPublic = false,
}: BalitaLaporanViewProps) {
  const totalPages = Math.max(1, Math.ceil(filteredBalitaLogs.length / pageSizeBalita));

  // State Pagination & Search untuk Tier 4 (Balita Perlu Perhatian)
  const [pageTier4, setPageTier4] = useState<number>(1);
  const [pageSizeTier4, setPageSizeTier4] = useState<number>(10);
  const [searchTier4, setSearchTier4] = useState<string>("");

  const rawTier4List = rekapanBalita?.balitaPerluPerhatianList || [];
  const filteredTier4List = rawTier4List.filter((item) => {
    if (!searchTier4.trim()) return true;
    const query = searchTier4.toLowerCase();
    return (
      item.nama.toLowerCase().includes(query) ||
      item.masalah.some((m) => m.toLowerCase().includes(query)) ||
      item.saran.toLowerCase().includes(query)
    );
  });
  const totalPagesTier4 = Math.max(1, Math.ceil(filteredTier4List.length / pageSizeTier4));
  const paginatedTier4List = filteredTier4List.slice(
    (pageTier4 - 1) * pageSizeTier4,
    pageTier4 * pageSizeTier4
  );

  return (
    <div className={`bg-white rounded-xl border border-gray-200/80 p-5 shadow-2xs space-y-5 transition-all duration-300 ${
      isUpdating ? "opacity-75" : "opacity-100"
    }`}>
      {/* Header & Cakupan Keseluruhan */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-saas-dark tracking-tight">Ringkasan Rekapan Balita</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
              {rekapanBalita?.periode || "Semua Periode"}
            </span>
          </div>
          <p className="text-xs text-saas-muted mt-1 font-medium flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-700">
              <AnimatedNumber value={rekapanBalita?.totalTerdaftar || 0} triggerKey={triggerKey} /> Terdaftar
            </span>
            <span>•</span>
            <span className="font-bold text-teal-700">
              <AnimatedNumber value={rekapanBalita?.totalAnak || 0} triggerKey={triggerKey} /> Diperiksa
            </span>
            <span>•</span>
            <span>
              Cakupan <strong className="text-gray-900"><AnimatedNumber value={rekapanBalita?.cakupanPersen || 0} decimals={1} suffix="%" triggerKey={triggerKey} /></strong>
            </span>
            <span>•</span>
            <span className="text-amber-700 font-semibold">
              <AnimatedNumber value={rekapanBalita?.tidakHadir || 0} triggerKey={triggerKey} /> Tidak Hadir
            </span>
          </p>
        </div>
        <div className="text-xs font-semibold text-saas-muted bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-lg w-fit">
          Total Data: <strong className="text-saas-dark font-extrabold"><AnimatedNumber value={filteredBalitaLogs.length} triggerKey={triggerKey} /></strong> Pemeriksaan (<AnimatedNumber value={rekapanBalita?.totalAnak || 0} triggerKey={triggerKey} /> Anak)
        </div>
      </div>

      {/* Tier 1 - KPI Utama (5 Card KPI Grid) */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-saas-muted uppercase tracking-wider">Tier 1 — Indikator Kunci &amp; Kasus Prioritas</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Total Diperiksa */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-teal-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Total Diperiksa</span>
              <div className="w-7 h-7 rounded-md bg-teal-50 text-saas-primary flex items-center justify-center shrink-0 border border-teal-100">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                <AnimatedNumber value={rekapanBalita?.totalAnak || 0} triggerKey={triggerKey} /> <span className="text-sm font-semibold text-gray-500">Anak</span>
              </div>
              <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/60 inline-block">
                <AnimatedNumber value={rekapanBalita?.totalPemeriksaan || 0} triggerKey={triggerKey} /> Kali Pemeriksaan
              </span>
            </div>
          </div>

          {/* Cakupan Pemeriksaan */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Cakupan Periksa</span>
              <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                <AnimatedNumber value={rekapanBalita?.cakupanPersen || 0} decimals={1} suffix="%" triggerKey={triggerKey} />
              </div>
              <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 inline-block">
                <AnimatedNumber value={rekapanBalita?.totalAnak || 0} triggerKey={triggerKey} /> dari {rekapanBalita?.totalTerdaftar || 0} Terdaftar
              </span>
            </div>
          </div>

          {/* Balita Perlu Tindak Lanjut */}
          <div className="bg-white border border-rose-200/90 rounded-xl p-4 shadow-2xs hover:border-rose-300 transition-all flex flex-col justify-between bg-rose-50/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Perlu Tindak Lanjut</span>
              <div className="w-7 h-7 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-rose-700 tracking-tight">
                <AnimatedNumber value={rekapanBalita?.perluTindakLanjut || 0} triggerKey={triggerKey} /> <span className="text-sm font-semibold text-rose-600">Anak</span>
              </div>
              <span className={`mt-1 px-2 py-0.5 rounded text-[10px] font-bold border inline-block ${
                (rekapanBalita?.perluTindakLanjut || 0) > 0
                  ? "bg-rose-50 text-rose-800 border-rose-200/70"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200/70"
              }`}>
                {(rekapanBalita?.perluTindakLanjut || 0) > 0 ? "Prioritas Pantauan Kader" : "Kondisi Terkendali"}
              </span>
            </div>
          </div>

          {/* Kasus Stunting (TB/U) */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Kasus Stunting (TB/U)</span>
              <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                <BalitaIcon className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                <AnimatedNumber value={rekapanBalita?.kasusStunting || 0} triggerKey={triggerKey} /> <span className="text-sm font-semibold text-gray-500">Anak</span>
              </div>
              <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200/60 inline-block">
                <AnimatedNumber
                  value={rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? (rekapanBalita.kasusStunting / rekapanBalita.totalPemeriksaan) * 100 : 0}
                  decimals={1}
                  suffix="%"
                  triggerKey={triggerKey}
                /> Pendek &amp; S. Pendek
              </span>
            </div>
          </div>

          {/* Kasus Wasting (BB/TB) */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs hover:border-amber-300 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">Kasus Wasting (BB/TB)</span>
              <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <Activity className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-saas-dark tracking-tight">
                <AnimatedNumber value={rekapanBalita?.kasusWasting || 0} triggerKey={triggerKey} /> <span className="text-sm font-semibold text-gray-500">Anak</span>
              </div>
              <span className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 inline-block">
                <AnimatedNumber
                  value={rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? (rekapanBalita.kasusWasting / rekapanBalita.totalPemeriksaan) * 100 : 0}
                  decimals={1}
                  suffix="%"
                  triggerKey={triggerKey}
                /> Kurus &amp; Gizi Buruk
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 2 - Status Gizi & Antropometri */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <div>
          <h4 className="text-xs font-bold text-saas-muted uppercase tracking-wider">Tier 2 — Status Gizi &amp; Antropometri (Standar Kemenkes / WHO)</h4>
          <p className="text-[11px] text-gray-500">Evaluasi terpilah 3 pilar antropometri balita untuk diagnosis yang akurat</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kolom 1: BB/U */}
          <div className="bg-gray-50/50 border border-gray-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <div>
                <span className="text-xs font-extrabold text-gray-900 tracking-tight">BB/U (Berat menurut Umur)</span>
                <p className="text-[10px] text-gray-500">Indikator Berat Badan / Underweight</p>
              </div>
              <Scale className="w-4 h-4 text-saas-primary" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Normal
                </span>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{rekapanBalita?.statusBbU.normal || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbU.normal / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Kurang (Underweight)
                </span>
                <div className="text-right">
                  <span className="font-bold text-amber-700">{rekapanBalita?.statusBbU.kurang || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbU.kurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Sangat Kurang (Severely)
                </span>
                <div className="text-right">
                  <span className="font-bold text-red-700">{rekapanBalita?.statusBbU.sangatKurang || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbU.sangatKurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Risiko BB Lebih
                </span>
                <div className="text-right">
                  <span className="font-bold text-blue-700">{rekapanBalita?.statusBbU.lebih || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbU.lebih / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom 2: TB/U */}
          <div className="bg-gray-50/50 border border-gray-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <div>
                <span className="text-xs font-extrabold text-gray-900 tracking-tight">TB/U (Tinggi menurut Umur)</span>
                <p className="text-[10px] text-gray-500">Indikator Stunting Kronis</p>
              </div>
              <BalitaIcon className="w-4 h-4 text-purple-600" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Normal
                </span>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{rekapanBalita?.statusTbU.normal || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusTbU.normal / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pendek (Stunted)
                </span>
                <div className="text-right">
                  <span className="font-bold text-amber-700">{rekapanBalita?.statusTbU.pendek || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusTbU.pendek / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Sangat Pendek (Severely)
                </span>
                <div className="text-right">
                  <span className="font-bold text-red-700">{rekapanBalita?.statusTbU.sangatPendek || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusTbU.sangatPendek / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  Tinggi
                </span>
                <div className="text-right">
                  <span className="font-bold text-teal-700">{rekapanBalita?.statusTbU.tinggi || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusTbU.tinggi / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Kolom 3: BB/TB */}
          <div className="bg-gray-50/50 border border-gray-200/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
              <div>
                <span className="text-xs font-extrabold text-gray-900 tracking-tight">BB/TB (Berat menurut Tinggi)</span>
                <p className="text-[10px] text-gray-500">Indikator Wasting / Gizi Akut</p>
              </div>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Gizi Baik (Normal)
                </span>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{rekapanBalita?.statusBbTb.normal || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbTb.normal / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Gizi Kurang (Wasted)
                </span>
                <div className="text-right">
                  <span className="font-bold text-amber-700">{rekapanBalita?.statusBbTb.kurang || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbTb.kurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Gizi Buruk (Severe Wasted)
                </span>
                <div className="text-right">
                  <span className="font-bold text-red-700">{rekapanBalita?.statusBbTb.sangatKurang || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbTb.sangatKurang / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Gizi Lebih / Gemuk
                </span>
                <div className="text-right">
                  <span className="font-bold text-blue-700">{rekapanBalita?.statusBbTb.lebih || 0}</span>
                  <span className="text-[10px] text-gray-500 ml-1.5">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.statusBbTb.lebih / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 3 - Pelayanan Kesehatan & Distribusi Usia */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        {/* Pelayanan Kesehatan */}
        <div className="bg-white border border-gray-200/80 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h4 className="text-xs font-bold text-saas-dark uppercase tracking-wider">Tier 3 — Cakupan Pelayanan Kesehatan</h4>
              <p className="text-[11px] text-gray-500">Persentase balita yang menerima intervensi kesehatan</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-saas-primary" />
          </div>

          <div className="space-y-3 text-xs">
            {/* Imunisasi */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">Imunisasi Lengkap</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.imunisasiLengkap || 0} / {rekapanBalita?.totalPemeriksaan || 0}{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.imunisasiLengkap / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.imunisasiLengkap / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Vitamin A */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">Vitamin A</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.vitaminA || 0} / {rekapanBalita?.totalPemeriksaan || 0}{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.vitaminA / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-rose-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.vitaminA / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Obat Cacing */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">Obat Cacing</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.obatCacing || 0} / {rekapanBalita?.totalPemeriksaan || 0}{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.obatCacing / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.obatCacing / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* ASI Eksklusif */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-700">ASI Eksklusif (Usia 0–6 Bln)</span>
                  <span className="text-[10px] text-gray-400" title="Dihitung proporsional terhadap bayi usia 0-6 bulan">*</span>
                </div>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.asiEksklusif || 0} / {rekapanBalita?.totalBayiAsiEligible || 0}{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalBayiAsiEligible > 0 ? ((rekapanBalita.asiEksklusif / rekapanBalita.totalBayiAsiEligible) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalBayiAsiEligible > 0 ? Math.min(100, (rekapanBalita.asiEksklusif / rekapanBalita.totalBayiAsiEligible) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 italic">
                * Proporsional terhadap {rekapanBalita?.totalBayiAsiEligible || 0} bayi kelompok usia 0–6 bulan
              </p>
            </div>
          </div>
        </div>

        {/* Distribusi Kelompok Usia */}
        <div className="bg-white border border-gray-200/80 rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div>
              <h4 className="text-xs font-bold text-saas-dark uppercase tracking-wider">Distribusi Kelompok Usia</h4>
              <p className="text-[11px] text-gray-500">Segmentasi usia balita yang hadir dalam posyandu</p>
            </div>
            <Users className="w-4 h-4 text-saas-primary" />
          </div>

          <div className="space-y-3 text-xs">
            {/* 0–6 Bulan */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">0–6 Bulan (Bayi)</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.distribusiUsia.u0_6 || 0} Anak{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.distribusiUsia.u0_6 / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.distribusiUsia.u0_6 / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* 7–12 Bulan */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">7–12 Bulan (Baduta Awal)</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.distribusiUsia.u7_12 || 0} Anak{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.distribusiUsia.u7_12 / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.distribusiUsia.u7_12 / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* 13–24 Bulan */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">13–24 Bulan (Baduta)</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.distribusiUsia.u13_24 || 0} Anak{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.distribusiUsia.u13_24 / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.distribusiUsia.u13_24 / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* 25–60 Bulan */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-700">25–60 Bulan (Prasekolah)</span>
                <span className="font-bold text-gray-900">
                  {rekapanBalita?.distribusiUsia.u25_60 || 0} Anak{" "}
                  <span className="text-gray-500 font-normal">
                    ({rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? ((rekapanBalita.distribusiUsia.u25_60 / rekapanBalita.totalPemeriksaan) * 100).toFixed(1) : 0}%)
                  </span>
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${rekapanBalita && rekapanBalita.totalPemeriksaan > 0 ? Math.min(100, (rekapanBalita.distribusiUsia.u25_60 / rekapanBalita.totalPemeriksaan) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 4 - ⚠️ Balita Perlu Tindak Lanjut */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Tier 4 — Balita Perlu Tindak Lanjut &amp; Perhatian Khusus
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                <AnimatedNumber value={rekapanBalita?.balitaPerluPerhatianList?.length || 0} triggerKey={triggerKey} /> Kasus
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Balita yang terindikasi masalah antropometri (stunting, wasting, underweight, atau risiko obesitas) untuk segera ditindaklanjuti kader / bidan
            </p>
          </div>
        </div>

        {rawTier4List.length > 0 ? (
          <div className="space-y-4">
            {/* Toolbar Tier 4 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <span className="text-xs font-bold text-gray-700">
                Daftar Kasus Memerlukan Perhatian ({filteredTier4List.length} dari {rawTier4List.length})
              </span>
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-600 flex items-center gap-1.5">
                  <span>Tampilkan</span>
                  <select
                    value={pageSizeTier4}
                    onChange={(e) => {
                      setPageSizeTier4(Number(e.target.value));
                      setPageTier4(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-rose-600"
                  >
                    <option value={5} className="text-gray-900">5</option>
                    <option value={10} className="text-gray-900">10</option>
                    <option value={25} className="text-gray-900">25</option>
                    <option value={50} className="text-gray-900">50</option>
                  </select>
                  <span>data</span>
                </div>
                <div className="relative w-48 sm:w-60">
                  <input
                    type="text"
                    placeholder="Cari kasus balita..."
                    value={searchTier4}
                    onChange={(e) => {
                      setSearchTier4(e.target.value);
                      setPageTier4(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-600 bg-white text-gray-900"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            {/* Tabel Tier 4 */}
            <div className="border border-rose-200/80 rounded-xl overflow-hidden bg-rose-50/20 shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-rose-100/50 text-rose-950 font-bold border-b border-rose-200/70">
                      <th className="px-3.5 py-2.5">Nama Balita</th>
                      <th className="px-3.5 py-2.5">Usia</th>
                      <th className="px-3.5 py-2.5">Indikasi Masalah Gizi</th>
                      <th className="px-3.5 py-2.5">Tanggal Periksa</th>
                      <th className="px-3.5 py-2.5">Rekomendasi Tindak Lanjut</th>
                      <th className="px-3.5 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-100/70 bg-white">
                    {filteredTier4List.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-gray-500 font-medium">
                          Tidak ada data kasus yang sesuai dengan pencarian.
                        </td>
                      </tr>
                    ) : (
                      paginatedTier4List.map((item) => (
                        <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                          <td className="px-3.5 py-2.5 font-bold text-gray-900">
                            {item.nama}
                          </td>
                          <td className="px-3.5 py-2.5 text-gray-600">
                            {item.usia}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {item.masalah.map((m, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 text-gray-600">
                            {item.tanggal}
                          </td>
                          <td className="px-3.5 py-2.5 text-gray-700 font-medium">
                            {item.saran}
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            {onSelectLog ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const found = filteredBalitaLogs.find((l) => l.id === item.id || l.pasienId === item.pasienId);
                                  if (found) onSelectLog(found);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                              >
                                Lihat Detail
                              </button>
                            ) : onNavigate && item.pasienId ? (
                              <button
                                type="button"
                                onClick={() => onNavigate("balita", item.pasienId)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                              >
                                Buka Profil
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Tier 4 */}
            <Pagination
              currentPage={pageTier4}
              totalPages={totalPagesTier4}
              pageSize={pageSizeTier4}
              totalItems={filteredTier4List.length}
              onPageChange={setPageTier4}
            />
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Kondisi Baik: Tidak Ditemukan Kasus Masalah Pertumbuhan</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Semua balita yang diperiksa pada periode ini memiliki status gizi normal dan tidak terdeteksi indikasi stunting atau wasting.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Detail Data Pemeriksaan Table */}
      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h4 className="text-base font-bold text-gray-900">
            Detail Data Pemeriksaan Balita
          </h4>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600 flex items-center gap-1.5">
              <span>Tampilkan</span>
              <select
                value={pageSizeBalita}
                onChange={(e) => {
                  setPageSizeBalita(Number(e.target.value));
                  setPageBalita(1);
                }}
                className="px-2 py-1 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                <option value={10} className="text-gray-900">10</option>
                <option value={25} className="text-gray-900">25</option>
                <option value={50} className="text-gray-900">50</option>
                <option value={100} className="text-gray-900">100</option>
              </select>
              <span>data</span>
            </div>
            <div className="relative w-48 sm:w-60">
              <input
                type="text"
                placeholder="Cari nama balita..."
                value={searchBalita}
                onChange={(e) => {
                  setSearchBalita(e.target.value);
                  setPageBalita(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 bg-white text-gray-900"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">No</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Nama Balita</th>
                {!isPublic && (
                  <>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Tanggal Lahir</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">NIK</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Nama Ibu</th>
                  </>
                )}
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">JK</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Usia</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">BB (kg)</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">TB (cm)</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">BB/U</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">TB/U</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">BB/TB</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">LK (cm)</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">LiLA (cm)</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Pemberian Lain</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">B1</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">B6</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">ASI SKS</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Vitamin A</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-gray-700 whitespace-nowrap">Obat Cacing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredBalitaLogs.length === 0 ? (
                <tr>
                  <td colSpan={isPublic ? 17 : 20} className="py-8 text-center text-xs text-gray-500 font-medium">
                    Tidak ada catatan pemeriksaan Balita yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredBalitaLogs
                  .slice((pageBalita - 1) * pageSizeBalita, pageBalita * pageSizeBalita)
                  .map((log, idx) => {
                    let usiaBlnNum: number | undefined = log.usiaBulan;
                    let usiaStr = "-";
                    if (log.tanggalLahir) {
                      const lahir = new Date(log.tanggalLahir);
                      const periksa = log.tanggal ? new Date(log.tanggal) : new Date();
                      usiaBlnNum = Math.max(
                        0,
                        (periksa.getFullYear() - lahir.getFullYear()) * 12 +
                          (periksa.getMonth() - lahir.getMonth())
                      );
                      usiaStr = `${usiaBlnNum} bln`;
                    } else if (log.usiaBulan !== undefined) {
                      usiaStr = `${log.usiaBulan} bln`;
                    }

                    const rawBbU = log.statusBbU || (log as any).statusBBU;
                    const rawTbU = log.statusTbU || (log as any).statusTBU;
                    const rawBbTb = log.statusBbTb || (log as any).statusBBTB;

                    const codeBbU = normalizeStatusBbUCode(rawBbU, log.beratBadan, usiaBlnNum, log.jenisKelamin);
                    const codeTbU = normalizeStatusTbUCode(rawTbU, log.tinggiBadan, usiaBlnNum, log.jenisKelamin);
                    const codeBbTb = normalizeStatusBbTbCode(rawBbTb, log.beratBadan, log.tinggiBadan, log.jenisKelamin);

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-2.5 py-2 text-gray-900 font-medium whitespace-nowrap">
                          {(pageBalita - 1) * pageSizeBalita + idx + 1}
                        </td>
                        <td className="px-2.5 py-2 text-gray-900 font-bold whitespace-nowrap">
                          {onSelectLog ? (
                            <button
                              type="button"
                              onClick={() => onSelectLog(log)}
                              className="text-gray-900 font-bold hover:text-teal-600 hover:underline text-left transition-colors cursor-pointer"
                              title={`Lihat Detail ${log.nama}`}
                            >
                              {log.nama || "-"}
                            </button>
                          ) : onNavigate && log.pasienId ? (
                            <button
                              type="button"
                              onClick={() => onNavigate("Balita", log.pasienId)}
                              className="text-gray-900 font-bold hover:text-teal-600 hover:underline text-left transition-colors cursor-pointer"
                              title={`Lihat Profil ${log.nama}`}
                            >
                              {log.nama || "-"}
                            </button>
                          ) : (
                            <span>{log.nama || "-"}</span>
                          )}
                        </td>
                        {!isPublic && (
                          <>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.tanggalLahir || "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.nik || "-"}</td>
                            <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.namaIbu || "-"}</td>
                          </>
                        )}
                        <td className="px-2.5 py-2 text-gray-600 font-semibold whitespace-nowrap">{log.jenisKelamin || "-"}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{usiaStr}</td>
                        <td className="px-2.5 py-2 text-gray-900 font-bold whitespace-nowrap">{log.beratBadan ?? "-"}</td>
                        <td className="px-2.5 py-2 text-gray-900 font-bold whitespace-nowrap">{log.tinggiBadan ?? "-"}</td>
                        <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            codeBbU === "N" ? "bg-emerald-100 text-emerald-800" :
                            codeBbU === "K" ? "bg-amber-100 text-amber-800" :
                            codeBbU === "SK" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {getStatusBbUText(codeBbU)}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            codeTbU === "N" ? "bg-emerald-100 text-emerald-800" :
                            codeTbU === "P" ? "bg-purple-100 text-purple-800" :
                            codeTbU === "SP" ? "bg-red-100 text-red-800" : "bg-teal-100 text-teal-800"
                          }`}>
                            {getStatusTbUText(codeTbU)}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-gray-700 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            codeBbTb === "N" ? "bg-emerald-100 text-emerald-800" :
                            codeBbTb === "K" ? "bg-amber-100 text-amber-800" :
                            codeBbTb === "SK" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                          }`}>
                            {getStatusBbTbText(codeBbTb)}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.lingkarKepala ?? "-"}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.lingkarLengan ?? "-"}</td>
                        <td className="px-2.5 py-2 text-gray-900 font-medium whitespace-nowrap">{extractPemberianLain(log.statusImunisasi)}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.vitB1 ? "Ya" : "Tdk"}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.vitB6 ? "Ya" : "Tdk"}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.asiEksklusif ? "Ya" : "Tdk"}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.vitaminA ? "Ya" : "Tdk"}</td>
                        <td className="px-2.5 py-2 text-gray-600 whitespace-nowrap">{log.obatCacing ? "Ya" : "Tdk"}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={pageBalita}
          totalPages={totalPages}
          pageSize={pageSizeBalita}
          totalItems={filteredBalitaLogs.length}
          onPageChange={setPageBalita}
          onPageSizeChange={(newSize) => {
            setPageSizeBalita(newSize);
            setPageBalita(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>
    </div>
  );
}
