/**
 * Sumber tunggal daftar peran "pengurus keuangan" RT.
 *
 * Mencerminkan predikat DB `is_pengurus_keuangan()` (lihat fitur-keuangan-rt.sql).
 * Dipakai untuk gate TAMPILAN di panel Keuangan & Iuran RT (tombol tambah/edit/
 * verifikasi). Ini hanya kenyamanan UI — otorisasi sebenarnya tetap ditegakkan
 * RLS di server, sehingga daftar ini tak boleh dianggap sebagai batas keamanan.
 *
 * Diketik `readonly string[]` (bukan tuple `as const`) supaya `.includes(role)`
 * menerima sembarang string tanpa error tipe.
 */
export const ROLE_PENGURUS_KEUANGAN: readonly string[] = [
  'ADMIN_KETUA_RT',
  'ADMIN_SEKRETARIS',
  'ADMIN_SISTEM',
  'BENDAHARA',
];
