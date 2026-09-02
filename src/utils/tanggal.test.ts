import { describe, it, expect } from 'vitest';
import { formatTanggalPanjang, formatTanggalSedang, formatTanggalRingkas } from './tanggal';

describe('formatTanggalPanjang', () => {
  it('memformat YYYY-MM-DD menjadi "Hari, DD Bulan YYYY"', () => {
    // 2026-09-01 adalah hari Selasa.
    expect(formatTanggalPanjang('2026-09-01')).toBe('Selasa, 01 September 2026');
  });

  it('mengembalikan tanda hubung untuk input kosong / null / undefined', () => {
    expect(formatTanggalPanjang('')).toBe('-');
    expect(formatTanggalPanjang(null)).toBe('-');
    expect(formatTanggalPanjang(undefined)).toBe('-');
  });

  it('mengembalikan input apa adanya untuk tanggal tidak valid', () => {
    expect(formatTanggalPanjang('bukan-tanggal')).toBe('bukan-tanggal');
  });

  it('menerima string ISO penuh, bukan hanya YYYY-MM-DD', () => {
    expect(formatTanggalPanjang('2026-09-01T10:30:00.000Z')).toContain('2026');
  });
});

describe('formatTanggalSedang', () => {
  it('memformat YYYY-MM-DD menjadi "DD Bulan YYYY" tanpa nama hari', () => {
    expect(formatTanggalSedang('2026-09-01')).toBe('01 September 2026');
  });

  it('mengembalikan tanda hubung untuk input kosong / null / undefined', () => {
    expect(formatTanggalSedang('')).toBe('-');
    expect(formatTanggalSedang(null)).toBe('-');
    expect(formatTanggalSedang(undefined)).toBe('-');
  });

  it('mengembalikan input apa adanya untuk tanggal tidak valid', () => {
    expect(formatTanggalSedang('bukan-tanggal')).toBe('bukan-tanggal');
  });
});

describe('formatTanggalRingkas (re-export dari utils/keuangan)', () => {
  it('memformat YYYY-MM-DD menjadi "DD Bulan-singkat YYYY"', () => {
    expect(formatTanggalRingkas('2026-08-20')).toBe('20 Agu 2026');
  });

  it('mengembalikan tanda hubung untuk input kosong', () => {
    expect(formatTanggalRingkas('')).toBe('-');
  });
});
