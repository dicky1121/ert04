import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { PendaftaranWargaInput, StatusPendaftaranWarga } from '../types';
import { supabaseService } from '../services/supabaseService';
import { isWeakPin } from '../services/authService';

interface DaftarWargaModalProps {
  onClose: () => void;
  /**
   * 'publik' (default): pengajuan/perbaruan data anonim (RPC ajukan_pendaftaran_warga).
   * 'akun': pendaftaran akun warga (data + PIN) lewat Edge Function daftar-akun-warga.
   */
  mode?: 'publik' | 'akun';
}

type Mode = 'ajukan' | 'status';

const DRAFT_KEY = 'ert04-draft-daftar-warga';

const emptyForm: PendaftaranWargaInput = {
  nik: '',
  nomorKK: '',
  nama: '',
  jenisKelamin: 'L',
  tempatLahir: '',
  tanggalLahir: '',
  agama: 'ISLAM',
  pekerjaan: '',
  statusPerkawinan: 'KAWIN',
  statusHubunganKK: 'KEPALA KELUARGA',
  golonganDarah: '-',
  nomorHp: '',
  statusTinggal: 'TETAP',
  isYatim: false,
  isDisabilitas: false,
  statusBansos: 'TIDAK_ADA',
  keteranganBansos: '',
  catatan: '',
};

const onlyDigits = (v: string) => v.replace(/\D/g, '');

// Validasi nomor HP Indonesia: 08xx, +62xx, atau 62xx (10–15 digit total).
const isValidPhone = (raw: string): boolean => {
  const v = raw.replace(/[\s-]/g, '');
  return /^(?:\+?62|0)8[1-9][0-9]{6,11}$/.test(v);
};

