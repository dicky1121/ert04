import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  X, 
  User, 
  Edit3,
  Check,
  Upload,
  FileType
} from 'lucide-react';
import { SuratPengantar, Warga, RTConfig, JenisSurat } from '../types';
import { SuratPrintTemplate } from './SuratPrintTemplate';
import { DocUploadModal, getSavedDocTemplate, DocTemplateStructure } from './DocUploadModal';
import { formatDateDDMMYYYY } from '../services/storage';
import { useConfirm } from './ConfirmDialog';

interface SuratPengantarViewProps {
  suratList: SuratPengantar[];
  wargaList: Warga[];
  config: RTConfig;
  onAddSurat: (surat: any) => void;
  onUpdateStatus: (id: string, status: 'DISETUJUI' | 'DITOLAK', alasan?: string) => void;
  onDeleteSurat: (id: string) => void;
  selectedSuratId?: string | null;
}

export const SuratPengantarView: React.FC<SuratPengantarViewProps> = ({
  suratList,
  wargaList,
  config,
  onAddSurat,
  onUpdateStatus,
  onDeleteSurat,
  selectedSuratId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'DISETUJUI' | 'DITOLAK'>('ALL');
  
  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isDocUploadOpen, setIsDocUploadOpen] = useState(false);
  const [docTemplate, setDocTemplate] = useState<DocTemplateStructure | null>(getSavedDocTemplate());
  const [activeSurat, setActiveSurat] = useState<SuratPengantar | null>(null);

  // Rejection modal
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Form State matching the requested template exact fields:
  // Nama, Tempat Tgl Lahir, Jenis Kelamin, Status Perkawinan, Agama, No Ktp / No Nik, Pekerjaan, Telepon / Hp, Alamat Lengkap, Keperluan
  const [selectedNik, setSelectedNik] = useState('');
  const [nomorSurat, setNomorSurat] = useState('184 / RT 004 RW 007 / SP / 2026');
  const [jenisSurat, setJenisSurat] = useState<JenisSurat>('LAINNYA');
  const [judulSurat, setJudulSurat] = useState('Surat Pengantar RT');
  
  const [namaPemohon, setNamaPemohon] = useState('');
  const [tempatTglLahir, setTempatTglLahir] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<'L' | 'P'>('L');
  const [statusKawin, setStatusKawin] = useState('');
  const [agama, setAgama] = useState('');
  const [nikPemohon, setNikPemohon] = useState('');
  const [nomorKKPemohon, setNomorKKPemohon] = useState('');
  const [pekerjaan, setPekerjaan] = useState('');
  const [telepon, setTelepon] = useState('');
  
  // Alamat Lengkap (Auto input & Editable)
  const defaultAlamatBaris1 = `Kp Jati RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} Kelurahan ${config.kelurahan || 'Jatimulya'}`;
  const defaultAlamatBaris2 = `Kec. ${config.kecamatan || 'Tambun Selatan'} Kab. ${config.kabupatenKota?.replace('Kabupaten ', '') || 'Bekasi'}`;
  const [alamatBaris1, setAlamatBaris1] = useState(defaultAlamatBaris1);
  const [alamatBaris2, setAlamatBaris2] = useState(defaultAlamatBaris2);

  // Keperluan (Auto input & Editable)
  const [keperluan1, setKeperluan1] = useState('');
  const [keperluan2, setKeperluan2] = useState('');

  // Quick Preset options
  const letterPresets = [
    { 
      type: 'KEMATIAN', 
      label: 'Pembuatan Akta Kematian', 
      title: 'Surat Pengantar Akta Kematian', 
      defaultKeperluan1: 'Membuat Akta Kematian',
      defaultKeperluan2: ''
    },
    { 
      type: 'KTP_KK', 
      label: 'Pengantar KTP / KK', 
      title: 'Surat Pengantar KTP / KK', 
      defaultKeperluan1: 'Pembuatan KTP Elektronik Baru di Kecamatan',
      defaultKeperluan2: ''
    },
    { 
      type: 'DOMISILI', 
      label: 'Keterangan Domisili', 
      title: 'Surat Keterangan Domisili Tempat Tinggal', 
      defaultKeperluan1: 'Kelengkapan Berkas Administrasi Pekerjaan',
      defaultKeperluan2: ''
    },
    { 
      type: 'SKTM', 
      label: 'Keterangan Tidak Mampu (SKTM)', 
      title: 'Surat Pengantar Keterangan Tidak Mampu', 
      defaultKeperluan1: 'Permohonan Keringanan Biaya Pendidikan / Beasiswa',
      defaultKeperluan2: ''
    },
    { 
      type: 'USAHA', 
      label: 'Keterangan Usaha (SKU)', 
      title: 'Surat Keterangan Usaha Lingkungan RT', 
      defaultKeperluan1: 'Pengajuan Pinjaman Modal Usaha KUR Bank',
      defaultKeperluan2: ''
    },
    { 
      type: 'SKCK', 
      label: 'Pengantar SKCK', 
      title: 'Surat Pengantar Catatan Kepolisian', 
      defaultKeperluan1: 'Persyaratan Pengurusan SKCK di Polsek Tambun Selatan',
      defaultKeperluan2: ''
    },
  ];

  // Auto trigger external selection
  React.useEffect(() => {
    if (selectedSuratId) {
      const found = suratList.find(s => s.id === selectedSuratId);
      if (found) {
        setActiveSurat(found);
        setIsPrintModalOpen(true);
      }
    }
  }, [selectedSuratId, suratList]);

  const formatStatusPerkawinanLabel = (status: string) => {
    if (!status) return 'Kawin';
    const s = status.toUpperCase();
    if (s === 'CERAI_MATI' || s.includes('CERAI MATI')) return 'Cerai Mati';
    if (s === 'CERAI_HIDUP' || s.includes('CERAI HIDUP')) return 'Cerai Hidup';
    if (s === 'BELUM_KAWIN' || s.includes('BELUM KAWIN') || s === 'BELUM') return 'Belum Kawin';
    if (s === 'KAWIN') return 'Kawin';
    return status;
  };

  const formatAgamaLabel = (agm: string) => {
    if (!agm) return 'Islam';
    const s = agm.toUpperCase();
    if (s === 'ISLAM') return 'Islam';
    if (s === 'KRISTEN') return 'Kristen';
    if (s === 'KATOLIK') return 'Katolik';
    if (s === 'HINDU') return 'Hindu';
    if (s === 'BUDDHA') return 'Buddha';
    if (s === 'KONGHUCU') return 'Konghucu';
    return agm;
  };

  // When citizen is chosen in form, auto-fill details
  const handleSelectCitizen = (nik: string) => {
    setSelectedNik(nik);
    const target = wargaList.find(w => w.nik === nik);
    if (target) {
      setNamaPemohon(target.nama);
      setNikPemohon(target.nik);
      setNomorKKPemohon(target.nomorKK || '');
      
      const formattedDate = target.tanggalLahir ? formatDateDDMMYYYY(target.tanggalLahir) : '';
      setTempatTglLahir(`${target.tempatLahir || 'Bekasi'}, ${formattedDate}`);
      
      setJenisKelamin(target.jenisKelamin === 'L' ? 'L' : 'P');
      setAgama(formatAgamaLabel(target.agama));
      setPekerjaan(target.pekerjaan || 'Mengurus Rumah Tangga');
      setStatusKawin(formatStatusPerkawinanLabel(target.statusPerkawinan));
      setTelepon(target.nomorHp || '-');
      
      // Auto input standard address (remains editable!)
      setAlamatBaris1(`Kp Jati RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} Kelurahan ${config.kelurahan || 'Jatimulya'}`);
      setAlamatBaris2(`Kec. ${config.kecamatan || 'Tambun Selatan'} Kab. ${config.kabupatenKota?.replace('Kabupaten ', '') || 'Bekasi'}`);
    }
  };

  const handleSelectPreset = (preset: typeof letterPresets[0]) => {
    setJenisSurat(preset.type as any);
    setJudulSurat(preset.title);
    setKeperluan1(preset.defaultKeperluan1);
    setKeperluan2(preset.defaultKeperluan2);
  };

  // Filter list
  const filteredSurat = useMemo(() => {
    return suratList.filter(s => {
      const matchQuery =
        s.nomorSurat.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.namaPemohon.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nikPemohon.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.judulSurat.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.keperluan.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = filterStatus === 'ALL' || s.status === filterStatus;
      return matchQuery && matchStatus;
    });
  }, [suratList, searchTerm, filterStatus]);

  const pendingCount = useMemo(() => {
    return suratList.filter(s => s.status === 'PENDING').length;
  }, [suratList]);

  const handleOpenCreateModal = () => {
    const nextNum = (suratList.length + 184).toString();
    setNomorSurat(`${nextNum} / RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} / SP / 2026`);
    
    if (wargaList.length > 0) {
      handleSelectCitizen(wargaList[0].nik);
    } else {
      // Belum ada data warga: kosongkan form agar diisi manual oleh petugas
      setNamaPemohon('');
      setNikPemohon('');
      setTempatTglLahir('');
      setJenisKelamin('L');
      setStatusKawin('');
      setAgama('');
      setPekerjaan('');
      setTelepon('');
      setAlamatBaris1(defaultAlamatBaris1);
      setAlamatBaris2(defaultAlamatBaris2);
      setKeperluan1('');
      setKeperluan2('');
    }
    
    setIsFormOpen(true);
  };

  const handleSubmitSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPemohon || !nikPemohon || !keperluan1) {
      await notify({
        title: 'Data Belum Lengkap',
        message: 'Nama Pemohon, NIK, dan Keperluan Surat wajib diisi sebelum surat pengantar dapat diterbitkan.',
        tone: 'warning'
      });
      return;
    }

    const newSurat: SuratPengantar = {
      id: `sp-${Date.now()}`,
      nomorSurat: nomorSurat || `184 / RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} / SP / 2026`,
      jenisSurat,
      judulSurat: 'SURAT PENGANTAR',
      nikPemohon,
      namaPemohon,
      nomorKKPemohon: nomorKKPemohon || '3216060101150001',
      tempatTglLahirPemohon: tempatTglLahir,
      jenisKelaminPemohon: jenisKelamin,
      agamaPemohon: agama,
      pekerjaanPemohon: pekerjaan,
      statusKawinPemohon: statusKawin,
      teleponPemohon: telepon,
      alamatBaris1,
      alamatBaris2,
      alamatPemohon: `${alamatBaris1}, ${alamatBaris2}`,
      keperluan: keperluan1,
      keperluanBaris1: keperluan1,
      keperluanBaris2: keperluan2,
      keteranganLain: keperluan2,
      tanggalPengajuan: new Date().toISOString().split('T')[0],
      tanggalDisetujui: new Date().toISOString().split('T')[0],
      status: 'DISETUJUI',
      namaPejabatTtd: config.namaKetuaRT || 'Ketua RT 004',
      jabatanTtd: `Ketua RT ${config.namaRT || '004'}`,
      namaKetuaRT: config.namaKetuaRT || 'Ketua RT 004',
      namaKetuaRW: config.namaKetuaRW || 'Ketua RW 007',
      kodeVerifikasiQr: `VERIF-RT04-RW07-${Date.now().toString().slice(-6)}`,
      dibuatOleh: 'ADMIN'
    };

    onAddSurat(newSurat);
    setIsFormOpen(false);

    // Open print preview immediately
    setActiveSurat(newSurat);
    setIsPrintModalOpen(true);
  };

  const handleApprove = (surat: SuratPengantar) => {
    onUpdateStatus(surat.id, 'DISETUJUI');
  };

  const handleOpenReject = (id: string) => {
    setRejectId(id);
    setRejectReason('');
    setIsRejectOpen(true);
  };

  const handleConfirmReject = () => {
    if (rejectId) {
      onUpdateStatus(rejectId, 'DITOLAK', rejectReason || 'Persyaratan administrasi belum lengkap');
      setIsRejectOpen(false);
    }
  };

  // Dialog konfirmasi & notifikasi bergaya aplikasi (pengganti confirm/alert bawaan browser)
  const { confirm: askConfirm, notify, dialog } = useConfirm();

  const handleDeleteSurat = async (surat: SuratPengantar) => {
    const setuju = await askConfirm({
      title: 'Hapus Arsip Surat',
      message: `Arsip surat nomor ${surat.nomorSurat} atas nama ${surat.namaPemohon} akan dihapus permanen dari daftar surat RT. Lanjutkan?`,
      confirmLabel: 'Ya, Hapus Arsip',
      tone: 'danger'
    });
    if (setuju) onDeleteSurat(surat.id);
  };

  const handleResetAlamat = () => {
    setAlamatBaris1(`Kp Jati RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} Kelurahan ${config.kelurahan || 'Jatimulya'}`);
    setAlamatBaris2(`Kec. ${config.kecamatan || 'Tambun Selatan'} Kab. ${config.kabupatenKota?.replace('Kabupaten ', '') || 'Bekasi'}`);
  };

  return (
    <div className="space-y-5">
      {/* Dialog konfirmasi/notifikasi terpusat */}
      {dialog}

      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700" />
              Penerbitan &amp; Cetak Surat Pengantar RT
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Format Resmi A4
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Format resmi RT {config.namaRT || '004'} RW {config.namaRW || '007'} Kelurahan {config.kelurahan || 'Jatimulya'} &bull; Standar Kop &amp; Isian Administrasi
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsDocUploadOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer"
            title="Unggah contoh berkas Word (.doc/.docx) untuk dijadikan format acuan otomatis"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>{docTemplate ? 'Acuan DOC: Aktif' : 'Unggah Berkas DOC'}</span>
            {docTemplate && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Buat Surat Pengantar Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari Nomor Surat, Nama Pemohon, NIK, atau Keperluan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'PENDING', 'DISETUJUI', 'DITOLAK'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                filterStatus === status
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{status === 'ALL' ? 'Semua Surat' : status === 'PENDING' ? 'Menunggu' : status === 'DISETUJUI' ? 'Disetujui' : 'Ditolak'}</span>
              {status === 'PENDING' && pendingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Letters */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="table-scroll">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Nomor &amp; Judul Surat</th>
                <th className="px-4 py-3">Nama &amp; NIK Pemohon</th>
                <th className="px-4 py-3">Keperluan &amp; Alamat</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSurat.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">Tidak ada data surat pengantar</p>
                    <p className="text-xs text-slate-400 mt-0.5">Klik &quot;Buat Surat Pengantar Baru&quot; untuk mencetak surat format resmi.</p>
                  </td>
                </tr>
              ) : (
                filteredSurat.map((surat) => (
                  <tr key={surat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900 text-xs">SURAT PENGANTAR</div>
                      <div className="font-mono text-emerald-800 font-semibold text-[11px] mt-0.5">
                        NO : {surat.nomorSurat}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {surat.jenisSurat}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{surat.namaPemohon}</div>
                      <div className="font-mono text-slate-500 text-[11px]">
                        NIK: {surat.nikPemohon}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {surat.pekerjaanPemohon} &bull; {surat.statusKawinPemohon}
                      </div>
                    </td>

                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-slate-900 line-clamp-1">{surat.keperluan}</div>
                      {surat.keteranganLain && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          {surat.keteranganLain}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {surat.alamatPemohon}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      <div>Tgl: {surat.tanggalPengajuan ? formatDateDDMMYYYY(surat.tanggalPengajuan) : '-'}</div>
                      <div className="text-[10px] text-slate-400">
                        TTD: {surat.namaKetuaRT || config.namaKetuaRT || 'Yanto'}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        surat.status === 'DISETUJUI'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : surat.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {surat.status === 'DISETUJUI' && <CheckCircle2 className="w-3 h-3" />}
                        {surat.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {surat.status === 'DITOLAK' && <XCircle className="w-3 h-3" />}
                        <span>{surat.status === 'PENDING' ? 'Menunggu' : surat.status === 'DISETUJUI' ? 'Disetujui' : 'Ditolak'}</span>
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Approval actions for pending */}
                        {surat.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(surat)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium text-xs transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              title="Setujui Surat"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Setujui</span>
                            </button>
                            <button
                              onClick={() => handleOpenReject(surat.id)}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Tolak Surat"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        {/* Print preview button */}
                        <button
                          onClick={() => {
                            setActiveSurat(surat);
                            setIsPrintModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer"
                          title="Pratinjau & Cetak Surat A4"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Cetak A4</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSurat(surat)}

                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Surat"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINT PREVIEW MODAL */}
      {isPrintModalOpen && activeSurat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-transparent print:static print:overflow-visible print:inset-auto">
          <div className="w-full max-w-5xl my-auto animate-in zoom-in-95 duration-150 print:max-w-none print:w-full print:m-0 print:animate-none">
            <SuratPrintTemplate
              surat={activeSurat}
              config={config}
              onClose={() => setIsPrintModalOpen(false)}
              onUpdateSurat={(updated) => {
                setActiveSurat(updated);
              }}
            />
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {isRejectOpen && (
        <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900">Tolak Permohonan Surat</h3>
            <p className="text-xs text-slate-600">
              Berikan alasan penolakan agar pemohon dapat memperbaiki dokumen atau persyaratannya:
            </p>
            <textarea
              rows={3}
              placeholder="Contoh: Dokumen KTP pemohon belum dilampirkan atau domisili belum terverifikasi."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setIsRejectOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* FORM MODAL: BUAT SURAT PENGANTAR (EXACT INPUT FIELDS)    */}
      {/* ======================================================== */}
      {isFormOpen && (
        <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header Form */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Buat Template Surat Pengantar RT</h3>
                  <p className="text-xs text-slate-300">Format Resmi RT 004 RW 007 Kelurahan Jatimulya</p>
                </div>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSurat} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Info Acuan Format Berkas */}
              <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-xl flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold">Format Tunggal Resmi: SURAT PENGANTAR RT 004 RW 007 (Kop &amp; Isian Sesuai Berkas Acuan)</span>
                </div>
                <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-300">
                  Standar Kelurahan Jatimulya
                </span>
              </div>

              {/* Citizen Auto-fill Selector */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 text-xs">
                    Pilih Data Warga untuk Auto-Fill Isian:
                  </label>
                  <span className="text-[11px] text-emerald-700 font-medium">Auto-Isi Otomatis</span>
                </div>
                <select
                  value={selectedNik}
                  onChange={(e) => handleSelectCitizen(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white font-medium"
                >
                  <option value="">-- Pilih Warga dari Database (Atau Ketik Manual Di Bawah) --</option>
                  {wargaList.map((w) => (
                    <option key={w.id} value={w.nik}>
                      {w.nama} (NIK: {w.nik}) - KK: {w.nomorKK}
                    </option>
                  ))}
                </select>
              </div>

              {/* ISIAN RESMI SESUAI PERMINTAAN USER */}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <h4 className="font-bold text-slate-900 text-xs border-b pb-2 flex items-center justify-between">
                  <span>Isian Data Surat Pengantar:</span>
                  <span className="text-slate-500 font-normal font-mono text-[11px]">Format Word RT 004 RW 007</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Nomor Surat */}
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor Surat <span className="text-slate-400 font-normal">(Contoh: 184 / RT 004 RW 007 / SP / 2026)</span>
                    </label>
                    <input
                      type="text"
                      value={nomorSurat}
                      onChange={(e) => setNomorSurat(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-mono font-bold"
                    />
                  </div>

                  {/* Nama */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Nama lengkap pemohon"
                      value={namaPemohon}
                      onChange={(e) => setNamaPemohon(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-semibold"
                      required
                    />
                  </div>

                  {/* Tempat Tgl Lahir */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tempat Tgl Lahir <span className="text-slate-400 font-normal">(Contoh: Solo, 04-05-1962)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Solo, 04-05-1962"
                      value={tempatTglLahir}
                      onChange={(e) => setTempatTglLahir(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  {/* Jenis Kelamin */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
                    <select
                      value={jenisKelamin}
                      onChange={(e) => setJenisKelamin(e.target.value as 'L' | 'P')}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value="P">Perempuan</option>
                      <option value="L">Laki-Laki</option>
                    </select>
                  </div>

                  {/* Status Perkawinan */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Status Perkawinan <span className="text-slate-400 font-normal">(Cerai Mati / Kawin / Belum Kawin / Cerai Hidup)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Cerai Mati"
                      value={statusKawin}
                      onChange={(e) => setStatusKawin(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  {/* Agama */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Agama</label>
                    <input
                      type="text"
                      placeholder="Contoh: Islam"
                      value={agama}
                      onChange={(e) => setAgama(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  {/* No Ktp / No Nik */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      No Ktp / No Nik <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 3216064405620011"
                      value={nikPemohon}
                      onChange={(e) => setNikPemohon(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-mono tracking-wide"
                      required
                    />
                  </div>

                  {/* Pekerjaan */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Pekerjaan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Mengurus Rumah Tangga"
                      value={pekerjaan}
                      onChange={(e) => setPekerjaan(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  {/* Telepon / Hp */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Telepon / Hp <span className="text-slate-400 font-normal">(Default: -)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="-"
                      value={telepon}
                      onChange={(e) => setTelepon(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                    />
                  </div>
                </div>

                {/* ALAMAT LENGKAP (AUTO INPUT ATAU BISA DIUBAH) */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-800 text-xs">
                      Alamat Lengkap (Auto Input & Dapat Diubah):
                    </label>
                    <button
                      type="button"
                      onClick={handleResetAlamat}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline cursor-pointer"
                    >
                      Reset ke Default RT
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Baris 1:</span>
                      <input
                        type="text"
                        value={alamatBaris1}
                        onChange={(e) => setAlamatBaris1(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white font-medium"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Baris 2:</span>
                      <input
                        type="text"
                        value={alamatBaris2}
                        onChange={(e) => setAlamatBaris2(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* KEPERLUAN */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <label className="block font-bold text-slate-800 text-xs">
                    Keperluan <span className="text-rose-500">*</span>:
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Keperluan Baris 1 (Pokok):</span>
                      <input
                        type="text"
                        placeholder="Contoh: Membuat Akta Kematian"
                        value={keperluan1}
                        onChange={(e) => setKeperluan1(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                        required
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-medium">Keperluan Baris 2 (Tanggal / Rincian Tambahan):</span>
                      <input
                        type="text"
                        placeholder="Contoh: 04 Nopember 2017"
                        value={keperluan2}
                        onChange={(e) => setKeperluan2(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Terbitkan & Lihat Pratinjau Cetak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DOC Upload Modal */}
      <DocUploadModal
        isOpen={isDocUploadOpen}
        onClose={() => setIsDocUploadOpen(false)}
        config={config}
        onTemplateApplied={(template) => {
          setDocTemplate(template);
        }}
      />
    </div>
  );
};
