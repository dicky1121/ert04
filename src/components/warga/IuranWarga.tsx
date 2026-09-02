import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Coins,
  Eye,
  Info,
  Loader2,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { PengaturanIuran, TagihanIuran } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { formatRupiah, namaBulan, formatTanggalRingkas } from '../../utils/keuangan';
import { IURAN_LABEL, IURAN_TONE, statusBadge } from '../../utils/statusBadge';
import { container, rise, tapScale } from './motionPresets';

const MAX_BUKTI = 2 * 1024 * 1024; // sinkron dgn batas bucket `bukti-bayar` di SQL

const hariIni = (): string => new Date().toISOString().slice(0, 10);

/**
 * Tab "Iuran Saya" pada dashboard warga.
 *
 * Warga hanya melihat tagihannya sendiri (difilter RLS `warga_id = my_warga_id()`),
 * dan satu-satunya perubahan yang boleh ia lakukan adalah melampirkan bukti bayar
 * — yang otomatis memindahkan status BELUM_LUNAS/DITOLAK → MENUNGGU_VERIFIKASI.
 * Keputusan lunas/ditolak sepenuhnya di tangan pengurus (ditegakkan trigger
 * `iuran_guard()`), jadi tak ada kontrol status apa pun di layar ini.
 */
export const IuranWarga: React.FC = () => {
  const reduce = useReducedMotion() ?? false;
  const [list, setList] = useState<TagihanIuran[]>([]);
  const [pengaturan, setPengaturan] = useState<PengaturanIuran | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [buktiBusyId, setBuktiBusyId] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetIdRef = useRef<string | null>(null);
  const pesanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tampilkanPesan = (text: string, tone: 'ok' | 'err') => {
    setPesan({ text, tone });
    if (pesanTimerRef.current) clearTimeout(pesanTimerRef.current);
    pesanTimerRef.current = setTimeout(() => setPesan(null), 5000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tagihan, setelan] = await Promise.all([
        supabaseService.fetchIuranSaya(),
        supabaseService.fetchPengaturanIuran(),
      ]);
      setList(Array.isArray(tagihan.data) ? tagihan.data : []);
      if (tagihan.error) setError(tagihan.error);
      if (setelan.data) setPengaturan(setelan.data);
    } catch (err) {
      setList([]);
      setError(`Gagal memuat iuran: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Realtime — status berubah sendiri begitu pengurus memverifikasi.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeIuranRealtime(() => { void loadData(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch {
      /* realtime opsional — abaikan bila gagal */
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadData]);

  useEffect(() => () => { if (pesanTimerRef.current) clearTimeout(pesanTimerRef.current); }, []);

  const rekap = useMemo(() => {
    let belumDibayar = 0;
    let jumlahBelum = 0;
    let sudahLunas = 0;
    let menunggu = 0;
    for (const t of list) {
      if (t.status === 'BELUM_LUNAS' || t.status === 'DITOLAK') {
        belumDibayar += t.jumlah;
        jumlahBelum += 1;
      }
      if (t.status === 'LUNAS') sudahLunas += 1;
      if (t.status === 'MENUNGGU_VERIFIKASI') menunggu += 1;
    }
    return { belumDibayar, jumlahBelum, sudahLunas, menunggu };
  }, [list]);

  // ── unggah bukti ───────────────────────────────────────────────────────────
  const pilihBerkas = (id: string) => {
    targetIdRef.current = id;
    if (fileRef.current) {
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const handleBerkasDipilih = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = targetIdRef.current;
    e.target.value = '';
    targetIdRef.current = null;
    if (!file || !id) return;

    // Divalidasi di sini juga supaya warga dapat pesan jelas sebelum upload
    // (bucket & service hanya menolak setelah berkas terkirim).
    if (!file.type.startsWith('image/')) {
      tampilkanPesan('Bukti harus berupa gambar (JPG atau PNG).', 'err');
      return;
    }
    if (file.size > MAX_BUKTI) {
      tampilkanPesan('Ukuran gambar maksimal 2 MB. Coba kompres dulu.', 'err');
      return;
    }

    setUploadingId(id);
    const result = await supabaseService.unggahBuktiIuran(id, file);
    setUploadingId(null);
    if (result.success) {
      tampilkanPesan('Bukti terkirim. Menunggu diperiksa pengurus.', 'ok');
      await loadData();
    } else {
      tampilkanPesan(result.error || 'Gagal mengunggah bukti.', 'err');
    }
  };

  // Bucket bukti bersifat privat: URL-nya dibuat sesaat (berlaku 1 jam) hanya
  // ketika warga menekan "Lihat bukti".
  const lihatBukti = async (t: TagihanIuran) => {
    if (!t.buktiPath) return;
    setBuktiBusyId(t.id);
    const url = await supabaseService.buktiSignedUrl(t.buktiPath);
    setBuktiBusyId(null);
    if (url) window.open(url, '_blank', 'noopener');
    else tampilkanPesan('Bukti tidak dapat dibuka. Coba lagi sebentar.', 'err');
  };

  const tombolUnggahCls =
    'inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60';
  const tautanBuktiCls =
    'inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 transition hover:text-emerald-800 disabled:opacity-50';

  return (
    <motion.div
      variants={container}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className="space-y-4"
    >
      {/* Satu input berkas dipakai bersama semua baris */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleBerkasDipilih}
        className="hidden"
      />

      <motion.div variants={rise} className="flex items-center justify-between px-0.5">
        <h1 className="text-lg font-black tracking-tight text-slate-900">Iuran Saya</h1>
        <motion.button
          onClick={loadData}
          disabled={isLoading}
          whileTap={reduce ? undefined : tapScale}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Segarkan
        </motion.button>
      </motion.div>

      {pesan && (
        <div
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
            pesan.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {pesan.tone === 'ok'
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1 font-medium">{pesan.text}</span>
          <button
            type="button"
            onClick={() => setPesan(null)}
            aria-label="Tutup pesan"
            className="shrink-0 opacity-60 transition hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero total belum dibayar */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-violet-700 p-5 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-violet-100/90">Total Belum Dibayar</p>
        <p className="mt-1 text-3xl font-black">{formatRupiah(rekap.belumDibayar)}</p>
        <p className="mt-1 text-xs text-violet-100/80">
          {rekap.jumlahBelum > 0
            ? `${rekap.jumlahBelum} tagihan menunggu pembayaran Anda`
            : list.length > 0 ? 'Semua iuran Anda sudah beres 🎉' : 'Belum ada tagihan untuk Anda'}
        </p>
        {(rekap.menunggu > 0 || rekap.sudahLunas > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rekap.menunggu > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
                <Clock3 className="h-3 w-3" /> {rekap.menunggu} diperiksa
              </span>
            )}
            {rekap.sudahLunas > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
                <CheckCircle2 className="h-3 w-3" /> {rekap.sudahLunas} lunas
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cara bayar dari setelan pengurus */}
      {pengaturan && ((pengaturan.metodePembayaran ?? []).length > 0 || pengaturan.infoPembayaran) && (
        <motion.section variants={rise} className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Info className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-800">Cara Pembayaran</h2>
          </div>

          {/* Daftar metode pembayaran (kartu per metode) */}
          {(pengaturan.metodePembayaran ?? []).length > 0 && (
            <div className="space-y-2">
              {(pengaturan.metodePembayaran ?? []).map(m => (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">{m.label}</p>
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{m.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info teks bebas tambahan */}
          {pengaturan.infoPembayaran && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
              {pengaturan.infoPembayaran}
            </p>
          )}
        </motion.section>
      )}

      {/* Daftar tagihan */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-14 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Memuat tagihan iuran…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
            <Coins className="h-7 w-7" />
          </span>
          <h3 className="text-base font-bold text-slate-800">Belum ada tagihan</h3>
          <p className="max-w-xs text-sm text-slate-500">
            Tagihan iuran akan muncul di sini begitu pengurus menerbitkannya untuk Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(t => {
            const tone = IURAN_TONE[t.status];
            const terlambat = t.status === 'BELUM_LUNAS' && !!t.jatuhTempo && t.jatuhTempo < hariIni();
            const perluBayar = t.status === 'BELUM_LUNAS' || t.status === 'DITOLAK';
            const sedangUnggah = uploadingId === t.id;

            return (
              <motion.article key={t.id} variants={rise} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900">{t.judul}</h3>
                    <p className="text-xs text-slate-500">{namaBulan(t.periode)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusBadge(tone)}`}>
                    {IURAN_LABEL[t.status]}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                  <p className="text-xl font-black text-slate-900">{formatRupiah(t.jumlah)}</p>
                  {t.jatuhTempo && (
                    <p className={`text-[11px] font-semibold ${terlambat ? 'text-rose-600' : 'text-slate-400'}`}>
                      {terlambat ? 'Terlambat sejak ' : 'Jatuh tempo '}
                      {formatTanggalRingkas(t.jatuhTempo)}
                    </p>
                  )}
                </div>

                {t.status === 'DITOLAK' && t.catatan && (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <p className="text-xs leading-relaxed text-rose-700">
                      <span className="font-bold">Bukti ditolak:</span> {t.catatan}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  {perluBayar ? (
                    <>
                      <span className="text-xs text-slate-500">
                        {t.status === 'DITOLAK' ? 'Silakan unggah bukti yang benar.' : 'Sudah bayar? Kirim buktinya.'}
                      </span>
                      <button
                        type="button"
                        onClick={() => pilihBerkas(t.id)}
                        disabled={sedangUnggah}
                        className={tombolUnggahCls}
                      >
                        {sedangUnggah
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Upload className="h-3.5 w-3.5" />}
                        {sedangUnggah ? 'Mengunggah…' : t.status === 'DITOLAK' ? 'Unggah Ulang' : 'Unggah Bukti'}
                      </button>
                    </>
                  ) : t.status === 'MENUNGGU_VERIFIKASI' ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                        <Clock3 className="h-3.5 w-3.5" /> Menunggu diperiksa pengurus
                      </span>
                      {t.buktiPath && (
                        <button
                          type="button"
                          onClick={() => lihatBukti(t)}
                          disabled={buktiBusyId === t.id}
                          className={tautanBuktiCls}
                        >
                          {buktiBusyId === t.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Eye className="h-3.5 w-3.5" />}
                          Lihat bukti
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Lunas
                        {t.verifiedAt && ` · ${formatTanggalRingkas(String(t.verifiedAt).slice(0, 10))}`}
                      </span>
                      {t.buktiPath && (
                        <button
                          type="button"
                          onClick={() => lihatBukti(t)}
                          disabled={buktiBusyId === t.id}
                          className={tautanBuktiCls}
                        >
                          {buktiBusyId === t.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Eye className="h-3.5 w-3.5" />}
                          Lihat bukti
                        </button>
                      )}
                    </>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
