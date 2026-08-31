import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  CurrentUser,
  JenisKeuangan,
  KEUANGAN_KATEGORI_KELUAR,
  KEUANGAN_KATEGORI_MASUK,
  TransaksiKeuangan,
  TransaksiKeuanganInput,
} from '../types';
import { supabaseService } from '../services/supabaseService';
import { formatRupiah, hitungRingkasan, namaBulan, formatTanggalRingkas } from '../utils/keuangan';
import { ROLE_PENGURUS_KEUANGAN } from '../utils/roles';
import { useConfirm } from './ConfirmDialog';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface KeuanganAdminViewProps {
  currentUser: CurrentUser;
}

type FilterJenis = 'SEMUA' | 'MASUK' | 'KELUAR';

// ── helpers ──────────────────────────────────────────────────────────────────
const hariIni = (): string => new Date().toISOString().slice(0, 10);

const kosongInput = (): TransaksiKeuanganInput => ({
  tanggal: hariIni(),
  jenis: 'MASUK',
  kategori: KEUANGAN_KATEGORI_MASUK[0],
  jumlah: 0,
  keterangan: '',
});

const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

// ── modal form tambah / edit ────────────────────────────────────────────────────
const KeuanganFormModal: React.FC<{
  awal: TransaksiKeuanganInput;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (input: TransaksiKeuanganInput) => Promise<boolean>;
}> = ({ awal, isEdit, onClose, onSubmit }) => {
  const [form, setForm] = useState<TransaksiKeuanganInput>(awal);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setField = <K extends keyof TransaksiKeuanganInput>(key: K, value: TransaksiKeuanganInput[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const kategoriOpsi = form.jenis === 'MASUK' ? KEUANGAN_KATEGORI_MASUK : KEUANGAN_KATEGORI_KELUAR;

  const gantiJenis = (jenis: JenisKeuangan) => {
    const opsi = jenis === 'MASUK' ? KEUANGAN_KATEGORI_MASUK : KEUANGAN_KATEGORI_KELUAR;
    setForm(prev => ({
      ...prev,
      jenis,
      kategori: opsi.includes(prev.kategori) ? prev.kategori : opsi[0],
    }));
  };

  const handleJumlah = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    setField('jumlah', digits ? Number(digits) : 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tanggal) { setFormError('Tanggal transaksi wajib diisi.'); return; }
    if (!form.jumlah || form.jumlah <= 0) { setFormError('Nominal harus lebih dari 0.'); return; }
    if (!form.kategori.trim()) { setFormError('Kategori wajib dipilih.'); return; }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok) onClose();
  };

  const isMasuk = form.jenis === 'MASUK';
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Ubah transaksi' : 'Tambah transaksi'}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">
              {isEdit ? 'Ubah Transaksi' : 'Tambah Transaksi'}
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
          {/* Jenis (segmented) */}
          <div>
            <label className={labelCls}>Jenis transaksi *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => gantiJenis('MASUK')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                  isMasuk
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Pemasukan
              </button>
              <button
                type="button"
                onClick={() => gantiJenis('KELUAR')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                  !isMasuk
                    ? 'border-rose-400 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Pengeluaran
              </button>
            </div>
          </div>

          {/* Nominal */}
          <div>
            <label className={labelCls} htmlFor="keu-jumlah">Nominal (Rp) *</label>
            <input
              id="keu-jumlah"
              type="text"
              inputMode="numeric"
              value={form.jumlah ? form.jumlah.toLocaleString('id-ID') : ''}
              onChange={e => handleJumlah(e.target.value)}
              placeholder="mis. 50.000"
              className={`${inputCls} font-bold`}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="keu-tanggal">Tanggal *</label>
              <input
                id="keu-tanggal"
                type="date"
                value={form.tanggal}
                onChange={e => setField('tanggal', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="keu-kategori">Kategori *</label>
              <select
                id="keu-kategori"
                value={form.kategori}
                onChange={e => setField('kategori', e.target.value)}
                className={inputCls}
              >
                {kategoriOpsi.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="keu-keterangan">Keterangan</label>
            <textarea
              id="keu-keterangan"
              value={form.keterangan}
              onChange={e => setField('keterangan', e.target.value)}
              placeholder="Keterangan singkat (mis. Iuran kas bulan Agustus)…"
              rows={2}
              className={`${inputCls} resize-none`}
              maxLength={300}
            />
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
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── komponen utama ────────────────────────────────────────────────────────────
export const KeuanganAdminView: React.FC<KeuanganAdminViewProps> = ({ currentUser }) => {
  const [list, setList] = useState<TransaksiKeuangan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterJenis, setFilterJenis] = useState<FilterJenis>('SEMUA');
  const [filterBulan, setFilterBulan] = useState<string>('SEMUA');
  const [cari, setCari] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TransaksiKeuangan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { confirm: askConfirm, dialog } = useConfirm();

  const canManage = ROLE_PENGURUS_KEUANGAN.includes(String(currentUser?.role));

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseService.fetchKeuangan();
      setList(Array.isArray(data) ? data : []);
      if (fetchError) setError(fetchError);
    } catch (err) {
      console.error('Gagal memuat keuangan:', err);
      setList([]);
      setError(`Gagal memuat keuangan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Realtime — daftar ikut ter-refresh saat ada perubahan dari perangkat lain.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeKeuanganRealtime(() => { void loadData(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch (err) {
      console.warn('Kanal realtime keuangan tidak dapat dibuka:', err);
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadData]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const bukaTambah = () => { setEditing(null); setShowForm(true); };
  const bukaEdit = (t: TransaksiKeuangan) => { setEditing(t); setShowForm(true); };

  const handleSubmit = async (input: TransaksiKeuanganInput): Promise<boolean> => {
    const payload: TransaksiKeuanganInput = editing ? { ...input, id: editing.id } : input;
    const result = await supabaseService.simpanKeuangan(payload);
    if (result.success) {
      showToast(editing ? 'Transaksi diperbarui.' : 'Transaksi ditambahkan.');
      await loadData();
      return true;
    }
    showToast(`Gagal menyimpan: ${result.error}`, 'err');
    return false;
  };

  const handleHapus = async (t: TransaksiKeuangan) => {
    const yakin = await askConfirm({
      title: 'Hapus transaksi?',
      message: `Transaksi ${t.jenis === 'MASUK' ? 'pemasukan' : 'pengeluaran'} "${t.kategori}" sebesar ${formatRupiah(t.jumlah)} akan dihapus permanen.`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
    });
    if (!yakin) return;
    setBusyId(t.id);
    const result = await supabaseService.hapusKeuangan(t.id);
    if (result.success) {
      setList(prev => prev.filter(x => x.id !== t.id));
      showToast('Transaksi dihapus.');
    } else {
      showToast(`Gagal menghapus: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const ringkasan = useMemo(() => hitungRingkasan(list), [list]);
  const bulanOpsi = ringkasan.perBulan.map(b => b.bulan);

  const filtered = list.filter(t => {
    if (filterJenis !== 'SEMUA' && t.jenis !== filterJenis) return false;
    if (filterBulan !== 'SEMUA' && t.bulanKas !== filterBulan) return false;
    const q = cari.trim().toLowerCase();
    if (q && !(`${t.kategori} ${t.keterangan}`.toLowerCase().includes(q))) return false;
    return true;
  });

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
        <KeuanganFormModal
          awal={editing
            ? {
                id: editing.id,
                tanggal: editing.tanggal,
                jenis: editing.jenis,
                kategori: editing.kategori,
                jumlah: editing.jumlah,
                keterangan: editing.keterangan,
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
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Keuangan RT</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Catatan kas RT — ringkasan pemasukan, pengeluaran &amp; saldo yang tampil transparan ke warga
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

      {!canManage && (
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-500 text-xs">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Anda dapat melihat catatan kas, tetapi hanya <b>pengurus keuangan</b> (Ketua/Sekretaris/Bendahara) yang dapat menambah atau mengubah transaksi.</span>
        </div>
      )}

      {/* Kartu saldo utama */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-100/90">Saldo Kas RT</p>
        <p className="text-3xl font-black mt-1">{formatRupiah(ringkasan.saldo)}</p>
        <p className="text-xs text-emerald-100/80 mt-1">
          Saldo berjalan dari seluruh {list.length} transaksi tercatat
        </p>
      </div>

      {/* Kartu masuk / keluar (klik = filter) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setFilterJenis(filterJenis === 'MASUK' ? 'SEMUA' : 'MASUK')}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
            filterJenis === 'MASUK' ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pemasukan</span>
          </div>
          <p className="text-lg font-black text-emerald-600">{formatRupiah(ringkasan.totalMasuk)}</p>
        </button>
        <button
          onClick={() => setFilterJenis(filterJenis === 'KELUAR' ? 'SEMUA' : 'KELUAR')}
          className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${
            filterJenis === 'KELUAR' ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pengeluaran</span>
          </div>
          <p className="text-lg font-black text-rose-600">{formatRupiah(ringkasan.totalKeluar)}</p>
        </button>
      </div>

      {/* Filter bulan + pencarian */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterBulan}
          onChange={e => setFilterBulan(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        >
          <option value="SEMUA">Semua bulan</option>
          {bulanOpsi.map(b => (
            <option key={b} value={b}>{namaBulan(b)}</option>
          ))}
        </select>
        <input
          type="search"
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari kategori / keterangan…"
          className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        />
        <span className="text-xs text-slate-400 font-medium">{filtered.length} transaksi</span>
      </div>

      {/* Konten */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat data keuangan…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">
              {list.length === 0 ? 'Belum ada transaksi' : 'Tidak ada transaksi yang cocok'}
            </p>
            <p className="text-xs mt-1">
              {list.length === 0
                ? 'Tambahkan transaksi kas agar ringkasan tampil di dashboard warga'
                : 'Coba ubah filter, bulan, atau kata kunci'}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
          {filtered.map(t => {
            const isBusy = busyId === t.id;
            const isMasuk = t.jenis === 'MASUK';
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  isMasuk ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {isMasuk ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{t.kategori}</p>
                  {t.keterangan && (
                    <p className="truncate text-xs text-slate-500">{t.keterangan}</p>
                  )}
                  <p className="text-[11px] text-slate-400">{formatTanggalRingkas(t.tanggal)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black ${isMasuk ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isMasuk ? '+' : '−'}{formatRupiah(t.jumlah)}
                  </p>
                  {canManage && (
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <button
                        onClick={() => bukaEdit(t)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition disabled:opacity-40"
                        aria-label="Ubah transaksi"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleHapus(t)}
                        disabled={isBusy}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                        aria-label="Hapus transaksi"
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
