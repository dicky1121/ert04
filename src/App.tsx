import React, { useState, useEffect, lazy, Suspense } from 'react';
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
  AppNotification,
  ImportPreviewRow
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
import { EWSAdminView } from './components/EWSAdminView';
import { SearchModal } from './components/SearchModal';
import { NotificationModal } from './components/NotificationModal';
import { AuthModal } from './components/AuthModal';
import { LoginPortal } from './components/LoginPortal';
import { SapaWarga } from './components/SapaWarga';
import { authService } from './services/authService';
import { CloudSyncState, supabaseService } from './services/supabaseService';
import { AlertTriangle, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';

// Lazy-load view berat (code-splitting): IntegrasiView (~800 baris) hanya dimuat
// saat tab "Integrasi" pertama kali dibuka — mengecilkan bundle awal.
const IntegrasiView = lazy(() =>
  import('./components/IntegrasiView').then((m) => ({ default: m.IntegrasiView }))
);

// Fallback ringan saat chunk view berat sedang diunduh.
const ViewLoader: React.FC = () => (
  <div className="flex items-center justify-center py-20 text-slate-500">
    <Loader2 className="w-6 h-6 animate-spin" />
  </div>
);

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
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [syncState, setSyncState] = useState<CloudSyncState>(supabaseService.getSyncState());
  const [publicGatewayView, setPublicGatewayView] = useState<'welcome' | 'login'>('welcome');
  const [ewsBaruCount, setEwsBaruCount] = useState(0);

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
    const unsubscribeSync = supabaseService.subscribeSyncState(setSyncState);

    // Subscribe realtime EWS untuk badge notifikasi di sidebar
    const unsubscribeEWS = supabaseService.subscribeEWSRealtime(() => {
      setEwsBaruCount(prev => prev + 1);
    });

    // Listener: notification EWS di-tap, navigasi ke tab EWS
    const handleEWSNotificationTapped = () => {
      setActiveTab('ews');
      setEwsBaruCount(0); // Reset badge
    };
    window.addEventListener('ews-notification-tapped', handleEWSNotificationTapped);

    // Listener: notification EWS diterima saat foreground, tampilkan toast
    const handleEWSNotificationForeground = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      showToast(`🚨 ${detail.title}: ${detail.body}`, 'info');
    };
    window.addEventListener('ews-notification-foreground', handleEWSNotificationForeground);

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
          // Pull awal dijalankan oleh restoreSession() atau callback LoginPortal.
          // Listener ini hanya menjaga lifecycle channel saat auth berubah.
          supabaseService.startRealtimeSync();
        } else {
          supabaseService.stopRealtimeSync();
          setCurrentUser(storageService.getCurrentUser());
        }
      });

      void authService.restoreSession().then(async (user) => {
        if (user) {
          setCurrentUser(user);
          const bootstrap = await supabaseService.bootstrapFromSupabase();
          refreshAllData();
          if (bootstrap.pulled) supabaseService.startRealtimeSync();
        } else {
          // Tidak ada sesi valid: pastikan aplikasi kembali ke halaman login.
          storageService.logout();
          setCurrentUser(storageService.getCurrentUser());
        }
      }).finally(() => {
        setIsBootstrapping(false);
      });
    } else {
      setIsBootstrapping(false);
    }

    const handleOnline = async () => {
      if (!supabaseService.isCloudMode()) return;
      const bootstrap = await supabaseService.bootstrapFromSupabase();
      refreshAllData();
      if (bootstrap.pulled) supabaseService.startRealtimeSync();
    };
    const handleOffline = () => supabaseService.markOffline();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      unsubscribeSync();
      unsubscribeEWS();
      supabaseService.stopRealtimeSync();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ews-notification-tapped', handleEWSNotificationTapped);
      window.removeEventListener('ews-notification-foreground', handleEWSNotificationForeground);
    };
  }, []);


  // Warga Handlers
  const handleSaveWarga = async (warga: Warga): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoSyncWarga(warga);
      if (!result.success) {
        showToast(`Data warga gagal disimpan: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.saveWarga(warga);
    showToast(`Data warga ${warga.nama} berhasil disimpan!`);
    return true;
  };

  const handleDeleteWarga = async (id: string): Promise<boolean> => {
    const target = wargaList.find(w => w.id === id);
    if (!target) return false;
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoDeleteWarga(target.nik);
      if (!result.success) {
        showToast(`Data warga gagal dihapus: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.deleteWarga(id);
    showToast('Data warga berhasil dihapus.', 'info');
    return true;
  };

  const handleImportWarga = async (
    rows: ImportPreviewRow[],
    updateExisting: boolean,
    clearExistingBeforeImport: boolean
  ): Promise<{ success: boolean; result?: { added: number; updated: number; skipped: number }; error?: string }> => {
    const prepared = storageService.commitImportData(rows, updateExisting, clearExistingBeforeImport, false);
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.pushAllToSupabase({
        warga: prepared.wargaList,
        kk: prepared.kkList,
        surat: suratList,
        mutasi: mutasiList,
        replacePopulation: clearExistingBeforeImport
      });
      if (!result.success) {
        showToast(`Impor gagal disimpan ke cloud: ${result.error || result.message}`, 'error');
        return { success: false, error: result.error || result.message };
      }
    }
    storageService.saveWargaList(prepared.wargaList);
    storageService.saveKKList(prepared.kkList);
    storageService.addAuditLog(
      'Impor Data Spreadsheet',
      `${prepared.added} Baru, ${prepared.updated} Diperbarui`,
      `Impor berhasil disimpan${supabaseService.isCloudMode() ? ' ke Supabase Cloud dan cache perangkat' : ' ke perangkat'}.`
    );
    showToast(`Impor selesai: ${prepared.added} ditambahkan dan ${prepared.updated} diperbarui.`);
    return { success: true, result: prepared };
  };

  // KK Handlers
  const handleSaveKK = async (kk: KartuKeluarga): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoSyncKK(kk);
      if (!result.success) {
        showToast(`Kartu Keluarga gagal disimpan: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.saveKK(kk);
    showToast(`Kartu Keluarga ${kk.nomorKK} berhasil disimpan!`);
    return true;
  };

  const handleDeleteKK = async (id: string): Promise<boolean> => {
    const target = kkList.find(k => k.id === id);
    if (!target) return false;
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoDeleteKK(target.nomorKK);
      if (!result.success) {
        showToast(`Kartu Keluarga gagal dihapus: ${result.error || 'masih digunakan warga atau koneksi bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.deleteKK(id);
    showToast('Data Kartu Keluarga berhasil dihapus.', 'info');
    return true;
  };

  // Surat Pengantar Handlers
  const handleAddSurat = async (suratData: SuratPengantar): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoSyncSurat(suratData);
      if (!result.success) {
        showToast(`Surat gagal disimpan: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    const created = storageService.addSurat(suratData);
    showToast(`Surat pengantar ${created.nomorSurat} berhasil dibuat!`);
    setSelectedSuratId(created.id);
    setActiveTab('template-pengantar');
    return true;
  };

  const handleUpdateSuratStatus = async (id: string, status: 'DISETUJUI' | 'DITOLAK', alasan?: string): Promise<boolean> => {
    const target = suratList.find(s => s.id === id);
    if (!target) return false;
    const updated: SuratPengantar = {
      ...target,
      status,
      tanggalDisetujui: status === 'DISETUJUI' ? new Date().toISOString().split('T')[0] : target.tanggalDisetujui,
      alasanPenolakan: status === 'DITOLAK' ? (alasan || 'Persyaratan administrasi belum lengkap') : undefined
    };
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoSyncSurat(updated);
      if (!result.success) {
        showToast(`Status surat gagal diperbarui: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.updateSuratStatus(id, status, alasan);
    showToast(status === 'DISETUJUI' ? 'Surat pengantar telah disetujui & siap dicetak!' : 'Surat permohonan telah ditolak.');
    return true;
  };

  const handleDeleteSurat = async (id: string): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoDeleteSurat(id);
      if (!result.success) {
        showToast(`Arsip surat gagal dihapus: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.deleteSurat(id);
    showToast('Arsip surat berhasil dihapus.', 'info');
    return true;
  };

  // Mutasi Handlers
  const handleAddMutasi = async (mutasi: MutasiPenduduk): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoSyncMutasi(mutasi);
      if (!result.success) {
        showToast(`Mutasi gagal disimpan: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.addMutasi(mutasi);
    showToast(`Mutasi penduduk ${mutasi.namaWarga} berhasil dicatat.`);
    return true;
  };

  const handleDeleteMutasi = async (id: string): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoDeleteMutasi(id);
      if (!result.success) {
        showToast(`Catatan mutasi gagal dihapus: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.deleteMutasi(id);
    showToast('Catatan mutasi dihapus.', 'info');
    return true;
  };

  // Bansos update
  const handleUpdateBansos = async (wargaId: string, statusBansos: any, keterangan?: string) => {
    const target = wargaList.find(w => w.id === wargaId);
    if (target) {
      const updated: Warga = {
        ...target,
        statusBansos,
        keteranganBansos: keterangan || target.keteranganBansos
      };
      const saved = await handleSaveWarga(updated);
      if (saved) showToast(`Status bansos ${target.nama} diperbarui ke ${statusBansos}.`);
    }
  };

  // Config Update
  const handleUpdateConfig = async (newConfig: RTConfig): Promise<boolean> => {
    if (supabaseService.isCloudMode()) {
      const result = await supabaseService.autoSyncConfig(newConfig);
      if (!result.success) {
        // Tabel konfigurasi bersama belum dibuat: pengaturan tetap disimpan di
        // perangkat ini agar hasil kerja admin tidak hilang, tetapi pengurus
        // diberi tahu bahwa template belum tersebar ke admin lain.
        if (result.tableMissing) {
          storageService.saveRTConfig(newConfig);
          showToast(
            `Pengaturan disimpan di perangkat ini, tetapi belum dibagikan ke admin lain. ${result.error}`,
            'error'
          );
          return true;
        }
        showToast(`Pengaturan gagal disimpan ke cloud: ${result.error || 'koneksi cloud bermasalah'}`, 'error');
        return false;
      }
    }
    storageService.saveRTConfig(newConfig);
    showToast(`Pengaturan berhasil disimpan${supabaseService.isCloudMode() ? ' dan dibagikan ke seluruh admin' : ' di perangkat ini'}.`);
    return true;

  };

  // Excel Handlers
  const handleExportExcel = () => {
    storageService.exportToExcel();
    showToast('Berkas Excel kependudukan RT 004 berhasil diunduh!');
  };

  const handleImportExcel = async (file: File) => {
    try {
      const analysis = await storageService.analyzeImportFile(file);
      const rows = analysis.parsedRows.filter(row => row.isValid && row.nama.trim().length > 0);
      if (rows.length === 0) throw new Error('Tidak ada baris warga valid yang ditemukan.');
      const imported = await handleImportWarga(rows, true, false);
      if (!imported.success) throw new Error(imported.error || 'Sinkronisasi impor gagal.');
    } catch (err: any) {
      showToast(`Error impor: ${err.message}`, 'error');
    }
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
    supabaseService.stopRealtimeSync();
    if (authService.isCloudAuthAvailable()) {
      await authService.signOut();
    } else {
      storageService.logout();
    }
    setCurrentUser(storageService.getCurrentUser());
    setPublicGatewayView('welcome');
    showToast('Sesi administrasi telah ditutup. Silakan login kembali.', 'info');
  };


  if (isBootstrapping) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="text-center" role="status" aria-live="polite">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-400" />
          <p className="mt-4 text-sm font-semibold">Memulihkan sesi pengurus</p>
          <p className="mt-1 text-xs text-slate-400">Mengambil data terbaru dari Supabase Cloud...</p>
        </div>
      </div>
    );
  }

  // Public gateway: warga melihat portal layanan, sedangkan pengurus dapat
  // membuka login. Sesi yang sudah valid tetap langsung menuju dashboard.
  if (!currentUser?.isLoggedIn) {
    if (publicGatewayView === 'welcome') {
      return <SapaWarga config={rtConfig} onOpenLogin={() => setPublicGatewayView('login')} />;
    }

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
          onClose={() => setPublicGatewayView('welcome')}
          onLogin={(user) => {
            storageService.setCurrentUser(user);
            setCurrentUser(user);
            showToast(`Selamat Datang, ${user.nama}! Berhasil masuk ke dashboard.`);
            setActiveTab('dashboard');
            if (authService.isCloudAuthAvailable()) {
              void supabaseService.bootstrapFromSupabase().then(() => {
                refreshAllData();
                supabaseService.startRealtimeSync();
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 inset-x-3 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in fade-in slide-in-from-top-4 duration-200">
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
            // Reset badge EWS saat tab EWS dibuka
            if (tab === 'ews') setEwsBaruCount(0);
          }}
          config={rtConfig}
          currentUser={currentUser}
          pendingSuratCount={suratList.filter(s => s.status === 'PENDING').length}
          ewsBaruCount={ewsBaruCount}
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
      {syncState.phase !== 'online' && syncState.phase !== 'local' && (
        <div className={`no-print border-b px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 ${
          syncState.phase === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
          syncState.phase === 'offline' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`} role="status" aria-live="polite">
          {syncState.phase === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> :
           syncState.phase === 'offline' ? <CloudOff className="w-4 h-4 shrink-0" /> :
           syncState.phase === 'syncing' ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> :
           <Cloud className="w-4 h-4 shrink-0" />}
          <span>{syncState.message || 'Menghubungkan ke Supabase Cloud...'}</span>
        </div>
      )}
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
            onImportWarga={handleImportWarga}
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

        {activeTab === 'ews' && (
          <EWSAdminView
            currentUser={currentUser}
          />
        )}

        {activeTab === 'integrasi' && (
          <Suspense fallback={<ViewLoader />}>
            <IntegrasiView
              config={rtConfig}
              wargaList={wargaList}
              kkList={kkList}
              suratList={suratList}
              mutasiList={mutasiList}
              onUpdateConfig={handleUpdateConfig}
              onExportExcel={handleExportExcel}
              onImportExcel={handleImportExcel}
              onDataUpdated={refreshAllData}
            />
          </Suspense>
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
        onLogin={(user) => {
          storageService.setCurrentUser(user);
          setCurrentUser(user);
          showToast(`Berhasil beralih ke akun ${user.nama} (${user.role})`);
        }}
      />

      {/* Footer */}
      <footer className="no-print bg-white border-t border-slate-200 mt-auto py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            &copy; {new Date().getFullYear()} <strong>RT {rtConfig.namaRT} RW {rtConfig.namaRW}</strong> Kelurahan {rtConfig.kelurahan}, Kecamatan {rtConfig.kecamatan}.
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
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
