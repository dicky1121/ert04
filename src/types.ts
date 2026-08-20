export type JenisKelamin = 'L' | 'P';

export type StatusHubunganKK =
  | 'KEPALA KELUARGA'
  | 'ISTRI'
  | 'ANAK'
  | 'ORANG TUA'
  | 'MERTUA'
  | 'FAMILI LAIN'
  | 'LAINNYA';

export type StatusTinggal = 'TETAP' | 'KONTRAK' | 'KOS' | 'PINDAH_KELUAR' | 'MENINGGAL';

export type StatusPerkawinan = 'BELUM KAWIN' | 'KAWIN' | 'CERAI HIDUP' | 'CERAI MATI';

export type StatusBansos = 'TIDAK_ADA' | 'PKH' | 'BPNT' | 'BLT' | 'BST' | 'BANSOS_DAERAH';

export interface Warga {
  id: string;
  nik: string; // 16 digits
  nomorKK: string; // 16 digits
  nama: string;
  jenisKelamin: JenisKelamin;
  tempatLahir: string;
  tanggalLahir: string; // YYYY-MM-DD
  agama: 'ISLAM' | 'KRISTEN' | 'KATOLIK' | 'HINDU' | 'BUDDHA' | 'KONGHUCU';
  pendidikan: string;
  pekerjaan: string;
  statusPerkawinan: StatusPerkawinan;
  statusHubunganKK: StatusHubunganKK;
  kewarganegaraan: 'WNI' | 'WNA';
  golonganDarah: 'A' | 'B' | 'AB' | 'O' | '-';
  nomorHp: string;
  email?: string;
  statusTinggal: StatusTinggal;
  // Special categories for social assistance & demographics
  usia?: number;
  isLansia?: boolean; // Age >= 60
  isBalita?: boolean; // Age <= 5
  isYatim?: boolean; // Yatim / Piatu / Yatim Piatu
  isDisabilitas?: boolean;
  statusBansos: StatusBansos;
  keteranganBansos?: string;
  tanggalInput: string;
  catatan?: string;
}

export interface KartuKeluarga {
  id: string;
  nomorKK: string; // 16 digits
  kepalaKeluargaNama: string;
  kepalaKeluargaNik: string;
  alamat: string;
  rt: string;
  rw: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string;
  statusDomisili: 'TETAP' | 'KONTRAK' | 'KOS';
  blokRumah: string; // e.g. "Blok A2 No. 14"
  tanggalTerbit: string;
  anggota: Warga[];
  tanggalUpdate: string;
  catatan?: string;
}

export type JenisSurat =
  | 'KTP_KK'
  | 'SKTM'
  | 'DOMISILI'
  | 'USAHA'
  | 'NIKAH'
  | 'KEMATIAN'
  | 'KELAHIRAN'
  | 'SKCK'
  | 'IZIN_KERAMAIAN'
  | 'LAINNYA';

export interface SuratPengantar {
  id: string;
  nomorSurat: string; // e.g. "184 / RT 004 RW 007 / SP / 2026"
  jenisSurat: JenisSurat;
  judulSurat: string;
  nikPemohon: string;
  namaPemohon: string;
  nomorKKPemohon: string;
  tempatTglLahirPemohon: string;
  jenisKelaminPemohon: JenisKelamin;
  agamaPemohon: string;
  pekerjaanPemohon: string;
  statusKawinPemohon: string;
  teleponPemohon?: string;
  alamatPemohon: string;
  alamatBaris1?: string;
  alamatBaris2?: string;
  keperluan: string;
  keperluanBaris1?: string;
  keperluanBaris2?: string;
  keteranganLain?: string;
  tanggalPengajuan: string;
  tanggalDisetujui?: string;
  status: 'PENDING' | 'DISETUJUI' | 'DITOLAK';
  alasanPenolakan?: string;
  namaPejabatTtd: string;
  jabatanTtd: string;
  namaKetuaRT?: string;
  namaKetuaRW?: string;
  kodeVerifikasiQr: string;
  catatan?: string;
  filePendukungNama?: string;
  dibuatOleh: 'WARGA' | 'ADMIN';
}

