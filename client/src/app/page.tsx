"use client";

import { useState, useEffect, useRef } from "react";
import {
  SquaresFour,
  ClipboardText,
  Heartbeat,
  ClockCounterClockwise,
  Users,
  Gear,
  Question,
  SignOut,
  MagnifyingGlass,
  Bell,
  CheckCircle,
  WarningCircle,
  Warning,
  Info,
  Check,
  CaretDown,
  CircleNotch,
  List,
  X,
  Buildings,
  User,
  PencilSimple,
  Envelope,
  Lock,
  Eye,
  EyeSlash,
  FileText,
  CaretDoubleLeft,
  CaretDoubleRight,
  Calendar,
  Trash,
} from "@phosphor-icons/react";
import { useAuth } from "../contexts/AuthContext";
import { notificationApi, authApi, balitaApi, lansiaApi, periodeApi, AppNotification, PeriodePelayanan } from "../lib/api";
import PeriodeModal from "../components/PeriodeModal";
import toast from "react-hot-toast";

// Feature Modules
import DashboardModule from "../features/dashboard/DashboardModule";
import PelayananModule from "../features/pelayanan/PelayananModule";
import BalitaModule from "../features/balita/BalitaModule";
import LansiaModule from "../features/lansia/LansiaModule";
import RiwayatModule from "../features/riwayat/RiwayatModule";
import LaporanModule from "../features/laporan/LaporanModule";
import PengaturanModule from "../features/pengaturan/PengaturanModule";
import ManajemenAkunModule from "../features/pengaturan/ManajemenAkunModule";
import BantuanModule from "../features/bantuan/BantuanModule";
import LansiaIcon from "../components/LansiaIcon";
import BalitaIcon from "../components/BalitaIcon";

// Login Page (rendered inline when not authenticated)
import LoginPage from "./login/page";

