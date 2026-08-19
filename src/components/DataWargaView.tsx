import React, { useState, useMemo, lazy, Suspense } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Filter, 
  Edit, 
  Trash2, 
  FileText, 
  Baby, 
  HeartHandshake, 
  Download, 
  X, 
  Check, 
  Eye, 
  EyeOff,
  Phone, 
  AlertCircle,
  Sparkles,
  Users,
  ClipboardPaste,
  FileSpreadsheet,
  ShieldCheck
} from 'lucide-react';
import { Warga, KartuKeluarga, RTConfig, ImportPreviewRow } from '../types';
import { calculateDemographics, storageService, formatDateDDMMYYYY, maskNik, maskKK, maskPhone } from '../services/storage';
import { useConfirm } from './ConfirmDialog';

// Lazy-load modal import warga (~1000 baris + parser Excel) — chunk hanya dimuat
// saat modal import benar-benar dibuka pengguna.
const ImportWargaModal = lazy(() =>
  import('./ImportWargaModal').then((m) => ({ default: m.ImportWargaModal }))
);


interface DataWargaViewProps {
  wargaList: Warga[];
  kkList: KartuKeluarga[];
  config: RTConfig;
  onSaveWarga: (warga: Warga) => Promise<boolean>;
  onDeleteWarga: (id: string) => Promise<boolean>;
  onImportWarga: (
    rows: ImportPreviewRow[],
    updateExisting: boolean,
    clearExistingBeforeImport: boolean
  ) => Promise<{ success: boolean; result?: { added: number; updated: number; skipped: number }; error?: string }>;
  onCreateSurat: (warga: Warga) => void;
  selectedWargaId?: string | null;
}

