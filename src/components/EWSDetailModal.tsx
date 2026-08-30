import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Clock3,
  ImageOff,
  Loader2,
  MapPin,
  User,
  X,
} from 'lucide-react';
import { EWS_JENIS_KEJADIAN, JenisKejadianEWS, LaporanEWS, StatusEWS } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface EWSDetailModalProps {
  laporanId: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<StatusEWS, string> = {
  BARU: 'Baru Dilaporkan',
  DITANGANI: 'Sedang Ditangani',
  SELESAI: 'Selesai Ditangani',
};

const STATUS_COLOR: Record<StatusEWS, string> = {
  BARU: 'bg-rose-100 text-rose-700 border-rose-200',
  DITANGANI: 'bg-amber-100 text-amber-700 border-amber-200',
  SELESAI: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const WARNA_BG: Record<string, string> = {
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
};

const formatWaktu = (isoStr: string): string => {
  if (!isoStr) return '-';
  try {
    return new Date(isoStr).toLocaleString('id-ID', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
};

/**
 * Popup detail laporan EWS — muncul saat notifikasi push EWS diklik di Android.
 * Menampilkan jenis kejadian, deskripsi, pelapor, alamat, foto, waktu, dan status.
 */
export const EWSDetailModal: React.FC<EWSDetailModalProps> = ({ laporanId, onClose }) => {
  const [laporan, setLaporan] = useState<LaporanEWS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gagalFoto, setGagalFoto] = useState(false);
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  useEffect(() => {
    let aktif = true;
    void (async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabaseService.fetchLaporanEWSById(laporanId);
      if (!aktif) return;
      if (err || !data) {
        setError(err || 'Laporan tidak ditemukan.');
      } else {
        setLaporan(data);
      }
      setLoading(false);
    })();
    return () => { aktif = false; };
  }, [laporanId]);

  const meta = laporan
    ? EWS_JENIS_KEJADIAN.find(j => j.value === (laporan.jenis_kejadian as JenisKejadianEWS))
    : null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Detail Laporan Darurat"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className={`flex items-center justify-between gap-3 px-5 py-4 ${meta ? WARNA_BG[meta.warna] ?? 'bg-rose-500' : 'bg-rose-500'} text-white`}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl leading-none">{meta?.emoji ?? '🚨'}</span>
            <div>
              <p className="text-sm font-extrabold">{meta?.label ?? 'Laporan Darurat'}</p>
              <p className="text-[11px] text-white/80">EWS RT 004 RW 007</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">Memuat detail laporan…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 m-5 rounded-2xl bg-rose-50 border border-rose-200 px-4 py-4 text-rose-700 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && laporan && (
            <div className="p-5 space-y-4">
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${STATUS_COLOR[laporan.status]}`}>
                {STATUS_LABEL[laporan.status]}
              </span>

              {/* Deskripsi */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Keterangan</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {laporan.deskripsi || '(tidak ada keterangan tambahan)'}
                </p>
              </div>

              {/* Pelapor & Alamat */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start gap-2.5 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Dilaporkan oleh</p>
                    <p className="text-sm font-bold text-slate-800">{laporan.nama_pelapor}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Lokasi kejadian</p>
                    <p className="text-sm font-bold text-slate-800">{laporan.alamat}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <Clock3 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">Waktu laporan</p>
                    <p className="text-sm font-bold text-slate-800">{formatWaktu(laporan.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Foto laporan */}
              {laporan.foto_url && !gagalFoto && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Foto Laporan</p>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img
                      src={laporan.foto_url}
                      alt="Foto laporan darurat"
                      className="w-full max-h-72 object-cover"
                      onError={() => setGagalFoto(true)}
                    />
                  </div>
                </div>
              )}

              {laporan.foto_url && gagalFoto && (
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-slate-400 text-xs">
                  <ImageOff className="w-4 h-4 shrink-0" />
                  <span>Foto tidak dapat dimuat.</span>
                </div>
              )}

              {/* ID laporan */}
              <p className="text-[11px] text-slate-400 font-mono text-center pt-1">
                ID: {laporan.id}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
