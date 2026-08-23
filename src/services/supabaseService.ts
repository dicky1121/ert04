import { createClient, RealtimeChannel, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { storageService } from './storage';
import { authState } from './authState';
import {
  KartuKeluarga,
  Kegiatan,
  KegiatanInput,
  KonfigurasiPublik,
  LaporanEWS,
  LaporanEWSInput,
  MutasiPenduduk,
  PendaftaranWargaInput,
  DaftarAkunWargaInput,
  PengaduanInput,
  PengajuanSuratPublik,
  PengajuanWarga,
  PengumumanPublik,
  RiwayatPengaduan,
  RiwayatSurat,
  RTConfig,
  StatistikPublik,
  StatusEWS,
  StatusPendaftaranWarga,
  StatusPengajuanPublik,
  StatusUmkm,
  SuratPengantar,
  TagihanIuran,
  TagihanIuranInput,
  PengaturanIuran,
  TransaksiKeuangan,
  TransaksiKeuanganInput,
  UmkmToko,
  UmkmProduk,
  UmkmVarian,
  UmkmTokoInput,
  UmkmProdukInput,
  Warga
} from '../types';



export interface SupabaseSyncResult {
  success: boolean;
  message: string;
  syncedTables?: string[];
  timestamp?: string;
  error?: string;
}

export type CloudSyncPhase = 'local' | 'connecting' | 'online' | 'syncing' | 'offline' | 'error';

export interface CloudSyncState {
  phase: CloudSyncPhase;
  pendingWrites: number;
  lastSyncedAt?: string;
  message?: string;
}

type CloudSyncListener = (state: CloudSyncState) => void;

export interface ParsedSupabaseConnection {
  projectRef?: string;
  projectUrl: string;
  dashboardApiUrl?: string;
  dashboardSqlUrl?: string;
  isPostgresUri?: boolean;
}

type CloudRow = Record<string, any>;

const SHARED_CONFIG_ID = 'global';

/**
 * Deteksi kondisi "tabel/kolom belum ada" dari PostgREST.
 * PostgREST membalas kode PGRST205 (tabel tidak ada di schema cache),
 * PGRST204 (kolom tidak ada), atau kode Postgres 42P01 (undefined_table).
 */
const isMissingSchemaError = (error: { code?: string; message?: string } | null | undefined): boolean => {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  );
};

export const CONFIG_TABLE_MISSING_HINT =
  'Tabel konfigurasi bersama (public.konfigurasi_rt004) belum ada di database. ' +
  'Jalankan scripts/setup-konfigurasi-sync.sql di Supabase SQL Editor agar template surat ikut tersinkron ke semua admin dan perangkat.';


const toSharedConfig = (config: RTConfig): Partial<RTConfig> => {
  const {
    supabaseUrl: _supabaseUrl,
    supabaseAnonKey: _supabaseAnonKey,
    supabaseTersambung: _supabaseTersambung,
    supabaseAutoSync: _supabaseAutoSync,
    googleSpreadsheetId: _googleSpreadsheetId,
    terakhirSinkron: _terakhirSinkron,
    ...sharedConfig
  } = config;
  return sharedConfig;
};

const applySharedConfig = (sharedConfig: unknown) => {
  if (!sharedConfig || typeof sharedConfig !== 'object' || Array.isArray(sharedConfig)) return;
  const localConfig = storageService.getConfig();
  storageService.saveConfig({
    ...localConfig,
    ...(sharedConfig as Partial<RTConfig>),
    supabaseUrl: localConfig.supabaseUrl,
    supabaseAnonKey: localConfig.supabaseAnonKey,
    supabaseTersambung: localConfig.supabaseTersambung,
    supabaseAutoSync: localConfig.supabaseAutoSync,
    googleSpreadsheetId: localConfig.googleSpreadsheetId,
    terakhirSinkron: localConfig.terakhirSinkron
  });
};

const today = () => new Date().toISOString().slice(0, 10);

const toWargaRow = (w: Warga): CloudRow => ({
  id: w.id,
  nik: String(w.nik || '').trim(),
  nomor_kk: String(w.nomorKK || '').trim(),
  nama: (w.nama || '').trim(),
  jenis_kelamin: w.jenisKelamin === 'P' ? 'P' : 'L',
  tempat_lahir: w.tempatLahir || '',
  tanggal_lahir: w.tanggalLahir || null,
  agama: w.agama || 'ISLAM',
  pendidikan: w.pendidikan || '',
  pekerjaan: w.pekerjaan || '',
  status_perkawinan: w.statusPerkawinan || 'BELUM KAWIN',
  status_hubungan_kk: w.statusHubunganKK || 'LAINNYA',
  kewarganegaraan: w.kewarganegaraan || 'WNI',
  golongan_darah: w.golonganDarah || '-',
  nomor_hp: w.nomorHp || '-',
  email: w.email || '',
  status_tinggal: w.statusTinggal || 'TETAP',
  is_lansia: Boolean(w.isLansia),
  is_balita: Boolean(w.isBalita),
  is_yatim: Boolean(w.isYatim),
  is_disabilitas: Boolean(w.isDisabilitas),
  status_bansos: w.statusBansos || 'TIDAK_ADA',
  keterangan_bansos: w.keteranganBansos || '',
  tanggal_input: w.tanggalInput || today(),
  catatan: w.catatan || ''
});

const fromWargaRow = (w: CloudRow): Warga => ({
  id: w.id || `w-${w.nik}`,
  nik: String(w.nik || ''),
  nomorKK: String(w.nomor_kk || ''),
  nama: w.nama || 'Warga Tanpa Nama',
  jenisKelamin: w.jenis_kelamin === 'P' ? 'P' : 'L',
  tempatLahir: w.tempat_lahir || '',
  tanggalLahir: w.tanggal_lahir || '1990-01-01',
  agama: (w.agama || 'ISLAM').toUpperCase(),
  pendidikan: w.pendidikan || '',
  pekerjaan: w.pekerjaan || '',
  statusPerkawinan: (w.status_perkawinan || 'BELUM KAWIN').toUpperCase(),
  statusHubunganKK: (w.status_hubungan_kk || 'LAINNYA').toUpperCase(),
  kewarganegaraan: w.kewarganegaraan === 'WNA' ? 'WNA' : 'WNI',
  golonganDarah: w.golongan_darah || '-',
  nomorHp: w.nomor_hp || '-',
  email: w.email || '',
  statusTinggal: w.status_tinggal || 'TETAP',
  isLansia: Boolean(w.is_lansia),
  isBalita: Boolean(w.is_balita),
  isYatim: Boolean(w.is_yatim),
  isDisabilitas: Boolean(w.is_disabilitas),
  statusBansos: w.status_bansos || 'TIDAK_ADA',
  keteranganBansos: w.keterangan_bansos || '',
  tanggalInput: w.tanggal_input || today(),
  catatan: w.catatan || ''
} as Warga);

const fromSubmissionRow = (r: CloudRow): PengajuanWarga => ({
  id: String(r.id || ''),
  nik: String(r.nik || ''),
  nomorKK: String(r.nomor_kk || ''),
  nama: r.nama || '',
  jenisKelamin: r.jenis_kelamin === 'P' ? 'P' : r.jenis_kelamin === 'L' ? 'L' : '',
  tempatLahir: r.tempat_lahir || '',
  tanggalLahir: r.tanggal_lahir || '',
  agama: (r.agama || '').toUpperCase(),
  pekerjaan: r.pekerjaan || '',
  statusPerkawinan: (r.status_perkawinan || '').toUpperCase(),
  statusHubunganKK: (r.status_hubungan_kk || '').toUpperCase(),
  golonganDarah: r.golongan_darah || '-',
  nomorHp: r.nomor_hp || '',
  email: r.email || '',
  statusTinggal: r.status_tinggal || 'TETAP',
  isYatim: Boolean(r.is_yatim),
  isDisabilitas: Boolean(r.is_disabilitas),
  statusBansos: r.status_bansos || 'TIDAK_ADA',
  keteranganBansos: r.keterangan_bansos || '',
  catatan: r.catatan || '',
  jenisPengajuan: r.jenis_pengajuan === 'PERBARUI' ? 'PERBARUI' : 'BARU',
  status: (['PENDING', 'DISETUJUI', 'DITOLAK'].includes(r.status) ? r.status : 'PENDING') as PengajuanWarga['status'],
  matchedWargaId: r.matched_warga_id || null,
  akunUserId: r.akun_user_id || null,
  catatanAdmin: r.catatan_admin || null,
  submittedAt: r.submitted_at || '',
  reviewedAt: r.reviewed_at || null
});

const fromKegiatanRow = (r: CloudRow): Kegiatan => ({
  id: String(r.id || ''),
  judul: r.judul || '',
  deskripsi: r.deskripsi || '',
  tanggal: r.tanggal || '',
  waktu: r.waktu || '',
  lokasi: r.lokasi || '',
  fotoUrl: r.foto_url || null,
  dipublikasikan: r.dipublikasikan !== false,
  createdAt: r.created_at || ''
});

const fromKeuanganRow = (r: CloudRow): TransaksiKeuangan => ({
  id: String(r.id || ''),
  tanggal: r.tanggal || '',
  jenis: r.jenis === 'KELUAR' ? 'KELUAR' : 'MASUK',
  kategori: r.kategori || 'Lainnya',
  jumlah: Number(r.jumlah) || 0,
  keterangan: r.keterangan || '',
  bulanKas: r.bulan_kas || (r.tanggal ? String(r.tanggal).slice(0, 7) : ''),
  createdAt: r.created_at || ''
});

// ── Iuran / Tagihan warga: pemetaan baris DB → tipe aplikasi ──────────────────
const fromIuranRow = (r: CloudRow): TagihanIuran => {
  const status = String(r.status || 'BELUM_LUNAS');
  return {
    id: String(r.id || ''),
    wargaId: String(r.warga_id || ''),
    judul: r.judul || 'Iuran Kas RT',
    periode: r.periode || '',
    jumlah: Number(r.jumlah) || 0,
    status: (['BELUM_LUNAS', 'MENUNGGU_VERIFIKASI', 'LUNAS', 'DITOLAK'].includes(status)
      ? status
      : 'BELUM_LUNAS') as TagihanIuran['status'],
    jatuhTempo: r.jatuh_tempo || null,
    buktiPath: r.bukti_path || null,
    dibayarAt: r.dibayar_at || null,
    verifiedBy: r.verified_by || null,
    verifiedAt: r.verified_at || null,
    catatan: r.catatan || null,
    dibuatOleh: r.dibuat_oleh || null,
    createdAt: r.created_at || '',
    updatedAt: r.updated_at || ''
  };
};

const fromPengaturanIuranRow = (r: CloudRow): PengaturanIuran => ({
  infoPembayaran: r.info_pembayaran || '',
  nominalDefault: Number(r.nominal_default) || 0,
  judulDefault: r.judul_default || 'Iuran Kas RT'
});

// ── UMKM mini-marketplace: pemetaan baris DB → tipe aplikasi ──────────────────
const fromVarianRow = (r: CloudRow): UmkmVarian => ({
  id: String(r.id || ''),
  produkId: String(r.produk_id || ''),
  namaVarian: r.nama_varian || '',
  harga: Number(r.harga) || 0,
  tersedia: r.tersedia !== false,
  urutan: Number(r.urutan) || 0
});

const fromProdukRow = (r: CloudRow): UmkmProduk => {
  const varianRaw = Array.isArray(r.umkm_varian_rt004) ? r.umkm_varian_rt004 : [];
  return {
    id: String(r.id || ''),
    umkmId: String(r.umkm_id || ''),
    namaProduk: r.nama_produk || '',
    deskripsi: r.deskripsi || '',
    harga: Number(r.harga) || 0,
    fotoUrl: r.foto_url || null,
    tersedia: r.tersedia !== false,
    urutan: Number(r.urutan) || 0,
    varian: varianRaw.map(fromVarianRow).sort((a, b) => a.urutan - b.urutan)
  };
};

const fromTokoRow = (r: CloudRow, currentUid?: string | null): UmkmToko => {
  const produkRaw = Array.isArray(r.umkm_produk_rt004) ? r.umkm_produk_rt004 : [];
  const ownerUid = String(r.owner_uid || '');
  return {
    id: String(r.id || ''),
    ownerUid,
    namaUsaha: r.nama_usaha || '',
    kategori: r.kategori || 'Lainnya',
    deskripsi: r.deskripsi || '',
    fotoUrl: r.foto_url || null,
    kontakWa: r.kontak_wa || '',
    alamat: r.alamat || '',
    status: (['PENDING', 'VERIFIED', 'DITOLAK'].includes(r.status) ? r.status : 'PENDING') as StatusUmkm,
    catatanAdmin: r.catatan_admin || null,
    reviewedAt: r.reviewed_at || null,
    createdAt: r.created_at || '',
    produk: produkRaw.map(fromProdukRow).sort((a, b) => a.urutan - b.urutan),
    milikSaya: currentUid ? ownerUid === currentUid : false
  };
};

const toKKRow = (k: KartuKeluarga): CloudRow => ({
  id: k.id,
  nomor_kk: String(k.nomorKK || '').trim(),
  kepala_keluarga_nama: k.kepalaKeluargaNama || '',
  kepala_keluarga_nik: String(k.kepalaKeluargaNik || '').trim(),
  alamat: k.alamat || '',
  rt: k.rt || '004',
  rw: k.rw || '007',
  kelurahan: k.kelurahan || '',
  kecamatan: k.kecamatan || '',
  kabupaten_kota: k.kabupatenKota || '',
  provinsi: k.provinsi || '',
  kode_pos: k.kodePos || '',
  status_domisili: k.statusDomisili || 'TETAP',
  blok_rumah: k.blokRumah || '',
  tanggal_terbit: k.tanggalTerbit || today(),
  tanggal_update: k.tanggalUpdate || today(),
  catatan: k.catatan || ''
});

const fromKKRow = (k: CloudRow): KartuKeluarga => ({
  id: k.id || `kk-${k.nomor_kk}`,
  nomorKK: String(k.nomor_kk || ''),
  kepalaKeluargaNama: k.kepala_keluarga_nama || '',
  kepalaKeluargaNik: String(k.kepala_keluarga_nik || ''),
  alamat: k.alamat || '',
  rt: k.rt || '004',
  rw: k.rw || '007',
  kelurahan: k.kelurahan || '',
  kecamatan: k.kecamatan || '',
  kabupatenKota: k.kabupaten_kota || '',
  provinsi: k.provinsi || '',
  kodePos: k.kode_pos || '',
  statusDomisili: k.status_domisili || 'TETAP',
  blokRumah: k.blok_rumah || '',
  tanggalTerbit: k.tanggal_terbit || today(),
  anggota: [],
  tanggalUpdate: k.tanggal_update || today(),
  catatan: k.catatan || ''
} as KartuKeluarga);

