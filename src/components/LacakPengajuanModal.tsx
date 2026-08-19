import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Search, X, XCircle } from 'lucide-react';
import { StatusPengajuanPublik } from '../types';
import { supabaseService } from '../services/supabaseService';

interface LacakPengajuanModalProps {
  onClose: () => void;
}

const statusMeta: Record<string, { label: string; className: string; Icon: typeof Clock3 }> = {
  PENDING: {
    label: 'Sedang Diproses Pengurus',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    Icon: Clock3
  },
  DISETUJUI: {
    label: 'Disetujui — Surat Siap Diambil',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2
  },
  DITOLAK: {
    label: 'Ditolak',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
    Icon: XCircle
  }
};

const formatTanggal = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Pelacakan pengajuan surat untuk warga.
 * Nomor referensi harus dipasangkan dengan NIK pemohon supaya orang lain
 * tidak bisa membaca data pengajuan hanya dengan menebak nomor referensi.
 */
export const LacakPengajuanModal: React.FC<LacakPengajuanModalProps> = ({ onClose }) => {
  const [referensi, setReferensi] = useState('');
  const [nik, setNik] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [hasil, setHasil] = useState<StatusPengajuanPublik | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRef = referensi.trim().toUpperCase();
    const cleanNik = nik.replace(/\D/g, '');

    if (!cleanRef) {
      setError('Nomor referensi wajib diisi.');
      return;
    }
    if (cleanNik.length !== 16) {
      setError('NIK harus 16 digit angka.');
      return;
    }

    setError('');
    setHasil(null);
    setIsChecking(true);
    const res = await supabaseService.cekStatusPengajuan(cleanRef, cleanNik);
    setIsChecking(false);

    if (!res.success) {
      setError(res.error || 'Status pengajuan tidak dapat diambil.');
      return;
    }
    setHasil(res.data || { ditemukan: false });
  };

  const meta = hasil?.status ? statusMeta[hasil.status] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lacak-pengajuan-title"
        className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">Layanan Warga</p>
            <h2 id="lacak-pengajuan-title" className="mt-1 text-xl font-black tracking-tight text-slate-900">
              Lacak Status Pengajuan
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Masukkan nomor referensi dari tanda terima pengajuan beserta NIK pemohon.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pelacakan pengajuan"
            className="rounded-xl bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="lacak-referensi" className="mb-1.5 block text-xs font-bold text-slate-700">
              Nomor Referensi
            </label>
            <input
              id="lacak-referensi"
              type="text"
              value={referensi}
              onChange={(e) => setReferensi(e.target.value)}
              placeholder="Contoh: SPW-20260817-A1B2"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="lacak-nik" className="mb-1.5 block text-xs font-bold text-slate-700">
              NIK Pemohon (16 digit)
            </label>
            <input
              id="lacak-nik"
              type="text"
              inputMode="numeric"
              maxLength={16}
              value={nik}
              onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
              placeholder="3216xxxxxxxxxxxx"
              autoComplete="off"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isChecking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Search className="h-4 w-4" />
            {isChecking ? 'Mencari data pengajuan...' : 'Lacak Pengajuan'}
          </button>
        </form>

        <div aria-live="polite">
          {hasil && !hasil.ditemukan && (
            <p className="mt-5 rounded-xl bg-slate-100 px-3.5 py-3 text-xs font-semibold leading-relaxed text-slate-700">
              {hasil.pesan || 'Pengajuan tidak ditemukan. Periksa kembali nomor referensi dan NIK yang Anda masukkan.'}
            </p>
          )}

          {hasil?.ditemukan && meta && (
            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${meta.className}`}>
                <meta.Icon className="h-4 w-4 shrink-0" />
                {meta.label}
              </div>

              <dl className="space-y-2 text-xs leading-relaxed">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Nomor Referensi</dt>
                  <dd className="text-right font-bold text-slate-900">{hasil.referensi || '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Nama Pemohon</dt>
                  <dd className="text-right font-bold text-slate-900">{hasil.namaPemohon || '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Keperluan</dt>
                  <dd className="text-right font-bold text-slate-900">{hasil.keperluan || '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Tanggal Pengajuan</dt>
                  <dd className="text-right font-bold text-slate-900">{formatTanggal(hasil.tanggalPengajuan)}</dd>
                </div>
                {hasil.status === 'DISETUJUI' && (
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-slate-500">Tanggal Disetujui</dt>
                    <dd className="text-right font-bold text-slate-900">{formatTanggal(hasil.tanggalDisetujui)}</dd>
                  </div>
                )}
                {hasil.status === 'DITOLAK' && hasil.alasanPenolakan && (
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-slate-500">Alasan Penolakan</dt>
                    <dd className="text-right font-bold text-rose-700">{hasil.alasanPenolakan}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LacakPengajuanModal;
