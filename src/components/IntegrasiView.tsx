import React, { useState } from 'react';
import { 
  Database, 
  FileSpreadsheet, 
  Settings, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  HardDrive, 
  FileUp, 
  FileDown, 
  Save, 
  RotateCcw,
  Sparkles,
  ExternalLink,
  Lock,
  Shield,
  ShieldCheck,
  Key,
  EyeOff,
  Eye,
  Trash2,
  UserPlus,
  Edit3,
  Users,
  Plus,
  X,
  UserCheck
} from 'lucide-react';
import { RTConfig, KartuKeluarga, Warga, SuratPengantar, MutasiPenduduk, PengurusAccount, UserRole } from '../types';
import { supabaseService } from '../services/supabaseService';
import { storageService } from '../services/storage';
import { useConfirm } from './ConfirmDialog';


interface IntegrasiViewProps {
  config: RTConfig;
  wargaList: Warga[];
  kkList: KartuKeluarga[];
  suratList: SuratPengantar[];
  mutasiList: MutasiPenduduk[];
  onUpdateConfig: (newConfig: RTConfig) => void;
  onExportExcel: () => void;
  onImportExcel: (file: File) => void;
  onResetData: () => void;
  onDataUpdated?: () => void;
}

export const IntegrasiView: React.FC<IntegrasiViewProps> = ({
  config,
  wargaList,
  kkList,
  suratList,
  mutasiList,
  onUpdateConfig,
  onExportExcel,
  onImportExcel,
  onResetData,
  onDataUpdated
}) => {
  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState(supabaseService.getSupabaseConfig().url);
  const [supabaseKey, setSupabaseKey] = useState(supabaseService.getSupabaseConfig().anonKey);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(config.supabaseAutoSync !== false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [pullResult, setPullResult] = useState<{ success: boolean; message: string; counts?: any } | null>(null);
  const [hasCopiedSQL, setHasCopiedSQL] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [sqlTab, setSqlTab] = useState<'schema' | 'data'>('data');

  // Security & PIN Management
  const [selectedRolePin, setSelectedRolePin] = useState<'ADMIN_KETUA_RT' | 'ADMIN_SEKRETARIS'>('ADMIN_KETUA_RT');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ text: string; success: boolean } | null>(null);
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(storageService.isPrivacyMaskEnabled());

  // Derived Supabase project details
  const parsedConn = supabaseService.parseInput(supabaseUrl);
  const currentProjectRef = parsedConn.projectRef || 'nginmiqjfzycvbbufbev';
  const apiSettingsUrl = `https://supabase.com/dashboard/project/${currentProjectRef}/settings/api`;
  const sqlEditorUrl = `https://supabase.com/dashboard/project/${currentProjectRef}/sql/new`;

  // RT Config State
  const [rtConfigData, setRtConfigData] = useState<RTConfig>({ ...config });
  const [isSavedConfig, setIsSavedConfig] = useState(false);

  // Pengurus Accounts State
  const [pengurusAccounts, setPengurusAccounts] = useState<PengurusAccount[]>(storageService.getPengurusAccounts());
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<PengurusAccount | null>(null);
  
  // New Admin Form State
  const [formUsername, setFormUsername] = useState('');
  const [formNamaLengkap, setFormNamaLengkap] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('ADMIN_CUSTOM');
  const [formRoleLabel, setFormRoleLabel] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formJabatan, setFormJabatan] = useState('');
  const [adminFormMsg, setAdminFormMsg] = useState<{ text: string; success: boolean } | null>(null);

  // File import ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Dialog konfirmasi bergaya aplikasi (pengganti window.confirm/alert)
  const { confirm: askConfirm, notify, dialog } = useConfirm();


  const refreshAccounts = () => {
    setPengurusAccounts(storageService.getPengurusAccounts());
  };

  const handleOpenAddAdmin = () => {
    setEditingAdmin(null);
    setFormUsername('');
    setFormNamaLengkap('');
    setFormRole('ADMIN_CUSTOM');
    setFormRoleLabel('Staf Pelayanan RT');
    setFormPin('1234');
    setFormPhone('');
    setFormJabatan('');
    setAdminFormMsg(null);
    setIsAddingAdmin(true);
  };

  const handleOpenEditAdmin = (acc: PengurusAccount) => {
    setEditingAdmin(acc);
    setFormUsername(acc.username);
    setFormNamaLengkap(acc.namaLengkap);
    setFormRole(acc.role);
    setFormRoleLabel(acc.roleLabel);
    setFormPin(acc.pinOrPassword || '1234');
    setFormPhone(acc.nomorHp || '');
    setFormJabatan(acc.jabatanKhusus || '');
    setAdminFormMsg(null);
    setIsAddingAdmin(true);
  };

  const handleSaveAdminAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNamaLengkap.trim()) {
      setAdminFormMsg({ text: 'Nama lengkap pengurus wajib diisi.', success: false });
      return;
    }
    if (!formUsername.trim()) {
      setAdminFormMsg({ text: 'Username wajib diisi.', success: false });
      return;
    }
    if (!formPin || formPin.length < 4) {
      setAdminFormMsg({ text: 'PIN / Password minimal 4 karakter.', success: false });
      return;
    }

    if (editingAdmin) {
      // Update existing
      const updated = storageService.updatePengurusAccount(editingAdmin.id, {
        username: formUsername.trim().toLowerCase().replace(/\s+/g, '_'),
        namaLengkap: formNamaLengkap.trim(),
        role: formRole,
        roleLabel: formRoleLabel.trim() || formRole,
        pinOrPassword: formPin,
        nomorHp: formPhone.trim(),
        jabatanKhusus: formJabatan.trim()
      });

      if (updated) {
        if (formRole === 'ADMIN_SEKRETARIS') {
          storageService.updateSekretarisName(formNamaLengkap.trim());
          setRtConfigData(prev => ({ ...prev, namaSekretaris: formNamaLengkap.trim() }));
          onUpdateConfig({ ...rtConfigData, namaSekretaris: formNamaLengkap.trim() });
        } else if (formRole === 'ADMIN_KETUA_RT') {
          storageService.updateKetuaRTName(formNamaLengkap.trim());
          setRtConfigData(prev => ({ ...prev, namaKetuaRT: formNamaLengkap.trim() }));
          onUpdateConfig({ ...rtConfigData, namaKetuaRT: formNamaLengkap.trim() });
        }
        refreshAccounts();
        setAdminFormMsg({ text: 'Data akun pengurus berhasil diperbarui!', success: true });
        setTimeout(() => setIsAddingAdmin(false), 1200);
      } else {
        setAdminFormMsg({ text: 'Gagal memperbarui akun pengurus.', success: false });
      }
    } else {
      // Add new
      const newAcc: PengurusAccount = {
        id: `usr-rt004-${Date.now().toString().slice(-4)}`,
        username: formUsername.trim().toLowerCase().replace(/\s+/g, '_'),
        namaLengkap: formNamaLengkap.trim(),
        role: formRole,
        roleLabel: formRoleLabel.trim() || 'Admin Tambahan RT',
        pinOrPassword: formPin,
        nomorHp: formPhone.trim(),
        jabatanKhusus: formJabatan.trim() || undefined,
        isActive: true,
        terakhirLogin: 'Belum pernah login',
        dibuatPada: new Date().toISOString()
      };

      storageService.addPengurusAccount(newAcc);
      refreshAccounts();
      setAdminFormMsg({ text: 'Akun pengurus/admin baru berhasil ditambahkan!', success: true });
      setTimeout(() => setIsAddingAdmin(false), 1200);
    }
  };

  const handleDeleteAdmin = async (id: string, name: string) => {
    const setuju = await askConfirm({
      title: 'Hapus Akun Pengurus',
      message: `Akun pengurus "${name}" akan dihapus dan tidak dapat lagi digunakan untuk masuk ke sistem. Lanjutkan?`,
      confirmLabel: 'Ya, Hapus Akun',
      tone: 'danger'
    });
    if (!setuju) return;

    const ok = storageService.deletePengurusAccount(id);
    if (ok) {
      refreshAccounts();
    } else {
      await notify({
        title: 'Akun Tidak Dapat Dihapus',
        message: 'Akun Ketua RT utama merupakan akun induk sistem sehingga tidak dapat dihapus.',
        tone: 'warning'
      });
    }
  };


  const handleUrlChange = (val: string) => {
    const parsed = supabaseService.parseInput(val);
    if (parsed.projectUrl && parsed.projectUrl !== val && parsed.isPostgresUri) {
      setSupabaseUrl(parsed.projectUrl);
      supabaseService.saveSupabaseConfig(parsed.projectUrl, supabaseKey);
    } else {
      setSupabaseUrl(val);
      supabaseService.saveSupabaseConfig(val, supabaseKey);
    }
  };

  const handleTestSupabase = async () => {
    setIsTesting(true);
    setTestResult(null);
    supabaseService.saveSupabaseConfig(supabaseUrl, supabaseKey);
    const res = await supabaseService.testConnection();
    setTestResult(res);
    setIsTesting(false);
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    const updated: RTConfig = { ...config, supabaseAutoSync: enabled };
    setRtConfigData(updated);
    onUpdateConfig(updated);
    storageService.saveConfig(updated);
  };

  const handlePushToSupabase = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    supabaseService.saveSupabaseConfig(supabaseUrl, supabaseKey);
    const res = await supabaseService.pushAllToSupabase({
      kk: kkList,
      warga: wargaList,
      surat: suratList,
      mutasi: mutasiList,
      config: rtConfigData
    });

    if (res.success) {
      setSyncMessage('Berhasil menyinkronkan seluruh data warga ke database Supabase Cloud!');
    } else {
      setSyncMessage(`Gagal sinkronisasi: ${res.error}`);
    }
    setIsSyncing(false);
  };

  const handlePullFromSupabase = async () => {
    setIsPulling(true);
    setPullResult(null);
    supabaseService.saveSupabaseConfig(supabaseUrl, supabaseKey);
    const res = await supabaseService.pullFromSupabase();
    setPullResult(res);
    setIsPulling(false);
    if (res.success && onDataUpdated) {
      onDataUpdated();
    }
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);

    if (newPin !== confirmNewPin) {
      setPinChangeMsg({ text: 'Konfirmasi PIN baru tidak cocok.', success: false });
      return;
    }

    const res = storageService.updatePengurusPin(selectedRolePin, oldPin, newPin);
    setPinChangeMsg({ text: res.message, success: res.success });
    if (res.success) {
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
    }
  };

  const handleTogglePrivacy = () => {
    const next = storageService.togglePrivacyMask();
    setIsPrivacyMasked(next);
  };

  const handleClearAllDummyData = async () => {
    const setuju = await askConfirm({
      title: 'Bersihkan Seluruh Data Demo',
      message:
        'Semua data contoh warga & Kartu Keluarga di penyimpanan lokal akan dihapus menjadi 0, agar siap diisi data warga asli atau ditarik bersih dari Supabase. Tindakan ini tidak dapat dibatalkan.',
      confirmLabel: 'Ya, Bersihkan Data',
      tone: 'danger'
    });
    if (!setuju) return;

    storageService.clearAllDummyData();
    if (onDataUpdated) onDataUpdated();
    await notify({
      title: 'Data Contoh Telah Dibersihkan',
      message: 'Database lokal Anda kini bersih dan siap diisi data kependudukan riil RT.',
      tone: 'info'
    });
  };

  const handleResetToSampleData = async () => {
    const setuju = await askConfirm({
      title: 'Kembalikan Data Contoh',
      message:
        'Data kependudukan akan dikembalikan ke contoh awal RT 004 RW 007 Jatimulya. Perubahan data yang belum dibackup akan hilang.',
      confirmLabel: 'Ya, Kembalikan',
      tone: 'warning'
    });
    if (setuju) onResetData();
  };


  const handleCopySQL = () => {
    const sql = sqlTab === 'data' 
      ? supabaseService.generateDataInsertSQL(wargaList, kkList)
      : supabaseService.generateSQLSchema();
    navigator.clipboard.writeText(sql);
    setHasCopiedSQL(true);
    setTimeout(() => setHasCopiedSQL(false), 3000);
  };

  const handleDownloadWargaCSV = () => {
    const headers = [
      'id', 'nik', 'nomor_kk', 'nama', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir',
      'agama', 'pendidikan', 'pekerjaan', 'status_perkawinan', 'status_hubungan_kk',
      'kewarganegaraan', 'golongan_darah', 'nomor_hp', 'status_tinggal', 'status_bansos',
      'is_lansia', 'is_balita', 'is_yatim', 'is_disabilitas', 'catatan'
    ];
    const rows = wargaList.map(w => [
      `"${w.id}"`, `"${w.nik}"`, `"${w.nomorKK}"`, `"${w.nama.replace(/"/g, '""')}"`,
      `"${w.jenisKelamin}"`, `"${w.tempatLahir}"`, `"${w.tanggalLahir}"`, `"${w.agama}"`,
      `"${w.pendidikan}"`, `"${w.pekerjaan}"`, `"${w.statusPerkawinan}"`, `"${w.statusHubunganKK}"`,
      `"${w.kewarganegaraan}"`, `"${w.golonganDarah}"`, `"${w.nomorHp || '-'}"`, `"${w.statusTinggal}"`,
      `"${w.statusBansos || 'TIDAK_ADA'}"`, w.isLansia ? 'TRUE' : 'FALSE', w.isBalita ? 'TRUE' : 'FALSE',
      w.isYatim ? 'TRUE' : 'FALSE', w.isDisabilitas ? 'TRUE' : 'FALSE', `"${(w.catatan || '').replace(/"/g, '""')}"`
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `warga_rt004_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadKKCSV = () => {
    const headers = [
      'id', 'nomor_kk', 'kepala_keluarga_nama', 'kepala_keluarga_nik', 'alamat',
      'rt', 'rw', 'kelurahan', 'kecamatan', 'kabupaten_kota', 'provinsi', 'kode_pos',
      'status_domisili', 'blok_rumah'
    ];
    const rows = kkList.map(k => [
      `"${k.id}"`, `"${k.nomorKK}"`, `"${k.kepalaKeluargaNama.replace(/"/g, '""')}"`,
      `"${k.kepalaKeluargaNik}"`, `"${k.alamat.replace(/"/g, '""')}"`, `"${k.rt || '004'}"`,
      `"${k.rw || '007'}"`, `"${k.kelurahan || 'Jatimulya'}"`, `"${k.kecamatan || 'Tambun Selatan'}"`,
      `"${k.kabupatenKota || 'Kabupaten Bekasi'}"`, `"${k.provinsi || 'Jawa Barat'}"`,
      `"${k.kodePos || '17510'}"`, `"${k.statusDomisili || 'TETAP'}"`, `"${k.blokRumah || ''}"`
    ].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kartu_keluarga_rt004_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.updateSekretarisName(rtConfigData.namaSekretaris);
    storageService.updateKetuaRTName(rtConfigData.namaKetuaRT);
    storageService.updateSecretariatAddress(rtConfigData.alamatSekretariat);
    onUpdateConfig(rtConfigData);
    refreshAccounts();
    setIsSavedConfig(true);
    setTimeout(() => setIsSavedConfig(false), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportExcel(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Dialog konfirmasi/notifikasi terpusat */}
      {dialog}

      {/* Top Header */}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          Pusat Integrasi Supabase Cloud, Spreadsheet & Konfigurasi RT
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Sinkronisasi cloud database real-time, backup spreadsheet multi-sheet, dan pengaturan data resmi RT 004 RW 007
        </p>
      </div>

      {/* Grid 2 Column for Supabase & Spreadsheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Supabase Cloud Integration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Supabase Database Cloud</h3>
                <p className="text-[11px] text-slate-500">Penyimpanan kependudukan real-time & backup cloud</p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200">
              Active Ready
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Project Indicator Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-500 font-medium">Supabase Project Ref:</div>
                <div className="font-mono font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  {currentProjectRef}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href={apiSettingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 text-[11px] shadow-2xs transition"
                >
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                  Ambil Anon API Key
                </a>
                <a
                  href={sqlEditorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 text-[11px] shadow-2xs transition"
                >
                  <ExternalLink className="w-3 h-3 text-emerald-600" />
                  Buka SQL Editor
                </a>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Supabase Project URL atau Connection String
              </label>
              <input
                type="text"
                placeholder="https://nginmiqjfzycvbbufbev.supabase.co atau postgresql://..."
                value={supabaseUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                *Dapat berupa URL HTTPS (contoh: <code>https://{currentProjectRef}.supabase.co</code>) atau URI PostgreSQL pooler.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">Supabase Anon Public API Key</label>
                <a
                  href={apiSettingsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold underline flex items-center gap-0.5"
                >
                  Cari di Project Settings &gt; API
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => {
                  setSupabaseKey(e.target.value);
                  supabaseService.saveSupabaseConfig(supabaseUrl, e.target.value);
                }}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Auto-Sync Realtime Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${autoSyncEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <RefreshCw className={`w-4 h-4 ${autoSyncEnabled ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    Otomatis Sinkron (Auto-Sync Cloud)
                    {autoSyncEnabled ? (
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                        Non-Aktif
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Setiap penambahan atau update data warga & KK baru akan langsung otomatis tersinkron ke database Supabase Cloud.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={isTesting}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Menguji...' : 'Uji Koneksi'}
              </button>

              <button
                type="button"
                onClick={handlePullFromSupabase}
                disabled={isPulling}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Tarik seluruh data kependudukan dari database Supabase ke WebApp"
              >
                <DownloadCloud className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
                {isPulling ? 'Menarik Data...' : 'Tarik Data dari Supabase (Pull)'}
              </button>

              <button
                type="button"
                onClick={handlePushToSupabase}
                disabled={isSyncing}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Unggah seluruh data lokal ke tabel Supabase Cloud"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                {isSyncing ? 'Mengunggah...' : 'Unggah ke Supabase (Push)'}
              </button>

              <button
                type="button"
                onClick={() => setShowSQL(!showSQL)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                {showSQL ? 'Sembunyikan SQL' : 'Generator SQL & CSV'}
              </button>
            </div>

            {pullResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                pullResult.success ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {pullResult.success ? <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold">{pullResult.message}</div>
                  {pullResult.counts && (
                    <div className="text-[11px] text-blue-800 mt-1 flex flex-wrap gap-2">
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200">Warga: {pullResult.counts.warga}</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200">KK: {pullResult.counts.kk}</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-blue-200">Surat: {pullResult.counts.surat}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {testResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                testResult.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                <div>{testResult.message}</div>
              </div>
            )}

            {syncMessage && (
              <div className="p-3 rounded-xl text-xs bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncMessage}</span>
              </div>
            )}

            {/* SQL & CSV Drawer */}
            {showSQL && (
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSqlTab('data')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        sqlTab === 'data' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Script INSERT Data Warga ({wargaList.length} Jiwa)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlTab('schema')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        sqlTab === 'schema' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Skema Tabel (DDL)
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopySQL}
                      className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow"
                    >
                      {hasCopiedSQL ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {hasCopiedSQL ? 'Tersalin!' : 'Salin SQL'}
                    </button>
                  </div>
                </div>

                <pre className="text-[10px] font-mono overflow-x-auto max-h-56 p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 whitespace-pre">
                  {sqlTab === 'data' 
                    ? supabaseService.generateDataInsertSQL(wargaList, kkList)
                    : supabaseService.generateSQLSchema()
                  }
                </pre>

                {/* Direct CSV Importers for Supabase Table Editor */}
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-300">
                    Opsi Impor Langsung via CSV (Drag & Drop di Supabase Table Editor):
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadWargaCSV}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unduh CSV Warga (warga_rt004.csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadKKCSV}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                      <span>Unduh CSV KK (kartu_keluarga_rt004.csv)</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    *Tarik dan lepas (drag &amp; drop) berkas CSV di atas ke menu <strong>Table Editor &gt; warga_rt004</strong> di Supabase Anda untuk memasukkan data secara instan.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Spreadsheet & Google Drive Sync */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Spreadsheet & Drive Backup</h3>
                <p className="text-[11px] text-slate-500">Ekspor/impor Excel multi-sheet (.xlsx) dan Google Drive</p>
              </div>
            </div>
            <span className="text-[10px] px-2.5 py-1 bg-teal-50 text-teal-700 font-bold rounded-full border border-teal-200">
              Excel / Sheets Ready
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <p className="text-slate-600 text-xs">
              Sistem telah dilengkapi parser file spreadsheet untuk menghasilkan dokumen Excel (.xlsx) dengan 5 lembar kerja terstruktur (Data Warga, KK, Surat Pengantar, Mutasi, dan Bansos).
            </p>

            <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 space-y-3">
              <div className="font-bold text-teal-950 text-xs flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-teal-700" />
                Ekspor Master Data ke Spreadsheet:
              </div>
              <p className="text-[11px] text-teal-800">
                Unduh seluruh data kependudukan RT 004 RW 007 dalam 1 berkas Excel lengkap untuk arsip kelurahan atau dibuka di Google Sheets / Google Drive.
              </p>
              <button
                onClick={onExportExcel}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Unduh Berkas Excel Lengkap (.xlsx)
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileUp className="w-4 h-4 text-slate-600" />
                Impor Data dari Spreadsheet:
              </div>
              <p className="text-[11px] text-slate-500">
                Unggah file Excel hasil sensus atau formulir warga untuk memasukkan data secara massal ke dalam sistem.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-xl border border-slate-300 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                Pilih File Excel / CSV dari Komputer
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Konfigurasi Instansi RT 004 RW 007 Jatimulya */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-600" />
              Pengaturan Instansi & Kop Surat Resmi RT
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Data ini akan otomatis muncul pada kop surat pengantar dan keterangan resmi RT
            </p>
          </div>

          {isSavedConfig && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 animate-in fade-in">
              ✓ Pengaturan Berhasil Disimpan
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor RT</label>
              <input
                type="text"
                value={rtConfigData.namaRT}
                onChange={(e) => setRtConfigData({ ...rtConfigData, namaRT: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor RW</label>
              <input
                type="text"
                value={rtConfigData.namaRW}
                onChange={(e) => setRtConfigData({ ...rtConfigData, namaRW: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kelurahan</label>
              <input
                type="text"
                value={rtConfigData.kelurahan}
                onChange={(e) => setRtConfigData({ ...rtConfigData, kelurahan: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kecamatan</label>
              <input
                type="text"
                value={rtConfigData.kecamatan}
                onChange={(e) => setRtConfigData({ ...rtConfigData, kecamatan: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kabupaten / Kota</label>
              <input
                type="text"
                value={rtConfigData.kabupatenKota}
                onChange={(e) => setRtConfigData({ ...rtConfigData, kabupatenKota: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Kode Pos</label>
              <input
                type="text"
                value={rtConfigData.kodePos}
                onChange={(e) => setRtConfigData({ ...rtConfigData, kodePos: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Ketua RT (Penandatangan Surat)</label>
              <input
                type="text"
                value={rtConfigData.namaKetuaRT}
                onChange={(e) => setRtConfigData({ ...rtConfigData, namaKetuaRT: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Sekretaris RT</label>
              <input
                type="text"
                value={rtConfigData.namaSekretaris}
                onChange={(e) => setRtConfigData({ ...rtConfigData, namaSekretaris: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Kontak / WhatsApp Pengurus RT</label>
              <input
                type="text"
                value={rtConfigData.kontakSekretariat}
                onChange={(e) => setRtConfigData({ ...rtConfigData, kontakSekretariat: e.target.value })}
                className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Alamat Balai Warga / Sekretariat RT</label>
            <input
              type="text"
              value={rtConfigData.alamatSekretariat}
              onChange={(e) => setRtConfigData({ ...rtConfigData, alamatSekretariat: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetToSampleData}

              className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Data Contoh (Default)
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Simpan Pengaturan RT
            </button>
          </div>
        </form>
      </div>

      {/* 4. Keamanan Akun Pengurus & Manajemen Role Admin */}
      <div className="space-y-6">
        {/* Full Admin & Role Management Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Manajemen Role Admin &amp; Akun Pengurus RT</h3>
                <p className="text-xs text-slate-500">Kelola daftar pengurus, tambah role admin, ganti nama, nomor WhatsApp, dan password / PIN</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAddAdmin}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Role Admin Baru</span>
            </button>
          </div>

          {/* Account Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pengurusAccounts.map((acc) => {
              const isRT = acc.role === 'ADMIN_KETUA_RT';
              const isSekretaris = acc.role === 'ADMIN_SEKRETARIS';

              return (
                <div 
                  key={acc.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isRT 
                      ? 'border-emerald-200 bg-emerald-50/40' 
                      : isSekretaris 
                      ? 'border-blue-200 bg-blue-50/40' 
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isRT 
                          ? 'bg-emerald-600 text-white' 
                          : isSekretaris 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-700 text-white'
                      }`}>
                        {acc.roleLabel}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                        @{acc.username}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm leading-snug">{acc.namaLengkap}</h4>
                    {acc.jabatanKhusus && (
                      <p className="text-xs text-slate-600 font-medium mt-0.5">{acc.jabatanKhusus}</p>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">No. WhatsApp/HP:</span>
                        <span className="font-mono font-semibold text-slate-800">{acc.nomorHp || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">PIN / Password:</span>
                        <span className="font-mono text-emerald-800 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          •••• ({acc.pinOrPassword ? 'Tersimpan' : '1234'})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditAdmin(acc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-300 text-xs shadow-2xs transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Edit &amp; Ganti Password</span>
                    </button>
                    {!isRT && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAdmin(acc.id, acc.namaLengkap)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Hapus Akun Pengurus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reassuring Banner on Password & Cloud Storage */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-white flex items-center gap-2">
                  <span>Keamanan Penyimpanan Password &amp; Data Kredensial</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-400/30">Client-First Protected</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Password/PIN akun pengurus dienkripsi dan disimpan di penyimpanan lokal browser (<code className="text-emerald-300">localStorage</code>) perangkat pengurus secara aman. Jika Anda menghendaki sinkronisasi akun pengurus ke Cloud Supabase, tabel <code className="text-emerald-300">pengurus_rt004</code> telah tersedia pada Schema SQL di tab Supabase.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal / Form Add/Edit Admin */}
        {isAddingAdmin && (
          <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 my-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    {editingAdmin ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {editingAdmin ? `Edit Akun: ${editingAdmin.namaLengkap}` : 'Tambah Role Admin / Pengurus Baru'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Kelola identitas, hak akses jabatan, dan PIN keamanan login</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingAdmin(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAdminAccount} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Pengurus:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Dra. Siti Aminah / Ahmad Fauzi, S.Kom."
                    value={formNamaLengkap}
                    onChange={(e) => setFormNamaLengkap(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Username Login:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: bendahara_rt004"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Peran / Role Sistem:</label>
                    <select
                      value={formRole}
                      onChange={(e) => {
                        const val = e.target.value as UserRole;
                        setFormRole(val);
                        if (val === 'ADMIN_KETUA_RT') setFormRoleLabel('Ketua RT 004 (Admin Utama)');
                        else if (val === 'ADMIN_SEKRETARIS') setFormRoleLabel('Sekretaris RT 004');
                        else if (val === 'BENDAHARA') setFormRoleLabel('Bendahara RT 004');
                        else if (val === 'SEKSI_KEAMANAN') setFormRoleLabel('Seksi Keamanan & Ketertiban');
                        else setFormRoleLabel('Staf Pelayanan RT');
                      }}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="ADMIN_KETUA_RT">Ketua RT (Admin Utama)</option>
                      <option value="ADMIN_SEKRETARIS">Sekretaris RT</option>
                      <option value="BENDAHARA">Bendahara RT</option>
                      <option value="SEKSI_KEAMANAN">Seksi Keamanan &amp; Ronda</option>
                      <option value="ADMIN_CUSTOM">Admin / Staf Tambahan</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Label Jabatan / Tampilan:</label>
                    <input
                      type="text"
                      placeholder="Contoh: Bendahara RT / Seksi Humas"
                      value={formRoleLabel}
                      onChange={(e) => setFormRoleLabel(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nomor WhatsApp / HP:</label>
                    <input
                      type="text"
                      placeholder="Contoh: 0812-3456-7890"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Password / PIN Keamanan Login (min. 4 karakter):
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan PIN / Password (Default: 1234)"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Gunakan angka atau kombinasi teks untuk keamanan autentikasi pengurus.
                  </span>
                </div>

                {adminFormMsg && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    adminFormMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {adminFormMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{adminFormMsg.text}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingAdmin(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-semibold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingAdmin ? 'Simpan Perubahan' : 'Tambah Pengurus'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2-Column: Quick PIN Change & Privacy / DB Maintenance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick PIN Management */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Ganti Cepat PIN Pengurus</h3>
                  <p className="text-[11px] text-slate-500">Perbarui PIN keamanan login pengurus aktif</p>
                </div>
              </div>
              <span className="text-[10px] px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-full border border-amber-200">
                Auth Guard
              </span>
            </div>

            <form onSubmit={handleUpdatePin} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih Akun Pengurus:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRolePin('ADMIN_KETUA_RT')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedRolePin === 'ADMIN_KETUA_RT'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Ketua RT 004</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRolePin('ADMIN_SEKRETARIS')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      selectedRolePin === 'ADMIN_SEKRETARIS'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sekretaris RT</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIN / Password Lama:</label>
                <input
                  type="password"
                  placeholder="Masukkan PIN saat ini (Default: 1234)"
                  value={oldPin}
                  onChange={(e) => setOldPin(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIN Baru (min. 4 digit):</label>
                  <input
                    type="password"
                    placeholder="PIN baru"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Konfirmasi PIN Baru:</label>
                  <input
                    type="password"
                    placeholder="Ulangi PIN baru"
                    value={confirmNewPin}
                    onChange={(e) => setConfirmNewPin(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {pinChangeMsg && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  pinChangeMsg.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {pinChangeMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{pinChangeMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Simpan &amp; Perbarui PIN Akun</span>
              </button>
            </form>
          </div>

          {/* Privacy & Clean Database */}
          <div className="space-y-6">
            {/* UU PDP Privacy Masking */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Privasi Data (UU PDP No. 27/2022)</h3>
                    <p className="text-[11px] text-slate-500">Sensor otomatis digit NIK &amp; Nomor KK</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePrivacy}
                  className={`px-3 py-1 text-xs font-bold rounded-full border transition cursor-pointer flex items-center gap-1.5 ${
                    isPrivacyMasked
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {isPrivacyMasked ? <EyeOff className="w-3.5 h-3.5 text-emerald-700" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
                  <span>{isPrivacyMasked ? 'Sensor Aktif' : 'Sensor Terbuka'}</span>
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Jika sensor aktif, seluruh tampilan NIK dan Nomor KK di tabel warga dan KK akan disamarkan (contoh: <code>321606******0001</code>) untuk menjaga privasi data warga dari pihak yang tidak berkepentingan saat layar ditampilkan.
              </p>
            </div>

            {/* Clean / Purge Database */}
            <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-rose-950 text-sm">Bersihkan Data Demo (Database Bersih)</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-full">
                  Maintenance
                </span>
              </div>

              <p className="text-xs text-slate-600">
                Hapus seluruh data kependudukan bawaan/contoh (warga &amp; KK demo) agar aplikasi menjadi ringan dan siap untuk diisi dengan data kependudukan riil RT 004 RW 007 Jatimulya atau ditarik dari Supabase.
              </p>

              <button
                type="button"
                onClick={handleClearAllDummyData}
                className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Bersihkan Seluruh Data Demo Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