function SwipeableNotificationItem({
  item,
  onItemClick,
  onDelete,
}: {
  item: AppNotification;
  onItemClick: (item: AppNotification) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);

  let bgClass = "bg-blue-50 border-blue-200 text-blue-900";
  let IconComponent = Info;
  let iconColor = "text-blue-600";

  if (item.type === "DANGER") {
    bgClass = "bg-red-50 border-red-200 text-red-900";
    IconComponent = WarningCircle;
    iconColor = "text-red-600";
  } else if (item.type === "WARNING") {
    bgClass = "bg-amber-50 border-amber-200 text-amber-900";
    IconComponent = Warning;
    iconColor = "text-amber-600";
  } else if (item.type === "SUCCESS") {
    bgClass = "bg-emerald-50 border-emerald-200 text-emerald-900";
    IconComponent = CheckCircle;
    iconColor = "text-emerald-600";
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const diff = e.touches[0].clientX - startXRef.current;
    setOffsetX(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(offsetX) > 70) {
      onDelete(item.id);
    } else {
      setOffsetX(0);
    }
    startXRef.current = null;
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    startXRef.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (startXRef.current === null || !isDragging) return;
    const diff = e.clientX - startXRef.current;
    setOffsetX(diff);
  };

  const handleMouseUp = () => {
    if (Math.abs(offsetX) > 70) {
      onDelete(item.id);
    } else {
      setOffsetX(0);
    }
    startXRef.current = null;
    setIsDragging(false);
  };

  return (
    <div className="relative overflow-hidden rounded-xl group select-none">
      {/* Background Delete Indicator (only visible when swiped/dragged) */}
      {offsetX !== 0 && (
        <div className="absolute inset-0 bg-red-600 text-white flex items-center justify-between px-4 font-extrabold text-xs rounded-xl shadow-inner">
          {offsetX > 0 ? (
            <div className="flex items-center gap-1.5">
              <Trash className="w-4 h-4" weight="bold" /> Hapus Notifikasi
            </div>
          ) : (
            <div className="flex items-center gap-1.5 ml-auto">
              Hapus Notifikasi <Trash className="w-4 h-4" weight="bold" />
            </div>
          )}
        </div>
      )}

      {/* Foreground Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDragging) handleMouseUp();
        }}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
        onClick={() => {
          if (Math.abs(offsetX) < 5) {
            onItemClick(item);
          }
        }}
        className={`p-3 border rounded-xl text-xs relative transition-all cursor-pointer ${bgClass} ${
          !item.isRead ? "shadow-2xs font-semibold ring-1 ring-black/5" : "opacity-85 hover:opacity-100"
        }`}
      >
        <div className="flex gap-2.5 items-start">
          <IconComponent className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} weight="bold" />
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <p className="font-bold text-gray-900 text-xs truncate">
                {item.title}
              </p>
              {!item.isRead && (
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-gray-700 leading-relaxed">
              {item.message}
            </p>
          </div>
        </div>

        {/* Hover Delete Button */}
        <button
          type="button"
          onClick={(e) => onDelete(item.id, e)}
          className="absolute top-2.5 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-red-200 cursor-pointer"
          title="Hapus Notifikasi"
        >
          <Trash className="w-3.5 h-3.5 text-gray-500 hover:text-red-600" weight="bold" />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, posyanduId, isLoading, logout, updateUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRecommendations, setSearchRecommendations] = useState<
    Array<{
      id: string;
      nama: string;
      tipe: "Balita" | "Lansia";
      subText: string;
      raw: any;
    }>
  >([]);
  const [isSearchingRecommendations, setIsSearchingRecommendations] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedBalitaId, setSelectedBalitaId] = useState<string | undefined>(undefined);
  const [selectedLansiaId, setSelectedLansiaId] = useState<string | undefined>(undefined);
  const [showNotification, setShowNotification] = useState(false);
  const [activeMenu, setActiveMenu] = useState("Overview");
  const [navigationOrigin, setNavigationOrigin] = useState<string | null>(null);
  const [navKey, setNavKey] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("posyandu_sidebar_collapsed");
    if (saved === "true") {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("posyandu_sidebar_collapsed", String(next));
      return next;
    });
  };

  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);

  // Active Periode State
  const [activePeriode, setActivePeriode] = useState<PeriodePelayanan | null>(null);
  const [isPeriodeModalOpen, setIsPeriodeModalOpen] = useState(false);

  const loadActivePeriode = async () => {
    if (!posyanduId) return;
    try {
      const res = await periodeApi.getActive(posyanduId);
      if (res.success) {
        setActivePeriode(res.data);
        const now = new Date();
        const curBulan = now.getMonth() + 1;
        const curTahun = now.getFullYear();
        if (!res.data || res.data.bulan !== curBulan || res.data.tahun !== curTahun) {
          setIsPeriodeModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Gagal memuat periode pelayanan aktif:", err);
    }
  };

  // Quick Edit Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editNama, setEditNama] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [modalNotice, setModalNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const openEditProfileModal = () => {
    if (user) {
      setEditNama(user.nama);
      setEditUsername(user.username || "");
      setEditEmail(user.email);
      setEditPassword("");
      setShowPassword(false);
      setModalNotice(null);
      setIsEditProfileOpen(true);
    }
  };

  const handleSaveProfileModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalNotice(null);

    if (!editNama.trim() || !editUsername.trim() || !editEmail.trim()) {
      setModalNotice({ type: "error", message: "Nama, username, dan email tidak boleh kosong" });
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setModalNotice({ type: "error", message: "Password minimal 6 karakter" });
      return;
    }

    try {
      setIsSavingProfile(true);
      const res = await authApi.updateProfile({
        nama: editNama.trim(),
        username: editUsername.trim(),
        email: editEmail.trim(),
        ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
      });

      if (res.success && res.data) {
        updateUser({
          nama: res.data.nama,
          username: res.data.username,
          email: res.data.email,
        });
        setModalNotice({ type: "success", message: "Profil berhasil diperbarui!" });
        toast.success("Profil Anda berhasil diperbarui!");
        setTimeout(() => {
          setIsEditProfileOpen(false);
        }, 1200);
      } else {
        const msg = res.message || "Gagal memperbarui profil";
        setModalNotice({ type: "error", message: msg });
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = err.message || "Gagal memperbarui profil";
      setModalNotice({ type: "error", message: msg });
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const loadNotifications = async () => {
    if (!posyanduId) return;
    try {
      setIsLoadingNotifications(true);
      const res = await notificationApi.getNotifications(posyanduId);
      // Filter out notifications older than 7 days
      const now = new Date();
      const validNotifications = res.notifications.filter((n) => {
        const d = new Date(n.createdAt);
        return (now.getTime() - d.getTime()) / (1000 * 3600 * 24) <= 7;
      });
      setNotifications(validNotifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error("Gagal memuat notifikasi:", err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleDeleteNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!posyanduId) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationApi.deleteNotification(posyanduId, id);
    } catch (err) {
      console.error("Gagal menghapus notifikasi:", err);
    }
  };

  useEffect(() => {
    if (user && posyanduId) {
      loadNotifications();
      loadActivePeriode();
    }
  }, [user, posyanduId, activeMenu]);

  const handleMarkAllRead = async () => {
    if (!posyanduId) return;
    try {
      const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
      if (unreadIds.length === 0) return;
      await notificationApi.markAsRead(posyanduId, unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Gagal menandai notifikasi dibaca:", err);
    }
  };

  const handleNotificationItemClick = async (item: AppNotification) => {
    // 1. Mark item as read if unread
    if (!item.isRead && posyanduId) {
      try {
        await notificationApi.markAsRead(posyanduId, [item.id]);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Gagal menandai notifikasi dibaca:", err);
      }
    }

    // 2. Navigate based on category
    if (item.category === "balita") {
      setActiveMenu("Balita");
    } else if (item.category === "lansia") {
      setActiveMenu("Lansia");
    } else if (item.category === "system") {
      if (
        item.title.toLowerCase().includes("periode") ||
        item.title.toLowerCase().includes("bulan") ||
        item.message.toLowerCase().includes("periode")
      ) {
        setIsPeriodeModalOpen(true);
      } else {
        setActiveMenu("Overview");
      }
    }

    // 3. Close dropdown
    setShowNotification(false);
  };


  // Debounced Search Recommendations (After Typing)
  useEffect(() => {
    if (!posyanduId || searchQuery.trim().length < 2) {
      setSearchRecommendations([]);
      setShowSearchDropdown(false);
      setIsSearchingRecommendations(false);
      return;
    }

    setIsSearchingRecommendations(true);
    const timer = setTimeout(async () => {
      try {
        const [balitaRes, lansiaRes] = await Promise.all([
          balitaApi.getAll(posyanduId, { search: searchQuery.trim() }),
          lansiaApi.getAll(posyanduId, { search: searchQuery.trim() }),
        ]);

        const balitaItems = (balitaRes.data || []).slice(0, 5).map((b) => ({
          id: b.id,
          nama: b.nama,
          tipe: "Balita" as const,
          subText: `Ibu: ${b.namaIbu || "-"} • ${b.alamat || "-"}`,
          raw: b,
        }));

        const lansiaItems = (lansiaRes.data || []).slice(0, 5).map((l) => ({
          id: l.id,
          nama: l.nama,
          tipe: "Lansia" as const,
          subText: `NIK: ${l.nik || "-"} • ${l.alamat || "-"}`,
          raw: l,
        }));

        const combined = [...balitaItems, ...lansiaItems];
        setSearchRecommendations(combined);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error("Gagal memuat rekomendasi pencarian:", err);
      } finally {
        setIsSearchingRecommendations(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, posyanduId]);

  const handleSelectRecommendation = (item: { id: string; nama: string; tipe: "Balita" | "Lansia" }) => {
    setShowSearchDropdown(false);
    setSearchQuery(item.nama);
    if (item.tipe === "Balita") {
      setSelectedBalitaId(item.id);
      setSelectedLansiaId(undefined);
      setActiveMenu("Balita");
    } else if (item.tipe === "Lansia") {
      setSelectedLansiaId(item.id);
      setSelectedBalitaId(undefined);
      setActiveMenu("Lansia");
    }
  };

  // Close notification, search & profile dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setShowNotification(false);
      }
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowNotification(false);
        setShowProfileMenu(false);
        setShowSearchDropdown(false);
      }
    };

    if (showNotification || showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotification, showProfileMenu]);

  // ── Loading spinner ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <CircleNotch className="w-8 h-8 text-saas-primary animate-spin" weight="bold" />
          <p className="text-sm text-saas-muted font-medium">Memuat...</p>
        </div>
      </div>
    );
  }

  // ── Login wall ───────────────────────────────────────────
  if (!user || !posyanduId) {
    return <LoginPage />;
  }

  // Categorized Navigation Sections
  const navSections = [
    {
      category: "Utama",
      items: [
        { name: "Overview", icon: SquaresFour },
        { name: "Pelayanan", icon: ClipboardText },
      ],
    },
    {
      category: "Data Sasaran",
      items: [
        { name: "Balita", icon: BalitaIcon },
        { name: "Lansia", icon: LansiaIcon },
      ],
    },
    {
      category: "Laporan & Riwayat",
      items: [
        { name: "Riwayat", icon: ClockCounterClockwise },
        { name: "Laporan", icon: FileText },
      ],
    },
    {
      category: "Sistem & Akun",
      items: [
        { name: "Manajemen Akun", icon: Users },
        { name: "Pengaturan", icon: Gear },
      ],
    },
  ];

  // ── Conditional Rendering of Views ──────────────────────
  const handleDashboardNavigate = (menu: string, patientId?: string) => {
    const target = menu.toLowerCase();
    if (target === "balita") {
      if (patientId) {
        setSelectedBalitaId(patientId);
        if (activeMenu !== "Balita") {
          setNavigationOrigin(activeMenu);
        }
      }
      setActiveMenu("Balita");
    } else if (target === "lansia") {
      if (patientId) {
        setSelectedLansiaId(patientId);
        if (activeMenu !== "Lansia") {
          setNavigationOrigin(activeMenu);
        }
      }
      setActiveMenu("Lansia");
    } else {
      setActiveMenu(menu);
    }
  };

  const handleBackFromProfile = () => {
    if (navigationOrigin) {
      setActiveMenu(navigationOrigin);
      setNavigationOrigin(null);
    }
    setSelectedBalitaId(undefined);
    setSelectedLansiaId(undefined);
    setNavKey((prev) => prev + 1);
  };

  const getBackLabel = (defaultLabel: string) => {
    if (!navigationOrigin) return defaultLabel;
    if (navigationOrigin === "Overview") return "Kembali ke Dashboard";
    if (navigationOrigin === "Laporan") return "Kembali ke Laporan Rekapan";
    if (navigationOrigin === "Riwayat") return "Kembali ke Riwayat";
    if (navigationOrigin === "Pelayanan") return "Kembali ke Pelayanan";
    return `Kembali ke ${navigationOrigin}`;
  };

  const renderActiveView = () => {
    switch (activeMenu) {
      case "Overview":
        return (
          <DashboardModule
            searchQuery={searchQuery}
            onNavigate={handleDashboardNavigate}
            posyanduId={posyanduId}
            activePeriode={activePeriode}
          />
        );
      case "Pelayanan":
        return (
          <PelayananModule
            posyanduId={posyanduId}
            activePeriode={activePeriode}
            onOpenPeriodeModal={() => setIsPeriodeModalOpen(true)}
            onNavigate={handleDashboardNavigate}
          />
        );
      case "Balita":
        return (
          <BalitaModule
            key={`balita-${navKey}`}
            posyanduId={posyanduId}
            activePeriode={activePeriode}
            searchQuery={searchQuery}
            selectedId={selectedBalitaId}
            onBack={handleBackFromProfile}
            backLabel={getBackLabel("Kembali ke Daftar Balita")}
          />
        );
      case "Lansia":
        return (
          <LansiaModule
            key={`lansia-${navKey}`}
            posyanduId={posyanduId}
            activePeriode={activePeriode}
            searchQuery={searchQuery}
            selectedId={selectedLansiaId}
            onBack={handleBackFromProfile}
            backLabel={getBackLabel("Kembali ke Daftar Lansia")}
          />
        );
      case "Riwayat":
        return <RiwayatModule posyanduId={posyanduId} activePeriode={activePeriode} onNavigate={handleDashboardNavigate} />;
      case "Laporan":
        return <LaporanModule posyanduId={posyanduId} onNavigate={handleDashboardNavigate} />;
      case "Manajemen Akun":
        return <ManajemenAkunModule posyanduId={posyanduId} />;
      case "Pengaturan":
        return <PengaturanModule />;
      case "Bantuan":
        return <BantuanModule />;
      default:
        return (
          <DashboardModule
            searchQuery={searchQuery}
            onNavigate={handleDashboardNavigate}
            posyanduId={posyanduId}
          />
        );
    }
  };

  // User initials for avatar
  const initials = user.nama
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleMenuSelect = (menuName: string) => {
    setNavigationOrigin(null);
    if (menuName === "Balita") {
      setSelectedBalitaId(undefined);
    } else if (menuName === "Lansia") {
      setSelectedLansiaId(undefined);
    }
    setActiveMenu(menuName);
    setNavKey((prev) => prev + 1);
    setIsMobileMenuOpen(false);
    setShowNotification(false);
    setShowProfileMenu(false);
  };

  return (
    <div className="flex h-screen bg-canvas font-sans text-saas-dark overflow-hidden relative">
      {/* 1. SIDEBAR NAVIGASI DESKTOP (Bisa dibuka/tutup, Tampil di md+) */}
      <aside
        className={`hidden md:flex ${
          isSidebarCollapsed ? "w-[76px] px-3 py-5" : "w-64 p-5"
        } h-full bg-white border-r border-gray-100 flex-col justify-between shrink-0 overflow-y-auto transition-all duration-300 select-none z-20`}
      >
        <div>
          {/* Logo Brand & Toggle Collapse Button */}
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3 mb-6">
              <div
                onClick={toggleSidebar}
                title="Buka Sidebar"
                className="w-10 h-10 rounded-xl bg-saas-primary flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Heartbeat className="w-6 h-6" weight="bold" />
              </div>
              <button
                onClick={toggleSidebar}
                title="Buka Sidebar"
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-saas-primary hover:bg-teal-50 flex items-center justify-center transition-colors"
              >
                <CaretDoubleRight className="w-4 h-4" weight="bold" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6 px-1">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-saas-primary flex items-center justify-center text-white shadow-md shadow-teal-500/20 shrink-0">
                  <Heartbeat className="w-6 h-6" weight="bold" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-saas-dark text-base tracking-tight leading-none truncate">
                    PosyanduKita
                  </h1>
                  <span className="text-[10px] text-saas-muted font-bold tracking-wider uppercase">
                    Sistem Informasi
                  </span>
                </div>
              </div>
              <button
                onClick={toggleSidebar}
                title="Tutup Sidebar (Hanya Ikon)"
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-saas-primary hover:bg-teal-50 flex items-center justify-center transition-colors shrink-0"
              >
                <CaretDoubleLeft className="w-4 h-4" weight="bold" />
              </button>
            </div>
          )}

          {/* Categorized Menu Links */}
          <nav className="space-y-4">
            {navSections.map((section) => (
              <div key={section.category}>
                {!isSidebarCollapsed ? (
                  <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400 px-3 mb-1.5">
                    {section.category}
                  </p>
                ) : (
                  <div className="w-6 mx-auto border-t border-gray-100 my-2" />
                )}

                <div className="space-y-1">
                  {section.items.map((menu) => {
                    const isActive = activeMenu === menu.name;
                    const Icon = menu.icon;

                    if (isSidebarCollapsed) {
                      return (
                        <div key={menu.name} className="relative group flex justify-center">
                          <button
                            onClick={() => handleMenuSelect(menu.name)}
                            className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
                              isActive
                                ? "bg-saas-primary text-white shadow-md shadow-teal-500/20"
                                : "text-saas-muted hover:text-saas-dark hover:bg-gray-50"
                            }`}
                            aria-label={menu.name}
                          >
                            <Icon
                              className={`w-5 h-5 ${isActive ? "text-white" : "text-saas-muted"}`}
                              weight="bold"
                            />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl top-1/2 -translate-y-1/2">
                            {menu.name}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={menu.name}
                        onClick={() => handleMenuSelect(menu.name)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          isActive
                            ? "bg-saas-primary text-white shadow-md shadow-teal-500/15"
                            : "text-saas-muted hover:text-saas-dark hover:bg-gray-50/80"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-white" : "text-saas-muted"
                          }`}
                          weight="bold"
                        />
                        <span className="truncate">{menu.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Menu Bawah */}
        <div className="border-t border-gray-100 pt-4 space-y-1.5">
          {isSidebarCollapsed ? (
            <>
              <div className="relative group flex justify-center">
                <a
                  href="/puskesmas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-saas-primary hover:bg-teal-50 border border-teal-200 transition-all"
                  aria-label="Portal Puskesmas"
                >
                  <Buildings className="w-5 h-5 text-saas-primary" weight="bold" />
                </a>
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl top-1/2 -translate-y-1/2">
                  Portal Puskesmas ↗
                </div>
              </div>

              <div className="relative group flex justify-center">
                <button
                  onClick={() => handleMenuSelect("Bantuan")}
                  className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${
                    activeMenu === "Bantuan"
                      ? "bg-saas-primary text-white shadow-md shadow-teal-500/20"
                      : "text-saas-muted hover:text-saas-dark hover:bg-gray-50"
                  }`}
                  aria-label="Bantuan"
                >
                  <Question
                    className={`w-5 h-5 ${activeMenu === "Bantuan" ? "text-white" : "text-saas-muted"}`}
                    weight="bold"
                  />
                </button>
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl top-1/2 -translate-y-1/2">
                  Bantuan
                </div>
              </div>

              <div className="relative group flex justify-center">
                <button
                  onClick={logout}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50 transition-all"
                  aria-label="Keluar"
                >
                  <SignOut className="w-5 h-5" weight="bold" />
                </button>
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl top-1/2 -translate-y-1/2">
                  Keluar
                </div>
              </div>
            </>
          ) : (
            <>
              <a
                href="/puskesmas"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-saas-primary hover:bg-teal-50 transition-all border border-teal-200"
              >
                <Buildings className="w-4 h-4 shrink-0 text-saas-primary" weight="bold" />
                <span>Portal Puskesmas ↗</span>
              </a>
              <button
                onClick={() => handleMenuSelect("Bantuan")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeMenu === "Bantuan"
                    ? "bg-saas-primary text-white shadow-md shadow-teal-500/15"
                    : "text-saas-muted hover:text-saas-dark hover:bg-gray-50/80"
                }`}
              >
                <Question
                  className={`w-4 h-4 ${
                    activeMenu === "Bantuan" ? "text-white" : "text-saas-muted"
                  }`}
                  weight="bold"
                />
                <span>Bantuan</span>
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50/70 transition-all"
              >
                <SignOut className="w-4 h-4" weight="bold" />
                <span>Keluar</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* 2. MOBILE SIDEBAR DRAWER OVERLAY (Tampil di < md saat isMobileMenuOpen=true) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-saas-dark/40 backdrop-blur-sm transition-opacity"
          />

          {/* Mobile Drawer Panel */}
          <aside className="relative w-4/5 max-w-xs h-full bg-white shadow-2xl flex flex-col justify-between p-6 z-10 overflow-y-auto transform transition-transform duration-300">
            <div>
              {/* Header Drawer dengan Tombol Close */}
              <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-saas-primary flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                    <Heartbeat className="w-5 h-5" weight="bold" />
                  </div>
                  <div>
                    <h1 className="font-bold text-saas-dark text-base tracking-tight leading-none">PosyanduKita</h1>
                    <span className="text-[9px] text-saas-muted font-bold tracking-wider uppercase">Sistem Informasi</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-saas-muted hover:text-saas-dark"
                >
                  <X className="w-5 h-5" weight="bold" />
                </button>
              </div>

              {/* Categorized Menu Links on Mobile */}
              <nav className="space-y-4">
                {navSections.map((section) => (
                  <div key={section.category}>
                    <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400 px-3 mb-1.5">
                      {section.category}
                    </p>
                    <div className="space-y-1">
                      {section.items.map((menu) => {
                        const isActive = activeMenu === menu.name;
                        const Icon = menu.icon;
                        return (
                          <button
                            key={menu.name}
                            onClick={() => handleMenuSelect(menu.name)}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              isActive
                                ? "bg-saas-primary text-white shadow-md shadow-teal-500/15"
                                : "text-saas-muted hover:text-saas-dark hover:bg-gray-50/80"
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-saas-muted"}`} weight="bold" />
                            <span>{menu.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>

            {/* Menu Bawah Drawer */}
            <div className="border-t border-gray-100 pt-4 space-y-1.5 mt-6">
              <a
                href="/puskesmas"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-saas-primary hover:bg-teal-50 transition-all border border-teal-200"
              >
                <Buildings className="w-4 h-4 shrink-0 text-saas-primary" weight="bold" />
                <span>Portal Puskesmas ↗</span>
              </a>
              <button
                onClick={() => handleMenuSelect("Bantuan")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeMenu === "Bantuan"
                    ? "bg-saas-primary text-white shadow-md shadow-teal-500/15"
                    : "text-saas-muted hover:text-saas-dark hover:bg-gray-50/80"
                }`}
              >
                <Question className={`w-4 h-4 ${activeMenu === "Bantuan" ? "text-white" : "text-saas-muted"}`} weight="bold" />
                <span>Bantuan</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50/60 transition-all"
              >
                <SignOut className="w-4 h-4" weight="bold" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* AREA KONTEN UTAMA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        {/* 3. TOP NAVBAR (RESPONSIF) */}
        <header className="h-16 md:h-20 bg-white border-b border-gray-100 px-4 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30">
          {/* Left: Mobile Hamburger Toggle + Mobile Brand Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-saas-dark hover:bg-gray-100 transition-colors"
              aria-label="Buka Menu Navigasi"
            >
              <List className="w-6 h-6" weight="bold" />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-8 h-8 rounded-lg bg-saas-primary flex items-center justify-center text-white">
                <Heartbeat className="w-4 h-4" weight="bold" />
              </div>
              <span className="font-bold text-saas-dark text-sm tracking-tight">PosyanduKita</span>
            </div>

            {/* Desktop Search Input with Autocomplete Recommendations */}
            <div className="relative hidden md:block w-72 lg:w-96" ref={searchRef}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nama balita atau lansia..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedBalitaId) setSelectedBalitaId(undefined);
                    if (selectedLansiaId) setSelectedLansiaId(undefined);
                  }}
                  onFocus={() => {
                    if (searchRecommendations.length > 0) setShowSearchDropdown(true);
                  }}
                  className="w-full pl-10 pr-8 py-2 bg-gray-50/70 border border-gray-150 rounded-input text-sm text-saas-dark placeholder-saas-muted/70 focus:outline-none focus:border-saas-primary/50 focus:bg-white transition-all"
                />
                <MagnifyingGlass className="absolute left-3.5 top-2.5 text-saas-muted/80 w-4 h-4" weight="bold" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchDropdown(false);
                      setSearchRecommendations([]);
                      setSelectedBalitaId(undefined);
                      setSelectedLansiaId(undefined);
                    }}
                    className="absolute right-3 top-2.5 text-saas-muted hover:text-saas-dark"
                  >
                    <X className="w-4 h-4" weight="bold" />
                  </button>
                )}
              </div>

              {/* Autocomplete Recommendation Dropdown */}
              {showSearchDropdown && (
                <div className="absolute top-12 left-0 w-full bg-white rounded-card shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in duration-150 space-y-1">
                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-saas-muted uppercase tracking-wider">
                      Rekomendasi Hasil Pencarian
                    </span>
                    {isSearchingRecommendations && (
                      <CircleNotch className="w-3.5 h-3.5 text-saas-primary animate-spin" weight="bold" />
                    )}
                  </div>

                  {isSearchingRecommendations ? (
                    <div className="py-4 text-center text-xs font-semibold text-saas-muted flex items-center justify-center gap-2">
                      <CircleNotch className="w-4 h-4 text-saas-primary animate-spin" weight="bold" />
                      Mencari nama balita &amp; lansia...
                    </div>
                  ) : searchRecommendations.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                      {searchRecommendations.map((item) => (
                        <button
                          key={`${item.tipe}-${item.id}`}
                          type="button"
                          onClick={() => handleSelectRecommendation(item)}
                          className="w-full text-left p-2.5 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                item.tipe === "Balita" ? "bg-teal-50 text-teal-700" : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              {item.tipe === "Balita" ? (
                                <BalitaIcon className="w-4 h-4" />
                              ) : (
                                <LansiaIcon className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-saas-dark group-hover:text-saas-primary transition-colors truncate">
                                {item.nama}
                              </p>
                              <p className="text-[10px] text-saas-muted truncate">{item.subText}</p>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                              item.tipe === "Balita"
                                ? "bg-teal-50 text-teal-800 border-teal-200"
                                : "bg-indigo-50 text-indigo-800 border-indigo-200"
                            }`}
                          >
                            {item.tipe}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs font-semibold text-saas-muted">
                      Tidak ditemukan data balita atau lansia dengan nama "{searchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Search Toggle Mobile, Periode Pelayanan, Notifikasi & Profil */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Periode Pelayanan Badge & Selector */}
            {(() => {
              const now = new Date();
              const isOutdated =
                !activePeriode ||
                activePeriode.bulan !== now.getMonth() + 1 ||
                activePeriode.tahun !== now.getFullYear();
              return (
                <button
                  onClick={() => setIsPeriodeModalOpen(true)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs group border cursor-pointer ${
                    isOutdated
                      ? "bg-amber-50 hover:bg-amber-100/90 border-amber-300 text-amber-950"
                      : "bg-white hover:bg-teal-50/60 border-teal-600/40 text-gray-900"
                  }`}
                  title={
                    isOutdated
                      ? "Periode belum sesuai bulan berjalan! Klik untuk kelola."
                      : "Buka atau Pilih Periode Pelayanan"
                  }
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${
                      isOutdated ? "bg-amber-600 text-white border-amber-700" : "bg-teal-700 text-white border-teal-800"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" weight="bold" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <span
                      className={`block text-[9px] font-extrabold uppercase leading-none ${
                        isOutdated ? "text-amber-800" : "text-teal-800"
                      }`}
                    >
                      {isOutdated ? "Bulan Baru - Kelola Periode" : "Periode Pelayanan"}
                    </span>
                    <span className="block text-[11px] font-extrabold leading-tight truncate max-w-[130px] text-gray-900 mt-0.5">
                      {activePeriode ? activePeriode.nama : "Pilih Periode"}
                    </span>
                  </div>
                  <CaretDown
                    className="w-3 h-3 shrink-0 group-hover:translate-y-0.5 transition-transform text-gray-500"
                    weight="bold"
                  />
                </button>
              );
            })()}

            {/* Container Lonceng & Dropdown Notifikasi */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => {
                  setShowNotification((prev) => !prev);
                  if (!showNotification) loadNotifications();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-gray-100 flex items-center justify-center relative hover:bg-gray-50 transition-all"
                aria-label="Notifikasi"
              >
                <Bell className="w-4 h-4 text-saas-dark" weight="bold" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Notifikasi */}
              {showNotification && (
                <div className="absolute top-12 right-0 w-80 sm:w-96 bg-white rounded-card shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in duration-150 max-h-[80vh] flex flex-col">
                  {/* Header Notifikasi */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-saas-dark">Notifikasi</h4>
                      {unreadCount > 0 && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {unreadCount} baru
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold text-saas-primary hover:underline flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" weight="bold" />
                        Tandai dibaca
                      </button>
                    )}
                  </div>

                  {/* List Notifikasi */}
                  <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                    {isLoadingNotifications ? (
                      <div className="py-6 text-center text-saas-muted text-xs flex items-center justify-center gap-2">
                        <CircleNotch className="w-4 h-4 animate-spin text-saas-primary" weight="bold" />
                        Memuat notifikasi...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-8 text-center text-saas-muted text-xs">
                        Tidak ada notifikasi saat ini
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <SwipeableNotificationItem
                          key={item.id}
                          item={item}
                          onItemClick={handleNotificationItemClick}
                          onDelete={handleDeleteNotification}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profil Kader */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  setShowProfileMenu((prev) => !prev);
                  setShowNotification(false);
                }}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-100/80 transition-all cursor-pointer group"
                aria-label="Menu Profil"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-saas-primary/10 flex items-center justify-center font-bold text-saas-primary text-xs sm:text-sm border border-saas-primary/20 overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                  {initials}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="flex items-center gap-1">
                    <p className="text-xs sm:text-sm font-bold text-saas-dark leading-none">{user.nama}</p>
                    <CaretDown className="w-3.5 h-3.5 text-saas-muted group-hover:text-saas-dark transition-transform duration-200" weight="bold" />
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-saas-muted font-semibold mt-0.5">
                    {user.role === "OWNER" ? "Pengelola" : "Kader"} · {user.posyandu.nama}
                  </p>
                </div>
              </button>

              {/* Dropdown Menu Profil */}
              {showProfileMenu && (
                <div className="absolute top-14 right-0 w-72 bg-white rounded-card shadow-xl border border-gray-100 p-2.5 z-50 animate-in fade-in duration-150 space-y-1">
                  {/* Info Ringkas & Quick Edit Header */}
                  <div className="p-3 border-b border-gray-100 bg-gray-50/70 rounded-xl mb-1">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="font-extrabold text-xs text-saas-dark truncate">{user.nama}</p>
                        <p className="text-[10px] text-saas-muted truncate mt-0.5">{user.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          openEditProfileModal();
                        }}
                        className="px-2 py-1 rounded-lg bg-saas-primary/10 text-saas-primary hover:bg-saas-primary hover:text-white transition-all flex items-center gap-1 text-[10px] font-bold shrink-0 shadow-xs"
                      >
                        <PencilSimple className="w-3.5 h-3.5" weight="bold" />
                        Edit
                      </button>
                    </div>
                    <div className="mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-saas-primary border border-teal-200/50">
                      {user.role === "OWNER" ? "Pengelola (Owner)" : "Kader Posyandu"}
                    </div>
                  </div>

                  {/* Menu Navigasi Profil */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      openEditProfileModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-saas-dark hover:bg-teal-50/60 hover:text-saas-primary rounded-lg transition-colors text-left"
                  >
                    <User className="w-4 h-4 text-saas-primary" weight="bold" />
                    Edit Profil Saya
                  </button>

                  <button
                    onClick={() => handleMenuSelect("Pengaturan")}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-saas-dark hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <Gear className="w-4 h-4 text-saas-muted" weight="bold" />
                    Pengaturan Sistem
                  </button>

                  {user.role === "OWNER" && (
                    <button
                      onClick={() => handleMenuSelect("Manajemen Akun")}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-saas-dark hover:bg-gray-50 rounded-lg transition-colors text-left"
                    >
                      <Users className="w-4 h-4 text-saas-muted" weight="bold" />
                      Manajemen Akun Kader
                    </button>
                  )}

                  <button
                    onClick={() => handleMenuSelect("Bantuan")}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-saas-dark hover:bg-gray-50 rounded-lg transition-colors text-left"
                  >
                    <Question className="w-4 h-4 text-saas-muted" weight="bold" />
                    Pusat Bantuan & Dokumen
                  </button>

                  <div className="border-t border-gray-100 pt-1 mt-1">
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50/80 rounded-lg transition-colors text-left"
                    >
                      <SignOut className="w-4 h-4 text-red-500" weight="bold" />
                      Keluar (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 4. KONTEN MODUL DINAMIS */}
        <main className="p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 flex-1">
          {renderActiveView()}
        </main>
      </div>

      {/* 5. MOBILE BOTTOM NAVIGATION BAR (Tampil khusus di HP < md) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-2 flex items-center justify-around z-40 shadow-lg">
        {[
          { name: "Overview", label: "Home", icon: SquaresFour },
          { name: "Pelayanan", label: "Layanan", icon: ClipboardText },
          { name: "Balita", label: "Balita", icon: BalitaIcon },
          { name: "Lansia", label: "Lansia", icon: LansiaIcon },
          { name: "Riwayat", label: "Riwayat", icon: ClockCounterClockwise },
          { name: "Laporan", label: "Laporan", icon: FileText },
        ].map((item) => {
          const isActive = activeMenu === item.name;
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => handleMenuSelect(item.name)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? "text-saas-primary font-bold" : "text-saas-muted hover:text-saas-dark"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-saas-primary" : "text-saas-muted"}`} weight="bold" />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 6. MODAL QUICK EDIT PROFIL SAYA */}
      {isEditProfileOpen && (
        <div
          onClick={() => setIsEditProfileOpen(false)}
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[9999] flex items-center justify-center p-4 bg-saas-dark/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 p-6 relative"
          >
            <button
              onClick={() => setIsEditProfileOpen(false)}
              className="absolute top-4 right-4 text-saas-muted hover:text-saas-dark p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" weight="bold" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-saas-primary/10 flex items-center justify-center text-saas-primary border border-saas-primary/20">
                <User className="w-5 h-5" weight="bold" />
              </div>
              <div>
                <h3 className="font-bold text-base text-saas-dark leading-tight">Edit Profil Saya</h3>
                <p className="text-xs text-saas-muted">Perbarui nama lengkap, username, email, atau kata sandi Anda.</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfileModal} className="space-y-4">
              {modalNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    modalNotice.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  {modalNotice.type === "success" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" weight="bold" />
                  ) : (
                    <WarningCircle className="w-4 h-4 text-red-600 shrink-0" weight="bold" />
                  )}
                  {modalNotice.message}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Nama Lengkap</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                    placeholder="Nama lengkap"
                    required
                  />
                  <User className="absolute left-3 top-3 w-4 h-4 text-saas-muted" weight="bold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                    placeholder="Username"
                    required
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
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                    placeholder="nama@email.com"
                    required
                  />
                  <Envelope className="absolute left-3 top-3 w-4 h-4 text-saas-muted" weight="bold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-saas-dark mb-1.5">Kata Sandi Baru (Opsional)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak ingin diubah"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-saas-dark focus:outline-none focus:border-saas-primary focus:bg-white transition-all"
                  />
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-saas-muted" weight="bold" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-saas-muted hover:text-saas-dark"
                  >
                    {showPassword ? (
                      <EyeSlash className="w-4 h-4" weight="bold" />
                    ) : (
                      <Eye className="w-4 h-4" weight="bold" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-saas-muted hover:text-saas-dark hover:bg-gray-100 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 bg-saas-primary hover:bg-teal-600 text-white text-xs font-bold rounded-xl shadow-md shadow-teal-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <CircleNotch className="w-4 h-4 animate-spin" weight="bold" />
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

      {/* 5. MODAL KELOLA PERIODE PELAYANAN */}
      <PeriodeModal
        isOpen={isPeriodeModalOpen}
        onClose={() => setIsPeriodeModalOpen(false)}
        posyanduId={posyanduId}
        activePeriode={activePeriode}
        onSelectPeriode={(p) => setActivePeriode(p)}
        onRefreshPeriode={loadActivePeriode}
      />
    </div>
  );
}

