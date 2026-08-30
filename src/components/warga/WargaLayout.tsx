import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  Clock3,
  Coins,
  CreditCard,
  FileText,
  History,
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
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  CurrentUser,
  Kegiatan,
  KonfigurasiPublik,
  PengumumanPublik,
  RiwayatPengaduan,
  RiwayatSurat,
  RTConfig,
  TagihanIuran,
  TransaksiKeuangan,
  PengajuanKKInput,
} from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { authService, isWeakPin } from '../../services/authService';
import { hitungRingkasan } from '../../utils/keuangan';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { BekasiLogo } from '../BekasiLogo';
import { PublicSuratForm } from '../PublicSuratForm';
import { LacakPengajuanModal } from '../LacakPengajuanModal';
import { PengaduanWargaModal } from '../PengaduanWargaModal';
import { EWSLaporanModal } from '../EWSLaporanModal';
import { DaftarWargaModal } from '../DaftarWargaModal';
import { WargaDashboard, WargaQuickAction } from './WargaDashboard';
import { UmkmWarga } from './UmkmWarga';
import { KeuanganWarga } from './KeuanganWarga';
import { IuranWarga } from './IuranWarga';
import { RiwayatWarga } from './RiwayatWarga';

interface WargaLayoutProps {
  currentUser: CurrentUser;
  config: RTConfig;
  onLogout: () => void;
}

type WargaTab = 'beranda' | 'layanan' | 'kegiatan' | 'umkm' | 'keuangan' | 'iuran' | 'riwayat' | 'profil';

/**
 * Bottom nav tetap 5 kolom: 4 tab + satu tombol tengah menonjol (FAB) untuk
 * "Ajukan Surat" — aksi yang paling sering dipakai warga. Tab `layanan`,
 * `kegiatan`, `keuangan`, `riwayat` sengaja tidak di nav; semuanya dijangkau
 * dari grid LAYANAN / kartu statistik di Beranda.
 */