export interface PengajuanSuratPublik {
  jenisSurat: JenisSurat;
  nikPemohon: string;
  namaPemohon: string;
  nomorKKPemohon: string;
  jenisKelaminPemohon: JenisKelamin;
  tempatTglLahirPemohon: string;
  agamaPemohon: string;
  pekerjaanPemohon: string;
  statusKawinPemohon: string;
  teleponPemohon: string;
  alamatPemohon: string;
  keperluan: string;
  keteranganLain?: string;
}

/** Info kontak resmi yang boleh dibaca pengunjung portal (fungsi konfigurasi_publik). */
export interface KonfigurasiPublik {
  namaRT?: string;
  namaRW?: string;
  kelurahan?: string;
  kecamatan?: string;
  kabupatenKota?: string;
  alamatSekretariat?: string;
  kontakSekretariat?: string;
  kontakRT?: string;
  emailRT?: string;
  jamPelayanan?: string;
}

/** Hasil pelacakan pengajuan surat oleh warga (fungsi cek_status_pengajuan). */
export interface StatusPengajuanPublik {
  ditemukan: boolean;
  pesan?: string;
  referensi?: string;
  jenisSurat?: JenisSurat;
  namaPemohon?: string;
  keperluan?: string;
  status?: 'PENDING' | 'DISETUJUI' | 'DITOLAK';
  tanggalPengajuan?: string;
  tanggalDisetujui?: string | null;
  alasanPenolakan?: string | null;
}

/** Angka agregat untuk halaman publik — tidak memuat data pribadi. */
export interface StatistikPublik {
  suratSelesaiBulanIni: number;
  suratDiproses: number;
  suratTahunIni: number;
}

export type KategoriPengumuman = 'UMUM' | 'KEGIATAN' | 'KEAMANAN' | 'KESEHATAN' | 'IURAN' | 'DARURAT';

export interface PengumumanPublik {
  id: string;
  judul: string;
  isi: string;
  kategori: KategoriPengumuman | string;
  tanggalMulai: string;
  tanggalSelesai?: string | null;
}

export type KategoriPengaduan = 'KEAMANAN' | 'KEBERSIHAN' | 'INFRASTRUKTUR' | 'SOSIAL' | 'LAINNYA';

/** Payload laporan warga yang dikirim lewat fungsi kirim_pengaduan. */
export interface PengaduanInput {
  kategori: KategoriPengaduan;
  namaPelapor: string;
  kontakPelapor: string;
  alamatKejadian: string;
  isiLaporan: string;
}

// ---------------------------------------------------------------------
// Fitur: Daftar / Perbarui Data Warga (pengajuan warga self-service)
// ---------------------------------------------------------------------

export type StatusPendaftaranWargaKode = 'PENDING' | 'DISETUJUI' | 'DITOLAK';
export type JenisPengajuanWarga = 'BARU' | 'PERBARUI';

/** Payload form warga yang dikirim lewat RPC ajukan_pendaftaran_warga. */
export interface PendaftaranWargaInput {
  nik: string;
  nomorKK: string;
  nama: string;
  jenisKelamin: JenisKelamin;
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  pekerjaan: string;
  statusPerkawinan: string;
  statusHubunganKK: string;
  golonganDarah: string;
  nomorHp: string;
  statusTinggal: string;
  isYatim: boolean;
  isDisabilitas: boolean;
  statusBansos: string;
  keteranganBansos: string;
  catatan: string;
}

