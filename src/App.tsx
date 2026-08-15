import React, { useState, useEffect } from 'react';
import { 
  storageService 
} from './services/storage';
import { 
  Warga, 
  KartuKeluarga, 
  SuratPengantar, 
  MutasiPenduduk, 
  RTConfig, 
  CurrentUser, 
  AppNotification 
} from './types';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { DataWargaView } from './components/DataWargaView';
import { DataKKView } from './components/DataKKView';
import { LayananSuratView } from './components/LayananSuratView';
import { MutasiPendudukView } from './components/MutasiPendudukView';
import { BansosPrioritasView } from './components/BansosPrioritasView';

import { AuditLogView } from './components/AuditLogView';
import { IntegrasiView } from './components/IntegrasiView';
import { SearchModal } from './components/SearchModal';
import { NotificationModal } from './components/NotificationModal';
import { AuthModal } from './components/AuthModal';
import { LoginPortal } from './components/LoginPortal';
import { authService } from './services/authService';
import { supabaseService } from './services/supabaseService';


export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Application Data States
  const [wargaList, setWargaList] = useState<Warga[]>([]);
  const [kkList, setKkList] = useState<KartuKeluarga[]>([]);
  const [suratList, setSuratList] = useState<SuratPengantar[]>([]);
  const [mutasiList, setMutasiList] = useState<MutasiPenduduk[]>([]);
  const [rtConfig, setRtConfig] = useState<RTConfig>(storageService.getRTConfig());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(storageService.getCurrentUser());

  // Modal Visibility States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Selected entities for deep-linking across views
  const [selectedWargaId, setSelectedWargaId] = useState<string | null>(null);
  const [selectedKKId, setSelectedKKId] = useState<string | null>(null);
  const [selectedSuratId, setSelectedSuratId] = useState<string | null>(null);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync state from storage service
  const refreshAllData = () => {
    setWargaList(storageService.getWargaList());
    setKkList(storageService.getKKList());
    setSuratList(storageService.getSuratList());
    setMutasiList(storageService.getMutasiList());
    setRtConfig(storageService.getRTConfig());
    setNotifications(storageService.getNotifications());
    setCurrentUser(storageService.getCurrentUser());
  };

  useEffect(() => {
    // Initial load
    refreshAllData();

    // Subscribe to storage changes
    const unsubscribe = storageService.subscribe(() => {
      refreshAllData();
    });

    // Keyboard shortcut for Search (Ctrl+K or Cmd+K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Pulihkan sesi Supabase Auth (bila ada) lalu tarik data cloud.
    // Data warga hanya boleh dimuat setelah sesi terverifikasi karena
    // policy RLS di database menolak permintaan tanpa autentikasi.
    if (authService.isCloudAuthAvailable()) {
      authService.initSessionListener((user) => {
        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser(storageService.getCurrentUser());
        }
      });

      void authService.restoreSession().then(async (user) => {
        if (user) {
          setCurrentUser(user);
          await supabaseService.bootstrapFromSupabase();
          refreshAllData();
        } else {
          // Tidak ada sesi valid: pastikan aplikasi kembali ke halaman login.
          storageService.logout();
          setCurrentUser(storageService.getCurrentUser());
        }
      });
    }

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  // Warga Handlers
  const handleSaveWarga = (warga: Warga) => {
    storageService.saveWarga(warga);
    showToast(`Data warga ${warga.nama} berhasil disimpan!`);
  };

  const handleDeleteWarga = (id: string) => {
    storageService.deleteWarga(id);
    showToast('Data warga berhasil dihapus.', 'info');
  };

  // KK Handlers
  const handleSaveKK = (kk: KartuKeluarga) => {
    storageService.saveKK(kk);
    showToast(`Kartu Keluarga ${kk.nomorKK} berhasil disimpan!`);
  };

  const handleDeleteKK = (id: string) => {
    storageService.deleteKK(id);
    showToast('Data Kartu Keluarga berhasil dihapus.', 'info');
  };

  // Surat Pengantar Handlers
  const handleAddSurat = (suratData: any) => {
    const created = storageService.addSurat(suratData);
    showToast(`Surat pengantar ${created.nomorSurat} berhasil dibuat!`);
    setSelectedSuratId(created.id);
    setActiveTab('template-pengantar');

  };

  const handleUpdateSuratStatus = (id: string, status: 'DISETUJUI' | 'DITOLAK', alasan?: string) => {
    storageService.updateSuratStatus(id, status, alasan);
    showToast(status === 'DISETUJUI' ? 'Surat pengantar telah disetujui & siap dicetak!' : 'Surat permohonan telah ditolak.');
  };

  const handleDeleteSurat = (id: string) => {
    storageService.deleteSurat(id);
    showToast('Arsip surat berhasil dihapus.', 'info');
  };

  // Mutasi Handlers
  const handleAddMutasi = (mutasi: MutasiPenduduk) => {
    storageService.addMutasi(mutasi);
    showToast(`Mutasi penduduk ${mutasi.namaWarga} berhasil dicatat.`);
  };

  const handleDeleteMutasi = (id: string) => {
    storageService.deleteMutasi(id);
    showToast('Catatan mutasi dihapus.', 'info');
  };

  // Bansos update
  const handleUpdateBansos = (wargaId: string, statusBansos: any, keterangan?: string) => {
    const target = wargaList.find(w => w.id === wargaId);
    if (target) {
      const updated: Warga = {
        ...target,
        statusBansos,
        keteranganBansos: keterangan || target.keteranganBansos
      };
      storageService.saveWarga(updated);
      showToast(`Status bansos ${target.nama} diperbarui ke ${statusBansos}.`);
    }
  };

  // Config Update
  const handleUpdateConfig = (newConfig: RTConfig) => {
    storageService.saveRTConfig(newConfig);
    showToast('Pengaturan instansi RT 004 RW 007 berhasil diperbarui.');
  };

  // Excel Handlers
  const handleExportExcel = () => {
    storageService.exportToExcel();
    showToast('Berkas Excel kependudukan RT 004 berhasil diunduh!');
  };

  const handleImportExcel = async (file: File) => {
    try {
      const res = await storageService.importFromExcel(file);
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(`Impor gagal: ${res.message}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error impor: ${err.message}`, 'error');
    }
  };

  // Reset Data
  const handleResetData = () => {
    storageService.resetToInitial();
    showToast('Data kependudukan berhasil direset ke pengaturan bawaan.', 'info');
  };

  // Navigation Deep Links
  const handleSelectFromSearch = (type: 'WARGA' | 'KK' | 'SURAT', id: string) => {
    if (type === 'WARGA') {
      setSelectedWargaId(id);
      setActiveTab('warga');
    } else if (type === 'KK') {
      setSelectedKKId(id);
      setActiveTab('kk');
    } else if (type === 'SURAT') {
      setSelectedSuratId(id);
      setActiveTab('surat');
    }
  };

  const handleCreateSuratForWarga = (warga: Warga) => {
    setSelectedWargaId(warga.id);
    setActiveTab('surat');
  };

  const handleLogout = async () => {
    // Tutup sesi di Supabase (token dicabut) sekaligus bersihkan sesi lokal.
    if (authService.isCloudAuthAvailable()) {
      await authService.signOut();
    } else {
      storageService.logout();
    }
    setCurrentUser(storageService.getCurrentUser());
    showToast('Sesi administrasi telah ditutup. Silakan login kembali.', 'info');
  };


  // Gateway check: Show Login Portal first before entering dashboard
  if (!currentUser?.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans selection:bg-emerald-500 selection:text-white">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className={`px-4 py-3 rounded-full shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              toastMessage.type === 'success' ? 'bg-slate-900 text-white border-slate-800' :
              toastMessage.type === 'info' ? 'bg-blue-900 text-blue-100 border-blue-800' :
              'bg-rose-900 text-rose-100 border-rose-800'
            }`}>
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        <LoginPortal
          isFullPage={true}
          currentUser={currentUser}
          config={rtConfig}
          onLogin={(user) => {
            storageService.setCurrentUser(user);
            setCurrentUser(user);
            showToast(`Selamat Datang, ${user.nama}! Berhasil masuk ke dashboard.`);
            setActiveTab('dashboard');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`px-4 py-3 rounded-full shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            toastMessage.type === 'success' ? 'bg-slate-900 text-white border-slate-800' :
            toastMessage.type === 'info' ? 'bg-blue-900 text-blue-100 border-blue-800' :
            'bg-rose-900 text-rose-100 border-rose-800'
          }`}>
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Left Sidebar (Fixed on Desktop, Drawer on Mobile) */}
      <div className="no-print">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setSelectedWargaId(null);
            setSelectedKKId(null);
            setSelectedSuratId(null);
            setActiveTab(tab);
          }}
          config={rtConfig}
          currentUser={currentUser}
          pendingSuratCount={suratList.filter(s => s.status === 'PENDING').length}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onExportExcel={handleExportExcel}
        />
      </div>

      {/* Right Column: Top Bar + Main Content Area + Footer */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <Navbar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setSelectedWargaId(null);
            setSelectedKKId(null);
            setSelectedSuratId(null);
            setActiveTab(tab);
          }}
          config={rtConfig}
          currentUser={currentUser}
          notifications={notifications}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
          pendingSuratCount={suratList.filter(s => s.status === 'PENDING').length}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            wargaList={wargaList}
            kkList={kkList}
            suratList={suratList}
            mutasiList={mutasiList}
            config={rtConfig}
            currentUser={currentUser}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onQuickAddKK={() => setActiveTab('kk')}
            onQuickAddWarga={() => setActiveTab('warga')}
            onQuickAddSurat={() => setActiveTab('surat')}
            onExportExcel={handleExportExcel}
            onApproveSurat={(id) => handleUpdateSuratStatus(id, 'DISETUJUI')}
          />
        )}

        {activeTab === 'warga' && (
          <DataWargaView
            wargaList={wargaList}
            kkList={kkList}
            config={rtConfig}
            onSaveWarga={handleSaveWarga}
            onDeleteWarga={handleDeleteWarga}
            onCreateSurat={handleCreateSuratForWarga}
            selectedWargaId={selectedWargaId}
          />
        )}

        {activeTab === 'kk' && (
          <DataKKView
            kkList={kkList}
            wargaList={wargaList}
            config={rtConfig}
            onSaveKK={handleSaveKK}
            onDeleteKK={handleDeleteKK}
            onCreateSuratForWarga={handleCreateSuratForWarga}
            selectedKKId={selectedKKId}
          />
        )}

        {(activeTab === 'surat' || activeTab === 'template-pengantar') && (
          <LayananSuratView
            config={rtConfig}
            wargaList={wargaList}
            suratList={suratList}
            onSaveConfig={handleUpdateConfig}
            onAddSurat={handleAddSurat}
            onUpdateStatus={handleUpdateSuratStatus}
            onDeleteSurat={handleDeleteSurat}
            selectedSuratId={selectedSuratId}
          />
        )}


        {activeTab === 'mutasi' && (
          <MutasiPendudukView
            mutasiList={mutasiList}
            wargaList={wargaList}
            config={rtConfig}
            onAddMutasi={handleAddMutasi}
            onDeleteMutasi={handleDeleteMutasi}
          />
        )}

        {activeTab === 'bansos' && (
          <BansosPrioritasView
            wargaList={wargaList}
            config={rtConfig}
            onUpdateBansosStatus={handleUpdateBansos}
            onExportExcel={handleExportExcel}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogView
            currentUser={currentUser}
          />
        )}

        {activeTab === 'integrasi' && (
          <IntegrasiView
            config={rtConfig}
            wargaList={wargaList}
            kkList={kkList}
            suratList={suratList}
            mutasiList={mutasiList}
            onUpdateConfig={handleUpdateConfig}
            onExportExcel={handleExportExcel}
            onImportExcel={handleImportExcel}
            onResetData={handleResetData}
            onDataUpdated={refreshAllData}
          />
        )}

      </main>

      {/* Global Modals */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        wargaList={wargaList}
        kkList={kkList}
        suratList={suratList}
        onSelectWarga={(warga) => handleSelectFromSearch('WARGA', warga.id)}
        onSelectKK={(kk) => handleSelectFromSearch('KK', kk.id)}
        onSelectSurat={(surat) => handleSelectFromSearch('SURAT', surat.id)}
      />

      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifikasiList={notifications}
        onMarkRead={(id) => storageService.markNotifikasiRead(id)}
        onMarkAllRead={() => storageService.markAllNotifikasiRead()}
        onClearAll={() => storageService.clearAllNotifikasi()}
        onNavigateTab={(tab, entityId) => {
          setIsNotificationOpen(false);
          if (tab === 'surat' && entityId) {
            setSelectedSuratId(entityId);
          }
          setActiveTab(tab as typeof activeTab);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSwitchRole={(role, nama) => {
          storageService.setCurrentUser({
            role,
            nama,
            isAuthenticated: true,
            isLoggedIn: true
          });
          showToast(`Berhasil beralih ke akun ${nama} (${role})`);
        }}
      />

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 mt-auto py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            &copy; {new Date().getFullYear()} <strong>RT {rtConfig.namaRT} RW {rtConfig.namaRW}</strong> Kelurahan {rtConfig.kelurahan}, Kecamatan {rtConfig.kecamatan}.
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Supabase Cloud Ready</span>
            <span>&bull;</span>
            <span>Excel / Spreadsheet Export</span>
            <span>&bull;</span>
            <span>E-Surat QR Verified</span>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
