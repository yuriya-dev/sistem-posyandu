"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { authApi } from "../../lib/api";
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Heart,
  Users,
  MapPin,
  Building2,
  Globe,
  Mail,
  Lock,
  User,
} from "lucide-react";

import PageHelmet from "../../components/PageHelmet";
import GoogleLoginButton from "./GoogleLoginButton";
import BalitaIcon from "../../components/BalitaIcon";


// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Mode = "login" | "register" | "forgot";
type RegisterStep = 1 | 2;

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// LEFT HERO — Puskesmas & Posyandu Overview (Simplified for Kader)
// ─────────────────────────────────────────────────────────────

function LeftHero() {
  return (
    <div className="hidden lg:flex flex-col justify-between max-w-md text-white select-none py-4">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center p-2 shadow-sm shrink-0">
            <img src="/logo.svg" alt="Logo SIIP" className="w-16 h-16 object-contain" />
          </div>
          <div>
            <p className="text-white font-extrabold text-2xl tracking-tight leading-none">SIIP</p>
            <span className="inline-block text-xs text-teal-300 font-medium mt-1">
              Sistem Informasi Posyandu
            </span>
          </div>
        </div>

        {/* Simplified Headline */}
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Pelayanan Posyandu Balita &amp; Lansia
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Aplikasi pencatatan kader yang praktis, cepat, dan rapi untuk Posyandu di wilayah kerja Puskesmas.
          </p>
        </div>
      </div>

      {/* Footer Info & Portal Links */}
      <div className="pt-6 mt-8 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link
          href="/publik"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold transition-colors"
        >
          <Globe className="w-3.5 h-3.5" /> Portal Publik →
        </Link>
        <Link
          href="/puskesmas"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-colors"
        >
          <Building2 className="w-3.5 h-3.5" /> Portal Puskesmas
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN FORM
// ─────────────────────────────────────────────────────────────

function LoginForm({
  onSwitch,
  onForgotPassword,
}: {
  onSwitch: () => void;
  onForgotPassword: () => void;
}) {
  const { login, loginWithGoogle } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(emailOrUsername, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal masuk. Silakan periksa kembali email/username dan kata sandi Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Masuk ke SIIP</h1>
        <p className="text-xs text-slate-600 mt-1 font-normal leading-relaxed">
          Gunakan akun kader Posyandu Anda untuk memulai pelayanan.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email or Username */}
        <div>
          <label className="block text-xs font-bold text-teal-950 mb-1.5">
            Email atau Username
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="login-email-or-username"
              type="text"
              required
              autoComplete="username"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              placeholder="email@gmail.com atau username"
              className="w-full pl-10 pr-4 py-3 bg-white border border-hairline rounded-input text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-saas-primary focus:ring-2 focus:ring-saas-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-teal-950">
              Kata Sandi
            </label>
            <button
              id="btn-forgot-password-link"
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-semibold text-saas-primary hover:underline transition-all"
            >
              Lupa Kata Sandi?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi Anda"
              className="w-full pl-10 pr-10 py-3 bg-white border border-hairline rounded-input text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-saas-primary focus:ring-2 focus:ring-saas-primary/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-input text-xs text-red-700 font-semibold leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          id="btn-login-submit"
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 bg-saas-primary hover:bg-saas-primary-active text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memeriksa Akun...
            </>
          ) : (
            "Masuk ke Aplikasi"
          )}
        </button>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative bg-white px-3 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
            atau masuk dengan
          </div>
        </div>

        {/* Google Login Button */}
        <GoogleLoginButton
          onSuccess={async (idToken) => {
            setError(null);
            await loginWithGoogle(idToken);
          }}
          onError={(msg) => setError(msg)}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      </form>

      {/* Switch to Register */}
      <div className="mt-8 pt-6 border-t border-hairline text-center">
        <p className="text-sm text-slate-500">
          Posyandu Anda belum terdaftar?{" "}
          <button
            id="btn-switch-to-register"
            onClick={onSwitch}
            className="text-saas-primary font-bold hover:underline transition-all"
          >
            Daftarkan Posyandu Baru
          </button>
        </p>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// FORGOT PASSWORD FORM
// ─────────────────────────────────────────────────────────────

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await authApi.forgotPassword(email);
      setSuccessMessage(
        res.message || "Jika email terdaftar, instruksi reset password telah dikirim ke email Anda."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengirim email reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8">
        <span className="inline-block px-3 py-1 bg-teal-50 text-saas-primary rounded-md text-[11px] font-bold tracking-wider uppercase mb-3">
          RESET KATA SANDI
        </span>
        <h1 className="text-3xl font-extrabold text-teal-950 tracking-tight">Lupa Kata Sandi?</h1>
        <p className="text-sm text-slate-500 mt-2 font-normal leading-relaxed">
          Masukkan alamat email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
        </p>
      </div>

      {successMessage ? (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 text-center">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-emerald-900 leading-relaxed">
              {successMessage}
            </p>
            <p className="text-[11px] text-emerald-800 bg-emerald-100/70 p-3 rounded-xl leading-relaxed text-left border border-emerald-200/60">
              📬 <strong>Catatan:</strong> Jika email belum masuk ke Kotak Masuk (Inbox), silakan periksa folder <strong>Spam</strong> atau <strong>Promosi</strong> di aplikasi email Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-3 bg-saas-primary hover:bg-saas-primary-active text-white text-xs font-bold rounded-xl transition-all mt-2"
          >
            Kembali ke Halaman Login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-teal-950 mb-1.5">
              Alamat Email Anda
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contoh: nama.kader@gmail.com"
                className="w-full pl-10 pr-4 py-3 bg-white border border-hairline rounded-input text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-saas-primary focus:ring-2 focus:ring-saas-primary/20 transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-input text-xs text-red-700 font-semibold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <button
            id="btn-forgot-submit"
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-saas-primary hover:bg-saas-primary-active text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengirim Email...
              </>
            ) : (
              "Kirim Tautan Reset"
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-3 border border-hairline text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 mt-2"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Login
          </button>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REGISTER FORM — 2 Steps
// ─────────────────────────────────────────────────────────────

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const { registerPosyandu } = useAuth();
  const [step, setStep] = useState<RegisterStep>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Step 1 — Posyandu data
  const [namaPosyandu, setNamaPosyandu] = useState("");
  const [desa, setDesa] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [alamat, setAlamat] = useState("");

  // Step 2 — Kader (Owner) data
  const [namaKader, setNamaKader] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!namaPosyandu.trim() || !desa.trim() || !kecamatan.trim() || !alamat.trim()) {
      setError("Silakan isi semua data Posyandu terlebih dahulu.");
      return;
    }
    setStep(2);
  };

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!namaKader.trim() || !email.trim() || !password) {
      setError("Silakan isi semua data akun pengelola.");
      return;
    }
    if (username.trim() && !/^[a-zA-Z0-9._-]+$/.test(username.trim())) {
      setError("Username hanya boleh berisi huruf, angka, titik, underscore, dan strip.");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi harus minimal 8 karakter agar aman.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Isian kata sandi kedua tidak cocok dengan yang pertama.");
      return;
    }
    setIsLoading(true);
    try {
      await registerPosyandu({ namaPosyandu, desa, kecamatan, alamat, namaKader, username: username.trim() || undefined, email, password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar. Silakan periksa kembali data Anda.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="mb-6">
        <span className="inline-block px-3 py-1 bg-teal-50 text-saas-primary rounded-md text-[11px] font-bold tracking-wider uppercase mb-3">
          DAFTAR POSYANDU BARU
        </span>
        <h1 className="text-3xl font-extrabold text-teal-950 tracking-tight">
          Pendaftaran
        </h1>
        <p className="text-sm text-slate-500 mt-2 font-normal leading-relaxed">
          Ikuti 2 langkah mudah berikut untuk mendaftarkan Posyandu Anda ke dalam sistem digital.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-7">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= s
                  ? "bg-saas-primary text-white shadow-md shadow-teal-500/20"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s}
            </div>
            {s < 2 && (
              <div
                className={`h-0.5 w-14 rounded-full transition-all ${
                  step > s ? "bg-saas-primary" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
        <span className="text-xs text-slate-600 font-bold ml-2">
          {step === 1 ? "Langkah 1: Data Posyandu" : "Langkah 2: Akun Kader"}
        </span>
      </div>

      {/* STEP 1: Posyandu Data */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="space-y-4">
          <InputField
            id="reg-nama-posyandu"
            icon={<Building2 className="w-4 h-4" />}
            label="Nama Posyandu"
            value={namaPosyandu}
            onChange={setNamaPosyandu}
            placeholder="contoh: Posyandu Dahlia Indah"
          />
          <InputField
            id="reg-desa"
            icon={<MapPin className="w-4 h-4" />}
            label="Desa / Kelurahan"
            value={desa}
            onChange={setDesa}
            placeholder="contoh: Desa Karanggayam"
          />
          <InputField
            id="reg-kecamatan"
            icon={<MapPin className="w-4 h-4" />}
            label="Kecamatan"
            value={kecamatan}
            onChange={setKecamatan}
            placeholder="contoh: Kecamatan Karanggayam"
          />
          <InputField
            id="reg-alamat"
            icon={<MapPin className="w-4 h-4" />}
            label="Alamat Lengkap (RT/RW & Dusun)"
            value={alamat}
            onChange={setAlamat}
            placeholder="contoh: RT 02 / RW 03, Dusun Cilongok"
          />

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-input text-xs text-red-700 font-semibold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <button
            id="btn-register-step1"
            type="submit"
            className="w-full py-3.5 bg-saas-primary hover:bg-saas-primary-active text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-sm"
          >
            Lanjut ke Langkah 2 <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* STEP 2: Kader Account */}
      {step === 2 && (
        <form onSubmit={handleStep2} className="space-y-4">
          <InputField
            id="reg-nama-kader"
            icon={<User className="w-4 h-4" />}
            label="Nama Lengkap Kader (Anda)"
            value={namaKader}
            onChange={setNamaKader}
            placeholder="contoh: Ibu Siti Aminah"
          />
          <InputField
            id="reg-username"
            icon={<User className="w-4 h-4" />}
            label="Username (Opsional)"
            value={username}
            onChange={setUsername}
            placeholder="contoh: siti.aminah"
            required={false}
          />
          <InputField
            id="reg-email"
            icon={<Mail className="w-4 h-4" />}
            label="Alamat Email Pengelola"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="contoh: siti.aminah@gmail.com"
          />
          <div>
            <label className="block text-xs font-bold text-teal-950 mb-1.5">
              Kata Sandi Akun
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Buat kata sandi minimal 8 karakter"
                className="w-full pl-10 pr-10 py-3 bg-white border border-hairline rounded-input text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-saas-primary focus:ring-2 focus:ring-saas-primary/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <InputField
            id="reg-confirm-password"
            icon={<Lock className="w-4 h-4" />}
            label="Ulangi Kata Sandi"
            value={confirmPassword}
            onChange={setConfirmPassword}
            type="password"
            placeholder="Ketik ulang kata sandi yang sama"
          />

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-input text-xs text-red-700 font-semibold leading-relaxed">
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              id="btn-register-back"
              type="button"
              onClick={() => { setStep(1); setError(null); }}
              className="flex-1 py-3.5 border border-hairline text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali
            </button>
            <button
              id="btn-register-submit"
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3.5 bg-saas-primary hover:bg-saas-primary-active text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan Data...</>
              ) : (
                "Simpan & Selesai"
              )}
            </button>
          </div>
        </form>
      )}

      {/* Switch to Login */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-center">
        <p className="text-sm text-slate-500 font-medium">
          Sudah punya akun?{" "}
          <button
            id="btn-switch-to-login"
            onClick={onSwitch}
            className="text-saas-primary font-bold hover:underline transition-all"
          >
            Masuk ke aplikasi
          </button>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REUSABLE INPUT FIELD
// ─────────────────────────────────────────────────────────────

function InputField({
  id,
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-bold text-teal-950 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 bg-white border border-hairline rounded-input text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-saas-primary focus:ring-2 focus:ring-saas-primary/20 transition-all"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { user, posyanduId, isLoading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    if (!isLoading && user && posyanduId) {
      if (user.role === "PUSKESMAS") {
        router.replace("/puskesmas");
      } else {
        router.replace("/");
      }
    }
  }, [user, posyanduId, isLoading, router]);

  if (isLoading || (user && posyanduId)) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-saas-primary animate-spin" />
          <p className="text-sm text-saas-muted font-medium">Mengalihkan ke beranda...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHelmet
        title={
          mode === "login"
            ? "Masuk ke Aplikasi"
            : mode === "forgot"
            ? "Lupa Kata Sandi"
            : "Pendaftaran Posyandu Baru"
        }
        description="Portal masuk dan pendaftaran Posyandu digital untuk Kader dan Pengelola SIIP."
      />
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-x-hidden">
        {/* Full Background Puskesmas Image */}
        <img
          src="/puskesmas.webp"
          alt="Gedung Puskesmas"
          className="absolute inset-0 w-full h-full object-cover select-none"
        />
        {/* Dark Clinical Contrast Overlay */}
        <div className="absolute inset-0 bg-slate-950/80" />

        {/* Content Container: Kiri Info Puskesmas - Kanan Login Card */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-10">
          {/* Left: Info Puskesmas */}
          <LeftHero />

          {/* Right: Login Card */}
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800">
            {/* Mobile / Tablet Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center p-1.5 shadow-2xs shrink-0">
                <img src="/logo.svg" alt="Logo SIIP" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <span className="font-black text-slate-900 dark:text-white text-base leading-none block">SIIP</span>
                <span className="text-[9px] text-teal-700 dark:text-teal-400 font-bold uppercase tracking-wider block mt-0.5">
                  Sistem Informasi Posyandu
                </span>
              </div>
            </div>

            {/* Form switch animation */}
            {mode === "login" ? (
              <LoginForm
                onSwitch={() => setMode("register")}
                onForgotPassword={() => setMode("forgot")}
              />
            ) : mode === "forgot" ? (
              <ForgotPasswordForm onBack={() => setMode("login")} />
            ) : (
              <RegisterForm onSwitch={() => setMode("login")} />
            )}

            {/* Footer */}
            <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-1.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                <span>Created by</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Universitas Putra Bangsa</span>
                <img
                  src="/logoupb.webp"
                  alt="Logo Universitas Putra Bangsa"
                  className="w-4 h-4 object-contain inline-block"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                © 2026 SIIP · Sistem Informasi Posyandu
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