export const DataWargaView: React.FC<DataWargaViewProps> = ({
  wargaList,
  kkList,
  config,
  onSaveWarga,
  onDeleteWarga,
  onImportWarga,
  onCreateSurat,
  selectedWargaId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(storageService.isPrivacyMaskEnabled());
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isConfirmClearDummyOpen, setIsConfirmClearDummyOpen] = useState(false);
  const [currentWarga, setCurrentWarga] = useState<Warga | null>(null);

  const isDummyActive = storageService.isDummyDataActive();

  // Form State
  const [formData, setFormData] = useState<Partial<Warga>>({
    nik: '',
    nomorKK: '',
    nama: '',
    jenisKelamin: 'L',
    tempatLahir: 'Bekasi',
    tanggalLahir: '1990-01-01',
    agama: 'ISLAM',
    pendidikan: 'SLTA',
    pekerjaan: 'Wiraswasta',
    statusPerkawinan: 'KAWIN',
    statusHubunganKK: 'KEPALA KELUARGA',
    kewarganegaraan: 'WNI',
    golonganDarah: '-',
    nomorHp: '',
    email: '',
    statusTinggal: 'TETAP',
    statusBansos: 'TIDAK_ADA',
    isYatim: false,
    isDisabilitas: false,
    keteranganBansos: '',
    catatan: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dialog konfirmasi bergaya aplikasi (pengganti window.confirm)
  const { confirm: askConfirm, dialog } = useConfirm();

  const handleDeleteWarga = async (w: Warga) => {
    const setuju = await askConfirm({
      title: 'Hapus Data Warga',
      message: `Data warga ${w.nama} (NIK ${w.nik}) akan dihapus permanen dari direktori kependudukan RT. Lanjutkan?`,
      confirmLabel: 'Ya, Hapus Data',
      tone: 'danger'
    });
    if (setuju) await onDeleteWarga(w.id);
  };


  // Trigger select from external prop
  React.useEffect(() => {
    if (selectedWargaId) {
      const found = wargaList.find(w => w.id === selectedWargaId || w.nik === selectedWargaId);
      if (found) {
        setCurrentWarga(found);
        setIsDetailOpen(true);
      }
    }
  }, [selectedWargaId, wargaList]);

  // Categories config
  const categories = [
    { id: 'ALL', label: 'Semua Warga', icon: Users, count: wargaList.length },
    { id: 'TETAP', label: 'Warga Tetap', icon: User, count: wargaList.filter(w => w.statusTinggal === 'TETAP').length },
    { id: 'KONTRAK', label: 'Pengontrak / Kost', icon: User, count: wargaList.filter(w => w.statusTinggal === 'KONTRAK' || w.statusTinggal === 'KOS').length },
    { id: 'LANSIA', label: 'Lansia (≥60 Thn)', icon: User, count: wargaList.filter(w => calculateDemographics(w.tanggalLahir).isLansia || Boolean(w.isLansia)).length },
    { id: 'BALITA', label: 'Balita (≤5 Thn)', icon: Baby, count: wargaList.filter(w => calculateDemographics(w.tanggalLahir).isBalita || Boolean(w.isBalita)).length },
    { id: 'YATIM', label: 'Anak Yatim', icon: HeartHandshake, count: wargaList.filter(w => w.isYatim).length },
    { id: 'BANSOS', label: 'Penerima Bansos', icon: HeartHandshake, count: wargaList.filter(w => w.statusBansos !== 'TIDAK_ADA').length },
  ];

  // Filtered resident list
  const filteredWarga = useMemo(() => {
    return wargaList.filter(w => {
      const demo = calculateDemographics(w.tanggalLahir);
      const isLansia = demo.isLansia || Boolean(w.isLansia);
      const isBalita = demo.isBalita || Boolean(w.isBalita);

      const matchQuery =
        w.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.nomorKK.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.tempatLahir.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.pekerjaan && w.pekerjaan.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchCategory = true;
      if (selectedCategory === 'TETAP') matchCategory = w.statusTinggal === 'TETAP';
      else if (selectedCategory === 'KONTRAK') matchCategory = w.statusTinggal === 'KONTRAK' || w.statusTinggal === 'KOS';
      else if (selectedCategory === 'LANSIA') matchCategory = isLansia;
      else if (selectedCategory === 'BALITA') matchCategory = isBalita;
      else if (selectedCategory === 'YATIM') matchCategory = !!w.isYatim;
      else if (selectedCategory === 'BANSOS') matchCategory = w.statusBansos !== 'TIDAK_ADA';

      return matchQuery && matchCategory;
    });
  }, [wargaList, searchTerm, selectedCategory]);

  const handleOpenCreate = () => {
    setFormData({
      id: `w-${Date.now()}`,
      nik: '',
      nomorKK: kkList[0]?.nomorKK || '',
      nama: '',
      jenisKelamin: 'L',
      tempatLahir: 'Bekasi',
      tanggalLahir: '1995-01-01',
      agama: 'ISLAM',
      pendidikan: 'SLTA',
      pekerjaan: 'Karyawan Swasta',
      statusPerkawinan: 'KAWIN',
      statusHubunganKK: 'KEPALA KELUARGA',
      kewarganegaraan: 'WNI',
      golonganDarah: '-',
      nomorHp: '',
      email: '',
      statusTinggal: 'TETAP',
      statusBansos: 'TIDAK_ADA',
      isYatim: false,
      isDisabilitas: false,
      keteranganBansos: '',
      catatan: ''
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (w: Warga) => {
    setFormData({ ...w });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenDetail = (w: Warga) => {
    setCurrentWarga(w);
    setIsDetailOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.nik || formData.nik.trim().length !== 16) {
      errors.nik = 'NIK harus tepat 16 digit angka.';
    }
    if (!formData.nama?.trim()) {
      errors.nama = 'Nama lengkap wajib diisi.';
    }
    if (!formData.nomorKK?.trim()) {
      errors.nomorKK = 'Nomor KK wajib diisi / dipilih.';
    }
    if (!formData.tanggalLahir) {
      errors.tanggalLahir = 'Tanggal lahir wajib diisi.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const demo = calculateDemographics(formData.tanggalLahir!);

    const payload: Warga = {
      id: formData.id || `w-${Date.now()}`,
      nik: formData.nik!.trim(),
      nomorKK: formData.nomorKK!.trim(),
      nama: formData.nama!.trim(),
      jenisKelamin: formData.jenisKelamin || 'L',
      tempatLahir: formData.tempatLahir?.trim() || 'Bekasi',
      tanggalLahir: formData.tanggalLahir!,
      agama: formData.agama as any || 'ISLAM',
      pendidikan: formData.pendidikan || 'SLTA',
      pekerjaan: formData.pekerjaan || 'Wiraswasta',
      statusPerkawinan: formData.statusPerkawinan as any || 'KAWIN',
      statusHubunganKK: formData.statusHubunganKK as any || 'KEPALA KELUARGA',
      kewarganegaraan: 'WNI',
      golonganDarah: formData.golonganDarah as any || '-',
      nomorHp: formData.nomorHp || '-',
      email: formData.email || '',
      statusTinggal: formData.statusTinggal as any || 'TETAP',
      isLansia: demo.isLansia,
      isBalita: demo.isBalita,
      isYatim: !!formData.isYatim,
      isDisabilitas: !!formData.isDisabilitas,
      statusBansos: formData.statusBansos as any || 'TIDAK_ADA',
      keteranganBansos: formData.keteranganBansos || '',
      tanggalInput: formData.tanggalInput || new Date().toISOString().split('T')[0],
      catatan: formData.catatan || ''
    };

    if (await onSaveWarga(payload)) setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Dialog konfirmasi/notifikasi terpusat */}
      {dialog}

      {/* Top Header */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Direktori Data Warga
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pengelompokan kependudukan, bansos, lansia, balita, dan anak yatim RT {config.namaRT} RW {config.namaRW}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              const next = storageService.togglePrivacyMask();
              setIsPrivacyMasked(next);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-full border transition cursor-pointer ${
              isPrivacyMasked
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title="Sensor NIK & Nomor KK sesuai UU Perlindungan Data Pribadi (UU PDP)"
          >
            {isPrivacyMasked ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isPrivacyMasked ? 'Sensor NIK Aktif (UU PDP)' : 'Buka Sensor NIK'}</span>
          </button>

          {isDummyActive && (
            <button
              onClick={() => setIsConfirmClearDummyOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-full border border-rose-200 transition cursor-pointer"
              title="Hapus data sampel/dummy bawaan sistem"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bersihkan Data Dummy</span>
            </button>
          )}
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-full border border-amber-200 transition cursor-pointer shadow-2xs"
            title="Salin dan tempel data pengontrak / warga dengan format standar"
          >
            <ClipboardPaste className="w-4 h-4 text-amber-700" />
            <span>Salin & Tempel Data (Impor)</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Data Warga</span>
          </button>
        </div>
      </div>

      {/* Dummy Data Notification Banner if present */}
      {isDummyActive && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">Database masih berisi data sampel/dummy: </span>
              Anda dapat membersihkan data dummy ini untuk memasukkan data asli warga RT 004 melalui impor Excel atau input manual.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsConfirmClearDummyOpen(true)}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Kosongkan Dummy
            </button>
            <button
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Salin & Tempel Data Asli
            </button>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isActive ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
        <input
          type="text"
          placeholder="Cari berdasarkan Nama Lengkap, NIK 16 digit, Nomor KK, Pekerjaan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs transition-all"
        />
      </div>

      {/* Data warga — tabel (tampil ≥ md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="table-scroll">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Nama & NIK</th>
                <th className="px-4 py-3.5">No. KK & Status Hubungan</th>
                <th className="px-4 py-3.5">Tanggal Lahir & Usia</th>
                <th className="px-4 py-3.5 text-center">Kategori Khusus</th>
                <th className="px-4 py-3.5 text-center">Status Domisili</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWarga.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    <User className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">Tidak ada data warga ditemukan</p>
                    <p className="text-xs text-slate-500 mt-0.5">Coba ubah filter atau kata kunci pencarian.</p>
                  </td>
                </tr>
              ) : (
                filteredWarga.map((w) => {
                  const demo = calculateDemographics(w.tanggalLahir);
                  const isLansia = demo.isLansia || Boolean(w.isLansia);
                  const isBalita = demo.isBalita || Boolean(w.isBalita);
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            w.jenisKelamin === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {w.jenisKelamin}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm hover:text-emerald-700 cursor-pointer" onClick={() => handleOpenDetail(w)}>
                              {w.nama}
                            </div>
                            <div className="font-mono text-slate-500 font-medium text-xs">
                              NIK: {isPrivacyMasked ? maskNik(w.nik) : w.nik}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{w.statusHubunganKK}</div>
                        <div className="font-mono text-emerald-700 text-xs">
                          KK: {isPrivacyMasked ? maskKK(w.nomorKK) : w.nomorKK}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900 font-mono text-xs">{formatDateDDMMYYYY(w.tanggalLahir)}</div>
                        <div className="text-xs text-slate-500">
                          {demo.usia} Tahun &bull; {w.tempatLahir && w.tempatLahir !== 'Bekasi' ? `${w.tempatLahir}, ` : ''}{w.pekerjaan || 'Wiraswasta'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {isLansia && (
                            <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded font-bold">
                              Lansia ≥60
                            </span>
                          )}
                          {isBalita && (
                            <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded font-bold">
                              Balita ≤5
                            </span>
                          )}
                          {w.isYatim && (
                            <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-900 border border-teal-200 rounded font-bold">
                              Yatim
                            </span>
                          )}
                          {w.statusBansos !== 'TIDAK_ADA' && (
                            <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded font-bold">
                              {w.statusBansos}
                            </span>
                          )}
                          {!isLansia && !isBalita && !w.isYatim && w.statusBansos === 'TIDAK_ADA' && (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                          w.statusTinggal === 'TETAP'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}>
                          {w.statusTinggal}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onCreateSurat(w)}
                            className="flex items-center gap-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs transition border border-emerald-200"
                            title="Buat Surat Pengantar"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Surat</span>
                          </button>
                          <button
                            onClick={() => handleOpenDetail(w)}
                            className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Detail Warga"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(w)}
                            className="p-2.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Data"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteWarga(w)}
                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data warga — kartu (mobile, tampil < md) */}
      <div className="md:hidden space-y-3">
        {filteredWarga.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs text-center py-10 px-4">
            <User className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="font-semibold text-slate-600">Tidak ada data warga ditemukan</p>
            <p className="text-xs text-slate-500 mt-0.5">Coba ubah filter atau kata kunci pencarian.</p>
          </div>
        ) : (
          filteredWarga.map((w) => {
            const demo = calculateDemographics(w.tanggalLahir);
            const isLansia = demo.isLansia || Boolean(w.isLansia);
            const isBalita = demo.isBalita || Boolean(w.isBalita);
            return (
              <article key={w.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header kartu */}
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      w.jenisKelamin === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                    }`}>
                      {w.jenisKelamin}
                    </div>
                    <div className="min-w-0">
                      <button onClick={() => handleOpenDetail(w)} className="font-bold text-slate-900 text-sm text-left hover:text-emerald-700 truncate block w-full">
                        {w.nama}
                      </button>
                      <div className="font-mono text-slate-500 text-xs truncate">NIK: {isPrivacyMasked ? maskNik(w.nik) : w.nik}</div>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-block px-2 py-0.5 rounded-md text-xs font-bold ${
                    w.statusTinggal === 'TETAP'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-blue-50 text-blue-800 border border-blue-200'
                  }`}>
                    {w.statusTinggal}
                  </span>
                </div>

                {/* Isi kartu */}
                <div className="px-4 py-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Hubungan</span>
                    <span className="font-semibold text-slate-800 text-right">{w.statusHubunganKK}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">No. KK</span>
                    <span className="font-mono text-emerald-700 text-right">{isPrivacyMasked ? maskKK(w.nomorKK) : w.nomorKK}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Lahir / Usia</span>
                    <span className="font-mono text-slate-700 text-right">{formatDateDDMMYYYY(w.tanggalLahir)} &bull; {demo.usia} th</span>
                  </div>
                  {(isLansia || isBalita || w.isYatim || w.statusBansos !== 'TIDAK_ADA') && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {isLansia && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded font-bold">Lansia ≥60</span>}
                      {isBalita && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded font-bold">Balita ≤5</span>}
                      {w.isYatim && <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-900 border border-teal-200 rounded font-bold">Yatim</span>}
                      {w.statusBansos !== 'TIDAK_ADA' && <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded font-bold">{w.statusBansos}</span>}
                    </div>
                  )}
                </div>

                {/* Aksi kartu */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => onCreateSurat(w)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs transition border border-emerald-200 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Surat
                  </button>
                  <button onClick={() => handleOpenDetail(w)} className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-slate-200 cursor-pointer" title="Detail Warga" aria-label="Detail Warga">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleOpenEdit(w)} className="p-2.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition border border-slate-200 cursor-pointer" title="Edit Data" aria-label="Edit Data">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteWarga(w)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer" title="Hapus Data" aria-label="Hapus Data">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* DETAIL MODAL WARGA */}
      {isDetailOpen && currentWarga && (
        <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm ${
                  currentWarga.jenisKelamin === 'L' ? 'bg-blue-600' : 'bg-pink-600'
                }`}>
                  {currentWarga.jenisKelamin}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">{currentWarga.nama}</h3>
                  <p className="text-xs text-slate-300 font-mono">NIK: {currentWarga.nik}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Nomor Kartu Keluarga:</span>
                  <span className="font-mono font-bold text-emerald-800">{currentWarga.nomorKK}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status Hubungan KK:</span>
                  <span className="font-semibold text-slate-900">{currentWarga.statusHubunganKK}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tanggal Lahir & Tempat:</span>
                  <span className="font-semibold text-slate-900">
                    {formatDateDDMMYYYY(currentWarga.tanggalLahir)} ({calculateDemographics(currentWarga.tanggalLahir).usia} Thn) &bull; {currentWarga.tempatLahir}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Jenis Kelamin & Gol Darah:</span>
                  <span className="font-semibold text-slate-900">
                    {currentWarga.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan'} (Gol: {currentWarga.golonganDarah || '-'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Agama & Pendidikan:</span>
                  <span className="font-semibold text-slate-900">{currentWarga.agama} &bull; {currentWarga.pendidikan}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pekerjaan & Status Kawin:</span>
                  <span className="font-semibold text-slate-900">{currentWarga.pekerjaan} &bull; {currentWarga.statusPerkawinan}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Nomor Telepon / WA:</span>
                  <span className="font-semibold text-slate-900">{currentWarga.nomorHp || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status Domisili:</span>
                  <span className="font-bold text-emerald-700">{currentWarga.statusTinggal}</span>
                </div>
              </div>

              {/* Status Bansos & Kelompok Khusus */}
              <div className="bg-emerald-50/60 border border-emerald-200 p-3.5 rounded-xl">
                <div className="font-bold text-emerald-950 text-xs mb-1.5">Klasifikasi Bantuan Sosial & Prioritas:</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 bg-white text-emerald-800 rounded border border-emerald-200 font-semibold text-xs">
                    Bansos: {currentWarga.statusBansos}
                  </span>
                  {currentWarga.isLansia && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-semibold text-xs">
                      Kategori Lansia
                    </span>
                  )}
                  {currentWarga.isBalita && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-semibold text-xs">
                      Kategori Balita
                    </span>
                  )}
                  {currentWarga.isYatim && (
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-900 rounded font-semibold text-xs">
                      Anak Yatim / Piatu
                    </span>
                  )}
                </div>
                {currentWarga.keteranganBansos && (
                  <p className="text-xs text-emerald-800 mt-2">
                    Keterangan: {currentWarga.keteranganBansos}
                  </p>
                )}
              </div>

              {currentWarga.catatan && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="font-semibold text-slate-700">Catatan Khusus:</div>
                  <p className="text-slate-600 mt-0.5">{currentWarga.catatan}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  setIsDetailOpen(false);
                  onCreateSurat(currentWarga);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Buat Surat Pengantar RT
              </button>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL WARGA (TAMBAH / EDIT) */}
      {isFormOpen && (
        <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    {formData.id && wargaList.some(w => w.id === formData.id) ? 'Edit Data Warga' : 'Tambah Warga Baru'}
                  </h3>
                  <p className="text-xs text-slate-300">RT {config.namaRT} RW {config.namaRW} Kelurahan {config.kelurahan}</p>
                </div>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* NIK */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIK (Nomor Induk Kependudukan - 16 Digit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="Contoh: 3216061205750001"
                    value={formData.nik || ''}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '') })}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs ${
                      formErrors.nik ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.nik && <p className="text-xs text-rose-600 mt-0.5">{formErrors.nik}</p>}
                </div>

                {/* Nomor KK */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Kartu Keluarga (KK) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="Contoh: 3216060101150001"
                    value={formData.nomorKK || ''}
                    onChange={(e) => setFormData({ ...formData, nomorKK: e.target.value.replace(/\D/g, '') })}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs ${
                      formErrors.nomorKK ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.nomorKK && <p className="text-xs text-rose-600 mt-0.5">{formErrors.nomorKK}</p>}
                </div>

                {/* Nama Lengkap */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama sesuai KTP"
                    value={formData.nama || ''}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    className={`w-full p-2.5 border rounded-xl text-xs ${
                      formErrors.nama ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.nama && <p className="text-xs text-rose-600 mt-0.5">{formErrors.nama}</p>}
                </div>

                {/* Jenis Kelamin */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.jenisKelamin || 'L'}
                    onChange={(e) => setFormData({ ...formData, jenisKelamin: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="L">Laki-Laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>

                {/* Tempat Lahir */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    placeholder="Contoh: Bekasi / Cirebon"
                    value={formData.tempatLahir || ''}
                    onChange={(e) => setFormData({ ...formData, tempatLahir: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Tanggal Lahir */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Lahir <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.tanggalLahir || ''}
                    onChange={(e) => setFormData({ ...formData, tanggalLahir: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Status Hubungan KK */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Hubungan dalam KK</label>
                  <select
                    value={formData.statusHubunganKK || 'KEPALA KELUARGA'}
                    onChange={(e) => setFormData({ ...formData, statusHubunganKK: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="KEPALA KELUARGA">Kepala Keluarga</option>
                    <option value="ISTRI">Istri</option>
                    <option value="ANAK">Anak</option>
                    <option value="ORANG TUA">Orang Tua</option>
                    <option value="MERTUA">Mertua</option>
                    <option value="FAMILI LAIN">Famili Lain</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </div>

                {/* Status Perkawinan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Perkawinan</label>
                  <select
                    value={formData.statusPerkawinan || 'KAWIN'}
                    onChange={(e) => setFormData({ ...formData, statusPerkawinan: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="BELUM KAWIN">Belum Kawin</option>
                    <option value="KAWIN">Kawin</option>
                    <option value="CERAI HIDUP">Cerai Hidup</option>
                    <option value="CERAI MATI">Cerai Mati</option>
                  </select>
                </div>

                {/* Agama */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Agama</label>
                  <select
                    value={formData.agama || 'ISLAM'}
                    onChange={(e) => setFormData({ ...formData, agama: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="ISLAM">Islam</option>
                    <option value="KRISTEN">Kristen</option>
                    <option value="KATOLIK">Katolik</option>
                    <option value="HINDU">Hindu</option>
                    <option value="BUDDHA">Buddha</option>
                    <option value="KONGHUCU">Konghucu</option>
                  </select>
                </div>

                {/* Pekerjaan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pekerjaan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Karyawan Swasta / Wiraswasta"
                    value={formData.pekerjaan || ''}
                    onChange={(e) => setFormData({ ...formData, pekerjaan: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Status Tinggal */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Tinggal</label>
                  <select
                    value={formData.statusTinggal || 'TETAP'}
                    onChange={(e) => setFormData({ ...formData, statusTinggal: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="TETAP">Warga Tetap</option>
                    <option value="KONTRAK">Pengontrak</option>
                    <option value="KOS">Kos</option>
                  </select>
                </div>

                {/* Status Bansos */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bantuan Sosial (Bansos)</label>
                  <select
                    value={formData.statusBansos || 'TIDAK_ADA'}
                    onChange={(e) => setFormData({ ...formData, statusBansos: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="TIDAK_ADA">Tidak Ada (Mampu)</option>
                    <option value="PKH">Program Keluarga Harapan (PKH)</option>
                    <option value="BPNT">Bantuan Pangan Non Tunai (BPNT / Sembako)</option>
                    <option value="BLT">Bantuan Langsung Tunai (BLT)</option>
                    <option value="BST">Bantuan Sosial Tunai (BST)</option>
                    <option value="BANSOS_DAERAH">Bansos APBD Kab. Bekasi</option>
                  </select>
                </div>

                {/* No WhatsApp */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor WhatsApp / HP</label>
                  <input
                    type="text"
                    placeholder="Contoh: 081298765432"
                    value={formData.nomorHp || ''}
                    onChange={(e) => setFormData({ ...formData, nomorHp: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                {/* Gol Darah */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Golongan Darah</label>
                  <select
                    value={formData.golonganDarah || '-'}
                    onChange={(e) => setFormData({ ...formData, golonganDarah: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="-">Tidak Tahu / -</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes for special status */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800 text-xs">Penetapan Kategori Khusus Tambahan:</div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isYatim || false}
                      onChange={(e) => setFormData({ ...formData, isYatim: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Anak Yatim / Piatu</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isDisabilitas || false}
                      onChange={(e) => setFormData({ ...formData, isDisabilitas: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">Penyandang Disabilitas</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 italic">
                  *Catatan: Kategori Lansia (≥60 tahun) dan Balita (≤5 tahun) dihitung secara otomatis oleh sistem dari tanggal lahir.
                </p>
              </div>

              {/* Catatan / Keterangan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan khusus lainnya..."
                  value={formData.catatan || ''}
                  onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  Simpan Data Warga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advanced Pre-Import Validation Modal (lazy — dimuat saat dibuka) */}
      {isImportOpen && (
        <Suspense fallback={null}>
          <ImportWargaModal
            isOpen={isImportOpen}
            onClose={() => setIsImportOpen(false)}
            onCommitImport={onImportWarga}
            onImportSuccess={({ added, updated }) => {
              // Trigger storage listeners
              setIsImportOpen(false);
            }}
          />
        </Suspense>
      )}

      {/* Confirmation Modal to Clear Dummy Data */}
      {isConfirmClearDummyOpen && (
        <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Bersihkan Data Dummy?</h3>
                <p className="text-xs text-slate-500">Semua data dummy bawaan sistem akan dihapus.</p>
              </div>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-600">
              <p>
                Tindakan ini akan menghapus seluruh data contoh (dummy) warga dan kartu keluarga agar database RT 004 bersih dan siap diisi dengan data asli dari berkas Excel Anda.
              </p>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                Setelah dibersihkan, Anda dapat mengunggah berkas spreadsheet warga RT 004 melalui tombol <strong>Impor Excel / CSV</strong>.
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmClearDummyOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  storageService.clearAllDummyData();
                  setIsConfirmClearDummyOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ya, Bersihkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
