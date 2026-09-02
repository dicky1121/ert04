import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ArrowLeftRight, 
  HeartHandshake, 
  UserCheck, 
  CloudDownload, 
  Download, 
  Building2,
  CalendarDays,
  Store,
  Wallet,
  Coins,
  ChevronDown,
  ChevronRight,
  Database,
  MessageSquareWarning,
  Megaphone,
  Siren,
  X
} from 'lucide-react';
import { RTConfig, CurrentUser } from '../types';
import { BekasiLogo } from './BekasiLogo';
import { authState } from '../services/authState';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  config: RTConfig;
  currentUser: CurrentUser;
  pendingSuratCount?: number;
  ewsBaruCount?: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onExportExcel?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  config,
  currentUser: _currentUser,
  pendingSuratCount = 0,
  ewsBaruCount = 0,
  isOpenMobile = false,
  onCloseMobile,
  onExportExcel
}) => {
  // Collapsible menu groups state
  const isDataWargaActive = ['warga', 'kk', 'mutasi', 'bansos'].includes(activeTab);
  const isSettingActive = ['template-pengantar', 'surat', 'audit', 'integrasi'].includes(activeTab);

  const [isDataWargaOpen, setIsDataWargaOpen] = useState<boolean>(() =>
    ['warga', 'kk', 'mutasi', 'bansos'].includes(activeTab)
  );
  const [isSettingOpen, setIsSettingOpen] = useState<boolean>(() =>
    ['template-pengantar', 'surat', 'audit', 'integrasi'].includes(activeTab)
  );
  const hasCloudSession = authState.hasActiveSession();

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleExportClick = () => {
    if (onExportExcel) {
      onExportExcel();
    } else {
      handleNavClick('integrasi');
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-label="Tutup Menu"
        />
      )}

      {/* Main Sidebar Container */}
      <aside 
        className={`no-print fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-0 lg:bottom-auto lg:h-screen ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Identity & Brand */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div 
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="p-1 rounded-xl bg-slate-50 border border-slate-200 group-hover:border-brand-500 transition-colors shrink-0">
              <BekasiLogo className="w-8 h-9" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-sm text-slate-900 tracking-tight leading-none group-hover:text-brand-700 transition-colors truncate">
                  Sistem Kependudukan
                </span>
              </div>
              <div className="font-bold text-xs text-brand-700 mt-1 leading-none">
                RT {config.namaRT || '004'} / RW {config.namaRW || '007'}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate leading-tight">
                Kelurahan {config.kelurahan || 'Jatimulya'}
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              aria-label="Tutup Sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items (Scrollable) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 no-scrollbar">
          {/* Standalone Dashboard */}
          <div>
            <button
              onClick={() => handleNavClick('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="truncate">Dashboard</span>
            </button>
          </div>

          {/* EWS Darurat — tersedia di semua platform */}
          <div>
            <button
              onClick={() => handleNavClick('ews')}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'ews'
                  ? 'bg-rose-50 text-rose-700 font-bold border-l-3 border-rose-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Siren className={`w-4 h-4 shrink-0 ${activeTab === 'ews' ? 'text-rose-600' : 'text-rose-400'}`} />
                <span className="truncate">EWS Darurat</span>
              </div>
              {ewsBaruCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-bold text-xs shrink-0 animate-pulse">
                  {ewsBaruCount}
                </span>
              )}
            </button>
          </div>

          {/* Pengaduan Warga */}
          <div>
            <button
              onClick={() => handleNavClick('pengaduan')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'pengaduan'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <MessageSquareWarning className={`w-4 h-4 shrink-0 ${activeTab === 'pengaduan' ? 'text-brand-600' : 'text-slate-500'}`} />
              <span className="truncate">Pengaduan Warga</span>
            </button>
          </div>

          {/* Pengumuman RT */}
          <div>
            <button
              onClick={() => handleNavClick('pengumuman')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'pengumuman'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Megaphone className={`w-4 h-4 shrink-0 ${activeTab === 'pengumuman' ? 'text-brand-600' : 'text-slate-500'}`} />
              <span className="truncate">Pengumuman RT</span>
            </button>
          </div>

          {/* Kegiatan RT */}
          <div>
            <button
              onClick={() => handleNavClick('kegiatan')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'kegiatan'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CalendarDays className={`w-4 h-4 shrink-0 ${activeTab === 'kegiatan' ? 'text-brand-600' : 'text-slate-500'}`} />
              <span className="truncate">Kegiatan RT</span>
            </button>
          </div>

          {/* UMKM Warga */}
          <div>
            <button
              onClick={() => handleNavClick('umkm')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'umkm'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Store className={`w-4 h-4 shrink-0 ${activeTab === 'umkm' ? 'text-brand-600' : 'text-slate-500'}`} />
              <span className="truncate">UMKM Warga</span>
            </button>
          </div>

          {/* Keuangan RT */}
          <div>
            <button
              onClick={() => handleNavClick('keuangan')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'keuangan'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wallet className={`w-4 h-4 shrink-0 ${activeTab === 'keuangan' ? 'text-brand-600' : 'text-slate-500'}`} />
              <span className="truncate">Keuangan RT</span>
            </button>
          </div>

          {/* Iuran RT */}
          <div>
            <button
              onClick={() => handleNavClick('iuran')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'iuran'
                  ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Coins className={`w-4 h-4 shrink-0 ${activeTab === 'iuran' ? 'text-brand-600' : 'text-slate-500'}`} />
              <span className="truncate">Iuran RT</span>
            </button>
          </div>

          {/* DATA WARGA Group */}
          <div className="space-y-1">
            <button
              onClick={() => setIsDataWargaOpen(!isDataWargaOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition cursor-pointer select-none"
            >
              <span className="flex items-center gap-1.5">
                <span>DATA WARGA</span>
                {pendingSuratCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse"></span>
                )}
              </span>
              {isDataWargaOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {isDataWargaOpen && (
              <div className="space-y-0.5 pl-1 pt-0.5">
                <button
                  onClick={() => handleNavClick('warga')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'warga'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Users className={`w-4 h-4 shrink-0 ${activeTab === 'warga' ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">Data Warga</span>
                </button>

                <button
                  onClick={() => handleNavClick('kk')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'kk'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'kk' ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">Kartu Keluarga</span>
                </button>

                <button
                  onClick={() => handleNavClick('mutasi')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'mutasi'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <ArrowLeftRight className={`w-4 h-4 shrink-0 ${activeTab === 'mutasi' ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">Mutasi Penduduk</span>
                </button>

                <button
                  onClick={() => handleNavClick('bansos')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'bansos'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <HeartHandshake className={`w-4 h-4 shrink-0 ${activeTab === 'bansos' ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">Prioritas Bansos</span>
                </button>
              </div>
            )}
          </div>

          {/* SETTING Group */}
          <div className="space-y-1">
            <button
              onClick={() => setIsSettingOpen(!isSettingOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition cursor-pointer select-none"
            >
              <span>SETTING</span>
              {isSettingOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {isSettingOpen && (
              <div className="space-y-0.5 pl-1 pt-0.5">
                <button
                  onClick={() => handleNavClick('template-pengantar')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'template-pengantar' || activeTab === 'surat'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'template-pengantar' || activeTab === 'surat' ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="truncate">Template Surat Pengantar</span>
                  </div>
                  {pendingSuratCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs shrink-0">
                      {pendingSuratCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleNavClick('audit')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'audit'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === 'audit' ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">Aktivitas Pengguna</span>
                </button>

                <button
                  onClick={() => handleNavClick('integrasi')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition text-left cursor-pointer ${
                    activeTab === 'integrasi'
                      ? 'bg-emerald-50 text-brand-700 font-bold border-l-3 border-brand-600 shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <CloudDownload className={`w-4 h-4 shrink-0 ${activeTab === 'integrasi' ? 'text-blue-600' : 'text-slate-500'}`} />
                  <span className="truncate">Integrasi</span>
                </button>

                <button
                  onClick={handleExportClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition text-left cursor-pointer"
                  title="Unduh data Excel master kependudukan"
                >
                  <Download className="w-4 h-4 shrink-0 text-brand-600" />
                  <span className="truncate">Ekspor Excel</span>
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Bottom Database Status Block */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Status Database
              </span>
              <span className={`flex items-center gap-1 text-xs font-bold ${hasCloudSession ? 'text-brand-700' : 'text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasCloudSession ? 'bg-brand-500 animate-pulse' : 'bg-slate-400'}`}></span>
                {hasCloudSession ? 'Terhubung' : 'Lokal'}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              {hasCloudSession ? 'Supabase Cloud Database' : 'Penyimpanan Lokal Browser'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
