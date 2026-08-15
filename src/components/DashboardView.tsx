import React, { useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  Home, 
  FileText, 
  HeartHandshake, 
  Baby, 
  UserPlus, 
  PlusCircle, 
  ShieldAlert, 
  FileSpreadsheet, 
  TrendingUp, 
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  ArrowLeftRight
} from 'lucide-react';
import { KartuKeluarga, Warga, SuratPengantar, MutasiPenduduk, RTConfig, CurrentUser } from '../types';
import { calculateDemographics } from '../services/storage';
import { BekasiLogo } from './BekasiLogo';

interface DashboardViewProps {
  wargaList: Warga[];
  kkList: KartuKeluarga[];
  suratList: SuratPengantar[];
  mutasiList: MutasiPenduduk[];
  config: RTConfig;
  currentUser: CurrentUser;
  onNavigateTab: (tab: string, entityId?: string) => void;
  onQuickAddKK: () => void;
  onQuickAddWarga: () => void;
  onQuickAddSurat: () => void;
  onExportExcel: () => void;
  onApproveSurat: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  wargaList,
  kkList,
  suratList,
  mutasiList,
  config,
  currentUser,
  onNavigateTab,
  onQuickAddKK,
  onQuickAddWarga,
  onQuickAddSurat,
  onExportExcel,
  onApproveSurat
}) => {
  // Statistics Calculations
  const stats = useMemo(() => {
    const totalJiwa = wargaList.length;
    const totalLaki = wargaList.filter(w => w.jenisKelamin === 'L').length;
    const totalPerempuan = wargaList.filter(w => w.jenisKelamin === 'P').length;
    
    const wargaTetap = wargaList.filter(w => w.statusTinggal === 'TETAP').length;
    const wargaKontrak = wargaList.filter(w => w.statusTinggal === 'KONTRAK' || w.statusTinggal === 'KOS').length;

    let lansiaCount = 0;
    let balitaCount = 0;
    let usiaSekolahCount = 0;
    let usiaProduktifCount = 0;
    let yatimCount = 0;
    let bansosCount = 0;

    wargaList.forEach(w => {
      const demo = calculateDemographics(w.tanggalLahir);
      if (demo.isLansia) lansiaCount++;
      if (demo.isBalita) balitaCount++;
      if (demo.usia >= 6 && demo.usia <= 18) usiaSekolahCount++;
      if (demo.usia >= 19 && demo.usia <= 59) usiaProduktifCount++;
      if (w.isYatim) yatimCount++;
      if (w.statusBansos && w.statusBansos !== 'TIDAK_ADA') bansosCount++;
    });

    const pendingSurat = suratList.filter(s => s.status === 'PENDING');
    const approvedSurat = suratList.filter(s => s.status === 'DISETUJUI');

    return {
      totalJiwa,
      totalLaki,
      totalPerempuan,
      totalKK: kkList.length,
      wargaTetap,
      wargaKontrak,
      lansiaCount,
      balitaCount,
      usiaSekolahCount,
      usiaProduktifCount,
      yatimCount,
      bansosCount,
      pendingSurat,
      approvedSurat
    };
  }, [wargaList, kkList, suratList]);

  return (
    <div className="space-y-6">
      {/* Header Bar with Action Buttons and Administrative Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Ikhtisar Administrasi Kependudukan
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              RT 004 / RW 007
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelurahan {config.kelurahan || 'Jatimulya'} &bull; Kec. {config.kecamatan || 'Tambun Selatan'} &bull; {config.kabupatenKota || 'Kabupaten Bekasi'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onExportExcel}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs px-3.5 py-2 rounded-lg font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Unduh seluruh data kependudukan ke format Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor Master Excel</span>
          </button>

          <button
            onClick={onQuickAddWarga}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 py-2 rounded-lg font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Tambah data warga baru ke database"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Input Warga Baru</span>
          </button>
        </div>
      </div>

      {/* 4 Clean Administrative Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Warga */}
        <div 
          onClick={() => onNavigateTab('warga')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Warga</p>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{stats.totalJiwa}</h2>
            <span className="text-xs text-slate-500 font-medium">Jiwa</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100">
            <span>♂ {stats.totalLaki} Laki-laki</span>
            <span>♀ {stats.totalPerempuan} Perempuan</span>
          </div>
        </div>

        {/* Total KK */}
        <div 
          onClick={() => onNavigateTab('kk')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kartu Keluarga (KK)</p>
            <Home className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{stats.totalKK}</h2>
            <span className="text-xs text-slate-500 font-medium">KK Aktif</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100">
            <span>{stats.wargaTetap} Warga Tetap</span>
            <span>{stats.wargaKontrak} Kontrak</span>
          </div>
        </div>

        {/* Lansia & Posyandu */}
        <div 
          onClick={() => onNavigateTab('bansos')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Lansia &amp; Balita</p>
            <Baby className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {stats.lansiaCount} <span className="text-sm font-normal text-slate-300">/</span> {stats.balitaCount}
            </h2>
            <span className="text-xs text-slate-500 font-medium">Jiwa</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100">
            <span>Lansia: {stats.lansiaCount}</span>
            <span>Balita: {stats.balitaCount}</span>
          </div>
        </div>

        {/* Surat Pengantar RT */}
        <div 
          onClick={() => onNavigateTab('surat')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surat Pengantar</p>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{suratList.length}</h2>
            <span className="text-xs text-slate-500 font-medium">Dokumen</span>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2.5 pt-2 border-t border-slate-100">
            <span className={stats.pendingSurat.length > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
              {stats.pendingSurat.length} Menunggu
            </span>
            <span className="text-emerald-700 font-semibold">{stats.approvedSurat.length} Terbit</span>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS SECTION (AKSES CEPAT ADMINISTRASI) */}
      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Akses Cepat Administrasi</h3>
          <span className="text-[11px] text-slate-500">Pintasan Layanan RT</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={onQuickAddWarga}
            className="flex items-center gap-3 p-3 bg-white hover:bg-slate-100/90 text-left rounded-lg border border-slate-200 transition cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Tambah Warga</div>
              <div className="text-[10px] text-slate-500">Input data identitas & NIK</div>
            </div>
          </button>

          <button
            onClick={onQuickAddSurat}
            className="flex items-center gap-3 p-3 bg-white hover:bg-slate-100/90 text-left rounded-lg border border-slate-200 transition cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200 group-hover:bg-slate-900 group-hover:text-white transition">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Surat Pengantar</div>
              <div className="text-[10px] text-slate-500">Buat & cetak format A4</div>
            </div>
          </button>

          <button
            onClick={onQuickAddKK}
            className="flex items-center gap-3 p-3 bg-white hover:bg-slate-100/90 text-left rounded-lg border border-slate-200 transition cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Data Kartu Keluarga</div>
              <div className="text-[10px] text-slate-500">Input No. KK & Kepala Keluarga</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('surat')}
            className="flex items-center gap-3 p-3 bg-white hover:bg-slate-100/90 text-left rounded-lg border border-slate-200 transition cursor-pointer group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 group-hover:bg-amber-600 group-hover:text-white transition">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Cetak Surat</div>
              <div className="text-[10px] text-slate-500">Daftar arsip siap cetak</div>
            </div>
          </button>
        </div>
      </div>

      {/* Main 2-Column Section: Antrean Surat Pengantar & Notifikasi Dokumen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Antrean Surat Pengantar (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="p-4 sm:p-4.5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Antrean Surat Pengantar RT</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Daftar permohonan surat pengantar dari warga</p>
            </div>
            <button 
              onClick={() => onNavigateTab('surat')}
              className="text-xs text-slate-700 hover:text-slate-900 font-semibold cursor-pointer flex items-center gap-1"
            >
              <span>Lihat Semua ({suratList.length})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 p-2 sm:p-3 overflow-x-auto">
            {suratList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Belum ada permohonan surat pengantar.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr className="h-8">
                    <th className="px-3 font-semibold">Nama Pemohon</th>
                    <th className="px-3 font-semibold">Keperluan</th>
                    <th className="px-3 font-semibold">Tanggal</th>
                    <th className="px-3 font-semibold">Status</th>
                    <th className="px-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suratList.slice(0, 5).map((surat) => (
                    <tr key={surat.id} className="h-11 hover:bg-slate-50 transition-colors">
                      <td className="px-3 font-medium text-slate-800">
                        <div>{surat.namaPemohon}</div>
                        <div className="text-[10px] text-slate-400 font-mono">NIK: {surat.nikPemohon}</div>
                      </td>
                      <td className="px-3 text-slate-600 max-w-[180px] truncate">
                        {surat.keperluan || surat.judulSurat}
                      </td>
                      <td className="px-3 text-slate-500 whitespace-nowrap text-[11px]">
                        {surat.tanggalPengajuan}
                      </td>
                      <td className="px-3">
                        {surat.status === 'PENDING' ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-semibold inline-block">
                            Menunggu
                          </span>
                        ) : surat.status === 'DISETUJUI' ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-semibold inline-block">
                            Disetujui
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded text-[10px] font-semibold inline-block">
                            Ditolak
                          </span>
                        )}
                      </td>
                      <td className="px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {surat.status === 'PENDING' && (
                            <button
                              onClick={() => onApproveSurat(surat.id)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] px-2.5 py-1 rounded font-medium transition cursor-pointer"
                            >
                              Setujui
                            </button>
                          )}
                          <button
                            onClick={() => onNavigateTab('surat', surat.id)}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded font-medium transition cursor-pointer"
                          >
                            Cetak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Notifikasi & Log Kegiatan (1 Col) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col">
          <div className="p-4 sm:p-4.5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Riwayat &amp; Notifikasi RT</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Pembaruan data kependudukan terkini</p>
          </div>

          <div className="flex-1 p-4 space-y-3.5">
            {/* Notification Item 1 */}
            <div className="flex space-x-2.5">
              <div className="w-1 bg-slate-400 rounded-full shrink-0"></div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Pembaruan KK RT 004</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tercatat {stats.totalKK} Kartu Keluarga aktif di lingkungan RT 004 RW 007 Jatimulya.
                </p>
                <button 
                  onClick={() => onNavigateTab('kk')}
                  className="text-[10px] text-slate-700 hover:text-slate-900 font-semibold mt-1 block cursor-pointer"
                >
                  Buka Data KK &rarr;
                </button>
              </div>
            </div>

            {/* Notification Item 2: Mutasi */}
            <div className="flex space-x-2.5">
              <div className="w-1 bg-amber-500 rounded-full shrink-0"></div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Laporan Mutasi Penduduk</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {mutasiList.length > 0 ? `${mutasiList[0].namaWarga} - ${mutasiList[0].jenisMutasi.replace('_', ' ')}` : 'Belum ada mutasi baru bulan ini.'}
                </p>
                <button 
                  onClick={() => onNavigateTab('mutasi')}
                  className="text-[10px] text-slate-700 hover:text-slate-900 font-semibold mt-1 block cursor-pointer"
                >
                  Riwayat Pindah &rarr;
                </button>
              </div>
            </div>

            {/* Notification Item 3: Spreadsheet Quick Box */}
            <div 
              onClick={onExportExcel}
              className="bg-slate-50 hover:bg-slate-100 p-3 rounded-lg border border-slate-200 transition cursor-pointer text-center"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 mx-auto mb-1" />
              <p className="text-xs text-slate-700 font-semibold">Unduh Spreadsheet Data Warga</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Format Excel lengkap multi-sheet (.xlsx)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
