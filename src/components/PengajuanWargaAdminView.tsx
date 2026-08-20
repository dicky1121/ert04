import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Inbox,
  KeyRound,
  RefreshCw,
  UserCheck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { PengajuanWarga, StatusPendaftaranWargaKode, Warga } from '../types';

interface PengajuanWargaAdminViewProps {
  pengajuanList: PengajuanWarga[];
  wargaList: Warga[];
  onSetujui: (id: string, fields?: string[] | null) => Promise<void> | void;
  onTolak: (id: string, catatan: string) => Promise<void> | void;
}

type FieldType = 'text' | 'date' | 'bool' | 'jk' | 'bansos' | 'tinggal';

interface FieldDef {
  key: string; // nama kolom snake_case (harus cocok dgn p_fields di RPC setujui_pendaftaran_warga)
  prop: keyof PengajuanWarga & keyof Warga; // accessor camelCase (sama di PengajuanWarga & Warga)
  label: string;
  type: FieldType;
}

// Urutan & kolom yang bisa disetujui-sebagian. NIK & email sengaja TIDAK ada:
// NIK = kunci pencocokan (tak diubah), email tidak dikumpulkan lewat form warga
// (menyertakannya berisiko menimpa email lama dengan kosong).
const FIELDS: FieldDef[] = [
  { key: 'nama', prop: 'nama', label: 'Nama Lengkap', type: 'text' },
  { key: 'nomor_kk', prop: 'nomorKK', label: 'Nomor KK', type: 'text' },
  { key: 'jenis_kelamin', prop: 'jenisKelamin', label: 'Jenis Kelamin', type: 'jk' },
  { key: 'tempat_lahir', prop: 'tempatLahir', label: 'Tempat Lahir', type: 'text' },
  { key: 'tanggal_lahir', prop: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'agama', prop: 'agama', label: 'Agama', type: 'text' },
  { key: 'pekerjaan', prop: 'pekerjaan', label: 'Pekerjaan', type: 'text' },
  { key: 'status_perkawinan', prop: 'statusPerkawinan', label: 'Status Perkawinan', type: 'text' },
  { key: 'status_hubungan_kk', prop: 'statusHubunganKK', label: 'Hubungan dalam KK', type: 'text' },
  { key: 'golongan_darah', prop: 'golonganDarah', label: 'Golongan Darah', type: 'text' },
  { key: 'nomor_hp', prop: 'nomorHp', label: 'Nomor HP', type: 'text' },
  { key: 'status_tinggal', prop: 'statusTinggal', label: 'Status Tinggal', type: 'tinggal' },
  { key: 'status_bansos', prop: 'statusBansos', label: 'Bantuan Sosial', type: 'bansos' },
  { key: 'keterangan_bansos', prop: 'keteranganBansos', label: 'Keterangan Bansos', type: 'text' },
  { key: 'is_yatim', prop: 'isYatim', label: 'Anak Yatim / Piatu', type: 'bool' },
  { key: 'is_disabilitas', prop: 'isDisabilitas', label: 'Penyandang Disabilitas', type: 'bool' },
  { key: 'catatan', prop: 'catatan', label: 'Catatan', type: 'text' },
];

const BANSOS_LABEL: Record<string, string> = {
  TIDAK_ADA: 'Tidak Ada (Mampu)',
  PKH: 'PKH',
  BPNT: 'BPNT / Sembako',
  BLT: 'BLT',
  BST: 'BST',
  BANSOS_DAERAH: 'Bansos APBD Kab. Bekasi',
};
const TINGGAL_LABEL: Record<string, string> = {
  TETAP: 'Warga Tetap',
  KONTRAK: 'Pengontrak',
  KOS: 'Kos',
};

const fmtTanggal = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtWaktu = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const rawVal = (obj: PengajuanWarga | Warga | undefined, f: FieldDef): string | boolean => {
  if (!obj) return f.type === 'bool' ? false : '';
  const v = (obj as any)[f.prop];
  return f.type === 'bool' ? Boolean(v) : v ?? '';
};

const displayVal = (obj: PengajuanWarga | Warga | undefined, f: FieldDef): string => {
  const v = rawVal(obj, f);
  switch (f.type) {
    case 'bool':
      return v ? 'Ya' : 'Tidak';
    case 'jk':
      return v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : '—';
    case 'date':
      return v ? fmtTanggal(String(v)) : '—';
    case 'bansos':
      return v ? BANSOS_LABEL[String(v)] || String(v) : '—';
    case 'tinggal':
      return v ? TINGGAL_LABEL[String(v)] || String(v) : '—';
    default:
      return v ? String(v) : '—';
  }
};

// Apakah nilai "diajukan" bermakna (layak diterapkan). Nilai default/kosong
// dianggap tak bermakna agar tak menimpa data lama dengan kosong.
const isMeaningful = (sub: PengajuanWarga, f: FieldDef): boolean => {
  if (f.type === 'bool') return true;
  const v = String(rawVal(sub, f) || '').trim();
  if (v === '') return false;
  if (f.key === 'golongan_darah' && v === '-') return false;
  return true;
};

