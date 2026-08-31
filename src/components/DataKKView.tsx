import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Users, 
  Home, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  FileText, 
  UserPlus, 
  X, 
  Check, 
  Download,
  AlertCircle,
  Building,
  User,
  ShieldCheck
} from 'lucide-react';
import { KartuKeluarga, Warga, RTConfig } from '../types';
import { calculateDemographics, formatDateDDMMYYYY, maskNik, maskKK, storageService } from '../services/storage';
import { useConfirm } from './ConfirmDialog';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface DataKKViewProps {
  kkList: KartuKeluarga[];
  wargaList: Warga[];
  config: RTConfig;
  onSaveKK: (kk: KartuKeluarga) => Promise<boolean>;
  onDeleteKK: (id: string) => Promise<boolean>;
  onCreateSuratForWarga: (warga: Warga) => void;
  selectedKKId?: string | null;
}

export const DataKKView: React.FC<DataKKViewProps> = ({
  kkList,
  wargaList,
  config,
  onSaveKK,
  onDeleteKK,
  onCreateSuratForWarga,
  selectedKKId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDomisili, setFilterDomisili] = useState<'ALL' | 'TETAP' | 'KONTRAK' | 'KOS'>('ALL');
  const [isPrivacyMasked, setIsPrivacyMasked] = useState(storageService.isPrivacyMaskEnabled());
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentKK, setCurrentKK] = useState<KartuKeluarga | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<KartuKeluarga>>({
    nomorKK: '',
    kepalaKeluargaNama: '',
    kepalaKeluargaNik: '',
    alamat: '',
    rt: config.namaRT || '004',
    rw: config.namaRW || '007',
    kelurahan: config.kelurahan || 'Jatimulya',
    kecamatan: config.kecamatan || 'Tambun Selatan',
    kabupatenKota: config.kabupatenKota || 'Kabupaten Bekasi',
    provinsi: config.provinsi || 'Jawa Barat',
    kodePos: config.kodePos || '17510',
    statusDomisili: 'TETAP',
    blokRumah: '',
    tanggalTerbit: new Date().toISOString().split('T')[0],
    catatan: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dialog konfirmasi bergaya aplikasi (pengganti window.confirm)
  const { confirm: askConfirm, dialog } = useConfirm();

  // Escape, focus trap, dan pemulihan fokus untuk dua overlay di view ini.
  const detailDialogRef = useModalDismiss<HTMLDivElement>(() => setIsDetailOpen(false), isDetailOpen);
  const formDialogRef = useModalDismiss<HTMLDivElement>(() => setIsFormOpen(false), isFormOpen);

  const handleDeleteKK = async (kk: KartuKeluarga) => {
    const setuju = await askConfirm({
      title: 'Hapus Kartu Keluarga',
      message: `Kartu Keluarga ${kk.nomorKK} (Kepala Keluarga: ${kk.kepalaKeluargaNama}) beserta datanya akan dihapus dari sistem. Lanjutkan?`,
      confirmLabel: 'Ya, Hapus KK',
      tone: 'danger'
    });
    if (setuju) await onDeleteKK(kk.id);
  };

  // Trigger select from external props
  React.useEffect(() => {
    if (selectedKKId) {
      const found = kkList.find(k => k.id === selectedKKId || k.nomorKK === selectedKKId);
      if (found) {
        setCurrentKK(found);
        setIsDetailOpen(true);
      }
    }
  }, [selectedKKId, kkList]);

  // Filtered List
  const filteredKK = useMemo(() => {
    return kkList.filter(k => {
      const matchQuery = 
        k.nomorKK.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.kepalaKeluargaNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.kepalaKeluargaNik.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.alamat.toLowerCase().includes(searchTerm.toLowerCase()) ||
        k.blokRumah.toLowerCase().includes(searchTerm.toLowerCase());

      const matchDomisili = filterDomisili === 'ALL' || k.statusDomisili === filterDomisili;

      return matchQuery && matchDomisili;
    });
  }, [kkList, searchTerm, filterDomisili]);

  const handleOpenCreate = () => {
    setFormData({
      id: `kk-${Date.now()}`,
      nomorKK: '',
      kepalaKeluargaNama: '',
      kepalaKeluargaNik: '',
      alamat: 'Jl. Mawar No. , RT 004 RW 007 Kel. Jatimulya',
      rt: config.namaRT || '004',
      rw: config.namaRW || '007',
      kelurahan: config.kelurahan || 'Jatimulya',
      kecamatan: config.kecamatan || 'Tambun Selatan',
      kabupatenKota: config.kabupatenKota || 'Kabupaten Bekasi',
      provinsi: config.provinsi || 'Jawa Barat',
      kodePos: config.kodePos || '17510',
      statusDomisili: 'TETAP',
      blokRumah: 'Blok A',
      tanggalTerbit: new Date().toISOString().split('T')[0],
      anggota: [],
      catatan: ''
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEdit = (kk: KartuKeluarga) => {
    setFormData({ ...kk });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleOpenDetail = (kk: KartuKeluarga) => {
    setCurrentKK(kk);
    setIsDetailOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.nomorKK || formData.nomorKK.trim().length !== 16) {
      errors.nomorKK = 'Nomor KK harus tepat 16 digit angka.';
    }
    if (!formData.kepalaKeluargaNama?.trim()) {
      errors.kepalaKeluargaNama = 'Nama Kepala Keluarga wajib diisi.';
    }
    if (!formData.kepalaKeluargaNik || formData.kepalaKeluargaNik.trim().length !== 16) {
      errors.kepalaKeluargaNik = 'NIK Kepala Keluarga harus tepat 16 digit angka.';
    }
    if (!formData.alamat?.trim()) {
      errors.alamat = 'Alamat wajib diisi.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check if kepala keluarga is already in members list or create initial member
    const existingMembers = formData.anggota || [];
    const updatedMembers = [...existingMembers];

    if (!updatedMembers.some(m => m.nik === formData.kepalaKeluargaNik)) {
      const kepalaWarga: Warga = {
        id: `w-${Date.now()}`,
        nik: formData.kepalaKeluargaNik!,
        nomorKK: formData.nomorKK!,
        nama: formData.kepalaKeluargaNama!,
        jenisKelamin: 'L',
        tempatLahir: 'Bekasi',
        tanggalLahir: '1980-01-01',
        agama: 'ISLAM',
        pendidikan: 'SLTA',
        pekerjaan: 'Wiraswasta',
        statusPerkawinan: 'KAWIN',
        statusHubunganKK: 'KEPALA KELUARGA',
        kewarganegaraan: 'WNI',
        golonganDarah: '-',
        nomorHp: '',
        statusTinggal: formData.statusDomisili || 'TETAP',
        statusBansos: 'TIDAK_ADA',
        tanggalInput: new Date().toISOString().split('T')[0]
      };
      updatedMembers.unshift(kepalaWarga);
    }

    const payload: KartuKeluarga = {
      id: formData.id || `kk-${Date.now()}`,
      nomorKK: formData.nomorKK!.trim(),
      kepalaKeluargaNama: formData.kepalaKeluargaNama!.trim(),
      kepalaKeluargaNik: formData.kepalaKeluargaNik!.trim(),
      alamat: formData.alamat!.trim(),
      rt: formData.rt || config.namaRT,
      rw: formData.rw || config.namaRW,
      kelurahan: formData.kelurahan || config.kelurahan,
      kecamatan: formData.kecamatan || config.kecamatan,
      kabupatenKota: formData.kabupatenKota || config.kabupatenKota,
      provinsi: formData.provinsi || config.provinsi,
      kodePos: formData.kodePos || config.kodePos,
      statusDomisili: formData.statusDomisili as any || 'TETAP',
      blokRumah: formData.blokRumah || '',
      tanggalTerbit: formData.tanggalTerbit || new Date().toISOString().split('T')[0],
      anggota: updatedMembers,
      tanggalUpdate: new Date().toISOString().split('T')[0],
      catatan: formData.catatan || ''
    };

    if (await onSaveKK(payload)) setIsFormOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Dialog konfirmasi/notifikasi terpusat */}
      {dialog}

      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Manajemen Data Kartu Keluarga (KK)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar Kartu Keluarga terdaftar di lingkungan RT {config.namaRT} RW {config.namaRW} Jatimulya ({kkList.length} KK)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = storageService.togglePrivacyMask();
              setIsPrivacyMasked(next);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
              isPrivacyMasked
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
            title="Sensor NIK & Nomor KK sesuai UU Perlindungan Data Pribadi (UU PDP)"
          >
            {isPrivacyMasked ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
            <span>{isPrivacyMasked ? 'Sensor NIK & KK Aktif' : 'Buka Sensor'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Input Kartu Keluarga Baru
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari Nomor KK 16 digit, Kepala Keluarga, NIK, atau Alamat Blok..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'TETAP', 'KONTRAK', 'KOS'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterDomisili(status)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filterDomisili === status
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {status === 'ALL' ? 'Semua Status' : status === 'TETAP' ? 'Warga Tetap' : status === 'KONTRAK' ? 'Pengontrak' : 'Anak Kost'}
            </button>
          ))}
        </div>
      </div>

      {/* Data KK — tabel (tampil ≥ md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="table-scroll">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">No. KK & Kepala Keluarga</th>
                <th className="px-4 py-3.5">NIK Kepala KK</th>
                <th className="px-4 py-3.5">Alamat & Blok Rumah</th>
                <th className="px-4 py-3.5 text-center">Status Domisili</th>
                <th className="px-4 py-3.5 text-center">Anggota Keluarga</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKK.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">Tidak ada data Kartu Keluarga</p>
                    <p className="text-xs text-slate-500 mt-0.5">Coba sesuaikan kata kunci pencarian Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredKK.map((kk) => {
                  const memberCount = kk.anggota?.length || 0;
                  const hasLansia = kk.anggota?.some(m => m.isLansia);
                  const hasBalita = kk.anggota?.some(m => m.isBalita);
                  const hasYatim = kk.anggota?.some(m => m.isYatim);

                  return (
                    <tr key={kk.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{kk.kepalaKeluargaNama}</div>
                        <div className="font-mono text-emerald-700 font-semibold text-xs mt-0.5">
                          No. KK: {isPrivacyMasked ? maskKK(kk.nomorKK) : kk.nomorKK}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {isPrivacyMasked ? maskNik(kk.kepalaKeluargaNik) : kk.kepalaKeluargaNik}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{kk.alamat}</div>
                        <div className="text-xs text-slate-500 font-semibold">
                          {kk.blokRumah || 'RT 004 RW 007'} &bull; Pos: {kk.kodePos}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          kk.statusDomisili === 'TETAP'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : kk.statusDomisili === 'KONTRAK'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {kk.statusDomisili}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <span>{memberCount} Jiwa</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {hasLansia && <span className="text-xs px-1 bg-amber-100 text-amber-800 rounded font-semibold">Lansia</span>}
                          {hasBalita && <span className="text-xs px-1 bg-purple-100 text-purple-800 rounded font-semibold">Balita</span>}
                          {hasYatim && <span className="text-xs px-1 bg-teal-100 text-teal-800 rounded font-semibold">Yatim</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(kk)}
                            className="p-2.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="Lihat Anggota Keluarga"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(kk)}
                            className="p-2.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                            title="Edit KK"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteKK(kk)}

                            className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Hapus KK"
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

      {/* Data KK — kartu (mobile, tampil < md) */}
      <div className="md:hidden space-y-3">
        {filteredKK.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs text-center py-10 px-4">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="font-semibold text-slate-600">Tidak ada data Kartu Keluarga</p>
            <p className="text-xs text-slate-500 mt-0.5">Coba sesuaikan kata kunci pencarian Anda.</p>
          </div>
        ) : (
          filteredKK.map((kk) => {
            const memberCount = kk.anggota?.length || 0;
            const hasLansia = kk.anggota?.some(m => m.isLansia);
            const hasBalita = kk.anggota?.some(m => m.isBalita);
            const hasYatim = kk.anggota?.some(m => m.isYatim);
            return (
              <article key={kk.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header kartu */}
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{kk.kepalaKeluargaNama}</div>
                    <div className="font-mono text-emerald-700 font-semibold text-xs mt-0.5 truncate">No. KK: {isPrivacyMasked ? maskKK(kk.nomorKK) : kk.nomorKK}</div>
                  </div>
                  <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    kk.statusDomisili === 'TETAP'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : kk.statusDomisili === 'KONTRAK'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-purple-100 text-purple-800 border border-purple-200'
                  }`}>
                    {kk.statusDomisili}
                  </span>
                </div>

                {/* Isi kartu */}
                <div className="px-4 py-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">NIK Kepala</span>
                    <span className="font-mono text-slate-700 text-right">{isPrivacyMasked ? maskNik(kk.kepalaKeluargaNik) : kk.kepalaKeluargaNik}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Alamat</span>
                    <span className="font-medium text-slate-800 text-right">{kk.alamat}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Blok / Pos</span>
                    <span className="text-slate-600 text-right">{kk.blokRumah || 'RT 004 RW 007'} &bull; {kk.kodePos}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">{memberCount} Jiwa</span>
                    <div className="flex items-center gap-1">
                      {hasLansia && <span className="text-xs px-1 bg-amber-100 text-amber-800 rounded font-semibold">Lansia</span>}
                      {hasBalita && <span className="text-xs px-1 bg-purple-100 text-purple-800 rounded font-semibold">Balita</span>}
                      {hasYatim && <span className="text-xs px-1 bg-teal-100 text-teal-800 rounded font-semibold">Yatim</span>}
                    </div>
                  </div>
                </div>

                {/* Aksi kartu */}
                <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
                  <button onClick={() => handleOpenDetail(kk)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition border border-slate-200 text-xs font-semibold cursor-pointer" title="Lihat Anggota Keluarga">
                    <Eye className="w-4 h-4" /> Anggota
                  </button>
                  <button onClick={() => handleOpenEdit(kk)} className="p-2.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition border border-slate-200 cursor-pointer" title="Edit KK" aria-label="Edit KK">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteKK(kk)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer" title="Hapus KK" aria-label="Hapus KK">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* DETAIL MODAL: LIHAT ANGGOTA KELUARGA */}
      {isDetailOpen && currentKK && (
        <div
      ref={detailDialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Kartu Keluarga: {currentKK.kepalaKeluargaNama}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    No. KK: {currentKK.nomorKK} &bull; Domisili: {currentKK.statusDomisili}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KK Summary */}
            <div className="bg-slate-50 p-4 border-b border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">Alamat Rumah:</span>
                <span className="font-semibold text-slate-900">{currentKK.alamat}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Blok / Lingkungan:</span>
                <span className="font-semibold text-slate-900">{currentKK.blokRumah || 'RT 004 RW 007'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Kelurahan & Kode Pos:</span>
                <span className="font-semibold text-slate-900">{currentKK.kelurahan}, {currentKK.kodePos}</span>
              </div>
            </div>

            {/* List of Family Members */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Daftar Anggota Keluarga ({currentKK.anggota?.length || 0} Jiwa)
                </h4>
              </div>

              <div className="space-y-2">
                {currentKK.anggota?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Belum ada anggota keluarga yang tercatat.</p>
                ) : (
                  currentKK.anggota?.map((member, idx) => {
                    const demo = calculateDemographics(member.tanggalLahir);
                    return (
                      <div
                        key={member.id || idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                            member.jenisKelamin === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                          }`}>
                            {member.jenisKelamin}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">{member.nama}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                {member.statusHubunganKK}
                              </span>
                              {(demo.isLansia || Boolean(member.isLansia)) && (
                                <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">
                                  Lansia ≥60 ({demo.usia} thn)
                                </span>
                              )}
                              {(demo.isBalita || Boolean(member.isBalita)) && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-semibold">
                                  Balita ≤5 ({demo.usia} thn)
                                </span>
                              )}
                              {member.isYatim && (
                                <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-800 rounded font-semibold">
                                  Yatim
                                </span>
                              )}
                              {member.statusBansos !== 'TIDAK_ADA' && (
                                <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">
                                  Bansos: {member.statusBansos}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              NIK: <span className="font-mono text-slate-800 font-semibold">{member.nik}</span> &bull; Tanggal Lahir: <span className="font-mono font-semibold text-slate-700">{formatDateDDMMYYYY(member.tanggalLahir)}</span> ({demo.usia} Tahun) {member.tempatLahir && member.tempatLahir !== 'Bekasi' ? `&bull; Tempat: ${member.tempatLahir} ` : ''}&bull; Pekerjaan: {member.pekerjaan || '-'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => {
                              setIsDetailOpen(false);
                              onCreateSuratForWarga(member);
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs transition cursor-pointer border border-emerald-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Buat Surat
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Pembaruan Terakhir: {currentKK.tanggalUpdate || currentKK.tanggalTerbit}
              </span>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: INPUT / EDIT KARTU KELUARGA */}
      {isFormOpen && (
        <div
      ref={formDialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    {formData.id && kkList.some(k => k.id === formData.id) ? 'Edit Data Kartu Keluarga' : 'Input Kartu Keluarga Baru'}
                  </h3>
                  <p className="text-xs text-slate-300">RT {config.namaRT} RW {config.namaRW} Kelurahan {config.kelurahan}</p>
                </div>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nomor KK */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Kartu Keluarga (16 Digit) <span className="text-rose-500">*</span>
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

                {/* Status Domisili */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Status Domisili Tempat Tinggal <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.statusDomisili || 'TETAP'}
                    onChange={(e) => setFormData({ ...formData, statusDomisili: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                  >
                    <option value="TETAP">Warga Tetap (Rumah Pribadi)</option>
                    <option value="KONTRAK">Warga Pengontrak</option>
                    <option value="KOS">Warga Kos / Asrama</option>
                  </select>
                </div>

                {/* Nama Kepala Keluarga */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Kepala Keluarga <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Lengkap sesuai KTP"
                    value={formData.kepalaKeluargaNama || ''}
                    onChange={(e) => setFormData({ ...formData, kepalaKeluargaNama: e.target.value })}
                    className={`w-full p-2.5 border rounded-xl text-xs ${
                      formErrors.kepalaKeluargaNama ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.kepalaKeluargaNama && <p className="text-xs text-rose-600 mt-0.5">{formErrors.kepalaKeluargaNama}</p>}
                </div>

                {/* NIK Kepala Keluarga */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIK Kepala Keluarga (16 Digit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="Contoh: 3216061205750001"
                    value={formData.kepalaKeluargaNik || ''}
                    onChange={(e) => setFormData({ ...formData, kepalaKeluargaNik: e.target.value.replace(/\D/g, '') })}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs ${
                      formErrors.kepalaKeluargaNik ? 'border-rose-500 bg-rose-50' : 'border-slate-200'
                    }`}
                  />
                  {formErrors.kepalaKeluargaNik && <p className="text-xs text-rose-600 mt-0.5">{formErrors.kepalaKeluargaNik}</p>}
                </div>
              </div>

              {/* Alamat Lengkap */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alamat Lengkap di RT 004 RW 007 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Jl. Mawar No. 12 RT 004 RW 007 Kel. Jatimulya"
                  value={formData.alamat || ''}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Blok / Nomor Rumah</label>
                  <input
                    type="text"
                    placeholder="Contoh: Blok A1 No. 12"
                    value={formData.blokRumah || ''}
                    onChange={(e) => setFormData({ ...formData, blokRumah: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RT / RW</label>
                  <input
                    type="text"
                    disabled
                    value={`${config.namaRT} / ${config.namaRW}`}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-100 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Terbit KK</label>
                  <input
                    type="date"
                    value={formData.tanggalTerbit || ''}
                    onChange={(e) => setFormData({ ...formData, tanggalTerbit: e.target.value })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Catatan Khusus */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pemilik rumah kontrakan, kontak darurat, dll."
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
                  Simpan Data Kartu Keluarga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