const toSuratRow = (s: SuratPengantar): CloudRow => ({
  id: s.id,
  nomor_surat: s.nomorSurat,
  jenis_surat: s.jenisSurat,
  judul_surat: s.judulSurat,
  nik_pemohon: s.nikPemohon,
  nama_pemohon: s.namaPemohon,
  nomor_kk_pemohon: s.nomorKKPemohon,
  tempat_tgl_lahir_pemohon: s.tempatTglLahirPemohon,
  jenis_kelamin_pemohon: s.jenisKelaminPemohon,
  agama_pemohon: s.agamaPemohon,
  pekerjaan_pemohon: s.pekerjaanPemohon,
  status_kawin_pemohon: s.statusKawinPemohon,
  telepon_pemohon: s.teleponPemohon || '',
  alamat_pemohon: s.alamatPemohon,
  keperluan: s.keperluan,
  keterangan_lain: s.keteranganLain || '',
  tanggal_pengajuan: s.tanggalPengajuan || today(),
  tanggal_disetujui: s.tanggalDisetujui || null,
  status: s.status,
  alasan_penolakan: s.alasanPenolakan || null,
  nama_pejabat_ttd: s.namaPejabatTtd,
  jabatan_ttd: s.jabatanTtd,
  kode_verifikasi_qr: s.kodeVerifikasiQr,
  dibuat_oleh: s.dibuatOleh
});

const fromSuratRow = (s: CloudRow): SuratPengantar => ({
  id: s.id,
  nomorSurat: s.nomor_surat,
  jenisSurat: s.jenis_surat || 'LAINNYA',
  judulSurat: s.judul_surat || 'SURAT PENGANTAR',
  nikPemohon: s.nik_pemohon || '',
  namaPemohon: s.nama_pemohon || '',
  nomorKKPemohon: s.nomor_kk_pemohon || '',
  tempatTglLahirPemohon: s.tempat_tgl_lahir_pemohon || '',
  jenisKelaminPemohon: s.jenis_kelamin_pemohon === 'P' ? 'P' : 'L',
  agamaPemohon: s.agama_pemohon || '',
  pekerjaanPemohon: s.pekerjaan_pemohon || '',
  statusKawinPemohon: s.status_kawin_pemohon || '',
  teleponPemohon: s.telepon_pemohon || '',
  alamatPemohon: s.alamat_pemohon || '',
  keperluan: s.keperluan || '',
  keteranganLain: s.keterangan_lain || '',
  tanggalPengajuan: s.tanggal_pengajuan || today(),
  tanggalDisetujui: s.tanggal_disetujui || undefined,
  status: s.status || 'PENDING',
  alasanPenolakan: s.alasan_penolakan || undefined,
  namaPejabatTtd: s.nama_pejabat_ttd || '',
  jabatanTtd: s.jabatan_ttd || '',
  kodeVerifikasiQr: s.kode_verifikasi_qr || '',
  dibuatOleh: s.dibuat_oleh === 'WARGA' ? 'WARGA' : 'ADMIN'
} as SuratPengantar);

const toMutasiRow = (m: MutasiPenduduk): CloudRow => ({
  id: m.id,
  tanggal: m.tanggal || m.tanggalPeristiwa || today(),
  jenis_mutasi: m.jenisMutasi,
  nik: m.nik || m.nikWarga || '',
  nama_warga: m.namaWarga,
  nomor_kk: m.nomorKK || '',
  alamat_asal: m.alamatAsal || '',
  alamat_tujuan: m.alamatTujuan || '',
  alasan: m.alasan || m.alasanMutasi || '',
  no_surat_keterangan: m.noSuratKeterangan || m.nomorSuratPindah || m.noSuratPindah || '',
  petugas: m.petugas || m.dicatatOleh || '',
  catatan: m.catatan || m.keterangan || ''
});

const fromMutasiRow = (m: CloudRow): MutasiPenduduk => ({
  id: m.id,
  tanggal: m.tanggal || today(),
  jenisMutasi: m.jenis_mutasi || 'PINDAH_MASUK',
  nik: m.nik || '',
  namaWarga: m.nama_warga || '',
  nomorKK: m.nomor_kk || '',
  alamatAsal: m.alamat_asal || '',
  alamatTujuan: m.alamat_tujuan || '',
  alasan: m.alasan || '',
  noSuratKeterangan: m.no_surat_keterangan || '',
  petugas: m.petugas || '',
  catatan: m.catatan || ''
} as MutasiPenduduk);

export function parseSupabaseInput(input: string): ParsedSupabaseConnection {
  const trimmed = input.trim();
  
  // Case 1: postgresql connection string
  // e.g. postgresql://postgres.abcdefghijklmnopqrst:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
  const pgMatch = trimmed.match(/(?:postgresql|postgres):\/\/postgres\.([a-z0-9_-]+):/i);
  if (pgMatch && pgMatch[1]) {
    const projectRef = pgMatch[1];
    return {
      projectRef,
      projectUrl: `https://${projectRef}.supabase.co`,
      dashboardApiUrl: `https://supabase.com/dashboard/project/${projectRef}/settings/api`,
      dashboardSqlUrl: `https://supabase.com/dashboard/project/${projectRef}/sql/new`,
      isPostgresUri: true
    };
  }

  // Case 2: standard supabase.co URL
  // e.g. https://abcdefghijklmnopqrst.supabase.co
  const urlMatch = trimmed.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  if (urlMatch && urlMatch[1]) {
    const projectRef = urlMatch[1];
    return {
      projectRef,
      projectUrl: `https://${projectRef}.supabase.co`,
      dashboardApiUrl: `https://supabase.com/dashboard/project/${projectRef}/settings/api`,
      dashboardSqlUrl: `https://supabase.com/dashboard/project/${projectRef}/sql/new`,
      isPostgresUri: false
    };
  }

  // Case 3: Raw project ID
  if (/^[a-z0-9]{20}$/i.test(trimmed)) {
    return {
      projectRef: trimmed,
      projectUrl: `https://${trimmed}.supabase.co`,
      dashboardApiUrl: `https://supabase.com/dashboard/project/${trimmed}/settings/api`,
      dashboardSqlUrl: `https://supabase.com/dashboard/project/${trimmed}/sql/new`,
      isPostgresUri: false
    };
  }

  return {
    projectUrl: trimmed,
    isPostgresUri: false
  };
}

class SupabaseService {
  private client: SupabaseClient | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private syncListeners = new Set<CloudSyncListener>();
  private syncState: CloudSyncState = { phase: 'local', pendingWrites: 0 };


  public parseInput(input: string): ParsedSupabaseConnection {
    return parseSupabaseInput(input);
  }

  /**
   * Ambil konfigurasi koneksi Supabase.
   *
   * Sumber nilai: konfigurasi yang disimpan pengurus di tab Integrasi, lalu
   * environment variable. Tidak ada fallback project bawaan di dalam kode agar
   * identitas project tidak ikut ter-bundle ke JavaScript browser dan agar tiap
   * deployment wajib mengisi kredensialnya sendiri.
   */
  public getSupabaseConfig(): { url: string; anonKey: string; projectRef?: string } {
    const config = storageService.getConfig();
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
    const rawUrl = config.supabaseUrl || envUrl;
    const parsed = parseSupabaseInput(rawUrl || '');

    return {
      url: parsed.projectUrl || '',
      anonKey: config.supabaseAnonKey || envKey,
      projectRef: parsed.projectRef
    };
  }


  public saveSupabaseConfig(urlOrConnectionString: string, anonKey: string) {
    const parsed = parseSupabaseInput(urlOrConnectionString);
    const finalUrl = parsed.projectUrl || urlOrConnectionString;
    const config = storageService.getConfig();
    config.supabaseUrl = finalUrl;
    config.supabaseAnonKey = anonKey;
    config.supabaseTersambung = !!(finalUrl && anonKey);
    storageService.saveConfig(config);
    this.initClient(finalUrl, anonKey);
  }

  public initClient(url: string, key: string): boolean {
    if (!url || !key) {
      this.client = null;
      return false;
    }
    try {
      this.client = createClient(url, key, {
        auth: {
          // Sesi disimpan di localStorage dan di-refresh otomatis agar
          // pengurus tidak perlu login ulang setiap membuka aplikasi.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return true;

    } catch (e) {
      console.error('Failed to init Supabase client', e);
      this.client = null;
      return false;
    }
  }

  public getClient(): SupabaseClient | null {
    if (!this.client) {
      const { url, anonKey } = this.getSupabaseConfig();
      if (url && anonKey) {
        this.initClient(url, anonKey);
      }
    }
    return this.client;
  }

  public async submitPublicSurat(input: PengajuanSuratPublik): Promise<{ success: boolean; reference?: string; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Layanan pengajuan online belum dikonfigurasi.' };
    }

    try {
      const { data, error } = await client.rpc('ajukan_surat_warga', {
        p_jenis_surat: input.jenisSurat,
        p_nik: input.nikPemohon,
        p_nama: input.namaPemohon,
        p_nomor_kk: input.nomorKKPemohon,
        p_jenis_kelamin: input.jenisKelaminPemohon,
        p_tempat_tgl_lahir: input.tempatTglLahirPemohon,
        p_agama: input.agamaPemohon,
        p_pekerjaan: input.pekerjaanPemohon,
        p_status_kawin: input.statusKawinPemohon,
        p_telepon: input.teleponPemohon,
        p_alamat: input.alamatPemohon,
        p_keperluan: input.keperluan,
        p_keterangan: input.keteranganLain || ''
      });
      if (error) return { success: false, error: error.message };
      return { success: true, reference: typeof data === 'string' ? data : String(data || '') };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Pengajuan tidak dapat dikirim.' };
    }
  }

  /**
   * Kontak & alamat resmi untuk portal publik.
   * Tabel konfigurasi tertutup untuk anon, jadi data diambil lewat fungsi
   * konfigurasi_publik() yang hanya memaparkan field pada kop surat.
   * Mengembalikan null bila Supabase belum dikonfigurasi, agar pemanggil
   * bisa memakai nilai bawaannya sendiri.
   */
  public async fetchKonfigurasiPublik(): Promise<KonfigurasiPublik | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.rpc('konfigurasi_publik');
      if (error || !data || typeof data !== 'object') return null;
      return data as KonfigurasiPublik;
    } catch {
      return null;
    }
  }

  /**
   * Lacak satu pengajuan surat. Nomor referensi saja tidak cukup — NIK
   * wajib disertakan dan keduanya harus cocok pada baris yang sama.
   */
  public async cekStatusPengajuan(
    referensi: string,
    nik: string
  ): Promise<{ success: boolean; data?: StatusPengajuanPublik; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Layanan pelacakan online belum dikonfigurasi.' };
    }

    try {
      const { data, error } = await client.rpc('cek_status_pengajuan', {
        p_referensi: referensi,
        p_nik: nik
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data: (data || { ditemukan: false }) as StatusPengajuanPublik };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Status pengajuan tidak dapat diambil.' };
    }
  }

