import React from 'react';
import { ArrowRight, Megaphone, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PengumumanPublik, StatistikPublik } from '../../types';

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
}

const kategoriBadge: Record<string, string> = {
  DARURAT: 'bg-rose-100 text-rose-700 border-rose-200',
  KEAMANAN: 'bg-amber-100 text-amber-700 border-amber-200',
  KESEHATAN: 'bg-teal-100 text-teal-700 border-teal-200',
  KEGIATAN: 'bg-sky-100 text-sky-700 border-sky-200',
  IURAN: 'bg-violet-100 text-violet-700 border-violet-200',
  UMUM: 'bg-slate-100 text-slate-600 border-slate-200',
};

const fmtTanggal = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const sapaan = (): string => {
  const jam = new Date().getHours();
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 19) return 'Selamat sore';
  return 'Selamat malam';
};

/** Beranda dashboard warga: sapaan, akses cepat, statistik, & pengumuman terbaru. */
export const WargaDashboard: React.FC<WargaDashboardProps> = ({
  nama,
  rt,
  rw,
  statistik,
  pengumuman,
  quickActions,
}) => {
  const namaDepan = (nama || 'Warga').split(' ')[0];

  const statistikCards = statistik
    ? [
        { label: 'Surat selesai bulan ini', value: statistik.suratSelesaiBulanIni },
        { label: 'Sedang diproses', value: statistik.suratDiproses },
        { label: 'Terbit tahun ini', value: statistik.suratTahunIni },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Sapaan */}
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-600 p-5 text-white shadow-lg shadow-emerald-900/20">
        <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> {sapaan()},
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight leading-tight">{namaDepan} 👋</h1>
        <p className="mt-1.5 text-sm text-emerald-50/90">
          Selamat datang di Portal Warga RT {rt} RW {rw}. Ada yang bisa kami bantu hari ini?
        </p>
      </div>

      {/* Akses cepat */}
      <div>
        <h2 className="text-sm font-bold text-slate-800 mb-2.5 px-0.5">Akses Cepat</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {quickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.key}
                type="button"
                onClick={qa.onClick}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-2.5 text-center transition hover:border-slate-300 hover:shadow-md active:scale-95"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${qa.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-700">{qa.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Statistik ringkas */}
      {statistikCards.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {statistikCards.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xl font-black tracking-tight text-slate-900">{s.value}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-tight text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pengumuman */}
      <div>
        <div className="mb-2.5 flex items-center gap-2 px-0.5">
          <Megaphone className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-800">Pengumuman Terbaru</h2>
        </div>
        {pengumuman.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
            Belum ada pengumuman terbaru.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {pengumuman.slice(0, 5).map((item) => {
              const badge = kategoriBadge[String(item.kategori).toUpperCase()] || kategoriBadge.UMUM;
              const periode = [fmtTanggal(item.tanggalMulai), fmtTanggal(item.tanggalSelesai)]
                .filter(Boolean)
                .join(' – ');
              return (
                <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge}`}>
                      {String(item.kategori).toUpperCase()}
                    </span>
                    {periode && <span className="text-[11px] font-semibold text-slate-400">{periode}</span>}
                  </div>
                  <h3 className="mt-2 text-sm font-bold leading-snug text-slate-900">{item.judul}</h3>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{item.isi}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-400">
        <ArrowRight className="h-3 w-3" /> Fitur lain tersedia di menu bawah
      </div>
    </div>
  );
};

export default WargaDashboard;