const norm = (v: string | boolean): string => (typeof v === 'boolean' ? (v ? '1' : '0') : String(v).trim().toUpperCase());

const isChanged = (sub: PengajuanWarga, lama: Warga | undefined, f: FieldDef): boolean => {
  const a = rawVal(sub, f);
  const b = rawVal(lama, f);
  if (f.type !== 'bool') {
    const aBlank = String(a || '').trim() === '' || (f.key === 'golongan_darah' && a === '-');
    const bBlank = String(b || '').trim() === '' || (f.key === 'golongan_darah' && b === '-');
    if (aBlank && bBlank) return false;
  }
  return norm(a) !== norm(b);
};

const STATUS_BADGE: Record<StatusPendaftaranWargaKode, { text: string; cls: string; Icon: typeof Clock }> = {
  PENDING: { text: 'Menunggu', cls: 'bg-amber-100 text-amber-800 border-amber-200', Icon: Clock },
  DISETUJUI: { text: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  DITOLAK: { text: 'Ditolak', cls: 'bg-rose-100 text-rose-800 border-rose-200', Icon: XCircle },
};

// ---------------------------------------------------------------------
// Kartu satu pengajuan
// ---------------------------------------------------------------------
interface CardProps {
  pengajuan: PengajuanWarga;
  lama: Warga | undefined;
  onSetujui: PengajuanWargaAdminViewProps['onSetujui'];
  onTolak: PengajuanWargaAdminViewProps['onTolak'];
}

const PengajuanCard: React.FC<CardProps> = ({ pengajuan: p, lama, onSetujui, onTolak }) => {
  const isPerbarui = !!lama; // pencocokan ulang saat review (bukan hanya jenisPengajuan tersimpan)
  const isPending = p.status === 'PENDING';

  const applicableFields = useMemo(() => FIELDS.filter((f) => isMeaningful(p, f)), [p]);
  const changedFields = useMemo(
    () => (isPerbarui ? FIELDS.filter((f) => isMeaningful(p, f) && isChanged(p, lama, f)) : applicableFields),
    [p, lama, isPerbarui, applicableFields]
  );

  const [expanded, setExpanded] = useState(isPending && isPerbarui && changedFields.length > 0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(changedFields.map((f) => f.key)));
  const [tolakMode, setTolakMode] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const run = async (fn: () => Promise<void> | void) => {
    setIsBusy(true);
    setErrorMsg(null);
    try {
      await fn();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Terjadi kesalahan. Coba lagi.');
      setIsBusy(false);
    }
    // Bila sukses, komponen biasanya di-unmount (list refetch) → tak perlu reset busy.
  };

  const st = STATUS_BADGE[p.status];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3.5 border-b border-slate-100">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isPerbarui ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {isPerbarui ? <UserCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-900 truncate">{p.nama || '(Tanpa nama)'}</p>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                isPerbarui ? 'bg-sky-100 text-sky-800 border-sky-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              {isPerbarui ? 'Perbarui Data' : 'Warga Baru'}
            </span>
            {p.akunUserId && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800"
                title="Pengajuan ini berasal dari pendaftaran akun warga. Menyetujuinya otomatis mengaktifkan login NIK + PIN warga."
              >
                <KeyRound className="h-3 w-3" /> Akun Login
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 font-mono">NIK {p.nik || '—'}</p>
          <p className="mt-0.5 text-xs text-slate-400">Diajukan {fmtWaktu(p.submittedAt) || '-'}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
          <st.Icon className="h-3.5 w-3.5" /> {st.text}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3.5 space-y-3">
        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isPerbarui ? (
          <>
            {/* Ringkasan perubahan + toggle detail */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-left"
            >
              <span className="text-xs font-semibold text-slate-700">
                {changedFields.length > 0
                  ? `${changedFields.length} perubahan terdeteksi dari data lama`
                  : 'Tidak ada perubahan dibanding data lama'}
              </span>
              {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </button>

            {expanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500">
                      {isPending && <th className="w-8 pb-1.5" />}
                      <th className="pb-1.5 text-left font-semibold">Kolom</th>
                      <th className="pb-1.5 text-left font-semibold">Data Saat Ini</th>
                      <th className="pb-1.5 text-left font-semibold">Diajukan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map((f) => {
                      const changed = isChanged(p, lama, f);
                      const canApply = isMeaningful(p, f);
                      return (
                        <tr key={f.key} className={`border-t border-slate-100 ${changed ? 'bg-amber-50/60' : ''}`}>
                          {isPending && (
                            <td className="py-1.5 align-top">
                              <input
                                type="checkbox"
                                disabled={!canApply}
                                checked={checked.has(f.key)}
                                onChange={() => toggle(f.key)}
                                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
                                title={canApply ? 'Terapkan kolom ini' : 'Nilai kosong — tidak dapat diterapkan'}
                              />
                            </td>
                          )}
                          <td className="py-1.5 pr-2 align-top font-medium text-slate-600 whitespace-nowrap">{f.label}</td>
                          <td className="py-1.5 pr-2 align-top text-slate-500">{displayVal(lama, f)}</td>
                          <td className={`py-1.5 align-top ${changed ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {displayVal(p, f)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Warga baru: tampilkan data yang diajukan */
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col">
                <span className="text-slate-400">{f.label}</span>
                <span className="font-medium text-slate-800">{displayVal(p, f)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status non-pending: catatan review */}
        {!isPending && (
          <div className="text-xs text-slate-500 space-y-1">
            {p.reviewedAt && <p>Ditinjau: {fmtWaktu(p.reviewedAt)}</p>}
            {p.status === 'DITOLAK' && p.catatanAdmin && (
              <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-rose-700">Catatan: {p.catatanAdmin}</p>
            )}
          </div>
        )}

        {/* Aksi (hanya PENDING) */}
        {isPending && (
          <div className="pt-1">
            {tolakMode ? (
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Alasan penolakan (opsional, tampil ke warga saat cek status)..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400/40"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void run(() => onTolak(p.id, catatan))}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5"
                  >
                    {isBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Konfirmasi Tolak
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setTolakMode(false);
                      setCatatan('');
                    }}
                    className="rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {isPerbarui ? (
                  <>
                    <button
                      type="button"
                      disabled={isBusy || checked.size === 0}
                      onClick={() => void run(() => onSetujui(p.id, [...checked]))}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5"
                      title={checked.size === 0 ? 'Pilih minimal satu kolom' : `Terapkan ${checked.size} kolom terpilih`}
                    >
                      {isBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Setujui Terpilih ({checked.size})
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || applicableFields.length === 0}
                      onClick={() => void run(() => onSetujui(p.id, applicableFields.map((f) => f.key)))}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 text-sm font-semibold px-4 py-2.5"
                      title="Terapkan semua kolom yang diisi warga"
                    >
                      <UserCheck className="h-4 w-4" /> Setujui Semua
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void run(() => onSetujui(p.id, null))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5"
                  >
                    {isBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Setujui & Simpan sebagai Warga
                  </button>
                )}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setTolakMode(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-60 text-sm font-semibold px-4 py-2.5"
                >
                  <X className="h-4 w-4" /> Tolak
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
};

// ---------------------------------------------------------------------
// View utama
// ---------------------------------------------------------------------
type Filter = 'PENDING' | 'DISETUJUI' | 'DITOLAK';

export const PengajuanWargaAdminView: React.FC<PengajuanWargaAdminViewProps> = ({
  pengajuanList,
  wargaList,
  onSetujui,
  onTolak,
}) => {
  const [filter, setFilter] = useState<Filter>('PENDING');

  // index NIK -> warga untuk pencocokan cepat
  const wargaByNik = useMemo(() => {
    const m = new Map<string, Warga>();
    wargaList.forEach((w) => {
      if (w.nik) m.set(w.nik, w);
    });
    return m;
  }, [wargaList]);

  const counts = useMemo(() => {
    const c = { PENDING: 0, DISETUJUI: 0, DITOLAK: 0 };
    pengajuanList.forEach((p) => {
      c[p.status] = (c[p.status] || 0) + 1;
    });
    return c;
  }, [pengajuanList]);

  const filtered = useMemo(
    () => pengajuanList.filter((p) => p.status === filter),
    [pengajuanList, filter]
  );

  const tabs: { key: Filter; label: string }[] = [
    { key: 'PENDING', label: 'Menunggu' },
    { key: 'DISETUJUI', label: 'Disetujui' },
    { key: 'DITOLAK', label: 'Ditolak' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900">Pengajuan Data Warga</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pendaftaran & perbaruan data yang dikirim warga. Tinjau lalu setujui untuk menyimpan ke data induk.
          </p>
        </div>
      </div>

      {/* Filter segmented */}
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              filter === t.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span
                className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  t.key === 'PENDING' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Daftar */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
          <Inbox className="h-8 w-8 text-slate-400" />
          <p className="text-sm font-semibold text-slate-600">
            {filter === 'PENDING' ? 'Belum ada pengajuan yang menunggu.' : `Tidak ada pengajuan berstatus ${STATUS_BADGE[filter].text.toLowerCase()}.`}
          </p>
          {filter === 'PENDING' && <p className="text-xs text-slate-400">Pengajuan warga baru akan muncul di sini secara otomatis.</p>}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((p) => (
            <PengajuanCard key={p.id} pengajuan={p} lama={wargaByNik.get(p.nik)} onSetujui={onSetujui} onTolak={onTolak} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PengajuanWargaAdminView;
