import { describe, it, expect } from 'vitest';
import {
  statusBadge,
  statusDot,
  SURAT_TONE,
  SURAT_LABEL,
  PENGADUAN_TONE,
  PENGADUAN_LABEL,
  EWS_TONE,
  IURAN_TONE,
  IURAN_LABEL,
  type StatusTone,
} from './statusBadge';

const SEMUA_TONE: StatusTone[] = ['success', 'warning', 'danger', 'info', 'neutral'];

describe('statusBadge & statusDot', () => {
  it.each(SEMUA_TONE)('mengembalikan kelas pill yang berisi bg/text/border untuk tone "%s"', (tone) => {
    const kelas = statusBadge(tone);
    expect(kelas).toMatch(/bg-\S+/);
    expect(kelas).toMatch(/text-\S+/);
    expect(kelas).toMatch(/border-\S+/);
  });

  it.each(SEMUA_TONE)('mengembalikan kelas dot untuk tone "%s"', (tone) => {
    expect(statusDot(tone)).toMatch(/^bg-\S+$/);
  });

  it('setiap tone punya kelas badge & dot yang berbeda-beda (tidak duplikat)', () => {
    const badges = new Set(SEMUA_TONE.map((t) => statusBadge(t)));
    const dots = new Set(SEMUA_TONE.map((t) => statusDot(t)));
    expect(badges.size).toBe(SEMUA_TONE.length);
    expect(dots.size).toBe(SEMUA_TONE.length);
  });
});

describe('peta status domain → tone & label', () => {
  it('status surat pengantar memetakan ke tone yang sesuai', () => {
    expect(SURAT_TONE.PENDING).toBe('warning');
    expect(SURAT_TONE.DISETUJUI).toBe('success');
    expect(SURAT_TONE.DITOLAK).toBe('danger');
    expect(SURAT_LABEL.PENDING).toBe('Menunggu Proses');
  });

  it('status pengaduan warga memetakan ke tone yang sesuai', () => {
    expect(PENGADUAN_TONE.BARU).toBe('info');
    expect(PENGADUAN_TONE.SELESAI).toBe('success');
    expect(PENGADUAN_TONE.DITOLAK).toBe('danger');
    expect(PENGADUAN_LABEL.DIPROSES).toBe('Diproses');
  });

  it('status EWS memetakan ke tone yang sesuai (BARU = danger, darurat)', () => {
    expect(EWS_TONE.BARU).toBe('danger');
    expect(EWS_TONE.DITANGANI).toBe('warning');
    expect(EWS_TONE.SELESAI).toBe('success');
  });

  it('status tagihan iuran memetakan ke tone yang sesuai', () => {
    expect(IURAN_TONE.BELUM_LUNAS).toBe('warning');
    expect(IURAN_TONE.MENUNGGU_VERIFIKASI).toBe('info');
    expect(IURAN_TONE.LUNAS).toBe('success');
    expect(IURAN_TONE.DITOLAK).toBe('danger');
    expect(IURAN_LABEL.LUNAS).toBe('Lunas');
  });
});