  /** Angka agregat layanan surat; aman ditampilkan ke publik. */
  public async fetchStatistikPublik(): Promise<StatistikPublik | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.rpc('statistik_publik');
      if (error || !data || typeof data !== 'object') return null;
      const raw = data as Record<string, unknown>;
      return {
        suratSelesaiBulanIni: Number(raw.suratSelesaiBulanIni || 0),
        suratDiproses: Number(raw.suratDiproses || 0),
        suratTahunIni: Number(raw.suratTahunIni || 0)
      };
    } catch {
      return null;
    }
  }

  /** Pengumuman yang sudah dipublikasikan dan masih berlaku hari ini. */
  public async fetchPengumumanPublik(): Promise<PengumumanPublik[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client.rpc('pengumuman_publik');
      if (error || !Array.isArray(data)) return [];
      return data.map((row: any) => ({
        id: String(row.id),
        judul: String(row.judul || ''),
        isi: String(row.isi || ''),
        kategori: String(row.kategori || 'UMUM'),
        tanggalMulai: String(row.tanggal_mulai || ''),
        tanggalSelesai: row.tanggal_selesai || null
      }));
    } catch {
      return [];
    }
  }

  /** Kirim laporan warga. Server membatasi 3 laporan per nomor per jam. */
  public async kirimPengaduan(
    input: PengaduanInput
  ): Promise<{ success: boolean; tiket?: string; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Kanal pengaduan online belum dikonfigurasi.' };
    }

    try {
      const { data, error } = await client.rpc('kirim_pengaduan', {
        p_kategori: input.kategori,
        p_nama: input.namaPelapor,
        p_kontak: input.kontakPelapor,
        p_alamat: input.alamatKejadian,
        p_isi: input.isiLaporan
      });
      if (error) return { success: false, error: error.message };
      return { success: true, tiket: typeof data === 'string' ? data : String(data || '') };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Laporan tidak dapat dikirim.' };
    }
  }

  // ===================================================================
  // Riwayat pribadi warga — RPC SECURITY DEFINER yang sudah di-scope ke
  // pemanggil (tabel surat & pengaduan tetap tertutup untuk warga).
  // Butuh scripts/fitur-riwayat-warga.sql.
  // ===================================================================

  /**
   * Riwayat pengajuan surat MILIK warga yang sedang login. Server mencocokkan
   * lewat NIK sesi; hasil kosong bila pemanggil bukan warga aktif.
   */
  public async fetchPengajuanSaya(): Promise<{ data: RiwayatSurat[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const { data, error } = await client.rpc('pengajuan_saya');
      if (error) return { data: [], error: `Gagal memuat riwayat surat: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return {
        data: data.map((row: any) => ({
          nomorSurat: String(row.nomor_surat || ''),
          jenisSurat: String(row.jenis_surat || ''),
          judulSurat: String(row.judul_surat || ''),
          keperluan: String(row.keperluan || ''),
          status: String(row.status || 'PENDING'),
          tanggalPengajuan: row.tanggal_pengajuan || null,
          tanggalDisetujui: row.tanggal_disetujui || null,
          alasanPenolakan: row.alasan_penolakan || null
        }))
      };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /**
   * Riwayat pengaduan MILIK warga yang sedang login. Hanya laporan yang
   * terstempel `warga_id` yang ikut — laporan sebelum fitur ini tidak punya
   * pemilik sehingga memang tidak muncul.
   */
  public async fetchPengaduanSaya(): Promise<{ data: RiwayatPengaduan[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const { data, error } = await client.rpc('pengaduan_saya');
      if (error) return { data: [], error: `Gagal memuat riwayat pengaduan: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return {
        data: data.map((row: any) => ({
          nomorTiket: String(row.nomor_tiket || ''),
          kategori: String(row.kategori || 'LAINNYA'),
          alamatKejadian: String(row.alamat_kejadian || ''),
          isiLaporan: String(row.isi_laporan || ''),
          status: String(row.status || 'BARU'),
          tanggapan: row.tanggapan || null,
          createdAt: String(row.created_at || '')
        }))
      };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  // ===================================================================
  // Fitur: Daftar / Perbarui Data Warga (pengajuan warga self-service)
  // ===================================================================

  /**
   * Warga (tanpa login) mengirim pengajuan data lewat RPC SECURITY DEFINER.
   * Data masuk ke tabel karantina berstatus PENDING, tidak menyentuh master.
   */
  public async ajukanPendaftaranWarga(
    input: PendaftaranWargaInput
  ): Promise<{ success: boolean; referensi?: string; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Layanan pendaftaran online belum dikonfigurasi.' };
    }

    try {
      const { data, error } = await client.rpc('ajukan_pendaftaran_warga', {
        p_nik: input.nik,
        p_nomor_kk: input.nomorKK,
        p_nama: input.nama,
        p_jenis_kelamin: input.jenisKelamin,
        p_tempat_lahir: input.tempatLahir,
        p_tanggal_lahir: input.tanggalLahir || null,
        p_agama: input.agama,
        p_pekerjaan: input.pekerjaan,
        p_status_perkawinan: input.statusPerkawinan,
        p_status_hubungan_kk: input.statusHubunganKK,
        p_golongan_darah: input.golonganDarah,
        p_nomor_hp: input.nomorHp,
        p_status_tinggal: input.statusTinggal,
        p_is_yatim: Boolean(input.isYatim),
        p_is_disabilitas: Boolean(input.isDisabilitas),
        p_status_bansos: input.statusBansos,
        p_keterangan_bansos: input.keteranganBansos || '',
        p_catatan: input.catatan || ''
      });
      if (error) return { success: false, error: error.message };
      return { success: true, referensi: typeof data === 'string' ? data : String(data || '') };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Pengajuan tidak dapat dikirim.' };
    }
  }

  /** Warga memantau status pengajuannya berdasarkan NIK (RPC publik). */
  public async cekStatusPendaftaranWarga(
    nik: string
  ): Promise<{ success: boolean; data?: StatusPendaftaranWarga; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Layanan pelacakan online belum dikonfigurasi.' };
    }

    try {
      const { data, error } = await client.rpc('cek_status_pendaftaran_warga', { p_nik: nik });
      if (error) return { success: false, error: error.message };
      return { success: true, data: (data || { ditemukan: false }) as StatusPendaftaranWarga };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Status pengajuan tidak dapat diambil.' };
    }
  }

  /** Admin: ambil seluruh pengajuan warga (terbaru dulu). Butuh sesi pengurus. */
  public async fetchPengajuanWarga(): Promise<PengajuanWarga[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('warga_submissions_rt004')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error || !Array.isArray(data)) return [];
      return data.map(fromSubmissionRow);
    } catch {
      return [];
    }
  }

  /**
   * Admin: setujui pengajuan. fields = daftar kolom (snake_case) yang diterapkan
   * saat "setujui sebagian"; undefined/null = terapkan semua kolom.
   */
  public async setujuiPendaftaranWarga(
    submissionId: string,
    fields?: string[] | null
  ): Promise<{ success: boolean; wargaId?: string; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Supabase belum terhubung.' };
    }

    try {
      const { data, error } = await client.rpc('setujui_pendaftaran_warga', {
        p_submission_id: submissionId,
        p_fields: fields && fields.length > 0 ? fields : null
      });
      if (error) return { success: false, error: error.message };
      return { success: true, wargaId: typeof data === 'string' ? data : String(data || '') };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Pengajuan gagal disetujui.' };
    }
  }

  /** Admin: tolak pengajuan dengan catatan. */
  public async tolakPendaftaranWarga(
    submissionId: string,
    catatan: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Supabase belum terhubung.' };
    }

    try {
      const { error } = await client.rpc('tolak_pendaftaran_warga', {
        p_submission_id: submissionId,
        p_catatan: catatan || ''
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Pengajuan gagal ditolak.' };
    }
  }

  // ---------------------------------------------------------------------
  // Akun warga (Portal Warga Terpadu) — Edge Functions + RPC login.
  // ---------------------------------------------------------------------

  /**
   * Panggil Edge Function dan seragamkan penanganan error.
   * functions.invoke mengembalikan FunctionsHttpError pada respons non-2xx;
   * body JSON ({ error }) diambil dari error.context untuk pesan yang jelas.
   */
  private async invokeFunction<T = any>(
    name: string,
    body: unknown
  ): Promise<{ data?: T; error?: string }> {
    const client = this.getClient();
    if (!client) return { error: 'Layanan online belum dikonfigurasi.' };
    try {
      const { data, error } = await client.functions.invoke(name, { body });
      if (error) {
        let msg = error.message || 'Permintaan ke server gagal.';
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const payload = await ctx.json();
            if (payload?.error) msg = payload.error;
          } catch {
            /* body bukan JSON */
          }
        }
        return { error: msg };
      }
      if (data && typeof data === 'object' && 'success' in data && !(data as any).success) {
        return { error: (data as any).error || 'Permintaan gagal diproses.' };
      }
      return { data: data as T };
    } catch (e: any) {
      return { error: e?.message || 'Tidak dapat menghubungi server.' };
    }
  }

  /**
   * Warga mendaftar akun (NIK + PIN 6 angka + data diri). Diproses Edge
   * Function service-role: membuat auth user + baris PENDING (akun & pengajuan).
   */
  public async daftarAkunWarga(
    input: DaftarAkunWargaInput
  ): Promise<{ success: boolean; referensi?: string; error?: string }> {
    const body = {
      nik: input.nik,
      pin: input.pin,
      nomorKK: input.nomorKK,
      nama: input.nama,
      jenisKelamin: input.jenisKelamin,
      tempatLahir: input.tempatLahir,
      tanggalLahir: input.tanggalLahir || null,
      agama: input.agama,
      pekerjaan: input.pekerjaan,
      statusPerkawinan: input.statusPerkawinan,
      statusHubunganKK: input.statusHubunganKK,
      golonganDarah: input.golonganDarah,
      nomorHp: input.nomorHp,
      statusTinggal: input.statusTinggal,
      isYatim: Boolean(input.isYatim),
      isDisabilitas: Boolean(input.isDisabilitas),
      statusBansos: input.statusBansos,
      keteranganBansos: input.keteranganBansos || '',
      catatan: input.catatan || ''
    };
    const res = await this.invokeFunction<{ referensi?: string }>('daftar-akun-warga', body);
    if (res.error) return { success: false, error: res.error };
    return { success: true, referensi: res.data?.referensi };
  }

  /** Pengurus mereset PIN warga (Edge Function pengurus-only). */
  public async resetPinWarga(
    nik: string,
    newPin: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await this.invokeFunction<{ message?: string }>('reset-pin-warga', { nik, newPin });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  /** Catat waktu login warga (reset penghitung gagal login). Non-kritis. */
  public async catatLoginWarga(): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    try {
      await client.rpc('catat_login_warga');
    } catch {
      /* pencatatan login gagal tidak menghalangi akses */
    }
  }


  public getSyncState(): CloudSyncState {
    return { ...this.syncState };
  }

  public subscribeSyncState(listener: CloudSyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncState());
    return () => this.syncListeners.delete(listener);
  }

  public markOffline() {
    this.setSyncState({
      phase: 'offline',
      message: 'Perangkat offline. Perubahan belum disimpan.'
    });
  }

  private setSyncState(patch: Partial<CloudSyncState>) {
    this.syncState = { ...this.syncState, ...patch };
    this.syncListeners.forEach(listener => listener(this.getSyncState()));
  }

  public isCloudMode(): boolean {
    const { url, anonKey } = this.getSupabaseConfig();
    return Boolean(url && anonKey && authState.hasActiveSession());
  }

  private async runCloudWrite<T extends { success: boolean; error?: string }>(operation: () => Promise<T>): Promise<T> {
    if (!this.isCloudMode()) {
      return { success: false, error: 'Sesi cloud tidak aktif. Login ulang sebelum mengubah data.' } as T;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setSyncState({ phase: 'offline', message: 'Perangkat offline. Perubahan belum disimpan.' });
      return { success: false, error: 'Perangkat sedang offline. Sambungkan internet lalu coba lagi.' } as T;
    }

    this.setSyncState({ phase: 'syncing', pendingWrites: this.syncState.pendingWrites + 1, message: 'Menyimpan perubahan ke cloud...' });
    try {
      const result = await operation();
      const pendingWrites = Math.max(0, this.syncState.pendingWrites - 1);
      this.setSyncState({
        phase: result.success ? 'online' : 'error',
        pendingWrites,
        lastSyncedAt: result.success ? new Date().toISOString() : this.syncState.lastSyncedAt,
        message: result.success ? 'Semua perubahan tersimpan di cloud.' : result.error
      });
      return result;
    } catch (error: any) {
      const result = { success: false, error: error?.message || 'Operasi cloud gagal.' } as T;
      this.setSyncState({ phase: 'error', pendingWrites: Math.max(0, this.syncState.pendingWrites - 1), message: result.error });
      return result;
    }
  }

  public async testConnection(urlParam?: string, keyParam?: string): Promise<{ success: boolean; message: string }> {
    const config = this.getSupabaseConfig();
    const url = urlParam || config.url;
    const key = keyParam || config.anonKey;

    if (!url || !url.startsWith('https://')) {
      return { success: false, message: 'URL Supabase harus diawali dengan https:// (Contoh: https://xyzcompany.supabase.co)' };
    }
    if (!key || key.length < 20) {
      return { success: false, message: 'Supabase Anon Key tidak valid atau terlalu pendek.' };
    }

    try {
      const testClient = createClient(url, key);
      const { error } = await testClient.from('warga_rt004').select('id').limit(1);
      if (error) {
        return {
          success: false,
          message: `Koneksi ditolak: ${error.message}. Pastikan sesi pengurus aktif dan skema database sudah dipasang.`
        };
      }
      return {
        success: true,
        message: 'Koneksi ke instance Supabase Cloud berhasil diverifikasi dan siap digunakan!'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal terhubung ke Supabase: ${err.message || 'Periksa URL dan API Key'}`
      };
    }
  }

  /**
   * PULL / IMPORT all data from Supabase Cloud to WebApp local storage
   */
  public async pullFromSupabase(): Promise<{
    success: boolean;
    message: string;
    counts?: { warga: number; kk: number; surat: number; mutasi: number };
    error?: string;
  }> {
    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        message: 'Koneksi Supabase belum terkonfigurasi. Masukkan Supabase URL dan Anon Key di tab Integrasi.',
        error: 'Client not configured'
      };
    }

    try {
      this.setSyncState({ phase: 'syncing', message: 'Mengambil data terbaru dari cloud...' });
      // 1. Fetch Kartu Keluarga
      const { data: kkData, error: kkError } = await client
        .from('kartu_keluarga_rt004')
        .select('*');

      if (kkError) throw new Error(`Gagal mengambil data KK: ${kkError.message}`);

      // 2. Fetch Warga
      const { data: wargaData, error: wargaError } = await client
        .from('warga_rt004')
        .select('*');

      if (wargaError) {
        throw new Error(`Gagal mengambil data warga: ${wargaError.message}`);
      }

      // 3. Fetch Surat Pengantar
      const { data: suratData, error: suratError } = await client
        .from('surat_pengantar_rt004')
        .select('*');
      if (suratError) throw new Error(`Gagal mengambil surat: ${suratError.message}`);

      // 4. Fetch Mutasi
      const { data: mutasiData, error: mutasiError } = await client
        .from('mutasi_penduduk_rt004')
        .select('*');
      if (mutasiError) throw new Error(`Gagal mengambil mutasi: ${mutasiError.message}`);

      // Konfigurasi surat bersifat global untuk seluruh pengurus. Kegagalan
      // membaca tabel ini tidak boleh menghalangi pemuatan data utama ketika
      // migrasi konfigurasi bersama belum dijalankan.
      const { data: configData, error: configError } = await client
        .from('konfigurasi_rt004')
        .select('config_data')
        .eq('id', SHARED_CONFIG_ID)
        .maybeSingle();
      if (configError) {
        console.warn(
          isMissingSchemaError(configError) ? CONFIG_TABLE_MISSING_HINT : `Konfigurasi bersama belum tersedia: ${configError.message}`
        );
      } else if (configData?.config_data) {

        applySharedConfig(configData.config_data);
      }

      let importedWargaCount = 0;
      let importedKKCount = 0;
      let importedSuratCount = 0;
      let importedMutasiCount = 0;

      const transformedWarga = (wargaData || []).map(fromWargaRow);
      storageService.saveWargaList(transformedWarga);
      importedWargaCount = transformedWarga.length;

      // Transform and save KK
      const transformedKK = (kkData || []).map(fromKKRow);
      storageService.saveKKList(transformedKK);
      importedKKCount = transformedKK.length;

      // Transform and save Surat
      const transformedSurat = (suratData || []).map(fromSuratRow);
      storageService.saveSurat(transformedSurat);
      importedSuratCount = transformedSurat.length;

      // Transform and save Mutasi
      const transformedMutasi = (mutasiData || []).map(fromMutasiRow);
      storageService.saveMutasi(transformedMutasi);
      importedMutasiCount = transformedMutasi.length;

      // Update config sync time
      const config = storageService.getConfig();
      const now = new Date();
      const timeString = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} WIB`;
      config.terakhirSinkron = timeString;
      config.supabaseTersambung = true;
      storageService.saveConfig(config);

      storageService.addAuditLog(
        'Sinkronisasi Supabase Cloud',
        'Supabase -> WebApp',
        `Berhasil mengimpor ${importedWargaCount} warga, ${importedKKCount} KK, ${importedSuratCount} surat, dan ${importedMutasiCount} mutasi dari Supabase.`
      );

      this.setSyncState({ phase: 'online', lastSyncedAt: new Date().toISOString(), message: 'Data cloud terbaru telah diterapkan.' });

      return {
        success: true,
        message: `Berhasil mengimpor data dari Supabase: ${importedWargaCount} warga, ${importedKKCount} KK, ${importedSuratCount} surat, dan ${importedMutasiCount} mutasi.`,
        counts: {
          warga: importedWargaCount,
          kk: importedKKCount,
          surat: importedSuratCount,
          mutasi: importedMutasiCount
        }
      };
    } catch (err: any) {
      this.setSyncState({ phase: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error', message: err.message });
      return {
        success: false,
        message: `Gagal menarik data dari Supabase: ${err.message}`,
        error: err.message
      };
    }
  }

  public generateSQLSchema(): string {
    return `-- SQL SCHEMA UNTUK SISTEM KEPENDUDUKAN RT 004 RW 007 KELURAHAN JATIMULYA
-- Jalankan perintah SQL berikut di Supabase SQL Editor:

-- 1. Tabel Kartu Keluarga
CREATE TABLE IF NOT EXISTS kartu_keluarga_rt004 (
    id TEXT PRIMARY KEY,
    nomor_kk VARCHAR(30) UNIQUE NOT NULL,
    kepala_keluarga_nama TEXT NOT NULL,
    kepala_keluarga_nik VARCHAR(30) NOT NULL,
    alamat TEXT NOT NULL,
    rt VARCHAR(10) DEFAULT '004',
    rw VARCHAR(10) DEFAULT '007',
    kelurahan VARCHAR(100) DEFAULT 'Jatimulya',
    kecamatan VARCHAR(100) DEFAULT 'Tambun Selatan',
    kabupaten_kota VARCHAR(100) DEFAULT 'Kabupaten Bekasi',
    provinsi VARCHAR(100) DEFAULT 'Jawa Barat',
    kode_pos VARCHAR(20) DEFAULT '17510',
    status_domisili VARCHAR(30) DEFAULT 'TETAP',
    blok_rumah VARCHAR(100),
    tanggal_terbit DATE,
    tanggal_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    catatan TEXT
);

-- 2. Tabel Data Warga / Penduduk
CREATE TABLE IF NOT EXISTS warga_rt004 (
    id TEXT PRIMARY KEY,
    nik VARCHAR(30) UNIQUE NOT NULL,
    nomor_kk VARCHAR(30),
    nama TEXT NOT NULL,
    jenis_kelamin VARCHAR(10),
    tempat_lahir TEXT,
    tanggal_lahir DATE,
    agama VARCHAR(50) DEFAULT 'ISLAM',
    pendidikan VARCHAR(100),
    pekerjaan VARCHAR(150),
    status_perkawinan VARCHAR(50),
    status_hubungan_kk VARCHAR(50),
    kewarganegaraan VARCHAR(30) DEFAULT 'WNI',
    golongan_darah VARCHAR(10) DEFAULT '-',
    nomor_hp VARCHAR(50),
    email TEXT,
    status_tinggal VARCHAR(50) DEFAULT 'TETAP',
    is_lansia BOOLEAN DEFAULT FALSE,
    is_balita BOOLEAN DEFAULT FALSE,
    is_yatim BOOLEAN DEFAULT FALSE,
    is_disabilitas BOOLEAN DEFAULT FALSE,
    status_bansos VARCHAR(50) DEFAULT 'TIDAK_ADA',
    keterangan_bansos TEXT,
    tanggal_input DATE DEFAULT CURRENT_DATE,
    catatan TEXT
);

-- 3. Tabel Surat Pengantar RT
CREATE TABLE IF NOT EXISTS surat_pengantar_rt004 (
    id TEXT PRIMARY KEY,
    nomor_surat VARCHAR(100) UNIQUE NOT NULL,
    jenis_surat VARCHAR(30) NOT NULL,
    judul_surat TEXT NOT NULL,
    nik_pemohon VARCHAR(16) NOT NULL,
    nama_pemohon TEXT NOT NULL,
    nomor_kk_pemohon VARCHAR(16),
    tempat_tgl_lahir_pemohon TEXT,
    jenis_kelamin_pemohon VARCHAR(1),
    agama_pemohon VARCHAR(20),
    pekerjaan_pemohon VARCHAR(100),
    status_kawin_pemohon VARCHAR(30),
    telepon_pemohon VARCHAR(30),
    alamat_pemohon TEXT,
    keperluan TEXT NOT NULL,
    keterangan_lain TEXT,
    tanggal_pengajuan DATE DEFAULT CURRENT_DATE,
    tanggal_disetujui DATE,
    status VARCHAR(20) DEFAULT 'PENDING',
    alasan_penolakan TEXT,
    nama_pejabat_ttd TEXT,
    jabatan_ttd TEXT,
    kode_verifikasi_qr TEXT,
    dibuat_oleh VARCHAR(20) DEFAULT 'WARGA',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabel Mutasi Penduduk (Pindah Masuk / Keluar / Lahir / Wafat)
CREATE TABLE IF NOT EXISTS mutasi_penduduk_rt004 (
    id TEXT PRIMARY KEY,
    tanggal DATE DEFAULT CURRENT_DATE,
    jenis_mutasi VARCHAR(30) NOT NULL,
    nik VARCHAR(16),
    nama_warga TEXT NOT NULL,
    nomor_kk VARCHAR(16),
    alamat_asal TEXT,
    alamat_tujuan TEXT,
    alasan TEXT,
    no_surat_keterangan TEXT,
    petugas TEXT,
    catatan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabel Profil Pengurus RT (terhubung ke Supabase Auth)
--    PENTING: password TIDAK disimpan di sini. Password dikelola sepenuhnya
--    oleh Supabase Auth (auth.users) yang menyimpannya dalam bentuk hash.
CREATE TABLE IF NOT EXISTS pengurus_profil (
    id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username VARCHAR(100) UNIQUE NOT NULL,
    nama_lengkap TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'STAF_PELAYANAN',
    role_label TEXT,
    nomor_hp VARCHAR(50),
    email TEXT,
    jabatan_khusus TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    terakhir_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Konfigurasi global template, kop, dan logo surat
CREATE TABLE IF NOT EXISTS konfigurasi_rt004 (
    id TEXT PRIMARY KEY DEFAULT 'global',
    config_data JSONB NOT NULL DEFAULT '{}'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- KEAMANAN: ROW LEVEL SECURITY (RLS)
-- Anon key ikut ter-bundle ke JavaScript browser, jadi anon TIDAK BOLEH
-- punya akses apa pun ke data warga. Semua akses wajib melewati
-- Supabase Auth (login pengurus) + profil pengurus yang aktif.
-- =====================================================================

-- Fungsi bantu: cek apakah user yang login adalah pengurus aktif.
-- SECURITY DEFINER + search_path tetap agar aman dipakai di dalam policy
-- dan tidak menimbulkan rekursi RLS saat membaca pengurus_profil.
CREATE OR REPLACE FUNCTION public.is_pengurus_aktif()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pengurus_profil p
    WHERE p.id = auth.uid() AND p.is_active = TRUE
  );
$$;

-- Fungsi bantu: cek apakah user yang login punya peran admin penuh
-- (berhak menghapus data).
CREATE OR REPLACE FUNCTION public.is_admin_rt()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pengurus_profil p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND p.role IN ('ADMIN_KETUA_RT', 'ADMIN_SEKRETARIS', 'ADMIN_SISTEM')

  );
$$;

ALTER TABLE kartu_keluarga_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE warga_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE surat_pengantar_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutasi_penduduk_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengurus_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE konfigurasi_rt004 ENABLE ROW LEVEL SECURITY;

-- Bersihkan SEMUA policy lama pada tabel-tabel ini, termasuk policy publik
-- "Public full access for RT004" (USING (true)) dari skema versi sebelumnya.
-- Memakai blok DO agar skrip ini aman dijalankan berulang: tabel yang tidak
-- ada (misalnya pengurus_rt004 yang sudah dihapus) otomatis dilewati, dan
-- CREATE POLICY di bawah tidak akan bentrok dengan policy bernama sama.
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'kartu_keluarga_rt004',
              'warga_rt004',
              'surat_pengantar_rt004',
              'mutasi_penduduk_rt004',
              'konfigurasi_rt004',
              'pengurus_profil',
              'pengurus_rt004',
              'ews_laporan_rt004',
              'ews_fcm_tokens'
          )
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            pol.policyname, pol.schemaname, pol.tablename
        );
    END LOOP;
END $$;


-- Cabut hak akses anon (pengguna belum login) dari seluruh tabel data.
REVOKE ALL ON kartu_keluarga_rt004 FROM anon;
REVOKE ALL ON warga_rt004 FROM anon;
REVOKE ALL ON surat_pengantar_rt004 FROM anon;
REVOKE ALL ON mutasi_penduduk_rt004 FROM anon;
REVOKE ALL ON pengurus_profil FROM anon;
REVOKE ALL ON konfigurasi_rt004 FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON kartu_keluarga_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON warga_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON surat_pengantar_rt004 TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mutasi_penduduk_rt004 TO authenticated;
GRANT SELECT, UPDATE ON pengurus_profil TO authenticated;
GRANT SELECT, INSERT, UPDATE ON konfigurasi_rt004 TO authenticated;

-- Policy data warga & KK: baca/tulis hanya untuk pengurus aktif,
-- hapus hanya untuk Ketua RT / Sekretaris.
CREATE POLICY "Pengurus aktif boleh baca KK" ON kartu_keluarga_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah KK" ON kartu_keluarga_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah KK" ON kartu_keluarga_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus KK" ON kartu_keluarga_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE POLICY "Pengurus aktif boleh baca warga" ON warga_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah warga" ON warga_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah warga" ON warga_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus warga" ON warga_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE POLICY "Pengurus aktif boleh baca surat" ON surat_pengantar_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah surat" ON surat_pengantar_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah surat" ON surat_pengantar_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus surat" ON surat_pengantar_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

CREATE POLICY "Pengurus aktif boleh baca mutasi" ON mutasi_penduduk_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh tambah mutasi" ON mutasi_penduduk_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh ubah mutasi" ON mutasi_penduduk_rt004
    FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh hapus mutasi" ON mutasi_penduduk_rt004
    FOR DELETE TO authenticated USING (public.is_admin_rt());

-- Seluruh pengurus aktif melihat format yang sama. Perubahan template dan
-- logo hanya dapat dilakukan oleh tiga role admin penuh.
CREATE POLICY "Pengurus aktif boleh baca konfigurasi" ON konfigurasi_rt004
    FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Admin RT boleh tambah konfigurasi" ON konfigurasi_rt004
    FOR INSERT TO authenticated WITH CHECK (public.is_admin_rt() AND id = 'global');
CREATE POLICY "Admin RT boleh ubah konfigurasi" ON konfigurasi_rt004
    FOR UPDATE TO authenticated USING (public.is_admin_rt()) WITH CHECK (public.is_admin_rt() AND id = 'global');

-- Policy profil pengurus: setiap pengurus hanya bisa melihat & mengubah
-- profilnya sendiri; role tidak bisa dinaikkan sendiri (lihat trigger di bawah).
CREATE POLICY "Pengurus baca profil sendiri" ON pengurus_profil
    FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Pengurus ubah profil sendiri" ON pengurus_profil
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Cegah pengurus mengubah role / status aktifnya sendiri (privilege escalation).
-- Perubahan role hanya boleh dilakukan dari Supabase Dashboard (service role).
CREATE OR REPLACE FUNCTION public.cegah_ubah_role_sendiri()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id AND (NEW.role <> OLD.role OR NEW.is_active <> OLD.is_active) THEN
    RAISE EXCEPTION 'Role dan status aktif tidak dapat diubah sendiri. Hubungi Ketua RT.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cegah_ubah_role_sendiri ON pengurus_profil;
CREATE TRIGGER trg_cegah_ubah_role_sendiri
    BEFORE UPDATE ON pengurus_profil
    FOR EACH ROW EXECUTE FUNCTION public.cegah_ubah_role_sendiri();

-- =====================================================================
-- LANGKAH TERAKHIR: BUAT AKUN PENGURUS
-- 1. Buka Supabase Dashboard > Authentication > Users > "Add user",
--    isi email & password pengurus (aktifkan "Auto Confirm User").
-- 2. Salin User UID yang muncul, lalu jalankan INSERT berikut
--    (ganti UID, email, nama, dan role sesuai jabatan):
--
-- INSERT INTO pengurus_profil (id, username, nama_lengkap, role, role_label, email)
-- VALUES ('UUID-DARI-DASHBOARD', 'ketua_rt004', 'Yanto', 'ADMIN_KETUA_RT', 'Ketua RT 004 (Admin Utama)', 'ketua.rt004@contoh.id');
--
-- Role dengan akses penuh (bisa mengatur semua konfigurasi & menghapus data):
--   ADMIN_KETUA_RT   -> Ketua RT 004 (Admin Utama)
--   ADMIN_SEKRETARIS -> Sekretaris RT 004
--   ADMIN_SISTEM     -> Administrator Sistem
-- Role dengan akses terbatas (tanpa hak hapus data):
--   BENDAHARA, SEKSI_KEAMANAN, STAF_PELAYANAN

-- 3. Tabel lama pengurus_rt004 (jika ada) sebaiknya dihapus karena
--    menyimpan PIN dalam bentuk teks biasa:
--    DROP TABLE IF EXISTS pengurus_rt004;
-- =====================================================================

-- =====================================================================
-- REALTIME ANTARPERANGKAT
-- Metadata perubahan membantu audit teknis dan REPLICA IDENTITY FULL
-- memastikan payload DELETE membawa identitas baris yang diperlukan.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_sync_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'kartu_keluarga_rt004',
    'warga_rt004',
    'surat_pengantar_rt004',
    'mutasi_penduduk_rt004',
    'konfigurasi_rt004'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      table_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL',
      table_name
    );
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_sync_metadata ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_set_sync_metadata BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_sync_metadata()',
      table_name
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
-- =====================================================================

-- =====================================================================
-- EWS (EARLY WARNING SYSTEM) — Fitur Android App
-- =====================================================================

-- Tabel laporan darurat dari warga
CREATE TABLE IF NOT EXISTS ews_laporan_rt004 (
    id             TEXT        PRIMARY KEY DEFAULT 'EWS-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substring(gen_random_uuid()::text, 1, 6)),
    jenis_kejadian VARCHAR(30) NOT NULL,
    deskripsi      TEXT        NOT NULL,
    nama_pelapor   TEXT        NOT NULL,
    alamat         TEXT        NOT NULL,
    foto_url       TEXT        NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'BARU',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabel FCM tokens device Android
CREATE TABLE IF NOT EXISTS ews_fcm_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    token       TEXT        UNIQUE NOT NULL,
    device_info TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ews_laporan_rt004 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ews_fcm_tokens    ENABLE ROW LEVEL SECURITY;

GRANT INSERT                  ON ews_laporan_rt004 TO anon;
GRANT SELECT, INSERT, UPDATE  ON ews_laporan_rt004 TO authenticated;
GRANT INSERT, UPDATE          ON ews_fcm_tokens TO anon;
GRANT SELECT, INSERT, UPDATE  ON ews_fcm_tokens TO authenticated;

CREATE POLICY "Siapapun boleh kirim laporan EWS"   ON ews_laporan_rt004 FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Pengurus aktif boleh baca laporan EWS" ON ews_laporan_rt004 FOR SELECT TO authenticated USING (public.is_pengurus_aktif());
CREATE POLICY "Pengurus aktif boleh update status EWS" ON ews_laporan_rt004 FOR UPDATE TO authenticated USING (public.is_pengurus_aktif()) WITH CHECK (public.is_pengurus_aktif());
CREATE POLICY "Siapapun boleh daftar FCM token"    ON ews_fcm_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Siapapun boleh update FCM token"    ON ews_fcm_tokens FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Pengurus aktif boleh baca FCM tokens" ON ews_fcm_tokens FOR SELECT TO authenticated USING (public.is_pengurus_aktif());

CREATE OR REPLACE FUNCTION public.set_ews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$ BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ews_laporan_updated_at ON ews_laporan_rt004;
CREATE TRIGGER trg_ews_laporan_updated_at BEFORE UPDATE ON ews_laporan_rt004 FOR EACH ROW EXECUTE FUNCTION public.set_ews_updated_at();

DROP TRIGGER IF EXISTS trg_ews_token_updated_at ON ews_fcm_tokens;
CREATE TRIGGER trg_ews_token_updated_at BEFORE UPDATE ON ews_fcm_tokens FOR EACH ROW EXECUTE FUNCTION public.set_ews_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ews_laporan_rt004') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ews_laporan_rt004;
  END IF;
END $$;

-- Storage bucket untuk foto laporan EWS (max 2MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ews-foto', 'ews-foto', true, 2097152, ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
-- =====================================================================
`;

  }

  public generateDataInsertSQL(wargalistParam?: Warga[], kkListParam?: KartuKeluarga[]): string {
    const wargaList = wargalistParam || storageService.getWargaList();
    const kkList = kkListParam || storageService.getKKList();

    const escapeSql = (str: any) => {
      if (str === null || str === undefined) return 'NULL';
      return `'${String(str).replace(/'/g, "''")}'`;
    };

    let sql = `-- SCRIPT INSERT DATA WARGA & KARTU KELUARGA RT 004 RW 007\n-- Total: ${kkList.length} Kartu Keluarga, ${wargaList.length} Jiwa Warga\n\n`;

    if (kkList.length > 0) {
      sql += `-- 1. DATA KARTU KELUARGA\nINSERT INTO kartu_keluarga_rt004 (id, nomor_kk, kepala_keluarga_nama, kepala_keluarga_nik, alamat, rt, rw, kelurahan, kecamatan, kabupaten_kota, provinsi, kode_pos, status_domisili, blok_rumah)\nVALUES\n`;
      const kkRows = kkList.map(k => 
        `(${escapeSql(k.id)}, ${escapeSql(k.nomorKK)}, ${escapeSql(k.kepalaKeluargaNama)}, ${escapeSql(k.kepalaKeluargaNik)}, ${escapeSql(k.alamat)}, ${escapeSql(k.rt || '004')}, ${escapeSql(k.rw || '007')}, ${escapeSql(k.kelurahan || 'Jatimulya')}, ${escapeSql(k.kecamatan || 'Tambun Selatan')}, ${escapeSql(k.kabupatenKota || 'Kabupaten Bekasi')}, ${escapeSql(k.provinsi || 'Jawa Barat')}, ${escapeSql(k.kodePos || '17510')}, ${escapeSql(k.statusDomisili || 'TETAP')}, ${escapeSql(k.blokRumah || '')})`
      );
      sql += kkRows.join(',\n') + '\nON CONFLICT (nomor_kk) DO UPDATE SET kepala_keluarga_nama = EXCLUDED.kepala_keluarga_nama, alamat = EXCLUDED.alamat;\n\n';
    }

    if (wargaList.length > 0) {
      sql += `-- 2. DATA WARGA RT 004\nINSERT INTO warga_rt004 (id, nik, nomor_kk, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, agama, pendidikan, pekerjaan, status_perkawinan, status_hubungan_kk, kewarganegaraan, golongan_darah, nomor_hp, status_tinggal, status_bansos, is_lansia, is_balita, is_yatim, is_disabilitas, catatan)\nVALUES\n`;
      const wargaRows = wargaList.map(w => 
        `(${escapeSql(w.id)}, ${escapeSql(w.nik)}, ${escapeSql(w.nomorKK)}, ${escapeSql(w.nama)}, ${escapeSql(w.jenisKelamin)}, ${escapeSql(w.tempatLahir)}, ${escapeSql(w.tanggalLahir)}, ${escapeSql(w.agama)}, ${escapeSql(w.pendidikan)}, ${escapeSql(w.pekerjaan)}, ${escapeSql(w.statusPerkawinan)}, ${escapeSql(w.statusHubunganKK)}, ${escapeSql(w.kewarganegaraan)}, ${escapeSql(w.golonganDarah)}, ${escapeSql(w.nomorHp || '-')}, ${escapeSql(w.statusTinggal)}, ${escapeSql(w.statusBansos || 'TIDAK_ADA')}, ${Boolean(w.isLansia)}, ${Boolean(w.isBalita)}, ${Boolean(w.isYatim)}, ${Boolean(w.isDisabilitas)}, ${escapeSql(w.catatan || '')})`
      );
      sql += wargaRows.join(',\n') + '\nON CONFLICT (nik) DO UPDATE SET nama = EXCLUDED.nama, nomor_kk = EXCLUDED.nomor_kk, status_bansos = EXCLUDED.status_bansos;\n';
    }

    return sql;
  }

  public async syncToSupabase(
    customWarga?: Warga[],
    customKK?: KartuKeluarga[],
    customSurat?: SuratPengantar[],
    customMutasi?: MutasiPenduduk[],
    replacePopulation: boolean = false
  ): Promise<SupabaseSyncResult> {
    const config = storageService.getConfig();
    const client = this.getClient();

    if (!client) {
      return {
        success: false,
        message: 'Konfigurasi Supabase belum diisi. Silakan masukkan Supabase URL dan Anon Key di tab Integrasi.',
        error: 'Client not initialized'
      };
    }

    try {
      this.setSyncState({ phase: 'syncing', message: 'Mengirim snapshot data ke cloud...' });
      const wargaList = customWarga !== undefined ? customWarga : storageService.getWargaList();
      const kkList = customKK !== undefined ? customKK : storageService.getKKList();
      const suratList = customSurat !== undefined ? customSurat : storageService.getSuratList();
      const mutasiList = customMutasi !== undefined ? customMutasi : storageService.getMutasiList();

      let existingWargaIds: string[] = [];
      let existingKKIds: string[] = [];
      if (replacePopulation) {
        const [existingWarga, existingKK] = await Promise.all([
          client.from('warga_rt004').select('id'),
          client.from('kartu_keluarga_rt004').select('id')
        ]);
        if (existingWarga.error) throw new Error(`Gagal membaca data warga lama: ${existingWarga.error.message}`);
        if (existingKK.error) throw new Error(`Gagal membaca data KK lama: ${existingKK.error.message}`);
        existingWargaIds = (existingWarga.data || []).map(row => String(row.id));
        existingKKIds = (existingKK.data || []).map(row => String(row.id));
      }

      // Collect existing KKs
      const kkMap = new Map<string, any>();

      // 1. Add all KKs from storage / params
      kkList.forEach(k => {
        const cleanKK = String(k.nomorKK || '').trim();
        if (cleanKK) {
          kkMap.set(cleanKK, {
            id: k.id || `kk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            nomor_kk: cleanKK,
            kepala_keluarga_nama: k.kepalaKeluargaNama || 'Kepala Keluarga RT 004',
            kepala_keluarga_nik: String(k.kepalaKeluargaNik || '').trim() || `321606${Date.now().toString().slice(-10)}`,
            alamat: k.alamat || 'RT 004 RW 007 Kel. Jatimulya',
            rt: k.rt || '004',
            rw: k.rw || '007',
            kelurahan: k.kelurahan || 'Jatimulya',
            kecamatan: k.kecamatan || 'Tambun Selatan',
            kabupaten_kota: k.kabupatenKota || 'Kabupaten Bekasi',
            provinsi: k.provinsi || 'Jawa Barat',
            kode_pos: k.kodePos || '17510',
            status_domisili: k.statusDomisili || 'TETAP',
            blok_rumah: k.blokRumah || '',
            tanggal_terbit: k.tanggalTerbit || new Date().toISOString().slice(0, 10),
            catatan: k.catatan || 'Data KK RT 004'
          });
        }
      });

      // 2. Ensure EVERY citizen's nomorKK has a corresponding entry in kkMap (Critical for Foreign Key safety)
      wargaList.forEach(w => {
        let cleanKK = String(w.nomorKK || '').trim();
        if (!cleanKK) {
          cleanKK = '3216060000000000';
        }

        if (!kkMap.has(cleanKK)) {
          kkMap.set(cleanKK, {
            id: `kk-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            nomor_kk: cleanKK,
            kepala_keluarga_nama: w.nama || 'Kepala Keluarga RT 004',
            kepala_keluarga_nik: String(w.nik || '').trim() || `321606${Date.now().toString().slice(-10)}`,
            alamat: w.statusTinggal === 'KONTRAK' ? 'Kontrakan RT 004 RW 007 Kel. Jatimulya' : 'RT 004 RW 007 Kel. Jatimulya',
            rt: '004',
            rw: '007',
            kelurahan: 'Jatimulya',
            kecamatan: 'Tambun Selatan',
            kabupaten_kota: 'Kabupaten Bekasi',
            provinsi: 'Jawa Barat',
            kode_pos: '17510',
            status_domisili: w.statusTinggal === 'KONTRAK' ? 'KONTRAK' : w.statusTinggal === 'KOS' ? 'KOS' : 'TETAP',
            blok_rumah: '',
            tanggal_terbit: new Date().toISOString().slice(0, 10),
            catatan: `Otomatis dibuat untuk relasi KK warga ${w.nama}`
          });
        }
      });

      const kkPayload = Array.from(kkMap.values());

      // 1. Sync KK First so Foreign Key constraints are always satisfied
      if (kkPayload.length > 0) {
        const { error: kkError } = await client.from('kartu_keluarga_rt004').upsert(kkPayload, { onConflict: 'id' });
        if (kkError) {
          throw new Error(`Gagal sync Kartu Keluarga: ${kkError.message}`);
        }
      }

      // 2. Sync Warga
      const wargaPayload = wargaList.map(w => {
        const cleanNik = String(w.nik || '').trim();
        let cleanKK = String(w.nomorKK || '').trim();
        if (!cleanKK) cleanKK = '3216060000000000';
        const cleanHp = String(w.nomorHp || '-').trim();
        const cleanGolDarah = String(w.golonganDarah || '-').trim();
        const cleanJk = w.jenisKelamin === 'P' ? 'P' : 'L';

        return {
          id: w.id || `w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          nik: cleanNik,
          nomor_kk: cleanKK,
          nama: (w.nama || '').trim(),
          jenis_kelamin: cleanJk,
          tempat_lahir: (w.tempatLahir || 'Bekasi').trim(),
          tanggal_lahir: w.tanggalLahir || null,
          agama: (w.agama || 'ISLAM').trim(),
          pendidikan: (w.pendidikan || 'SLTA').trim(),
          pekerjaan: (w.pekerjaan || 'Karyawan').trim(),
          status_perkawinan: (w.statusPerkawinan || 'BELUM KAWIN').trim(),
          status_hubungan_kk: (w.statusHubunganKK || 'KEPALA KELUARGA').trim(),
          kewarganegaraan: (w.kewarganegaraan || 'WNI').trim(),
          golongan_darah: cleanGolDarah,
          nomor_hp: cleanHp,
          email: (w.email || '').trim(),
          status_tinggal: (w.statusTinggal || 'TETAP').trim(),
          is_lansia: Boolean(w.isLansia),
          is_balita: Boolean(w.isBalita),
          is_yatim: Boolean(w.isYatim),
          is_disabilitas: Boolean(w.isDisabilitas),
          status_bansos: (w.statusBansos || 'TIDAK_ADA').trim(),
          keterangan_bansos: (w.keteranganBansos || '').trim(),
          tanggal_input: w.tanggalInput || new Date().toISOString().slice(0, 10),
          catatan: (w.catatan || '').trim()
        };
      });

      if (wargaPayload.length > 0) {
        const { error: wargaError } = await client.from('warga_rt004').upsert(wargaPayload, { onConflict: 'id' });
        if (wargaError) {
          throw new Error(`Gagal sync Data Warga: ${wargaError.message}`);
        }
      }

      if (suratList.length > 0) {
        const { error: suratError } = await client
          .from('surat_pengantar_rt004')
          .upsert(suratList.map(toSuratRow), { onConflict: 'id' });
        if (suratError) throw new Error(`Gagal sync Surat Pengantar: ${suratError.message}`);
      }

      if (mutasiList.length > 0) {
        const { error: mutasiError } = await client
          .from('mutasi_penduduk_rt004')
          .upsert(mutasiList.map(toMutasiRow), { onConflict: 'id' });
        if (mutasiError) throw new Error(`Gagal sync Mutasi Penduduk: ${mutasiError.message}`);
      }

      // Finalize replacement only after every new row has been accepted, so a
      // failed upload cannot clear the existing population dataset.
      if (replacePopulation) {
        const nextWargaIds = new Set(wargaPayload.map(row => String(row.id)));
        const nextKKIds = new Set(kkPayload.map(row => String(row.id)));
        const staleWargaIds = existingWargaIds.filter(id => !nextWargaIds.has(id));
        const staleKKIds = existingKKIds.filter(id => !nextKKIds.has(id));

        if (staleWargaIds.length > 0) {
          const { error } = await client.from('warga_rt004').delete().in('id', staleWargaIds);
          if (error) throw new Error(`Data baru tersimpan, tetapi warga lama gagal dibersihkan: ${error.message}`);
        }
        if (staleKKIds.length > 0) {
          const { error } = await client.from('kartu_keluarga_rt004').delete().in('id', staleKKIds);
          if (error) throw new Error(`Data baru tersimpan, tetapi KK lama gagal dibersihkan: ${error.message}`);
        }
      }

      const now = new Date();
      const timeString = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} WIB`;

      config.terakhirSinkron = timeString;
      config.supabaseTersambung = true;
      storageService.saveConfig(config);

      this.setSyncState({
        phase: 'online',
        pendingWrites: 0,
        lastSyncedAt: new Date().toISOString(),
        message: 'Snapshot data berhasil disimpan di cloud.'
      });
      return {
        success: true,
        message: `Sinkronisasi ke Supabase berhasil: ${wargaList.length} warga, ${kkList.length} KK, ${suratList.length} surat, dan ${mutasiList.length} mutasi.`,
        syncedTables: ['kartu_keluarga_rt004', 'warga_rt004', 'surat_pengantar_rt004', 'mutasi_penduduk_rt004'],
        timestamp: timeString
      };
    } catch (err: any) {
      this.setSyncState({
        phase: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error',
        message: err.message || 'Sinkronisasi snapshot gagal.'
      });
      return {
        success: false,
        message: `Gagal sinkronisasi ke Supabase: ${err.message || 'Pastikan tabel telah dibuat menggunakan SQL Schema'}`,
        error: err.message
      };
    }
  }

  public async pushAllToSupabase(payload?: {
    warga?: Warga[];
    kk?: KartuKeluarga[];
    surat?: SuratPengantar[];
    mutasi?: MutasiPenduduk[];
    replacePopulation?: boolean;
  }): Promise<SupabaseSyncResult> {
    return this.syncToSupabase(payload?.warga, payload?.kk, payload?.surat, payload?.mutasi, payload?.replacePopulation);
  }

  // ==========================================
  // REAL-TIME AUTO-SYNC BACKGROUND METHODS
  // ==========================================

  public isAutoSyncEnabled(): boolean {
    const config = storageService.getConfig();
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
    const hasUrl = !!(config.supabaseUrl || envUrl);
    const hasKey = !!(config.supabaseAnonKey || envKey);
    // Sinkronisasi hanya boleh jalan bila ada sesi Supabase Auth yang aktif.
    // Tanpa sesi, request akan ditolak RLS, jadi lebih baik dicegah lebih awal.
    return hasUrl && hasKey && authState.hasActiveSession() && config.supabaseAutoSync !== false;
  }


  private updateLastSyncTimestamp() {
    try {
      const config = storageService.getConfig();
      const now = new Date();
      const timeString = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} WIB`;
      config.terakhirSinkron = timeString;
      config.supabaseTersambung = true;
      storageService.saveConfig(config);
    } catch (e) {
      console.warn('Failed to update sync timestamp', e);
    }
  }

  private notifySyncEvent(title: string, detail: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('supabase-sync-status', {
        detail: {
          title,
          detail,
          timestamp: new Date().toISOString()
        }
      }));
    }
  }

  public async autoSyncWarga(w: Warga): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const cleanNik = String(w.nik || '').trim();
      if (!cleanNik) return { success: false, error: 'NIK is empty' };

      let cleanKK = String(w.nomorKK || '').trim();
      if (!cleanKK) cleanKK = '3216060000000000';

      // 1. Ensure Parent KK exists in Supabase to avoid foreign key violation
      const kkList = storageService.getKKList();
      const localKK = kkList.find(k => k.nomorKK === cleanKK);
      const kkPayload = {
        id: localKK?.id || `kk-${cleanKK}`,
        nomor_kk: cleanKK,
        kepala_keluarga_nama: localKK?.kepalaKeluargaNama || (w.statusHubunganKK === 'KEPALA KELUARGA' ? w.nama : 'Kepala Keluarga RT 004'),
        kepala_keluarga_nik: localKK?.kepalaKeluargaNik || cleanNik,
        alamat: localKK?.alamat || (w.statusTinggal === 'KONTRAK' ? 'Kontrakan RT 004 RW 007 Kel. Jatimulya' : 'RT 004 RW 007 Kel. Jatimulya'),
        rt: localKK?.rt || '004',
        rw: localKK?.rw || '007',
        kelurahan: localKK?.kelurahan || 'Jatimulya',
        kecamatan: localKK?.kecamatan || 'Tambun Selatan',
        kabupaten_kota: localKK?.kabupatenKota || 'Kabupaten Bekasi',
        provinsi: localKK?.provinsi || 'Jawa Barat',
        kode_pos: localKK?.kodePos || '17510',
        status_domisili: localKK?.statusDomisili || w.statusTinggal || 'TETAP',
        blok_rumah: localKK?.blokRumah || '',
        tanggal_terbit: localKK?.tanggalTerbit || new Date().toISOString().slice(0, 10),
        catatan: localKK?.catatan || `Auto-sync KK warga ${w.nama}`
      };

      const { error: kkError } = await client.from('kartu_keluarga_rt004').upsert(kkPayload, { onConflict: 'nomor_kk' });
      if (kkError) return { success: false, error: kkError.message };

      // 2. Upsert Warga
      const wargaPayload = toWargaRow({ ...w, nomorKK: cleanKK });

      const { error } = await client.from('warga_rt004').upsert(wargaPayload, { onConflict: 'id' });
      if (error) {
        console.warn('Auto-sync warga warning:', error.message);
        return { success: false, error: error.message };
      }

      this.updateLastSyncTimestamp();
      this.notifySyncEvent('Warga tersinkron ke Supabase Cloud', w.nama);
      return { success: true };
    });
  }

  public async autoDeleteWarga(nik: string): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const { error } = await client.from('warga_rt004').delete().eq('nik', nik);
      if (!error) {
        this.updateLastSyncTimestamp();
        this.notifySyncEvent('Data warga dihapus dari Supabase', `NIK: ${nik}`);
      }
      return { success: !error, error: error?.message };
    });
  }

  public async autoSyncKK(kk: KartuKeluarga): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const cleanKK = String(kk.nomorKK || '').trim();
      if (!cleanKK) return { success: false };
      const kkPayload = toKKRow(kk);
      const { error } = await client.from('kartu_keluarga_rt004').upsert(kkPayload, { onConflict: 'id' });
      if (!error) {
        this.updateLastSyncTimestamp();
        this.notifySyncEvent('KK tersinkron ke Supabase Cloud', `No. KK: ${cleanKK}`);
      }
      return { success: !error, error: error?.message };
    });
  }

  public async autoDeleteKK(nomorKK: string): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const { error } = await client.from('kartu_keluarga_rt004').delete().eq('nomor_kk', nomorKK);
      if (error) return { success: false, error: error.message };
      this.updateLastSyncTimestamp();
      return { success: true };
    });
  }

  public async autoSyncSurat(surat: SuratPengantar): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const payload = toSuratRow(surat);
      const { error } = await client.from('surat_pengantar_rt004').upsert(payload, { onConflict: 'id' });
      if (!error) {
        this.updateLastSyncTimestamp();
        this.notifySyncEvent('Surat Pengantar tersinkron ke Supabase', surat.nomorSurat);
      }
      return { success: !error, error: error?.message };
    });
  }

  public async autoDeleteSurat(id: string): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const { error } = await client.from('surat_pengantar_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      this.updateLastSyncTimestamp();
      return { success: true };
    });
  }

  public async autoSyncMutasi(mutasi: MutasiPenduduk): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const payload = toMutasiRow(mutasi);
      const { error } = await client.from('mutasi_penduduk_rt004').upsert(payload, { onConflict: 'id' });
      if (!error) {
        this.updateLastSyncTimestamp();
        this.notifySyncEvent('Mutasi tersinkron ke Supabase Cloud', mutasi.namaWarga);
      }
      return { success: !error, error: error?.message };
    });
  }

  public async autoDeleteMutasi(id: string): Promise<{ success: boolean; error?: string }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const { error } = await client.from('mutasi_penduduk_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      this.updateLastSyncTimestamp();
      return { success: true };
    });
  }

  public async autoSyncConfig(config: RTConfig): Promise<{ success: boolean; error?: string; tableMissing?: boolean }> {
    return this.runCloudWrite(async () => {
      const client = this.getClient();
      if (!client) return { success: false, error: 'Supabase client not initialized' };
      const { error } = await client
        .from('konfigurasi_rt004')
        .upsert({ id: SHARED_CONFIG_ID, config_data: toSharedConfig(config) }, { onConflict: 'id' });
      if (!error) {
        this.updateLastSyncTimestamp();
        this.notifySyncEvent('Template dan kop surat tersinkron', 'Konfigurasi bersama diperbarui untuk seluruh admin.');
        return { success: true };
      }
      // Migrasi konfigurasi bersama belum dijalankan: beri instruksi konkret
      // agar pengurus tahu langkah perbaikannya, bukan pesan teknis mentah.
      if (isMissingSchemaError(error)) {
        return { success: false, error: CONFIG_TABLE_MISSING_HINT, tableMissing: true };
      }
      return { success: false, error: error.message };
    });
  }


  /**
   * Tarik data dari Supabase satu kali saat aplikasi dibuka.
   * Dipakai agar perangkat/browser baru langsung menampilkan data cloud,
   * bukan data bawaan dari initialData.ts.
   */
  public async bootstrapFromSupabase(): Promise<{ pulled: boolean; message?: string }> {
    if (!this.isCloudMode()) {
      return { pulled: false, message: 'Sesi Supabase belum aktif.' };
    }
    try {
      const res = await this.pullFromSupabase();
      return { pulled: res.success, message: res.message };
    } catch (e: any) {
      console.warn('Bootstrap pull dari Supabase gagal:', e?.message);
      return { pulled: false, message: e?.message };
    }
  }

  public startRealtimeSync() {
    const client = this.getClient();
    if (!client || !this.isCloudMode() || this.realtimeChannel) return;

    const applyChange = (table: string) => (payload: RealtimePostgresChangesPayload<CloudRow>) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as CloudRow;
      if (!row) return;

      if (table === 'warga_rt004') {
        const list = storageService.getWargaList();
        const next = payload.eventType === 'DELETE'
          ? list.filter(item => item.id !== row.id && item.nik !== row.nik)
          : [fromWargaRow(row), ...list.filter(item => item.id !== row.id && item.nik !== row.nik)];
        storageService.saveWargaList(next);
      } else if (table === 'kartu_keluarga_rt004') {
        const list = storageService.getKKList();
        const next = payload.eventType === 'DELETE'
          ? list.filter(item => item.id !== row.id && item.nomorKK !== row.nomor_kk)
          : [fromKKRow(row), ...list.filter(item => item.id !== row.id && item.nomorKK !== row.nomor_kk)];
        storageService.saveKKList(next);
      } else if (table === 'surat_pengantar_rt004') {
        const list = storageService.getSuratList();
        const next = payload.eventType === 'DELETE'
          ? list.filter(item => item.id !== row.id)
          : [fromSuratRow(row), ...list.filter(item => item.id !== row.id)];
        storageService.saveSurat(next);
      } else if (table === 'mutasi_penduduk_rt004') {
        const list = storageService.getMutasiList();
        const next = payload.eventType === 'DELETE'
          ? list.filter(item => item.id !== row.id)
          : [fromMutasiRow(row), ...list.filter(item => item.id !== row.id)];
        storageService.saveMutasi(next);
      } else if (table === 'konfigurasi_rt004' && payload.eventType !== 'DELETE') {
        applySharedConfig(row.config_data);
      }

      this.setSyncState({ phase: 'online', lastSyncedAt: new Date().toISOString(), message: 'Perubahan realtime diterapkan.' });
    };

    this.realtimeChannel = client
      .channel('sip-rt004-live-data')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kartu_keluarga_rt004' }, applyChange('kartu_keluarga_rt004'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warga_rt004' }, applyChange('warga_rt004'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_pengantar_rt004' }, applyChange('surat_pengantar_rt004'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mutasi_penduduk_rt004' }, applyChange('mutasi_penduduk_rt004'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'konfigurasi_rt004' }, applyChange('konfigurasi_rt004'))
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          this.setSyncState({ phase: 'online', message: 'Realtime Supabase aktif.' });
          this.notifySyncEvent('Realtime Supabase aktif', 'Perubahan antar perangkat sedang dipantau.');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.setSyncState({ phase: 'error', message: 'Kanal realtime terputus.' });
        }
      });
  }

  public stopRealtimeSync() {
    if (this.realtimeChannel && this.client) void this.client.removeChannel(this.realtimeChannel);
    this.realtimeChannel = null;
    this.setSyncState({ phase: this.isCloudMode() ? 'connecting' : 'local', message: undefined });
  }

  // ==========================================
  // EWS (EARLY WARNING SYSTEM) METHODS
  // ==========================================

  /**
   * Buat nomor laporan EWS di sisi klien.
   * Formatnya dibuat sama dengan DEFAULT kolom `id` di database:
   *   EWS-YYYYMMDD-XXXXXX  (XXXXXX = 6 karakter hex huruf besar)
   */
  private buatNomorLaporanEWS(): string {
    const now = new Date();
    const tanggal =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    let acak = '';
    for (let i = 0; i < 6; i++) {
      acak += Math.floor(Math.random() * 16).toString(16);
    }

    return `EWS-${tanggal}-${acak.toUpperCase()}`;
  }

  /**
   * Kirim laporan darurat dari warga.
   * Bisa dipanggil tanpa login (anon) — RLS mengizinkan INSERT dari anon.
   * Jika ada foto, upload dulu ke Supabase Storage bucket 'ews-foto',
   * lalu simpan URL-nya ke kolom foto_url.
   *
   * PENTING: jangan pakai `.select()` setelah `.insert()` di sini.
   * `INSERT ... RETURNING` membuat PostgreSQL ikut memeriksa policy SELECT,
   * sedangkan policy SELECT tabel ini sengaja dibatasi hanya untuk pengurus
   * aktif (supaya nama & alamat pelapor tidak bisa dibaca publik). Akibatnya
   * anon akan ditolak dengan error 42501 walau INSERT-nya sendiri diizinkan.
   * Karena itu nomor laporan dibuat di sisi klien.
   */

  public async kirimLaporanEWS(
    input: LaporanEWSInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, error: 'Layanan EWS belum dikonfigurasi. Hubungi pengurus RT.' };
    }

    try {
      let fotoUrl: string | null = null;

      // Upload foto jika ada
      if (input.foto_file) {
        const ext = input.foto_file.name.split('.').pop() || 'jpg';
        const fileName = `ews-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data: uploadData, error: uploadError } = await client.storage
          .from('ews-foto')
          .upload(fileName, input.foto_file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          console.warn('Upload foto EWS gagal:', uploadError.message);
          // Lanjutkan tanpa foto daripada gagal total
        } else if (uploadData) {
          const { data: urlData } = client.storage.from('ews-foto').getPublicUrl(uploadData.path);
          fotoUrl = urlData?.publicUrl || null;
        }
      }

      const nomorLaporan = this.buatNomorLaporanEWS();

      const { error } = await client
        .from('ews_laporan_rt004')
        .insert({
          id: nomorLaporan,
          jenis_kejadian: input.jenis_kejadian,
          deskripsi: input.deskripsi,
          nama_pelapor: input.nama_pelapor,
          alamat: input.alamat,
          foto_url: fotoUrl,
          status: 'BARU'
        });

      if (error) return { success: false, error: error.message };
      return { success: true, id: nomorLaporan };

    } catch (err: any) {
      return { success: false, error: err?.message || 'Laporan tidak dapat dikirim.' };
    }
  }

  /**
   * Ambil semua laporan EWS — hanya untuk pengurus yang sudah login.
   *
   * Versi ini SELALU melaporkan penyebab kegagalan lewat `error`, supaya
   * dashboard tidak lagi tampak "kosong" padahal sebenarnya query gagal
   * (mis. sesi kedaluwarsa, atau baris profil pengurus tidak ada sehingga
   * policy RLS `is_pengurus_aktif()` menolak SELECT).
   */
  public async fetchRiwayatEWSDetail(): Promise<{ data: LaporanEWS[]; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return {
        data: [],
        error:
          'Aplikasi belum tersambung ke Supabase. Isi URL & anon key di menu Integrasi, lalu muat ulang halaman.'
      };
    }

    if (!authState.hasActiveSession()) {
      return {
        data: [],
        error: 'Sesi login sudah berakhir. Silakan keluar lalu masuk kembali untuk melihat laporan EWS.'
      };
    }

    try {
      const { data, error } = await client
        .from('ews_laporan_rt004')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // 42501 = insufficient_privilege, PGRST301 = JWT tidak valid/kedaluwarsa
        const kodeRls = error.code === '42501' || /row-level security|permission denied/i.test(error.message);
        return {
          data: [],
          error: kodeRls
            ? 'Akun Anda belum terdaftar sebagai pengurus aktif, sehingga laporan EWS tidak boleh dibaca. Tambahkan baris pada tabel pengurus_profil (id = User UID, is_active = true).'
            : `Gagal memuat laporan EWS: ${error.message}`
        };
      }

      if (!Array.isArray(data)) {
        return { data: [], error: 'Respons dari server tidak dikenali saat memuat laporan EWS.' };
      }

      const mapped = data.map(row => ({
        id: String(row.id || ''),
        jenis_kejadian: row.jenis_kejadian || 'LAINNYA',
        deskripsi: row.deskripsi || '',
        nama_pelapor: row.nama_pelapor || '',
        alamat: row.alamat || '',
        foto_url: row.foto_url || null,
        status: (row.status || 'BARU') as StatusEWS,
        created_at: row.created_at || '',
        updated_at: row.updated_at || ''
      })) as LaporanEWS[];

      // Query sukses tapi 0 baris. RLS memfilter tanpa melempar error, jadi
      // bedakan "memang belum ada laporan" dari "profil pengurus belum aktif".
      if (mapped.length === 0) {
        const profil = authState.getProfile();
        if (!profil || !profil.isActive) {
          return {
            data: [],
            error:
              'Laporan tidak dapat ditampilkan karena profil pengurus Anda belum aktif di database. ' +
              'Periksa tabel pengurus_profil: baris dengan id = User UID akun ini harus ada dan is_active = true.'
          };
        }
      }

      return { data: mapped };
    } catch (err: any) {
      return {
        data: [],
        error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi internet Anda.'}`
      };
    }
  }

  /**
   * Ambil semua laporan EWS — hanya untuk pengurus yang sudah login.
   * Dipertahankan agar pemanggil lama tetap berfungsi.
   */
  public async fetchRiwayatEWS(): Promise<LaporanEWS[]> {
    const { data } = await this.fetchRiwayatEWSDetail();
    return data;
  }


  /**
   * Update status laporan EWS — hanya pengurus aktif.
   */
  public async updateStatusEWS(
    id: string,
    status: StatusEWS
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client
        .from('ews_laporan_rt004')
        .update({ status })
        .eq('id', id);

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Daftarkan FCM token device ke Supabase.
   * Dipanggil saat app Android pertama dibuka / token diperbarui.
   *
   * PENTING: fungsi ini WAJIB melaporkan kegagalan ke pemanggil.
   * Versi sebelumnya mengembalikan `void` dan hanya menangkap exception —
   * padahal supabase-js TIDAK melempar exception saat permintaan ditolak
   * (RLS, token kedaluwarsa, tabel belum ada); ia mengembalikan `{ error }`.
   * Akibatnya kegagalan pendaftaran token sama sekali tidak terdeteksi dan
   * HP tidak pernah menerima notifikasi tanpa ada pesan error apa pun.
   *
   * Jalur utama memakai RPC `daftar_fcm_token` (SECURITY DEFINER) supaya
   * pendaftaran tidak bisa digagalkan oleh perubahan policy RLS. Bila RPC
   * belum dibuat di database, otomatis jatuh ke UPSERT biasa.
   */
  public async registerFCMToken(
    token: string,
    deviceInfo?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!token) return { success: false, error: 'Token FCM kosong.' };

    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        error: 'Supabase belum dikonfigurasi (URL / anon key kosong).'
      };
    }

    const info = deviceInfo || (typeof navigator !== 'undefined' ? navigator.userAgent : '') || 'Android';

    // Jalur 1: RPC SECURITY DEFINER — tahan terhadap perubahan policy RLS.
    try {
      const { error } = await client.rpc('daftar_fcm_token', {
        p_token: token,
        p_device_info: info
      });

      if (!error) return { success: true };

      // Fungsi belum ada di database (PGRST202 / 404) → pakai jalur cadangan.
      const kodeTidakAda = error.code === 'PGRST202' || /(does not exist|not found)/i.test(error.message || '');
      if (!kodeTidakAda) {
        return { success: false, error: `${error.code || 'RPC'}: ${error.message}` };
      }
    } catch (err: any) {
      // Gangguan jaringan — laporkan agar pemanggil bisa mencoba ulang.
      return { success: false, error: `Jaringan: ${err?.message || String(err)}` };
    }

    // Jalur 2 (cadangan): UPSERT langsung ke tabel.
    try {
      const { error } = await client
        .from('ews_fcm_tokens')
        .upsert({ token, device_info: info }, { onConflict: 'token' });

      if (error) {
        return { success: false, error: `${error.code || 'DB'}: ${error.message}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Jaringan: ${err?.message || String(err)}` };
    }
  }

  /**
   * Subscribe realtime untuk laporan EWS baru — dipakai di dashboard admin.
   * Mengembalikan fungsi unsubscribe.
   */
  public subscribeEWSRealtime(onNewLaporan: (laporan: LaporanEWS) => void): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('ews-laporan-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ews_laporan_rt004' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          onNewLaporan({
            id: String(row.id || ''),
            jenis_kejadian: row.jenis_kejadian || 'LAINNYA',
            deskripsi: row.deskripsi || '',
            nama_pelapor: row.nama_pelapor || '',
            alamat: row.alamat || '',
            foto_url: row.foto_url || null,
            status: (row.status || 'BARU') as StatusEWS,
            created_at: row.created_at || '',
            updated_at: row.updated_at || ''
          });
        }
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }

  /**
   * Subscribe realtime tabel pengajuan warga — dipakai dashboard admin untuk
   * daftar & badge pending. onChange dipanggil untuk setiap INSERT/UPDATE/DELETE
   * (pemanggil cukup re-fetch daftar terbaru). Butuh sesi pengurus (RLS).
   */
  public subscribePengajuanWarga(onChange: () => void): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('warga-submissions-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warga_submissions_rt004' },
        () => onChange()
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }

  // =====================================================================
  // KEGIATAN RT (Portal Warga Terpadu) — pengurus kelola, warga baca
  // =====================================================================

  /**
   * Ambil daftar kegiatan RT. RLS otomatis memfilter: warga hanya menerima
   * baris `dipublikasikan = true`, pengurus aktif menerima semua. Dipakai
   * baik oleh panel admin maupun tab Kegiatan dashboard warga.
   */
  public async fetchKegiatan(): Promise<{ data: Kegiatan[]; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };
    }

    try {
      const { data, error } = await client
        .from('kegiatan_rt004')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat kegiatan: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map(fromKegiatanRow) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /**
   * Simpan kegiatan (tambah bila `input.id` kosong, ubah bila terisi).
   * Bila ada `fotoFile`, unggah dulu ke bucket `kegiatan-foto` lalu simpan
   * URL publiknya. Hanya pengurus aktif yang lolos policy RLS.
   */
  public async simpanKegiatan(
    input: KegiatanInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      let fotoUrl: string | null = input.fotoUrl ?? null;

      if (input.fotoFile) {
        const ext = input.fotoFile.name.split('.').pop() || 'jpg';
        const fileName = `keg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data: uploadData, error: uploadError } = await client.storage
          .from('kegiatan-foto')
          .upload(fileName, input.fotoFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          return { success: false, error: `Gagal mengunggah foto: ${uploadError.message}` };
        }
        if (uploadData) {
          const { data: urlData } = client.storage.from('kegiatan-foto').getPublicUrl(uploadData.path);
          fotoUrl = urlData?.publicUrl || fotoUrl;
        }
      }

      const payload = {
        judul: input.judul.trim(),
        deskripsi: (input.deskripsi || '').trim(),
        tanggal: input.tanggal,
        waktu: (input.waktu || '').trim(),
        lokasi: (input.lokasi || '').trim(),
        foto_url: fotoUrl,
        dipublikasikan: input.dipublikasikan
      };

      if (input.id) {
        const { error } = await client
          .from('kegiatan_rt004')
          .update(payload)
          .eq('id', input.id);
        if (error) return { success: false, error: error.message };
        return { success: true, id: input.id };
      }

      const { data, error } = await client
        .from('kegiatan_rt004')
        .insert({ ...payload, dibuat_oleh: authState.getUserId() })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id ? String(data.id) : undefined };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Kegiatan tidak dapat disimpan.' };
    }
  }

  /** Hapus satu kegiatan — hanya pengurus aktif (policy RLS). */
  public async hapusKegiatan(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client.from('kegiatan_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Subscribe realtime tabel kegiatan — dipakai panel admin agar daftar
   * ikut ter-refresh saat ada perubahan. onChange dipanggil untuk setiap
   * INSERT/UPDATE/DELETE (pemanggil cukup re-fetch). Mengembalikan unsubscribe.
   */
  public subscribeKegiatanRealtime(onChange: () => void): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('kegiatan-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kegiatan_rt004' },
        () => onChange()
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }

  // =====================================================================
  // KEUANGAN RT (Portal Warga Terpadu) — pengurus keuangan kelola, warga baca
  // =====================================================================

  /**
   * Ambil seluruh transaksi kas RT (urut tanggal terbaru). RLS mengizinkan
   * semua pengguna login membaca (transparansi); hanya pengurus keuangan yang
   * bisa menulis. Dipakai panel admin maupun tab Keuangan dashboard warga.
   */
  public async fetchKeuangan(): Promise<{ data: TransaksiKeuangan[]; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };
    }

    try {
      const { data, error } = await client
        .from('keuangan_rt004')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat data keuangan: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map(fromKeuanganRow) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /**
   * Simpan transaksi kas (tambah bila `input.id` kosong, ubah bila terisi).
   * Hanya pengurus keuangan yang lolos policy RLS (is_pengurus_keuangan).
   * Kolom `bulan_kas` di-set otomatis oleh trigger dari `tanggal`.
   */
  public async simpanKeuangan(
    input: TransaksiKeuanganInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const payload = {
        tanggal: input.tanggal,
        jenis: input.jenis === 'KELUAR' ? 'KELUAR' : 'MASUK',
        kategori: (input.kategori || 'Lainnya').trim() || 'Lainnya',
        jumlah: Math.max(0, Math.round(Number(input.jumlah) || 0)),
        keterangan: (input.keterangan || '').trim()
      };

      if (input.id) {
        const { error } = await client
          .from('keuangan_rt004')
          .update(payload)
          .eq('id', input.id);
        if (error) return { success: false, error: error.message };
        return { success: true, id: input.id };
      }

      const { data, error } = await client
        .from('keuangan_rt004')
        .insert({ ...payload, dibuat_oleh: authState.getUserId() })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id ? String(data.id) : undefined };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Transaksi tidak dapat disimpan.' };
    }
  }

  /** Hapus satu transaksi kas — hanya pengurus keuangan (policy RLS). */
  public async hapusKeuangan(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client.from('keuangan_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Subscribe realtime tabel keuangan — panel admin & tab warga ikut
   * ter-refresh saat ada perubahan. Mengembalikan fungsi unsubscribe.
   */
  public subscribeKeuanganRealtime(onChange: () => void): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('keuangan-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'keuangan_rt004' },
        () => onChange()
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }

  // ===================================================================
  // IURAN / TAGIHAN WARGA — tagihan per-warga + verifikasi bukti transfer
  //   Otorisasi ditegakkan RLS: pengurus keuangan menulis/verifikasi,
  //   warga hanya melihat & melampirkan bukti pada tagihan miliknya.
  // ===================================================================

  /**
   * Ambil SEMUA tagihan (sisi pengurus). RLS mengizinkan pengurus keuangan
   * membaca seluruh baris; warga biasa akan otomatis tersaring ke miliknya.
   * Diurut periode terbaru lalu waktu buat.
   */
  public async fetchIuranAdmin(): Promise<{ data: TagihanIuran[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const { data, error } = await client
        .from('iuran_rt004')
        .select('*')
        .order('periode', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat data tagihan: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map(fromIuranRow) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /**
   * Ambil tagihan MILIK warga yang sedang login. Tak perlu filter manual —
   * policy RLS (warga_id = my_warga_id()) sudah menyaring otomatis.
   */
  public async fetchIuranSaya(): Promise<{ data: TagihanIuran[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const { data, error } = await client
        .from('iuran_rt004')
        .select('*')
        .order('periode', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat tagihan Anda: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map(fromIuranRow) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /**
   * Simpan satu tagihan (tambah bila `input.id` kosong, ubah bila terisi).
   * Hanya pengurus keuangan yang lolos policy RLS.
   */
  public async simpanTagihan(
    input: TagihanIuranInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const payload = {
        warga_id: input.wargaId,
        judul: (input.judul || 'Iuran Kas RT').trim() || 'Iuran Kas RT',
        periode: (input.periode || '').trim(),
        jumlah: Math.max(0, Math.round(Number(input.jumlah) || 0)),
        jatuh_tempo: input.jatuhTempo || null
      };

      if (input.id) {
        const { error } = await client
          .from('iuran_rt004')
          .update(payload)
          .eq('id', input.id);
        if (error) return { success: false, error: error.message };
        return { success: true, id: input.id };
      }

      const { data, error } = await client
        .from('iuran_rt004')
        .insert({ ...payload, dibuat_oleh: authState.getUserId() })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id ? String(data.id) : undefined };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Tagihan tidak dapat disimpan.' };
    }
  }

  /** Hapus satu tagihan — hanya pengurus keuangan (policy RLS). */
  public async hapusTagihan(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client.from('iuran_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Generate tagihan massal untuk banyak warga sekaligus (satu periode & judul).
   * Idempoten: `UNIQUE(warga_id, periode, judul)` + `ignoreDuplicates` menjaga
   * klik berulang tidak menggandakan tagihan. Kembalikan perkiraan jumlah dibuat.
   */
  public async generateIuranMassal(params: {
    periode: string;
    judul: string;
    jumlah: number;
    jatuhTempo?: string | null;
    wargaIds: string[];
  }): Promise<{ success: boolean; dibuat?: number; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    const ids = Array.from(new Set((params.wargaIds || []).filter(Boolean)));
    if (ids.length === 0) return { success: false, error: 'Tidak ada warga terpilih.' };

    const periode = (params.periode || '').trim();
    if (!periode) return { success: false, error: 'Periode wajib diisi.' };

    try {
      const uid = authState.getUserId();
      const judul = (params.judul || 'Iuran Kas RT').trim() || 'Iuran Kas RT';
      const jumlah = Math.max(0, Math.round(Number(params.jumlah) || 0));
      const rows = ids.map((wargaId) => ({
        warga_id: wargaId,
        judul,
        periode,
        jumlah,
        jatuh_tempo: params.jatuhTempo || null,
        dibuat_oleh: uid
      }));

      const { data, error } = await client
        .from('iuran_rt004')
        .upsert(rows, { onConflict: 'warga_id,periode,judul', ignoreDuplicates: true })
        .select('id');

      if (error) return { success: false, error: error.message };
      return { success: true, dibuat: Array.isArray(data) ? data.length : 0 };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Gagal membuat tagihan massal.' };
    }
  }

  /**
   * Unggah bukti transfer (warga) → simpan ke bucket privat `bukti-bayar` lalu
   * pindahkan status ke MENUNGGU_VERIFIKASI. Trigger DB men-stamp `dibayar_at`.
   */
  public async unggahBuktiIuran(
    id: string,
    file: File
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };
    if (!file) return { success: false, error: 'Berkas bukti belum dipilih.' };
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: 'Ukuran bukti maksimal 2 MB.' };
    }

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const objectPath = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await client.storage
        .from('bukti-bayar')
        .upload(objectPath, file, { cacheControl: '3600', upsert: false });
      if (upErr) return { success: false, error: `Gagal mengunggah bukti: ${upErr.message}` };

      const { error } = await client
        .from('iuran_rt004')
        .update({ bukti_path: objectPath, status: 'MENUNGGU_VERIFIKASI' })
        .eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Bukti tidak dapat dikirim.' };
    }
  }

  /**
   * Keputusan verifikasi pengurus: LUNAS (setujui) atau DITOLAK (+alasan).
   * Trigger DB men-stamp `verified_by`/`verified_at`.
   */
  public async verifikasiIuran(
    id: string,
    keputusan: 'LUNAS' | 'DITOLAK',
    catatan?: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const payload: Record<string, unknown> = { status: keputusan };
      if (keputusan === 'DITOLAK') payload.catatan = (catatan || '').trim();
      const { error } = await client
        .from('iuran_rt004')
        .update(payload)
        .eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verifikasi gagal disimpan.' };
    }
  }

  /**
   * Buat signed URL sementara (1 jam) untuk melihat bukti di bucket privat.
   * Kembalikan null bila path kosong / gagal.
   */
  public async buktiSignedUrl(path?: string | null): Promise<string | null> {
    const client = this.getClient();
    if (!client || !path) return null;
    try {
      const { data, error } = await client.storage
        .from('bukti-bayar')
        .createSignedUrl(path, 3600);
      if (error) return null;
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  }

  /** Ambil setelan iuran (baris tunggal id=1) — info pembayaran & default. */
  public async fetchPengaturanIuran(): Promise<{ data: PengaturanIuran | null; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: null, error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const { data, error } = await client
        .from('pengaturan_iuran_rt004')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) return { data: null, error: `Gagal memuat setelan iuran: ${error.message}` };
      return { data: data ? fromPengaturanIuranRow(data) : null };
    } catch (err: any) {
      return { data: null, error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /** Simpan setelan iuran (upsert baris tunggal id=1) — pengurus keuangan. */
  public async simpanPengaturanIuran(
    input: PengaturanIuran
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const payload = {
        id: 1,
        info_pembayaran: (input.infoPembayaran || '').trim(),
        nominal_default: Math.max(0, Math.round(Number(input.nominalDefault) || 0)),
        judul_default: (input.judulDefault || 'Iuran Kas RT').trim() || 'Iuran Kas RT'
      };
      const { error } = await client
        .from('pengaturan_iuran_rt004')
        .upsert(payload, { onConflict: 'id' });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Setelan tidak dapat disimpan.' };
    }
  }

  /**
   * Subscribe realtime tabel iuran — panel admin & tab warga ikut ter-refresh
   * saat ada perubahan tagihan. Mengembalikan fungsi unsubscribe.
   */
  public subscribeIuranRealtime(onChange: () => void): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('iuran-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'iuran_rt004' },
        () => onChange()
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }

  // ===================================================================
  // UMKM WARGA — mini-marketplace (etalase bersama + kelola milik sendiri)
  // ===================================================================

  private readonly UMKM_SELECT = '*, umkm_produk_rt004(*, umkm_varian_rt004(*))';

  /**
   * Etalase bersama: semua lapak berstatus VERIFIED beserta produk & varian.
   * Terlihat oleh semua warga login (RLS). `milikSaya` ditandai untuk lapak
   * milik pengguna aktif.
   */
  public async fetchUmkmEtalase(): Promise<{ data: UmkmToko[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const uid = authState.getUserId();
      const { data, error } = await client
        .from('umkm_rt004')
        .select(this.UMKM_SELECT)
        .eq('status', 'VERIFIED')
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat etalase UMKM: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map((r) => fromTokoRow(r, uid)) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /** Lapak milik pengguna aktif (semua status) untuk panel "Toko Saya". */
  public async fetchUmkmSaya(): Promise<{ data: UmkmToko[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    const uid = authState.getUserId();
    if (!uid) return { data: [], error: 'Sesi login tidak ditemukan.' };

    try {
      const { data, error } = await client
        .from('umkm_rt004')
        .select(this.UMKM_SELECT)
        .eq('owner_uid', uid)
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat lapak Anda: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map((r) => fromTokoRow(r, uid)) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /** Semua lapak (semua status) untuk panel admin — RLS membuka akses admin. */
  public async fetchUmkmAdmin(): Promise<{ data: UmkmToko[]; error?: string }> {
    const client = this.getClient();
    if (!client) return { data: [], error: 'Aplikasi belum tersambung ke Supabase.' };

    try {
      const uid = authState.getUserId();
      const { data, error } = await client
        .from('umkm_rt004')
        .select(this.UMKM_SELECT)
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: `Gagal memuat data UMKM: ${error.message}` };
      if (!Array.isArray(data)) return { data: [] };
      return { data: data.map((r) => fromTokoRow(r, uid)) };
    } catch (err: any) {
      return { data: [], error: `Tidak dapat menghubungi server: ${err?.message || 'periksa koneksi.'}` };
    }
  }

  /**
   * Simpan lapak (tambah bila `input.id` kosong, ubah bila terisi). Foto
   * diunggah ke bucket `umkm-foto`. Status verifikasi TIDAK dikirim dari sini
   * — dikunci trigger `umkm_guard` (lapak baru non-admin selalu PENDING).
   */
  public async simpanToko(
    input: UmkmTokoInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const fotoUrl = await this.uploadFotoUmkm(client, input.fotoFile, input.fotoUrl ?? null, 'toko');
      if (fotoUrl.error) return { success: false, error: fotoUrl.error };

      const payload = {
        nama_usaha: input.namaUsaha.trim(),
        kategori: input.kategori || 'Lainnya',
        deskripsi: (input.deskripsi || '').trim(),
        kontak_wa: (input.kontakWa || '').trim(),
        alamat: (input.alamat || '').trim(),
        foto_url: fotoUrl.url
      };

      if (input.id) {
        const { error } = await client.from('umkm_rt004').update(payload).eq('id', input.id);
        if (error) return { success: false, error: error.message };
        return { success: true, id: input.id };
      }

      const { data, error } = await client
        .from('umkm_rt004')
        .insert({ ...payload, owner_uid: authState.getUserId() })
        .select('id')
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, id: data?.id ? String(data.id) : undefined };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Lapak tidak dapat disimpan.' };
    }
  }

  /** Hapus lapak (produk & varian ikut terhapus via ON DELETE CASCADE). */
  public async hapusToko(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client.from('umkm_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Verifikasi / tolak lapak (admin). Hanya admin yang lolos trigger
   * `umkm_guard` untuk mengubah kolom status.
   */
  public async verifikasiToko(
    id: string,
    status: 'VERIFIED' | 'DITOLAK',
    catatan?: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client
        .from('umkm_rt004')
        .update({
          status,
          catatan_admin: catatan?.trim() || null,
          reviewed_by: authState.getUserId(),
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Simpan produk beserta variannya sekaligus. Varian di-*replace* penuh
   * (hapus semua varian lama produk → sisipkan daftar terbaru) agar sinkron
   * dengan form tanpa perlu diffing.
   */
  public async simpanProduk(
    input: UmkmProdukInput
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const fotoUrl = await this.uploadFotoUmkm(client, input.fotoFile, input.fotoUrl ?? null, 'produk');
      if (fotoUrl.error) return { success: false, error: fotoUrl.error };

      const payload = {
        umkm_id: input.umkmId,
        nama_produk: input.namaProduk.trim(),
        deskripsi: (input.deskripsi || '').trim(),
        harga: Number(input.harga) || 0,
        foto_url: fotoUrl.url,
        tersedia: input.tersedia,
        urutan: input.urutan ?? 0
      };

      let produkId = input.id;
      if (produkId) {
        const { error } = await client.from('umkm_produk_rt004').update(payload).eq('id', produkId);
        if (error) return { success: false, error: error.message };
      } else {
        const { data, error } = await client
          .from('umkm_produk_rt004')
          .insert(payload)
          .select('id')
          .single();
        if (error) return { success: false, error: error.message };
        produkId = data?.id ? String(data.id) : undefined;
      }
      if (!produkId) return { success: false, error: 'ID produk tidak diperoleh.' };

      // Replace penuh daftar varian.
      const { error: delErr } = await client.from('umkm_varian_rt004').delete().eq('produk_id', produkId);
      if (delErr) return { success: false, error: `Gagal memperbarui varian: ${delErr.message}` };

      const varianBersih = (input.varian || []).filter((v) => v.namaVarian.trim());
      if (varianBersih.length > 0) {
        const rows = varianBersih.map((v, i) => ({
          produk_id: produkId,
          nama_varian: v.namaVarian.trim(),
          harga: Number(v.harga) || 0,
          tersedia: v.tersedia,
          urutan: i
        }));
        const { error: insErr } = await client.from('umkm_varian_rt004').insert(rows);
        if (insErr) return { success: false, error: `Gagal menyimpan varian: ${insErr.message}` };
      }
      return { success: true, id: produkId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Produk tidak dapat disimpan.' };
    }
  }

  /** Hapus produk (varian ikut terhapus via ON DELETE CASCADE). */
  public async hapusProduk(id: string): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client tidak tersedia.' };

    try {
      const { error } = await client.from('umkm_produk_rt004').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /** Subscribe realtime lapak UMKM — antrean verifikasi admin auto-refresh. */
  public subscribeUmkmRealtime(onChange: () => void): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    const channel = client
      .channel('umkm-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'umkm_rt004' },
        () => onChange()
      )
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }

  /** Unggah satu foto ke bucket `umkm-foto`; kembalikan URL publik atau error. */
  private async uploadFotoUmkm(
    client: SupabaseClient,
    file: File | null | undefined,
    fallbackUrl: string | null,
    prefix: 'toko' | 'produk'
  ): Promise<{ url: string | null; error?: string }> {
    if (!file) return { url: fallbackUrl };
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await client.storage
      .from('umkm-foto')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) return { url: fallbackUrl, error: `Gagal mengunggah foto: ${error.message}` };
    if (data) {
      const { data: urlData } = client.storage.from('umkm-foto').getPublicUrl(data.path);
      return { url: urlData?.publicUrl || fallbackUrl };
    }
    return { url: fallbackUrl };
  }

  public initAutoSyncListener() {
    storageService.onMutation(async (event) => {
      if (!this.isAutoSyncEnabled()) return;

      try {
        switch (event.type) {
          case 'WARGA_UPSERT':
            await this.autoSyncWarga(event.data);
            break;
          case 'WARGA_DELETE':
            await this.autoDeleteWarga(event.nik);
            break;
          case 'KK_UPSERT':
            await this.autoSyncKK(event.data);
            break;
          case 'KK_DELETE':
            await this.autoDeleteKK(event.nomorKK);
            break;
          case 'SURAT_UPSERT':
            await this.autoSyncSurat(event.data);
            break;
          case 'SURAT_DELETE':
            await this.autoDeleteSurat(event.id);
            break;
          case 'MUTASI_ADD':
            await this.autoSyncMutasi(event.data);
            break;
          case 'MUTASI_DELETE':
            await this.autoDeleteMutasi(event.id);
            break;
        }
      } catch (err) {
        console.warn('Auto-sync background handler warning:', err);
      }
    });
  }
}

export const supabaseService = new SupabaseService();
