import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { CurrentUser, Kegiatan, KegiatanInput } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useConfirm } from './ConfirmDialog';
import { useModalDismiss } from '../hooks/useModalDismiss';
import { formatTanggalPanjang } from '../utils/tanggal';

interface KegiatanAdminViewProps {
  currentUser: CurrentUser;
}

type FilterPublikasi = 'SEMUA' | 'TERBIT' | 'TERSEMBUNYI';

const kosongInput = (): KegiatanInput => ({
  judul: '',
  deskripsi: '',
  tanggal: '',
  waktu: '',
  lokasi: '',
  dipublikasikan: true,
  fotoFile: null,
  fotoUrl: null,
});

// ── modal foto (lightbox) ──────────────────────────────────────────────────────
const FotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  const ref = useModalDismiss<HTMLDivElement>(onClose);
  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Foto kegiatan"
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
        onClick={onClose}
        aria-label="Tutup foto"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={url}
        alt="Foto kegiatan"
        loading="lazy"
        className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// ── modal form tambah / edit ────────────────────────────────────────────────────
const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

const KegiatanFormModal: React.FC<{
  awal: KegiatanInput;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (input: KegiatanInput) => Promise<boolean>;
}> = ({ awal, isEdit, onClose, onSubmit }) => {
  const [form, setForm] = useState<KegiatanInput>(awal);
  const [preview, setPreview] = useState<string | null>(awal.fotoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const setField = <K extends keyof KegiatanInput>(key: K, value: KegiatanInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleFile = (file: File | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (file) {
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPreview(url);
      setField('fotoFile', file);
    } else {
      setField('fotoFile', null);
      setPreview(form.fotoUrl ?? null);
    }
  };

  const hapusFoto = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(null);
    setForm(prev => ({ ...prev, fotoFile: null, fotoUrl: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judul.trim()) { setFormError('Judul kegiatan wajib diisi.'); return; }
    if (!form.tanggal) { setFormError('Tanggal kegiatan wajib diisi.'); return; }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok) onClose();
  };

  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Ubah kegiatan' : 'Tambah kegiatan'}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CalendarPlus className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {isEdit ? 'Ubah Kegiatan' : 'Tambah Kegiatan'}
            </h3>
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

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className={labelCls} htmlFor="keg-judul">Judul kegiatan *</label>
            <input
              id="keg-judul"
              type="text"
              value={form.judul}
              onChange={e => setField('judul', e.target.value)}
              placeholder="mis. Kerja Bakti Bulanan"
              className={inputCls}
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="keg-tanggal">Tanggal *</label>
              <input
                id="keg-tanggal"
                type="date"
                value={form.tanggal}
                onChange={e => setField('tanggal', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="keg-waktu">Waktu</label>
              <input
                id="keg-waktu"
                type="text"
                value={form.waktu}
                onChange={e => setField('waktu', e.target.value)}
                placeholder="mis. 08:00 WIB"
                className={inputCls}
                maxLength={40}
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="keg-lokasi">Lokasi</label>
            <input
              id="keg-lokasi"
              type="text"
              value={form.lokasi}
              onChange={e => setField('lokasi', e.target.value)}
              placeholder="mis. Balai RT / Lapangan"
              className={inputCls}
              maxLength={120}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="keg-deskripsi">Deskripsi</label>
            <textarea
              id="keg-deskripsi"
              value={form.deskripsi}
              onChange={e => setField('deskripsi', e.target.value)}
              placeholder="Keterangan singkat kegiatan…"
              rows={3}
              className={`${inputCls} resize-none`}
              maxLength={1000}
            />
          </div>

          {/* Foto */}
          <div>
            <p className={labelCls}>Foto / poster (opsional, maks 2MB)</p>
            {preview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={preview} alt="Pratinjau foto" className="w-full max-h-52 object-cover" />
                <button
                  type="button"
                  onClick={hapusFoto}
                  className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 shadow"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition text-slate-400">
                <ImageIcon className="w-6 h-6" />
                <span className="text-xs font-medium">Pilih foto…</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          {/* Publikasi */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
            <input
              type="checkbox"
              checked={form.dipublikasikan}
              onChange={e => setField('dipublikasikan', e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-600"
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-800">Tampilkan ke warga</span>
              <span className="block text-xs text-slate-500">
                Bila dimatikan, kegiatan hanya tersimpan (draf) dan tidak muncul di dashboard warga.
              </span>
            </span>
          </label>

          {formError && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Kegiatan'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── komponen utama ────────────────────────────────────────────────────────────
export const KegiatanAdminView: React.FC<KegiatanAdminViewProps> = ({ currentUser }) => {
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterPublikasi>('SEMUA');
  const [cari, setCari] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Kegiatan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { confirm: askConfirm, dialog } = useConfirm();

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const canManage = currentUser?.role !== 'WARGA';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseService.fetchKegiatan();
      setKegiatanList(Array.isArray(data) ? data : []);
      if (fetchError) setError(fetchError);
    } catch (err) {
      console.error('Gagal memuat kegiatan:', err);
      setKegiatanList([]);
      setError(`Gagal memuat kegiatan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Realtime — daftar ikut ter-refresh saat ada perubahan dari perangkat lain.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeKegiatanRealtime(() => { void loadData(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch (err) {
      console.warn('Kanal realtime kegiatan tidak dapat dibuka:', err);
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadData]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const bukaTambah = () => { setEditing(null); setShowForm(true); };
  const bukaEdit = (k: Kegiatan) => { setEditing(k); setShowForm(true); };

  const handleSubmit = async (input: KegiatanInput): Promise<boolean> => {
    const payload: KegiatanInput = editing ? { ...input, id: editing.id } : input;
    const result = await supabaseService.simpanKegiatan(payload);
    if (result.success) {
      showToast(editing ? 'Kegiatan diperbarui.' : 'Kegiatan ditambahkan.');
      await loadData();
      return true;
    }
    showToast(`Gagal menyimpan: ${result.error}`, 'err');
    return false;
  };

  const handleHapus = async (k: Kegiatan) => {
    const yakin = await askConfirm({
      title: 'Hapus kegiatan?',
      message: `Kegiatan "${k.judul}" akan dihapus permanen dan tidak lagi terlihat oleh warga.`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
    });
    if (!yakin) return;
    setBusyId(k.id);
    const result = await supabaseService.hapusKegiatan(k.id);
    if (result.success) {
      setKegiatanList(prev => prev.filter(x => x.id !== k.id));
      showToast('Kegiatan dihapus.');
    } else {
      showToast(`Gagal menghapus: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const handleTogglePublish = async (k: Kegiatan) => {
    setBusyId(k.id);
    const result = await supabaseService.simpanKegiatan({
      id: k.id,
      judul: k.judul,
      deskripsi: k.deskripsi,
      tanggal: k.tanggal,
      waktu: k.waktu,
      lokasi: k.lokasi,
      dipublikasikan: !k.dipublikasikan,
      fotoUrl: k.fotoUrl,
    });
    if (result.success) {
      setKegiatanList(prev =>
        prev.map(x => x.id === k.id ? { ...x, dipublikasikan: !x.dipublikasikan } : x)
      );
      showToast(k.dipublikasikan ? 'Kegiatan disembunyikan dari warga.' : 'Kegiatan ditampilkan ke warga.');
    } else {
      showToast(`Gagal mengubah status: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const terbitCount = kegiatanList.filter(k => k.dipublikasikan).length;
  const tersembunyiCount = kegiatanList.length - terbitCount;

  const filteredList = kegiatanList.filter(k => {
    if (filter === 'TERBIT' && !k.dipublikasikan) return false;
    if (filter === 'TERSEMBUNYI' && k.dipublikasikan) return false;
    const q = cari.trim().toLowerCase();
    if (q && !(`${k.judul} ${k.lokasi} ${k.deskripsi}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const STAT: { key: FilterPublikasi; label: string; value: number; dot: string }[] = [
    { key: 'SEMUA', label: 'Total', value: kegiatanList.length, dot: 'bg-slate-400' },
    { key: 'TERBIT', label: 'Terbit', value: terbitCount, dot: 'bg-emerald-500' },
    { key: 'TERSEMBUNYI', label: 'Draf', value: tersembunyiCount, dot: 'bg-amber-400' },
  ];

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

      {fotoUrl && <FotoLightbox url={fotoUrl} onClose={() => setFotoUrl(null)} />}

      {showForm && (
        <KegiatanFormModal
          awal={editing
            ? {
                id: editing.id,
                judul: editing.judul,
                deskripsi: editing.deskripsi,
                tanggal: editing.tanggal,
                waktu: editing.waktu,
                lokasi: editing.lokasi,
                dipublikasikan: editing.dipublikasikan,
                fotoFile: null,
                fotoUrl: editing.fotoUrl,
              }
            : kosongInput()}
          isEdit={!!editing}
          onClose={() => setShowForm(false)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Kegiatan RT</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola jadwal kegiatan &amp; acara lingkungan yang tampil di dashboard warga
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canManage && (
            <button
              onClick={bukaTambah}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Tambah
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {STAT.map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(filter === s.key ? 'SEMUA' : s.key)}
            className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
              filter === s.key && s.key !== 'SEMUA'
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari judul / lokasi…"
          className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        />
        <span className="text-xs text-slate-400 font-medium">{filteredList.length} kegiatan</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat kegiatan…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">
              {kegiatanList.length === 0 ? 'Belum ada kegiatan' : 'Tidak ada kegiatan yang cocok'}
            </p>
            <p className="text-xs mt-1">
              {kegiatanList.length === 0
                ? 'Tambahkan kegiatan agar warga dapat melihat jadwalnya'
                : 'Coba ubah kata kunci atau filter'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredList.map(k => {
            const isBusy = busyId === k.id;
            return (
              <article
                key={k.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition hover:shadow-md flex flex-col ${
                  k.dipublikasikan ? 'border-slate-200' : 'border-amber-200'
                }`}
              >
                {k.fotoUrl && (
                  <button
                    type="button"
                    onClick={() => setFotoUrl(k.fotoUrl!)}
                    className="block w-full h-36 bg-slate-100 overflow-hidden"
                    aria-label="Lihat foto kegiatan"
                  >
                    <img src={k.fotoUrl} alt={k.judul} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition" />
                  </button>
                )}
                <div className="px-4 py-3 space-y-2.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{k.judul}</h3>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                      k.dipublikasikan
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {k.dipublikasikan ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {k.dipublikasikan ? 'Terbit' : 'Draf'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      {formatTanggalPanjang(k.tanggal)}
                    </span>
                    {k.waktu && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {k.waktu}
                      </span>
                    )}
                    {k.lokasi && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {k.lokasi}
                      </span>
                    )}
                  </div>

                  {k.deskripsi && (
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line line-clamp-3">
                      {k.deskripsi}
                    </p>
                  )}
                </div>

                {canManage && (
                  <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleTogglePublish(k)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : k.dipublikasikan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {k.dipublikasikan ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                    <button
                      onClick={() => bukaEdit(k)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Ubah
                    </button>
                    <button
                      onClick={() => handleHapus(k)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-40 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
