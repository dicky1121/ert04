import React, { useState } from 'react';
import { Printer, ShieldCheck, Copy, Check, CreditCard as Edit3, RotateCcw, FileText, CircleCheck as CheckCircle2, Type, Sparkles, FileDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SuratPengantar, RTConfig } from '../types';
import { LambangBekasiLogo } from './BekasiLogo';
import { printOfficialLetter, exportLetterToWord } from '../utils/printDocument';

interface SuratPrintTemplateProps {
  surat: SuratPengantar;
  config: RTConfig;
  onClose?: () => void;
  onUpdateSurat?: (updated: SuratPengantar) => void;
}

export const SuratPrintTemplate: React.FC<SuratPrintTemplateProps> = ({ 
  surat, 
  config, 
  onClose,
  onUpdateSurat
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields to allow instantaneous direct tweaks
  const [nomorSurat, setNomorSurat] = useState(surat.nomorSurat || '185 / RT 004 RW 007 / SP / 2026');
  const [namaPemohon, setNamaPemohon] = useState(surat.namaPemohon || '');
  const [tempatTglLahir, setTempatTglLahir] = useState(surat.tempatTglLahirPemohon || '');
  const [jenisKelamin, setJenisKelamin] = useState(
    surat.jenisKelaminPemohon === 'P' || surat.jenisKelaminPemohon === ('Perempuan' as any) ? 'Perempuan' : 'Laki-Laki'
  );
  const [statusKawin, setStatusKawin] = useState(surat.statusKawinPemohon || 'Cerai Mati');
  const [agama, setAgama] = useState(surat.agamaPemohon || 'Islam');
  const [nikPemohon, setNikPemohon] = useState(surat.nikPemohon || '');
  const [pekerjaan, setPekerjaan] = useState(surat.pekerjaanPemohon || 'Mengurus Rumah Tangga');
  const [telepon, setTelepon] = useState(surat.teleponPemohon || '-');

  // Alamat 2 Baris
  const defaultAlamatBaris1 = surat.alamatBaris1 || 'Kp Jati RT 004 RW 007 Kelurahan Jatimulya';
  const defaultAlamatBaris2 = surat.alamatBaris2 || 'Kec. Tambun Selatan Kab. Bekasi';
  const [alamatBaris1, setAlamatBaris1] = useState(defaultAlamatBaris1);
  const [alamatBaris2, setAlamatBaris2] = useState(defaultAlamatBaris2);

  // Keperluan 2 Baris
  const defaultKeperluan1 = surat.keperluanBaris1 || surat.keperluan || 'Membuat Akte Kematian HERI PURNOMO';
  const defaultKeperluan2 = surat.keperluanBaris2 || surat.keteranganLain || '04 Nopember 2017';
  const [keperluan1, setKeperluan1] = useState(defaultKeperluan1);
  const [keperluan2, setKeperluan2] = useState(defaultKeperluan2);

  // Signatures: Ketua RT 004 & Ketua RW 007
  const [namaKetuaRT, setNamaKetuaRT] = useState(surat.namaKetuaRT || config.namaKetuaRT || 'Yanto');
  const [namaKetuaRW, setNamaKetuaRW] = useState(surat.namaKetuaRW || config.namaKetuaRW || 'Imron Rosadi');

  // Date format DD-MM-YYYY (e.g. 12-08-2026)
  const getTodayDmy = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };
  const [tanggalSurat, setTanggalSurat] = useState(getTodayDmy());

  const handlePrint = () => {
    const docName = `Surat_Pengantar_${namaPemohon.replace(/\s+/g, '_')}_${nomorSurat.replace(/[^a-zA-Z0-9]/g, '_')}`;
    printOfficialLetter('official-letter-sheet', docName);
  };

  const handleDownloadWord = () => {
    const docFilename = `Surat_Pengantar_${(namaPemohon || 'Warga').replace(/\s+/g, '_')}.doc`;
    exportLetterToWord({
      kopInstansiAtas: config.kopInstansiAtas,
      kopTeksRT: config.kopTeksRT,
      kopKelurahan: config.kopKelurahan,
      kopKecamatan: config.kopKecamatan,
      kopSekretariatText: config.kopSekretariatText,
      judulSurat: 'SURAT PENGANTAR',
      nomorSurat,
      kalimatPembuka: config.kalimatPembukaSurat,
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
      kalimatPenutup: config.kalimatPenutupSurat,
      lokasiSurat: config.lokasiSurat || 'Jatimulya',
      tanggalSurat,
      namaKetuaRT,
      namaKetuaRW,
      fontFamily: config.suratFontFamily,
      bodyFontSizePt: config.suratBodyFontSizePt,
      kopFontSizePt: config.suratKopFontSizePt,
      titleFontSizePt: config.suratTitleFontSizePt,
      lineHeight: config.suratLineHeight,
      rowSpacingPt: config.suratRowSpacingPt,
      sectionSpacingPt: config.suratSectionSpacingPt,
      signatureSpacePt: config.suratSignatureSpacePt
    }, docFilename);
  };

  const handleSaveEdits = () => {
    if (onUpdateSurat) {
      onUpdateSurat({
        ...surat,
        nomorSurat,
        namaPemohon,
        tempatTglLahirPemohon: tempatTglLahir,
        jenisKelaminPemohon: jenisKelamin === 'Perempuan' ? 'P' : 'L',
        statusKawinPemohon: statusKawin,
        agamaPemohon: agama,
        nikPemohon,
        pekerjaanPemohon: pekerjaan,
        teleponPemohon: telepon,
        alamatBaris1,
        alamatBaris2,
        alamatPemohon: `${alamatBaris1}, ${alamatBaris2}`,
        keperluan: keperluan1,
        keperluanBaris1: keperluan1,
        keperluanBaris2: keperluan2,
        keteranganLain: keperluan2,
        namaKetuaRT,
        namaKetuaRW
      });
    }
    setIsEditing(false);
  };

  const handleCopyText = () => {
    const text = `${config.kopInstansiAtas || 'PEMERINTAH KABUPATEN BEKASI'}
${config.kopTeksRT || 'RT 004  RW 007'}
${config.kopKelurahan || 'KELURAHAN JATIMULYA'}
${config.kopKecamatan || 'KECAMATAN TAMBUN SELATAN'}
${config.kopSekretariatText || 'Sekretariat : jl jampang no 111  jatimulya tlp 0896-7720-3444'}
-----------------------------------------------------------------
SURAT PENGANTAR
NO : ${nomorSurat}

${config.kalimatPembukaSurat || 'Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :'}

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

${config.kalimatPenutupSurat || 'Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.'}

${config.lokasiSurat || 'Jatimulya'} ${tanggalSurat}                        Mengetahui
Ketua Rt 004 Rw 007                                Ketua Rw 007



${namaKetuaRT}                                     ${namaKetuaRW}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const fontFamily = config.suratFontFamily || 'Arial';
  const selectedFontFamily = fontFamily === 'Times New Roman'
    ? '"Times New Roman", Times, serif'
    : fontFamily === 'Georgia'
      ? 'Georgia, "Times New Roman", serif'
      : fontFamily === 'Calibri'
        ? 'Calibri, "Segoe UI", Arial, sans-serif'
        : 'Arial, Helvetica, sans-serif';
  const bodyFontSizePt = config.suratBodyFontSizePt || 10;
  const kopFontSizePt = config.suratKopFontSizePt || 12;
  const titleFontSizePt = config.suratTitleFontSizePt || 12;
  const lineHeight = config.suratLineHeight || 1.35;
  const rowSpacingPt = config.suratRowSpacingPt ?? 2;
  const sectionSpacingPt = config.suratSectionSpacingPt || 12;
  const signatureSpacePt = config.suratSignatureSpacePt || 60;

  return (
    <div className="space-y-4">
      {/* Top Toolbar (Hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white p-3.5 sm:p-4 rounded-xl shadow-lg border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-1 rounded-lg border border-white/20 w-9 h-9 flex items-center justify-center">
            {config.kopLogoDataUrl ? (
              <img src={config.kopLogoDataUrl} alt="Logo Kop" className="max-w-full max-h-full object-contain" />
            ) : (
              <LambangBekasiLogo size="sm" />
            )}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>Surat Pengantar RT 004 RW 007</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded border border-emerald-400/30">
                {fontFamily} &bull; {bodyFontSizePt} pt
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Ketua RT: <strong className="text-slate-200">{namaKetuaRT}</strong> &bull; Ketua RW: <strong className="text-slate-200">{namaKetuaRW}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
              isEditing 
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Selesai Edit' : 'Edit Isi'}</span>
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
          </button>

          <button
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg border border-blue-600 shadow-2xs transition cursor-pointer"
            title="Unduh format Microsoft Word (.doc) yang bisa dibuka & dicetak langsung"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Unduh Word (.doc)</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen (A4)</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
            >
              Tutup
            </button>
          )}
        </div>
      </div>

      {/* Edit Panel Drawer (If isEditing is Active) */}
      {isEditing && (
        <div className="no-print bg-amber-50/90 border border-amber-300 p-4 rounded-xl text-xs space-y-3.5 shadow-2xs">
          <div className="font-bold text-amber-900 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-700" />
              Sesuaikan Isian Dokumen Surat Pengantar Langsung:
            </span>
            <button 
              onClick={handleSaveEdits}
              className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold cursor-pointer transition shadow-2xs"
            >
              Simpan Perubahan
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nomor Surat:</label>
              <input
                type="text"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nama Pemohon:</label>
              <input
                type="text"
                value={namaPemohon}
                onChange={(e) => setNamaPemohon(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tempat Tgl Lahir:</label>
              <input
                type="text"
                value={tempatTglLahir}
                onChange={(e) => setTempatTglLahir(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Jenis Kelamin:</label>
              <select
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Perempuan">Perempuan</option>
                <option value="Laki-Laki">Laki-Laki</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Status Perkawinan:</label>
              <input
                type="text"
                value={statusKawin}
                onChange={(e) => setStatusKawin(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Agama:</label>
              <input
                type="text"
                value={agama}
                onChange={(e) => setAgama(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">No Ktp / No Nik:</label>
              <input
                type="text"
                value={nikPemohon}
                onChange={(e) => setNikPemohon(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Pekerjaan:</label>
              <input
                type="text"
                value={pekerjaan}
                onChange={(e) => setPekerjaan(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Telepon / HP:</label>
              <input
                type="text"
                value={telepon}
                onChange={(e) => setTelepon(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
              />
            </div>
            <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-amber-200">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Alamat Lengkap (Baris 1):</label>
                <input
                  type="text"
                  value={alamatBaris1}
                  onChange={(e) => setAlamatBaris1(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Alamat Lengkap (Baris 2):</label>
                <input
                  type="text"
                  value={alamatBaris2}
                  onChange={(e) => setAlamatBaris2(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                />
              </div>
            </div>
            <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white p-2.5 rounded-lg border border-amber-200">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Keperluan (Baris 1):</label>
                <input
                  type="text"
                  value={keperluan1}
                  onChange={(e) => setKeperluan1(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Keperluan (Baris 2 / Tanggal):</label>
                <input
                  type="text"
                  value={keperluan2}
                  onChange={(e) => setKeperluan2(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tanggal Surat (DD-MM-YYYY):</label>
              <input
                type="text"
                value={tanggalSurat}
                onChange={(e) => setTanggalSurat(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nama Ketua RT (Kiri):</label>
              <input
                type="text"
                value={namaKetuaRT}
                onChange={(e) => setNamaKetuaRT(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nama Ketua RW (Kanan):</label>
              <input
                type="text"
                value={namaKetuaRW}
                onChange={(e) => setNamaKetuaRW(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EXACT OFFICIAL PRINTABLE SHEET (WORD / A4 DIMENSIONS)    */}
      {/* ======================================================== */}
      <div className="bg-slate-200/80 p-2 sm:p-6 rounded-3xl flex justify-center overflow-x-auto shadow-inner">
        <div 
          id="official-letter-sheet"
          className="print-container bg-white text-black p-[1.4cm] sm:p-[1.8cm] max-w-[21cm] w-full min-h-[29.7cm] mx-auto shadow-2xl border border-slate-300 leading-normal print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:m-0"
          style={{
            fontFamily: selectedFontFamily,
            fontSize: `${bodyFontSizePt}pt`,
            lineHeight,
            color: '#000000',
            backgroundColor: '#ffffff'
          }}
        >
          {/* KOP SURAT RESMI - 3 COLUMN BALANCED CENTER (ZERO TILT) */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b-2 border-black" style={{ marginBottom: `${sectionSpacingPt}pt` }}>
            {/* Logo Left */}
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: `${config.kopLogoWidthMm || 22}mm`,
                minWidth: `${config.kopLogoWidthMm || 22}mm`,
                height: `${(config.kopLogoWidthMm || 22) * 1.18}mm`,
                marginLeft: `${config.kopLogoOffsetXMm || 0}mm`,
                marginTop: `${config.kopLogoOffsetYMm || 0}mm`
              }}
            >
              {config.kopLogoDataUrl ? (
                <img
                  src={config.kopLogoDataUrl}
                  alt="Logo Kop Surat"
                  className="max-w-full max-h-full object-contain"
                  style={{ display: 'block' }}
                />
              ) : (
                <LambangBekasiLogo className="w-full h-full object-contain" />
              )}
            </div>

            {/* Header Text Center (100% Mathematically Centered) */}
            <div className="flex-1 text-center px-1">
              <h1 className="font-bold tracking-wide text-black leading-tight uppercase" style={{ fontSize: `${kopFontSizePt}pt` }}>
                {config.kopInstansiAtas || 'PEMERINTAH KABUPATEN BEKASI'}
              </h1>
              <h2 className="font-bold tracking-wide text-black leading-tight uppercase mt-0.5" style={{ fontSize: `${kopFontSizePt + 1}pt` }}>
                {config.kopTeksRT || `RT ${config.namaRT || '004'}  RW ${config.namaRW || '007'}`}
              </h2>
              <h2 className="font-bold tracking-wide text-black leading-tight uppercase mt-0.5" style={{ fontSize: `${Math.max(8, kopFontSizePt - 1)}pt` }}>
                {config.kopKelurahan || `KELURAHAN ${config.kelurahan?.toUpperCase() || 'JATIMULYA'}`}
              </h2>
              <h2 className="font-bold tracking-wide text-black leading-tight uppercase mt-0.5" style={{ fontSize: `${Math.max(8, kopFontSizePt - 1)}pt` }}>
                {config.kopKecamatan || `KECAMATAN ${config.kecamatan?.toUpperCase() || 'TAMBUN SELATAN'}`}
              </h2>
              <p className="text-black mt-1 font-normal leading-tight" style={{ fontSize: `${Math.max(7, kopFontSizePt - 3)}pt` }}>
                {config.kopSekretariatText || config.alamatSekretariat || 'Sekretariat : jl jampang no 111  jatimulya tlp 0896-7720-3444'}
              </p>
            </div>

            {/* Right: Dummy Balancer (Exact same width to keep header 100% centered without tilting) */}
            <div 
              className="shrink-0"
              style={{
                width: `${config.kopLogoWidthMm || 22}mm`,
                minWidth: `${config.kopLogoWidthMm || 22}mm`
              }}
              aria-hidden="true"
            />
          </div>

          {/* JUDUL DAN NOMOR SURAT */}
          <div className="text-center" style={{ marginBottom: `${sectionSpacingPt}pt` }}>
            <h3 className="font-bold underline uppercase tracking-wide text-black leading-tight" style={{ fontSize: `${titleFontSizePt}pt` }}>
              {config.judulSuratPengantar || 'SURAT PENGANTAR'}
            </h3>
            <p className="font-bold text-black mt-1 tracking-wider" style={{ fontSize: `${bodyFontSizePt}pt` }}>
              NO : {nomorSurat}
            </p>
          </div>

          {/* KALIMAT PEMBUKA */}
          <div className="text-black text-justify" style={{ fontSize: `${bodyFontSizePt}pt`, lineHeight, marginBottom: `${sectionSpacingPt}pt` }}>
            <p>{config.kalimatPembukaSurat || 'Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :'}</p>
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
            <p>{config.kalimatPenutupSurat || 'Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.'}</p>
          </div>

          {/* TANDA TANGAN (2 KOLOM BALANCED) */}
          <div className="grid grid-cols-2 text-black pt-2" style={{ fontSize: `${bodyFontSizePt}pt`, lineHeight }}>
            {/* Kolom Kiri: Ketua RT */}
            <div className="text-center px-4">
              <div>{config.lokasiSurat || 'Jatimulya'} {tanggalSurat}</div>
              <div className="font-semibold">Ketua Rt 004 Rw 007</div>
              <div style={{ height: `${signatureSpacePt}pt` }}></div>
              <div className="font-bold underline text-black uppercase">{namaKetuaRT}</div>
            </div>

            {/* Kolom Kanan: Mengetahui Ketua RW + QR verifikasi di pojok kanan bawah */}
            <div className="text-center px-4 relative">
              <div>Mengetahui</div>
              <div className="font-semibold">Ketua Rw 007</div>
              <div style={{ height: `${signatureSpacePt}pt` }}></div>
              <div className="font-bold underline text-black uppercase">{namaKetuaRW}</div>

              {/* QR Code verifikasi keaslian surat */}
              {surat.kodeVerifikasiQr && (
                <div className="absolute bottom-0 right-0 flex flex-col items-center gap-0.5 print:block">
                  <QRCodeSVG
                    value={`${window.location.origin}?verifikasi=${encodeURIComponent(surat.kodeVerifikasiQr)}`}
                    size={60}
                    level="M"
                    includeMargin={false}
                    style={{ display: 'block' }}
                  />
                  <span style={{ fontSize: '6pt', color: '#6b7280', textAlign: 'center', display: 'block', lineHeight: '1.2' }}>
                    Scan untuk verifikasi
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
