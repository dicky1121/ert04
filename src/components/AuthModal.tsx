import React, { useState } from 'react';
import { CheckCircle2, X, BadgeCheck, KeyRound } from 'lucide-react';
import { CurrentUser, UserRole } from '../types';
import { BekasiLogo } from './BekasiLogo';
import { authService } from '../services/authService';
import { storageService } from '../services/storage';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: CurrentUser;
  onLogin: (user: CurrentUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogin
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role || 'ADMIN_KETUA_RT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const cloudAuthAvailable = authService.isCloudAuthAvailable();
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose, isOpen);

  if (!isOpen) return null;

  const handleSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!password) {
      setErrorMessage(cloudAuthAvailable ? 'Password wajib diisi.' : 'PIN atau password lokal wajib diisi.');
      return;
    }

    setIsLoading(true);
    if (cloudAuthAvailable) {
      const result = await authService.signIn(email, password);
      if (!result.success || !result.user) {
        setErrorMessage(result.message);
        setIsLoading(false);
        return;
      }
      onLogin(result.user);
    } else {
      const account = storageService.getPengurusAccounts().find(item => item.role === selectedRole);
      if (!account) {
        setErrorMessage('Akun lokal untuk peran tersebut tidak ditemukan.');
        setIsLoading(false);
        return;
      }
      const result = storageService.verifyLogin(account.id, password);
      if (!result.success || !result.user) {
        setErrorMessage(result.message);
        setIsLoading(false);
        return;
      }
      onLogin(result.user);
    }
    setPassword('');
    setIsLoading(false);
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white p-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl border border-white/20">
                <BekasiLogo className="w-8 h-10" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Ganti Akses Pengurus RT</h3>
                <p className="text-xs text-emerald-300">RT 004 RW 007 Kelurahan Jatimulya</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white p-2.5 rounded-lg hover:bg-white/10 transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSwitch} className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">
              Pilih Hak Akses Pengurus:
            </label>
            <div className="space-y-2.5">
              {/* Role 1: Ketua RT */}
              <label
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-medium cursor-pointer transition ${
                  selectedRole === 'ADMIN_KETUA_RT'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="role"
                    checked={selectedRole === 'ADMIN_KETUA_RT'}
                    onChange={() => setSelectedRole('ADMIN_KETUA_RT')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Ketua RT 004</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">Admin Utama</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Persetujuan surat pengantar, tanda tangan digital &amp; otorisasi sistem</div>
                  </div>
                </div>
                {selectedRole === 'ADMIN_KETUA_RT' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              </label>

              {/* Role 2: Sekretaris RT */}
              <label
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-medium cursor-pointer transition ${
                  selectedRole === 'ADMIN_SEKRETARIS'
                    ? 'bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="role"
                    checked={selectedRole === 'ADMIN_SEKRETARIS'}
                    onChange={() => setSelectedRole('ADMIN_SEKRETARIS')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Sekretaris RT 004</span>
                      <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">Sekretariat</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Pengelolaan data KK, pendaftaran warga, draf surat &amp; mutasi</div>
                  </div>
                </div>
                {selectedRole === 'ADMIN_SEKRETARIS' && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
              </label>
            </div>
          </div>

          {cloudAuthAvailable && (
            <div>
              <label htmlFor="switch-account-email" className="block text-xs font-bold text-slate-700 mb-1">
                Email akun tujuan
              </label>
              <input
                id="switch-account-email"
                type="email"
                autoComplete="username"
                required
                placeholder="pengurus@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Peran akun ditentukan otomatis dari profil pengurus di server.
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                {cloudAuthAvailable ? 'Password akun tujuan' : 'PIN / password lokal'}
              </label>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder={cloudAuthAvailable ? 'Masukkan password' : 'Masukkan PIN / password lokal'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              {errorMessage}
            </p>
          )}

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <BadgeCheck className="w-4 h-4" />
              <span>{isLoading ? 'Memverifikasi...' : 'Ganti Akun'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

