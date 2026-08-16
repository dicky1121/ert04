import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, MegaphoneOff, Send, X } from 'lucide-react';
import { KategoriPengaduan } from '../types';
import { supabaseService } from '../services/supabaseService';

interface PengaduanWargaModalProps {
  onClose: () => void;
}

const kategoriOptions: { value: KategoriPengaduan; label: string }[] = [
  { value: 'KEAMANAN', label: 'Keamanan & Ketertiban' },
  { value: 'KEBERSIHAN', label: 'Kebersihan & Sampah' },
  { value: 'INFRASTRUKTUR', label: 'Jalan, Saluran & Penerangan' },
  { value: 'SOSIAL', label: 'Sosial & Kesejahteraan' },
  { value: 'LAINNYA', label: 'Lainnya' }
];

/**
 * Kanal laporan warga. Server (fungsi kirim_pengaduan) membatasi 3 laporan
 * per nomor kontak per jam, sehingga form ini tidak perlu menahan pengiriman
 * sendiri selain validasi isian.
 */
export const PengaduanWargaModal: React.FC<PengaduanWargaModalProps> = ({ onClose }) => {
  const [kategori, setKategori] = useState<KategoriPengaduan>('KEBERSIHAN');
  const [namaPelapor, setNamaPelapor] = useState('');
  const [kontakPelapor, setKontakPelapor] = useState('');
  const [alamatKejadian, setAlamatKejadian] = useState('');
  const [isiLaporan, setIsiLaporan] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [tiket, setTiket] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tiket);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      setError('Nomor tiket tidak dapat disalin otomatis. Silakan catat manual.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nama = namaPelapor.trim();
    const kontak = kontakPelapor.replace(/[^\d+]/g, '');
    const alamat = alamatKejadian.trim();
    const isi = isiLaporan.trim();

    if (nama.length < 3) {
      setError('Nama pelapor minimal 3 karakter.');
      return;
    }
    if (kontak.replace(/\D/g, '').length < 9) {
      setError('Nomor kontak tidak valid. Gunakan nomor HP aktif yang bisa dihubungi.');
      return;
    }
    if (alamat.length < 5) {
      setError('Tuliskan lokasi kejadian, misalnya blok dan nomor rumah terdekat.');
      return;
    }
    if (isi.length < 15) {
      setError('Uraian laporan minimal 15 karakter agar pengurus dapat menindaklanjuti.');
      return;
    }

    setError('');
    setIsSending(true);
    const res = await supabaseService.kirimPengaduan({
      kategori,
      namaPelapor: nama,
      kontakPelapor: kontak,
      alamatKejadian: alamat,
      isiLaporan: isi
    });
    setIsSending(false);

    if (!res.success) {
      setError(res.error || 'Laporan tidak dapat dikirim. Coba lagi beberapa saat.');
      return;
    }
    setTiket(res.tiket || '');
  };

  if (tiket) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pengaduan-sukses-title"
          className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 id="pengaduan-sukses-title" className="mt-4 text-xl font-black tracking-tight text-slate-900">
            Laporan Terkirim
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-600">
            Pengurus akan menindaklanjuti laporan Anda. Simpan nomor tiket berikut sebagai bukti pelaporan.
          </p>

          <div className="mt-5 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">Nomor Tiket</p>
            <p className="mt-1 break-all text-lg font-black tracking-tight text-emerald-900">{tiket}</p>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <Copy className="h-3.5 w-3.5" />
              {isCopied ? 'Tersalin!' : 'Salin nomor tiket'}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-[11px] font-semibold text-amber-700">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pengaduan-title"
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-600">Layanan Warga</p>
            <h2 id="pengaduan-title" className="mt-1 text-xl font-black tracking-tight text-slate-900">
              Lapor &amp; Pengaduan
            </h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Sampaikan keluhan atau kejadian di lingkungan. Data Anda hanya dibaca oleh pengurus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir pengaduan"
            className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pengaduan-kategori" className="mb-1.5 block text-xs font-bold text-slate-700">
              Kategori Laporan
            </label>
            <select
              id="pengaduan-kategori"
              value={kategori}
              onChange={(e) => setKategori(e.target.value as KategoriPengaduan)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            >
              {kategoriOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pengaduan-nama" className="mb-1.5 block text-xs font-bold text-slate-700">
                Nama Pelapor
              </label>
              <input
                id="pengaduan-nama"
                type="text"
                value={namaPelapor}
                onChange={(e) => setNamaPelapor(e.target.value)}
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div>
              <label htmlFor="pengaduan-kontak" className="mb-1.5 block text-xs font-bold text-slate-700">
                Nomor HP / WhatsApp
              </label>
              <input
                id="pengaduan-kontak"
                type="tel"
                inputMode="tel"
                value={kontakPelapor}
                onChange={(e) => setKontakPelapor(e.target.value)}
                placeholder="08xxxxxxxxxx"
                autoComplete="tel"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="pengaduan-alamat" className="mb-1.5 block text-xs font-bold text-slate-700">
              Lokasi Kejadian
            </label>
            <input
              id="pengaduan-alamat"
              type="text"
              value={alamatKejadian}
              onChange={(e) => setAlamatKejadian(e.target.value)}
              placeholder="Contoh: Blok A2 No. 14, dekat pos ronda"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>

          <div>
            <label htmlFor="pengaduan-isi" className="mb-1.5 block text-xs font-bold text-slate-700">
              Uraian Laporan
            </label>
            <textarea
              id="pengaduan-isi"
              rows={4}
              value={isiLaporan}
              onChange={(e) => setIsiLaporan(e.target.value)}
              placeholder="Jelaskan kejadian, waktu, dan kondisi yang perlu ditindaklanjuti pengurus."
              className="w-full resize-y rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium leading-relaxed text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-[11px] font-semibold text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
            <MegaphoneOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            Untuk keadaan darurat yang mengancam nyawa, hubungi langsung 112 atau pengurus lewat telepon.
          </p>

          <button
            type="submit"
            disabled={isSending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Mengirim laporan...' : 'Kirim Laporan'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PengaduanWargaModal;
