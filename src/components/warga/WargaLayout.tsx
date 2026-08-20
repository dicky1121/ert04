import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  Home,
  KeyRound,
  LayoutGrid,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Store,
  User,
  Wallet,
  X,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { CurrentUser, KonfigurasiPublik, PengumumanPublik, RTConfig, StatistikPublik } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { authService, isWeakPin } from '../../services/authService';
import { BekasiLogo } from '../BekasiLogo';
import { PublicSuratForm } from '../PublicSuratForm';
import { LacakPengajuanModal } from '../LacakPengajuanModal';
import { PengaduanWargaModal } from '../PengaduanWargaModal';
import { EWSLaporanModal } from '../EWSLaporanModal';
import { DaftarWargaModal } from '../DaftarWargaModal';
import { WargaDashboard, WargaQuickAction } from './WargaDashboard';

interface WargaLayoutProps {
  currentUser: CurrentUser;
  config: RTConfig;
  onLogout: () => void;
}

type WargaTab = 'beranda' | 'layanan' | 'kegiatan' | 'umkm' | 'keuangan' | 'profil';

const NAV: { key: WargaTab; label: string; icon: LucideIcon }[] = [
  { key: 'beranda', label: 'Beranda', icon: Home },
  { key: 'layanan', label: 'Layanan', icon: LayoutGrid },
  { key: 'kegiatan', label: 'Kegiatan', icon: CalendarDays },
  { key: 'umkm', label: 'UMKM', icon: Store },
  { key: 'keuangan', label: 'Keuangan', icon: Wallet },
  { key: 'profil', label: 'Profil', icon: User },
];

const toWhatsappNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
};

const maskNik = (nik?: string): string => {
  if (!nik || nik.length < 10) return nik || '-';
  return `${nik.slice(0, 6)}${'•'.repeat(6)}${nik.slice(-4)}`;
};

/** Panel sederhana untuk fitur yang belum aktif (diisi pada fase berikutnya). */
const SegeraHadir: React.FC<{ icon: LucideIcon; judul: string; deskripsi: string }> = ({ icon: Icon, judul, deskripsi }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
      <Icon className="h-7 w-7" />
    </span>
    <h3 className="text-base font-bold text-slate-800">{judul}</h3>
    <p className="max-w-xs text-sm text-slate-500">{deskripsi}</p>
    <span className="mt-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Segera Hadir</span>
  </div>
);

