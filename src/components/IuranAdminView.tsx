import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Coins,
  ExternalLink,
  ImageOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  CurrentUser,
  PengaturanIuran,
  StatusTagihan,
  TagihanIuran,
  TagihanIuranInput,
  Warga,
} from '../types';
import { supabaseService } from '../services/supabaseService';
import { formatRupiah, namaBulan, formatTanggalRingkas } from '../utils/keuangan';
import { IURAN_LABEL, IURAN_TONE, statusBadge, statusDot } from '../utils/statusBadge';
import { ROLE_PENGURUS_KEUANGAN } from '../utils/roles';
import { useConfirm } from './ConfirmDialog';

interface IuranAdminViewProps {
  currentUser: CurrentUser;
  wargaList: Warga[];
}

type FilterStatus = 'SEMUA' | StatusTagihan;

const STATUS_URUT: StatusTagihan[] = ['BELUM_LUNAS', 'MENUNGGU_VERIFIKASI', 'LUNAS', 'DITOLAK'];

// ── helpers ──────────────────────────────────────────────────────────────────
const hariIni = (): string => new Date().toISOString().slice(0, 10);
const bulanIni = (): string => new Date().toISOString().slice(0, 7);

/** Nominal ditampilkan berformat ribuan; disimpan sebagai angka bulat. */
const tampilRupiah = (n: number): string => (n ? n.toLocaleString('id-ID') : '');
const parseRupiah = (raw: string): number => {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const JUDUL_BAWAAN = 'Iuran Kas RT';

const PENGATURAN_BAWAAN: PengaturanIuran = {
  infoPembayaran: '',
  nominalDefault: 0,
  judulDefault: JUDUL_BAWAAN,
};

const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

/** Tagihan BELUM_LUNAS yang tanggal jatuh temponya sudah lewat. */
const isTerlambat = (t: TagihanIuran): boolean =>
  t.status === 'BELUM_LUNAS' && !!t.jatuhTempo && t.jatuhTempo < hariIni();

// ── kerangka modal bersama (dipakai 4 alur di bawah) ─────────────────────────
const ModalShell: React.FC<{
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Bila diisi, panel dirender sebagai <form> dan submit-nya diteruskan. */
  onSubmit?: (e: React.FormEvent) => void;
  wide?: boolean;
}> = ({ title, icon: Icon, onClose, children, footer, onSubmit, wide }) => {
  const panelCls = `bg-white w-full ${
    wide ? 'sm:max-w-lg' : 'sm:max-w-md'
  } rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col`;

  const inner = (
    <>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Icon className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto">{children}</div>

      {footer && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {onSubmit ? (
        <form onSubmit={onSubmit} className={panelCls}>
          {inner}
        </form>
      ) : (
        <div className={panelCls}>{inner}</div>
      )}
    </div>
  );
};

const PesanError: React.FC<{ pesan: string }> = ({ pesan }) => (
  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-rose-700 text-xs">
    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{pesan}</span>
  </div>
);

const TombolBatal: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition"
  >
    Batal
  </button>
);

// ── 1. modal tambah / edit satu tagihan ──────────────────────────────────────
const TagihanFormModal: React.FC<{
  awal: TagihanIuranInput;
  isEdit: boolean;
  wargaTerurut: Warga[];
  namaWargaEdit?: string;
  onClose: () => void;
  onSubmit: (input: TagihanIuranInput) => Promise<boolean>;
}> = ({ awal, isEdit, wargaTerurut, namaWargaEdit, onClose, onSubmit }) => {
  const [form, setForm] = useState<TagihanIuranInput>(awal);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setField = <K extends keyof TagihanIuranInput>(key: K, value: TagihanIuranInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wargaId) { setFormError('Warga penerima tagihan wajib dipilih.'); return; }
    if (!form.judul.trim()) { setFormError('Judul tagihan wajib diisi.'); return; }
    if (!/^\d{4}-\d{2}$/.test(form.periode)) { setFormError('Periode wajib diisi (bulan & tahun).'); return; }
    if (!form.jumlah || form.jumlah <= 0) { setFormError('Nominal harus lebih dari 0.'); return; }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit({ ...form, judul: form.judul.trim() });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title={isEdit ? 'Ubah Tagihan' : 'Tambah Tagihan'}
      icon={Coins}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <TombolBatal onClick={onClose} />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Tagihan'}
          </button>
        </>
      }
    >
      <div>
        <label className={labelCls} htmlFor="iuran-warga">Warga penerima *</label>
        {isEdit ? (
          <>
            <input id="iuran-warga" type="text" value={namaWargaEdit || '-'} disabled className={`${inputCls} bg-slate-50 text-slate-500`} />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Penerima tagihan tidak dapat dipindahkan. Hapus tagihan ini lalu buat baru bila salah orang.
            </p>
          </>
        ) : (
          <select
            id="iuran-warga"
            value={form.wargaId}
            onChange={e => setField('wargaId', e.target.value)}
            className={inputCls}
          >
            <option value="">— Pilih warga —</option>
            {wargaTerurut.map(w => (
              <option key={w.id} value={w.id}>
                {w.nama}{w.nik ? ` · ${w.nik}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className={labelCls} htmlFor="iuran-judul">Judul tagihan *</label>
        <input
          id="iuran-judul"
          type="text"
          value={form.judul}
          onChange={e => setField('judul', e.target.value)}
          placeholder="mis. Iuran Kas RT"
          className={inputCls}
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="iuran-periode">Periode *</label>
          <input
            id="iuran-periode"
            type="month"
            value={form.periode}
            onChange={e => setField('periode', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="iuran-tempo">Jatuh tempo</label>
          <input
            id="iuran-tempo"
            type="date"
            value={form.jatuhTempo || ''}
            onChange={e => setField('jatuhTempo', e.target.value || null)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="iuran-jumlah">Nominal (Rp) *</label>
        <input
          id="iuran-jumlah"
          type="text"
          inputMode="numeric"
          value={tampilRupiah(form.jumlah)}
          onChange={e => setField('jumlah', parseRupiah(e.target.value))}
          placeholder="mis. 50.000"
          className={`${inputCls} font-bold`}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Satu warga hanya boleh punya satu tagihan untuk kombinasi judul + periode yang sama.
      </p>

      {formError && <PesanError pesan={formError} />}
    </ModalShell>
  );
};

// ── 2. modal generate tagihan massal ─────────────────────────────────────────
const GenerateMassalModal: React.FC<{
  wargaTerurut: Warga[];
  pengaturan: PengaturanIuran;
  onClose: () => void;
  onSubmit: (params: {
    periode: string;
    judul: string;
    jumlah: number;
    jatuhTempo?: string | null;
    wargaIds: string[];
  }) => Promise<boolean>;
}> = ({ wargaTerurut, pengaturan, onClose, onSubmit }) => {
  const [periode, setPeriode] = useState(bulanIni());
  const [judul, setJudul] = useState(pengaturan.judulDefault || JUDUL_BAWAAN);
  const [jumlah, setJumlah] = useState(pengaturan.nominalDefault || 0);
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [cari, setCari] = useState('');
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set(wargaTerurut.map(w => w.id)));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return wargaTerurut;
    return wargaTerurut.filter(w => `${w.nama} ${w.nik}`.toLowerCase().includes(q));
  }, [cari, wargaTerurut]);

  const semuaTersaringTerpilih = tersaring.length > 0 && tersaring.every(w => terpilih.has(w.id));

  const toggleSatu = (id: string) =>
    setTerpilih(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSemuaTersaring = () =>
    setTerpilih(prev => {
      const next = new Set(prev);
      if (semuaTersaringTerpilih) tersaring.forEach(w => next.delete(w.id));
      else tersaring.forEach(w => next.add(w.id));
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}-\d{2}$/.test(periode)) { setFormError('Periode wajib diisi (bulan & tahun).'); return; }
    if (!judul.trim()) { setFormError('Judul tagihan wajib diisi.'); return; }
    if (!jumlah || jumlah <= 0) { setFormError('Nominal harus lebih dari 0.'); return; }
    if (terpilih.size === 0) { setFormError('Pilih minimal satu warga.'); return; }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit({
      periode,
      judul: judul.trim(),
      jumlah,
      jatuhTempo: jatuhTempo || null,
      wargaIds: Array.from(terpilih),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title="Generate Tagihan Massal"
      icon={Users}
      onClose={onClose}
      onSubmit={handleSubmit}
      wide
      footer={
        <>
          <TombolBatal onClick={onClose} />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {saving ? 'Membuat…' : `Buat untuk ${terpilih.size} warga`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="massal-periode">Periode *</label>
          <input
            id="massal-periode"
            type="month"
            value={periode}
            onChange={e => setPeriode(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="massal-tempo">Jatuh tempo</label>
          <input
            id="massal-tempo"
            type="date"
            value={jatuhTempo}
            onChange={e => setJatuhTempo(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="massal-judul">Judul *</label>
          <input
            id="massal-judul"
            type="text"
            value={judul}
            onChange={e => setJudul(e.target.value)}
            className={inputCls}
            maxLength={120}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="massal-jumlah">Nominal (Rp) *</label>
          <input
            id="massal-jumlah"
            type="text"
            inputMode="numeric"
            value={tampilRupiah(jumlah)}
            onChange={e => setJumlah(parseRupiah(e.target.value))}
            placeholder="mis. 50.000"
            className={`${inputCls} font-bold`}
          />
        </div>
      </div>

      {/* Pemilih warga — wajib ada pencarian + scroll karena daftar bisa panjang */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label className={`${labelCls} mb-0`} htmlFor="massal-cari">Penerima tagihan</label>
          <span className="text-[11px] font-bold text-emerald-700">{terpilih.size} terpilih</span>
        </div>
        <input
          id="massal-cari"
          type="search"
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari nama atau NIK…"
          className={inputCls}
        />
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={toggleSemuaTersaring}
            disabled={tersaring.length === 0}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40"
          >
            {semuaTersaringTerpilih ? 'Kosongkan pilihan' : 'Pilih semua'}
            {cari.trim() ? ' (hasil pencarian)' : ''}
          </button>
          <span className="text-[11px] text-slate-400">{tersaring.length} warga tampil</span>
        </div>

        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {tersaring.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-slate-400">Tidak ada warga yang cocok.</p>
          ) : (
            tersaring.map(w => (
              <label
                key={w.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition"
              >
                <input
                  type="checkbox"
                  checked={terpilih.has(w.id)}
                  onChange={() => toggleSatu(w.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{w.nama}</span>
                  {w.nik && <span className="block truncate font-mono text-[11px] text-slate-400">{w.nik}</span>}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Aman diulang: warga yang sudah punya tagihan dengan judul dan periode sama akan dilewati,
        bukan digandakan.
      </p>

      {formError && <PesanError pesan={formError} />}
    </ModalShell>
  );
};

// ── 3. modal verifikasi bukti transfer ───────────────────────────────────────
const VerifikasiModal: React.FC<{
  tagihan: TagihanIuran;
  namaWarga: string;
  onClose: () => void;
  onKeputusan: (keputusan: 'LUNAS' | 'DITOLAK', catatan?: string) => Promise<boolean>;
}> = ({ tagihan, namaWarga, onClose, onKeputusan }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [gagalGambar, setGagalGambar] = useState(false);
  const [modeTolak, setModeTolak] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState<'LUNAS' | 'DITOLAK' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Signed URL bucket privat hanya berlaku 1 jam — selalu diambil segar
  // tiap modal dibuka, tidak pernah disimpan lintas sesi.
  useEffect(() => {
    let aktif = true;
    void (async () => {
      setUrlLoading(true);
      const signed = await supabaseService.buktiSignedUrl(tagihan.buktiPath);
      if (!aktif) return;
      setUrl(signed);
      setUrlLoading(false);
    })();
    return () => { aktif = false; };
  }, [tagihan.id, tagihan.buktiPath]);

  const setujui = async () => {
    setFormError(null);
    setBusy('LUNAS');
    const ok = await onKeputusan('LUNAS');
    setBusy(null);
    if (ok) onClose();
  };

  const tolak = async () => {
    if (!catatan.trim()) { setFormError('Alasan penolakan wajib diisi agar warga tahu perbaikannya.'); return; }
    setFormError(null);
    setBusy('DITOLAK');
    const ok = await onKeputusan('DITOLAK', catatan.trim());
    setBusy(null);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title="Verifikasi Pembayaran"
      icon={ShieldCheck}
      onClose={onClose}
      wide
      footer={
        modeTolak ? (
          <>
            <button
              type="button"
              onClick={() => { setModeTolak(false); setFormError(null); }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition"
            >
              Kembali
            </button>
            <button
              type="button"
              onClick={tolak}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
            >
              {busy === 'DITOLAK' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              Kirim Penolakan
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setModeTolak(true)}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition disabled:opacity-60"
            >
              <Ban className="w-4 h-4" /> Tolak
            </button>
            <button
              type="button"
              onClick={setujui}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
            >
              {busy === 'LUNAS' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Setujui — Tandai Lunas
            </button>
          </>
        )
      }
    >
      {/* Ringkas tagihan */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
        <p className="text-sm font-bold text-slate-900">{namaWarga}</p>
        <p className="text-xs text-slate-500">{tagihan.judul} · {namaBulan(tagihan.periode)}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-lg font-black text-slate-900">{formatRupiah(tagihan.jumlah)}</span>
          {tagihan.dibayarAt && (
            <span className="text-[11px] text-slate-400">
              Bukti dikirim {formatTanggalRingkas(String(tagihan.dibayarAt).slice(0, 10))}
            </span>
          )}
        </div>
      </div>

      {/* Bukti transfer */}
      <div>
        <p className={labelCls}>Bukti transfer</p>
        {urlLoading ? (
          <div className="flex items-center justify-center gap-2.5 py-12 text-slate-400 rounded-xl border border-slate-200 bg-slate-50">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-medium">Membuka bukti…</span>
          </div>
        ) : !url || gagalGambar ? (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center px-4">
            <ImageOff className="w-7 h-7" />
            <p className="text-xs font-semibold text-slate-500">
              {tagihan.buktiPath ? 'Bukti tidak dapat ditampilkan.' : 'Warga belum melampirkan bukti.'}
            </p>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Coba buka di tab baru
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <img
              src={url}
              alt={`Bukti transfer ${namaWarga}`}
              onError={() => setGagalGambar(true)}
              className="max-h-[44vh] w-full rounded-xl border border-slate-200 bg-slate-100 object-contain"
            />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Buka ukuran penuh
            </a>
          </div>
        )}
      </div>

      {modeTolak && (
        <div>
          <label className={labelCls} htmlFor="verif-catatan">Alasan penolakan *</label>
          <textarea
            id="verif-catatan"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            rows={3}
            maxLength={300}
            autoFocus
            placeholder="mis. Nominal transfer kurang, atau bukti tidak terbaca. Mohon unggah ulang."
            className={`${inputCls} resize-none`}
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            Alasan ini tampil di layar warga, dan warga dapat mengunggah bukti baru.
          </p>
        </div>
      )}

      {formError && <PesanError pesan={formError} />}
    </ModalShell>
  );
};

// ── 4. modal setelan iuran ───────────────────────────────────────────────────
const SetelanModal: React.FC<{
  awal: PengaturanIuran;
  onClose: () => void;
  onSubmit: (input: PengaturanIuran) => Promise<boolean>;
}> = ({ awal, onClose, onSubmit }) => {
  const [form, setForm] = useState<PengaturanIuran>(awal);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judulDefault.trim()) { setFormError('Judul bawaan wajib diisi.'); return; }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit({
      infoPembayaran: form.infoPembayaran.trim(),
      nominalDefault: form.nominalDefault,
      judulDefault: form.judulDefault.trim(),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title="Setelan Iuran"
      icon={Settings2}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <TombolBatal onClick={onClose} />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Setelan
          </button>
        </>
      }
    >
      <div>
        <label className={labelCls} htmlFor="set-info">Info pembayaran</label>
        <textarea
          id="set-info"
          value={form.infoPembayaran}
          onChange={e => setForm(p => ({ ...p, infoPembayaran: e.target.value }))}
          rows={4}
          maxLength={600}
          placeholder={'Contoh:\nTransfer BCA 1234567890 a/n Kas RT 004\nAtau tunai ke Bendahara.'}
          className={`${inputCls} resize-none`}
        />
        <p className="mt-1.5 text-[11px] text-slate-400">
          Ditampilkan di layar Iuran warga sebagai panduan cara membayar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="set-judul">Judul bawaan *</label>
          <input
            id="set-judul"
            type="text"
            value={form.judulDefault}
            onChange={e => setForm(p => ({ ...p, judulDefault: e.target.value }))}
            className={inputCls}
            maxLength={120}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="set-nominal">Nominal bawaan (Rp)</label>
          <input
            id="set-nominal"
            type="text"
            inputMode="numeric"
            value={tampilRupiah(form.nominalDefault)}
            onChange={e => setForm(p => ({ ...p, nominalDefault: parseRupiah(e.target.value) }))}
            placeholder="mis. 50.000"
            className={`${inputCls} font-bold`}
          />
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Nilai bawaan hanya mengisi otomatis formulir tagihan baru — tagihan yang sudah ada tidak berubah.
      </p>

      {formError && <PesanError pesan={formError} />}
    </ModalShell>
  );
};

// ── komponen utama ───────────────────────────────────────────────────────────
export const IuranAdminView: React.FC<IuranAdminViewProps> = ({ currentUser, wargaList }) => {
  const [list, setList] = useState<TagihanIuran[]>([]);
  const [pengaturan, setPengaturan] = useState<PengaturanIuran>(PENGATURAN_BAWAAN);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('SEMUA');
  const [filterPeriode, setFilterPeriode] = useState<string>('SEMUA');
  const [cari, setCari] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TagihanIuran | null>(null);
  const [showMassal, setShowMassal] = useState(false);
  const [showSetelan, setShowSetelan] = useState(false);
  const [verifikasi, setVerifikasi] = useState<TagihanIuran | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { confirm: askConfirm, dialog } = useConfirm();

  const canManage = ROLE_PENGURUS_KEUANGAN.includes(String(currentUser?.role));
  const adaWarga = wargaList.length > 0;

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tagihan, setelan] = await Promise.all([
        supabaseService.fetchIuranAdmin(),
        supabaseService.fetchPengaturanIuran(),
      ]);
      setList(Array.isArray(tagihan.data) ? tagihan.data : []);
      if (tagihan.error) setError(tagihan.error);
      // Setelan hanya mengisi nilai bawaan formulir — kegagalannya tak boleh
      // menutup daftar tagihan, cukup jatuh ke nilai bawaan.
      if (setelan.data) setPengaturan(setelan.data);
      else if (setelan.error) console.warn('Setelan iuran tidak terbaca:', setelan.error);
    } catch (err) {
      console.error('Gagal memuat iuran:', err);
      setList([]);
      setError(`Gagal memuat iuran: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Realtime — daftar ikut ter-refresh saat warga mengunggah bukti.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeIuranRealtime(() => { void loadData(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch (err) {
      console.warn('Kanal realtime iuran tidak dapat dibuka:', err);
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadData]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const wargaTerurut = useMemo(
    () => [...wargaList].sort((a, b) => a.nama.localeCompare(b.nama, 'id')),
    [wargaList]
  );

  const wargaMap = useMemo(() => {
    const map = new Map<string, Warga>();
    wargaList.forEach(w => map.set(w.id, w));
    return map;
  }, [wargaList]);

  const namaWargaOf = useCallback(
    (id: string): string => wargaMap.get(id)?.nama || 'Warga tidak dikenal',
    [wargaMap]
  );

  const ringkasan = useMemo(() => {
    let total = 0;
    let terkumpul = 0;
    let tertunggak = 0;
    let menunggu = 0;
    for (const t of list) {
      total += t.jumlah;
      if (t.status === 'LUNAS') terkumpul += t.jumlah;
      if (t.status === 'BELUM_LUNAS' || t.status === 'DITOLAK') tertunggak += t.jumlah;
      if (t.status === 'MENUNGGU_VERIFIKASI') menunggu += 1;
    }
    return { total, terkumpul, tertunggak, menunggu };
  }, [list]);

  const periodeOpsi = useMemo(
    () => Array.from(new Set(list.map(t => t.periode))).sort().reverse(),
    [list]
  );

  const filtered = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return list.filter(t => {
      if (filterStatus !== 'SEMUA' && t.status !== filterStatus) return false;
      if (filterPeriode !== 'SEMUA' && t.periode !== filterPeriode) return false;
      if (q && !`${namaWargaOf(t.wargaId)} ${t.judul}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, filterStatus, filterPeriode, cari, namaWargaOf]);

  // ── aksi ───────────────────────────────────────────────────────────────────
  const bukaTambah = () => { setEditing(null); setShowForm(true); };
  const bukaEdit = (t: TagihanIuran) => { setEditing(t); setShowForm(true); };

  const handleSimpan = async (input: TagihanIuranInput): Promise<boolean> => {
    const payload: TagihanIuranInput = editing ? { ...input, id: editing.id } : input;
    const result = await supabaseService.simpanTagihan(payload);
    if (result.success) {
      showToast(editing ? 'Tagihan diperbarui.' : 'Tagihan ditambahkan.');
      await loadData();
      return true;
    }
    showToast(`Gagal menyimpan: ${result.error}`, 'err');
    return false;
  };

  const handleMassal = async (params: {
    periode: string;
    judul: string;
    jumlah: number;
    jatuhTempo?: string | null;
    wargaIds: string[];
  }): Promise<boolean> => {
    const result = await supabaseService.generateIuranMassal(params);
    if (result.success) {
      // `dibuat: 0` bukan kegagalan — artinya semua warga terpilih sudah punya
      // tagihan untuk judul + periode itu (aman diulang).
      showToast(
        result.dibuat
          ? `${result.dibuat} tagihan dibuat untuk ${namaBulan(params.periode)}.`
          : 'Tidak ada tagihan baru — semua warga terpilih sudah punya tagihan periode ini.'
      );
      await loadData();
      return true;
    }
    showToast(`Gagal membuat tagihan: ${result.error}`, 'err');
    return false;
  };

  const handleKeputusan = async (keputusan: 'LUNAS' | 'DITOLAK', catatan?: string): Promise<boolean> => {
    if (!verifikasi) return false;
    const result = await supabaseService.verifikasiIuran(verifikasi.id, keputusan, catatan);
    if (result.success) {
      showToast(keputusan === 'LUNAS' ? 'Pembayaran disetujui — tagihan lunas.' : 'Pembayaran ditolak.');
      await loadData();
      return true;
    }
    showToast(`Verifikasi gagal: ${result.error}`, 'err');
    return false;
  };

  const handleSetelan = async (input: PengaturanIuran): Promise<boolean> => {
    const result = await supabaseService.simpanPengaturanIuran(input);
    if (result.success) {
      setPengaturan(input);
      showToast('Setelan iuran disimpan.');
      return true;
    }
    showToast(`Gagal menyimpan setelan: ${result.error}`, 'err');
    return false;
  };

  const handleHapus = async (t: TagihanIuran) => {
    const yakin = await askConfirm({
      title: 'Hapus tagihan?',
      message: `Tagihan "${t.judul}" ${namaBulan(t.periode)} sebesar ${formatRupiah(t.jumlah)} milik ${namaWargaOf(t.wargaId)} akan dihapus permanen.`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
    });
    if (!yakin) return;
    setBusyId(t.id);
    const result = await supabaseService.hapusTagihan(t.id);
    if (result.success) {
      setList(prev => prev.filter(x => x.id !== t.id));
      showToast('Tagihan dihapus.');
    } else {
      showToast(`Gagal menghapus: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const toggleStatus = (s: FilterStatus) =>
    setFilterStatus(prev => (prev === s ? 'SEMUA' : s));

  return (
    <div className="space-y-6">
      {dialog}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`px-4 py-3 rounded-full shadow-lg border text-xs font-semibold flex items-center gap-2 ${
            toast.tone === 'ok'
              ? 'bg-emerald-900 border-emerald-800 text-emerald-100'
              : 'bg-rose-900 border-rose-800 text-rose-100'
          }`}>
            {toast.tone === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {showForm && (
        <TagihanFormModal
          awal={editing
            ? {
                id: editing.id,
                wargaId: editing.wargaId,
                judul: editing.judul,
                periode: editing.periode,
                jumlah: editing.jumlah,
                jatuhTempo: editing.jatuhTempo || null,
              }
            : {
                wargaId: '',
                judul: pengaturan.judulDefault || JUDUL_BAWAAN,
                periode: bulanIni(),
                jumlah: pengaturan.nominalDefault || 0,
                jatuhTempo: null,
              }}
          isEdit={!!editing}
          wargaTerurut={wargaTerurut}
          namaWargaEdit={editing ? namaWargaOf(editing.wargaId) : undefined}
          onClose={() => setShowForm(false)}
          onSubmit={handleSimpan}
        />
      )}

      {showMassal && (
        <GenerateMassalModal
          wargaTerurut={wargaTerurut}
          pengaturan={pengaturan}
          onClose={() => setShowMassal(false)}
          onSubmit={handleMassal}
        />
      )}

      {verifikasi && (
        <VerifikasiModal
          tagihan={verifikasi}
          namaWarga={namaWargaOf(verifikasi.wargaId)}
          onClose={() => setVerifikasi(null)}
          onKeputusan={handleKeputusan}
        />
      )}

      {showSetelan && (
        <SetelanModal
          awal={pengaturan}
          onClose={() => setShowSetelan(false)}
          onSubmit={handleSetelan}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Coins className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Iuran RT</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Terbitkan tagihan iuran per warga, lalu verifikasi bukti transfer yang mereka unggah
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setShowSetelan(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition shadow-sm"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Setelan</span>
              </button>
              <button
                onClick={() => setShowMassal(true)}
                disabled={!adaWarga}
                title={adaWarga ? undefined : 'Data warga belum tersedia'}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-sm font-bold text-emerald-700 transition disabled:opacity-50"
              >
                <Users className="w-4 h-4" />
                Generate
              </button>
              <button
                onClick={bukaTambah}
                disabled={!adaWarga}
                title={adaWarga ? undefined : 'Data warga belum tersedia'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-500 text-xs">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Anda dapat melihat daftar tagihan, tetapi hanya <b>pengurus keuangan</b> (Ketua/Sekretaris/Bendahara) yang dapat menerbitkan tagihan atau memverifikasi pembayaran.</span>
        </div>
      )}

      {canManage && !adaWarga && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Data warga belum dimuat, sehingga tagihan belum bisa dibuat. Buka <b>Data Warga</b> lebih dulu untuk menyinkronkan daftar warga.</span>
        </div>
      )}

      {/* Kartu ringkasan — klik untuk memfilter status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => setFilterStatus('SEMUA')}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
            filterStatus === 'SEMUA' ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total Ditagih</span>
          <p className="text-lg font-black text-slate-800 mt-1">{formatRupiah(ringkasan.total)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{list.length} tagihan</p>
        </button>

        <button
          onClick={() => toggleStatus('LUNAS')}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
            filterStatus === 'LUNAS' ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Terkumpul</span>
          <p className="text-lg font-black text-emerald-600 mt-1">{formatRupiah(ringkasan.terkumpul)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">sudah lunas</p>
        </button>

        <button
          onClick={() => toggleStatus('BELUM_LUNAS')}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
            filterStatus === 'BELUM_LUNAS' ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Belum Lunas</span>
          <p className="text-lg font-black text-amber-600 mt-1">{formatRupiah(ringkasan.tertunggak)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">termasuk yang ditolak</p>
        </button>

        <button
          onClick={() => toggleStatus('MENUNGGU_VERIFIKASI')}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
            filterStatus === 'MENUNGGU_VERIFIKASI' ? 'bg-sky-50 border-sky-300' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Perlu Diperiksa</span>
          <p className="text-lg font-black text-sky-600 mt-1">{ringkasan.menunggu}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">bukti menunggu verifikasi</p>
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as FilterStatus)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        >
          <option value="SEMUA">Semua status</option>
          {STATUS_URUT.map(s => (
            <option key={s} value={s}>{IURAN_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={filterPeriode}
          onChange={e => setFilterPeriode(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        >
          <option value="SEMUA">Semua periode</option>
          {periodeOpsi.map(p => (
            <option key={p} value={p}>{namaBulan(p)}</option>
          ))}
        </select>
        <input
          type="search"
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari nama warga / judul…"
          className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        />
        <span className="text-xs text-slate-400 font-medium">{filtered.length} tagihan</span>
      </div>

      {/* Konten */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat data iuran…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Coins className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">
              {list.length === 0 ? 'Belum ada tagihan iuran' : 'Tidak ada tagihan yang cocok'}
            </p>
            <p className="text-xs mt-1">
              {list.length === 0
                ? 'Gunakan “Generate” untuk menerbitkan tagihan sebulan ke banyak warga sekaligus'
                : 'Coba ubah status, periode, atau kata kunci'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
          {filtered.map(t => {
            const isBusy = busyId === t.id;
            const tone = IURAN_TONE[t.status];
            const terlambat = isTerlambat(t);
            return (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${statusDot(tone)}`} aria-hidden />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{namaWargaOf(t.wargaId)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {t.judul} · {namaBulan(t.periode)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusBadge(tone)}`}>
                      {IURAN_LABEL[t.status]}
                    </span>
                    {t.jatuhTempo && (
                      <span className={`text-[11px] font-medium ${terlambat ? 'text-rose-600' : 'text-slate-400'}`}>
                        {terlambat ? 'Terlambat sejak ' : 'Jatuh tempo '}
                        {formatTanggalRingkas(t.jatuhTempo)}
                      </span>
                    )}
                    {t.status === 'LUNAS' && t.verifiedAt && (
                      <span className="text-[11px] text-slate-400">
                        Disetujui {formatTanggalRingkas(String(t.verifiedAt).slice(0, 10))}
                      </span>
                    )}
                  </div>
                  {t.status === 'DITOLAK' && t.catatan && (
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-600">
                      Alasan ditolak: {t.catatan}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-black text-slate-800">{formatRupiah(t.jumlah)}</p>
                  {canManage && (
                    <div className="mt-1.5 flex items-center justify-end gap-1">
                      {t.status === 'MENUNGGU_VERIFIKASI' && (
                        <button
                          onClick={() => setVerifikasi(t)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-sky-700 disabled:opacity-40"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Periksa
                        </button>
                      )}
                      <button
                        onClick={() => bukaEdit(t)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-40"
                        aria-label="Ubah tagihan"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleHapus(t)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                        aria-label="Hapus tagihan"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
