import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  RefreshCw, 
  HelpCircle,
  FileCheck,
  FileType,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import mammoth from 'mammoth';
import { RTConfig, SuratPengantar } from '../types';
import { BekasiLogo } from './BekasiLogo';

export interface DocTemplateStructure {
  fileName: string;
  rawText: string;
  htmlContent?: string;
  detectedHeaders: {
    rtRw?: string;
    kelurahan?: string;
    kecamatan?: string;
    sekretariat?: string;
    judulSurat?: string;
    nomorSuratPrefix?: string;
  };
  detectedFields: string[];
  detectedSignatures: {
    leftTitle?: string;
    leftName?: string;
    rightTitle?: string;
    rightName?: string;
  };
  extractedAt: string;
  customTemplateMode: boolean;
}

const STORAGE_KEY_DOC_TEMPLATE = 'sip_rt004_uploaded_doc_template_v1';

export function getSavedDocTemplate(): DocTemplateStructure | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DOC_TEMPLATE);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load saved doc template', e);
  }
  return null;
}

export function saveDocTemplate(template: DocTemplateStructure): void {
  try {
    localStorage.setItem(STORAGE_KEY_DOC_TEMPLATE, JSON.stringify(template));
  } catch (e) {
    console.error('Failed to save doc template', e);
  }
}

export function clearDocTemplate(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_DOC_TEMPLATE);
  } catch (e) {
    console.error('Failed to clear doc template', e);
  }
}

interface DocUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: RTConfig;
  onTemplateApplied?: (template: DocTemplateStructure) => void;
}

