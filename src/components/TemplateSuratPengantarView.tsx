import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Save, 
  RotateCcw, 
  Printer, 
  Copy, 
  Check, 
  Search, 
  Users, 
  Sparkles, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Image as ImageIcon,
  Building2,
  FileCheck2,
  Calendar,
  Send,
  MapPin,
  RefreshCw,
  Plus,
  FileDown,
  Download,
  ExternalLink,
  Type
} from 'lucide-react';
import { RTConfig, Warga, SuratPengantar } from '../types';
import { LambangBekasiLogo } from './BekasiLogo';
import { storageService, formatDateDDMMYYYY } from '../services/storage';
import { printOfficialLetter, exportLetterToWord, downloadLetterHtml } from '../utils/printDocument';

interface TemplateSuratPengantarViewProps {
  config: RTConfig;
  wargaList: Warga[];
  onSaveConfig: (updated: RTConfig) => Promise<boolean>;
  onAddSurat?: (surat: any) => Promise<boolean>;
}

export const TemplateSuratPengantarView: React.FC<TemplateSuratPengantarViewProps> = ({
  config,
  wargaList,
  onSaveConfig,
  onAddSurat
}) => {
  const [activeTab, setActiveTab] = useState<'AUTO_FILL' | 'KOP_HEADER' | 'ISI_SURAT' | 'TIPOGRAFI'>('AUTO_FILL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- KOP & LOGO STATE ---
  const [useDefaultLogo, setUseDefaultLogo] = useState<boolean>(!config.kopLogoDataUrl);
  const [logoDataUrl, setLogoDataUrl] = useState<string>(config.kopLogoDataUrl || '');
  const [logoName, setLogoName] = useState<string>(config.kopLogoName || '');
  const [logoWidthMm, setLogoWidthMm] = useState<number>(config.kopLogoWidthMm || 24);
  const [offsetX, setOffsetX] = useState<number>(config.kopLogoOffsetXMm || 0);
  const [offsetY, setOffsetY] = useState<number>(config.kopLogoOffsetYMm || 0);
  
  // Header texts
  const [kopInstansiAtas, setKopInstansiAtas] = useState<string>(config.kopInstansiAtas || 'PEMERINTAH KABUPATEN BEKASI');
  const [kopTeksRT, setKopTeksRT] = useState<string>(config.kopTeksRT || 'RT 004  RW 007');
  const [kopKelurahan, setKopKelurahan] = useState<string>(config.kopKelurahan || 'KELURAHAN JATIMULYA');
  const [kopKecamatan, setKopKecamatan] = useState<string>(config.kopKecamatan || 'KECAMATAN TAMBUN SELATAN');
  const [kopSekretariatText, setKopSekretariatText] = useState<string>(config.kopSekretariatText || 'Sekretariat : jl jampang no 111  jatimulya tlp 0896-7720-3444');

  // --- ISI SURAT STATE ---
  const [judulSurat, setJudulSurat] = useState<string>(config.judulSuratPengantar || 'SURAT PENGANTAR');
  const [nomorSurat, setNomorSurat] = useState<string>(config.formatNomorSurat || '185 / RT 004 RW 007 / SP / 2026');
  const [kalimatPembuka, setKalimatPembuka] = useState<string>(
    config.kalimatPembukaSurat || 'Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :'
  );
  const [kalimatPenutup, setKalimatPenutup] = useState<string>(
    config.kalimatPenutupSurat || 'Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.'
  );

  // Signatures
  const [lokasiSurat, setLokasiSurat] = useState<string>(config.lokasiSurat || 'Jatimulya');
  const [tanggalSurat, setTanggalSurat] = useState<string>('12-08-2026');
  const [namaKetuaRT, setNamaKetuaRT] = useState<string>(config.namaKetuaRT || 'Yanto');
  const [namaKetuaRW, setNamaKetuaRW] = useState<string>(config.namaKetuaRW || 'Imron Rosadi');

  // Typography & spacing
  const [fontFamily, setFontFamily] = useState<NonNullable<RTConfig['suratFontFamily']>>(config.suratFontFamily || 'Arial');
  const [bodyFontSizePt, setBodyFontSizePt] = useState(config.suratBodyFontSizePt || 10);
  const [kopFontSizePt, setKopFontSizePt] = useState(config.suratKopFontSizePt || 12);
  const [titleFontSizePt, setTitleFontSizePt] = useState(config.suratTitleFontSizePt || 12);
  const [lineHeight, setLineHeight] = useState(config.suratLineHeight || 1.35);
  const [rowSpacingPt, setRowSpacingPt] = useState(config.suratRowSpacingPt ?? 2);
  const [sectionSpacingPt, setSectionSpacingPt] = useState(config.suratSectionSpacingPt || 12);
  const [signatureSpacePt, setSignatureSpacePt] = useState(config.suratSignatureSpacePt || 60);

  // Terapkan perubahan konfigurasi yang datang dari akun/perangkat lain
  // tanpa memaksa pengguna memuat ulang halaman editor.
  useEffect(() => {
    setUseDefaultLogo(!config.kopLogoDataUrl);
    setLogoDataUrl(config.kopLogoDataUrl || '');
    setLogoName(config.kopLogoName || '');
    setLogoWidthMm(config.kopLogoWidthMm || 24);
    setOffsetX(config.kopLogoOffsetXMm || 0);
    setOffsetY(config.kopLogoOffsetYMm || 0);
    setKopInstansiAtas(config.kopInstansiAtas || 'PEMERINTAH KABUPATEN BEKASI');
    setKopTeksRT(config.kopTeksRT || 'RT 004  RW 007');
    setKopKelurahan(config.kopKelurahan || 'KELURAHAN JATIMULYA');
    setKopKecamatan(config.kopKecamatan || 'KECAMATAN TAMBUN SELATAN');
    setKopSekretariatText(config.kopSekretariatText || 'Sekretariat : jl jampang no 111  jatimulya tlp 0896-7720-3444');
    setJudulSurat(config.judulSuratPengantar || 'SURAT PENGANTAR');
    setNomorSurat(config.formatNomorSurat || '185 / RT 004 RW 007 / SP / 2026');
    setKalimatPembuka(config.kalimatPembukaSurat || 'Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :');
    setKalimatPenutup(config.kalimatPenutupSurat || 'Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.');
    setLokasiSurat(config.lokasiSurat || 'Jatimulya');
    setNamaKetuaRT(config.namaKetuaRT || 'Yanto');
    setNamaKetuaRW(config.namaKetuaRW || 'Imron Rosadi');
    setFontFamily(config.suratFontFamily || 'Arial');
    setBodyFontSizePt(config.suratBodyFontSizePt || 10);
    setKopFontSizePt(config.suratKopFontSizePt || 12);
    setTitleFontSizePt(config.suratTitleFontSizePt || 12);
    setLineHeight(config.suratLineHeight || 1.35);
    setRowSpacingPt(config.suratRowSpacingPt ?? 2);
    setSectionSpacingPt(config.suratSectionSpacingPt || 12);
    setSignatureSpacePt(config.suratSignatureSpacePt || 60);
  }, [config]);

  const documentFontFamily = fontFamily === 'Times New Roman'
    ? '"Times New Roman", Times, serif'
    : fontFamily === 'Georgia'
      ? 'Georgia, "Times New Roman", serif'
      : fontFamily === 'Calibri'
        ? 'Calibri, "Segoe UI", Arial, sans-serif'
        : 'Arial, Helvetica, sans-serif';

  // --- PEMOHON & AUTO-FILL DATA ---
  const [searchWargaQuery, setSearchWargaQuery] = useState('');
  const [selectedWargaId, setSelectedWargaId] = useState<string>(wargaList[0]?.id || '');

  // Form Fields for Active Letter
  const [namaPemohon, setNamaPemohon] = useState('');
  const [tempatTglLahir, setTempatTglLahir] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState('Laki-Laki');
  const [statusKawin, setStatusKawin] = useState('');
  const [agama, setAgama] = useState('');
  const [nikPemohon, setNikPemohon] = useState('');
  const [pekerjaan, setPekerjaan] = useState('');
  const [telepon, setTelepon] = useState('-');
  const [alamatBaris1, setAlamatBaris1] = useState(config.alamatBaris1Default || 'Kp Jati RT 004 RW 007 Kelurahan Jatimulya');
  const [alamatBaris2, setAlamatBaris2] = useState(config.alamatBaris2Default || 'Kec. Tambun Selatan Kab. Bekasi');
  const [keperluan1, setKeperluan1] = useState('');
  const [keperluan2, setKeperluan2] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Preset Keperluan List
  const PRESET_KEPERLUAN = [
    {
      label: 'Akta Kematian',
      line1: 'Membuat Akta Kematian',
      line2: ''
    },
    {
      label: 'KTP & KK Baru',
      line1: 'Pengurusan Penerbitan KTP-el & Kartu Keluarga Baru',
      line2: 'Di Kantor Kecamatan Tambun Selatan'
    },
    {
      label: 'Keterangan Domisili',
      line1: 'Surat Keterangan Domisili Tempat Tinggal Warga RT 004',
      line2: 'Kelengkapan Berkas Administrasi'
    },
    {
      label: 'SKTM / Bantuan',
      line1: 'Surat Keterangan Tidak Mampu (SKTM)',
      line2: 'Permohonan Keringanan Biaya Sekolah / Pendidikan'
    },
    {
      label: 'Keterangan Usaha (SKU)',
      line1: 'Surat Keterangan Usaha (SKU) Toko / Warung di Lingkungan RT 004',
      line2: 'Pengajuan Modal Usaha Perbankan'
    },
    {
      label: 'SKCK Kepolisian',
      line1: 'Pengantar Pembuatan Catatan Kepolisian (SKCK)',
      line2: 'Persyaratan Melamar Pekerjaan'
    },
    {
      label: 'Pengantar Nikah (N1-N4)',
      line1: 'Surat Keterangan Untuk Pendaftaran Pernikahan',
      line2: 'Di Kantor Urusan Agama (KUA)'
    }
  ];

  // Auto-Fill when Warga Selected
  const handleSelectWarga = (w: Warga) => {
    setSelectedWargaId(w.id);
    setNamaPemohon(w.nama || '');
    
    // Format TTL e.g. "Solo, 04-05-1962"
    const birthDate = w.tanggalLahir ? formatDateDDMMYYYY(w.tanggalLahir) : '01-01-1990';
    const birthPlace = w.tempatLahir ? (w.tempatLahir.charAt(0).toUpperCase() + w.tempatLahir.slice(1).toLowerCase()) : 'Bekasi';
    setTempatTglLahir(`${birthPlace}, ${birthDate}`);

    // Gender
    setJenisKelamin(w.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-Laki');

    // Status Perkawinan (Proper case)
    const rawStatus = (w.statusPerkawinan || 'BELUM KAWIN').toLowerCase();
    const formattedStatus = rawStatus.replace(/\b\w/g, c => c.toUpperCase());
    setStatusKawin(formattedStatus);

    // Agama (Proper case)
    const rawAgama = (w.agama || 'ISLAM').toLowerCase();
    setAgama(rawAgama.replace(/\b\w/g, c => c.toUpperCase()));

    // NIK & Job & Phone
    setNikPemohon(w.nik || '');
    const rawPekerjaan = (w.pekerjaan || 'Karyawan').toLowerCase();
    setPekerjaan(rawPekerjaan.replace(/\b\w/g, c => c.toUpperCase()));
    setTelepon(w.nomorHp || '-');

    // Address
    setAlamatBaris1(`Kp Jati RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} Kelurahan ${config.kelurahan || 'Jatimulya'}`);
    setAlamatBaris2(`Kec. ${config.kecamatan || 'Tambun Selatan'} Kab. ${config.kabupatenKota?.replace('Kabupaten ', '') || 'Bekasi'}`);

    showToast(`Data warga "${w.nama}" berhasil di-ambil otomatis!`);
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran file logo maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setLogoDataUrl(dataUrl);
        setLogoName(file.name);
        setUseDefaultLogo(false);
        showToast('Logo kustom berhasil dimuat.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetToWordSample = () => {
    setUseDefaultLogo(true);
    setLogoDataUrl('');
    setLogoWidthMm(24);
    setOffsetX(0);
    setOffsetY(0);

    setKopInstansiAtas('PEMERINTAH KABUPATEN BEKASI');
    setKopTeksRT('RT 004  RW 007');
    setKopKelurahan('KELURAHAN JATIMULYA');
    setKopKecamatan('KECAMATAN TAMBUN SELATAN');
    setKopSekretariatText('Sekretariat : jl jampang no 111  jatimulya tlp 0896-7720-3444');

    setJudulSurat('SURAT PENGANTAR');
    setNomorSurat('185 / RT 004 RW 007 / SP / 2026');
    setKalimatPembuka('Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :');
    setKalimatPenutup('Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.');

    setLokasiSurat('Jatimulya');
    setTanggalSurat('12-08-2026');
    setNamaKetuaRT('Yanto');
    setNamaKetuaRW('Imron Rosadi');
    setFontFamily('Arial');
    setBodyFontSizePt(10);
    setKopFontSizePt(12);
    setTitleFontSizePt(12);
    setLineHeight(1.35);
    setRowSpacingPt(2);
    setSectionSpacingPt(12);
    setSignatureSpacePt(60);

    // Data pemohon dikosongkan (bukan bagian dari format kop surat)
    setNamaPemohon('');
    setTempatTglLahir('');
    setJenisKelamin('Laki-Laki');
    setStatusKawin('');
    setAgama('');
    setNikPemohon('');
    setPekerjaan('');
    setTelepon('-');
    setAlamatBaris1('Kp Jati RT 004 RW 007 Kelurahan Jatimulya');
    setAlamatBaris2('Kec. Tambun Selatan Kab. Bekasi');
    setKeperluan1('');
    setKeperluan2('');

    showToast('Format berhasil direset sama persis sesuai contoh resmi Word!');
  };

  const handleSaveAllConfig = async () => {
    const updated: RTConfig = {
      ...config,
      kopLogoDataUrl: useDefaultLogo ? '' : logoDataUrl,
      kopLogoName: useDefaultLogo ? '' : logoName,
      kopLogoWidthMm: logoWidthMm,
      kopLogoOffsetXMm: offsetX,
      kopLogoOffsetYMm: offsetY,
      kopInstansiAtas,
      kopTeksRT,
      kopKelurahan,
      kopKecamatan,
      kopSekretariatText,
      judulSuratPengantar: judulSurat,
      formatNomorSurat: nomorSurat,
      kalimatPembukaSurat: kalimatPembuka,
      kalimatPenutupSurat: kalimatPenutup,
      lokasiSurat,
      namaKetuaRT,
      namaKetuaRW,
      alamatBaris1Default: alamatBaris1,
      alamatBaris2Default: alamatBaris2,
      suratFontFamily: fontFamily,
      suratBodyFontSizePt: bodyFontSizePt,
      suratKopFontSizePt: kopFontSizePt,
      suratTitleFontSizePt: titleFontSizePt,
      suratLineHeight: lineHeight,
      suratRowSpacingPt: rowSpacingPt,
      suratSectionSpacingPt: sectionSpacingPt,
      suratSignatureSpacePt: signatureSpacePt
    };

    const saved = await onSaveConfig(updated);
    if (saved) {
      showToast('Template dan logo kop berhasil disimpan untuk seluruh admin.');
    }
  };

  const handlePrint = () => {
    const docName = `Surat_Pengantar_${namaPemohon.replace(/\s+/g, '_')}_${nomorSurat.replace(/[^a-zA-Z0-9]/g, '_')}`;
    printOfficialLetter('official-letter-sheet', docName);
  };

  const handleDownloadWord = () => {
    const docFilename = `Surat_Pengantar_${(namaPemohon || 'Warga').replace(/\s+/g, '_')}.doc`;
    exportLetterToWord({
      kopInstansiAtas,
      kopTeksRT,
      kopKelurahan,
      kopKecamatan,
      kopSekretariatText,
      judulSurat,
      nomorSurat,
      kalimatPembuka,
      namaPemohon,
      tempatTglLahir,
      jenisKelamin,
      statusKawin,
      agama,
      nikPemohon,
      pekerjaan,
      telepon,
      alamatBaris1,
      alamatBaris2,
      keperluan1,
      keperluan2,
      kalimatPenutup,
      lokasiSurat,
      tanggalSurat,
      namaKetuaRT,
      namaKetuaRW,
      fontFamily,
      bodyFontSizePt,
      kopFontSizePt,
      titleFontSizePt,
      lineHeight,
      rowSpacingPt,
      sectionSpacingPt,
      signatureSpacePt
    }, docFilename);
    showToast(`Dokumen Word (${docFilename}) berhasil diunduh! Siap dicetak langsung.`);
  };

  const handleDownloadHtml = () => {
    const docFilename = `Surat_Pengantar_${(namaPemohon || 'Warga').replace(/\s+/g, '_')}.html`;
    downloadLetterHtml('official-letter-sheet', docFilename);
    showToast(`File cetak A4 (${docFilename}) berhasil diunduh!`);
  };

  const handleCopyText = () => {
    const text = `${kopInstansiAtas}
${kopTeksRT}
${kopKelurahan}
${kopKecamatan}
${kopSekretariatText}
-----------------------------------------------------------------
${judulSurat}
NO : ${nomorSurat}

${kalimatPembuka}

Nama              : ${namaPemohon}
Tempat Tgl Lahir  : ${tempatTglLahir}
Jenis Kelamin     : ${jenisKelamin}
Status Perkawinan : ${statusKawin}
Agama             : ${agama}
No Ktp / No Nik   : ${nikPemohon}
Pekerjaan         : ${pekerjaan}
Telepon / Hp      : ${telepon}
Alamat Lengkap    : ${alamatBaris1}
                  : ${alamatBaris2}
Keperluan         : ${keperluan1}
                  : ${keperluan2}

${kalimatPenutup}

${lokasiSurat} ${tanggalSurat}                        Mengetahui
Ketua Rt 004 Rw 007                                Ketua Rw 007



${namaKetuaRT}                                     ${namaKetuaRW}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    showToast('Teks surat berhasil disalin ke clipboard.');
  };

  const handleSaveToArsipSurat = async () => {
    const newSurat: Partial<SuratPengantar> = {
      id: `sp-${Date.now()}`,
      nomorSurat: nomorSurat,
      jenisSurat: 'LAINNYA',
      judulSurat: judulSurat,
      namaPemohon: namaPemohon,
      nikPemohon: nikPemohon,
      tempatTglLahirPemohon: tempatTglLahir,
      jenisKelaminPemohon: jenisKelamin === 'Perempuan' ? 'P' : 'L',
      statusKawinPemohon: statusKawin,
      agamaPemohon: agama,
      pekerjaanPemohon: pekerjaan,
      teleponPemohon: telepon,
      alamatBaris1: alamatBaris1,
      alamatBaris2: alamatBaris2,
      alamatPemohon: `${alamatBaris1}, ${alamatBaris2}`,
      keperluan: keperluan1,
      keperluanBaris1: keperluan1,
      keperluanBaris2: keperluan2,
      keteranganLain: keperluan2,
      tanggalPengajuan: new Date().toISOString().split('T')[0],
      tanggalDisetujui: new Date().toISOString().split('T')[0],
      status: 'DISETUJUI',
      namaKetuaRT: namaKetuaRT,
      namaKetuaRW: namaKetuaRW,
      dibuatOleh: 'ADMIN'
    };

    if (onAddSurat) {
      await onAddSurat(newSurat);
    } else {
      storageService.addSurat(newSurat);
    }
    showToast(`Surat Pengantar no ${nomorSurat} untuk "${namaPemohon}" berhasil disimpan ke Arsip Surat!`);
  };

  // Filtered warga list for dropdown
  const filteredWarga = wargaList.filter(w => 
    w.nama.toLowerCase().includes(searchWargaQuery.toLowerCase()) ||
    w.nik.includes(searchWargaQuery)
  );

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="no-print fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-4 py-2.5 rounded-xl shadow-xl bg-slate-900 text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Top Header */}
      <div className="no-print bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Template Surat Pengantar
              </h1>
              <p className="text-xs text-slate-500">
                Atur kop surat, logo header, format kalimat resmi, serta ambil data warga otomatis (auto-fill).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetToWordSample}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            title="Reset ke format bawaan Word"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Word</span>
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
          </button>

          <button
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer shadow-2xs"
            title="Unduh file dokumen yang bisa dibuka dan langsung dicetak di Microsoft Word"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Unduh Word (.doc)</span>
          </button>

          <button
            onClick={handleSaveAllConfig}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Template</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen (A4)</span>
          </button>
        </div>
      </div>

      {/* Workspace: Control Panel (Left) + Document Sheet Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: CONTROL & SETTINGS PANELS (5 Cols)          */}
        {/* ========================================================= */}
        <div className="no-print xl:col-span-5 space-y-4">
          
          {/* Sub Navigation Tabs */}
          <div className="bg-white p-1.5 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs">
            <button
              onClick={() => setActiveTab('AUTO_FILL')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'AUTO_FILL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Auto-Fill Warga</span>
            </button>

            <button
              onClick={() => setActiveTab('KOP_HEADER')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'KOP_HEADER'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Kop & Logo Header</span>
            </button>

            <button
              onClick={() => setActiveTab('ISI_SURAT')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ISI_SURAT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Format & TTD</span>
            </button>

            <button
              onClick={() => setActiveTab('TIPOGRAFI')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'TIPOGRAFI'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Tipografi</span>
            </button>
          </div>

          {/* TAB 1: AUTO-FILL DARI DATA WARGA */}
          {activeTab === 'AUTO_FILL' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Ambil Data Warga Otomatis</h3>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  {wargaList.length} Warga Terdaftar
                </span>
              </div>

              {/* Selector Warga Search */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Pilih Warga Pemohon:
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ketik nama atau NIK warga..."
                    value={searchWargaQuery}
                    onChange={(e) => setSearchWargaQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-emerald-500 transition"
                  />
                </div>

                {/* Dropdown list */}
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-inner">
                  {filteredWarga.slice(0, 15).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectWarga(w)}
                      className={`w-full p-2.5 text-left text-xs transition flex items-center justify-between cursor-pointer ${
                        selectedWargaId === w.id ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{w.nama}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          NIK: {w.nik} &bull; {w.statusHubunganKK || 'Warga'} &bull; {w.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-Laki'}
                        </div>
                      </div>
                      {selectedWargaId === w.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  ))}
                  {filteredWarga.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Warga tidak ditemukan.
                    </div>
                  )}
                </div>
              </div>

              {/* Preset Keperluan Chips */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Preset Keperluan Cepat (1-Klik):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_KEPERLUAN.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setKeperluan1(item.line1);
                        setKeperluan2(item.line2);
                        showToast(`Keperluan diubah ke: ${item.label}`);
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 transition cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Citizen Form fields */}
              <div className="space-y-2.5 pt-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <span>Isian Data Pemohon (Bisa Diedit Langsung)</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Nama Pemohon:</label>
                    <input
                      type="text"
                      value={namaPemohon}
                      onChange={(e) => setNamaPemohon(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Tempat Tgl Lahir:</label>
                    <input
                      type="text"
                      value={tempatTglLahir}
                      onChange={(e) => setTempatTglLahir(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Jenis Kelamin:</label>
                    <input
                      type="text"
                      value={jenisKelamin}
                      onChange={(e) => setJenisKelamin(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Status Perkawinan:</label>
                    <input
                      type="text"
                      value={statusKawin}
                      onChange={(e) => setStatusKawin(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Agama:</label>
                    <input
                      type="text"
                      value={agama}
                      onChange={(e) => setAgama(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">No Ktp / No Nik:</label>
                    <input
                      type="text"
                      value={nikPemohon}
                      onChange={(e) => setNikPemohon(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Pekerjaan:</label>
                    <input
                      type="text"
                      value={pekerjaan}
                      onChange={(e) => setPekerjaan(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Telepon / HP:</label>
                    <input
                      type="text"
                      value={telepon}
                      onChange={(e) => setTelepon(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Alamat Lengkap (Baris 1):</label>
                    <input
                      type="text"
                      value={alamatBaris1}
                      onChange={(e) => setAlamatBaris1(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Alamat Lengkap (Baris 2):</label>
                    <input
                      type="text"
                      value={alamatBaris2}
                      onChange={(e) => setAlamatBaris2(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Keperluan (Baris 1):</label>
                    <input
                      type="text"
                      value={keperluan1}
                      onChange={(e) => setKeperluan1(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Keperluan (Baris 2 / Tambahan):</label>
                    <input
                      type="text"
                      value={keperluan2}
                      onChange={(e) => setKeperluan2(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveToArsipSurat}
                    className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer transition shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Simpan ke Arsip Surat Pengantar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KOP SURAT & LOGO HEADER */}
          {activeTab === 'KOP_HEADER' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Logo Header & Teks Kop Surat</h3>
                </div>
              </div>

              {/* Logo Selection */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-800">
                  Pilihan Logo Kop Surat:
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseDefaultLogo(true);
                      showToast('Menggunakan Lambang Resmi Kabupaten Bekasi.');
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      useDefaultLogo 
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' 
                        : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-10 flex items-center justify-center shrink-0">
                      <LambangBekasiLogo size="sm" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Resmi Bekasi</div>
                      <div className="text-[10px] text-slate-500">Lambang Daerah</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUseDefaultLogo(false);
                      if (fileInputRef.current && !logoDataUrl) {
                        fileInputRef.current.click();
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                      !useDefaultLogo 
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' 
                        : 'bg-white border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Unggah Logo</div>
                      <div className="text-[10px] text-slate-500">PNG, JPG, SVG</div>
                    </div>
                  </button>
                </div>

                {/* Upload Input button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                {!useDefaultLogo && (
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
                    >
                      Pilih Berkas Gambar Baru...
                    </button>
                    {logoName && (
                      <span className="text-[11px] text-slate-500 font-mono truncate">
                        {logoName}
                      </span>
                    )}
                  </div>
                )}

                {/* Sliders for size & position */}
                <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                  <div>
                    <div className="flex justify-between text-slate-700 font-medium mb-1">
                      <span>Lebar Logo:</span>
                      <span className="font-mono font-bold">{logoWidthMm} mm</span>
                    </div>
                    <input
                      type="range"
                      min="14"
                      max="40"
                      value={logoWidthMm}
                      onChange={(e) => setLogoWidthMm(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-slate-700 font-medium mb-1">
                        <span>Geser X:</span>
                        <span className="font-mono">{offsetX} mm</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="20"
                        value={offsetX}
                        onChange={(e) => setOffsetX(Number(e.target.value))}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-700 font-medium mb-1">
                        <span>Geser Y:</span>
                        <span className="font-mono">{offsetY} mm</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="20"
                        value={offsetY}
                        onChange={(e) => setOffsetY(Number(e.target.value))}
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Teks Baris Kop Header */}
              <div className="space-y-2.5 text-xs">
                <label className="block text-xs font-bold text-slate-800">
                  Teks Header Kop Surat (Sesuai Format Word):
                </label>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Baris 1 (Instansi / Kabupaten):</label>
                  <input
                    type="text"
                    value={kopInstansiAtas}
                    onChange={(e) => setKopInstansiAtas(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Baris 2 (RT & RW):</label>
                  <input
                    type="text"
                    value={kopTeksRT}
                    onChange={(e) => setKopTeksRT(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Baris 3 (Kelurahan):</label>
                  <input
                    type="text"
                    value={kopKelurahan}
                    onChange={(e) => setKopKelurahan(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Baris 4 (Kecamatan):</label>
                  <input
                    type="text"
                    value={kopKecamatan}
                    onChange={(e) => setKopKecamatan(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Baris 5 (Sekretariat & Kontak):</label>
                  <input
                    type="text"
                    value={kopSekretariatText}
                    onChange={(e) => setKopSekretariatText(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FORMAT KALIMAT, PENOMORAN & TANDA TANGAN */}
          {activeTab === 'ISI_SURAT' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Format Judul, Kalimat & Tanda Tangan</h3>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Judul Surat (Tengah):</label>
                  <input
                    type="text"
                    value={judulSurat}
                    onChange={(e) => setJudulSurat(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Format Nomor Surat:</label>
                  <input
                    type="text"
                    value={nomorSurat}
                    onChange={(e) => setNomorSurat(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Kalimat Pembuka:</label>
                  <textarea
                    rows={2}
                    value={kalimatPembuka}
                    onChange={(e) => setKalimatPembuka(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Kalimat Penutup:</label>
                  <textarea
                    rows={2}
                    value={kalimatPenutup}
                    onChange={(e) => setKalimatPenutup(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Penandatangan Surat (Kiri & Kanan):
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Lokasi Tanggal:</label>
                      <input
                        type="text"
                        value={lokasiSurat}
                        onChange={(e) => setLokasiSurat(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Tanggal Dokumen:</label>
                      <input
                        type="text"
                        value={tanggalSurat}
                        onChange={(e) => setTanggalSurat(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Ketua RT (Kiri):</label>
                      <input
                        type="text"
                        value={namaKetuaRT}
                        onChange={(e) => setNamaKetuaRT(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Mengetahui RW (Kanan):</label>
                      <input
                        type="text"
                        value={namaKetuaRW}
                        onChange={(e) => setNamaKetuaRW(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TIPOGRAFI' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Type className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Ukuran Font & Jarak Dokumen</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Jenis Font</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as NonNullable<RTConfig['suratFontFamily']>)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Calibri">Calibri</option>
                    <option value="Georgia">Georgia</option>
                  </select>
                </div>

                {[
                  ['Ukuran teks isi', bodyFontSizePt, setBodyFontSizePt, 8, 14, 0.5, 'pt'],
                  ['Ukuran teks kop', kopFontSizePt, setKopFontSizePt, 10, 18, 0.5, 'pt'],
                  ['Ukuran judul surat', titleFontSizePt, setTitleFontSizePt, 10, 18, 0.5, 'pt'],
                  ['Spasi baris', lineHeight, setLineHeight, 1, 2, 0.05, 'x'],
                  ['Jarak antar baris data', rowSpacingPt, setRowSpacingPt, 0, 8, 0.5, 'pt'],
                  ['Jarak antar bagian', sectionSpacingPt, setSectionSpacingPt, 4, 30, 1, 'pt'],
                  ['Ruang tanda tangan', signatureSpacePt, setSignatureSpacePt, 30, 110, 5, 'pt']
                ].map(([label, value, setter, min, max, step, unit]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-slate-700 font-medium mb-1">
                      <span>{label as string}</span>
                      <span className="font-mono font-bold">{Number(value)} {unit as string}</span>
                    </div>
                    <input
                      type="range"
                      min={Number(min)}
                      max={Number(max)}
                      step={Number(step)}
                      value={Number(value)}
                      onChange={(e) => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setFontFamily('Arial');
                    setBodyFontSizePt(10);
                    setKopFontSizePt(12);
                    setTitleFontSizePt(12);
                    setLineHeight(1.35);
                    setRowSpacingPt(2);
                    setSectionSpacingPt(12);
                    setSignatureSpacePt(60);
                  }}
                  className="w-full py-2 border border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-lg font-semibold text-slate-700 transition"
                >
                  Reset Pengaturan Tipografi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: EXACT A4 / WORD FORMAT SHEET (7 Cols)       */}
        {/* ========================================================= */}
        <div className="xl:col-span-7 flex flex-col items-center">
          
          {/* Header toolbar for sheet */}
          <div className="no-print w-full flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-bold text-slate-700">
                Pratinjau Lembar Surat Pengantar (Format Word Standar A4)
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-sans text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {fontFamily} &bull; {bodyFontSizePt} pt &bull; {lineHeight}x
              </span>
              <button
                type="button"
                onClick={handleDownloadWord}
                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                title="Unduh format Microsoft Word (.doc) yang bisa dibuka & dicetak langsung di Word"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Unduh Word (.doc)</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                title="Langsung cetak dokumen ini di tab baru / dialog cetak A4"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Langsung (A4)</span>
              </button>
            </div>
          </div>

          {/* Sheet Canvas Container */}
          <div className="w-full bg-slate-200/90 p-2 sm:p-5 rounded-2xl flex justify-center overflow-x-auto shadow-inner">
            
            {/* The Print Sheet Element */}
            <div 
              id="official-letter-sheet"
              className="print-container bg-white text-black font-sans p-[1.4cm] sm:p-[1.8cm] max-w-[21cm] w-full min-h-[29.7cm] shadow-2xl border border-slate-300 leading-normal print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:m-0"
              style={{
                fontFamily: documentFontFamily,
                fontSize: `${bodyFontSizePt}pt`,
                lineHeight,
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            >
              {/* KOP SURAT RESMI - 3 COLUMN BALANCED CENTER (ZERO TILT) */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b-2 border-black" style={{ marginBottom: `${sectionSpacingPt}pt` }}>
                {/* Left: Logo */}
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: `${logoWidthMm}mm`,
                    minWidth: `${logoWidthMm}mm`,
                    height: `${logoWidthMm * 1.18}mm`,
                    marginLeft: `${offsetX}mm`,
                    marginTop: `${offsetY}mm`
                  }}
                >
                  {useDefaultLogo ? (
                    <LambangBekasiLogo className="w-full h-full object-contain" />
                  ) : logoDataUrl ? (
                    <img
                      src={logoDataUrl}
                      alt="Logo Kop Surat"
                      className="max-w-full max-h-full object-contain"
                      style={{ display: 'block' }}
                    />
                  ) : (
                    <LambangBekasiLogo className="w-full h-full object-contain" />
                  )}
                </div>

                {/* Center: Header Text Center (100% Mathematically Centered) */}
                <div className="flex-1 text-center px-1">
                  <h1 className="font-bold tracking-wide text-black leading-tight uppercase" style={{ fontSize: `${kopFontSizePt}pt` }}>
                    {kopInstansiAtas}
                  </h1>
                  <h2 className="font-bold tracking-wide text-black leading-tight uppercase mt-0.5" style={{ fontSize: `${kopFontSizePt + 1}pt` }}>
                    {kopTeksRT}
                  </h2>
                  <h2 className="font-bold tracking-wide text-black leading-tight uppercase mt-0.5" style={{ fontSize: `${Math.max(8, kopFontSizePt - 1)}pt` }}>
                    {kopKelurahan}
                  </h2>
                  <h2 className="font-bold tracking-wide text-black leading-tight uppercase mt-0.5" style={{ fontSize: `${Math.max(8, kopFontSizePt - 1)}pt` }}>
                    {kopKecamatan}
                  </h2>
                  <p className="text-black mt-1 font-normal leading-tight" style={{ fontSize: `${Math.max(7, kopFontSizePt - 3)}pt` }}>
                    {kopSekretariatText}
                  </p>
                </div>

                {/* Right: Dummy Balancer (Exact same width to keep header 100% centered without tilting) */}
                <div 
                  className="shrink-0"
                  style={{
                    width: `${logoWidthMm}mm`,
                    minWidth: `${logoWidthMm}mm`
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* JUDUL DAN NOMOR SURAT */}
              <div className="text-center" style={{ marginBottom: `${sectionSpacingPt}pt` }}>
                <h3 className="font-bold underline uppercase tracking-wide text-black leading-tight" style={{ fontSize: `${titleFontSizePt}pt` }}>
                  {judulSurat}
                </h3>
                <p className="font-bold text-black mt-1 tracking-wider" style={{ fontSize: `${bodyFontSizePt}pt` }}>
                  NO : {nomorSurat}
                </p>
              </div>

              {/* KALIMAT PEMBUKA */}
              <div className="text-black text-justify" style={{ fontSize: `${bodyFontSizePt}pt`, lineHeight, marginBottom: `${sectionSpacingPt}pt` }}>
                <p>{kalimatPembuka}</p>
              </div>

              {/* TABEL DATA PEMOHON (LASER ALIGNED COLONS & ROWS) */}
              <div className="text-black" style={{ display: 'flex', flexDirection: 'column', gap: `${rowSpacingPt}pt`, fontSize: `${bodyFontSizePt}pt`, lineHeight, marginBottom: `${sectionSpacingPt}pt` }}>
                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Nama</span>
                  <span className="text-center">:</span>
                  <span className="font-semibold text-black">{namaPemohon}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Tempat Tgl Lahir</span>
                  <span className="text-center">:</span>
                  <span>{tempatTglLahir}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Jenis Kelamin</span>
                  <span className="text-center">:</span>
                  <span>{jenisKelamin}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Status Perkawinan</span>
                  <span className="text-center">:</span>
                  <span>{statusKawin}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Agama</span>
                  <span className="text-center">:</span>
                  <span>{agama}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>No Ktp / No Nik</span>
                  <span className="text-center">:</span>
                  <span className="tracking-wide font-mono">{nikPemohon}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Pekerjaan</span>
                  <span className="text-center">:</span>
                  <span>{pekerjaan}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Telepon / Hp</span>
                  <span className="text-center">:</span>
                  <span>{telepon || '-'}</span>
                </div>

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Alamat Lengkap</span>
                  <span className="text-center">:</span>
                  <span>{alamatBaris1}</span>
                </div>
                {alamatBaris2 && (
                  <div className="grid grid-cols-[145px_14px_1fr] items-start">
                    <span></span>
                    <span className="text-center">:</span>
                    <span>{alamatBaris2}</span>
                  </div>
                )}

                <div className="grid grid-cols-[145px_14px_1fr] items-start">
                  <span>Keperluan</span>
                  <span className="text-center">:</span>
                  <span>{keperluan1}</span>
                </div>
                {keperluan2 && (
                  <div className="grid grid-cols-[145px_14px_1fr] items-start">
                    <span></span>
                    <span className="text-center">:</span>
                    <span>{keperluan2}</span>
                  </div>
                )}
              </div>

              {/* KALIMAT PENUTUP */}
              <div className="text-black text-justify" style={{ fontSize: `${bodyFontSizePt}pt`, lineHeight, marginBottom: `${sectionSpacingPt}pt` }}>
                <p>{kalimatPenutup}</p>
              </div>

              {/* TANDA TANGAN (2 KOLOM BALANCED) */}
              <div className="grid grid-cols-2 text-black pt-2" style={{ fontSize: `${bodyFontSizePt}pt`, lineHeight }}>
                {/* Kolom Kiri: Ketua RT */}
                <div className="text-center px-4">
                  <div>{lokasiSurat} {tanggalSurat}</div>
                  <div className="font-semibold">Ketua Rt 004 Rw 007</div>
                  <div style={{ height: `${signatureSpacePt}pt` }}></div>
                  <div className="font-bold underline text-black uppercase">{namaKetuaRT}</div>
                </div>

                {/* Kolom Kanan: Mengetahui Ketua RW */}
                <div className="text-center px-4">
                  <div>Mengetahui</div>
                  <div className="font-semibold">Ketua Rw 007</div>
                  <div style={{ height: `${signatureSpacePt}pt` }}></div>
                  <div className="font-bold underline text-black uppercase">{namaKetuaRW}</div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
