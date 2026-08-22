import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  Megaphone,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion, animate, type Variants } from 'motion/react';
import { Kegiatan, PengumumanPublik, StatistikPublik } from '../../types';
import { formatRupiah } from '../../utils/keuangan';

export interface WargaQuickAction {
  key: string;
  icon: LucideIcon;
  title: string;
  accent: string; // tailwind classes untuk lingkaran ikon
  onClick: () => void;
}

interface WargaDashboardProps {
  nama: string;
  rt: string;
  rw: string;
  statistik: StatistikPublik | null;
  pengumuman: PengumumanPublik[];
  quickActions: WargaQuickAction[];
  // Ringkasan kas RT — dipindah ke Beranda (tak lagi jadi menu tersendiri).
  saldoKas: number;
  totalMasuk: number;
  totalKeluar: number;
  keuanganLoading: boolean;
  onLihatKeuangan: () => void;
  // Spotlight kegiatan terdekat.
  kegiatan: Kegiatan[];
  onLihatKegiatan: () => void;
}

// ── Warna per kategori pengumuman: aksen batang kiri + chip label ──────────
const kategoriTone: Record<string, { bar: string; chip: string }> = {
  DARURAT: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
  KEAMANAN: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  KESEHATAN: { bar: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700' },
  KEGIATAN: { bar: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
  IURAN: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700' },
  UMUM: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600' },
};

const fmtPeriode = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const chipTanggal = (ymd: string): { dd: string; mon: string } => {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { dd: '--', mon: '' };
  return {
    dd: d.toLocaleDateString('id-ID', { day: '2-digit' }),
    mon: d.toLocaleDateString('id-ID', { month: 'short' }),
  };
};

// ── Animasi masuk: kontainer men-stagger anak; tiap anak "naik" halus ──────
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 240, damping: 22, mass: 0.7 } },
};

/** Angka menghitung naik dari 0 → target saat pertama tampil. */
const useCountUp = (target: number, enabled: boolean): number => {
  const [val, setVal] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [target, enabled]);
  return val;
};

