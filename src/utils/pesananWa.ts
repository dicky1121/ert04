import type { PesananWaInput } from '../types';

/**
 * Utilitas untuk fitur UMKM: format rupiah, normalisasi nomor WhatsApp,
 * dan penyusun pesan checkout via WhatsApp.
 *
 * Pemesanan UMKM TIDAK melewati transaksi di dalam aplikasi — hanya membuka
 * WhatsApp penjual dengan template pesanan yang sudah terisi.
 */

/** Format angka ke rupiah, mis. 15000 → "Rp15.000". */
export const formatRupiah = (nilai: number): string => {
  const bulat = Math.round(Number.isFinite(nilai) ? nilai : 0);
  return 'Rp' + bulat.toLocaleString('id-ID');
};

/**
 * Normalkan nomor telepon Indonesia ke format internasional tanpa "+"
 * (mis. "0812-3456" → "62812345 6", "+62 812" → "62812") agar bisa dipakai
 * di URL wa.me. Mengembalikan '' bila tidak ada digit.
 */
export const toWhatsappNumber = (value: string): string => {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

/** Harga efektif satu item: harga varian bila dipilih & > 0, else harga produk. */
export const hargaEfektif = (input: Pick<PesananWaInput, 'produk' | 'varian'>): number => {
  const { produk, varian } = input;
  if (varian && varian.harga > 0) return varian.harga;
  return produk.harga;
};

/** Subtotal (harga efektif × qty). */
export const hitungSubtotal = (input: PesananWaInput): number =>
  hargaEfektif(input) * Math.max(1, input.qty);

/**
 * Susun teks pesanan WhatsApp (belum di-encode). Dipakai untuk pratinjau
 * di modal maupun sebagai sumber URL wa.me.
 */
export const susunTeksPesanan = (input: PesananWaInput): string => {
  const { toko, produk, varian, qty, namaPemesan, alamatPemesan, nomorHpPemesan, catatan } = input;
  const jumlah = Math.max(1, qty);
  const subtotal = hitungSubtotal(input);
  const namaItem = varian ? `${produk.namaProduk} - ${varian.namaVarian}` : produk.namaProduk;

  const baris: string[] = [
    `Halo *${toko.namaUsaha}*, saya ingin memesan:`,
    `• ${namaItem} × ${jumlah} = ${formatRupiah(subtotal)}`,
    `Total: ${formatRupiah(subtotal)}`,
    '',
    `Pemesan : ${namaPemesan || '-'}`,
    `Alamat  : ${alamatPemesan || '-'}`,
    `No. HP  : ${nomorHpPemesan || '-'}`,
  ];
  if (catatan && catatan.trim()) {
    baris.push(`Catatan : ${catatan.trim()}`);
  }
  baris.push('— via aplikasi E-RT04');
  return baris.join('\n');
};

/**
 * Bangun URL wa.me lengkap untuk pesanan. Mengembalikan null bila nomor WA
 * penjual tidak valid (tidak ada digit).
 */
export const buatPesananWa = (input: PesananWaInput): string | null => {
  const nomor = toWhatsappNumber(input.toko.kontakWa);
  if (!nomor) return null;
  const teks = susunTeksPesanan(input);
  return `https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`;
};