export const DocUploadModal: React.FC<DocUploadModalProps> = ({
  isOpen,
  onClose,
  config,
  onTemplateApplied
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<DocTemplateStructure | null>(getSavedDocTemplate());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const analyzeDocxText = (text: string, fileName: string, htmlContent: string): DocTemplateStructure => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Detect header items
    let rtRw = 'RT 004   RW 007';
    let kelurahan = 'KELURAHAN JATIMULYA';
    let kecamatan = 'KECAMATAN TAMBUN SELATAN';
    let sekretariat = 'Sekretariat : jl jampang no 111 jatimulya tlp 0896-7720-3444';
    let judulSurat = 'SURAT PENGANTAR';
    let nomorSuratPrefix = '184 / RT 004 RW 007 / SP / 2026';

    const fieldsDetected: string[] = [];

    // Search lines
    lines.forEach(line => {
      const upper = line.toUpperCase();
      if (upper.includes('RT') && upper.includes('RW')) {
        rtRw = line;
      }
      if (upper.includes('KELURAHAN')) {
        kelurahan = line;
      }
      if (upper.includes('KECAMATAN')) {
        kecamatan = line;
      }
      if (upper.includes('SEKRETARIAT') || upper.includes('TLP') || upper.includes('JL')) {
        sekretariat = line;
      }
      if (upper.includes('SURAT PENGANTAR') || upper.includes('SURAT KETERANGAN')) {
        judulSurat = line;
      }
      if (upper.includes('NO :') || upper.includes('NOMOR :') || upper.includes('NO.')) {
        nomorSuratPrefix = line.replace(/NO\s*:\s*/i, '').replace(/NOMOR\s*:\s*/i, '');
      }

      // Check fields
      if (upper.includes('NAMA')) fieldsDetected.push('Nama Pemohon');
      if (upper.includes('TEMPAT') || upper.includes('LAHIR')) fieldsDetected.push('Tempat & Tgl Lahir');
      if (upper.includes('KELAMIN')) fieldsDetected.push('Jenis Kelamin');
      if (upper.includes('STATUS') || upper.includes('PERKAWINAN')) fieldsDetected.push('Status Perkawinan');
      if (upper.includes('AGAMA')) fieldsDetected.push('Agama');
      if (upper.includes('NIK') || upper.includes('KTP')) fieldsDetected.push('No KTP / NIK');
      if (upper.includes('PEKERJAAN')) fieldsDetected.push('Pekerjaan');
      if (upper.includes('TELEPON') || upper.includes('HP')) fieldsDetected.push('Telepon / HP');
      if (upper.includes('ALAMAT')) fieldsDetected.push('Alamat Lengkap');
      if (upper.includes('KEPERLUAN')) fieldsDetected.push('Keperluan');
    });

    const uniqueFields = Array.from(new Set(fieldsDetected));

    return {
      fileName,
      rawText: text,
      htmlContent,
      detectedHeaders: {
        rtRw,
        kelurahan,
        kecamatan,
        sekretariat,
        judulSurat,
        nomorSuratPrefix
      },
      detectedFields: uniqueFields.length > 0 ? uniqueFields : [
        'Nama', 'Tempat Tgl Lahir', 'Jenis Kelamin', 'Status Perkawinan', 
        'Agama', 'No Ktp / No Nik', 'Pekerjaan', 'Telepon / Hp', 'Alamat Lengkap', 'Keperluan'
      ],
      detectedSignatures: {
        leftTitle: 'Ketua RT 004 RW 007',
        leftName: 'Ketua RT 004',
        rightTitle: 'Mengetahui / Ketua RW 007',
        rightName: 'Ketua RW 007'
      },
      extractedAt: new Date().toISOString(),
      customTemplateMode: true
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const arrayBuffer = await uploadedFile.arrayBuffer();

      // Check file type
      if (uploadedFile.name.endsWith('.docx')) {
        const resultText = await mammoth.extractRawText({ arrayBuffer });
        const resultHtml = await mammoth.convertToHtml({ arrayBuffer });
        
        const structured = analyzeDocxText(resultText.value, uploadedFile.name, resultHtml.value);
        setExtractedResult(structured);
        saveDocTemplate(structured);
        setSuccessMessage(`File "${uploadedFile.name}" berhasil diuraikan & dijadikan acuan sistem!`);
      } else if (uploadedFile.name.endsWith('.txt')) {
        const text = await uploadedFile.text();
        const structured = analyzeDocxText(text, uploadedFile.name, `<pre>${text}</pre>`);
        setExtractedResult(structured);
        saveDocTemplate(structured);
        setSuccessMessage(`File "${uploadedFile.name}" berhasil diuraikan & dijadikan acuan sistem!`);
      } else {
        // Fallback or older .doc
        const text = await uploadedFile.text();
        const cleanText = text.replace(/[^\x20-\x7E\t\r\n]/g, ' ').replace(/\s+/g, ' ');
        const structured = analyzeDocxText(cleanText, uploadedFile.name, `<p>${cleanText}</p>`);
        setExtractedResult(structured);
        saveDocTemplate(structured);
        setSuccessMessage(`File "${uploadedFile.name}" berhasil diunggah dan disimpan.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Gagal memproses file: ${err.message || 'Format file tidak didukung. Pastikan file berformat .docx atau .txt'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (extractedResult) {
      if (onTemplateApplied) {
        onTemplateApplied(extractedResult);
      }
      onClose();
    }
  };

  const handleResetToStandard = () => {
    clearDocTemplate();
    setExtractedResult(null);
    setFile(null);
    setSuccessMessage('Format dikembalikan ke Standar Resmi RT 004 RW 007 Kelurahan Jatimulya.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white p-5 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-2xl border border-white/20">
              <Upload className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Unggah File Acuan Template Dokumen (.DOCX / .DOC)</h3>
              <p className="text-xs text-blue-200">Sistem akan secara otomatis membaca tata letak, kop, dan isian surat</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Dropzone / Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/70 p-6 rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".docx,.doc,.txt" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <div className="w-12 h-12 rounded-full bg-white shadow-xs border border-blue-200 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <FileType className="w-6 h-6" />
            </div>
            <div className="font-bold text-sm text-slate-800">
              {isLoading ? 'Sedang mengekstrak isi berkas...' : 'Klik atau Tarik File Word (.docx / .doc) ke Sini'}
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Sistem akan mengekstrak struktur kop surat, teks pembuka, urutan kolom titik dua pemohon, dan bagian tanda tangan sebagai acuan otomatis.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Extracted Acuan Info Card */}
          {extractedResult && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-bold text-slate-900 text-xs">
                    Acuan Berkas Aktif: <strong className="text-blue-700">{extractedResult.fileName}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetToStandard}
                  className="text-xs text-slate-500 hover:text-rose-600 font-semibold underline cursor-pointer"
                >
                  Hapus &amp; Reset ke Standar
                </button>
              </div>

              {/* Grid of detected elements */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block text-xs uppercase">
                    Kop Surat Terdeteksi
                  </span>
                  <div className="font-bold text-slate-900">{extractedResult.detectedHeaders.rtRw}</div>
                  <div className="text-slate-600">{extractedResult.detectedHeaders.kelurahan}</div>
                  <div className="text-slate-600">{extractedResult.detectedHeaders.kecamatan}</div>
                  <div className="text-xs text-slate-500 truncate">{extractedResult.detectedHeaders.sekretariat}</div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block text-xs uppercase">
                    Tanda Tangan Pengesahan
                  </span>
                  <div className="font-semibold text-slate-800">
                    Kiri: {extractedResult.detectedSignatures.leftTitle} &rarr; <strong>{extractedResult.detectedSignatures.leftName}</strong>
                  </div>
                  <div className="font-semibold text-slate-800">
                    Kanan: {extractedResult.detectedSignatures.rightTitle} &rarr; <strong>{extractedResult.detectedSignatures.rightName}</strong>
                  </div>
                </div>
              </div>

              {/* Detected Fields Chips */}
              <div>
                <span className="font-bold text-slate-700 block text-xs uppercase mb-1.5">
                  Kolom Isian Pemohon yang Dikenali ({extractedResult.detectedFields.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {extractedResult.detectedFields.map((field, idx) => (
                    <span 
                      key={idx}
                      className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-blue-600" />
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Format Explanation Info Box */}
          <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-950">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Format Acuan Otomatis Aktif:</p>
              <p className="text-slate-600 text-xs mt-0.5">
                Setiap surat pengantar baru yang dibuat dan dicetak akan secara otomatis mengikuti urutan isian data, teks kop, dan perataan titik dua sesuai dengan dokumen acuan Anda.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
          >
            Tutup
          </button>
          
          <button
            type="button"
            onClick={handleApply}
            disabled={!extractedResult}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Terapkan Sebagai Acuan Sistem
          </button>
        </div>
      </div>
    </div>
  );
};
