import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  Send,
  Siren,
  User,
  X,
} from 'lucide-react';
import { EWS_JENIS_KEJADIAN, JenisKejadianEWS, LaporanEWSInput } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface EWSLaporanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_FOTO_SIZE = 2 * 1024 * 1024; // 2 MB

export const EWSLaporanModal: React.FC<EWSLaporanModalProps> = ({ isOpen, onClose }) => {
  const [jenisKejadian, setJenisKejadian] = useState<JenisKejadianEWS | ''>('');
  const [deskripsi, setDeskripsi] = useState('');
  const [namaPelapor, setNamaPelapor] = useState('');
  const [alamat, setAlamat] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FOTO_SIZE) {
      setError('Ukuran foto maksimal 2 MB. Pilih foto yang lebih kecil.');
      return;
    }
    setError(null);
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!jenisKejadian) { setError('Pilih jenis kejadian terlebih dahulu.'); return; }
    if (!deskripsi.trim()) { setError('Deskripsi kejadian wajib diisi.'); return; }
    if (!namaPelapor.trim()) { setError('Nama pelapor wajib diisi.'); return; }
    if (!alamat.trim()) { setError('Alamat kejadian wajib diisi.'); return; }

    setIsLoading(true);
    const input: LaporanEWSInput = {
      jenis_kejadian: jenisKejadian,
      deskripsi: deskripsi.trim(),
      nama_pelapor: namaPelapor.trim(),
      alamat: alamat.trim(),
      foto_file: fotoFile,
    };

    const result = await supabaseService.kirimLaporanEWS(input);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || 'Laporan gagal dikirim. Coba lagi.');
      return;
    }
    setSuccessId(result.id || 'EWS-TERKIRIM');
  };

  const handleClose = () => {
    // Reset semua state
    setJenisKejadian('');
    setDeskripsi('');
    setNamaPelapor('');
    setAlamat('');
    setFotoFile(null);
    setFotoPreview(null);
    setError(null);
    setSuccessId(null);
    setIsLoading(false);
    onClose();
  };

  const dialogRef = useModalDismiss<HTMLDivElement>(handleClose, isOpen);

  if (!isOpen) return null;

  const selectedJenis = EWS_JENIS_KEJADIAN.find(j => j.value === jenisKejadian);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ews-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div className="relative w-full sm:max-w-lg bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-rose-500/30 overflow-hidden max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-rose-600/20 border-b border-rose-500/30 shrink-0">
          <div className="w-9 h-9 rounded-full bg-rose-600 flex items-center justify-center shrink-0 animate-pulse">
            <Siren className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="ews-modal-title" className="text-base font-bold text-white leading-tight">
              Laporkan Darurat
            </h2>
            <p className="text-xs text-rose-300 mt-0.5">
              Laporan akan dikirim ke seluruh warga RT 004
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SUCCESS STATE */}
        {successId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Laporan Terkirim!</h3>
              <p className="text-sm text-slate-300 mt-1">
                Notifikasi darurat sedang dikirim ke semua warga RT 004.
              </p>
              <p className="text-xs text-slate-500 mt-3 font-mono bg-slate-800 px-3 py-1.5 rounded-lg">
                ID Laporan: <span className="text-emerald-400 font-semibold">{successId}</span>
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Pengurus RT akan segera menindaklanjuti laporan ini.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full transition-colors"
            >
              Selesai
            </button>
          </div>
        ) : (
          /* FORM STATE */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-4">

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs px-3.5 py-2.5 rounded-xl" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Jenis Kejadian */}
              <div>
                <p className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Jenis Kejadian <span className="text-rose-400">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EWS_JENIS_KEJADIAN.map((jenis) => (
                    <button
                      key={jenis.value}
                      type="button"
                      onClick={() => setJenisKejadian(jenis.value)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                        jenisKejadian === jenis.value
                          ? 'bg-rose-600/30 border-rose-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-base leading-none">{jenis.emoji}</span>
                      <span className="truncate text-xs">{jenis.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label htmlFor="ews-deskripsi" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Deskripsi Singkat <span className="text-rose-400">*</span>
                </label>
                <textarea
                  id="ews-deskripsi"
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder={selectedJenis ? `Ceritakan kejadian ${selectedJenis.label.toLowerCase()} secara singkat...` : 'Ceritakan kejadian secara singkat...'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 resize-none transition-colors"
                />
                <p className="text-right text-xs text-slate-600 mt-1">{deskripsi.length}/500</p>
              </div>

              {/* Nama Pelapor */}
              <div>
                <label htmlFor="ews-nama" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Nama Pelapor <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="ews-nama"
                    type="text"
                    value={namaPelapor}
                    onChange={(e) => setNamaPelapor(e.target.value)}
                    placeholder="Nama lengkap Anda"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Alamat */}
              <div>
                <label htmlFor="ews-alamat" className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Alamat / Lokasi Kejadian <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="ews-alamat"
                    type="text"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Contoh: Blok A No. 12, depan warung Pak RT"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 transition-colors"
                  />
                </div>
              </div>

              {/* Foto Opsional */}
              <div>
                <p className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Foto Kejadian <span className="text-slate-600 font-normal normal-case">(opsional, max 2MB)</span>
                </p>
                {fotoPreview ? (
                  <div className="relative">
                    <img
                      src={fotoPreview}
                      alt="Preview foto laporan"
                      className="w-full h-36 object-cover rounded-xl border border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveFoto}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
                      aria-label="Hapus foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2.5 bg-slate-800 border border-dashed border-slate-600 hover:border-slate-400 rounded-xl py-4 text-sm text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Tambah foto (opsional)</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFotoChange}
                  className="hidden"
                  aria-label="Upload foto kejadian"
                />
              </div>
            </div>

            {/* Footer / Submit */}
            <div className="px-5 pb-5 pt-2 shrink-0">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-colors shadow-lg shadow-rose-900/40"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengirim laporan...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Kirim Laporan Darurat</span>
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-600 mt-2.5">
                Laporan palsu dapat dikenai sanksi oleh pengurus RT
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
