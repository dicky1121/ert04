import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  Save,
  Store,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  StatusUmkm,
  UMKM_KATEGORI,
  UmkmProduk,
  UmkmProdukInput,
  UmkmToko,
  UmkmTokoInput,
  UmkmVarianInput,
} from '../../types';
import { formatRupiah } from '../../utils/pesananWa';

// ── CSS bersama ────────────────────────────────────────────────────────────────
export const umkmInputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
export const umkmLabelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

// ── badge status verifikasi ─────────────────────────────────────────────────────
export const statusUmkmMeta = (status: StatusUmkm): { label: string; cls: string; Icon: typeof CheckCircle2 } => {
  switch (status) {
    case 'VERIFIED':
      return { label: 'Terverifikasi', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle2 };
    case 'DITOLAK':
      return { label: 'Ditolak', cls: 'bg-rose-100 text-rose-700 border-rose-200', Icon: XCircle };
    default:
      return { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Clock3 };
  }
};

export const StatusUmkmBadge: React.FC<{ status: StatusUmkm }> = ({ status }) => {
  const { label, cls, Icon } = statusUmkmMeta(status);
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

// ── foto lightbox ────────────────────────────────────────────────────────────────
export const FotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <div
    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={onClose}
    role="dialog"
    aria-label="Foto"
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
      alt="Foto"
      className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// ── input foto dengan pratinjau ──────────────────────────────────────────────────
const FotoPicker: React.FC<{
  preview: string | null;
  onPick: (file: File | null) => void;
  onRemove: () => void;
  hint?: string;
}> = ({ preview, onPick, onRemove, hint }) => (
  <div>
    <label className={umkmLabelCls}>{hint || 'Foto (opsional, maks 2MB)'}</label>
    {preview ? (
      <div className="relative rounded-xl overflow-hidden border border-slate-200">
        <img src={preview} alt="Pratinjau" className="w-full max-h-52 object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1 shadow"
        >
          <Trash2 className="w-3.5 h-3.5" /> Hapus
        </button>
      </div>
    ) : (
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/40 transition text-slate-400">
        <ImageIcon className="w-6 h-6" />
        <span className="text-xs font-medium">Pilih foto…</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </label>
    )}
  </div>
);

// Shell modal (header + body + footer) dipakai kedua form.
const ModalShell: React.FC<{
  title: string;
  Icon: typeof Store;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  submitLabel: string;
  children: React.ReactNode;
  ariaLabel: string;
}> = ({ title, Icon, onClose, onSubmit, saving, submitLabel, children, ariaLabel }) => (
  <div
    className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
  >
    <form
      onSubmit={onSubmit}
      className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
    >
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
          {saving ? 'Menyimpan…' : submitLabel}
        </button>
      </div>
    </form>
  </div>
);

// ====================================================================
// FORM LAPAK / TOKO
// ====================================================================
export const kosongTokoInput = (): UmkmTokoInput => ({
  namaUsaha: '',
  kategori: UMKM_KATEGORI[0],
  deskripsi: '',
  kontakWa: '',
  alamat: '',
  fotoFile: null,
  fotoUrl: null,
});

/** Petakan lapak yang sudah ada → payload form (untuk mode edit). */
export const tokoToInput = (t: UmkmToko): UmkmTokoInput => ({
  id: t.id,
  namaUsaha: t.namaUsaha,
  kategori: t.kategori,
  deskripsi: t.deskripsi,
  kontakWa: t.kontakWa,
  alamat: t.alamat,
  fotoFile: null,
  fotoUrl: t.fotoUrl,
});

export const TokoFormModal: React.FC<{
  awal: UmkmTokoInput;
  isEdit: boolean;
  onClose: () => void;
  onSubmit: (input: UmkmTokoInput) => Promise<boolean>;
}> = ({ awal, isEdit, onClose, onSubmit }) => {
  const [form, setForm] = useState<UmkmTokoInput>(awal);
  const [preview, setPreview] = useState<string | null>(awal.fotoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const setField = <K extends keyof UmkmTokoInput>(key: K, value: UmkmTokoInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (file: File | null) => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
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
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setPreview(null);
    setForm((prev) => ({ ...prev, fotoFile: null, fotoUrl: null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.namaUsaha.trim()) { setFormError('Nama usaha wajib diisi.'); return; }
    if (!form.kontakWa.replace(/\D/g, '')) { setFormError('Nomor WhatsApp penjual wajib diisi (tujuan pesanan).'); return; }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title={isEdit ? 'Ubah Lapak' : 'Buat Lapak UMKM'}
      Icon={Store}
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Lapak'}
      ariaLabel={isEdit ? 'Ubah lapak UMKM' : 'Buat lapak UMKM'}
    >
      <div>
        <label className={umkmLabelCls} htmlFor="umkm-nama">Nama usaha *</label>
        <input
          id="umkm-nama"
          type="text"
          value={form.namaUsaha}
          onChange={(e) => setField('namaUsaha', e.target.value)}
          placeholder="mis. Warung Bu Sri"
          className={umkmInputCls}
          maxLength={120}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={umkmLabelCls} htmlFor="umkm-kategori">Kategori</label>
          <select
            id="umkm-kategori"
            value={form.kategori}
            onChange={(e) => setField('kategori', e.target.value)}
            className={`${umkmInputCls} bg-white`}
          >
            {UMKM_KATEGORI.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className={umkmLabelCls} htmlFor="umkm-wa">No. WhatsApp penjual *</label>
          <input
            id="umkm-wa"
            type="tel"
            inputMode="numeric"
            value={form.kontakWa}
            onChange={(e) => setField('kontakWa', e.target.value)}
            placeholder="08xxxxxxxxxx"
            className={umkmInputCls}
            maxLength={20}
          />
        </div>
      </div>

      <div>
        <label className={umkmLabelCls} htmlFor="umkm-alamat">Alamat lapak</label>
        <input
          id="umkm-alamat"
          type="text"
          value={form.alamat}
          onChange={(e) => setField('alamat', e.target.value)}
          placeholder="mis. Blok C2 No. 5"
          className={umkmInputCls}
          maxLength={160}
        />
      </div>

      <div>
        <label className={umkmLabelCls} htmlFor="umkm-deskripsi">Deskripsi</label>
        <textarea
          id="umkm-deskripsi"
          value={form.deskripsi}
          onChange={(e) => setField('deskripsi', e.target.value)}
          placeholder="Ceritakan singkat tentang usaha Anda…"
          rows={3}
          className={`${umkmInputCls} resize-none`}
          maxLength={600}
        />
      </div>

      <FotoPicker
        preview={preview}
        onPick={handleFile}
        onRemove={hapusFoto}
        hint="Foto / logo lapak (opsional, maks 2MB)"
      />

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-amber-800 text-xs">
        <Clock3 className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Lapak baru akan ditinjau pengurus dulu sebelum tampil di etalase warga.</span>
      </div>

      {formError && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-rose-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
        </div>
      )}
    </ModalShell>
  );
};

// ====================================================================
// FORM PRODUK (+ editor varian inline)
// ====================================================================
export const kosongProdukInput = (umkmId: string): UmkmProdukInput => ({
  umkmId,
  namaProduk: '',
  deskripsi: '',
  harga: 0,
  tersedia: true,
  fotoFile: null,
  fotoUrl: null,
  varian: [],
});

/** Petakan produk yang sudah ada → payload form (untuk mode edit). */
export const produkToInput = (umkmId: string, p: UmkmProduk): UmkmProdukInput => ({
  id: p.id,
  umkmId,
  namaProduk: p.namaProduk,
  deskripsi: p.deskripsi,
  harga: p.harga,
  tersedia: p.tersedia,
  urutan: p.urutan,
  fotoFile: null,
  fotoUrl: p.fotoUrl,
  varian: p.varian.map((v) => ({ id: v.id, namaVarian: v.namaVarian, harga: v.harga, tersedia: v.tersedia })),
});

const hargaValue = (n: number): string => (n > 0 ? String(n) : '');

export const ProdukFormModal: React.FC<{
  awal: UmkmProdukInput;
  isEdit: boolean;
  namaToko?: string;
  onClose: () => void;
  onSubmit: (input: UmkmProdukInput) => Promise<boolean>;
}> = ({ awal, isEdit, namaToko, onClose, onSubmit }) => {
  const [form, setForm] = useState<UmkmProdukInput>(awal);
  const [preview, setPreview] = useState<string | null>(awal.fotoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  const setField = <K extends keyof UmkmProdukInput>(key: K, value: UmkmProdukInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (file: File | null) => {
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
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
    if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    setPreview(null);
    setForm((prev) => ({ ...prev, fotoFile: null, fotoUrl: null }));
  };

  // ── editor varian ──
  const tambahVarian = () =>
    setForm((prev) => ({ ...prev, varian: [...prev.varian, { namaVarian: '', harga: 0, tersedia: true }] }));

  const ubahVarian = <K extends keyof UmkmVarianInput>(idx: number, key: K, value: UmkmVarianInput[K]) =>
    setForm((prev) => ({
      ...prev,
      varian: prev.varian.map((v, i) => (i === idx ? { ...v, [key]: value } : v)),
    }));

  const hapusVarian = (idx: number) =>
    setForm((prev) => ({ ...prev, varian: prev.varian.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.namaProduk.trim()) { setFormError('Nama produk wajib diisi.'); return; }
    const varianTerisi = form.varian.filter((v) => v.namaVarian.trim());
    if (form.harga <= 0 && varianTerisi.length === 0) {
      setFormError('Isi harga produk, atau tambahkan minimal satu varian berharga.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit({ ...form, varian: varianTerisi });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      title={isEdit ? 'Ubah Produk' : 'Tambah Produk'}
      Icon={Package}
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      submitLabel={isEdit ? 'Simpan Perubahan' : 'Simpan Produk'}
      ariaLabel={isEdit ? 'Ubah produk' : 'Tambah produk'}
    >
      {namaToko && (
        <p className="text-xs text-slate-500 -mt-1">
          Lapak: <span className="font-semibold text-slate-700">{namaToko}</span>
        </p>
      )}

      <div>
        <label className={umkmLabelCls} htmlFor="prd-nama">Nama produk *</label>
        <input
          id="prd-nama"
          type="text"
          value={form.namaProduk}
          onChange={(e) => setField('namaProduk', e.target.value)}
          placeholder="mis. Es Teler"
          className={umkmInputCls}
          maxLength={120}
          autoFocus
        />
      </div>

      <div>
        <label className={umkmLabelCls} htmlFor="prd-harga">
          Harga dasar (Rp){form.varian.length > 0 ? ' — opsional bila tiap varian berharga' : ' *'}
        </label>
        <input
          id="prd-harga"
          type="number"
          min={0}
          step={500}
          value={hargaValue(form.harga)}
          onChange={(e) => setField('harga', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
          placeholder="mis. 15000"
          className={umkmInputCls}
        />
        {form.harga > 0 && <p className="text-[11px] text-slate-400 mt-1">{formatRupiah(form.harga)}</p>}
      </div>

      <div>
        <label className={umkmLabelCls} htmlFor="prd-deskripsi">Deskripsi</label>
        <textarea
          id="prd-deskripsi"
          value={form.deskripsi}
          onChange={(e) => setField('deskripsi', e.target.value)}
          placeholder="Keterangan produk…"
          rows={2}
          className={`${umkmInputCls} resize-none`}
          maxLength={500}
        />
      </div>

      <FotoPicker preview={preview} onPick={handleFile} onRemove={hapusFoto} hint="Foto produk (opsional, maks 2MB)" />

      {/* Editor varian */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={`${umkmLabelCls} mb-0`}>Varian / pilihan (opsional)</label>
          <button
            type="button"
            onClick={tambahVarian}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Varian
          </button>
        </div>
        {form.varian.length === 0 ? (
          <p className="text-[11px] text-slate-400">
            Tambahkan bila produk punya beberapa pilihan (mis. Es Coklat, Es Teh Manis). Kosongkan bila produk polos.
          </p>
        ) : (
          <div className="space-y-2">
            {form.varian.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={v.namaVarian}
                  onChange={(e) => ubahVarian(idx, 'namaVarian', e.target.value)}
                  placeholder="Nama varian"
                  className={`${umkmInputCls} flex-1 py-2`}
                  maxLength={80}
                />
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={hargaValue(v.harga)}
                  onChange={(e) => ubahVarian(idx, 'harga', e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  placeholder="Harga"
                  className={`${umkmInputCls} w-24 py-2`}
                  title="Kosongkan untuk memakai harga dasar"
                />
                <button
                  type="button"
                  onClick={() => hapusVarian(idx)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition shrink-0"
                  aria-label="Hapus varian"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ketersediaan */}
      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
        <input
          type="checkbox"
          checked={form.tersedia}
          onChange={(e) => setField('tersedia', e.target.checked)}
          className="w-4 h-4 rounded accent-emerald-600"
        />
        <span className="flex-1">
          <span className="block text-sm font-semibold text-slate-800">Produk tersedia</span>
          <span className="block text-xs text-slate-500">Matikan bila stok habis — produk disembunyikan dari etalase.</span>
        </span>
      </label>

      {formError && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-rose-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {formError}
        </div>
      )}
    </ModalShell>
  );
};
