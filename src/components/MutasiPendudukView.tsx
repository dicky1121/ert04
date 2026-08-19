 import React, { useState, useMemo } from 'react';
import { 
  History, 
  Plus, 
  Search, 
  ArrowRightLeft, 
  UserMinus, 
  UserPlus, 
  Baby, 
  HeartCrack, 
  Trash2, 
  X, 
  FileText, 
  Calendar,
  Building,
  CheckCircle
} from 'lucide-react';
import { MutasiPenduduk, Warga, RTConfig, JenisMutasi } from '../types';
import { useConfirm } from './ConfirmDialog';

interface MutasiPendudukViewProps {
  mutasiList: MutasiPenduduk[];
  wargaList: Warga[];
  config: RTConfig;
  onAddMutasi: (mutasi: MutasiPenduduk) => Promise<boolean>;
  onDeleteMutasi: (id: string) => Promise<boolean>;
}

export const MutasiPendudukView: React.FC<MutasiPendudukViewProps> = ({
  mutasiList,
  wargaList,
  config,
  onAddMutasi,
  onDeleteMutasi
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJenis, setFilterJenis] = useState<'ALL' | JenisMutasi>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [jenisMutasi, setJenisMutasi] = useState<JenisMutasi>('PINDAH_MASUK');
  const [nikWarga, setNikWarga] = useState('');
  const [namaWarga, setNamaWarga] = useState('');
  const [nomorKK, setNomorKK] = useState('');
  const [tanggalPeristiwa, setTanggalPeristiwa] = useState(new Date().toISOString().split('T')[0]);
  const [tanggalLapor, setTanggalLapor] = useState(new Date().toISOString().split('T')[0]);
  const [alamatAsal, setAlamatAsal] = useState('');
  const [alamatTujuan, setAlamatTujuan] = useState('');
  const [alasanMutasi, setAlasanMutasi] = useState('Pekerjaan / Domisili Baru');
  const [nomorSuratPindah, setNomorSuratPindah] = useState('');
  const [keterangan, setKeterangan] = useState('');

  // Dialog konfirmasi & notifikasi bergaya aplikasi (pengganti confirm/alert bawaan browser)
  const { confirm: askConfirm, notify, dialog } = useConfirm();

  const handleDeleteMutasi = async (item: MutasiPenduduk) => {
    const setuju = await askConfirm({
      title: 'Hapus Catatan Mutasi',
      message: `Catatan mutasi untuk ${item.namaWarga} akan dihapus dari buku mutasi penduduk. Lanjutkan?`,
      confirmLabel: 'Ya, Hapus Catatan',
      tone: 'danger'
    });
    if (setuju) await onDeleteMutasi(item.id);
  };

  // Handle citizen selection for Pindah Keluar or Kematian
  const handleSelectExistingCitizen = (nik: string) => {
    setNikWarga(nik);
    const w = wargaList.find(c => c.nik === nik);
    if (w) {
      setNamaWarga(w.nama);
      setNomorKK(w.nomorKK);
      setAlamatAsal(`RT 004 RW 007 Kel. Jatimulya, Tambun Selatan`);
    }
  };

  // Filter list
  const filteredMutasi = useMemo(() => {
    return mutasiList.filter(m => {
      const matchQuery =
        m.namaWarga.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.nikWarga || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.nomorKK.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.alasanMutasi && m.alasanMutasi.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.alamatTujuan && m.alamatTujuan.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.alamatAsal && m.alamatAsal.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchJenis = filterJenis === 'ALL' || m.jenisMutasi === filterJenis;
      return matchQuery && matchJenis;
    });
  }, [mutasiList, searchTerm, filterJenis]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaWarga || !nikWarga || !tanggalPeristiwa) {
      await notify({
        title: 'Data Belum Lengkap',
        message: 'NIK, Nama Warga, dan Tanggal Peristiwa wajib diisi sebelum catatan mutasi dapat disimpan.',
        tone: 'warning'
      });
      return;
    }

    const newMutasi: MutasiPenduduk = {
      id: `mut-${Date.now()}`,
      nikWarga: nikWarga.trim(),
      namaWarga: namaWarga.trim(),
      nomorKK: nomorKK.trim(),
      jenisMutasi,
      tanggalPeristiwa,
      tanggalLapor,
      alamatAsal: alamatAsal || '-',
      alamatTujuan: alamatTujuan || '-',
      alasanMutasi: alasanMutasi || '-',
      nomorSuratPindah: nomorSuratPindah || `SKP/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      keterangan: keterangan || '',
      dicatatOleh: 'Pengurus RT 004'
    };

    if (await onAddMutasi(newMutasi)) setIsFormOpen(false);
  };

  const getBadgeStyle = (type: JenisMutasi) => {
    switch (type) {
      case 'PINDAH_MASUK':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'PINDAH_KELUAR':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'KELAHIRAN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'KEMATIAN':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getIcon = (type: JenisMutasi) => {
    switch (type) {
      case 'PINDAH_MASUK': return <UserPlus className="w-4 h-4 text-emerald-600" />;
      case 'PINDAH_KELUAR': return <UserMinus className="w-4 h-4 text-amber-600" />;
      case 'KELAHIRAN': return <Baby className="w-4 h-4 text-purple-600" />;
      case 'KEMATIAN': return <HeartCrack className="w-4 h-4 text-rose-600" />;
      default: return <ArrowRightLeft className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dialog konfirmasi/notifikasi terpusat */}
      {dialog}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            Riwayat Mutasi Penduduk & Perubahan Warga
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan data pindah masuk, pindah keluar, peristiwa kelahiran, dan kematian di RT {config.namaRT} RW {config.namaRW}
          </p>
        </div>

        <button
          onClick={() => {
            setJenisMutasi('PINDAH_MASUK');
            setNikWarga('');
            setNamaWarga('');
            setNomorKK('');
            setAlamatAsal('');
            setAlamatTujuan('RT 004 RW 007 Kelurahan Jatimulya');
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Catat Mutasi Penduduk Baru
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari Nama Warga, NIK, Alamat Asal/Tujuan, Alasan Pindah..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'PINDAH_MASUK', 'PINDAH_KELUAR', 'KELAHIRAN', 'KEMATIAN'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterJenis(type)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filterJenis === type
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {type === 'ALL' ? 'Semua Peristiwa' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Riwayat mutasi — tabel (tampil ≥ md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="table-scroll">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Peristiwa Mutasi</th>
                <th className="px-4 py-3.5">Nama & NIK Warga</th>
                <th className="px-4 py-3.5">Alamat Asal / Tujuan</th>
                <th className="px-4 py-3.5">Tanggal & No. Surat</th>
                <th className="px-4 py-3.5">Alasan / Keterangan</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMutasi.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">Belum ada riwayat mutasi penduduk</p>
                    <p className="text-xs text-slate-500 mt-0.5">Catat setiap perpindahan warga untuk laporan kelurahan yang akurat.</p>
                  </td>
                </tr>
              ) : (
                filteredMutasi.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-slate-100">
                          {getIcon(item.jenisMutasi)}
                        </div>
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getBadgeStyle(item.jenisMutasi)}`}>
                            {item.jenisMutasi.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{item.namaWarga}</div>
                      <div className="font-mono text-slate-500 text-xs">
                        NIK: {item.nikWarga}
                      </div>
                      <div className="text-xs text-emerald-700 font-mono">
                        KK: {item.nomorKK}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="text-slate-800 font-medium">
                        <span className="text-slate-500 text-xs block">Asal:</span>
                        {item.alamatAsal}
                      </div>
                      <div className="text-slate-800 font-medium mt-1">
                        <span className="text-slate-500 text-xs block">Tujuan:</span>
                        {item.alamatTujuan}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-800">Peristiwa: {item.tanggalPeristiwa}</div>
                      <div className="text-xs text-slate-500">Lapor: {item.tanggalLapor}</div>
                      {item.nomorSuratPindah && (
                        <div className="font-mono text-xs text-emerald-800 mt-0.5">
                          {item.nomorSuratPindah}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-medium text-slate-800">{item.alasanMutasi}</div>
                      {item.keterangan && (
                        <div className="text-xs text-slate-500 italic mt-0.5">
                          {item.keterangan}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDeleteMutasi(item)}

                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Hapus Log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Riwayat mutasi — kartu (mobile, tampil < md) */}
      <div className="md:hidden space-y-3">
        {filteredMutasi.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs text-center py-10 px-4">
            <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="font-semibold text-slate-600">Belum ada riwayat mutasi penduduk</p>
            <p className="text-xs text-slate-500 mt-0.5">Catat setiap perpindahan warga untuk laporan kelurahan yang akurat.</p>
          </div>
        ) : (
          filteredMutasi.map((item) => (
            <article key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Header kartu */}
              <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-slate-100 shrink-0">{getIcon(item.jenisMutasi)}</div>
                  <div className="min-w-0">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border ${getBadgeStyle(item.jenisMutasi)}`}>{item.jenisMutasi.replace('_', ' ')}</span>
                    <div className="font-bold text-slate-900 text-sm truncate mt-1">{item.namaWarga}</div>
                  </div>
                </div>
                <button onClick={() => handleDeleteMutasi(item)} className="shrink-0 p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-slate-200 cursor-pointer" title="Hapus Log" aria-label="Hapus Log">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Isi kartu */}
              <div className="px-4 py-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">NIK / KK</span>
                  <span className="font-mono text-slate-700 text-right">{item.nikWarga} &bull; {item.nomorKK}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Asal</span>
                  <span className="font-medium text-slate-800 text-right">{item.alamatAsal}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Tujuan</span>
                  <span className="font-medium text-slate-800 text-right">{item.alamatTujuan}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 shrink-0">Tanggal</span>
                  <span className="text-slate-700 text-right">Peristiwa {item.tanggalPeristiwa} &bull; Lapor {item.tanggalLapor}</span>
                </div>
                {item.nomorSuratPindah && (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500 shrink-0">No. Surat</span>
                    <span className="font-mono text-emerald-800 text-right">{item.nomorSuratPindah}</span>
                  </div>
                )}
                <div className="pt-0.5">
                  <span className="font-medium text-slate-800">{item.alasanMutasi}</span>
                  {item.keterangan && <span className="text-slate-500 italic"> — {item.keterangan}</span>}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* FORM MODAL: CATAT MUTASI */}
      {isFormOpen && (
        <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Catat Mutasi / Perubahan Penduduk</h3>
                  <p className="text-xs text-slate-300">RT {config.namaRT} RW {config.namaRW} Kelurahan {config.kelurahan}</p>
                </div>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Jenis Mutasi Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Peristiwa Mutasi</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'PINDAH_MASUK', label: 'Pindah Masuk', icon: UserPlus },
                    { id: 'PINDAH_KELUAR', label: 'Pindah Keluar', icon: UserMinus },
                    { id: 'KELAHIRAN', label: 'Kelahiran Bayi', icon: Baby },
                    { id: 'KEMATIAN', label: 'Kematian Warga', icon: HeartCrack },
                  ].map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setJenisMutasi(m.id as any)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                        jenisMutasi === m.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <m.icon className="w-4 h-4" />
                      <span className="text-xs">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick select existing citizen if Pindah Keluar or Kematian */}
              {(jenisMutasi === 'PINDAH_KELUAR' || jenisMutasi === 'KEMATIAN') && wargaList.length > 0 && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <label className="block font-bold text-amber-900 mb-1">Pilih dari Warga RT 004:</label>
                  <select
                    value={nikWarga}
                    onChange={(e) => handleSelectExistingCitizen(e.target.value)}
                    className="w-full p-2 border border-amber-300 rounded-lg text-xs bg-white"
                  >
                    <option value="">-- Pilih Warga Terdaftar --</option>
                    {wargaList.map(w => (
                      <option key={w.id} value={w.nik}>{w.nama} (NIK: {w.nik})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Warga <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Lengkap"
                    value={namaWarga}
                    onChange={(e) => setNamaWarga(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NIK Warga (16 Digit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="Nomor Induk Kependudukan"
                    value={nikWarga}
                    onChange={(e) => setNikWarga(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Kartu Keluarga (KK)</label>
                  <input
                    type="text"
                    maxLength={16}
                    placeholder="Nomor KK 16 Digit"
                    value={nomorKK}
                    onChange={(e) => setNomorKK(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Peristiwa</label>
                  <input
                    type="date"
                    value={tanggalPeristiwa}
                    onChange={(e) => setTanggalPeristiwa(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Asal</label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Kemang RT 01 RW 02 Kel. Margahayu"
                    value={alamatAsal}
                    onChange={(e) => setAlamatAsal(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Tujuan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Mawar No. 15 RT 004 RW 007 Jatimulya"
                    value={alamatTujuan}
                    onChange={(e) => setAlamatTujuan(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alasan Mutasi / Keterangan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Mengikuti Suami / Pindah Tugas / Melahirkan"
                    value={alasanMutasi}
                    onChange={(e) => setAlasanMutasi(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Surat Pindah / SKPWNI (Jika Ada)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 471.2/105-Kel.JTM/2025"
                    value={nomorSuratPindah}
                    onChange={(e) => setNomorSuratPindah(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>
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
                  Simpan Catatan Mutasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
