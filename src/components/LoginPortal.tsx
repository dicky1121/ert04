import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  BadgeCheck
} from 'lucide-react';
import { CurrentUser, RTConfig } from '../types';
import { BekasiLogo } from './BekasiLogo';
import { storageService } from '../services/storage';
import { authService } from '../services/authService';


interface LoginPortalProps {
  currentUser: CurrentUser;
  config: RTConfig;
  onLogin: (user: CurrentUser) => void;
  onClose?: () => void;
  isFullPage?: boolean;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({
  currentUser,
  config,
  onLogin,
  onClose,
  isFullPage = false
}) => {
  const accounts = storageService.getPengurusAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.find(a => a.role === currentUser?.role)?.id || accounts[0]?.id || 'usr-rt004-01'
  );
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Bila kredensial Supabase tersedia, login WAJIB lewat Supabase Auth
  // (email + password yang di-hash di server). Mode PIN lokal hanya
  // dipakai saat aplikasi berjalan tanpa koneksi cloud (offline/demo).
  const cloudAuthAvailable = authService.isCloudAuthAvailable();


  // Selected account object
  const selectedAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0] || {
    id: 'usr-rt004-01',
    username: 'ketua_rt004',
    namaLengkap: config.namaKetuaRT || 'Yanto',
    role: 'ADMIN_KETUA_RT',
    roleLabel: 'Ketua RT 004 (Admin Utama)',
    pinOrPassword: '1234'
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN_KETUA_RT': return Shield;
      case 'ADMIN_SEKRETARIS': return FileText;
      case 'BENDAHARA': return BadgeCheck;
      case 'SEKSI_KEAMANAN': return ShieldCheck;
      default: return User;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN_KETUA_RT':
        return {
          badge: 'bg-emerald-600 text-white',
          borderActive: 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/50'
        };
      case 'ADMIN_SEKRETARIS':
        return {
          badge: 'bg-blue-600 text-white',
          borderActive: 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50'
        };
      case 'BENDAHARA':
        return {
          badge: 'bg-amber-600 text-white',
          borderActive: 'border-amber-600 ring-2 ring-amber-500/20 bg-amber-50/50'
        };
      case 'SEKSI_KEAMANAN':
        return {
          badge: 'bg-purple-600 text-white',
          borderActive: 'border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/50'
        };
      default:
        return {
          badge: 'bg-slate-700 text-white',
          borderActive: 'border-slate-700 ring-2 ring-slate-500/20 bg-slate-50'
        };
    }
  };

  const finishLogin = (user: CurrentUser, message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      onLogin(user);
      setIsLoading(false);
      if (onClose) onClose();
    }, 350);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!password.trim()) {
      setErrorMessage(
        cloudAuthAvailable ? 'Silakan masukkan password akun Anda.' : 'Silakan masukkan Password / PIN untuk masuk.'
      );
      return;
    }

    setIsLoading(true);

    // Mode utama: Supabase Auth (password diverifikasi di server, bukan di browser)
    if (cloudAuthAvailable) {
      if (!email.trim()) {
        setErrorMessage('Masukkan email akun pengurus yang terdaftar di Supabase Auth.');
        setIsLoading(false);
        return;
      }

      const res = await authService.signIn(email, password);
      if (!res.success || !res.user) {
        setErrorMessage(res.message);
        setIsLoading(false);
        return;
      }

      setPassword('');
      finishLogin(res.user, res.message);
      return;
    }

    // Mode offline/demo: verifikasi PIN lokal (tidak ada koneksi cloud)
    const targetIdentifier = username.trim() || selectedAccount.id;
    const res = storageService.verifyLogin(targetIdentifier, password.trim());

    if (!res.success) {
      setErrorMessage(res.message);
      setIsLoading(false);
      return;
    }

    setPassword('');
    if (res.user) {
      finishLogin(res.user, res.message);
    } else {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage('');
    setInfoMessage('');
    if (!cloudAuthAvailable) {
      setInfoMessage('Reset password hanya tersedia saat aplikasi tersambung ke Supabase.');
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Masukkan email akun Anda terlebih dahulu untuk menerima tautan reset.');
      return;
    }
    setIsLoading(true);
    const res = await authService.sendPasswordReset(email);
    setIsLoading(false);
    if (res.success) setInfoMessage(res.message);
    else setErrorMessage(res.message);
  };


  const isStandalone = isFullPage || !onClose;
  const alamatDisplay = config.alamatSekretariat || 'JL. Jampang No. 111 Kel. Jatimulya Kab.Bekasi Jawabarat';

  // Nama pengurus untuk kartu informasi di portal login.
  // Nilai bawaan lama seperti "Ketua RT 004" dianggap belum diisi agar nama
  // sebenarnya tetap tampil walau config lama masih tersimpan di perangkat.
  const PLACEHOLDER_NAMA = ['ketua rt 004', 'sekretaris rt 004', 'ketua rt', 'sekretaris rt'];
  const resolveNama = (value: string | undefined, fallback: string): string => {
    const clean = (value || '').trim();
    return !clean || PLACEHOLDER_NAMA.includes(clean.toLowerCase()) ? fallback : clean;
  };
  const namaKetuaDisplay = resolveNama(config.namaKetuaRT, 'Yanto');
  const namaSekretarisDisplay = resolveNama(config.namaSekretaris, 'Iwan Trias Andono');
  const namaAdministratorDisplay = 'Dicky Wahyudi';

  const cardContent = (
    <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row my-auto animate-in zoom-in-95 duration-200">
      {/* Left Side: Official Identity Branding */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white p-6 sm:p-8 md:w-5/12 flex flex-col justify-between relative overflow-hidden">
        {/* Subtle glow background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div>
          {/* Logo Lambang Kabupaten Bekasi */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="bg-white/10 p-2.5 rounded-2xl border border-white/15 shadow-inner backdrop-blur-xs">
              <BekasiLogo className="w-12 h-14" />
            </div>
            <div>
              <div className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase">Pemerintah Kabupaten Bekasi</div>
              <h1 className="text-base font-bold text-white tracking-tight">Kecamatan Tambun Selatan</h1>
              <p className="text-xs text-slate-300 font-medium">Kelurahan Jatimulya</p>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2 mt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Portal Resmi Pengurus RT</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight leading-snug">
              Sistem Kependudukan RT 004 RW 007 Kelurahan Jatimulya
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed pt-1">
              Layanan administrasi kependudukan terpadu, persuratan pengantar resmi berkop &amp; QR, manajemen KK, mutasi penduduk, dan sinkronisasi data warga.
            </p>
          </div>

          {/* Officer Names Box */}
          <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Ketua RT 004 :</span>
              <span className="font-bold text-emerald-300">{namaKetuaDisplay}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-slate-400 font-medium">Sekretaris RT :</span>
              <span className="font-bold text-blue-300">{namaSekretarisDisplay}</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-slate-400 font-medium">Administrator :</span>
              <span className="font-bold text-indigo-300">{namaAdministratorDisplay}</span>
            </div>
            <div className="border-t border-white/10 pt-2 space-y-1">
              <span className="text-slate-400 font-medium block">Alamat Sekretariat :</span>
              <span className="font-medium text-slate-200 text-[11px] block leading-relaxed" title={alamatDisplay}>
                {alamatDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Footer security note */}
        <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400" /> Akses Khusus Pengurus RT
          </span>
          <span className="font-mono text-emerald-400/80">E-RT 2026</span>
        </div>
      </div>

      {/* Right Side: Role Selector & Login Form */}
      <div className="p-6 sm:p-8 md:w-7/12 flex flex-col justify-between bg-white overflow-y-auto max-h-[85vh] md:max-h-none">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Portal Login Pengurus</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {cloudAuthAvailable
                  ? 'Masuk dengan email & password akun pengurus yang terdaftar'
                  : 'Mode offline: pilih akun/peran pengurus dan masukkan PIN lokal'}
              </p>

            </div>
            {onClose && !isStandalone && (
              <button 
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer text-xs font-semibold flex items-center gap-1"
              >
                <span>✕ Tutup</span>
              </button>
            )}
          </div>

          {/* Info mode login */}
          {cloudAuthAvailable ? (
            <div className="mb-5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                Login terverifikasi server (Supabase Auth). Peran/jabatan Anda diambil otomatis dari data
                pengurus, sehingga tidak perlu dipilih manual.
              </span>
            </div>
          ) : (
            <div className="mb-5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Mode offline/demo: data hanya tersimpan di perangkat ini dan PIN diverifikasi secara lokal.
                Sambungkan Supabase agar login &amp; data warga terlindungi di server.
              </span>
            </div>
          )}

          {/* Dynamic Role Selection Tabs from Accounts (mode offline saja) */}
          {!cloudAuthAvailable && (
          <div className="grid grid-cols-2 gap-2.5 mb-5 max-h-[220px] overflow-y-auto pr-1">
            {accounts.map((acc) => {

              const isSelected = selectedAccountId === acc.id;
              const IconComp = getRoleIcon(acc.role);
              const styles = getRoleBadgeStyle(acc.role);

              return (
                <button
                  type="button"
                  key={acc.id}
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setUsername(acc.username);
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelected 
                      ? styles.borderActive 
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shadow-2xs ${
                      isSelected ? styles.badge : 'bg-slate-100 text-slate-600'
                    }`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-[100px] ${
                      isSelected ? styles.badge : 'bg-slate-100 text-slate-600'
                    }`}>
                      {acc.roleLabel || acc.role}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-xs text-slate-900 truncate">{acc.namaLengkap}</div>
                    <p className="text-[10px] font-mono text-slate-500 truncate">@{acc.username}</p>
                  </div>
                </button>
              );
            })}
          </div>
          )}

          {/* Form Login with Password */}
          <form onSubmit={handleFormSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {cloudAuthAvailable ? 'Email Akun Pengurus:' : 'Username / Akun Pengurus:'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                {cloudAuthAvailable ? (
                  <input
                    type="email"
                    autoComplete="username"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={`Username: ${selectedAccount.username}`}
                    value={username || selectedAccount.username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {cloudAuthAvailable ? 'Password Akun:' : 'Password / PIN Keamanan:'}
                </label>
                {cloudAuthAvailable ? (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                  >
                    Lupa password?
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400">Default: <strong className="text-slate-600 font-mono">1234</strong></span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={cloudAuthAvailable ? 'Masukkan password akun' : 'Masukkan PIN / Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Ingat sesi di perangkat ini</span>
              </label>
              {!cloudAuthAvailable && (
                <span className="text-slate-400 text-[11px]">
                  PIN Default: <strong className="font-mono text-slate-600">1234</strong>
                </span>
              )}
            </div>

            {infoMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                <span>{infoMessage}</span>
              </div>
            )}


            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2 font-semibold animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <BadgeCheck className="w-4 h-4" />
                <span>
                  {isLoading
                    ? 'Memverifikasi...'
                    : cloudAuthAvailable
                      ? 'Masuk ke Dashboard Pengurus'
                      : `Masuk Sebagai ${selectedAccount.roleLabel || selectedAccount.namaLengkap}`}
                </span>
                <ArrowRight className="w-4 h-4 ml-1" />

              </button>
            </div>
          </form>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Sistem Kependudukan RT 004 RW 007</span>
          <span>Kelurahan Jatimulya</span>
        </div>
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-8 relative selection:bg-emerald-500 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none"></div>
        <div className="relative z-10 w-full flex flex-col items-center">
          {cardContent}
          <p className="text-center text-slate-500 text-xs mt-6">
            &copy; {new Date().getFullYear()} Pemerintah Kelurahan Jatimulya &bull; Rukun Tetangga 004 Rukun Warga 007
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="bg-slate-950/70 fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto backdrop-blur-md">
      {cardContent}
    </div>
  );
};
