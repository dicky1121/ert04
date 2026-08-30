import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Loader2,
  MessageCircle,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import {
  CurrentUser,
  PesananWaInput,
  UmkmProduk,
  UmkmProdukInput,
  UmkmToko,
  UmkmTokoInput,
  UmkmVarian,
} from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { useConfirm } from '../ConfirmDialog';
import {
  FotoLightbox,
  ProdukFormModal,
  TokoFormModal,
  kosongProdukInput,
  kosongTokoInput,
  produkToInput,
  tokoToInput,
} from '../umkm/UmkmForms';
import { TokoKelolaCard, rentangHargaProduk } from '../umkm/TokoKelolaCard';
import { buatPesananWa, formatRupiah, hargaEfektif, hitungSubtotal } from '../../utils/pesananWa';
import { useModalDismiss } from '../../hooks/useModalDismiss';

interface UmkmWargaProps {
  currentUser: CurrentUser;
}

type SubTab = 'etalase' | 'toko';

// ====================================================================
// MODAL PESAN (checkout via WhatsApp)
// ====================================================================
const PesananModal: React.FC<{
  toko: UmkmToko;
  produk: UmkmProduk;
  currentUser: CurrentUser;
  onClose: () => void;
}> = ({ toko, produk, currentUser, onClose }) => {
  const adaVarian = produk.varian.length > 0;
  const varianTersedia = produk.varian.filter((v) => v.tersedia);

  const [varianId, setVarianId] = useState<string | null>(() => {
    if (!adaVarian) return null;
    const pilihan = varianTersedia[0] ?? produk.varian[0];
    return pilihan ? pilihan.id : null;
  });
  const [qty, setQty] = useState(1);
  const [nama, setNama] = useState(currentUser.nama || '');
  const [alamat, setAlamat] = useState('');
  const [hp, setHp] = useState(currentUser.nomorHp || '');
  const [catatan, setCatatan] = useState('');

  const varian: UmkmVarian | null = useMemo(
    () => (varianId ? produk.varian.find((v) => v.id === varianId) ?? null : null),
    [varianId, produk.varian],
  );

  const perUnit = hargaEfektif({ produk, varian });
  const total = hitungSubtotal({
    toko, produk, varian, qty,
    namaPemesan: nama, alamatPemesan: alamat, nomorHpPemesan: hp, catatan,
  });

  const waUrl = useMemo<string | null>(() => {
    const input: PesananWaInput = {
      toko, produk, varian, qty,
      namaPemesan: nama, alamatPemesan: alamat, nomorHpPemesan: hp, catatan,
    };
    return buatPesananWa(input);
  }, [toko, produk, varian, qty, nama, alamat, hp, catatan]);

  const lengkap = nama.trim().length > 0 && alamat.trim().length > 0;
  const bisaPesan = lengkap && !!waUrl;

  const inputCls =
    'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
  const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Pesan produk"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">Pesan Produk</h3>
              <p className="text-[11px] text-slate-500 truncate">{toko.namaUsaha}</p>
            </div>
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

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Ringkasan produk */}
          <div className="flex gap-3">
            {produk.fotoUrl ? (
              <img src={produk.fotoUrl} alt={produk.namaProduk} className="w-16 h-16 rounded-xl object-cover bg-slate-100 shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <ImageOff className="w-5 h-5 text-slate-300" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 leading-snug">{produk.namaProduk}</p>
              {produk.deskripsi && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{produk.deskripsi}</p>}
              <p className="text-xs font-bold text-emerald-700 mt-1">{rentangHargaProduk(produk)}</p>
            </div>
          </div>

          {/* Pilihan varian (radio single-select) */}
          {adaVarian && (
            <div>
              <label className={labelCls}>Pilih varian</label>
              <div className="space-y-1.5">
                {produk.varian.map((v) => {
                  const dipilih = v.id === varianId;
                  const harga = v.harga > 0 ? v.harga : produk.harga;
                  return (
                    <button
                      type="button"
                      key={v.id}
                      onClick={() => v.tersedia && setVarianId(v.id)}
                      disabled={!v.tersedia}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition ${
                        dipilih
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      } ${!v.tersedia ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          dipilih ? 'border-emerald-500' : 'border-slate-300'
                        }`}
                      >
                        {dipilih && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{v.namaVarian}</span>
                        {!v.tersedia && <span className="text-[11px] text-slate-400">Habis</span>}
                      </span>
                      <span className="text-xs font-bold text-slate-700 shrink-0">{formatRupiah(harga)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Jumlah */}
          <div>
            <label className={labelCls}>Jumlah</label>
            <div className="inline-flex items-center rounded-xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-2.5 text-slate-600 hover:bg-slate-100 transition disabled:opacity-40"
                disabled={qty <= 1}
                aria-label="Kurangi"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={1}
                max={999}
                value={qty}
                onChange={(e) => setQty(Math.min(999, Math.max(1, Number(e.target.value) || 1)))}
                className="w-14 text-center text-sm font-bold text-slate-800 border-x border-slate-200 py-2.5 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(999, q + 1))}
                className="px-3 py-2.5 text-slate-600 hover:bg-slate-100 transition"
                aria-label="Tambah"
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs text-slate-400">× {formatRupiah(perUnit)}</span>
            </div>
          </div>

          {/* Data pemesan */}
          <div className="space-y-3 border-t border-slate-100 pt-3">
            <div>
              <label className={labelCls} htmlFor="pesan-nama">Nama pemesan *</label>
              <input
                id="pesan-nama"
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama Anda"
                className={inputCls}
                maxLength={120}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pesan-alamat">Alamat pengiriman *</label>
              <input
                id="pesan-alamat"
                type="text"
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                placeholder="mis. Blok C2 No. 5"
                className={inputCls}
                maxLength={200}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pesan-hp">No. HP / WhatsApp</label>
              <input
                id="pesan-hp"
                type="tel"
                inputMode="numeric"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className={inputCls}
                maxLength={20}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="pesan-catatan">Catatan (opsional)</label>
              <textarea
                id="pesan-catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="mis. tidak pedas, antar sore…"
                rows={2}
                className={`${inputCls} resize-none`}
                maxLength={300}
              />
            </div>
          </div>
        </div>

        {/* Footer: total + tombol WA */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total</span>
            <span className="text-lg font-black text-slate-900">{formatRupiah(total)}</span>
          </div>
          {!waUrl ? (
            <p className="flex items-center gap-1.5 text-[11px] text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Nomor WhatsApp penjual belum valid.
            </p>
          ) : !lengkap ? (
            <p className="text-[11px] text-slate-400">Lengkapi nama &amp; alamat pengiriman untuk melanjutkan.</p>
          ) : null}
          {bisaPesan ? (
            <a
              href={waUrl!}
              target="_blank"
              rel="noreferrer"
              onClick={() => setTimeout(onClose, 400)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition"
            >
              <MessageCircle className="w-4 h-4" /> Pesan via WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-200 text-slate-400 text-sm font-bold cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" /> Pesan via WhatsApp
            </button>
          )}
          <p className="text-center text-[10px] text-slate-400">
            Pesanan diteruskan ke WhatsApp penjual — pembayaran &amp; pengiriman diatur langsung dengan penjual.
          </p>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// KARTU PRODUK (etalase)
// ====================================================================
const EtalaseCard: React.FC<{
  toko: UmkmToko;
  produk: UmkmProduk;
  onFoto: (url: string) => void;
  onPesan: (toko: UmkmToko, produk: UmkmProduk) => void;
}> = ({ toko, produk, onFoto, onPesan }) => (
  <article className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={() => produk.fotoUrl && onFoto(produk.fotoUrl)}
      className="aspect-square w-full bg-slate-100 overflow-hidden"
      aria-label={produk.fotoUrl ? 'Lihat foto produk' : produk.namaProduk}
      disabled={!produk.fotoUrl}
    >
      {produk.fotoUrl ? (
        <img src={produk.fotoUrl} alt={produk.namaProduk} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <span className="w-full h-full flex items-center justify-center text-slate-300">
          <ImageOff className="w-8 h-8" />
        </span>
      )}
    </button>
    <div className="flex flex-col flex-1 p-3">
      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{produk.namaProduk}</h3>
      <p className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1 truncate">
        <Store className="w-3 h-3 shrink-0" />
        <span className="truncate">{toko.namaUsaha}</span>
        {toko.milikSaya && (
          <span className="shrink-0 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Lapak Anda</span>
        )}
      </p>
      <p className="mt-1.5 text-sm font-black text-emerald-700">{rentangHargaProduk(produk)}</p>
      {produk.varian.length > 0 && (
        <p className="text-[10px] text-slate-400 truncate">{produk.varian.length} varian · {produk.varian.map((v) => v.namaVarian).join(', ')}</p>
      )}
      <button
        type="button"
        onClick={() => onPesan(toko, produk)}
        className="mt-2.5 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
      >
        <MessageCircle className="w-3.5 h-3.5" /> Pesan
      </button>
    </div>
  </article>
);

// ====================================================================
// UMKM WARGA (Etalase + Toko Saya)
// ====================================================================
export const UmkmWarga: React.FC<UmkmWargaProps> = ({ currentUser }) => {
  const [subTab, setSubTab] = useState<SubTab>('etalase');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  // Etalase
  const [etalase, setEtalase] = useState<UmkmToko[]>([]);
  const [etalaseLoading, setEtalaseLoading] = useState(true);
  const [etalaseError, setEtalaseError] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState<string>('SEMUA');
  const [pesanan, setPesanan] = useState<{ toko: UmkmToko; produk: UmkmProduk } | null>(null);

  // Toko Saya
  const [tokoSaya, setTokoSaya] = useState<UmkmToko[]>([]);
  const [sayaLoading, setSayaLoading] = useState(true);
  const [sayaError, setSayaError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tokoForm, setTokoForm] = useState<{ awal: UmkmTokoInput; isEdit: boolean } | null>(null);
  const [produkForm, setProdukForm] = useState<{ awal: UmkmProdukInput; isEdit: boolean; namaToko: string } | null>(null);

  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm: askConfirm, dialog } = useConfirm();

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const loadEtalase = useCallback(async () => {
    setEtalaseLoading(true);
    setEtalaseError(null);
    const { data, error } = await supabaseService.fetchUmkmEtalase();
    setEtalase(Array.isArray(data) ? data : []);
    if (error) setEtalaseError(error);
    setEtalaseLoading(false);
  }, []);

  const loadSaya = useCallback(async () => {
    setSayaLoading(true);
    setSayaError(null);
    const { data, error } = await supabaseService.fetchUmkmSaya();
    setTokoSaya(Array.isArray(data) ? data : []);
    if (error) setSayaError(error);
    setSayaLoading(false);
  }, []);

  useEffect(() => { void loadEtalase(); void loadSaya(); }, [loadEtalase, loadSaya]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeUmkmRealtime(() => { void loadEtalase(); void loadSaya(); });
      if (typeof result === 'function') unsubscribe = result;
    } catch (err) {
      console.warn('Kanal realtime UMKM tidak dapat dibuka:', err);
    }
    return () => { try { unsubscribe?.(); } catch { /* noop */ } };
  }, [loadEtalase, loadSaya]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  // ── Etalase: flatten toko → produk (hanya produk tersedia) + filter ──
  const kategoriTersedia = useMemo(() => {
    const set = new Set<string>();
    etalase.forEach((t) => { if (t.produk.some((p) => p.tersedia)) set.add(t.kategori); });
    return Array.from(set).sort();
  }, [etalase]);

  const etalaseItems = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const items: { toko: UmkmToko; produk: UmkmProduk }[] = [];
    for (const toko of etalase) {
      if (kategoriFilter !== 'SEMUA' && toko.kategori !== kategoriFilter) continue;
      for (const produk of toko.produk) {
        if (!produk.tersedia) continue;
        if (q) {
          const hay = `${produk.namaProduk} ${produk.deskripsi} ${toko.namaUsaha} ${toko.kategori}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        items.push({ toko, produk });
      }
    }
    return items;
  }, [etalase, cari, kategoriFilter]);

  // ── Toko Saya: handler kelola ──
  const bukaTambahToko = () => setTokoForm({ awal: kosongTokoInput(), isEdit: false });
  const bukaEditToko = (t: UmkmToko) => setTokoForm({ awal: tokoToInput(t), isEdit: true });

  const handleSubmitToko = async (input: UmkmTokoInput): Promise<boolean> => {
    const result = await supabaseService.simpanToko(input);
    if (result.success) {
      showToast(input.id ? 'Lapak diperbarui.' : 'Lapak dibuat — menunggu tinjauan pengurus.');
      await loadSaya();
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
      setTokoSaya((prev) => prev.filter((x) => x.id !== t.id));
      showToast('Lapak dihapus.');
    } else {
      showToast(`Gagal menghapus: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  const bukaTambahProduk = (t: UmkmToko) =>
    setProdukForm({ awal: kosongProdukInput(t.id), isEdit: false, namaToko: t.namaUsaha });
  const bukaEditProduk = (t: UmkmToko, p: UmkmProduk) =>
    setProdukForm({ awal: produkToInput(t.id, p), isEdit: true, namaToko: t.namaUsaha });

  const handleSubmitProduk = async (input: UmkmProdukInput): Promise<boolean> => {
    const result = await supabaseService.simpanProduk(input);
    if (result.success) {
      showToast(input.id ? 'Produk diperbarui.' : 'Produk ditambahkan.');
      await loadSaya();
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
      await loadSaya();
    } else {
      showToast(`Gagal menghapus produk: ${result.error}`, 'err');
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-4">
      {dialog}

      {toast && (
        <div className="fixed top-4 right-4 z-[70] animate-in fade-in slide-in-from-top-4 duration-200">
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
      {pesanan && (
        <PesananModal
          toko={pesanan.toko}
          produk={pesanan.produk}
          currentUser={currentUser}
          onClose={() => setPesanan(null)}
        />
      )}
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

      {/* Judul */}
      <div className="px-0.5">
        <h1 className="text-lg font-black tracking-tight text-slate-900">UMKM Warga</h1>
        <p className="text-sm text-slate-500">Etalase produk &amp; jasa warga RT 004 — pesan langsung lewat WhatsApp.</p>
      </div>

      {/* Segmented sub-tab */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setSubTab('etalase')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition ${
            subTab === 'etalase' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> Etalase
        </button>
        <button
          type="button"
          onClick={() => setSubTab('toko')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition ${
            subTab === 'toko' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Store className="w-4 h-4" /> Toko Saya
          {tokoSaya.length > 0 && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-1.5">{tokoSaya.length}</span>
          )}
        </button>
      </div>

      {/* ─────────── ETALASE ─────────── */}
      {subTab === 'etalase' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari produk atau lapak…"
              className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
            />
          </div>

          {kategoriTersedia.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {['SEMUA', ...kategoriTersedia].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKategoriFilter(k)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                    kategoriFilter === k
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {k === 'SEMUA' ? 'Semua' : k}
                </button>
              ))}
            </div>
          )}

          {etalaseLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">Memuat etalase…</span>
            </div>
          ) : etalaseError ? (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{etalaseError}</span>
            </div>
          ) : etalaseItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <ShoppingBag className="h-7 w-7" />
              </span>
              <h3 className="text-base font-bold text-slate-800">
                {etalase.length === 0 ? 'Belum ada produk' : 'Tidak ada produk yang cocok'}
              </h3>
              <p className="max-w-xs text-sm text-slate-500">
                {etalase.length === 0
                  ? 'Produk UMKM warga yang sudah diverifikasi pengurus akan tampil di sini.'
                  : 'Coba ubah kata kunci atau kategori.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {etalaseItems.map(({ toko, produk }) => (
                <EtalaseCard
                  key={produk.id}
                  toko={toko}
                  produk={produk}
                  onFoto={setFotoUrl}
                  onPesan={(t, p) => setPesanan({ toko: t, produk: p })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────── TOKO SAYA ─────────── */}
      {subTab === 'toko' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">Kelola lapak &amp; produk milik Anda sendiri.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={loadSaya}
                disabled={sayaLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sayaLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={bukaTambahToko}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Buat Lapak
              </button>
            </div>
          </div>

          {sayaLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">Memuat lapak Anda…</span>
            </div>
          ) : sayaError ? (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{sayaError}</span>
            </div>
          ) : tokoSaya.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Store className="h-7 w-7" />
              </span>
              <h3 className="text-base font-bold text-slate-800">Belum punya lapak</h3>
              <p className="max-w-xs text-sm text-slate-500">
                Buat lapak UMKM Anda, tambahkan produk, lalu tunggu verifikasi pengurus agar tampil di etalase warga.
              </p>
              <button
                onClick={bukaTambahToko}
                className="mt-1 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition shadow-sm"
              >
                <Plus className="w-4 h-4" /> Buat Lapak Pertama
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tokoSaya.some((t) => t.status === 'PENDING') && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-800 text-xs">
                  <Package className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Sebagian lapak Anda masih menunggu tinjauan pengurus. Lapak tampil di etalase setelah diverifikasi.</span>
                </div>
              )}
              {tokoSaya.map((t) => (
                <TokoKelolaCard
                  key={t.id}
                  toko={t}
                  busyId={busyId}
                  onFoto={setFotoUrl}
                  onEditToko={bukaEditToko}
                  onHapusToko={handleHapusToko}
                  onTambahProduk={bukaTambahProduk}
                  onEditProduk={bukaEditProduk}
                  onHapusProduk={handleHapusProduk}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UmkmWarga;
