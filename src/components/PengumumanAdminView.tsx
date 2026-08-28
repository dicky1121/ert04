import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { CurrentUser, KATEGORI_PENGUMUMAN_OPSI, Pengumuman, PengumumanInput } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useConfirm } from './ConfirmDialog';

interface PengumumanAdminViewProps {
  currentUser: CurrentUser;
}

type FilterPublikasi = 'SEMUA' | 'TERBIT' | 'DRAF';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Warna per kategori — disamakan dengan tampilan warga
 * ([WargaDashboard.tsx](warga/WargaDashboard.tsx)) supaya pengurus melihat
 * pengumumannya dalam rupa yang sama seperti yang diterima warga.
 */
const KATEGORI_TONE: Record<string, { bar: string; chip: string }> = {
  DARURAT: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
  KEAMANAN: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  KESEHATAN: { bar: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
  KEGIATAN: { bar: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 border-sky-200' },
  IURAN: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  UMUM: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const toneKategori = (kategori: string) =>
  KATEGORI_TONE[String(kategori).toUpperCase()] ?? KATEGORI_TONE.UMUM;

const formatTanggal = (ymd: string): string => {
  if (!ymd) return '-';
  // Tambahkan waktu lokal agar tidak bergeser hari karena zona waktu.
  const d = new Date(`${ymd}T00:00:00`);
  if (isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const hariIniYmd = (): string => {
  const d = new Date();
  const bulan = String(d.getMonth() + 1).padStart(2, '0');
  const tanggal = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${bulan}-${tanggal}`;
};

/**
 * Apakah pengumuman ini benar-benar tampil ke warga HARI INI.
 * RPC `pengumuman_publik()` menyaring dengan tanggal juga, bukan hanya flag
 * `dipublikasikan` — jadi status "Terbit" saja bisa menyesatkan bila masa
 * tayangnya sudah lewat atau belum dimulai.
 */
const statusTayang = (p: Pengumuman): 'TAMPIL' | 'BELUM_MULAI' | 'KEDALUWARSA' | 'DRAF' => {
  if (!p.dipublikasikan) return 'DRAF';
  const kini = hariIniYmd();
  if (p.tanggalMulai && p.tanggalMulai > kini) return 'BELUM_MULAI';
  if (p.tanggalSelesai && p.tanggalSelesai < kini) return 'KEDALUWARSA';
  return 'TAMPIL';
};

const kosongInput = (): PengumumanInput => ({
  judul: '',
  isi: '',
  kategori: 'UMUM',
  dipublikasikan: true,
  tanggalMulai: hariIniYmd(),
  tanggalSelesai: null,
});

// ── modal form tambah / ubah ─────────────────────────────────────────────────
const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

const PengumumanFormModal: React.FC<{
  awal: PengumumanInput;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (input: PengumumanInput) => Promise<boolean>;
}> = ({ awal, isEdit, onClose, onSubmit }) => {
  const [form, setForm] = useState<PengumumanInput>(awal);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setField = <K extends keyof PengumumanInput>(key: K, value: PengumumanInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Kategori tak dikenal (mis. data lama) tetap ditawarkan agar membuka modal
  // tidak diam-diam menimpanya menjadi 'UMUM'.
  const opsiKategori = useMemo<string[]>(() => {
    const kini = String(form.kategori || '').toUpperCase();
    return kini && !(KATEGORI_PENGUMUMAN_OPSI as string[]).includes(kini)
      ? [...KATEGORI_PENGUMUMAN_OPSI, kini]
      : [...KATEGORI_PENGUMUMAN_OPSI];
  }, [form.kategori]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judul.trim()) { setFormError('Judul pengumuman wajib diisi.'); return; }
    if (!form.isi.trim()) { setFormError('Isi pengumuman wajib diisi.'); return; }
    if (!form.tanggalMulai) { setFormError('Tanggal mulai tayang wajib diisi.'); return; }
    if (form.tanggalSelesai && form.tanggalSelesai < form.tanggalMulai) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Ubah pengumuman' : 'Tambah pengumuman'}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {isEdit ? 'Ubah Pengumuman' : 'Tambah Pengumuman'}
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
            <label className={labelCls} htmlFor="peng-judul">Judul pengumuman *</label>
            <input
              id="peng-judul"
              type="text"
              value={form.judul}
              onChange={e => setField('judul', e.target.value)}
              placeholder="mis. Jadwal Kerja Bakti Bulan Ini"
              className={inputCls}
              maxLength={200}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="peng-kategori">Kategori</label>
            <select
              id="peng-kategori"
              value={form.kategori}
              onChange={e => setField('kategori', e.target.value)}
              className={inputCls}
            >
              {opsiKategori.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="peng-mulai">Mulai tayang *</label>
              <input
                id="peng-mulai"
                type="date"
                value={form.tanggalMulai}
                onChange={e => setField('tanggalMulai', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="peng-selesai">Selesai tayang</label>
              <input
                id="peng-selesai"
                type="date"
                value={form.tanggalSelesai ?? ''}
                onChange={e => setField('tanggalSelesai', e.target.value || null)}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-1">Kosongkan bila tanpa batas waktu.</p>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="peng-isi">Isi pengumuman *</label>
            <textarea
              id="peng-isi"
              value={form.isi}
              onChange={e => setField('isi', e.target.value)}
              placeholder="Tulis isi pengumuman selengkapnya…"
              rows={6}
              className={`${inputCls} resize-none`}
              maxLength={4000}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              {form.isi.length}/4000 karakter. Notifikasi hanya memuat ±140 karakter pertama.
            </p>
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
                Bila dimatikan, pengumuman hanya tersimpan sebagai draf dan tidak muncul di
                dashboard warga.
              </span>
            </span>
          </label>

          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 text-xs">
            <BellRing className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <span>
              Menyimpan pengumuman <strong>tidak</strong> mengirim notifikasi. Setelah tersimpan,
              tekan tombol <strong>Siarkan</strong> di kartunya bila ingin memberi tahu warga
              lewat notifikasi HP.
            </span>
          </div>

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
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Pengumuman'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── komponen utama ───────────────────────────────────────────────────────────
export const PengumumanAdminView: React.FC<PengumumanAdminViewProps> = ({ currentUser }) => {
  const [list, setList] = useState<Pengumuman[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterPublikasi>('SEMUA');
  const [cari, setCari] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Pengumuman | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [siarId, setSiarId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { confirm: askConfirm, dialog } = useConfirm();

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  };

  const canManage = currentUser?.role !== 'WARGA';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseService.fetchPengumuman();
      setList(Array.isArray(data) ? data : []);
      if (fetchError) setError(fetchError);
    } catch (err) {
      console.error('Gagal memuat pengumuman:', err);
      setList([]);
      setError(`Gagal memuat pengumuman: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const bukaTambah = () => { setEditing(null); setShowForm(true); };
  const bukaEdit = (p: Pengumuman) => { setEditing(p); setShowForm(true); };

  const handleSubmit = async (input: PengumumanInput): Promise<boolean> => {
    const payload: PengumumanInput = editing ? { ...input, id: editing.id } : input;
    const result = await supabaseService.simpanPengumuman(payload);
    if (result.success) {
      showToast(editing ? 'Pengumuman diperbarui.' : 'Pengumuman ditambahkan.');
      await loadData();
      return true;
    }
    showToast(`Gagal menyimpan: ${result.error}`, 'err');
    return false;
  };

  const handleHapus = async (p: Pengumuman) => {
    const yakin = await askConfirm({
      title: 'Hapus pengumuman?',
      message: `Pengumuman "${p.judul}" akan dihapus permanen dan tidak lagi terlihat oleh warga.`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
    });
    if (!yakin) return;
    setBusyId(p.id);
    const result = await supabaseService.hapusPengumuman(p.id);
    if (result.success) {
      setList(prev => prev.filter(x => x.id !== p.id));
      showToast('Pengumuman dihapus.');
    } else {
      showToast(`Gagal menghapus: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const handleTogglePublish = async (p: Pengumuman) => {
    setBusyId(p.id);
    const result = await supabaseService.simpanPengumuman({
      id: p.id,
      judul: p.judul,
      isi: p.isi,
      kategori: p.kategori,
      dipublikasikan: !p.dipublikasikan,
      tanggalMulai: p.tanggalMulai,
      tanggalSelesai: p.tanggalSelesai,
    });
    if (result.success) {
      setList(prev => prev.map(x => x.id === p.id ? { ...x, dipublikasikan: !x.dipublikasikan } : x));
      showToast(p.dipublikasikan ? 'Pengumuman disembunyikan dari warga.' : 'Pengumuman ditampilkan ke warga.');
    } else {
      showToast(`Gagal mengubah status: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  /**
   * Siarkan sebagai notifikasi HP. Sengaja pakai konfirmasi: sekali terkirim
   * notifikasi tidak bisa ditarik kembali dari HP warga.
   */
  const handleSiarkan = async (p: Pengumuman) => {
    const yakin = await askConfirm({
      title: 'Siarkan ke semua HP warga?',
      message:
        `Notifikasi "${p.judul}" akan dikirim ke seluruh HP yang sudah memasang aplikasi. ` +
        'Notifikasi yang sudah terkirim tidak dapat ditarik kembali.',
      confirmLabel: 'Ya, Siarkan',
      tone: 'warning',
    });
    if (!yakin) return;
    setSiarId(p.id);
    const result = await supabaseService.siarkanPengumuman(p.id);
    if (result.success) {
      const total = result.total ?? 0;
      showToast(
        total === 0
          ? 'Belum ada HP terdaftar, jadi tidak ada notifikasi yang dikirim.'
          : `Notifikasi terkirim ke ${result.terkirim ?? 0} dari ${total} HP.`,
        total === 0 ? 'err' : 'ok'
      );
    } else {
      showToast(`Gagal menyiarkan: ${result.error}`, 'err');
    }
    setSiarId(null);
  };

  const terbitCount = list.filter(p => p.dipublikasikan).length;
  const drafCount = list.length - terbitCount;

  const filteredList = list.filter(p => {
    if (filter === 'TERBIT' && !p.dipublikasikan) return false;
    if (filter === 'DRAF' && p.dipublikasikan) return false;
    const q = cari.trim().toLowerCase();
    if (q && !(`${p.judul} ${p.isi} ${p.kategori}`.toLowerCase().includes(q))) return false;
    return true;
  });

  const STAT: { key: FilterPublikasi; label: string; value: number; dot: string }[] = [
    { key: 'SEMUA', label: 'Total', value: list.length, dot: 'bg-slate-400' },
    { key: 'TERBIT', label: 'Terbit', value: terbitCount, dot: 'bg-emerald-500' },
    { key: 'DRAF', label: 'Draf', value: drafCount, dot: 'bg-amber-400' },
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

      {showForm && (
        <PengumumanFormModal
          awal={editing
            ? {
                id: editing.id,
                judul: editing.judul,
                isi: editing.isi,
                kategori: editing.kategori,
                dipublikasikan: editing.dipublikasikan,
                tanggalMulai: editing.tanggalMulai,
                tanggalSelesai: editing.tanggalSelesai,
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
              <Megaphone className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Pengumuman RT</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Kelola pengumuman di dashboard warga &amp; siarkan sebagai notifikasi HP
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

      {/* Stat cards — sekaligus filter */}
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
            <p className="text-2xl font-black text-slate-900 tabular-nums">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari judul / isi / kategori…"
          className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        />
        <span className="text-xs text-slate-400 font-medium">{filteredList.length} pengumuman</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat pengumuman…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Megaphone className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">
              {list.length === 0 ? 'Belum ada pengumuman' : 'Tidak ada pengumuman yang cocok'}
            </p>
            <p className="text-xs mt-1">
              {list.length === 0
                ? 'Tambahkan pengumuman agar bagian "Pengumuman Terbaru" di dashboard warga terisi'
                : 'Coba ubah kata kunci atau filter'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredList.map(p => {
            const isBusy = busyId === p.id;
            const isSiar = siarId === p.id;
            const tone = toneKategori(p.kategori);
            const tayang = statusTayang(p);
            return (
              <article
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition hover:shadow-md flex ${
                  p.dipublikasikan ? 'border-slate-200' : 'border-amber-200'
                }`}
              >
                <div className={`w-1.5 shrink-0 ${tone.bar}`} aria-hidden="true" />
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="px-4 py-3 space-y-2.5 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{p.judul}</h3>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                        p.dipublikasikan
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {p.dipublikasikan ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {p.dipublikasikan ? 'Terbit' : 'Draf'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${tone.chip}`}>
                        {String(p.kategori).toUpperCase()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        {formatTanggal(p.tanggalMulai)}
                        {p.tanggalSelesai ? ` – ${formatTanggal(p.tanggalSelesai)}` : ''}
                      </span>
                    </div>

                    {/* Peringatan masa tayang: "Terbit" saja belum menjamin warga melihatnya. */}
                    {tayang === 'BELUM_MULAI' && (
                      <p className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5">
                        Belum tampil — tanggal mulai tayang masih di depan.
                      </p>
                    )}
                    {tayang === 'KEDALUWARSA' && (
                      <p className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        Masa tayang sudah lewat — tidak lagi muncul di dashboard warga.
                      </p>
                    )}

                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">
                      {p.isi}
                    </p>
                  </div>

                  {canManage && (
                    <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleSiarkan(p)}
                        disabled={isSiar || isBusy || !p.dipublikasikan}
                        title={p.dipublikasikan ? 'Kirim notifikasi ke semua HP warga' : 'Terbitkan dulu sebelum menyiarkan'}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSiar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {isSiar ? 'Menyiarkan…' : 'Siarkan'}
                      </button>
                      <button
                        onClick={() => handleTogglePublish(p)}
                        disabled={isBusy || isSiar}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.dipublikasikan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {p.dipublikasikan ? 'Sembunyikan' : 'Tampilkan'}
                      </button>
                      <button
                        onClick={() => bukaEdit(p)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Ubah
                      </button>
                      <button
                        onClick={() => handleHapus(p)}
                        disabled={isBusy || isSiar}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-40 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