const labelStatus: Record<string, { text: string; cls: string; Icon: typeof Clock }> = {
  PENDING: { text: 'Menunggu Ditinjau', cls: 'bg-amber-100 text-amber-800 border-amber-200', Icon: Clock },
  DISETUJUI: { text: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  DITOLAK: { text: 'Ditolak', cls: 'bg-rose-100 text-rose-800 border-rose-200', Icon: XCircle },
};

const fmtWaktu = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const inputCls =
  'w-full p-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 transition-colors';
const selectCls = inputCls + ' bg-white';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export const DaftarWargaModal: React.FC<DaftarWargaModalProps> = ({ onClose, mode: entryMode = 'publik' }) => {
  const isAkun = entryMode === 'akun';
  const [mode, setMode] = useState<Mode>('ajukan');

  // ---- Form pengajuan ----
  const [form, setForm] = useState<PendaftaranWargaInput>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...emptyForm, ...JSON.parse(raw) };
    } catch {
      /* abaikan draft rusak */
    }
    return emptyForm;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [pendingRetry, setPendingRetry] = useState(false);

  // ---- PIN akun (mode 'akun' saja; TIDAK pernah disimpan ke draft) ----
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [showPin, setShowPin] = useState(false);

  // ---- Cek status ----
  const [cekNik, setCekNik] = useState('');
  const [statusData, setStatusData] = useState<StatusPendaftaranWarga | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simpan draft setiap kali form berubah (agar tidak hilang bila HP mati / offline).
  useEffect(() => {
    if (successRef) return; // sudah terkirim, tak perlu draft
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      /* storage penuh: abaikan */
    }
  }, [form, successRef]);

  const setField = <K extends keyof PendaftaranWargaInput>(key: K, value: PendaftaranWargaInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.nik.length !== 16) e.nik = 'NIK harus tepat 16 digit angka.';
    if (form.nomorKK.length > 0 && form.nomorKK.length !== 16) e.nomorKK = 'Nomor KK harus tepat 16 digit angka (atau kosongkan jika belum ada).';
    if (form.nama.trim().length < 2) e.nama = 'Nama lengkap wajib diisi.';
    if (!form.tanggalLahir) e.tanggalLahir = 'Tanggal lahir wajib diisi.';
    if (!isValidPhone(form.nomorHp)) e.nomorHp = 'Nomor HP tidak valid. Contoh: 081298765432.';
    if (isAkun) {
      if (!/^[0-9]{6}$/.test(pin)) e.pin = 'PIN harus tepat 6 angka.';
      else if (isWeakPin(pin)) e.pin = 'PIN terlalu mudah ditebak (hindari 123456, 000000, dst).';
      else if (pin !== pin2) e.pin2 = 'Konfirmasi PIN tidak sama.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doSubmit = useCallback(async (payload: PendaftaranWargaInput) => {
    setIsSubmitting(true);
    setSubmitError(null);
    const result = isAkun
      ? await supabaseService.daftarAkunWarga({ ...payload, pin })
      : await supabaseService.ajukanPendaftaranWarga(payload);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessRef(result.referensi || 'TERKIRIM');
      setPendingRetry(false);
      setPin('');
      setPin2('');
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* abaikan */
      }
      return;
    }
    // Gagal: pertahankan draft, tawarkan kirim ulang.
    setSubmitError(result.error || 'Pengajuan gagal dikirim.');
    setPendingRetry(true);
  }, [isAkun, pin]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSubmitError('Anda sedang offline. Data tersimpan sebagai draft dan akan otomatis dikirim saat internet kembali.');
      setPendingRetry(true);
      return;
    }
    await doSubmit(form);
  };

  // Auto-retry saat koneksi kembali.
  useEffect(() => {
    if (!pendingRetry) return;
    const onOnline = () => {
      if (!successRef) void doSubmit(form);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [pendingRetry, successRef, form, doSubmit]);

  // ---- Cek status ----
  const runCek = useCallback(async (nik: string) => {
    if (nik.length !== 16) {
      setStatusError('Masukkan NIK 16 digit untuk mengecek status.');
      setStatusData(null);
      return;
    }
    setIsChecking(true);
    setStatusError(null);
    const result = await supabaseService.cekStatusPendaftaranWarga(nik);
    setIsChecking(false);
    if (!result.success) {
      setStatusError(result.error || 'Gagal mengambil status.');
      return;
    }
    setStatusData(result.data || { ditemukan: false });
  }, []);

  // Polling ringan tiap 20 dtk selama tab status terbuka dengan NIK valid
  // (warga anon tidak bisa realtime langsung ke tabel, jadi kita poll RPC).
  useEffect(() => {
    if (mode !== 'status' || cekNik.length !== 16 || !statusData?.ditemukan) return;
    pollRef.current = setInterval(() => void runCek(cekNik), 20000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mode, cekNik, statusData?.ditemukan, runCek]);

  const goCekStatusForNik = (nik: string) => {
    setMode('status');
    setCekNik(nik);
    void runCek(nik);
  };

  // Jumlah field yang masih perlu diisi (indikator ringan di tombol submit).
  const stInfo = statusData?.status ? labelStatus[statusData.status] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daftar-warga-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-emerald-600 shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="daftar-warga-title" className="text-base font-bold text-white leading-tight">
              {isAkun ? 'Daftar Akun Warga' : 'Daftar / Perbarui Data Warga'}
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">
              {isAkun ? 'Buat akun untuk masuk ke Portal Warga' : 'Diperiksa dulu oleh pengurus sebelum disimpan'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        {!successRef && (
          <div className="flex shrink-0 border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setMode('ajukan')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                mode === 'ajukan' ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserPlus className="w-4 h-4" /> {isAkun ? 'Daftar Akun' : 'Ajukan Data'}
            </button>
            <button
              type="button"
              onClick={() => setMode('status')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors ${
                mode === 'status' ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Search className="w-4 h-4" /> Cek Status
            </button>
          </div>
        )}

        {/* ============ SUCCESS ============ */}
        {successRef ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{isAkun ? 'Pendaftaran Akun Terkirim!' : 'Pengajuan Terkirim!'}</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-xs">
                {isAkun
                  ? 'Akun Anda akan aktif setelah disetujui pengurus RT. Setelah aktif, masuk memakai NIK + PIN yang tadi Anda buat.'
                  : 'Data Anda menunggu persetujuan pengurus RT. Simpan nomor referensi untuk memantau status.'}
              </p>
              <p className="text-xs text-slate-500 mt-3 font-mono bg-slate-100 px-3 py-1.5 rounded-lg break-all">
                Ref: <span className="text-emerald-700 font-semibold">{successRef}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={() => goCekStatusForNik(form.nik)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full transition-colors"
              >
                Cek Status Pengajuan
              </button>
              <button onClick={onClose} className="px-6 py-2.5 text-slate-600 hover:text-slate-800 text-sm font-semibold">
                Tutup
              </button>
            </div>
          </div>
        ) : mode === 'ajukan' ? (
          /* ============ FORM AJUKAN ============ */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-3.5">
              {/* Info banner */}
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2.5 rounded-xl">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                {isAkun ? (
                  <span>
                    Isi data sesuai KTP/KK dan buat <b>PIN 6 angka</b> untuk masuk. Akun aktif setelah{' '}
                    <b>disetujui pengurus</b>. Setelah aktif, Anda masuk memakai <b>NIK + PIN</b>.
                  </span>
                ) : (
                  <span>
                    Isi sesuai KTP/KK. Jika NIK sudah terdaftar, pengajuan ini akan menjadi <b>perbaruan data</b>. Data
                    hanya tersimpan setelah <b>disetujui pengurus</b>.
                  </span>
                )}
              </div>

              {submitError && (
                <div
                  className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2.5 rounded-xl"
                  role="alert"
                >
                  {pendingRetry ? <WifiOff className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p>{submitError}</p>
                    {pendingRetry && (
                      <button
                        type="button"
                        onClick={() => void doSubmit(form)}
                        disabled={isSubmitting}
                        className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-amber-900 underline disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} /> Kirim ulang sekarang
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* NIK */}
              <div>
                <label className={labelCls}>
                  NIK <span className="text-rose-500">*</span>
                </label>
                <input
                  inputMode="numeric"
                  value={form.nik}
                  onChange={(e) => setField('nik', onlyDigits(e.target.value).slice(0, 16))}
                  placeholder="16 digit sesuai KTP"
                  className={inputCls}
                />
                {errors.nik ? (
                  <p className="text-xs text-rose-600 mt-1">{errors.nik}</p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">{form.nik.length}/16 digit</p>
                )}
              </div>

              {/* PIN masuk (mode akun) — dikelompokkan tepat di bawah NIK karena NIK+PIN = kredensial login */}
              {isAkun && (
                <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold">Buat PIN Masuk (6 angka)</span>
                  </div>
                  <p className="text-xs text-emerald-700/80 -mt-1">
                    PIN dipakai bersama NIK untuk masuk ke aplikasi. Jangan pakai angka berurutan/berulang, dan jangan bagikan ke siapa pun.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* PIN */}
                    <div>
                      <label className={labelCls}>
                        PIN <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          inputMode="numeric"
                          autoComplete="new-password"
                          value={pin}
                          onChange={(e) => setPin(onlyDigits(e.target.value).slice(0, 6))}
                          placeholder="••••••"
                          className={inputCls + ' pr-10 tracking-[0.3em]'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                          aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {/* Konfirmasi PIN */}
                    <div>
                      <label className={labelCls}>
                        Ulangi PIN <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        autoComplete="new-password"
                        value={pin2}
                        onChange={(e) => setPin2(onlyDigits(e.target.value).slice(0, 6))}
                        placeholder="••••••"
                        className={inputCls + ' tracking-[0.3em]'}
                      />
                    </div>
                  </div>
                  {errors.pin && <p className="text-xs text-rose-600">{errors.pin}</p>}
                  {errors.pin2 && <p className="text-xs text-rose-600">{errors.pin2}</p>}
                </div>
              )}

              {/* Nomor KK */}
              <div>
                <label className={labelCls}>
                  Nomor Kartu Keluarga <span className="text-slate-400 font-normal text-[11px]">(opsional)</span>
                </label>
                <input
                  inputMode="numeric"
                  value={form.nomorKK}
                  onChange={(e) => setField('nomorKK', onlyDigits(e.target.value).slice(0, 16))}
                  placeholder="16 digit sesuai KK (kosongkan jika belum ada)"
                  className={inputCls}
                />
                {errors.nomorKK && <p className="text-xs text-rose-600 mt-1">{errors.nomorKK}</p>}
                {!errors.nomorKK && (
                  <p className="text-[11px] text-slate-400 mt-1">Kosongkan jika belum memiliki KK atau belum tahu nomornya.</p>
                )}
              </div>

              {/* Nama */}
              <div>
                <label className={labelCls}>
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.nama}
                  onChange={(e) => setField('nama', e.target.value)}
                  placeholder="Sesuai KTP"
                  className={inputCls}
                />
                {errors.nama && <p className="text-xs text-rose-600 mt-1">{errors.nama}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Jenis Kelamin */}
                <div>
                  <label className={labelCls}>Jenis Kelamin</label>
                  <select value={form.jenisKelamin} onChange={(e) => setField('jenisKelamin', e.target.value as 'L' | 'P')} className={selectCls}>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                {/* Golongan Darah */}
                <div>
                  <label className={labelCls}>Golongan Darah</label>
                  <select value={form.golonganDarah} onChange={(e) => setField('golonganDarah', e.target.value)} className={selectCls}>
                    <option value="-">Tidak Tahu / -</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Tempat Lahir */}
                <div>
                  <label className={labelCls}>Tempat Lahir</label>
                  <input value={form.tempatLahir} onChange={(e) => setField('tempatLahir', e.target.value)} placeholder="Kota kelahiran" className={inputCls} />
                </div>
                {/* Tanggal Lahir */}
                <div>
                  <label className={labelCls}>
                    Tanggal Lahir <span className="text-rose-500">*</span>
                  </label>
                  <input type="date" value={form.tanggalLahir} onChange={(e) => setField('tanggalLahir', e.target.value)} className={inputCls} />
                  {errors.tanggalLahir && <p className="text-xs text-rose-600 mt-1">{errors.tanggalLahir}</p>}
                </div>
              </div>

              {/* Status Hubungan KK */}
              <div>
                <label className={labelCls}>Status Hubungan dalam KK</label>
                <select value={form.statusHubunganKK} onChange={(e) => setField('statusHubunganKK', e.target.value)} className={selectCls}>
                  <option value="KEPALA KELUARGA">Kepala Keluarga</option>
                  <option value="ISTRI">Istri</option>
                  <option value="ANAK">Anak</option>
                  <option value="ORANG TUA">Orang Tua</option>
                  <option value="MERTUA">Mertua</option>
                  <option value="FAMILI LAIN">Famili Lain</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Status Perkawinan */}
                <div>
                  <label className={labelCls}>Status Perkawinan</label>
                  <select value={form.statusPerkawinan} onChange={(e) => setField('statusPerkawinan', e.target.value)} className={selectCls}>
                    <option value="BELUM KAWIN">Belum Kawin</option>
                    <option value="KAWIN">Kawin</option>
                    <option value="CERAI HIDUP">Cerai Hidup</option>
                    <option value="CERAI MATI">Cerai Mati</option>
                  </select>
                </div>
                {/* Agama */}
                <div>
                  <label className={labelCls}>Agama</label>
                  <select value={form.agama} onChange={(e) => setField('agama', e.target.value)} className={selectCls}>
                    <option value="ISLAM">Islam</option>
                    <option value="KRISTEN">Kristen</option>
                    <option value="KATOLIK">Katolik</option>
                    <option value="HINDU">Hindu</option>
                    <option value="BUDDHA">Buddha</option>
                    <option value="KONGHUCU">Konghucu</option>
                  </select>
                </div>
              </div>

              {/* Pekerjaan */}
              <div>
                <label className={labelCls}>Pekerjaan</label>
                <input value={form.pekerjaan} onChange={(e) => setField('pekerjaan', e.target.value)} placeholder="Contoh: Karyawan Swasta / Wiraswasta" className={inputCls} />
              </div>

              {/* Status Tinggal */}
              <div>
                <label className={labelCls}>Status Tinggal</label>
                <select value={form.statusTinggal} onChange={(e) => setField('statusTinggal', e.target.value)} className={selectCls}>
                  <option value="TETAP">Warga Tetap</option>
                  <option value="KONTRAK">Pengontrak</option>
                  <option value="KOS">Kos</option>
                </select>
              </div>

              {/* Nomor HP */}
              <div>
                <label className={labelCls}>
                  Nomor WhatsApp / HP <span className="text-rose-500">*</span>
                </label>
                <input
                  inputMode="tel"
                  value={form.nomorHp}
                  onChange={(e) => setField('nomorHp', e.target.value)}
                  placeholder="Contoh: 081298765432"
                  className={inputCls}
                />
                {errors.nomorHp && <p className="text-xs text-rose-600 mt-1">{errors.nomorHp}</p>}
              </div>

              {/* Bansos */}
              <div>
                <label className={labelCls}>Bantuan Sosial (Bansos)</label>
                <select value={form.statusBansos} onChange={(e) => setField('statusBansos', e.target.value)} className={selectCls}>
                  <option value="TIDAK_ADA">Tidak Ada (Mampu)</option>
                  <option value="PKH">Program Keluarga Harapan (PKH)</option>
                  <option value="BPNT">Bantuan Pangan Non Tunai (BPNT / Sembako)</option>
                  <option value="BLT">Bantuan Langsung Tunai (BLT)</option>
                  <option value="BST">Bantuan Sosial Tunai (BST)</option>
                  <option value="BANSOS_DAERAH">Bansos APBD Kab. Bekasi</option>
                </select>
              </div>

              {/* Kategori khusus */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-800 text-xs">Kategori Khusus (opsional):</div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.isYatim} onChange={(e) => setField('isYatim', e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-slate-700">Anak Yatim / Piatu</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.isDisabilitas} onChange={(e) => setField('isDisabilitas', e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-slate-700">Penyandang Disabilitas</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 italic">
                  Kategori Lansia (≥60 th) &amp; Balita (≤5 th) dihitung otomatis dari tanggal lahir.
                </p>
              </div>

              {/* Catatan */}
              <div>
                <label className={labelCls}>Catatan Tambahan</label>
                <textarea rows={2} value={form.catatan} onChange={(e) => setField('catatan', e.target.value)} placeholder="Keterangan lain (opsional)..." className={inputCls} />
              </div>
            </div>

            {/* Footer submit */}
            <div className="px-5 pb-5 pt-2 shrink-0 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Mengirim...
                  </>
                ) : (
                  <>
                    {isAkun ? <UserPlus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {isAkun ? 'Daftar Akun Warga' : 'Kirim Pengajuan'}
                  </>
                )}
              </button>
              <p className="text-center text-xs text-slate-500 mt-2.5">Data dijamin kerahasiaannya dan hanya dipakai untuk administrasi RT.</p>
            </div>
          </form>
        ) : (
          /* ============ CEK STATUS ============ */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <p className="text-sm text-slate-600">Masukkan NIK Anda untuk melihat status pengajuan terbaru.</p>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={cekNik}
                onChange={(e) => setCekNik(onlyDigits(e.target.value).slice(0, 16))}
                placeholder="NIK 16 digit"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => void runCek(cekNik)}
                disabled={isChecking}
                className="shrink-0 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Cek
              </button>
            </div>

            {statusError && (
              <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{statusError}</span>
              </div>
            )}

            {statusData && !statusError && (
              statusData.ditemukan ? (
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{statusData.nama || 'Pengajuan Anda'}</p>
                      <p className="text-xs text-slate-500">
                        {statusData.jenisPengajuan === 'PERBARUI' ? 'Perbaruan data' : 'Pendaftaran baru'}
                      </p>
                    </div>
                    {stInfo && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${stInfo.cls}`}>
                        <stInfo.Icon className="w-3.5 h-3.5" /> {stInfo.text}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-xs text-slate-600">
                    <p>Diajukan: {fmtWaktu(statusData.submittedAt) || '-'}</p>
                    {statusData.reviewedAt && <p>Ditinjau: {fmtWaktu(statusData.reviewedAt)}</p>}
                    {statusData.status === 'DITOLAK' && statusData.catatanAdmin && (
                      <p className="mt-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-700">
                        Catatan pengurus: {statusData.catatanAdmin}
                      </p>
                    )}
                    {statusData.status === 'DISETUJUI' && (
                      <p className="mt-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-700">
                        Data Anda sudah diperbarui di sistem RT. Terima kasih.
                      </p>
                    )}
                    {statusData.status === 'PENDING' && (
                      <p className="text-slate-400 flex items-center gap-1.5 pt-1">
                        <RefreshCw className="w-3 h-3" /> Status diperbarui otomatis…
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {statusData.pesan || 'Belum ada pengajuan untuk NIK ini.'}
                </div>
              )
            )}

            <button type="button" onClick={() => setMode('ajukan')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              <ArrowLeft className="w-4 h-4" /> Kembali ke form pengajuan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
