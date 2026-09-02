import { describe, it, expect } from 'vitest';
import { hitungRingkasan, namaBulan } from './keuangan';
import type { TransaksiKeuangan } from '../types';

const buatTransaksi = (over: Partial<TransaksiKeuangan>): TransaksiKeuangan => ({
  id: over.id ?? 't-1',
  jenis: over.jenis ?? 'MASUK',
  kategori: over.kategori ?? 'lain-lain',
  jumlah: over.jumlah ?? 0,
  keterangan: over.keterangan ?? '',
  tanggal: over.tanggal ?? '2026-08-01',
  bulanKas: over.bulanKas ?? '',
  createdAt: over.createdAt ?? '2026-08-01T00:00:00.000Z',
});

describe('hitungRingkasan', () => {
  it('menjumlahkan total masuk dan keluar secara terpisah', () => {
    const ringkasan = hitungRingkasan([
      buatTransaksi({ id: '1', jenis: 'MASUK', jumlah: 100000 }),
      buatTransaksi({ id: '2', jenis: 'MASUK', jumlah: 50000 }),
      buatTransaksi({ id: '3', jenis: 'KELUAR', jumlah: 30000 }),
    ]);

    expect(ringkasan.totalMasuk).toBe(150000);
    expect(ringkasan.totalKeluar).toBe(30000);
    expect(ringkasan.saldo).toBe(120000);
  });

  it('mengembalikan ringkasan kosong untuk daftar kosong', () => {
    const ringkasan = hitungRingkasan([]);
    expect(ringkasan).toEqual({ totalMasuk: 0, totalKeluar: 0, saldo: 0, perBulan: [] });
  });

  it('mengelompokkan transaksi per bulan dan mengurutkan terbaru dulu', () => {
    const ringkasan = hitungRingkasan([
      buatTransaksi({ id: '1', jenis: 'MASUK', jumlah: 100000, tanggal: '2026-06-15' }),
      buatTransaksi({ id: '2', jenis: 'MASUK', jumlah: 200000, tanggal: '2026-08-01' }),
      buatTransaksi({ id: '3', jenis: 'KELUAR', jumlah: 50000, tanggal: '2026-08-10' }),
    ]);

    expect(ringkasan.perBulan.map((b) => b.bulan)).toEqual(['2026-08', '2026-06']);
    const agustus = ringkasan.perBulan.find((b) => b.bulan === '2026-08');
    expect(agustus).toEqual({ bulan: '2026-08', masuk: 200000, keluar: 50000, saldo: 150000 });
  });

  it('memakai bulanKas eksplisit bila tersedia, bukan tanggal', () => {
    const ringkasan = hitungRingkasan([
      buatTransaksi({ id: '1', jenis: 'MASUK', jumlah: 75000, tanggal: '2026-08-31', bulanKas: '2026-09' }),
    ]);
    expect(ringkasan.perBulan[0].bulan).toBe('2026-09');
  });

  it('memperlakukan jumlah non-finite (NaN) sebagai 0', () => {
    const ringkasan = hitungRingkasan([
      buatTransaksi({ id: '1', jenis: 'MASUK', jumlah: NaN }),
    ]);
    expect(ringkasan.totalMasuk).toBe(0);
  });

  it('mengabaikan baris tanpa tanggal maupun bulanKas dari rekap per bulan', () => {
    const ringkasan = hitungRingkasan([
      buatTransaksi({ id: '1', jenis: 'MASUK', jumlah: 10000, tanggal: '' }),
    ]);
    expect(ringkasan.totalMasuk).toBe(10000);
    expect(ringkasan.perBulan).toEqual([]);
  });
});

describe('namaBulan', () => {
  it('mengubah YYYY-MM menjadi nama bulan lengkap berbahasa Indonesia', () => {
    expect(namaBulan('2026-08')).toBe('Agustus 2026');
    expect(namaBulan('2026-01')).toBe('Januari 2026');
    expect(namaBulan('2026-12')).toBe('Desember 2026');
  });

  it('mengembalikan tanda hubung untuk input kosong', () => {
    expect(namaBulan('')).toBe('-');
  });

  it('mengembalikan input apa adanya untuk indeks bulan di luar jangkauan', () => {
    expect(namaBulan('2026-13')).toBe('2026-13');
    expect(namaBulan('2026-00')).toBe('2026-00');
  });

  it('mengembalikan input apa adanya untuk string yang terlalu pendek', () => {
    expect(namaBulan('2026')).toBe('2026');
  });
});