/** Satu baris pengajuan warga (tabel warga_submissions_rt004) untuk dashboard admin. */
export interface PengajuanWarga {
  id: string;
  nik: string;
  nomorKK: string;
  nama: string;
  jenisKelamin: JenisKelamin | '';
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  pekerjaan: string;
  statusPerkawinan: string;
  statusHubunganKK: string;
  golonganDarah: string;
  nomorHp: string;
  email: string;
  statusTinggal: string;
  isYatim: boolean;
  isDisabilitas: boolean;
  statusBansos: string;
  keteranganBansos: string;
  catatan: string;
  jenisPengajuan: JenisPengajuanWarga;
  status: StatusPendaftaranWargaKode;
  matchedWargaId: string | null;
  /** Terisi bila pengajuan berasal dari pendaftaran akun warga (login NIK+PIN).
   *  Menyetujui pengajuan ini otomatis mengaktifkan akun login-nya. */
  akunUserId?: string | null;
  catatanAdmin: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

/** Hasil RPC cek_status_pendaftaran_warga (dipakai warga di aplikasi Android). */
export interface StatusPendaftaranWarga {
  ditemukan: boolean;
  pesan?: string;
  referensi?: string;
  nama?: string;
  jenisPengajuan?: JenisPengajuanWarga;
  status?: StatusPendaftaranWargaKode;
  submittedAt?: string;
  reviewedAt?: string | null;
  catatanAdmin?: string | null;
}

export type JenisMutasi = 'PINDAH_MASUK' | 'PINDAH_KELUAR' | 'KELAHIRAN' | 'KEMATIAN' | 'PERUBAHAN_STATUS';


export interface MutasiPenduduk {
  id: string;
  tanggal?: string;
  tanggalPeristiwa?: string;
  tanggalLapor?: string;
  jenisMutasi: JenisMutasi;
  nik?: string;
  nikWarga?: string;
  namaWarga: string;
  nomorKK: string;
  alamatAsal: string;
  alamatTujuan: string;
  alasan?: string;
  alasanMutasi?: string;
  noSuratKeterangan?: string;
  nomorSuratPindah?: string;
  noSuratPindah?: string;
  petugas?: string;
  dicatatOleh?: string;
  catatan?: string;
  keterangan?: string;
}

export interface Notifikasi {
  id: string;
  judul: string;
  pesan: string;
  tipe: 'SURAT_BARU' | 'MUTASI' | 'UPDATE_DATA' | 'BANSOS' | 'SISTEM';
  timestamp: string;
  dibaca: boolean;
  linkTab: string;
  entityId?: string;
  suratId?: string;
}

export type AppNotification = Notifikasi;

export type UserRole =
  | 'ADMIN_KETUA_RT'
  | 'ADMIN_SEKRETARIS'
  | 'BENDAHARA'
  | 'SEKSI_KEAMANAN'
  | 'STAF_PELAYANAN'
  | 'ADMIN_SISTEM'
  | 'ADMIN_CUSTOM'
  | 'WARGA'
  | string;

// ---------------------------------------------------------------------
// Akun warga (login NIK + PIN 6 angka) — Portal Warga Terpadu
// ---------------------------------------------------------------------

export type StatusAkunWarga = 'PENDING' | 'AKTIF' | 'DITOLAK' | 'NONAKTIF';

/** Profil akun warga (baris tabel warga_akun) untuk sesi login warga. */
export interface WargaProfile {
  id: string; // = auth.users.id
  nik: string;
  wargaId: string | null; // id di warga_rt004 (diisi saat di-ACC)
  nama: string;
  nomorHp?: string;
  status: StatusAkunWarga;
}

/**
 * Payload pendaftaran akun warga (data diri + PIN 6 angka) yang dikirim ke
 * Edge Function `daftar-akun-warga`. Memakai field yang sama dengan
 * PendaftaranWargaInput, ditambah PIN.
 */
export interface DaftarAkunWargaInput extends PendaftaranWargaInput {
  pin: string; // tepat 6 angka
}

export interface PengurusAccount {
  id: string;
  username: string;
  namaLengkap: string;
  role: UserRole;
  roleLabel: string;
  pinOrPassword: string;
  nomorHp?: string;
  email?: string;
  jabatanKhusus?: string;
  isActive: boolean;
  terakhirLogin?: string;
  dibuatPada: string;
}

export interface CurrentUser {
  role: UserRole;
  nama: string;
  username?: string;
  nik?: string;
  nomorKK?: string;
  nomorHp?: string;
  email?: string;
  isAuthenticated: boolean;
  isLoggedIn?: boolean;
}

export interface RTConfig {
  namaRT: string;
  namaRW: string;
  kelurahan: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string;
  namaKetuaRT: string;
  namaKetuaRW?: string;
  nikKetuaRT: string;
  namaSekretaris: string;
  kontakRT: string;
  kontakSekretariat?: string;
  emailRT: string;
  alamatSekretariat: string;
  stempelDigitalAktif: boolean;
  tandaTanganDigitalAktif: boolean;
  kodeFormatSurat: string; // e.g. "SP-RT004/RW007/JTM"
  nomorSuratCounter?: number;
  tahunSuratCounter?: number;
  logoUrl?: string;
  tandaTanganUrl?: string;
  stempelUrl?: string;
  // Integration configs
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseTersambung: boolean;
  supabaseAutoSync?: boolean;
  googleSpreadsheetId: string;
  terakhirSinkron: string;
  // Kop Surat (letterhead) custom logo & layout — uploaded by admin, used as-is
  kopLogoDataUrl?: string; // base64 data URL of uploaded logo (PNG/JPG/SVG)
  kopLogoName?: string; // original file name
  kopLogoWidthMm?: number; // rendered width in mm (default 22)
  kopLogoHeightMm?: number; // auto-derived to preserve aspect ratio
  kopLogoOffsetXMm?: number; // horizontal offset from left edge in mm
  kopLogoOffsetYMm?: number; // vertical offset from top in mm
  // Custom Header & Kop Surat Texts
  kopInstansiAtas?: string; // default "PEMERINTAH KABUPATEN BEKASI"
  kopTeksRT?: string; // default "RT 004  RW 007"
  kopKelurahan?: string; // default "KELURAHAN JATIMULYA"
  kopKecamatan?: string; // default "KECAMATAN TAMBUN SELATAN"
  kopSekretariatText?: string; // default "Sekretariat : jl jampang no 111  jatimulya tlp 0896-7720-3444"
  // Format Isi Surat Pengantar
  judulSuratPengantar?: string; // default "SURAT PENGANTAR"
  formatNomorSurat?: string; // default "185 / RT 004 RW 007 / SP / 2026"
  kalimatPembukaSurat?: string; // default "Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :"
  kalimatPenutupSurat?: string; // default "Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya."
  lokasiSurat?: string; // default "Jatimulya"
  alamatBaris1Default?: string; // default "Kp Jati RT 004 RW 007 Kelurahan Jatimulya"
  alamatBaris2Default?: string; // default "Kec. Tambun Selatan Kab. Bekasi"
  // Tipografi dan jarak dokumen surat
  suratFontFamily?: 'Arial' | 'Times New Roman' | 'Calibri' | 'Georgia';
  suratBodyFontSizePt?: number;
  suratKopFontSizePt?: number;
  suratTitleFontSizePt?: number;
  suratLineHeight?: number;
  suratRowSpacingPt?: number;
  suratSectionSpacingPt?: number;
  suratSignatureSpacePt?: number;
}

// =====================================================================
// EWS (EARLY WARNING SYSTEM)
// =====================================================================

export type JenisKejadianEWS =
  | 'KEBAKARAN'
  | 'KEMALINGAN'
  | 'KECELAKAAN'
  | 'MENINGGAL'
  | 'BANJIR'
  | 'TAWURAN'
  | 'LAINNYA';

export type StatusEWS = 'BARU' | 'DITANGANI' | 'SELESAI';

export interface LaporanEWS {
  id: string;
  jenis_kejadian: JenisKejadianEWS;
  deskripsi: string;
  nama_pelapor: string;
  alamat: string;
  foto_url?: string | null;
  status: StatusEWS;
  created_at: string;
  updated_at?: string;
}

export interface LaporanEWSInput {
  jenis_kejadian: JenisKejadianEWS;
  deskripsi: string;
  nama_pelapor: string;
  alamat: string;
  foto_file?: File | null;
}

export interface EWSJenisKejadianMeta {
  value: JenisKejadianEWS;
  label: string;
  emoji: string;
  warna: string; // Tailwind color class
}

export const EWS_JENIS_KEJADIAN: EWSJenisKejadianMeta[] = [
  { value: 'KEBAKARAN',  label: 'Kebakaran',   emoji: '🔥', warna: 'rose' },
  { value: 'KEMALINGAN', label: 'Kemalingan',  emoji: '🔓', warna: 'amber' },
  { value: 'KECELAKAAN', label: 'Kecelakaan',  emoji: '🚑', warna: 'orange' },
  { value: 'MENINGGAL',  label: 'Warga Meninggal', emoji: '🕊️', warna: 'slate' },
  { value: 'BANJIR',     label: 'Banjir',      emoji: '🌊', warna: 'blue' },
  { value: 'TAWURAN',    label: 'Tawuran',     emoji: '⚠️', warna: 'yellow' },
  { value: 'LAINNYA',    label: 'Lainnya',     emoji: '📢', warna: 'purple' },
];

export interface AuditLog {
  id: string;
  timestamp: string;
  adminNama: string;
  adminRole: string;
  aktivitas: string;
  target: string;
  detail: string;
  status: 'SUKSES' | 'GAGAL' | 'PERINGATAN';
}

export interface SuratTemplate {
  id: string;
  kode: string;
  nama: string;
  judulSurat: string;
  keperluanDefault: string;
  isiTemplate: string;
  isActive: boolean;
  keterangan: string;
  tanggalDibuat: string;
}

export interface SheetColumnMapping {
  nikCol?: number;
  namaCol?: number;
  kkCol?: number;
  ttlCol?: number;
  tempatLahirCol?: number;
  tglLahirCol?: number;
  jkCol?: number;
  alamatCol?: number;
  noRmCol?: number;
  noKeluargaCol?: number;
  noHpCol?: number;
  ketCol?: number;
  statusTinggalCol?: number;
}

export interface DetectedSheetInfo {
  sheetIndex: number;
  name: string;
  totalRawRows: number;
  headerRowIdx: number;
  startDataRow: number;
  headers: string[];
  sampleRows: any[][];
  inferredRole: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE';
  columnMapping: SheetColumnMapping;
  parsedRowCount: number;
}

export interface ImportPreviewRow {
  rowNumber: number;
  sheetOrigin?: string; // 'Data Warga Tetap' | 'Data Pengontrak' | 'Data Lansia' | 'Umum'
  noKeluarga?: string | number;
  noRumah?: string;
  nik: string;
  nomorKK: string;
  nama: string;
  jenisKelamin: 'L' | 'P';
  tempatLahir: string;
  tanggalLahir: string;
  agama: string;
  statusPerkawinan: string;
  statusHubunganKK: string;
  pekerjaan: string;
  nomorHp: string;
  statusTinggal: 'TETAP' | 'KONTRAK' | 'KOS';
  alamat: string;
  bansos: string;
  keteranganKhusus?: string;
  tanpaNikKtp: boolean; // Flag if citizen has no NIK/KTP but is accepted
  isLansia?: boolean;
  isBalita?: boolean;
  usia?: number;
  isValid: boolean;
  isDuplicateInFile: boolean;
  isExistingInDb: boolean;
  errorMessages: string[];
}

export interface ImportAnalysisResult {
  totalRows: number;
  validCount: number;
  tanpaNikCount: number;
  wargaTetapCount: number;
  pengontrakCount: number;
  lansiaCount: number;
  balitaCount?: number;
  duplicateInFileCount: number;
  existingInDbCount: number;
  invalidNikCount: number;
  invalidKkCount: number;
  detectedSheets: string[];
  sheetsInfo?: DetectedSheetInfo[];
  parsedRows: ImportPreviewRow[];
}