const SectionHeader: React.FC<{
  title: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, icon: Icon, actionLabel, onAction }) => (
  <div className="mb-3 flex items-center justify-between px-0.5">
    <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-slate-800">
      {Icon && <Icon className="h-4 w-4 text-emerald-600" />}
      {title}
    </h2>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 transition hover:text-emerald-700"
      >
        {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

/** Beranda dashboard warga — hero, saldo kas, akses cepat, kegiatan, pengumuman. */
export const WargaDashboard: React.FC<WargaDashboardProps> = ({
  nama,
  rt,
  rw,
  statistik,
  pengumuman,
  quickActions,
  saldoKas,
  totalMasuk,
  totalKeluar,
  keuanganLoading,
  onLihatKeuangan,
  kegiatan,
  onLihatKegiatan,
}) => {
  const reduce = useReducedMotion() ?? false;
  const namaDepan = (nama || 'Warga').split(' ')[0];
  const inisial = (nama || 'W').trim().charAt(0).toUpperCase();

  const jam = new Date().getHours();
  const { teks: sapaanTeks, Icon: GreetIcon } =
    jam < 11
      ? { teks: 'Selamat pagi', Icon: Sunrise }
      : jam < 15
        ? { teks: 'Selamat siang', Icon: Sun }
        : jam < 19
          ? { teks: 'Selamat sore', Icon: Sunset }
          : { teks: 'Selamat malam', Icon: Moon };
  const tanggalPanjang = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const saldoView = useCountUp(saldoKas, !reduce && !keuanganLoading);

  const statistikCards = statistik
    ? [
        { label: 'Selesai bulan ini', value: statistik.suratSelesaiBulanIni },
        { label: 'Sedang diproses', value: statistik.suratDiproses },
        { label: 'Terbit tahun ini', value: statistik.suratTahunIni },
      ]
    : [];

  const kegiatanTampil = useMemo(() => {
    const todayYMD = new Date().toISOString().slice(0, 10);
    const upcoming = [...kegiatan]
      .filter((k) => k.tanggal >= todayYMD)
      .sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1));
    const src = upcoming.length ? upcoming : kegiatan;
    return src.slice(0, 5);
  }, [kegiatan]);

  return (
    <motion.div
      variants={container}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className="space-y-6 pb-2"
    >
      {/* ── Hero + Saldo Kas (mengambang menimpa hero) ─────────────────── */}
      <motion.section variants={rise} className="relative">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-5 pt-5 pb-20 text-white shadow-xl shadow-emerald-900/25">
          {/* Dekorasi kedalaman */}
          <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-teal-300/25 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute right-8 top-4 h-28 w-28 rounded-full border border-white/10" />
          <div aria-hidden className="pointer-events-none absolute right-16 top-10 h-28 w-28 rounded-full border border-white/10" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50/85">
                <GreetIcon className="h-3.5 w-3.5" /> {sapaanTeks}
              </div>
              <h1 className="mt-1.5 truncate text-[26px] font-black leading-tight tracking-tight">{namaDepan} 👋</h1>
              <p className="mt-0.5 text-xs text-emerald-50/75">{tanggalPanjang}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-black ring-1 ring-white/25 backdrop-blur">
              {inisial}
            </div>
          </div>

          <p className="relative mt-3 max-w-[80%] text-[13px] leading-relaxed text-emerald-50/85">
            Portal Warga RT {rt} RW {rw} — semua layanan lingkungan dalam satu genggaman.
          </p>
        </div>

        {/* Kartu Saldo Kas — overlap fintech-style */}
        <motion.button
          type="button"
          onClick={onLihatKeuangan}
          whileTap={reduce ? undefined : { scale: 0.985 }}
          className="relative z-10 -mt-12 flex w-full flex-col rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-xl shadow-emerald-900/10 transition hover:shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <Wallet className="h-3.5 w-3.5 text-emerald-500" /> Saldo Kas RT
            </span>
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-emerald-600">
              Rincian <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>

          {keuanganLoading ? (
            <div className="mt-2 h-8 w-44 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-1 text-[28px] font-black leading-none tracking-tight text-slate-900 tabular-nums">
              {formatRupiah(Math.round(saldoView))}
            </p>
          )}

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <ArrowUpRight className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-emerald-700/70">Masuk</span>
                <span className="block truncate text-xs font-black text-emerald-700">{formatRupiah(totalMasuk)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 px-3 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <ArrowDownRight className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-rose-700/70">Keluar</span>
                <span className="block truncate text-xs font-black text-rose-700">{formatRupiah(totalKeluar)}</span>
              </span>
            </div>
          </div>
        </motion.button>
      </motion.section>

      {/* ── Akses Cepat ────────────────────────────────────────────────── */}
      <motion.section variants={rise}>
        <SectionHeader title="Akses Cepat" />
        <motion.div variants={container} className="grid grid-cols-4 gap-2.5">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <motion.button
                key={qa.key}
                type="button"
                variants={rise}
                whileTap={reduce ? undefined : { scale: 0.93 }}
                onClick={qa.onClick}
                className="group flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:ring-emerald-200"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105 ${qa.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-700">{qa.title}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </motion.section>

      {/* ── Kegiatan Terdekat (spotlight) ──────────────────────────────── */}
      {kegiatanTampil.length > 0 && (
        <motion.section variants={rise}>
          <SectionHeader title="Kegiatan Terdekat" icon={CalendarDays} actionLabel="Lihat semua" onAction={onLihatKegiatan} />
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {kegiatanTampil.map((k) => {
              const { dd, mon } = chipTanggal(k.tanggal);
              return (
                <motion.button
                  key={k.id}
                  type="button"
                  onClick={onLihatKegiatan}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  className="w-[78%] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-100"
                >
                  <div className="relative h-32 w-full bg-gradient-to-br from-emerald-500 to-teal-600">
                    {k.fotoUrl ? (
                      <img src={k.fotoUrl} alt={k.judul} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-white/40">
                        <CalendarDays className="h-10 w-10" />
                      </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute left-3 top-3 flex flex-col items-center rounded-2xl bg-white/95 px-2.5 py-1 text-center shadow-md">
                      <span className="text-base font-black leading-none text-slate-900">{dd}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">{mon}</span>
                    </div>
                    <h3 className="absolute inset-x-3 bottom-2.5 line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow-sm">
                      {k.judul}
                    </h3>
                  </div>
                  {(k.waktu || k.lokasi) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-[11px] text-slate-500">
                      {k.waktu && (
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5 text-emerald-500" /> {k.waktu}
                        </span>
                      )}
                      {k.lokasi && (
                        <span className="flex min-w-0 items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate">{k.lokasi}</span>
                        </span>
                      )}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ── Aktivitas Surat (statistik ringkas) ────────────────────────── */}
      {statistikCards.length > 0 && (
        <motion.section variants={rise}>
          <SectionHeader title="Aktivitas Surat" icon={FileText} />
          <div className="grid grid-cols-3 divide-x divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
            {statistikCards.map((s) => (
              <div key={s.label} className="px-3 py-4 text-center">
                <p className="text-2xl font-black tracking-tight text-slate-900 tabular-nums">{s.value}</p>
                <p className="mt-1 text-[10px] font-semibold leading-tight text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Pengumuman Terbaru ─────────────────────────────────────────── */}
      <motion.section variants={rise}>
        <SectionHeader title="Pengumuman Terbaru" icon={Megaphone} />
        {pengumuman.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Belum ada pengumuman terbaru.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pengumuman.slice(0, 4).map((item) => {
              const kat = String(item.kategori).toUpperCase();
              const tone = kategoriTone[kat] || kategoriTone.UMUM;
              const periode = [fmtPeriode(item.tanggalMulai), fmtPeriode(item.tanggalSelesai)]
                .filter(Boolean)
                .join(' – ');
              return (
                <div key={item.id} className="relative overflow-hidden rounded-2xl bg-white p-4 pl-5 shadow-sm ring-1 ring-slate-100">
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} />
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.chip}`}>
                      {kat}
                    </span>
                    {periode && <span className="text-[11px] font-semibold text-slate-400">{periode}</span>}
                  </div>
                  <h3 className="mt-2 text-sm font-bold leading-snug text-slate-900">{item.judul}</h3>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-slate-500">{item.isi}</p>
                </div>
              );
            })}
          </div>
        )}
      </motion.section>

      <p className="pt-1 text-center text-[11px] text-slate-400">Portal Warga RT {rt} RW {rw} · E-RT 2026</p>
    </motion.div>
  );
};

export default WargaDashboard;
