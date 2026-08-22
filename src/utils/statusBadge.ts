/**
 * Sumber tunggal gaya badge status di seluruh aplikasi.
 *
 * Sebelumnya resep badge bercabang: surat memakai `bg-50/text-800`
 * (SuratPengantarView, LacakPengajuanModal) sedangkan EWS memakai
 * `bg-100/text-700` (EWSAdminView). Helper ini menyatukannya ke satu resep
 * kanonik (mengikuti pola kartu EWS) sehingga warna status punya satu sumber
 * kebenaran. Semua kombinasi bg terang + teks gelap lolos kontras WCAG AA.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface ToneStyle {
  /** Kelas pill lengkap: latar + teks + border. */
  badge: string;
  /** Kelas warna titik/dot pendamping. */
  dot: string;
}

const TONE_STYLE: Record<StatusTone, ToneStyle> = {
  success: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  warning: { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  danger: { badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  info: { badge: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  neutral: { badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

/** Kelas pill badge untuk sebuah tone semantik. */
export const statusBadge = (tone: StatusTone): string => TONE_STYLE[tone].badge;

/** Kelas dot pendamping untuk sebuah tone. */
export const statusDot = (tone: StatusTone): string => TONE_STYLE[tone].dot;

// ── Peta domain status → tone ────────────────────────────────────────────────

/** Status pengajuan surat pengantar. */
export const SURAT_TONE: Record<'PENDING' | 'DISETUJUI' | 'DITOLAK', StatusTone> = {
  PENDING: 'warning',
  DISETUJUI: 'success',
  DITOLAK: 'danger',
};

/** Status laporan EWS darurat. */
export const EWS_TONE: Record<'BARU' | 'DITANGANI' | 'SELESAI', StatusTone> = {
  BARU: 'danger',
  DITANGANI: 'warning',
  SELESAI: 'success',
};

/** Status tagihan iuran warga. */
export const IURAN_TONE: Record<'BELUM_LUNAS' | 'MENUNGGU_VERIFIKASI' | 'LUNAS' | 'DITOLAK', StatusTone> = {
  BELUM_LUNAS: 'warning',
  MENUNGGU_VERIFIKASI: 'info',
  LUNAS: 'success',
  DITOLAK: 'danger',
};

/** Label ramah-pengguna status tagihan iuran. */
export const IURAN_LABEL: Record<'BELUM_LUNAS' | 'MENUNGGU_VERIFIKASI' | 'LUNAS' | 'DITOLAK', string> = {
  BELUM_LUNAS: 'Belum Lunas',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  LUNAS: 'Lunas',
  DITOLAK: 'Ditolak',
};
