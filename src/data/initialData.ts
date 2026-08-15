import { KartuKeluarga, Warga, SuratPengantar, MutasiPenduduk, Notifikasi, RTConfig, PengurusAccount } from '../types';

/**
 * Data awal aplikasi.
 *
 * CATATAN: Seluruh data demo/contoh (warga, kartu keluarga, surat, mutasi,
 * notifikasi, dan log audit) telah dihapus. Database dimulai dari kosong
 * sehingga siap diisi data kependudukan riil atau hasil impor Excel/Supabase.
 *
 * Yang tetap dipertahankan hanya konfigurasi instansi (kop surat & identitas RT),
 * satu akun administrator utama, dan satu template surat pengantar resmi —
 * karena ketiganya adalah konfigurasi operasional, bukan data contoh.
 */

export const initialPengurusAccounts: PengurusAccount[] = [
  {
    id: 'usr-rt004-01',
    username: 'ketua_rt004',
    namaLengkap: 'Ketua RT 004',
    role: 'ADMIN_KETUA_RT',
    roleLabel: 'Ketua RT 004 (Admin Utama)',
    pinOrPassword: '1234',
    nomorHp: '',
    email: '',
    isActive: true,
    dibuatPada: new Date().toISOString().split('T')[0]
  }
];

export const initialRTConfig: RTConfig = {
  namaRT: '004',
  namaRW: '007',
  kelurahan: 'Jatimulya',
  kecamatan: 'Tambun Selatan',
  kabupatenKota: 'Kabupaten Bekasi',
  provinsi: 'Jawa Barat',
  kodePos: '17510',
  namaKetuaRT: 'Ketua RT 004',
  namaKetuaRW: 'Ketua RW 007',
  nikKetuaRT: '',
  namaSekretaris: 'Sekretaris RT 004',
  kontakRT: '',
  emailRT: '',
  alamatSekretariat: 'JL. Jampang No. 111 Kel. Jatimulya Kab. Bekasi Jawa Barat',
  stempelDigitalAktif: false,
  tandaTanganDigitalAktif: false,
  kodeFormatSurat: 'RT 004 RW 007 / SP',
  nomorSuratCounter: 1,
  tahunSuratCounter: new Date().getFullYear(),
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseTersambung: false,
  supabaseAutoSync: false,
  googleSpreadsheetId: '',
  terakhirSinkron: '',
  kopLogoDataUrl: '',
  kopLogoName: '',
  kopLogoWidthMm: 24,
  kopLogoHeightMm: 0,
  kopLogoOffsetXMm: 0,
  kopLogoOffsetYMm: 0,
  kopInstansiAtas: 'PEMERINTAHAN KABUPATEN BEKASI',
  kopTeksRT: 'RT 004  RW 007',
  kopKelurahan: 'KELURAHAN JATIMULYA',
  kopKecamatan: 'KECAMATAN TAMBUN SELATAN',
  kopSekretariatText: 'Sekretariat : JL. Jampang No. 111 Kel. Jatimulya Kab. Bekasi',
  judulSuratPengantar: 'SURAT PENGANTAR',
  formatNomorSurat: `1 / RT 004 RW 007 / SP / ${new Date().getFullYear()}`,
  kalimatPembukaSurat: 'Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya, Menerangkan Bahwa :',
  kalimatPenutupSurat: 'Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat- Pengantar Ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
  lokasiSurat: 'Jatimulya',
  alamatBaris1Default: 'Kp Jati RT 004 RW 007 Kelurahan Jatimulya',
  alamatBaris2Default: 'Kec. Tambun Selatan Kab. Bekasi'
};

// Database dimulai kosong — tidak ada data demo.
export const initialWargaList: Warga[] = [];

export const initialKartuKeluargaList: KartuKeluarga[] = [];

export const initialSuratPengantarList: SuratPengantar[] = [];

export const initialNotifikasiList: Notifikasi[] = [];

export const initialMutasiList: MutasiPenduduk[] = [];

export const initialAuditLogs: import('../types').AuditLog[] = [];

export const initialTemplates: import('../types').SuratTemplate[] = [
  {
    id: 'tpl-pengantar-resmi',
    kode: 'PENGANTAR_RESMI',
    nama: 'Surat Pengantar RT 004 RW 007 (Format Resmi)',
    judulSurat: 'SURAT PENGANTAR',
    keperluanDefault: '',
    isiTemplate: `Yang Bertanda Tangan Dibawah Ini Ketua Rt 004 Rw 007 Kelurahan Jatimulya.
Menerangkan Bahwa :

Nama              : {{NAMA}}
Tempat Tgl Lahir  : {{TEMPAT_LAHIR}}, {{TANGGAL_LAHIR}}
Jenis Kelamin     : {{JENIS_KELAMIN}}
Status Perkawinan : {{STATUS_KAWIN}}
Agama             : {{AGAMA}}
No Ktp / No Nik   : {{NIK}}
Pekerjaan         : {{PEKERJAAN}}
Telepon / Hp      : {{TELEPON}}
Alamat Lengkap    : {{ALAMAT_BARIS_1}}
                  : {{ALAMAT_BARIS_2}}
Keperluan         : {{KEPERLUAN}}

Benar Bahwa Yang Bersangkutan Adalah Warga Kami , Demikian Surat-
Pengantar Ini Dibuat untuk dapat dipergunakan sebagaimana mestinya.`,
    isActive: true,
    keterangan: 'Format resmi tunggal persuratan RT 004 RW 007 Kelurahan Jatimulya',
    tanggalDibuat: new Date().toISOString().split('T')[0]
  }
];
