import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Bell, 
  LogOut, 
  Menu,
  ShieldAlert,
  Database,
  CheckCircle2
} from 'lucide-react';
import { CurrentUser, Notifikasi, RTConfig } from '../types';
import { authState } from '../services/authState';

interface NavbarProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  currentUser: CurrentUser;
  onOpenAuth: () => void;
  onOpenSearch: () => void;
  onOpenNotif?: () => void;
  onOpenNotifications?: () => void;
  onLogout?: () => void;
  unreadNotifCount?: number;
  notifications?: Notifikasi[];
  config: RTConfig;
  pendingSuratCount?: number;
  onToggleMobileSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onSelectTab,
  currentUser,
  onOpenAuth,
  onOpenSearch,
  onOpenNotif,
  onOpenNotifications,
  onLogout,
  unreadNotifCount,
  notifications,
  config,
  pendingSuratCount = 0,
  onToggleMobileSidebar
}) => {
  const [syncToast, setSyncToast] = useState<{ title: string; detail: string } | null>(null);

  useEffect(() => {
    const handleSyncStatus = (e: any) => {
      if (e.detail) {
        setSyncToast({
          title: e.detail.title || 'Data tersinkron ke Cloud',
          detail: e.detail.detail || ''
        });
        const timer = setTimeout(() => {
          setSyncToast(null);
        }, 3500);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('supabase-sync-status', handleSyncStatus);
    return () => window.removeEventListener('supabase-sync-status', handleSyncStatus);
  }, []);

  const handleNotifClick = () => {
    if (onOpenNotifications) onOpenNotifications();
    else if (onOpenNotif) onOpenNotif();
  };

  const unreadCount = unreadNotifCount !== undefined 
    ? unreadNotifCount 
    : (notifications ? notifications.filter(n => !n.dibaca).length : 0);

  const hasCloudSession = authState.hasActiveSession();
  const isAutoSync = hasCloudSession && config.supabaseAutoSync !== false;

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30">
      {/* Top Official Micro Bar */}
      <div className="bg-slate-950 text-slate-300 px-4 sm:px-6 py-1.5 text-xs font-medium border-b border-slate-800">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-white tracking-tight">
              RT {config.namaRT || '004'} / RW {config.namaRW || '007'} Kel. {config.kelurahan || 'Jatimulya'}
            </span>
            <span className="hidden md:inline text-slate-400 font-normal">&bull; Kec. {config.kecamatan || 'Tambun Selatan'}, {config.kabupatenKota || 'Kab. Bekasi'}</span>
          </div>

          <div className="flex items-center gap-3">
            {pendingSuratCount > 0 && onSelectTab && (
              <button
                onClick={() => onSelectTab('surat')}
                className="flex items-center gap-1 text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer"
                title="Ada surat pengantar menunggu verifikasi"
              >
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span>{pendingSuratCount} Surat Menunggu</span>
              </button>
            )}
            
            {/* Auto-Sync Live Status indicator in micro bar */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-300 font-mono text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${isAutoSync ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              {isAutoSync ? 'Auto-Sync Cloud: Aktif' : hasCloudSession ? 'Cloud: Manual' : 'Penyimpanan Lokal'}
              {config.terakhirSinkron && (
                <span className="text-slate-400 font-normal hidden lg:inline">({config.terakhirSinkron.split(',')[1] || config.terakhirSinkron})</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Auto-Sync Notification Toast */}
      {syncToast && (
        <div className="fixed top-20 right-4 z-40 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-lg border border-emerald-500/40 flex items-center gap-2.5 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-bold text-xs text-emerald-300 flex items-center gap-1">
              <span>{syncToast.title}</span>
            </div>
            {syncToast.detail && (
              <div className="text-xs text-slate-300 font-mono">{syncToast.detail}</div>
            )}
          </div>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="w-full px-4 sm:px-6">
        <div className="flex items-center justify-between h-13 sm:h-14 gap-3 sm:gap-6">
          {/* Left section: Mobile menu trigger & Quick Title indicator */}
          <div className="flex items-center gap-2.5">
            {/* Hamburger Button for Mobile / Tablet */}
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Buka Menu Navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick Context on Tablet/Mobile */}
            <div className="lg:hidden">
              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                RT {config.namaRT || '004'} RW {config.namaRW || '007'}
              </span>
            </div>
          </div>

          {/* Center Search Input Trigger */}
          <div className="flex-1 max-w-md hidden md:block">
            <div 
              onClick={onOpenSearch}
              className="relative cursor-pointer group"
            >
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-hover:text-blue-600 transition-colors">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                readOnly
                placeholder="Cari NIK, Nama Warga, No. KK, atau Surat... (Ctrl+K)"
                className="w-full pl-9 pr-11 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-700 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-all hover:bg-white hover:border-slate-300 shadow-2xs"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <kbd className="bg-white text-slate-400 px-1 py-0.5 rounded text-xs font-mono border border-slate-200 shadow-2xs">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>

          {/* Right Actions & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Search Button */}
            <button
              onClick={onOpenSearch}
              className="md:hidden p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Cari Data"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Database status pill on desktop */}
            <div 
              onClick={() => onSelectTab && onSelectTab('integrasi')}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 cursor-pointer transition"
              title={isAutoSync ? 'Auto-Sync Supabase Cloud Aktif (Klik untuk Pengaturan)' : 'Sync Manual (Klik untuk Pengaturan)'}
            >
              <Database className="w-3 h-3 text-slate-400" />
              <span className="font-medium">{isAutoSync ? 'Auto-Sync Supabase' : 'Lokal / Cloud'}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isAutoSync ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={handleNotifClick}
              className="relative p-2.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Notifikasi"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {/* User Profile Switcher */}
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
              title="Beralih Akun / Ganti Pengurus"
            >
              <div className={`w-6 h-6 rounded-md text-white flex items-center justify-center text-xs font-bold ${
                currentUser.role === 'ADMIN_KETUA_RT'
                  ? 'bg-emerald-700'
                  : currentUser.role === 'ADMIN_SISTEM'
                    ? 'bg-indigo-700'
                    : 'bg-slate-800'
              }`}>
                {currentUser.role === 'ADMIN_KETUA_RT'
                  ? 'RT'
                  : currentUser.role === 'ADMIN_SISTEM'
                    ? 'AS'
                    : 'SK'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                  {currentUser.nama.split(' ')[0]} {currentUser.nama.split(' ')[1] || ''}
                </p>
                <p className="text-xs font-medium text-slate-500 leading-tight">
                  {currentUser.role === 'ADMIN_KETUA_RT'
                    ? 'Ketua RT'
                    : currentUser.role === 'ADMIN_SISTEM'
                      ? 'Administrator Sistem'
                      : 'Sekretaris RT'}
                </p>
              </div>
            </button>

            {/* Logout / Keluar Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-xs font-medium transition cursor-pointer"
                title="Keluar dari Portal Kependudukan"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">Keluar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