const NAV: { key: WargaTab; label: string; icon: LucideIcon }[] = [
  { key: 'beranda', label: 'Beranda', icon: Home },
  { key: 'iuran', label: 'Iuran', icon: Coins },
  { key: 'umkm', label: 'UMKM', icon: Store },
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

const formatTanggalKegiatan = (ymd: string): string => {
  if (!ymd) return '-';
  const d = new Date(`${ymd}T00:00:00`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
};

/** Tab Kegiatan (warga) — daftar kegiatan yang dipublikasikan, read-only. */
const KegiatanWargaPanel: React.FC<{ items: Kegiatan[]; loading: boolean }> = ({ items, loading }) => (
  <div className="space-y-3">
    <div className="px-0.5">
      <h1 className="text-lg font-black tracking-tight text-slate-900">Kegiatan RT</h1>
      <p className="text-sm text-slate-500">Jadwal kegiatan, kerja bakti, dan acara lingkungan.</p>
    </div>

    {loading ? (
      <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Memuat kegiatan…</span>
      </div>
    ) : items.length === 0 ? (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CalendarDays className="h-7 w-7" />
        </span>
        <h3 className="text-base font-bold text-slate-800">Belum ada kegiatan</h3>
        <p className="max-w-xs text-sm text-slate-500">Kegiatan yang dijadwalkan pengurus akan tampil di sini.</p>
      </div>
    ) : (
      <div className="space-y-3">
        {items.map(k => (
          <article key={k.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {k.fotoUrl && (
              <div className="h-40 w-full overflow-hidden bg-slate-100">
                <img src={k.fotoUrl} alt={k.judul} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="space-y-2.5 px-4 py-3.5">
              <h3 className="text-base font-bold leading-snug text-slate-900">{k.judul}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
                  {formatTanggalKegiatan(k.tanggal)}
                </span>
                {k.waktu && (
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-emerald-500" />
                    {k.waktu}
                  </span>
                )}
                {k.lokasi && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                    {k.lokasi}
                  </span>
                )}
              </div>
              {k.deskripsi && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{k.deskripsi}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    )}
  </div>
);

/** Satu tab pada bottom nav (dipakai di kiri & kanan tombol FAB tengah). */
const NavButton: React.FC<{
  item: { key: WargaTab; label: string; icon: LucideIcon };
  active: boolean;
  onSelect: (key: WargaTab) => void;
}> = ({ item, active, onSelect }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      className={`flex flex-col items-center gap-0.5 py-2.5 transition ${active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={`h-5 w-5 ${active ? 'scale-110' : ''} transition-transform`} />
      <span className="text-[10px] font-bold leading-none">{item.label}</span>
    </button>
  );
};

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
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
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

/** Modal ajukan perubahan Kartu Keluarga dari portal warga. */
const PerbaruiKKModal: React.FC<{
  nomorKKSekarang?: string;
  onClose: () => void;
}> = ({ nomorKKSekarang, onClose }) => {
  const [jenis, setJenis] = useState<'UBAH_NOMOR_KK' | 'HAPUS_ANGGOTA'>('UBAH_NOMOR_KK');
  const [nomorKKBaru, setNomorKKBaru] = useState('');
  const [alasan, setAlasan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const onlyDigits = (v: string) => v.replace(/\D/g, '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (jenis === 'UBAH_NOMOR_KK') {
      if (nomorKKBaru.length !== 16) { setErr('Nomor KK baru harus 16 digit.'); return; }
    }
    if (!alasan.trim()) { setErr('Alasan wajib diisi.'); return; }

    setBusy(true);
    const input: PengajuanKKInput = {
      jenis,
      nomorKKBaru: jenis === 'UBAH_NOMOR_KK' ? nomorKKBaru : undefined,
      alasan: alasan.trim(),
    };
    const result = await supabaseService.ajukanPerubahanKK(input);
    setBusy(false);
    if (!result.success) { setErr(result.error || 'Gagal mengirim pengajuan.'); return; }
    setOk('Pengajuan terkirim. Menunggu persetujuan pengurus RT.');
    setTimeout(onClose, 1800);
  };

  const inputCls = 'w-full p-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 bg-slate-50 focus:bg-white transition';
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="flex items-center gap-3 px-5 py-4 bg-blue-600">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <h2 className="flex-1 text-base font-bold text-white">Perbarui Kartu Keluarga</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500">Pengajuan akan ditinjau pengurus sebelum diterapkan.</p>

          {/* Jenis perubahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Jenis Perubahan</label>
            <div className="grid grid-cols-2 gap-2">
              {(['UBAH_NOMOR_KK', 'HAPUS_ANGGOTA'] as const).map(j => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJenis(j)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    jenis === j
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {j === 'UBAH_NOMOR_KK' ? 'Ubah Nomor KK' : 'Hapus Anggota'}
                </button>
              ))}
            </div>
          </div>

          {/* KK saat ini */}
          {nomorKKSekarang && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <span className="text-slate-500">KK saat ini</span>
              <span className="font-mono font-semibold text-slate-800">{nomorKKSekarang}</span>
            </div>
          )}

          {/* Field UBAH_NOMOR_KK */}
          {jenis === 'UBAH_NOMOR_KK' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor KK Baru (16 digit)</label>
              <input
                type="text"
                inputMode="numeric"
                value={nomorKKBaru}
                onChange={e => setNomorKKBaru(onlyDigits(e.target.value).slice(0, 16))}
                placeholder="16 digit sesuai KK baru"
                className={inputCls + ' font-mono'}
              />
              <p className="text-xs text-slate-400 mt-1">{nomorKKBaru.length}/16 digit</p>
            </div>
          )}

          {/* Field HAPUS_ANGGOTA */}
          {jenis === 'HAPUS_ANGGOTA' && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
              <p className="font-bold mb-0.5">Catatan:</p>
              <p>Permintaan hapus anggota hanya akan diproses jika Anda adalah yang menambahkan anggota tersebut. Sebutkan nama anggota di kolom alasan.</p>
            </div>
          )}

          {/* Alasan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Alasan Perubahan</label>
            <textarea
              value={alasan}
              onChange={e => setAlasan(e.target.value)}
              placeholder="Jelaskan alasan perubahan secara singkat…"
              rows={3}
              maxLength={300}
              className={inputCls + ' resize-none'}
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
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Kirim Pengajuan
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * Shell dashboard warga (mobile-first, bottom navigation 4 tab + FAB Surat).
 * Beranda menampilkan statistik pribadi, grid LAYANAN, kas RT, kegiatan, dan
 * pengumuman; layar Layanan/Kegiatan/Kas/Riwayat dijangkau dari Beranda.
 */
export const WargaLayout: React.FC<WargaLayoutProps> = ({ currentUser, config, onLogout }) => {
  const [tab, setTab] = useState<WargaTab>('beranda');
  const [konfig, setKonfig] = useState<KonfigurasiPublik | null>(null);
  const [pengumuman, setPengumuman] = useState<PengumumanPublik[]>([]);
  const [kegiatan, setKegiatan] = useState<Kegiatan[]>([]);
  const [kegiatanLoading, setKegiatanLoading] = useState(true);
  const [keuangan, setKeuangan] = useState<TransaksiKeuangan[]>([]);
  const [keuanganLoading, setKeuanganLoading] = useState(true);
  const [iuran, setIuran] = useState<TagihanIuran[]>([]);
  const [iuranLoading, setIuranLoading] = useState(true);
  const [riwayatSurat, setRiwayatSurat] = useState<RiwayatSurat[]>([]);
  const [riwayatPengaduan, setRiwayatPengaduan] = useState<RiwayatPengaduan[]>([]);
  const [riwayatLoading, setRiwayatLoading] = useState(true);
  const [riwayatError, setRiwayatError] = useState<string | null>(null);

  // Modal layanan
  const [openSurat, setOpenSurat] = useState(false);
  const [openLacak, setOpenLacak] = useState(false);
  const [openPengaduan, setOpenPengaduan] = useState(false);
  const [openPerbarui, setOpenPerbarui] = useState(false);
  const [openEWS, setOpenEWS] = useState(false);
  const [openGantiPin, setOpenGantiPin] = useState(false);
  const [openPerbaruiKK, setOpenPerbaruiKK] = useState(false);

  const isNativeApp = Capacitor.isNativePlatform();

  useEffect(() => {
    let aktif = true;
    void (async () => {
      const [k, p] = await Promise.all([
        supabaseService.fetchKonfigurasiPublik(),
        supabaseService.fetchPengumumanPublik(),
      ]);
      if (!aktif) return;
      setKonfig(k);
      setPengumuman(p);
    })();
    return () => {
      aktif = false;
    };
  }, []);

  // Kegiatan RT — warga hanya menerima baris yang dipublikasikan (difilter RLS).
  useEffect(() => {
    let aktif = true;
    void (async () => {
      setKegiatanLoading(true);
      const { data } = await supabaseService.fetchKegiatan();
      if (!aktif) return;
      setKegiatan(Array.isArray(data) ? data : []);
      setKegiatanLoading(false);
    })();
    return () => {
      aktif = false;
    };
  }, []);

  // Ringkasan kas RT — ditampilkan di Beranda (transparansi, read-only).
  useEffect(() => {
    let aktif = true;
    void (async () => {
      setKeuanganLoading(true);
      const { data } = await supabaseService.fetchKeuangan();
      if (!aktif) return;
      setKeuangan(Array.isArray(data) ? data : []);
      setKeuanganLoading(false);
    })();
    return () => {
      aktif = false;
    };
  }, []);

  // Tagihan iuran milik warga ini (difilter RLS) — dipakai untuk badge Beranda.
  useEffect(() => {
    let aktif = true;
    void (async () => {
      setIuranLoading(true);
      const { data } = await supabaseService.fetchIuranSaya();
      if (!aktif) return;
      setIuran(Array.isArray(data) ? data : []);
      setIuranLoading(false);
    })();
    return () => {
      aktif = false;
    };
  }, []);

  // Riwayat pribadi (surat + pengaduan) — diambil SEKALI di sini lalu
  // diturunkan sebagai props ke Beranda (angka) dan layar Riwayat (daftar),
  // supaya tidak dua kali jalan ke server. Butuh scripts/fitur-riwayat-warga.sql.
  useEffect(() => {
    let aktif = true;
    void (async () => {
      setRiwayatLoading(true);
      const [surat, pengaduan] = await Promise.all([
        supabaseService.fetchPengajuanSaya(),
        supabaseService.fetchPengaduanSaya(),
      ]);
      if (!aktif) return;
      setRiwayatSurat(Array.isArray(surat.data) ? surat.data : []);
      setRiwayatPengaduan(Array.isArray(pengaduan.data) ? pengaduan.data : []);
      setRiwayatError(surat.error || pengaduan.error || null);
      setRiwayatLoading(false);
    })();
    return () => {
      aktif = false;
    };
  }, []);

  const ringkasanKas = useMemo(() => hitungRingkasan(keuangan), [keuangan]);

  // Tagihan yang masih menunggu pembayaran warga: belum lunas + bukti ditolak.
  const tagihanBelumLunas = useMemo(
    () => iuran.filter(t => t.status === 'BELUM_LUNAS' || t.status === 'DITOLAK').length,
    [iuran]
  );

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
      { key: 'iuran', icon: Coins, title: 'Iuran Saya', desc: 'Lihat tagihan iuran & unggah bukti bayar.', accent: 'bg-violet-50 text-violet-700', onClick: () => setTab('iuran') },
      { key: 'riwayat', icon: History, title: 'Riwayat Saya', desc: 'Arsip pengajuan surat & pengaduan yang pernah Anda kirim.', accent: 'bg-sky-50 text-sky-700', onClick: () => setTab('riwayat') },
      { key: 'lacak', icon: Search, title: 'Lacak Status Pengajuan', desc: 'Pantau perkembangan surat dengan NIK & nomor referensi.', accent: 'bg-blue-50 text-blue-700', onClick: () => setOpenLacak(true) },
      { key: 'pengaduan', icon: Megaphone, title: 'Lapor & Pengaduan', desc: 'Laporkan keluhan lingkungan: keamanan, kebersihan, fasilitas.', accent: 'bg-rose-50 text-rose-700', onClick: () => setOpenPengaduan(true) },
      { key: 'hubungi', icon: MessageCircle, title: 'Hubungi Pengurus', desc: 'Konsultasi layanan lewat WhatsApp resmi.', accent: 'bg-amber-50 text-amber-700', href: hubungiHref },
    ];
    if (isNativeApp) {
      list.push({ key: 'ews', icon: Siren, title: 'Lapor Darurat', desc: 'Kirim peringatan darurat ke seluruh warga RT.', accent: 'bg-rose-100 text-rose-700', onClick: () => setOpenEWS(true) });
    }
    return list;
  }, [hubungiHref, isNativeApp]);

  /**
   * Delapan kotak grid LAYANAN di Beranda (4 kolom × 2 baris). Slot ke-7
   * berbeda per platform: di APK diisi "Darurat" (EWS), di web diisi
   * "Perbarui Data" — yang di APK tetap terjangkau lewat "Semua Layanan".
   */
  const layananTiles: WargaQuickAction[] = useMemo(() => {
    const tiles: WargaQuickAction[] = [
      { key: 'iuran', icon: Coins, title: 'Iuran', accent: 'bg-violet-50 text-violet-700', onClick: () => setTab('iuran') },
      { key: 'surat', icon: FileText, title: 'Surat', accent: 'bg-emerald-50 text-emerald-700', onClick: () => setOpenSurat(true) },
      { key: 'pengaduan', icon: Megaphone, title: 'Aduan', accent: 'bg-rose-50 text-rose-700', onClick: () => setOpenPengaduan(true) },
      { key: 'keuangan', icon: Wallet, title: 'Kas RT', accent: 'bg-teal-50 text-teal-700', onClick: () => setTab('keuangan') },
      { key: 'kegiatan', icon: CalendarDays, title: 'Kegiatan', accent: 'bg-sky-50 text-sky-700', onClick: () => setTab('kegiatan') },
      { key: 'lacak', icon: Search, title: 'Lacak', accent: 'bg-blue-50 text-blue-700', onClick: () => setOpenLacak(true) },
    ];
    tiles.push(
      isNativeApp
        ? { key: 'ews', icon: Siren, title: 'Darurat', accent: 'bg-rose-100 text-rose-700', onClick: () => setOpenEWS(true) }
        : { key: 'perbarui', icon: RefreshCw, title: 'Perbarui Data', accent: 'bg-amber-50 text-amber-700', onClick: () => setOpenPerbarui(true) }
    );
    tiles.push({ key: 'layanan', icon: LayoutGrid, title: 'Semua Layanan', accent: 'bg-slate-100 text-slate-600', onClick: () => setTab('layanan') });
    return tiles;
  }, [isNativeApp]);

  const renderContent = () => {
    switch (tab) {
      case 'beranda':
        return (
          <WargaDashboard
            nama={currentUser.nama}
            rt={rt}
            rw={rw}
            pengumuman={pengumuman}
            layananTiles={layananTiles}
            saldoKas={ringkasanKas.saldo}
            totalMasuk={ringkasanKas.totalMasuk}
            totalKeluar={ringkasanKas.totalKeluar}
            keuanganLoading={keuanganLoading}
            onLihatKeuangan={() => setTab('keuangan')}
            tagihanBelumLunas={tagihanBelumLunas}
            iuranLoading={iuranLoading}
            onLihatIuran={() => setTab('iuran')}
            suratSaya={riwayatSurat.length}
            pengaduanSaya={riwayatPengaduan.length}
            riwayatLoading={riwayatLoading}
            onLihatRiwayat={() => setTab('riwayat')}
            kegiatan={kegiatan}
            onLihatKegiatan={() => setTab('kegiatan')}
          />
        );
      case 'layanan':
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTab('beranda')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Beranda
            </button>
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
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTab('beranda')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Beranda
            </button>
            <KegiatanWargaPanel items={kegiatan} loading={kegiatanLoading} />
          </div>
        );
      case 'umkm':
        return <UmkmWarga currentUser={currentUser} />;
      case 'keuangan':
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTab('beranda')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Beranda
            </button>
            <KeuanganWarga />
          </div>
        );
      case 'iuran':
        return <IuranWarga />;
      case 'riwayat':
        return (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setTab('beranda')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Beranda
            </button>
            <div className="px-0.5">
              <h1 className="text-lg font-black tracking-tight text-slate-900">Riwayat Saya</h1>
              <p className="text-sm text-slate-500">Pengajuan surat & pengaduan yang pernah Anda kirim.</p>
            </div>
            <RiwayatWarga
              surat={riwayatSurat}
              pengaduan={riwayatPengaduan}
              loading={riwayatLoading}
              error={riwayatError}
            />
          </div>
        );
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
              onClick={() => setOpenPerbaruiKK(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CreditCard className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-slate-900">Perbarui Kartu Keluarga</span>
                <span className="text-xs text-slate-500">Ajukan perubahan nomor KK atau hapus anggota</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

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
      <main id="konten-utama" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-5 pb-28">{renderContent()}</main>

      {/* Bottom navigation — 4 tab + FAB "Surat" di slot tengah (tetap 5 kolom).
          `overflow-visible` wajib agar tonjolan FAB tidak terpotong. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 overflow-visible border-t border-slate-200 bg-white/95 backdrop-blur-lg pb-safe">
        <div className="mx-auto grid max-w-2xl grid-cols-5 items-end">
          {NAV.slice(0, 2).map((item) => (
            <NavButton key={item.key} item={item} active={tab === item.key} onSelect={setTab} />
          ))}

          {/* Slot tengah: tombol menonjol untuk aksi paling sering — ajukan surat */}
          <div className="flex flex-col items-center justify-end">
            <button
              type="button"
              onClick={() => setOpenSurat(true)}
              aria-label="Ajukan Surat Pengantar"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-4 ring-white transition active:scale-95 hover:bg-emerald-700"
            >
              <FileText className="h-6 w-6" />
            </button>
            <span className="pb-2.5 pt-1 text-[10px] font-bold leading-none text-slate-500">Surat</span>
          </div>

          {NAV.slice(2).map((item) => (
            <NavButton key={item.key} item={item} active={tab === item.key} onSelect={setTab} />
          ))}
        </div>
      </nav>

      {/* Modals layanan (dipakai ulang dari Sapa Warga) */}
      {openSurat && <PublicSuratForm onClose={() => setOpenSurat(false)} />}
      {openLacak && <LacakPengajuanModal onClose={() => setOpenLacak(false)} />}
      {openPengaduan && <PengaduanWargaModal onClose={() => setOpenPengaduan(false)} />}
      {openPerbarui && <DaftarWargaModal mode="publik" onClose={() => setOpenPerbarui(false)} />}
      {isNativeApp && <EWSLaporanModal isOpen={openEWS} onClose={() => setOpenEWS(false)} />}
      {openGantiPin && <GantiPinModal onClose={() => setOpenGantiPin(false)} />}
      {openPerbaruiKK && (
        <PerbaruiKKModal
          nomorKKSekarang={currentUser.nomorKK}
          onClose={() => setOpenPerbaruiKK(false)}
        />
      )}
    </div>
  );
};

export default WargaLayout;
