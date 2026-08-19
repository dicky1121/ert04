import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Filter,
  Image,
  Loader2,
  MapPin,
  RefreshCw,
  Siren,
  User,
  X,
} from 'lucide-react';
import {
  CurrentUser,
  EWS_JENIS_KEJADIAN,
  JenisKejadianEWS,
  LaporanEWS,
  StatusEWS,
} from '../types';
import { supabaseService } from '../services/supabaseService';
import { StatusNotifikasiPanel } from './StatusNotifikasiPanel';

interface EWSAdminViewProps {
  currentUser: CurrentUser;
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Salinan aman daftar jenis kejadian. Bila konstanta dari '../types' gagal
// dimuat (mis. urutan modul berubah setelah bundling), pemakaian .find()/.map()
// pada nilai undefined akan melempar TypeError dan membuat seluruh halaman
// menjadi putih kosong. Fallback array kosong mencegah hal itu.
const DAFTAR_JENIS = Array.isArray(EWS_JENIS_KEJADIAN) ? EWS_JENIS_KEJADIAN : [];

const STATUS_META: Record<StatusEWS, { label: string; badgeClass: string; dotClass: string }> = {
  BARU: {
    label: 'Baru',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500 animate-pulse',
  },
  DITANGANI: {
    label: 'Ditangani',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-400',
  },
  SELESAI: {
    label: 'Selesai',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
};

const formatWaktu = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── komponen foto lightbox ────────────────────────────────────────────────────
const FotoLightbox: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    onClick={onClose}
    role="dialog"
    aria-label="Foto laporan"
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
      alt="Foto laporan EWS"
      className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// ── komponen utama ────────────────────────────────────────────────────────────
export const EWSAdminView: React.FC<EWSAdminViewProps> = ({ currentUser }) => {
  const [laporanList, setLaporanList] = useState<LaporanEWS[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusEWS | 'SEMUA'>('SEMUA');
  const [filterJenis, setFilterJenis] = useState<JenisKejadianEWS | 'SEMUA'>('SEMUA');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Pakai versi detail agar kegagalan (sesi habis / RLS menolak) tampil
      // sebagai pesan yang jelas, bukan sebagai daftar kosong yang membingungkan.
      const { data, error: fetchError } = await supabaseService.fetchRiwayatEWSDetail();
      // Pastikan selalu array: jika tidak, .filter()/.map() akan melempar
      // TypeError dan menghapus seluruh tampilan (layar putih).
      const list = Array.isArray(data) ? data : [];
      setLaporanList(list);
      setNewCount(list.filter(l => l.status === 'BARU').length);
      if (fetchError) setError(fetchError);
    } catch (err) {
      console.error('Gagal memuat riwayat EWS:', err);
      setLaporanList([]);
      setNewCount(0);
      setError(
        `Gagal memuat riwayat EWS: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsLoading(false);
    }
  }, []);



  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Realtime subscription — laporan baru masuk otomatis.
  // Dibungkus try/catch dan pengecekan tipe: bila kanal realtime gagal dibuat,
  // panel tetap tampil (memakai data hasil refresh) alih-alih membuat React
  // melepas seluruh halaman sehingga layar jadi putih kosong.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const result = supabaseService.subscribeEWSRealtime((laporan) => {
        setLaporanList(prev => {
          // Hindari duplikat jika sudah ada
          if (prev.some(l => l.id === laporan.id)) return prev;
          return [laporan, ...prev];
        });
        setNewCount(prev => prev + 1);
        showToast(`🚨 Laporan baru: ${laporan.jenis_kejadian} — ${laporan.nama_pelapor}`);
      });
      if (typeof result === 'function') unsubscribe = result;
    } catch (err) {
      console.warn('Kanal realtime EWS tidak dapat dibuka:', err);
    }
    return () => {
      try {
        unsubscribe?.();
      } catch (err) {
        console.warn('Gagal menutup kanal realtime EWS:', err);
      }
    };
  }, []);


  // Cleanup toast timer
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const handleUpdateStatus = async (id: string, status: StatusEWS) => {
    setUpdatingId(id);
    const result = await supabaseService.updateStatusEWS(id, status);
    if (result.success) {
      setLaporanList(prev =>
        prev.map(l => l.id === id ? { ...l, status } : l)
      );
      setNewCount(
        laporanList.map(l => l.id === id ? { ...l, status } : l).filter(l => l.status === 'BARU').length
      );
      showToast(`Status laporan diperbarui → ${STATUS_META[status].label}`);
    } else {
      showToast(`Gagal memperbarui status: ${result.error}`);
    }
    setUpdatingId(null);
  };

  // Filtered list
  const filteredList = laporanList.filter(l => {
    if (filterStatus !== 'SEMUA' && l.status !== filterStatus) return false;
    if (filterJenis !== 'SEMUA' && l.jenis_kejadian !== filterJenis) return false;
    return true;
  });

  const jenisMeta = (jenis: string) =>
    DAFTAR_JENIS.find(j => j.value === jenis) ?? { emoji: '📢', label: jenis, warna: 'purple' };

  // Role check — hanya pengurus aktif yang bisa update status.
  // Memakai optional chaining supaya panel tidak crash (layar putih) bila prop
  // currentUser belum siap saat render pertama.
  const canUpdateStatus =
    currentUser?.role === 'ADMIN_KETUA_RT' ||
    currentUser?.role === 'ADMIN_SEKRETARIS' ||
    currentUser?.role === 'ADMIN_SISTEM' ||
    currentUser?.role === 'SEKSI_KEAMANAN';


  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="px-4 py-3 rounded-full shadow-lg border border-rose-800 bg-rose-900 text-rose-100 text-xs font-semibold flex items-center gap-2">
            <Siren className="w-4 h-4 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Foto lightbox */}
      {fotoUrl && <FotoLightbox url={fotoUrl} onClose={() => setFotoUrl(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
              <Siren className="w-4 h-4 text-rose-600" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">EWS Darurat</h1>
            {newCount > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {newCount} baru
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Riwayat laporan darurat warga · realtime
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status notifikasi perangkat ini.
          Ditempatkan tepat di atas daftar laporan supaya pengurus langsung
          tahu bila HP-nya tidak akan berbunyi saat laporan darurat masuk. */}
      <StatusNotifikasiPanel />

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {(['BARU', 'DITANGANI', 'SELESAI'] as StatusEWS[]).map(s => {
          const cnt = laporanList.filter(l => l.status === s).length;
          const meta = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'SEMUA' : s)}
              className={`rounded-2xl border p-4 text-left transition hover:shadow-md ${filterStatus === s ? meta.badgeClass + ' border-current' : 'bg-white border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                <span className="text-xs font-bold text-current uppercase tracking-wide">{meta.label}</span>
              </div>
              <p className="text-2xl font-black text-slate-900">{cnt}</p>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </div>
        <select
          value={filterJenis}
          onChange={e => setFilterJenis(e.target.value as JenisKejadianEWS | 'SEMUA')}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:border-rose-400"
        >
          <option value="SEMUA">Semua Jenis</option>
          {DAFTAR_JENIS.map(j => (
            <option key={j.value} value={j.value}>{j.emoji} {j.label}</option>

          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as StatusEWS | 'SEMUA')}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:border-rose-400"
        >
          <option value="SEMUA">Semua Status</option>
          <option value="BARU">Baru</option>
          <option value="DITANGANI">Ditangani</option>
          <option value="SELESAI">Selesai</option>
        </select>
        {(filterStatus !== 'SEMUA' || filterJenis !== 'SEMUA') && (
          <button
            onClick={() => { setFilterStatus('SEMUA'); setFilterJenis('SEMUA'); }}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-3 h-3" /> Reset filter
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 font-medium">{filteredList.length} laporan</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm font-medium">Memuat laporan EWS...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Bell className="w-7 h-7" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-600">Belum ada laporan EWS</p>
            <p className="text-xs mt-1">Laporan darurat dari warga akan muncul di sini secara realtime</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map(laporan => {
            const meta = STATUS_META[laporan.status as StatusEWS] ?? STATUS_META.BARU;
            const jenis = jenisMeta(laporan.jenis_kejadian);
            const isUpdating = updatingId === laporan.id;

            return (
              <article
                key={laporan.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition hover:shadow-md ${
                  laporan.status === 'BARU' ? 'border-rose-200' : 'border-slate-200'
                }`}
              >
                {/* Card header */}
                <div className={`flex items-center justify-between gap-3 px-4 py-3 ${laporan.status === 'BARU' ? 'bg-rose-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl leading-none" aria-hidden>{jenis.emoji}</span>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-900 truncate block">{jenis.label}</span>
                      <span className="text-xs text-slate-500 font-mono truncate block">{laporan.id}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${meta.badgeClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                    {meta.label}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-2.5">
                  {/* Deskripsi */}
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {laporan.deskripsi}
                  </p>

                  {/* Meta info */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {laporan.nama_pelapor}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {laporan.alamat}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatWaktu(laporan.created_at)}
                    </span>
                  </div>

                  {/* Foto thumbnail */}
                  {laporan.foto_url && (
                    <button
                      onClick={() => setFotoUrl(laporan.foto_url!)}
                      className="flex items-center gap-2 text-xs text-sky-600 hover:text-sky-800 font-medium transition"
                      aria-label="Lihat foto laporan"
                    >
                      <Image className="w-4 h-4" />
                      Lihat foto laporan
                    </button>
                  )}
                </div>

                {/* Card footer — update status */}
                {canUpdateStatus && (
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500 font-semibold mr-1">Ubah status:</span>
                    {(['BARU', 'DITANGANI', 'SELESAI'] as StatusEWS[]).map(s => {
                      const sm = STATUS_META[s];
                      const isActive = laporan.status === s;
                      return (
                        <button
                          key={s}
                          disabled={isActive || isUpdating}
                          onClick={() => handleUpdateStatus(laporan.id, s)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-semibold transition ${
                            isActive
                              ? sm.badgeClass + ' cursor-default'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 disabled:opacity-40'
                          }`}
                        >
                          {isUpdating && !isActive ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isActive ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : null}
                          {sm.label}
                        </button>
                      );
                    })}
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
