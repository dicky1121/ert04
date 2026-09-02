import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Store,
} from 'lucide-react';
import { CurrentUser, UmkmProduk, UmkmProdukInput, UmkmToko, UmkmTokoInput } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useConfirm } from './ConfirmDialog';
import {
  FotoLightbox,
  ProdukFormModal,
  TokoFormModal,
  kosongProdukInput,
  kosongTokoInput,
  produkToInput,
  tokoToInput,
} from './umkm/UmkmForms';
import { TokoKelolaCard } from './umkm/TokoKelolaCard';

interface UmkmAdminViewProps {
  currentUser: CurrentUser;
}

type FilterUmkm = 'SEMUA' | 'PENDING' | 'VERIFIED' | 'DITOLAK';

export const UmkmAdminView: React.FC<UmkmAdminViewProps> = ({ currentUser: _currentUser }) => {
  const [tokoList, setTokoList] = useState<UmkmToko[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterUmkm>('SEMUA');
  const [cari, setCari] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [tokoForm, setTokoForm] = useState<{ awal: UmkmTokoInput; isEdit: boolean } | null>(null);
  const [produkForm, setProdukForm] = useState<{ awal: UmkmProdukInput; isEdit: boolean; namaToko: string } | null>(null);

  const { confirm: askConfirm, dialog } = useConfirm();

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseService.fetchUmkmAdmin();
      setTokoList(Array.isArray(data) ? data : []);
      if (fetchError) setError(fetchError);
    } catch (err) {
      console.error('Gagal memuat UMKM:', err);
      setTokoList([]);
      setError(`Gagal memuat UMKM: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeUmkmRealtime(() => { void loadData(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch (err) {
      console.warn('Kanal realtime UMKM tidak dapat dibuka:', err);
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadData]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Lapak ──
  const bukaTambahToko = () => setTokoForm({ awal: kosongTokoInput(), isEdit: false });
  const bukaEditToko = (t: UmkmToko) => setTokoForm({ awal: tokoToInput(t), isEdit: true });

  const handleSubmitToko = async (input: UmkmTokoInput): Promise<boolean> => {
    const result = await supabaseService.simpanToko(input);
    if (result.success) {
      showToast(input.id ? 'Lapak diperbarui.' : 'Lapak ditambahkan.');
      await loadData();
      return true;
    }
    showToast(`Gagal menyimpan: ${result.error}`, 'err');
    return false;
  };

  const handleHapusToko = async (t: UmkmToko) => {
    const yakin = await askConfirm({
      title: 'Hapus lapak?',
      message: `Lapak "${t.namaUsaha}" beserta seluruh produk & variannya akan dihapus permanen.`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
    });
    if (!yakin) return;
    setBusyId(t.id);
    const result = await supabaseService.hapusToko(t.id);
    if (result.success) {
      setTokoList((prev) => prev.filter((x) => x.id !== t.id));
      showToast('Lapak dihapus.');
    } else {
      showToast(`Gagal menghapus: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const handleVerifikasi = async (t: UmkmToko, status: 'VERIFIED' | 'DITOLAK') => {
    if (status === 'DITOLAK') {
      const yakin = await askConfirm({
        title: 'Tolak lapak?',
        message: `Lapak "${t.namaUsaha}" tidak akan tampil di etalase warga. Anda bisa memverifikasinya lagi nanti.`,
        confirmLabel: 'Ya, Tolak',
        tone: 'warning',
      });
      if (!yakin) return;
    }
    setBusyId(t.id);
    const result = await supabaseService.verifikasiToko(t.id, status);
    if (result.success) {
      showToast(status === 'VERIFIED' ? 'Lapak diverifikasi & tampil di etalase.' : 'Lapak ditolak.');
      await loadData();
    } else {
      showToast(`Gagal memproses: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  // ── Produk ──
  const bukaTambahProduk = (t: UmkmToko) =>
    setProdukForm({ awal: kosongProdukInput(t.id), isEdit: false, namaToko: t.namaUsaha });
  const bukaEditProduk = (t: UmkmToko, p: UmkmProduk) =>
    setProdukForm({ awal: produkToInput(t.id, p), isEdit: true, namaToko: t.namaUsaha });

  const handleSubmitProduk = async (input: UmkmProdukInput): Promise<boolean> => {
    const result = await supabaseService.simpanProduk(input);
    if (result.success) {
      showToast(input.id ? 'Produk diperbarui.' : 'Produk ditambahkan.');
      await loadData();
      return true;
    }
    showToast(`Gagal menyimpan produk: ${result.error}`, 'err');
    return false;
  };

  const handleHapusProduk = async (_t: UmkmToko, p: UmkmProduk) => {
    const yakin = await askConfirm({
      title: 'Hapus produk?',
      message: `Produk "${p.namaProduk}" beserta variannya akan dihapus permanen.`,
      confirmLabel: 'Ya, Hapus',
      tone: 'danger',
    });
    if (!yakin) return;
    setBusyId(p.id);
    const result = await supabaseService.hapusProduk(p.id);
    if (result.success) {
      showToast('Produk dihapus.');
      await loadData();
    } else {
      showToast(`Gagal menghapus produk: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  // ── stats + filter ──
  const pendingCount = tokoList.filter((t) => t.status === 'PENDING').length;
  const verifiedCount = tokoList.filter((t) => t.status === 'VERIFIED').length;
  const ditolakCount = tokoList.filter((t) => t.status === 'DITOLAK').length;

  const filteredList = tokoList.filter((t) => {
    if (filter !== 'SEMUA' && t.status !== filter) return false;
    const q = cari.trim().toLowerCase();
    if (q) {
      const hay = `${t.namaUsaha} ${t.kategori} ${t.alamat} ${t.produk.map((p) => p.namaProduk).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const STAT: { key: FilterUmkm; label: string; value: number; dot: string }[] = [
    { key: 'SEMUA', label: 'Total', value: tokoList.length, dot: 'bg-slate-400' },
    { key: 'PENDING', label: 'Menunggu', value: pendingCount, dot: 'bg-amber-400' },
    { key: 'VERIFIED', label: 'Terverifikasi', value: verifiedCount, dot: 'bg-emerald-500' },
    { key: 'DITOLAK', label: 'Ditolak', value: ditolakCount, dot: 'bg-rose-400' },
  ];

  return (
    <div className="space-y-6">
      {dialog}

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

      {tokoForm && (
        <TokoFormModal
          awal={tokoForm.awal}
          isEdit={tokoForm.isEdit}
          onClose={() => setTokoForm(null)}
          onSubmit={handleSubmitToko}
        />
      )}

      {produkForm && (
        <ProdukFormModal
          awal={produkForm.awal}
          isEdit={produkForm.isEdit}
          namaToko={produkForm.namaToko}
          onClose={() => setProdukForm(null)}
          onSubmit={handleSubmitProduk}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Store className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">UMKM Warga</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Verifikasi lapak warga &amp; kelola etalase UMKM yang tampil di dashboard warga
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            aria-label="Refresh daftar UMKM"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={bukaTambahToko}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah Lapak
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT.map((s) => (
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
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari lapak / produk / alamat…"
          className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        />
        <span className="text-xs text-slate-400 font-medium">{filteredList.length} lapak</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat data UMKM…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Store className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">
              {tokoList.length === 0 ? 'Belum ada lapak UMKM' : 'Tidak ada lapak yang cocok'}
            </p>
            <p className="text-xs mt-1">
              {tokoList.length === 0
                ? 'Lapak yang didaftarkan warga akan muncul di sini untuk diverifikasi'
                : 'Coba ubah kata kunci atau filter'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredList.map((t) => (
            <TokoKelolaCard
              key={t.id}
              toko={t}
              isAdmin
              busyId={busyId}
              onFoto={setFotoUrl}
              onEditToko={bukaEditToko}
              onHapusToko={handleHapusToko}
              onVerifikasi={handleVerifikasi}
              onTambahProduk={bukaTambahProduk}
              onEditProduk={bukaEditProduk}
              onHapusProduk={handleHapusProduk}
            />
          ))}
        </div>
      )}
    </div>
  );
};
