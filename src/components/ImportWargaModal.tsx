import React, { useState, useEffect, useRef } from 'react';
import { 
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Check, 
  Layers, 
  UserCheck, 
  Building2, 
  HeartPulse, 
  Trash2, 
  ClipboardPaste, 
  ChevronDown, 
  ChevronUp, 
  Settings2, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { ImportAnalysisResult, DetectedSheetInfo, ImportPreviewRow, SheetColumnMapping } from '../types';
import { storageService, formatDateDDMMYYYY } from '../services/storage';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface ImportWargaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (result: { added: number; updated: number; skipped: number }) => void;
  onCommitImport?: (
    rows: ImportPreviewRow[],
    updateExisting: boolean,
    clearExistingBeforeImport: boolean
  ) => Promise<{ success: boolean; result?: { added: number; updated: number; skipped: number }; error?: string }>;
}

export const ImportWargaModal: React.FC<ImportWargaModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onCommitImport
}) => {
  // Main Tab: 'PENGONTRAK' (5-Column Copy-Paste) vs 'TETAP' (Excel File / Standard)
  const [activeImportTab, setActiveImportTab] = useState<'PENGONTRAK' | 'TETAP'>('PENGONTRAK');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ImportAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [clearExistingBeforeImport, setClearExistingBeforeImport] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'TETAP' | 'KONTRAK' | 'LANSIA' | 'BALITA' | 'NO_NIK' | 'EXISTING' | 'BERMASALAH'>('ALL');

  // Sheet configuration overrides
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [showColumnConfig, setShowColumnConfig] = useState<boolean>(false);
  const [customSheetConfigs, setCustomSheetConfigs] = useState<Record<string, {
    role?: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE';
    startRow?: number;
    columnMapping?: SheetColumnMapping;
  }>>({});

  // 5-Column Pengontrak Copy-Paste State
  const [pastedPengontrakText, setPastedPengontrakText] = useState('');
  
  // Warga Tetap Copy-Paste / Input State
  const [pastedTetapText, setPastedTetapText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose, isOpen);

  const samplePengontrak5Col = `NO\tNAMA LENGKAP\tNO NIK / KK\tTTL\tKETERANGAN
1\tWARGA CONTOH 01\t\tKota Contoh, 01-01-1990\tKONTRAKAN CONTOH A
2\tWARGA CONTOH 02\t\tKota Contoh, 02-02-1991\tKONTRAKAN CONTOH B
3\tWARGA CONTOH 03\t\tKota Contoh, 03-03-1992\tKOST CONTOH`;

  const sampleWargaTetapFormat = `NO KELUARGA\tNO KK\tNIK\tNAMA LENGKAP\tJK\tTANGGAL LAHIR\tNO HP\tNO RM\tALAMAT
1\t\t\tWARGA CONTOH 01\tP\t01-01-1990\t\t\tALAMAT CONTOH
1\t\t\tWARGA CONTOH 02\tL\t02-02-1991\t\t\tALAMAT CONTOH`;

  useEffect(() => {
    if (isOpen) {
      const isDummy = storageService.isDummyDataActive();
      setClearExistingBeforeImport(isDummy);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // `async` karena pustaka spreadsheet dimuat saat dipakai (dynamic import di
  // storage.ts). Semua kesalahan sudah ditangkap di dalam, jadi pemanggilnya
  // aman memakai `void` tanpa perlu ikut jadi async.
  const runAnalysisWithCustomConfig = async (rawText: string, defaultRole: 'TETAP' | 'KONTRAK' | 'LANSIA', configs: typeof customSheetConfigs) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const result = await storageService.analyzeRawTextData(
        rawText,
        defaultRole,
        defaultRole === 'KONTRAK' ? 'Data Pengontrak' : defaultRole === 'LANSIA' ? 'Data Lansia RT 004' : 'Data Warga Tetap',
        configs
      );
      setAnalysis(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses data salinan teks.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const result = await storageService.analyzeImportFile(file, customSheetConfigs);
      setAnalysis(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membaca berkas Excel. Pastikan berkas .xlsx, .xls, atau .csv valid.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAnalyzePengontrak = () => {
    if (!pastedPengontrakText.trim()) {
      setErrorMsg('Silakan salin dan tempel (paste) data teks pengontrak terlebih dahulu.');
      return;
    }
    setErrorMsg(null);
    setCustomSheetConfigs({});
    void runAnalysisWithCustomConfig(pastedPengontrakText, 'KONTRAK', {});
  };

  const handleAnalyzeWargaTetap = () => {
    if (!pastedTetapText.trim()) {
      setErrorMsg('Silakan salin dan tempel (paste) data warga tetap terlebih dahulu.');
      return;
    }
    setErrorMsg(null);
    setCustomSheetConfigs({});
    void runAnalysisWithCustomConfig(pastedTetapText, 'TETAP', {});
  };

  const handleSheetRoleChange = (sheetName: string, newRole: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE') => {
    const newConfigs = {
      ...customSheetConfigs,
      [sheetName]: {
        ...customSheetConfigs[sheetName],
        role: newRole
      }
    };
    setCustomSheetConfigs(newConfigs);
    const activeText = activeImportTab === 'PENGONTRAK' ? pastedPengontrakText : pastedTetapText;
    if (activeText) {
      void runAnalysisWithCustomConfig(activeText, activeImportTab === 'PENGONTRAK' ? 'KONTRAK' : 'TETAP', newConfigs);
    }
  };

  const handleColumnMappingChange = (sheetName: string, field: keyof SheetColumnMapping, colIndex: number) => {
    const currentSheetConfig = customSheetConfigs[sheetName] || {};
    const currentMapping = currentSheetConfig.columnMapping || {};

    const updatedMapping: SheetColumnMapping = {
      ...currentMapping,
      [field]: colIndex === -1 ? undefined : colIndex
    };

    const newConfigs = {
      ...customSheetConfigs,
      [sheetName]: {
        ...currentSheetConfig,
        columnMapping: updatedMapping
      }
    };
    setCustomSheetConfigs(newConfigs);
    const activeText = activeImportTab === 'PENGONTRAK' ? pastedPengontrakText : pastedTetapText;
    if (activeText) {
      void runAnalysisWithCustomConfig(activeText, activeImportTab === 'PENGONTRAK' ? 'KONTRAK' : 'TETAP', newConfigs);
    }
  };

  const handleStartRowChange = (sheetName: string, startRow: number) => {
    const currentSheetConfig = customSheetConfigs[sheetName] || {};
    const newConfigs = {
      ...customSheetConfigs,
      [sheetName]: {
        ...currentSheetConfig,
        startRow: Math.max(0, startRow)
      }
    };
    setCustomSheetConfigs(newConfigs);
    const activeText = activeImportTab === 'PENGONTRAK' ? pastedPengontrakText : pastedTetapText;
    if (activeText) {
      void runAnalysisWithCustomConfig(activeText, activeImportTab === 'PENGONTRAK' ? 'KONTRAK' : 'TETAP', newConfigs);
    }
  };

  const handleCommit = async () => {
    if (!analysis || analysis.parsedRows.length === 0) return;

    setIsCommitting(true);
    try {
      const rowsToImport = analysis.parsedRows.filter(r => r.nama && r.nama.trim().length > 0);
      const commit = onCommitImport
        ? await onCommitImport(rowsToImport, updateExisting, clearExistingBeforeImport)
        : { success: true, result: storageService.commitImportData(rowsToImport, updateExisting, clearExistingBeforeImport) };
      if (!commit.success || !commit.result) {
        throw new Error(commit.error || 'Data impor gagal disimpan.');
      }
      const res = commit.result;
      onImportSuccess(res);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Terjadi kesalahan saat menyimpan data: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const currentSheetInfo: DetectedSheetInfo | undefined = analysis?.sheetsInfo?.[activeSheetIndex];

  // Baris yang `errorMessages`-nya terisi. Sengaja dihitung dari daftar baris,
  // bukan dijumlahkan dari penghitung per-jenis di `analysis`: satu baris bisa
  // kena beberapa masalah sekaligus (mis. NIK 13 digit DAN nomor KK kosong),
  // jadi menjumlahkan penghitungnya akan melebihkan cacah barisnya.
  const barisBermasalah = analysis
    ? analysis.parsedRows.filter(r => r.errorMessages.length > 0)
    : [];

  const rincianMasalah = analysis
    ? [
        analysis.invalidNikCount > 0 && `${analysis.invalidNikCount} NIK tidak 16 digit`,
        analysis.duplicateInFileCount > 0 && `${analysis.duplicateInFileCount} NIK duplikat dalam berkas`,
        analysis.invalidKkCount > 0 && `${analysis.invalidKkCount} nomor KK bermasalah`,
      ].filter(Boolean).join(' · ')
    : '';

  const filteredRows = analysis ? analysis.parsedRows.filter(r => {
    if (filterMode === 'TETAP') return r.sheetOrigin === 'Data Warga Tetap' || (r.statusTinggal === 'TETAP' && !r.isLansia && !r.isBalita);
    if (filterMode === 'KONTRAK') return r.sheetOrigin === 'Data Pengontrak' || r.statusTinggal === 'KONTRAK';
    if (filterMode === 'LANSIA') return r.sheetOrigin === 'Data Lansia RT 004' || r.isLansia;
    if (filterMode === 'BALITA') return r.isBalita;
    if (filterMode === 'NO_NIK') return r.tanpaNikKtp;
    if (filterMode === 'EXISTING') return r.isExistingInDb;
    if (filterMode === 'BERMASALAH') return r.errorMessages.length > 0;
    return true;
  }) : [];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl max-h-[94vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Impor & Sinkronisasi Data Kependudukan RT 004
                </h3>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 text-xs font-bold rounded-md border border-blue-200">
                  RT 004 / RW 007
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pilih metode input untuk <strong>Warga Tetap</strong> atau <strong>Pengontrak (Kontrak)</strong> secara terpisah.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Perhatian: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {/* STEP 1: CHOOSE IMPORT MODE / CATEGORY TABS (Shown when not in analysis preview) */}
          {!analysis && (
            <div className="space-y-5">
              {/* Category Tab Switcher */}
              <div className="flex flex-col sm:flex-row items-stretch p-1.5 bg-slate-100 rounded-2xl border border-slate-200 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveImportTab('PENGONTRAK');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                    activeImportTab === 'PENGONTRAK'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Salin & Tempel Pengontrak (Format 5 Kolom)</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeImportTab === 'PENGONTRAK' ? 'bg-amber-800 text-amber-100' : 'bg-amber-100 text-amber-900'
                  }`}>
                    Khusus Kontrak
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveImportTab('TETAP');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                    activeImportTab === 'TETAP'
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Warga Tetap (Unggah Excel / Salin Tempel Biasa)</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    activeImportTab === 'TETAP' ? 'bg-emerald-900 text-emerald-100' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    Warga Tetap
                  </span>
                </button>
              </div>

              {/* TAB 1: PENGONTRAK (5-COLUMN FORMAT) */}
              {activeImportTab === 'PENGONTRAK' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-3">
                    <div className="font-bold text-sm flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-amber-900">
                        <Sparkles className="w-4 h-4 text-amber-700" />
                        Format Langsung Pengontrak: NO &bull; NAMA LENGKAP &bull; NO NIK / KK &bull; TTL &bull; KETERANGAN
                      </div>
                      <button
                        type="button"
                        onClick={() => setPastedPengontrakText(samplePengontrak5Col)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
                      >
                        Gunakan Contoh Format 5 Kolom Ini
                      </button>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Salin baris data dari Excel, Google Sheets, WhatsApp, atau catatan pengontrak Anda, lalu tempelkan (<kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-xs">Ctrl + V</kbd>) ke kotak di bawah.
                    </p>
                    <div className="p-3 bg-white rounded-xl border border-amber-300 font-mono text-xs text-amber-950 font-bold overflow-x-auto flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-amber-100 rounded-md text-amber-900 whitespace-nowrap">1. NO</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="px-2.5 py-1 bg-amber-100 rounded-md text-amber-900 whitespace-nowrap">2. NAMA LENGKAP</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="px-2.5 py-1 bg-amber-100 rounded-md text-amber-900 whitespace-nowrap">3. NO NIK / KK</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="px-2.5 py-1 bg-amber-100 rounded-md text-amber-900 whitespace-nowrap">4. TTL (Tempat & Tgl Lahir)</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="px-2.5 py-1 bg-amber-100 rounded-md text-amber-900 whitespace-nowrap">5. KETERANGAN (Alamat / Kontrakan)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="font-bold text-xs text-slate-800 flex items-center justify-between">
                      <span>Tempelkan Data Salinan Pengontrak:</span>
                      <span className="text-xs font-normal text-slate-500">Pemisah tab/koma/titik-koma otomatis terdeteksi</span>
                    </label>
                    <textarea
                      value={pastedPengontrakText}
                      onChange={(e) => setPastedPengontrakText(e.target.value)}
                      placeholder={`NO\tNAMA LENGKAP\tNO NIK / KK\tTTL\tKETERANGAN\n1\tWARGA CONTOH 01\t\tKota Contoh, 01-01-1990\tKONTRAKAN CONTOH A`}
                      rows={9}
                      className="w-full p-4 font-mono text-xs border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition leading-relaxed shadow-inner"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">
                      *Toleran terhadap warga tanpa NIK (otomatis dibuatkan ID warga sementara & KK Kontrak RT 004).
                    </p>
                    <button
                      type="button"
                      onClick={handleAnalyzePengontrak}
                      disabled={!pastedPengontrakText.trim() || isAnalyzing}
                      className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-full shadow transition flex items-center gap-2 cursor-pointer"
                    >
                      {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {isAnalyzing ? 'Memproses Data...' : 'Proses & Pratinjau Data Pengontrak'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: WARGA TETAP (EXCEL FILE / STANDARD FORMAT) */}
              {activeImportTab === 'TETAP' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* File Upload Box & Template Download */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Drag and Drop Upload Card */}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition group"
                    >
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept=".xlsx, .xls, .csv" 
                        onChange={handleFileUpload}
                        className="hidden" 
                      />
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <Upload className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div className="font-bold text-slate-800 text-xs mb-1">
                        Unggah Berkas Excel (.xlsx / .xls / .csv)
                      </div>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Klik untuk memilih berkas data warga dari komputer Anda. Mendukung multi-sheet otomatis.
                      </p>
                    </div>

                    {/* Download Official RT 004 Excel Template */}
                    <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col justify-between text-xs space-y-3">
                      <div>
                        <div className="font-bold text-emerald-950 flex items-center gap-2 mb-1.5">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                          Template Master Excel Resmi RT 004
                        </div>
                        <p className="text-xs text-emerald-800 leading-relaxed">
                          Gunakan format spreadsheet terstruktur lengkap dengan 3 Sheet terpisah: <strong>Data Warga Tetap</strong>, <strong>Data Pengontrak</strong>, dan <strong>Data Lansia RT 004</strong>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void storageService.downloadRT004TemplateExcel()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Download className="w-4 h-4" />
                        Unduh Template Excel RT 004 (.xlsx)
                      </button>
                    </div>
                  </div>

                  {/* Or Direct Paste for Warga Tetap */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <ClipboardPaste className="w-3.5 h-3.5 text-emerald-700" />
                        Atau Salin & Tempel Data Warga Tetap (Multi-Kolom):
                      </label>
                      <button
                        type="button"
                        onClick={() => setPastedTetapText(sampleWargaTetapFormat)}
                        className="text-xs text-emerald-700 hover:underline font-semibold cursor-pointer"
                      >
                        Gunakan Contoh Format Warga Tetap
                      </button>
                    </div>
                    <textarea
                      value={pastedTetapText}
                      onChange={(e) => setPastedTetapText(e.target.value)}
                      placeholder={`NO KELUARGA\tNO KK\tNIK\tNAMA LENGKAP\tJK\tTANGGAL LAHIR\tNO HP\tNO RM\tALAMAT\n1\t\t\tWARGA CONTOH 01\tP\t01-01-1990\t\t\tALAMAT CONTOH`}
                      rows={6}
                      className="w-full p-4 font-mono text-xs border border-slate-300 rounded-2xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition leading-relaxed shadow-inner"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-slate-500">
                        Format kolom standar: NO KELUARGA, NO KK, NIK, NAMA, JK, TGL LAHIR, NO HP, NO RM, ALAMAT
                      </p>
                      <button
                        type="button"
                        onClick={handleAnalyzeWargaTetap}
                        disabled={!pastedTetapText.trim() || isAnalyzing}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-full shadow transition flex items-center gap-2 cursor-pointer"
                      >
                        {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        {isAnalyzing ? 'Memproses Data...' : 'Proses & Pratinjau Data Warga Tetap'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ANALYSIS PREVIEW & SHEET INSPECTOR */}
          {analysis && (
            <div className="space-y-5">
              {/* File / Source Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="font-bold text-slate-800">Hasil Analisis Data Kependudukan</span>
                  <span className="text-slate-500">({analysis.totalRows} warga terdeteksi)</span>
                </div>
                <button
                  onClick={() => {
                    setAnalysis(null);
                    setPastedPengontrakText('');
                    setPastedTetapText('');
                    setCustomSheetConfigs({});
                  }}
                  className="text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Ganti / Input Ulang Data Lain
                </button>
              </div>

              {/* SHEET TABS & CUSTOM COLUMN MAPPER INSPECTOR */}
              {analysis.sheetsInfo && analysis.sheetsInfo.length > 0 && (
                <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Sheet Terdeteksi ({analysis.sheetsInfo.length} Sheet):
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowColumnConfig(!showColumnConfig)}
                      className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      {showColumnConfig ? 'Sembunyikan Pengaturan Kolom' : 'Konfigurasi & Pemetaan Kolom'}
                      {showColumnConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Sheet Selector Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {analysis.sheetsInfo.map((s, idx) => {
                      const isActive = activeSheetIndex === idx;
                      const roleBadge = s.inferredRole === 'TETAP'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : s.inferredRole === 'KONTRAK'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : s.inferredRole === 'LANSIA'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-slate-200 text-slate-600 border-slate-300';

                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setActiveSheetIndex(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-2 shrink-0 ${
                            isActive
                              ? 'bg-white border-blue-500 text-blue-900 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span>{s.name}</span>
                          <span className={`px-1.5 py-0.5 text-xs font-bold rounded-md border ${roleBadge}`}>
                            {s.inferredRole === 'TETAP' ? 'Warga Tetap' : s.inferredRole === 'KONTRAK' ? 'Pengontrak' : s.inferredRole === 'LANSIA' ? 'Lansia' : 'Diabaikan'}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            ({s.parsedRowCount} baris)
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Sheet Configuration Drawer */}
                  {currentSheetInfo && showColumnConfig && (
                    <div className="mt-3 p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <div className="font-bold text-slate-900">
                            Konfigurasi Sheet: <span className="text-blue-700">"{currentSheetInfo.name}"</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Total {currentSheetInfo.totalRawRows} baris mentah di sheet ini.
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="font-semibold text-slate-700">Kategori Sheet Ini:</label>
                          <select
                            value={currentSheetInfo.inferredRole}
                            onChange={(e) => handleSheetRoleChange(currentSheetInfo.name, e.target.value as 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE')}
                            className="p-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 focus:bg-white"
                          >
                            <option value="TETAP">Warga Tetap (TETAP)</option>
                            <option value="KONTRAK">Pengontrak / Kost (KONTRAK)</option>
                            <option value="LANSIA">Data Lansia RT 004 (LANSIA)</option>
                            <option value="IGNORE">Abaikan Sheet Ini (Jangan Diimpor)</option>
                          </select>
                        </div>
                      </div>

                      {/* Column Selectors Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom No Keluarga:</label>
                          <select
                            value={currentSheetInfo.columnMapping.noKeluargaCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'noKeluargaCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom No KK:</label>
                          <select
                            value={currentSheetInfo.columnMapping.kkCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'kkCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom NIK (KTP):</label>
                          <select
                            value={currentSheetInfo.columnMapping.nikCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'nikCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom Nama Warga (*):</label>
                          <select
                            value={currentSheetInfo.columnMapping.namaCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'namaCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom JK (L/P):</label>
                          <select
                            value={currentSheetInfo.columnMapping.jkCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'jkCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom Tanggal Lahir / TTL:</label>
                          <select
                            value={currentSheetInfo.columnMapping.ttlCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'ttlCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom No HP / WA:</label>
                          <select
                            value={currentSheetInfo.columnMapping.noHpCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'noHpCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom No RM / Rumah:</label>
                          <select
                            value={currentSheetInfo.columnMapping.noRmCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'noRmCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Kolom Alamat / Keterangan:</label>
                          <select
                            value={currentSheetInfo.columnMapping.alamatCol ?? -1}
                            onChange={(e) => handleColumnMappingChange(currentSheetInfo.name, 'alamatCol', parseInt(e.target.value))}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          >
                            <option value={-1}>-- Otomatis --</option>
                            {currentSheetInfo.headers.map((h, i) => (
                              <option key={i} value={i}>Kolom {String.fromCharCode(65 + i)} ({h})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Mulai Baris Data ke:</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={currentSheetInfo.startDataRow + 1}
                            onChange={(e) => handleStartRowChange(currentSheetInfo.name, parseInt(e.target.value) - 1)}
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-slate-500 text-xs">Total Warga</div>
                  <div className="text-lg font-bold text-slate-900">{analysis.totalRows}</div>
                  <div className="text-xs text-slate-500">Semua Kategori</div>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <div className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Warga Tetap
                  </div>
                  <div className="text-lg font-bold text-emerald-800">{analysis.wargaTetapCount}</div>
                  <div className="text-xs text-emerald-600">KK & Domisili Tetap</div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <div className="text-amber-700 text-xs font-semibold flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Pengontrak / Kost
                  </div>
                  <div className="text-lg font-bold text-amber-800">{analysis.pengontrakCount}</div>
                  <div className="text-xs text-amber-600">Warga Tidak Tetap</div>
                </div>

                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <div className="text-purple-700 text-xs font-semibold flex items-center gap-1">
                    <HeartPulse className="w-3 h-3" /> Lansia (≥60 Thn)
                  </div>
                  <div className="text-lg font-bold text-purple-800">{analysis.lansiaCount}</div>
                  <div className="text-xs text-purple-600">Sinkron Usia ≥ 60</div>
                </div>

                <div className="bg-pink-50 p-3 rounded-xl border border-pink-200">
                  <div className="text-pink-700 text-xs font-semibold flex items-center gap-1">
                    <HeartPulse className="w-3 h-3 text-pink-500" /> Balita (≤5 Thn)
                  </div>
                  <div className="text-lg font-bold text-pink-800">{analysis.balitaCount || 0}</div>
                  <div className="text-xs text-pink-600">Sinkron Usia ≤ 5</div>
                </div>

                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <div className="text-blue-700 text-xs font-semibold">Tanpa NIK/KTP</div>
                  <div className="text-lg font-bold text-blue-800">{analysis.tanpaNikCount}</div>
                  <div className="text-xs text-blue-600">Diterima (NIK Sem.)</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="text-slate-600 text-xs font-semibold">Sudah di DB</div>
                  <div className="text-lg font-bold text-slate-800">{analysis.existingInDbCount}</div>
                  <div className="text-xs text-slate-500">NIK Terdaftar</div>
                </div>
              </div>

              {/* Ringkasan baris bermasalah — hanya dirender kalau memang ada.
                  Sengaja strip, bukan kartu ke-8 di grid di atas: grid itu
                  `sm:grid-cols-7` sehingga kartu tambahan memaksa penataan ulang,
                  dan ringkasan masalah adalah butir tindakan — bukan sepadan
                  dengan hitungan demografis di sebelahnya. */}
              {barisBermasalah.length > 0 && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <div className="font-bold">{barisBermasalah.length} baris perlu diperiksa</div>
                    {rincianMasalah && <div className="text-amber-800">{rincianMasalah}</div>}
                    <div className="text-amber-700">
                      Baris ini tetap ikut diimpor — periksa lalu lengkapi datanya setelah impor selesai.
                    </div>
                  </div>
                  <button
                    onClick={() => setFilterMode('BERMASALAH')}
                    className="px-3 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition cursor-pointer shrink-0"
                  >
                    Lihat baris bermasalah
                  </button>
                </div>
              )}

              {/* Informative Note for Non-NIK acceptance & Foreign Key Safety */}
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Otomatisasi Kartu Keluarga & Sinkronisasi Aman: </span>
                  Setiap data warga maupun pengontrak secara otomatis dibuatkan dan ditautkan ke <strong>Kartu Keluarga (KK)</strong> yang valid sehingga <strong>sinkronisasi ke Supabase Cloud 100% aman tanpa kendala relasi foreign key</strong>. Kategori <strong>Lansia (≥60 tahun)</strong> dan <strong>Balita (≤5 tahun)</strong> otomatis disinkronkan dari Tanggal Lahir.
                </div>
              </div>

              {/* Import Options (Clear Dummy / Update Existing) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="clearExistingBeforeImportCheckbox"
                    checked={clearExistingBeforeImport}
                    onChange={(e) => setClearExistingBeforeImport(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor="clearExistingBeforeImportCheckbox" className="font-semibold text-slate-900 cursor-pointer flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Kosongkan seluruh data lama / dummy sebelum menyimpan hasil impor ini (Jadikan berkas ini sebagai database utama)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateExistingCheckbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    disabled={clearExistingBeforeImport}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                  />
                  <label htmlFor="updateExistingCheckbox" className={`font-semibold cursor-pointer ${clearExistingBeforeImport ? 'text-slate-400' : 'text-slate-800'}`}>
                    Perbarui data jika NIK sudah ada di database RT (Sinkronkan dengan data spreadsheet)
                  </label>
                </div>
              </div>

              {/* Table Filter Tabs */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                  <button
                    onClick={() => setFilterMode('ALL')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua ({analysis.parsedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('TETAP')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'TETAP' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Warga Tetap ({analysis.wargaTetapCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('KONTRAK')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'KONTRAK' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    Pengontrak ({analysis.pengontrakCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('LANSIA')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'LANSIA' ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    Lansia ≥60 ({analysis.lansiaCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('BALITA')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'BALITA' ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
                    }`}
                  >
                    Balita ≤5 ({analysis.balitaCount || 0})
                  </button>
                  <button
                    onClick={() => setFilterMode('NO_NIK')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'NO_NIK' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Tanpa NIK/KTP ({analysis.tanpaNikCount})
                  </button>
                  <button
                    onClick={() => setFilterMode('EXISTING')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer ${
                      filterMode === 'EXISTING' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Sudah di DB ({analysis.existingInDbCount})
                  </button>
                  {/* Selalu dirender, walau nol — sejajar dengan tab lain yang
                      juga menampilkan (0), dan mencegah tab aktif menghilang
                      saat berkas berikutnya ternyata bersih. */}
                  <button
                    onClick={() => setFilterMode('BERMASALAH')}
                    className={`px-3 py-2 rounded-full font-semibold transition cursor-pointer inline-flex items-center gap-1 shrink-0 ${
                      filterMode === 'BERMASALAH' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" /> Bermasalah ({barisBermasalah.length})
                  </button>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  Menampilkan {filteredRows.length} baris
                </span>
              </div>

              {/* Data Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-auto shadow-2xs max-h-80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-2.5 text-center w-10">No</th>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5">Status NIK</th>
                      <th className="p-2.5">NIK / ID Warga</th>
                      <th className="p-2.5">Nomor KK</th>
                      <th className="p-2.5">Nama Lengkap</th>
                      <th className="p-2.5 text-center">L/P</th>
                      <th className="p-2.5">TTL (Tgl Lahir)</th>
                      <th className="p-2.5">No HP / WA</th>
                      <th className="p-2.5">No RM</th>
                      <th className="p-2.5">Domisili</th>
                      <th className="p-2.5">Alamat / Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-slate-50/80">
                        <td className="p-2.5 text-center text-slate-500 font-mono text-xs">{row.rowNumber}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 font-medium rounded text-xs ${
                            row.sheetOrigin === 'Data Warga Tetap' || row.statusTinggal === 'TETAP'
                              ? 'bg-emerald-50 text-emerald-800' 
                              : row.sheetOrigin === 'Data Pengontrak' || row.statusTinggal === 'KONTRAK'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-purple-50 text-purple-800'
                          }`}>
                            {row.sheetOrigin || (row.statusTinggal === 'KONTRAK' ? 'Data Pengontrak' : 'Data Warga Tetap')}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {/* Cabang paling atas: baris yang punya `errorMessages`
                              tidak boleh lagi dilabeli "✓ Valid". Urutan di
                              bawahnya dibiarkan apa adanya supaya "NIK Sementara"
                              tetap menang untuk baris tanpa NIK yang memang
                              sengaja diterima. */}
                          {row.errorMessages.length > 0 ? (
                            <span
                              className="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-full text-xs border border-amber-300 inline-flex items-center gap-1"
                              title={row.errorMessages.join(' · ')}
                            >
                              <AlertTriangle className="w-3 h-3" /> Perlu Diperiksa
                            </span>
                          ) : row.tanpaNikKtp ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-full text-xs border border-blue-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> NIK Sementara
                            </span>
                          ) : row.isExistingInDb ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded-full text-xs border border-amber-200 inline-flex items-center gap-1">
                              Sudah di DB
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full text-xs border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> Valid
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-slate-900 text-xs">
                          {row.nik}
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-blue-900 text-xs">
                          {row.nomorKK}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{row.nama}</span>
                            {row.isLansia && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 font-bold rounded text-xs border border-purple-200">
                                Lansia ≥60
                              </span>
                            )}
                            {row.isBalita && (
                              <span className="px-1.5 py-0.5 bg-pink-100 text-pink-800 font-bold rounded text-xs border border-pink-200">
                                Balita ≤5
                              </span>
                            )}
                          </div>
                          {row.noKeluarga && (
                            <div className="text-xs text-slate-500 font-normal font-mono">
                              Kel #{row.noKeluarga}
                            </div>
                          )}
                          {row.errorMessages.length > 0 && (
                            <div className="text-xs text-rose-600 font-normal">
                              {row.errorMessages.join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 font-semibold text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            row.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                          }`}>
                            {row.jenisKelamin}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700 font-mono text-xs">
                          <div>{formatDateDDMMYYYY(row.tanggalLahir)}</div>
                          {row.tempatLahir && row.tempatLahir !== 'Bekasi' && (
                            <div className="text-xs text-slate-500 font-sans">{row.tempatLahir}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-700 font-mono text-xs">
                          {row.nomorHp || '-'}
                        </td>
                        <td className="p-2.5 text-slate-700 font-mono text-xs">
                          {row.noRumah || '-'}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            row.statusTinggal === 'KONTRAK' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {row.statusTinggal}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 text-xs max-w-xs truncate" title={row.keteranganKhusus || row.alamat}>
                          {row.keteranganKhusus || row.alamat}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-full text-xs font-semibold transition cursor-pointer"
          >
            Batal
          </button>

          {analysis && (
            <button
              type="button"
              onClick={handleCommit}
              disabled={isCommitting || analysis.parsedRows.length === 0}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold rounded-full shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              {isCommitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan Data ke Database RT...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Konfirmasi & Simpan {analysis.parsedRows.length} Data Warga ke Database
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

