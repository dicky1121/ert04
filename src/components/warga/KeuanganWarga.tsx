import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { TransaksiKeuangan } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { formatRupiah, hitungRingkasan, namaBulan, formatTanggalRingkas } from '../../utils/keuangan';

/**
 * Tab Keuangan pada dashboard warga — READ-ONLY.
 * Menampilkan ringkasan kas RT (saldo, total pemasukan/pengeluaran),
 * rekap per bulan, dan daftar transaksi. Warga tidak bisa mengubah apa pun;
 * pencatatan dilakukan pengurus keuangan lewat panel admin.
 */
export const KeuanganWarga: React.FC = () => {
  const [list, setList] = useState<TransaksiKeuangan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBulan, setFilterBulan] = useState<string>('SEMUA');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseService.fetchKeuangan();
      setList(Array.isArray(data) ? data : []);
      if (fetchError) setError(fetchError);
    } catch (err) {
      setList([]);
      setError(`Gagal memuat keuangan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeKeuanganRealtime(() => { void loadData(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch {
      /* realtime opsional — abaikan bila gagal */
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadData]);

  const ringkasan = useMemo(() => hitungRingkasan(list), [list]);
  const bulanOpsi = ringkasan.perBulan.map(b => b.bulan);

  const filtered = filterBulan === 'SEMUA'
    ? list
    : list.filter(t => t.bulanKas === filterBulan);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-0.5">
        <h1 className="text-lg font-black tracking-tight text-slate-900">Keuangan RT</h1>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Segarkan
        </button>
      </div>

      {/* Saldo hero */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-100/90">Saldo Kas RT</p>
        <p className="mt-1 text-3xl font-black">{formatRupiah(ringkasan.saldo)}</p>
        <p className="mt-1 text-xs text-emerald-100/80">Transparansi kas warga RT 004</p>
      </div>

      {/* Masuk / Keluar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pemasukan</span>
          </div>
          <p className="text-base font-black text-emerald-600">{formatRupiah(ringkasan.totalMasuk)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-rose-600" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Pengeluaran</span>
          </div>
          <p className="text-base font-black text-rose-600">{formatRupiah(ringkasan.totalKeluar)}</p>
        </div>
      </div>

      {/* Rekap per bulan */}
      {ringkasan.perBulan.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-bold text-slate-800">Rekap per Bulan</h2>
          <div className="space-y-2.5">
            {ringkasan.perBulan.map(b => (
              <div key={b.bulan} className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-700">{namaBulan(b.bulan)}</span>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="text-emerald-600">+{formatRupiah(b.masuk)}</span>
                  <span className="text-rose-600">−{formatRupiah(b.keluar)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter bulan */}
      {bulanOpsi.length > 0 && (
        <select
          value={filterBulan}
          onChange={e => setFilterBulan(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none"
        >
          <option value="SEMUA">Semua bulan</option>
          {bulanOpsi.map(b => (
            <option key={b} value={b}>{namaBulan(b)}</option>
          ))}
        </select>
      )}

      {/* Daftar transaksi */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Memuat data keuangan…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Wallet className="h-7 w-7" />
          </span>
          <h3 className="text-base font-bold text-slate-800">Belum ada transaksi</h3>
          <p className="max-w-xs text-sm text-slate-500">
            Catatan kas RT akan tampil di sini setelah pengurus keuangan mencatat pemasukan atau pengeluaran.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          {filtered.map(t => {
            const isMasuk = t.jenis === 'MASUK';
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  isMasuk ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {isMasuk ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{t.kategori}</p>
                  {t.keterangan && <p className="truncate text-xs text-slate-500">{t.keterangan}</p>}
                  <p className="text-[11px] text-slate-400">{formatTanggalRingkas(t.tanggal)}</p>
                </div>
                <p className={`shrink-0 text-sm font-black ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isMasuk ? '+' : '−'}{formatRupiah(t.jumlah)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