/** Modal ganti PIN warga (6 angka). */
const GantiPinModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!/^[0-9]{6}$/.test(pin)) return setErr('PIN baru harus tepat 6 angka.');
    if (isWeakPin(pin)) return setErr('PIN terlalu mudah ditebak (hindari 123456, 000000, dst).');
    if (pin !== pin2) return setErr('Konfirmasi PIN tidak sama.');
    setBusy(true);
    const res = await authService.changePin(pin);
    setBusy(false);
    if (!res.success) return setErr(res.message);
    setOk(res.message);
    setPin('');
    setPin2('');
    setTimeout(onClose, 1200);
  };

  const inputCls =
    'w-full p-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 tracking-[0.3em] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40';

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 bg-emerald-600">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <h2 className="flex-1 text-base font-bold text-white">Ganti PIN</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500">Buat PIN baru 6 angka. Jangan gunakan angka berurutan/berulang.</p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Baru</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className={inputCls + ' pr-10'}
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600" aria-label="Tampilkan PIN">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ulangi PIN Baru</label>
            <input
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className={inputCls}
            />
          </div>
          {err && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{err}</span>
            </div>
          )}
          {ok && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> <span>{ok}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Simpan PIN Baru
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * Shell dashboard warga (mobile-first, bottom navigation). Beranda & Layanan
 * memakai ulang modal Sapa Warga; Kegiatan/UMKM/Keuangan menyusul (Fase B/C).
 */
export const WargaLayout: React.FC<WargaLayoutProps> = ({ currentUser, config, onLogout }) => {
  const [tab, setTab] = useState<WargaTab>('beranda');
  const [konfig, setKonfig] = useState<KonfigurasiPublik | null>(null);
  const [statistik, setStatistik] = useState<StatistikPublik | null>(null);
  const [pengumuman, setPengumuman] = useState<PengumumanPublik[]>([]);

  // Modal layanan
  const [openSurat, setOpenSurat] = useState(false);
  const [openLacak, setOpenLacak] = useState(false);
  const [openPengaduan, setOpenPengaduan] = useState(false);
  const [openPerbarui, setOpenPerbarui] = useState(false);
  const [openEWS, setOpenEWS] = useState(false);
  const [openGantiPin, setOpenGantiPin] = useState(false);

  const isNativeApp = Capacitor.isNativePlatform();

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const [k, s, p] = await Promise.all([
        supabaseService.fetchKonfigurasiPublik(),
        supabaseService.fetchStatistikPublik(),
        supabaseService.fetchPengumumanPublik(),
      ]);
      if (!aktif) return;
      setKonfig(k);
      setStatistik(s);
      setPengumuman(p);
    })();
    return () => {
      aktif = false;
    };
  }, []);

  const rt = konfig?.namaRT || config.namaRT || '004';
  const rw = konfig?.namaRW || config.namaRW || '007';
  const kontak = konfig?.kontakSekretariat || konfig?.kontakRT || config.kontakSekretariat || config.kontakRT || '';
  const alamat =
    konfig?.alamatSekretariat || config.alamatSekretariat || 'Sekretariat RT 004 RW 007, Kelurahan Jatimulya';
  const email = konfig?.emailRT || config.emailRT || '';
  const jamPelayanan = konfig?.jamPelayanan || '';
  const whatsappNumber = toWhatsappNumber(kontak);
  const whatsappHref = (msg: string) =>
    whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}` : undefined;

  const hubungiHref = whatsappHref(`Halo Pengurus RT ${rt} RW ${rw}, saya ${currentUser.nama} ingin menanyakan layanan warga.`);

  // Daftar layanan (dipakai di tab Layanan + subset untuk Akses Cepat Beranda).
  type Svc = { key: string; icon: LucideIcon; title: string; desc: string; accent: string; onClick?: () => void; href?: string };
  const services: Svc[] = useMemo(() => {
    const list: Svc[] = [
      { key: 'surat', icon: FileText, title: 'Ajukan Surat Pengantar', desc: 'Kirim permohonan surat pengantar ke pengurus.', accent: 'bg-emerald-50 text-emerald-700', onClick: () => setOpenSurat(true) },
      { key: 'perbarui', icon: RefreshCw, title: 'Perbarui Data Saya', desc: 'Ajukan perubahan data kependudukan Anda — ditinjau pengurus.', accent: 'bg-teal-50 text-teal-700', onClick: () => setOpenPerbarui(true) },
      { key: 'lacak', icon: Search, title: 'Lacak Status Pengajuan', desc: 'Pantau perkembangan surat dengan NIK & nomor referensi.', accent: 'bg-blue-50 text-blue-700', onClick: () => setOpenLacak(true) },
      { key: 'pengaduan', icon: Megaphone, title: 'Lapor & Pengaduan', desc: 'Laporkan keluhan lingkungan: keamanan, kebersihan, fasilitas.', accent: 'bg-rose-50 text-rose-700', onClick: () => setOpenPengaduan(true) },
      { key: 'hubungi', icon: MessageCircle, title: 'Hubungi Pengurus', desc: 'Konsultasi layanan lewat WhatsApp resmi.', accent: 'bg-amber-50 text-amber-700', href: hubungiHref },
    ];
    if (isNativeApp) {
      list.push({ key: 'ews', icon: Siren, title: 'Lapor Darurat', desc: 'Kirim peringatan darurat ke seluruh warga RT.', accent: 'bg-rose-100 text-rose-700', onClick: () => setOpenEWS(true) });
    }
    return list;
  }, [hubungiHref, isNativeApp]);

  const quickActions: WargaQuickAction[] = useMemo(() => {
    const qa: WargaQuickAction[] = [
      { key: 'surat', icon: FileText, title: 'Surat', accent: 'bg-emerald-50 text-emerald-700', onClick: () => setOpenSurat(true) },
      { key: 'lacak', icon: Search, title: 'Lacak', accent: 'bg-blue-50 text-blue-700', onClick: () => setOpenLacak(true) },
      { key: 'pengaduan', icon: Megaphone, title: 'Pengaduan', accent: 'bg-rose-50 text-rose-700', onClick: () => setOpenPengaduan(true) },
    ];
    if (isNativeApp) {
      qa.push({ key: 'ews', icon: Siren, title: 'Darurat', accent: 'bg-rose-100 text-rose-700', onClick: () => setOpenEWS(true) });
    } else {
      qa.push({ key: 'layanan', icon: LayoutGrid, title: 'Layanan', accent: 'bg-slate-100 text-slate-600', onClick: () => setTab('layanan') });
    }
    return qa;
  }, [isNativeApp]);

  const renderContent = () => {
    switch (tab) {
      case 'beranda':
        return (
          <WargaDashboard
            nama={currentUser.nama}
            rt={rt}
            rw={rw}
            statistik={statistik}
            pengumuman={pengumuman}
            quickActions={quickActions}
          />
        );
      case 'layanan':
        return (
          <div className="space-y-3">
            <h1 className="text-lg font-black tracking-tight text-slate-900 px-0.5">Layanan Warga</h1>
            {!whatsappNumber && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-800">
                Nomor layanan belum tersedia. Beberapa aksi kontak mungkin nonaktif.
              </p>
            )}
            {services.map((svc) => {
              const Icon = svc.icon;
              const inner = (
                <>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${svc.accent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">{svc.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{svc.desc}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                </>
              );
              const cls = 'group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-slate-300 hover:shadow-md active:scale-[.99]';
              return svc.onClick ? (
                <button key={svc.key} type="button" onClick={svc.onClick} className={cls}>
                  {inner}
                </button>
              ) : svc.href ? (
                <a key={svc.key} href={svc.href} target="_blank" rel="noreferrer" className={cls}>
                  {inner}
                </a>
              ) : (
                <div key={svc.key} className={cls + ' opacity-60'} title="Kontak belum tersedia">
                  {inner}
                </div>
              );
            })}

            {/* Kontak & Info Sekretariat (paritas Sapa Warga) */}
            <section className="mt-2 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Building2 className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-bold text-slate-800">Info Sekretariat</h2>
              </div>
              <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex gap-2.5 rounded-2xl bg-slate-50 p-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Alamat</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-slate-700">{alamat}</dd>
                  </div>
                </div>
                <div className="flex gap-2.5 rounded-2xl bg-slate-50 p-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Waktu Pelayanan</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                      {jamPelayanan || 'Hubungi pengurus untuk konfirmasi jadwal pelayanan.'}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-2.5 rounded-2xl bg-slate-50 p-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Kontak Resmi</dt>
                    <dd className="mt-0.5 text-xs leading-relaxed text-slate-700">{kontak || 'Belum tersedia'}</dd>
                  </div>
                </div>
                <div className="flex gap-2.5 rounded-2xl bg-slate-50 p-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</dt>
                    <dd className="mt-0.5 break-all text-xs leading-relaxed text-slate-700">{email || 'Belum tersedia'}</dd>
                  </div>
                </div>
              </dl>
            </section>
          </div>
        );
      case 'kegiatan':
        return <SegeraHadir icon={CalendarDays} judul="Kegiatan RT" deskripsi="Jadwal kegiatan, kerja bakti, dan acara lingkungan akan tampil di sini." />;
      case 'umkm':
        return <SegeraHadir icon={Store} judul="UMKM Warga" deskripsi="Etalase produk & jasa warga RT 004. Pesan langsung lewat WhatsApp — segera hadir." />;
      case 'keuangan':
        return <SegeraHadir icon={Wallet} judul="Keuangan RT" deskripsi="Ringkasan kas RT: pemasukan, pengeluaran, dan saldo bulanan secara transparan." />;
      case 'profil':
        return (
          <div className="space-y-4">
            <h1 className="text-lg font-black tracking-tight text-slate-900 px-0.5">Profil Saya</h1>
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-black text-white">
                  {(currentUser.nama || 'W').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{currentUser.nama}</p>
                  <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    <ShieldCheck className="h-3 w-3" /> Akun Aktif
                  </span>
                </div>
              </div>
              <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">NIK</dt>
                  <dd className="font-mono font-semibold text-slate-800">{maskNik(currentUser.nik)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-slate-500">No. WhatsApp</dt>
                  <dd className="font-semibold text-slate-800">{currentUser.nomorHp || '-'}</dd>
                </div>
              </dl>
            </div>

            <button
              type="button"
              onClick={() => setOpenGantiPin(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <KeyRound className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-slate-900">Ganti PIN</span>
                <span className="text-xs text-slate-500">Perbarui PIN 6 angka Anda</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>

            <p className="pt-2 text-center text-[11px] text-slate-400">
              Portal Warga RT {rt} RW {rw} · E-RT 2026
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-lg pt-safe">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1">
            <BekasiLogo className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-tight text-slate-900">Portal Warga RT {rt} RW {rw}</p>
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Kelurahan Jatimulya</p>
          </div>
        </div>
      </header>

      {/* Konten */}
      <main className="mx-auto max-w-2xl px-4 py-5 pb-28">{renderContent()}</main>

      {/* Bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-lg pb-safe">
        <div className="mx-auto grid max-w-2xl grid-cols-6">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex flex-col items-center gap-0.5 py-2.5 transition ${active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
                <span className="text-[10px] font-bold leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals layanan (dipakai ulang dari Sapa Warga) */}
      {openSurat && <PublicSuratForm onClose={() => setOpenSurat(false)} />}
      {openLacak && <LacakPengajuanModal onClose={() => setOpenLacak(false)} />}
      {openPengaduan && <PengaduanWargaModal onClose={() => setOpenPengaduan(false)} />}
      {openPerbarui && <DaftarWargaModal mode="publik" onClose={() => setOpenPerbarui(false)} />}
      {isNativeApp && <EWSLaporanModal isOpen={openEWS} onClose={() => setOpenEWS(false)} />}
      {openGantiPin && <GantiPinModal onClose={() => setOpenGantiPin(false)} />}
    </div>
  );
};

export default WargaLayout;
