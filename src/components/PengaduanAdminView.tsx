import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquareReply,
  MessageSquareWarning,
  Phone,
  RefreshCw,
  Save,
  User,
  X,
} from 'lucide-react';
import { CurrentUser, PengaduanAdmin, STATUS_PENGADUAN_OPSI } from '../types';
import { supabaseService } from '../services/supabaseService';
import { PENGADUAN_LABEL, PENGADUAN_TONE, statusBadge } from '../utils/statusBadge';
import { toWhatsappNumber } from '../utils/pesananWa';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface PengaduanAdminViewProps {
  currentUser: CurrentUser;
}

/** Kunci filter ringkasan di kartu statistik. */
type FilterStatus = 'SEMUA' | 'BARU' | 'DIPROSES' | 'SELESAI';

/** Label kategori laporan (kode di DB VARCHAR(30) tanpa CHECK constraint). */
const KATEGORI_LABEL: Record<string, string> = {
  KEAMANAN: 'Keamanan',
  KEBERSIHAN: 'Kebersihan',
  INFRASTRUKTUR: 'Infrastruktur',
  SOSIAL: 'Sosial',
  LAINNYA: 'Lainnya',
};

/** Timestamptz ISO → '20 Agu 2026, 14:05'. */
const fmtWaktu = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const inputCls =
  'w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition';
const labelCls = 'block text-xs font-bold text-slate-600 mb-1.5';

