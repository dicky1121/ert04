import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck
} from 'lucide-react';
import { KonfigurasiPublik, PengumumanPublik, RTConfig, StatistikPublik } from '../types';
import { supabaseService } from '../services/supabaseService';
import { BekasiLogo } from './BekasiLogo';
import { PublicSuratForm } from './PublicSuratForm';
import { LacakPengajuanModal } from './LacakPengajuanModal';
import { PengaduanWargaModal } from './PengaduanWargaModal';


interface SapaWargaProps {
  config: RTConfig;
  onOpenLogin: () => void;
}

const toWhatsappNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
};

const kategoriPengumumanClasses: Record<string, string> = {
  DARURAT: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
  KEAMANAN: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  KESEHATAN: 'bg-teal-500/15 text-teal-200 border-teal-400/30',
  KEGIATAN: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
  IURAN: 'bg-violet-500/15 text-violet-200 border-violet-400/30',
  UMUM: 'bg-white/10 text-slate-200 border-white/15'
};

const formatTanggalSingkat = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const SapaWarga: React.FC<SapaWargaProps> = ({ config, onOpenLogin }) => {
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isPengaduanOpen, setIsPengaduanOpen] = useState(false);
  const [konfigurasiPublik, setKonfigurasiPublik] = useState<KonfigurasiPublik | null>(null);
  const [statistik, setStatistik] = useState<StatistikPublik | null>(null);
  const [pengumuman, setPengumuman] = useState<PengumumanPublik[]>([]);

  // Portal publik dibuka tanpa login, jadi kontak/pengumuman/statistik diambil
  // lewat fungsi RPC khusus publik. Bila Supabase belum dikonfigurasi, seluruh
  // pemanggilan mengembalikan nilai kosong dan halaman jatuh ke nilai lokal.
  useEffect(() => {
    let aktif = true;

    void (async () => {
      const [konfig, stat, pengumumanList] = await Promise.all([
        supabaseService.fetchKonfigurasiPublik(),
        supabaseService.fetchStatistikPublik(),
        supabaseService.fetchPengumumanPublik()
      ]);
      if (!aktif) return;
      setKonfigurasiPublik(konfig);
      setStatistik(stat);
      setPengumuman(pengumumanList);
    })();

    return () => {
      aktif = false;
    };
  }, []);

  const rt = konfigurasiPublik?.namaRT || config.namaRT || '004';
  const rw = konfigurasiPublik?.namaRW || config.namaRW || '007';
  const kelurahan = konfigurasiPublik?.kelurahan || config.kelurahan || 'Jatimulya';
  const kecamatan = konfigurasiPublik?.kecamatan || config.kecamatan || 'Tambun Selatan';
  const kontak =
    konfigurasiPublik?.kontakSekretariat ||
    konfigurasiPublik?.kontakRT ||
    config.kontakSekretariat ||
    config.kontakRT ||
    '';
  const email = konfigurasiPublik?.emailRT || config.emailRT || '';
  const jamPelayanan = konfigurasiPublik?.jamPelayanan || '';
  const whatsappNumber = toWhatsappNumber(kontak);
  const alamat =
    konfigurasiPublik?.alamatSekretariat ||
    config.alamatSekretariat ||
    'Sekretariat RT 004 RW 007, Kelurahan Jatimulya';


  const whatsappHref = (message: string) =>
    whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}` : undefined;

  const publicServices = [
    {
      icon: FileText,
      title: 'Ajukan Surat Pengantar',
      description: 'Sampaikan kebutuhan surat kepada pengurus untuk mendapatkan arahan pengajuan.',
      href: undefined,
      action: () => setIsSubmissionOpen(true),
      accent: 'emerald'
    },
    {
      icon: Search,
      title: 'Lacak Status Pengajuan',
      description: 'Pantau perkembangan surat memakai nomor referensi dan NIK pemohon.',
      href: undefined,
      action: () => setIsTrackingOpen(true),
      accent: 'blue'
    },
    {
      icon: Megaphone,
      title: 'Lapor & Pengaduan',
      description: 'Laporkan keluhan lingkungan seperti keamanan, kebersihan, atau kerusakan fasilitas.',
      href: undefined,
      action: () => setIsPengaduanOpen(true),
      accent: 'rose'
    },
    {
      icon: MessageCircle,
      title: 'Hubungi Pengurus',
      description: 'Konsultasikan kebutuhan administrasi dan pelayanan lingkungan melalui kanal resmi.',
      href: whatsappHref(`Halo Pengurus RT ${rt} RW ${rw}, saya ingin menanyakan layanan warga.`),
      action: undefined,
      accent: 'amber'
    }
  ] as const;

  const accentClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white',
    blue: 'bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white',
    rose: 'bg-rose-50 text-rose-700 group-hover:bg-rose-600 group-hover:text-white',
    amber: 'bg-amber-50 text-amber-700 group-hover:bg-amber-500 group-hover:text-white'
  };

  const statistikCards = statistik
    ? [
        { label: 'Surat selesai bulan ini', value: statistik.suratSelesaiBulanIni },
        { label: 'Sedang diproses', value: statistik.suratDiproses },
        { label: 'Surat terbit tahun ini', value: statistik.suratTahunIni }
      ]
    : [];


  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-900 selection:bg-emerald-500 selection:text-white">
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),radial-gradient(circle_at_85%_20%,_rgba(59,130,246,0.13),_transparent_28%)]">
        <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:44px_44px]" />

        <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white p-1.5 shadow-lg">
                <BekasiLogo className="h-9 w-9 object-contain" />
              </div>
              <div className="min-w-0 text-white">
                <p className="truncate text-sm font-extrabold tracking-tight sm:text-base">RT {rt} RW {rw} Kelurahan {kelurahan}</p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300 sm:text-xs">
                  Kecamatan {kecamatan} · Kabupaten Bekasi
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-xs font-bold text-white transition hover:border-emerald-400/50 hover:bg-white/15 sm:px-4 sm:text-sm"
            >
              <LockKeyhole className="h-4 w-4 text-emerald-300" />
              <span className="hidden sm:inline">Masuk sebagai</span> Pengurus
            </button>
          </div>
        </header>

        <main id="konten-utama" className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <section className="grid items-center gap-10 lg:grid-cols-[1.12fr_.88fr] lg:gap-16">
            <div className="text-white">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Portal Layanan Resmi Lingkungan
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Halo, Warga!
                <span className="mt-2 block bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
                  Ada yang bisa kami bantu?
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-sm font-medium leading-7 text-slate-300 sm:text-base">
                Selamat datang di Sapa Warga RT {rt} RW {rw}. Temukan jalur cepat untuk kebutuhan surat pengantar,
                informasi pelayanan, dan komunikasi resmi bersama pengurus lingkungan.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Pelayanan transparan
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-sky-400" /> Data administrasi terlindungi
                </span>
              </div>

              {statistikCards.length > 0 && (
                <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                  {statistikCards.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                      <dd className="text-2xl font-black tracking-tight text-white">{item.value}</dd>
                      <dt className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
                        {item.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              )}

            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white p-5 shadow-2xl shadow-black/30 sm:p-7">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-600">Layanan Warga</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Pilih kebutuhan Anda</h2>
                </div>
                <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-600">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3">
                {publicServices.map((service) => {
                  const Icon = service.icon;
                  const content = (
                    <>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${accentClasses[service.accent]}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold text-slate-900">{service.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{service.description}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
                    </>
                  );

                  return service.action ? (
                    <button
                      type="button"
                      key={service.title}
                      onClick={service.action}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                    >
                      {content}
                    </button>
                  ) : service.href ? (
                    <a
                      key={service.title}
                      href={service.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={service.title} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5 opacity-70" title="Kontak pengurus belum tersedia">
                      {content}
                    </div>
                  );
                })}
              </div>

              {!whatsappNumber && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                  Nomor layanan belum tersedia. Silakan datang langsung ke sekretariat.
                </p>
              )}
            </div>
          </section>

          {pengumuman.length > 0 && (
            <section aria-labelledby="pengumuman-title" className="mt-12 border-t border-white/10 pt-8">
              <div className="mb-4 flex items-center gap-2 text-white">
                <Megaphone className="h-5 w-5 text-emerald-300" />
                <h2 id="pengumuman-title" className="text-lg font-black tracking-tight">
                  Pengumuman Lingkungan
                </h2>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pengumuman.map((item) => {
                  const badgeClass =
                    kategoriPengumumanClasses[String(item.kategori).toUpperCase()] || kategoriPengumumanClasses.UMUM;
                  const periode = [formatTanggalSingkat(item.tanggalMulai), formatTanggalSingkat(item.tanggalSelesai)]
                    .filter(Boolean)
                    .join(' – ');

                  return (
                    <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                          {String(item.kategori).toUpperCase()}
                        </span>
                        {periode && <span className="text-[10px] font-semibold text-slate-400">{periode}</span>}
                      </div>
                      <h3 className="mt-2.5 text-sm font-extrabold leading-snug text-white">{item.judul}</h3>
                      <p className="mt-1.5 whitespace-pre-line text-[11px] leading-relaxed text-slate-300">{item.isi}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-12 grid gap-3 border-t border-white/10 pt-8 text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div><p className="text-xs font-bold text-white">Sekretariat</p><p className="mt-1 text-[11px] leading-relaxed">{alamat}</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
              <div><p className="text-xs font-bold text-white">Waktu Pelayanan</p><p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed">{jamPelayanan || 'Hubungi pengurus untuk konfirmasi jadwal pelayanan.'}</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div><p className="text-xs font-bold text-white">Kontak Resmi</p><p className="mt-1 text-[11px] leading-relaxed">{kontak || 'Belum tersedia'}</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
              <div><p className="text-xs font-bold text-white">Email</p><p className="mt-1 break-all text-[11px] leading-relaxed">{email || 'Belum tersedia'}</p></div>
            </div>
          </section>
        </main>

        <footer className="relative z-10 border-t border-white/10 px-4 py-5 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} RT {rt} RW {rw} Kelurahan {kelurahan}. Portal publik tidak menampilkan data pribadi warga.
        </footer>
        {isSubmissionOpen && <PublicSuratForm onClose={() => setIsSubmissionOpen(false)} />}
        {isTrackingOpen && <LacakPengajuanModal onClose={() => setIsTrackingOpen(false)} />}
        {isPengaduanOpen && <PengaduanWargaModal onClose={() => setIsPengaduanOpen(false)} />}
      </div>
    </div>
  );
};

export default SapaWarga;