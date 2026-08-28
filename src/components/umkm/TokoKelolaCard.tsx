import React from 'react';
import {
  CheckCircle2,
  ImageOff,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Store,
  Trash2,
  XCircle,
} from 'lucide-react';
import { UmkmProduk, UmkmToko } from '../../types';
import { formatRupiah } from '../../utils/pesananWa';
import { StatusUmkmBadge } from './UmkmForms';

/** Rentang harga produk berdasar varian berharga (fallback ke harga dasar). */
export const rentangHargaProduk = (p: UmkmProduk): string => {
  const hargaVarian = p.varian.map((v) => (v.harga > 0 ? v.harga : p.harga)).filter((h) => h > 0);
  const kandidat = hargaVarian.length > 0 ? hargaVarian : (p.harga > 0 ? [p.harga] : []);
  if (kandidat.length === 0) return 'Hubungi penjual';
  const min = Math.min(...kandidat);
  const max = Math.max(...kandidat);
  return min === max ? formatRupiah(min) : `${formatRupiah(min)} – ${formatRupiah(max)}`;
};

interface TokoKelolaCardProps {
  toko: UmkmToko;
  isAdmin?: boolean;
  busyId: string | null;
  onFoto: (url: string) => void;
  onEditToko: (t: UmkmToko) => void;
  onHapusToko: (t: UmkmToko) => void;
  onVerifikasi?: (t: UmkmToko, status: 'VERIFIED' | 'DITOLAK') => void;
  onTambahProduk: (t: UmkmToko) => void;
  onEditProduk: (t: UmkmToko, p: UmkmProduk) => void;
  onHapusProduk: (t: UmkmToko, p: UmkmProduk) => void;
}

export const TokoKelolaCard: React.FC<TokoKelolaCardProps> = ({
  toko,
  isAdmin = false,
  busyId,
  onFoto,
  onEditToko,
  onHapusToko,
  onVerifikasi,
  onTambahProduk,
  onEditProduk,
  onHapusProduk,
}) => {
  const busy = busyId === toko.id;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header lapak */}
      <div className="flex gap-3 p-4">
        {toko.fotoUrl ? (
          <button
            type="button"
            onClick={() => onFoto(toko.fotoUrl!)}
            className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0"
            aria-label="Lihat foto lapak"
          >
            <img src={toko.fotoUrl} alt={toko.namaUsaha} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-16 h-16 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Store className="w-6 h-6 text-emerald-500" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">{toko.namaUsaha}</h3>
            <StatusUmkmBadge status={toko.status} />
          </div>
          <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">{toko.kategori}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1">
            {toko.kontakWa && (
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {toko.kontakWa}</span>
            )}
            {toko.alamat && (
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {toko.alamat}</span>
            )}
          </div>
        </div>
      </div>

      {toko.deskripsi && (
        <p className="px-4 -mt-1 pb-2 text-xs text-slate-600 leading-relaxed line-clamp-2">{toko.deskripsi}</p>
      )}

      {toko.status === 'DITOLAK' && toko.catatanAdmin && (
        <div className="mx-4 mb-2 text-[11px] bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 text-rose-700">
          Catatan pengurus: {toko.catatanAdmin}
        </div>
      )}

      {/* Aksi verifikasi admin */}
      {isAdmin && toko.status !== 'VERIFIED' && onVerifikasi && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <button
            onClick={() => onVerifikasi(toko, 'VERIFIED')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Verifikasi
          </button>
          {toko.status !== 'DITOLAK' && (
            <button
              onClick={() => onVerifikasi(toko, 'DITOLAK')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" /> Tolak
            </button>
          )}
        </div>
      )}

      {/* Daftar produk */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Produk ({toko.produk.length})
          </span>
          <button
            onClick={() => onTambahProduk(toko)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5" /> Produk
          </button>
        </div>

        {toko.produk.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-1">Belum ada produk. Tambahkan agar tampil di etalase.</p>
        ) : (
          <div className="space-y-1.5">
            {toko.produk.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-2.5 py-2"
              >
                {p.fotoUrl ? (
                  <button
                    type="button"
                    onClick={() => onFoto(p.fotoUrl!)}
                    className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0"
                    aria-label="Lihat foto produk"
                  >
                    <img src={p.fotoUrl} alt={p.namaProduk} className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <ImageOff className="w-4 h-4 text-slate-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-800 truncate">{p.namaProduk}</p>
                    {!p.tersedia && (
                      <span className="shrink-0 text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Habis</span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-700 font-semibold">{rentangHargaProduk(p)}</p>
                  {p.varian.length > 0 && (
                    <p className="text-[10px] text-slate-400 truncate">{p.varian.map((v) => v.namaVarian).join(', ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onEditProduk(toko, p)}
                    className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                    aria-label="Ubah produk"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onHapusProduk(toko, p)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    aria-label="Hapus produk"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aksi lapak */}
      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-1.5">
        <button
          onClick={() => onEditToko(toko)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          <Pencil className="w-3.5 h-3.5" /> Ubah Lapak
        </button>
        <button
          onClick={() => onHapusToko(toko)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-40 ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" /> Hapus Lapak
        </button>
      </div>
    </article>
  );
};
