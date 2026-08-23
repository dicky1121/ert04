import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ClipboardCopy,
  FileText,
  Loader2,
  MapPin,
  MessageSquareWarning,
  Inbox,
} from 'lucide-react';
import { RiwayatPengaduan, RiwayatSurat } from '../../types';
import {
  PENGADUAN_LABEL,
  PENGADUAN_TONE,
  SURAT_LABEL,
  SURAT_TONE,
  statusBadge,
} from '../../utils/statusBadge';
import { formatTanggalRingkas } from '../../utils/keuangan';

interface RiwayatWargaProps {
  surat: RiwayatSurat[];
  pengaduan: RiwayatPengaduan[];
  loading: boolean;
  error?: string | null;
}

/** Timestamptz ISO → '20 Agu 2026, 14:05'. */
const fmtWaktu = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Kode jenis surat → label (sinkron dgn pilihan di PublicSuratForm). */
const JENIS_LABEL: Record<string, string> = {
  KTP_KK: 'Pengantar KTP / KK',
  DOMISILI: 'Keterangan Domisili',
  SKTM: 'Surat Keterangan Tidak Mampu',
  USAHA: 'Keterangan Usaha',
  NIKAH: 'Pengantar Nikah',
  KELAHIRAN: 'Keterangan Kelahiran',
  KEMATIAN: 'Keterangan Kematian',
  SKCK: 'Pengantar SKCK',
  IZIN_KERAMAIAN: 'Izin Keramaian',
  LAINNYA: 'Keperluan Lainnya',
};

/** Nomor referensi yang bisa disalin — satu ketukan, umpan balik 2 detik. */
const NomorSalin: React.FC<{ nomor: string }> = ({ nomor }) => {
  const [tersalin, setTersalin] = useState(false);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(nomor);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      /* clipboard diblokir (http / izin) — nomornya tetap terbaca di layar */
    }
  };

  return (
    <button
      type="button"
      onClick={salin}
      title="Salin nomor"
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-600 transition hover:bg-slate-200"
    >
      <span className="truncate">{nomor}</span>
      {tersalin
        ? <Check className="h-3 w-3 shrink-0 text-emerald-600" />
        : <ClipboardCopy className="h-3 w-3 shrink-0 opacity-60" />}
    </button>
  );
};

const KosongState: React.FC<{ teks: string }> = ({ teks }) => (
  <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
      <Inbox className="h-5 w-5" />
    </span>
    <p className="max-w-[16rem] text-sm text-slate-400">{teks}</p>
  </div>
);

const SeksiHeader: React.FC<{ title: string; icon: React.ElementType; jumlah: number }> = ({
  title,
  icon: Icon,
  jumlah,
}) => (
  <div className="mb-3 flex items-center gap-2 px-0.5">
    <Icon className="h-4 w-4 text-emerald-600" />
    <h2 className="text-[15px] font-extrabold tracking-tight text-slate-800">{title}</h2>
    {jumlah > 0 && (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
        {jumlah}
      </span>
    )}
  </div>
);

/**
 * Layar "Riwayat Saya" — arsip pengajuan surat & pengaduan milik warga
 * yang sedang login. Datanya datang dari RPC `pengajuan_saya()` /
 * `pengaduan_saya()` yang sudah di-scope server, diambil sekali di
 * WargaLayout lalu diturunkan lewat props (tidak fetch ganda).
 *
 * Murni baca: tidak ada kontrol status di sisi warga.
 */
export const RiwayatWarga: React.FC<RiwayatWargaProps> = ({ surat, pengaduan, loading, error }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Memuat riwayat Anda…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-2">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">{error}</span>
        </div>
      )}

      {/* ── Pengajuan Surat ─────────────────────────────────────────────── */}
      <section>
        <SeksiHeader title="Pengajuan Surat" icon={FileText} jumlah={surat.length} />
        {surat.length === 0 ? (
          <KosongState teks="Belum ada pengajuan surat atas nama Anda." />
        ) : (
          <div className="space-y-3">
            {surat.map((s) => {
              const kode = String(s.status || '').toUpperCase() as keyof typeof SURAT_TONE;
              const tone = SURAT_TONE[kode] ?? 'neutral';
              const label = SURAT_LABEL[kode] ?? s.status;
              return (
                <article key={s.nomorSurat} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold leading-snug text-slate-900">
                        {s.judulSurat || JENIS_LABEL[s.jenisSurat] || s.jenisSurat}
                      </h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Diajukan {s.tanggalPengajuan ? formatTanggalRingkas(s.tanggalPengajuan) : '-'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusBadge(tone)}`}>
                      {label}
                    </span>
                  </div>

                  {s.keperluan && (
                    <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      <span className="font-semibold text-slate-600">Keperluan:</span> {s.keperluan}
                    </p>
                  )}

                  {kode === 'DITOLAK' && s.alasanPenolakan && (
                    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <p className="text-xs leading-relaxed text-rose-700">
                        <span className="font-bold">Alasan ditolak:</span> {s.alasanPenolakan}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <NomorSalin nomor={s.nomorSurat} />
                    {s.tanggalDisetujui && (
                      <span className="text-[11px] font-semibold text-emerald-600">
                        Disetujui {formatTanggalRingkas(s.tanggalDisetujui)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Pengaduan Saya ──────────────────────────────────────────────── */}
      <section>
        <SeksiHeader title="Pengaduan Saya" icon={MessageSquareWarning} jumlah={pengaduan.length} />
        {pengaduan.length === 0 ? (
          <KosongState teks="Belum ada pengaduan yang Anda kirim lewat akun ini." />
        ) : (
          <div className="space-y-3">
            {pengaduan.map((p) => {
              const kode = String(p.status || '').toUpperCase();
              const tone = PENGADUAN_TONE[kode] ?? 'neutral';
              const label = PENGADUAN_LABEL[kode] ?? p.status;
              return (
                <article key={p.nomorTiket} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900">{p.kategori}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <CalendarDays className="h-3.5 w-3.5" /> {fmtWaktu(p.createdAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusBadge(tone)}`}>
                      {label}
                    </span>
                  </div>

                  {p.alamatKejadian && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="min-w-0">{p.alamatKejadian}</span>
                    </p>
                  )}

                  <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                    {p.isiLaporan}
                  </p>

                  {p.tanggapan && (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700/80">
                        Tanggapan pengurus
                      </p>
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-emerald-800">
                        {p.tanggapan}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <NomorSalin nomor={p.nomorTiket} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-400">
        Riwayat menampilkan maksimal 50 data terbaru per jenis.
      </p>
    </div>
  );
};

export default RiwayatWarga;
