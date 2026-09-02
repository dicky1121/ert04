/**
 * Utilitas format tanggal — sumber tunggal untuk seluruh komponen.
 *
 * Tiga varian:
 *  - formatTanggalPanjang  → "Senin, 01 September 2026"  (dengan hari)
 *  - formatTanggalSedang   → "01 September 2026"          (tanpa hari)
 *  - formatTanggalRingkas  → "01 Sep 2026"                (bulan singkat)
 *
 * Re-export formatTanggalRingkas dari keuangan.ts supaya semua impor
 * tanggal cukup dari satu modul ini.
 */

/** 'YYYY-MM-DD' atau ISO string → "Senin, 01 September 2026" */
export const formatTanggalPanjang = (value?: string | null): string => {
  if (!value) return '-';
  // Pakai T00:00:00 agar tanggal tidak bergeser akibat zona waktu.
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

/** 'YYYY-MM-DD' atau ISO string → "01 September 2026" */
export const formatTanggalSedang = (value?: string | null): string => {
  if (!value) return '-';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

// Re-export dari keuangan.ts agar konsumen cukup import dari sini.
export { formatTanggalRingkas } from './keuangan';
