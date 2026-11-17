"use client";

import React from "react";
import { Calendar, Settings } from "lucide-react";
import { PeriodePelayanan } from "@/lib/api";

interface PeriodeBannerProps {
  activePeriode?: PeriodePelayanan | null;
  onOpenPeriodeModal?: () => void;
}

export default function PeriodeBanner({
  activePeriode,
  onOpenPeriodeModal,
}: PeriodeBannerProps) {
  const now = new Date();
  const curBulan = now.getMonth() + 1;
  const curTahun = now.getFullYear();
  const isCurrentMonth = activePeriode?.bulan === curBulan && activePeriode?.tahun === curTahun;
  const isPeriodAktif = activePeriode?.status === "AKTIF" && isCurrentMonth;

  return (
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
            {isPeriodAktif ? (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                AKTIF (BULAN INI)
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                PERIODE BULAN INI BELUM DIATUR
              </span>
            )}
          </div>
          <h3 className="text-base font-extrabold tracking-tight mt-1 text-gray-900">
            {isPeriodAktif
              ? activePeriode.nama
              : activePeriode
              ? `${activePeriode.nama} (Bukan Bulan Ini)`
              : "Periode Pelayanan Bulan Ini Belum Dibuat"}
          </h3>
          {isPeriodAktif ? (
            <p className="text-xs text-gray-600 font-medium mt-0.5">
              Tanggal Pelaksanaan:{" "}
              <span className="font-bold text-teal-700">
                {new Date(activePeriode.tanggal).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {activePeriode.catatan ? ` • ${activePeriode.catatan}` : ""}
            </p>
          ) : (
            <p className="text-xs text-amber-700 font-semibold mt-0.5">
              Silakan kelola periode pelayanan untuk membuat atau mengaktifkan periode bulan ini sebelum memulai pencatatan.
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
          <Settings className="w-4 h-4" /> Kelola Periode Pelayanan Posyandu
        </button>
      )}
    </div>
  );
}
