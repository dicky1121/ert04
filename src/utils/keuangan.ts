import type { TransaksiKeuangan, RingkasanKeuangan, RingkasanBulanKas } from '../types';

/**
 * Utilitas fitur Keuangan RT: format rupiah, agregasi ringkasan kas, dan
 * pelabelan bulan. Keuangan hanya menampilkan ringkasan — warga membaca,
 * pengurus keuangan mengelola.
 */

// Satu sumber format rupiah dipakai bersama modul UMKM.
export { formatRupiah } from './pesananWa';

/**
 * Agregasi daftar transaksi menjadi ringkasan kas: total masuk/keluar,
 * saldo berjalan, dan rekap per bulan (urut terbaru dulu).
 */
export const hitungRingkasan = (items: TransaksiKeuangan[]): RingkasanKeuangan => {
  let totalMasuk = 0;
  let totalKeluar = 0;
  const peta = new Map<string, RingkasanBulanKas>();

  for (const t of items) {
    const nilai = Number.isFinite(t.jumlah) ? t.jumlah : 0;
    if (t.jenis === 'MASUK') totalMasuk += nilai;
    else totalKeluar += nilai;

    const bulan = t.bulanKas || (t.tanggal ? t.tanggal.slice(0, 7) : '');
    if (!bulan) continue;
    const row = peta.get(bulan) ?? { bulan, masuk: 0, keluar: 0, saldo: 0 };
    if (t.jenis === 'MASUK') row.masuk += nilai;
    else row.keluar += nilai;
    row.saldo = row.masuk - row.keluar;
    peta.set(bulan, row);
  }

  const perBulan = Array.from(peta.values()).sort((a, b) => (a.bulan < b.bulan ? 1 : -1));
  return { totalMasuk, totalKeluar, saldo: totalMasuk - totalKeluar, perBulan };
};

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** Ubah 'YYYY-MM' → 'Agustus 2026' untuk tampilan. */
export const namaBulan = (ym: string): string => {
  if (!ym || ym.length < 7) return ym || '-';
  const [tahun, bln] = ym.split('-');
  const idx = Number(bln) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${NAMA_BULAN[idx]} ${tahun}`;
};

/** Ubah 'YYYY-MM-DD' → '20 Agu 2026' (ringkas) untuk baris transaksi. */
export const formatTanggalRingkas = (ymd: string): string => {
  if (!ymd) return '-';
  const d = new Date(`${ymd}T00:00:00`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