/** Pill status memakai peta tone bersama; status tak dikenal jatuh ke 'neutral'. */
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const kode = String(status || '').toUpperCase();
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge(PENGADUAN_TONE[kode] ?? 'neutral')}`}>
      {PENGADUAN_LABEL[kode] ?? status}
    </span>
  );
};

// ── modal tanggapi ────────────────────────────────────────────────────────────
const TanggapiModal: React.FC<{
  item: PengaduanAdmin;
  onClose: () => void;
  onSubmit: (status: string, tanggapan: string) => Promise<boolean>;
}> = ({ item, onClose, onSubmit }) => {
  const [status, setStatus] = useState<string>(String(item.status || 'BARU').toUpperCase());
  const [tanggapan, setTanggapan] = useState(item.tanggapan || '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Status lama di luar daftar baku (mis. 'DITANGANI' dari data terdahulu)
  // tetap ditawarkan supaya membuka modal tidak diam-diam menggantinya.
  const opsi = useMemo<string[]>(() => {
    const kini = String(item.status || '').toUpperCase();
    return kini && !(STATUS_PENGADUAN_OPSI as string[]).includes(kini)
      ? [...STATUS_PENGADUAN_OPSI, kini]
      : [...STATUS_PENGADUAN_OPSI];
  }, [item.status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Menolak laporan tanpa keterangan meninggalkan warga tanpa penjelasan.
    if (status === 'DITOLAK' && !tanggapan.trim()) {
      setFormError('Tulis alasan penolakan agar warga tahu sebabnya.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const ok = await onSubmit(status, tanggapan);
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
      aria-label="Tanggapi pengaduan"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <MessageSquareReply className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm">Tanggapi Pengaduan</h3>
              <p className="font-mono text-[11px] text-slate-400 truncate">{item.nomorTiket}</p>
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

        {/* Body */}
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Ringkasan laporan — hanya baca */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">
                {KATEGORI_LABEL[String(item.kategori).toUpperCase()] ?? item.kategori}
              </span>
              <span className="text-[11px] text-slate-400">{fmtWaktu(item.createdAt)}</span>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{item.isiLaporan}</p>
            {item.alamatKejadian && (
              <p className="flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                <span className="min-w-0">{item.alamatKejadian}</span>
              </p>
            )}
          </div>

          <div>
            <label className={labelCls} htmlFor="adu-status">Status penanganan</label>
            <select
              id="adu-status"
              value={status}
              onChange={e => setStatus(e.target.value)}
              className={inputCls}
            >
              {opsi.map(s => (
                <option key={s} value={s}>{PENGADUAN_LABEL[s] ?? s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="adu-tanggapan">
              Tanggapan untuk warga {status === 'DITOLAK' && <span className="text-rose-600">*</span>}
            </label>
            <textarea
              id="adu-tanggapan"
              value={tanggapan}
              onChange={e => setTanggapan(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="mis. Sudah ditindaklanjuti bersama Satgas, lampu jalan diperbaiki Sabtu ini."
              className={`${inputCls} resize-none`}
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              Tanggapan tampil di layar “Riwayat Saya” warga yang mengirim laporan ini.
            </p>
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
            {saving ? 'Menyimpan…' : 'Simpan Tanggapan'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ── komponen utama ────────────────────────────────────────────────────────────
/**
 * Layar pengurus untuk menindaklanjuti laporan warga. Sebelum ini pengaduan
 * hanya bisa dikirim — tidak ada tempat membacanya, sehingga statusnya selamanya
 * `BARU` dan kolom `tanggapan` selalu kosong.
 *
 * Tidak perlu SQL baru: policy RLS "Pengurus aktif boleh baca/tanggapi
 * pengaduan" beserta GRANT SELECT, UPDATE sudah ada di setup-sapa-warga.sql.
 */
export const PengaduanAdminView: React.FC<PengaduanAdminViewProps> = ({ currentUser }) => {
  const [list, setList] = useState<PengaduanAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('SEMUA');
  const [kategoriFilter, setKategoriFilter] = useState<string>('SEMUA');
  const [cari, setCari] = useState('');
  const [editing, setEditing] = useState<PengaduanAdmin | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: 'ok' | 'err' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = currentUser?.role !== 'WARGA';

  const showToast = (msg: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tone });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabaseService.fetchPengaduan();
      setList(Array.isArray(data) ? data : []);
      if (fetchError) setError(fetchError);
    } catch (err) {
      console.error('Gagal memuat pengaduan:', err);
      setList([]);
      setError(`Gagal memuat pengaduan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const handleSubmit = async (status: string, tanggapan: string): Promise<boolean> => {
    if (!editing) return false;
    const result = await supabaseService.tanggapiPengaduan(editing.id, status, tanggapan);
    if (result.success) {
      const bersih = tanggapan.trim();
      setList(prev => prev.map(x =>
        x.id === editing.id
          ? { ...x, status, tanggapan: bersih ? bersih : null, updatedAt: new Date().toISOString() }
          : x
      ));
      showToast('Tanggapan tersimpan dan langsung terlihat oleh warga.');
      return true;
    }
    showToast(result.error || 'Gagal menyimpan tanggapan.', 'err');
    return false;
  };

  const hitung = (kode: string) =>
    list.filter(p => String(p.status || '').toUpperCase() === kode).length;

  const STAT: { key: FilterStatus; label: string; value: number; dot: string }[] = [
    { key: 'SEMUA', label: 'Total', value: list.length, dot: 'bg-slate-400' },
    { key: 'BARU', label: 'Baru', value: hitung('BARU'), dot: 'bg-sky-500' },
    { key: 'DIPROSES', label: 'Diproses', value: hitung('DIPROSES'), dot: 'bg-amber-400' },
    { key: 'SELESAI', label: 'Selesai', value: hitung('SELESAI'), dot: 'bg-emerald-500' },
  ];

  const kategoriTersedia = useMemo(() => {
    const set = new Set(list.map(p => String(p.kategori || '').toUpperCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [list]);

  const filteredList = list.filter(p => {
    const status = String(p.status || '').toUpperCase();
    if (filter !== 'SEMUA' && status !== filter) return false;
    if (kategoriFilter !== 'SEMUA' && String(p.kategori || '').toUpperCase() !== kategoriFilter) return false;
    const q = cari.trim().toLowerCase();
    if (q) {
      const heap = `${p.nomorTiket} ${p.namaPelapor} ${p.kontakPelapor} ${p.alamatKejadian} ${p.isiLaporan}`;
      if (!heap.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const belumDitanggapi = list.filter(p => !p.tanggapan).length;

  return (
    <div className="space-y-6">
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

      {editing && (
        <TanggapiModal
          item={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <MessageSquareWarning className="w-4 h-4 text-emerald-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Pengaduan Warga</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tindak lanjuti laporan warga — status &amp; tanggapan langsung terlihat di riwayat pelapor
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition shadow-sm disabled:opacity-50 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Stat cards / filter cepat */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {belumDitanggapi > 0 && !isLoading && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            <strong className="font-bold">{belumDitanggapi} laporan</strong> belum diberi tanggapan.
          </span>
        </div>
      )}

      {/* Pencarian & filter kategori */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={cari}
          onChange={e => setCari(e.target.value)}
          placeholder="Cari tiket / pelapor / isi laporan…"
          className="flex-1 min-w-[180px] text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        />
        <select
          value={kategoriFilter}
          onChange={e => setKategoriFilter(e.target.value)}
          aria-label="Filter kategori"
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-emerald-400"
        >
          <option value="SEMUA">Semua kategori</option>
          {kategoriTersedia.map(k => (
            <option key={k} value={k}>{KATEGORI_LABEL[k] ?? k}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400 font-medium">{filteredList.length} laporan</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat pengaduan…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <MessageSquareWarning className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">
              {list.length === 0 ? 'Belum ada pengaduan masuk' : 'Tidak ada laporan yang cocok'}
            </p>
            <p className="text-xs mt-1">
              {list.length === 0
                ? 'Laporan yang dikirim warga lewat menu Aduan akan muncul di sini'
                : 'Coba ubah kata kunci atau filter'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredList.map(p => {
            const waNumber = toWhatsappNumber(p.kontakPelapor);
            return (
              <article
                key={p.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition hover:shadow-md flex flex-col ${
                  p.tanggapan ? 'border-slate-200' : 'border-amber-200'
                }`}
              >
                <div className="px-4 py-3 space-y-2.5 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">
                        {KATEGORI_LABEL[String(p.kategori).toUpperCase()] ?? p.kategori}
                      </h3>
                      <p className="font-mono text-[11px] text-slate-400 truncate">{p.nomorTiket}</p>
                    </div>
                    <StatusPill status={p.status} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{p.namaPelapor || 'Tanpa nama'}</span>
                      {p.wargaId && (
                        <span
                          title="Dikirim dari akun warga terdaftar"
                          className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700"
                        >
                          terdaftar
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {fmtWaktu(p.createdAt)}
                    </span>
                  </div>

                  {p.alamatKejadian && (
                    <p className="flex items-start gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span className="min-w-0">{p.alamatKejadian}</span>
                    </p>
                  )}

                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line line-clamp-4">
                    {p.isiLaporan}
                  </p>

                  {p.tanggapan && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">
                        Tanggapan pengurus
                      </p>
                      <p className="mt-1 text-xs text-emerald-800 leading-relaxed whitespace-pre-line line-clamp-3">
                        {p.tanggapan}
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                  {p.kontakPelapor && (
                    waNumber ? (
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Phone className="w-3.5 h-3.5" /> {p.kontakPelapor}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                        <Phone className="w-3.5 h-3.5" /> {p.kontakPelapor}
                      </span>
                    )
                  )}
                  {canManage && (
                    <button
                      onClick={() => setEditing(p)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition ml-auto"
                    >
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      {p.tanggapan ? 'Ubah Tanggapan' : 'Tanggapi'}
                    </button>
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

export default PengaduanAdminView;
