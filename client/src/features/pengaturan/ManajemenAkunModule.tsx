"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserCheck2,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
  UserPlus,
  Trash2,
  Edit3,
  MoreVertical,
  User,
  X,
  Loader2,
  Lock,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { kaderApi, KaderMember } from "../../lib/api";
import PageHelmet from "../../components/PageHelmet";
import { AkunTableSkeleton } from "../../components/Skeleton";
import ActionMenu from "../../components/ActionMenu";
import toast from "react-hot-toast";

interface ManajemenAkunModuleProps {
  posyanduId?: string | null;
}

export default function ManajemenAkunModule({ posyanduId: propPosyanduId }: ManajemenAkunModuleProps) {
  const { user, posyanduId: contextPosyanduId } = useAuth();
  const currentPosyanduId = propPosyanduId || contextPosyanduId;
  const isOwner = user?.role === "OWNER";

  // State
  const [kaders, setKaders] = useState<KaderMember[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string>("");

  // Form State
  const [showAddMemberForm, setShowAddMemberForm] = useState<boolean>(false);
  const [newMemberNama, setNewMemberNama] = useState<string>("");
  const [newMemberUsername, setNewMemberUsername] = useState<string>("");
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [newMemberPassword, setNewMemberPassword] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<"OWNER" | "KADER">("KADER");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [addMemberSuccess, setAddMemberSuccess] = useState<string>("");
  const [addMemberError, setAddMemberError] = useState<string>("");
  const [actionNotice, setActionNotice] = useState<string>("");

  // Fetch Kader List
  const fetchData = useCallback(async () => {
    if (!currentPosyanduId) return;
    setIsLoading(true);
    setErrorNotice("");
    try {
      const res = await kaderApi.getAll(currentPosyanduId);
      if (res.success && res.data) {
        setKaders(res.data);
      }
    } catch (err: any) {
      console.error("Error loading kader data:", err);
      setErrorNotice(err.message || "Gagal memuat data kader dari server.");
    } finally {
      setIsLoading(false);
    }
  }, [currentPosyanduId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create new kader account directly
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError("");
    setAddMemberSuccess("");

    if (!newMemberNama.trim() || !newMemberEmail.trim() || !newMemberPassword.trim()) {
      setAddMemberError("Mohon lengkapi seluruh kolom input wajib.");
      return;
    }

    if (newMemberPassword.length < 6) {
      setAddMemberError("Kata sandi minimal harus 6 karakter.");
      return;
    }

    // Validasi format username jika diisi
    if (newMemberUsername.trim() && !/^[a-zA-Z0-9._-]+$/.test(newMemberUsername.trim())) {
      setAddMemberError("Username hanya boleh berisi huruf, angka, titik, underscore, dan strip.");
      return;
    }

    if (!currentPosyanduId) return;

    setIsSubmitting(true);
    try {
      const res = await kaderApi.create(currentPosyanduId, {
        nama: newMemberNama.trim(),
        username: newMemberUsername.trim() || undefined,
        email: newMemberEmail.trim().toLowerCase(),
        password: newMemberPassword.trim(),
        role: newMemberRole,
      });

      if (res.success && res.data) {
        setKaders((prev) => [...prev, res.data]);
        setAddMemberSuccess(`Akun untuk ${newMemberNama} berhasil dibuat.`);
        toast.success(`Akun untuk ${newMemberNama} berhasil dibuat.`);
        setNewMemberNama("");
        setNewMemberUsername("");
        setNewMemberEmail("");
        setNewMemberPassword("");
        setNewMemberRole("KADER");
        setShowAddMemberForm(false);
        setTimeout(() => setAddMemberSuccess(""), 4000);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal membuat akun kader.";
      setAddMemberError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status (Aktif / Nonaktif)
  const handleToggleStatus = async (targetKader: KaderMember) => {
    if (!currentPosyanduId || !isOwner) return;
    if (targetKader.role === "OWNER") {
      setActionNotice("Tidak dapat menonaktifkan akun Owner posyandu.");
      toast.error("Tidak dapat menonaktifkan akun Owner posyandu.");
      setTimeout(() => setActionNotice(""), 3000);
      return;
    }

    const nextStatus = !targetKader.isActive;
    try {
      const res = await kaderApi.toggleStatus(currentPosyanduId, targetKader.id, nextStatus);
      if (res.success && res.data) {
        setKaders((prev) =>
          prev.map((k) => (k.id === targetKader.id ? { ...k, isActive: res.data.isActive } : k))
        );
        const msg = `Status ${targetKader.nama} diubah menjadi ${res.data.isActive ? "Aktif" : "Nonaktif"}.`;
        setActionNotice(msg);
        toast.success(msg);
        setTimeout(() => setActionNotice(""), 3000);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mengubah status kader.";
      setActionNotice(msg);
      toast.error(msg);
      setTimeout(() => setActionNotice(""), 3000);
    }
  };

  // Change role (OWNER <-> KADER)
  const handleChangeRole = async (targetKader: KaderMember) => {
    if (!currentPosyanduId || !isOwner) return;
    if (targetKader.id === user?.id) {
      setActionNotice("Anda tidak dapat mengubah peran Anda sendiri.");
      toast.error("Anda tidak dapat mengubah peran Anda sendiri.");
      setTimeout(() => setActionNotice(""), 3000);
      return;
    }

    const newRole: "OWNER" | "KADER" = targetKader.role === "OWNER" ? "KADER" : "OWNER";
    try {
      const res = await kaderApi.updateRole(currentPosyanduId, targetKader.id, newRole);
      if (res.success && res.data) {
        setKaders((prev) =>
          prev.map((k) => (k.id === targetKader.id ? { ...k, role: res.data.role } : k))
        );
        const msg = `Peran ${targetKader.nama} diubah menjadi ${res.data.role === "OWNER" ? "Owner" : "Anggota"}.`;
        setActionNotice(msg);
        toast.success(msg);
        setTimeout(() => setActionNotice(""), 3000);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mengubah peran kader.";
      setActionNotice(msg);
      toast.error(msg);
      setTimeout(() => setActionNotice(""), 3000);
    }
  };

  // Edit Kader Modal State
  const [editingKader, setEditingKader] = useState<KaderMember | null>(null);
  const [editNama, setEditNama] = useState<string>("");
  const [editUsername, setEditUsername] = useState<string>("");
  const [editEmail, setEditEmail] = useState<string>("");
  const [editRole, setEditRole] = useState<"OWNER" | "KADER">("KADER");
  const [editPassword, setEditPassword] = useState<string>("");
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [isUpdatingKader, setIsUpdatingKader] = useState<boolean>(false);
  const [editModalNotice, setEditModalNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const openEditModal = (kader: KaderMember) => {
    setEditingKader(kader);
    setEditNama(kader.nama);
    setEditUsername(kader.username || "");
    setEditEmail(kader.email);
    setEditRole(kader.role);
    setEditPassword("");
    setShowEditPassword(false);
    setEditModalNotice(null);
  };

  const handleSaveEditKader = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKader || !currentPosyanduId) return;

    setEditModalNotice(null);

    if (!editNama.trim() || !editEmail.trim()) {
      setEditModalNotice({ type: "error", message: "Nama dan email wajib diisi." });
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setEditModalNotice({ type: "error", message: "Kata sandi minimal 6 karakter." });
      return;
    }

    if (editUsername.trim() && !/^[a-zA-Z0-9._-]+$/.test(editUsername.trim())) {
      setEditModalNotice({ type: "error", message: "Username hanya boleh huruf, angka, titik, underscore, dan strip." });
      return;
    }

    try {
      setIsUpdatingKader(true);
      const res = await kaderApi.update(currentPosyanduId, editingKader.id, {
        nama: editNama.trim(),
        username: editUsername.trim() || undefined,
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
      });

      if (res.success && res.data) {
        setKaders((prev) => prev.map((k) => (k.id === editingKader.id ? { ...k, ...res.data } : k)));
        const msg = `Akun ${res.data.nama} berhasil diperbarui.`;
        setEditModalNotice({ type: "success", message: msg });
        toast.success(msg);
        setTimeout(() => {
          setEditingKader(null);
        }, 1200);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal memperbarui data kader.";
      setEditModalNotice({ type: "error", message: msg });
      toast.error(msg);
    } finally {
      setIsUpdatingKader(false);
    }
  };

  // Delete Confirmation Modal State
  const [deletingKader, setDeletingKader] = useState<KaderMember | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Revoke/Delete Kader Access
  const handleRevokeAccess = (targetKader: KaderMember) => {
    if (!currentPosyanduId || !isOwner) return;
    if (targetKader.role === "OWNER") {
      setActionNotice("Akses Akun dengan peran Owner tidak dapat dihapus.");
      toast.error("Akses Akun dengan peran Owner tidak dapat dihapus.");
      setTimeout(() => setActionNotice(""), 3000);
      return;
    }
    setDeletingKader(targetKader);
  };

  const confirmRevokeAccess = async () => {
    if (!deletingKader || !currentPosyanduId) return;
    try {
      setIsDeleting(true);
      const res = await kaderApi.delete(currentPosyanduId, deletingKader.id);
      if (res.success) {
        setKaders((prev) => prev.filter((k) => k.id !== deletingKader.id));
        const msg = `Akses kader ${deletingKader.nama} berhasil dicabut.`;
        setActionNotice(msg);
        toast.success(msg);
        setTimeout(() => setActionNotice(""), 3000);
        setDeletingKader(null);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal mencabut akses kader.";
      setActionNotice(msg);
      toast.error(msg);
      setTimeout(() => setActionNotice(""), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHelmet
        title="Manajemen Akun Kader"
        description="Pengelolaan anggota kader posyandu, peran akses Owner/Kader, dan status keaktifan."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-saas-dark tracking-tight">Manajemen Akun Kader</h2>
            {isOwner ? (
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-saas-primary text-xs font-bold border border-teal-100">
                Akses Owner (Full)
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-saas-muted text-xs font-bold border border-gray-200">
                Akses Anggota (Read Only)
              </span>
            )}
          </div>
          <p className="text-sm text-saas-muted mt-0.5">
            Kelola hak akses kader dan buat akun pelaksana posyandu secara langsung.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {errorNotice && (
        <div className="p-4 bg-red-50 text-trend-dangerText border border-red-100 rounded-xl text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            {errorNotice}
          </div>
          <button onClick={fetchData} className="underline text-red-700 font-bold hover:text-red-900">
            Coba Lagi
          </button>
        </div>
      )}

      {actionNotice && (
        <div className="p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
          {actionNotice}
        </div>
      )}

      {addMemberSuccess && (
        <div className="p-3 bg-green-50 text-trend-successText border border-green-200 rounded-lg text-xs font-bold flex items-center gap-2 transition-all">
          <UserCheck2 className="w-4 h-4 text-green-600 shrink-0" />
          {addMemberSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kolom Kiri: Tabel Akun & Form Registrasi Anggota */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-saas-primary/10 flex items-center justify-center text-saas-primary">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-saas-dark">Akun Kader Terdaftar</h3>
                  <p className="text-xs text-saas-muted mt-0.5">
                    Daftar kader pelaksana posyandu terhubung di database backend.
                  </p>
                </div>
              </div>

              {isOwner && !showAddMemberForm && (
                <button
                  onClick={() => setShowAddMemberForm(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-all"
                >
                  <UserPlus className="w-4 h-4" /> Buat Akun Kader Baru
                </button>
              )}
            </div>

            {/* Form Buat Akun Anggota */}
            {isOwner && showAddMemberForm && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-card space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-wider font-bold text-saas-dark">
                    Tambah Kader Secara Langsung
                  </h4>
                  <button
                    onClick={() => setShowAddMemberForm(false)}
                    className="text-xs text-saas-muted hover:text-saas-dark font-bold"
                  >
                    Batal
                  </button>
                </div>

                {addMemberError && (
                  <div className="p-2.5 bg-red-50 text-trend-dangerText border border-red-100 rounded-lg text-xs font-bold flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {addMemberError}
                  </div>
                )}

                <form onSubmit={handleCreateAccount} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted">Nama Lengkap</label>
                    <input
                      type="text"
                      placeholder="Cth: Ibu Rina Amalia"
                      value={newMemberNama}
                      onChange={(e) => setNewMemberNama(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted">Username <span className="text-gray-400 font-normal">(opsional)</span></label>
                    <input
                      type="text"
                      placeholder="Cth: rina.amalia"
                      value={newMemberUsername}
                      onChange={(e) => setNewMemberUsername(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted">Email</label>
                    <input
                      type="email"
                      placeholder="rina.amalia@gmail.com"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted">Kata Sandi Awal</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimal 6 karakter"
                        value={newMemberPassword}
                        onChange={(e) => setNewMemberPassword(e.target.value)}
                        className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50 pr-8"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-2 text-saas-muted hover:text-saas-dark"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-saas-muted">Hak Akses</label>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as "OWNER" | "KADER")}
                      className="w-full p-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-saas-primary/50"
                    >
                      <option value="KADER">Kader Anggota (Input Data)</option>
                      <option value="OWNER">Kader Owner (Full Akses)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-input shadow-md shadow-teal-500/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                        </>
                      ) : (
                        "Buat Akun & Aktifkan"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Table */}
            {isLoading ? (
              <AkunTableSkeleton rows={4} />
            ) : kaders.length === 0 ? (
              <div className="py-12 text-center text-saas-muted text-xs">
                Belum ada data kader terdaftar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-bold text-saas-muted uppercase tracking-wider">
                      <th className="pb-3">Kader</th>
                      <th className="pb-3 text-center">Peran</th>
                      <th className="pb-3 text-center">Status</th>
                      {isOwner && <th className="pb-3 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {kaders.map((kader, index) => {
                      const isCurrentUser = kader.id === user?.id;
                      const isKaderOwner = kader.role === "OWNER";
                      const isLastItem = index === kaders.length - 1;

                      return (
                        <tr
                          key={kader.id}
                          className="border-b border-gray-50 last:border-b-0 hover:bg-gray-50/20 transition-colors text-sm"
                        >
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-bold text-saas-dark flex items-center gap-1.5">
                                  {kader.nama}
                                  {isCurrentUser && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-teal-100 text-teal-800 rounded">
                                      Anda
                                    </span>
                                  )}
                                </p>
                                {kader.username && (
                                  <p className="text-xs text-saas-primary font-semibold mt-0.5">@{kader.username}</p>
                                )}
                                <p className="text-xs text-saas-muted font-medium mt-0.5">{kader.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 text-center">
                            <button
                              disabled={!isOwner || isCurrentUser}
                              onClick={() => handleChangeRole(kader)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                                isKaderOwner
                                  ? "bg-teal-50 text-saas-primary border-saas-primary/20 hover:bg-teal-100"
                                  : "bg-gray-50 text-saas-muted border-gray-200 hover:bg-gray-100"
                              } disabled:cursor-not-allowed`}
                              title={isOwner ? "Klik untuk ubah Peran" : "Peran kader"}
                            >
                              {isKaderOwner ? "Owner" : "Anggota"}
                            </button>
                          </td>

                          <td className="py-4 text-center">
                            <button
                              disabled={!isOwner || isKaderOwner}
                              onClick={() => handleToggleStatus(kader)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border transition-colors ${
                                kader.isActive
                                  ? "bg-trend-successBg text-trend-successText border-trend-successText/20 hover:bg-green-100"
                                  : "bg-trend-dangerBg text-trend-dangerText border-trend-dangerText/20 hover:bg-red-100"
                              } disabled:cursor-not-allowed`}
                              title={isOwner && !isKaderOwner ? "Klik untuk ubah Status" : "Status kader"}
                            >
                              {kader.isActive ? "Aktif" : "Nonaktif"}
                            </button>
                          </td>

                          {isOwner && (
                            <td className="py-4 text-right">
                              <ActionMenu
                                alignDirection={isLastItem ? "top" : undefined}
                                items={[
                                  {
                                    label: "Edit Akun",
                                    icon: <Edit3 className="w-4 h-4 text-saas-primary" />,
                                    onClick: () => openEditModal(kader),
                                  },
                                  ...(!isKaderOwner && !isCurrentUser
                                    ? [
                                        {
                                          label: "Hapus Akses",
                                          icon: <Trash2 className="w-4 h-4 text-red-600" />,
                                          onClick: () => handleRevokeAccess(kader),
                                          variant: "danger" as const,
                                        },
                                      ]
                                    : []),
                                ]}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Panduan Hak Akses */}
        <div className="space-y-6">
          <div className="bg-white rounded-card shadow-soft-card border border-gray-100/70 p-6 space-y-4 text-xs font-semibold leading-normal">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4.5 h-4.5 text-saas-primary" />
              <h3 className="font-bold text-sm text-saas-dark">Panduan Hak Akses</h3>
            </div>

            <div className="space-y-3 pt-2 text-saas-muted font-medium border-t border-gray-50">
              <div className="space-y-1">
                <p className="font-bold text-saas-dark flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-saas-primary" /> Kader Owner:
                </p>
                <p>
                  Akses administrasi penuh. Dapat edit profil posyandu dan mengelola akun kader lain.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-saas-dark flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-500" /> Kader Anggota:
                </p>
                <p>
                  Akses operasional lapangan. Dapat input data Balita/Lansia, pencatatan periksa bulanan, dan melihat statistik dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Edit Akun Kader */}
      {editingKader && (
        <div
          onClick={() => setEditingKader(null)}
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] !mt-0 flex items-center justify-center p-4 bg-saas-dark/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 p-6 relative"
          >
            <button
              onClick={() => setEditingKader(null)}
              className="absolute top-4 right-4 text-saas-muted hover:text-saas-dark p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-saas-primary/10 flex items-center justify-center text-saas-primary border border-saas-primary/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-saas-dark leading-tight">Edit Akun Kader</h3>
                <p className="text-xs text-saas-muted">Perbarui nama lengkap, username, email, atau kata sandi.</p>
              </div>
            </div>

            <form onSubmit={handleSaveEditKader} className="space-y-4">
              {editModalNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    editModalNotice.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {editModalNotice.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Nama Lengkap</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                    placeholder="Nama lengkap"
                    required
                  />
                  <User className="absolute left-3 top-3 w-4 h-4 text-saas-muted" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Username (Opsional)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                    placeholder="Username"
                  />
                  <span className="absolute left-3.5 top-2.5 text-saas-muted font-bold text-sm">@</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Alamat Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                    placeholder="nama@email.com"
                    required
                  />
                  <Users className="absolute left-3 top-3 w-4 h-4 text-saas-muted" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Peran / Hak Akses</label>
                <div className="relative">
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "OWNER" | "KADER")}
                    disabled={editingKader.id === user?.id}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
                  >
                    <option value="KADER">Anggota Kader (Akses Operasional Lapangan)</option>
                    <option value="OWNER">Kader Owner (Akses Administrasi Penuh)</option>
                  </select>
                  <Shield className="absolute left-3 top-3 w-4 h-4 text-saas-muted" />
                </div>
                {editingKader.id === user?.id && (
                  <p className="text-[10px] text-saas-muted mt-1 font-medium">Anda tidak dapat mengubah peran akun Anda sendiri.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Reset Kata Sandi Baru (Opsional)</label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak ingin diubah"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                  />
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-saas-muted" />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-3 text-saas-muted hover:text-saas-dark"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingKader(null)}
                  className="px-4 py-2 text-xs font-bold text-saas-muted hover:text-saas-dark hover:bg-gray-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingKader}
                  className="px-5 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingKader ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akses */}
      {deletingKader && (
        <div
          onClick={() => setDeletingKader(null)}
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] !mt-0 flex items-center justify-center p-4 bg-saas-dark/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-gray-100 p-6 relative text-center space-y-4"
          >
            <button
              onClick={() => setDeletingKader(null)}
              className="absolute top-4 right-4 text-saas-muted hover:text-saas-dark p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="pt-2">
              <h3 className="font-bold text-base text-saas-dark">Hapus Akses Kader?</h3>
              <p className="text-xs text-saas-muted mt-1.5 leading-relaxed">
                Apakah Anda yakin ingin mencabut akses kader <strong className="text-saas-dark">{deletingKader.nama}</strong>? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingKader(null)}
                className="w-1/2 py-2.5 text-xs font-bold text-saas-muted hover:text-saas-dark hover:bg-gray-100 rounded-xl transition-all border border-gray-200"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmRevokeAccess}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
