import type { WorkBook } from 'xlsx';
import {
  KartuKeluarga, 
  Warga, 
  SuratPengantar, 
  MutasiPenduduk, 
  Notifikasi, 
  RTConfig, 
  CurrentUser, 
  AuditLog, 
  SuratTemplate, 
  ImportAnalysisResult, 
  ImportPreviewRow,
  DetectedSheetInfo,
  SheetColumnMapping,
  PengurusAccount,
  UserRole
} from '../types';
import { 
  initialKartuKeluargaList, 
  initialWargaList, 
  initialSuratPengantarList, 
  initialMutasiList, 
  initialNotifikasiList, 
  initialRTConfig, 
  initialTemplates, 
  initialAuditLogs,
  initialPengurusAccounts
} from '../data/initialData';

// ─── Pemuatan `xlsx` secara dinamis ──────────────────────────────────────────
// Pustaka `xlsx` (±425 kB terminifikasi) HANYA dipakai fitur pengurus: ekspor
// Excel, impor spreadsheet, dan unduh template. Dulu di-import statis di baris
// pertama berkas ini, sehingga setiap warga yang membuka aplikasi ikut mengunduh
// seluruh pustaka itu padahal tidak punya satu pun layar yang memakainya —
// storage.ts sendiri tetap dibutuhkan warga (cache lokal, config, sesi).
//
// Sekarang modulnya diambil saat pertama kali benar-benar dipakai lalu disimpan
// di `xlsxCache`, jadi klik kedua tidak mengunduh ulang. Tipe `WorkBook` tetap
// di-import statis: `import type` dihapus saat kompilasi, jadi nol byte.
type XlsxModule = typeof import('xlsx');
let xlsxCache: XlsxModule | null = null;

async function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxCache) {
    xlsxCache = await import('xlsx');
  }
  return xlsxCache;
}

const STORAGE_KEYS = {
  KK: 'sip_rt004_kk_v1',
  WARGA: 'sip_rt004_warga_v1',
  SURAT: 'sip_rt004_surat_v1',
  MUTASI: 'sip_rt004_mutasi_v1',
  NOTIF: 'sip_rt004_notif_v1',
  CONFIG: 'sip_rt004_config_v1',
  USER: 'sip_rt004_current_user_v1',
  TEMPLATES: 'sip_rt004_templates_v1',
  AUDIT: 'sip_rt004_audit_logs_v1',
  ACCOUNTS: 'sip_rt004_accounts_v1',
  LOGIN_ATTEMPTS: 'sip_rt004_login_attempts_v1',
  PRIVACY_MASK: 'sip_rt004_privacy_mask_v1'
};

// Helper to mask sensitive data according to UU PDP No. 27/2022 (Indonesian Privacy Law)
export function maskNik(nik: string | undefined | null): string {
  if (!nik || nik === '-' || nik.length < 8) return '-';
  const clean = nik.replace(/'/g, '').trim();
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 6)}******${clean.slice(-4)}`;
}

export function maskKK(nomorKK: string | undefined | null): string {
  if (!nomorKK || nomorKK === '-' || nomorKK.length < 8) return '-';
  const clean = nomorKK.replace(/'/g, '').trim();
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 6)}******${clean.slice(-4)}`;
}

export function maskPhone(phone: string | undefined | null): string {
  if (!phone || phone === '-' || phone.length < 6) return '-';
  const clean = phone.trim();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 4)}****${clean.slice(-3)}`;
}


// Helper to convert any date string format to ISO YYYY-MM-DD
export function parseDateToIso(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') return '1990-01-01';
  const clean = dateStr.trim();

  // Excel serial number (e.g. 29372 or 36526)
  if (/^\d{4,5}$/.test(clean)) {
    const serial = parseInt(clean, 10);
    if (serial > 1000 && serial < 60000) {
      const date = new Date((serial - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Check if ISO format already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 2-digit year (e.g. 08-08-63 or 24/10/79)
  const dmy2Match = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);
  if (dmy2Match) {
    const day = dmy2Match[1].padStart(2, '0');
    const month = dmy2Match[2].padStart(2, '0');
    const yy = parseInt(dmy2Match[3], 10);
    const year = yy < 30 ? (2000 + yy).toString() : (1900 + yy).toString();
    return `${year}-${month}-${day}`;
  }

  // Indonesian text date format (e.g. "12 Mei 1975", "24-Agu-1988", "30 Des 2023")
  const indoMonths: Record<string, string> = {
    jan: '01', januari: '01',
    feb: '02', februari: '02',
    mar: '03', maret: '03',
    apr: '04', april: '04',
    mei: '05', may: '05',
    jun: '06', juni: '06',
    jul: '07', juli: '07',
    agu: '08', agustus: '08', ags: '08',
    sep: '09', september: '09',
    okt: '10', oktober: '10',
    nov: '11', november: '11',
    des: '12', desember: '12'
  };

  const wordMatch = clean.match(/^(\d{1,2})[\s\-_/]+([a-zA-Z]+)[\s\-_/]+(\d{2,4})$/);
  if (wordMatch) {
    const day = wordMatch[1].padStart(2, '0');
    const monthWord = wordMatch[2].toLowerCase();
    let year = wordMatch[3];
    if (year.length === 2) {
      const yy = parseInt(year, 10);
      year = yy < 30 ? (2000 + yy).toString() : (1900 + yy).toString();
    }
    const matchedMonth = indoMonths[monthWord] || Object.keys(indoMonths).find(k => monthWord.startsWith(k));
    const month = matchedMonth ? (indoMonths[matchedMonth] || indoMonths[monthWord] || '01') : '01';
    return `${year}-${month}-${day}`;
  }

  // Check if JS Date parsable
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return '1990-01-01';
}

// Helper to format date string to DD-MM-YYYY standard display format
export function formatDateDDMMYYYY(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') return '-';
  const clean = dateStr.trim();
  
  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    return clean;
  }
  
  // If YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  // If DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${day}-${month}-${year}`;
  }

  // Convert via parser
  const iso = parseDateToIso(clean);
  if (iso && iso.includes('-')) {
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
  }

  return clean;
}

// Helper to compute demographics flags from birthdate (Lansia >= 60, Balita <= 5)
export function calculateDemographics(tanggalLahir: string): { isLansia: boolean; isBalita: boolean; usia: number } {
  if (!tanggalLahir || tanggalLahir === '-' || tanggalLahir.trim() === '') {
    return { isLansia: false, isBalita: false, usia: 0 };
  }

  // Safe parse across any input format (DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, Excel serial)
  const isoDate = parseDateToIso(tanggalLahir);
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    return { isLansia: false, isBalita: false, usia: 0 };
  }

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);

  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) {
    return { isLansia: false, isBalita: false, usia: 0 };
  }
  
  const today = new Date();
  let age = today.getFullYear() - birthYear;
  const m = today.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && today.getDate() < birthDay)) {
    age--;
  }

  const cleanAge = Math.max(0, age);
  return {
    isLansia: cleanAge >= 60,
    isBalita: cleanAge <= 5,
    usia: cleanAge
  };
}

export type StorageMutationEvent = 
  | { type: 'WARGA_UPSERT'; data: Warga }
  | { type: 'WARGA_DELETE'; nik: string; id: string }
  | { type: 'KK_UPSERT'; data: KartuKeluarga }
  | { type: 'KK_DELETE'; nomorKK: string; id: string }
  | { type: 'SURAT_UPSERT'; data: SuratPengantar }
  | { type: 'SURAT_DELETE'; id: string }
  | { type: 'MUTASI_ADD'; data: MutasiPenduduk }
  | { type: 'MUTASI_DELETE'; id: string }
  | { type: 'PENGURUS_UPSERT'; data: PengurusAccount };

type MutationListener = (event: StorageMutationEvent) => void;

class StorageService {
  private listeners: (() => void)[] = [];
  private mutationListeners: MutationListener[] = [];

  constructor() {
    this.init();
  }

  public onMutation(listener: MutationListener): () => void {
    this.mutationListeners.push(listener);
    return () => {
      this.mutationListeners = this.mutationListeners.filter(l => l !== listener);
    };
  }

  public emitMutation(event: StorageMutationEvent) {
    this.mutationListeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error('Mutation listener error', e);
      }
    });
  }

  private init() {
    if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
      this.saveConfig(initialRTConfig);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WARGA)) {
      this.saveWargaList(initialWargaList);
    }
    if (!localStorage.getItem(STORAGE_KEYS.KK)) {
      this.saveKKList(initialKartuKeluargaList);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SURAT)) {
      this.saveSurat(initialSuratPengantarList);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MUTASI)) {
      this.saveMutasi(initialMutasiList);
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIF)) {
      this.saveNotifikasi(initialNotifikasiList);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TEMPLATES)) {
      this.saveTemplates(initialTemplates);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT)) {
      this.saveAuditLogs(initialAuditLogs);
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACCOUNTS)) {
      this.savePengurusAccounts(initialPengurusAccounts);
    }
    if (!localStorage.getItem(STORAGE_KEYS.USER)) {
      this.saveCurrentUser({
        role: 'ADMIN_KETUA_RT',
        nama: initialRTConfig.namaKetuaRT,
        isAuthenticated: false,
        isLoggedIn: false
      });
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (e) {
        console.error('Listener notify error', e);
      }
    });
  }

  // --- PENGURUS ACCOUNTS & AUTH SECURITY ---
  public getPengurusAccounts(): PengurusAccount[] {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!data) return initialPengurusAccounts;
    try {
      const list: PengurusAccount[] = JSON.parse(data);
      if (!Array.isArray(list) || list.length === 0) return initialPengurusAccounts;
      return list;
    } catch {
      return initialPengurusAccounts;
    }
  }

  public savePengurusAccounts(accounts: PengurusAccount[]) {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    this.notify();
  }

  public addPengurusAccount(newAcc: Omit<PengurusAccount, 'id' | 'dibuatPada'>): { success: boolean; message: string; account?: PengurusAccount } {
    const accounts = this.getPengurusAccounts();
    
    // Validate username uniqueness
    const cleanUsername = (newAcc.username || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanUsername) {
      return { success: false, message: 'Username wajib diisi.' };
    }

    if (accounts.some(a => a.username.toLowerCase() === cleanUsername)) {
      return { success: false, message: `Username "${cleanUsername}" sudah digunakan. Harap gunakan username lain.` };
    }

    if (!newAcc.namaLengkap || newAcc.namaLengkap.trim().length < 3) {
      return { success: false, message: 'Nama lengkap wajib diisi minimal 3 karakter.' };
    }

    const pin = (newAcc.pinOrPassword || '').trim();
    if (pin.length < 4) {
      return { success: false, message: 'Password / PIN minimal 4 karakter.' };
    }

    const id = `usr-rt004-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const createdAccount: PengurusAccount = {
      ...newAcc,
      id,
      username: cleanUsername,
      namaLengkap: newAcc.namaLengkap.trim(),
      role: newAcc.role || 'ADMIN_CUSTOM',
      roleLabel: newAcc.roleLabel || 'Pengurus RT 004',
      pinOrPassword: pin,
      isActive: newAcc.isActive ?? true,
      dibuatPada: new Date().toISOString().split('T')[0]
    };

    accounts.push(createdAccount);
    this.savePengurusAccounts(accounts);
    this.addAuditLog('Manajemen Akun', createdAccount.namaLengkap, `Menambahkan role/akun pengurus baru (${createdAccount.roleLabel})`, 'SUKSES');

    return { success: true, message: `Akun "${createdAccount.namaLengkap}" (${createdAccount.roleLabel}) berhasil ditambahkan!`, account: createdAccount };
  }

  public updatePengurusAccount(id: string, updates: Partial<PengurusAccount>): { success: boolean; message: string } {
    const accounts = this.getPengurusAccounts();
    const index = accounts.findIndex(a => a.id === id);
    if (index === -1) {
      return { success: false, message: 'Akun pengurus tidak ditemukan.' };
    }

    const current = accounts[index];

    // Check username uniqueness if changed
    if (updates.username && updates.username.toLowerCase() !== current.username.toLowerCase()) {
      const cleanUsername = updates.username.trim().toLowerCase().replace(/\s+/g, '_');
      if (accounts.some(a => a.id !== id && a.username.toLowerCase() === cleanUsername)) {
        return { success: false, message: `Username "${cleanUsername}" sudah digunakan.` };
      }
      current.username = cleanUsername;
    }

    if (updates.namaLengkap !== undefined) {
      current.namaLengkap = updates.namaLengkap.trim();
      
      // Also sync with RTConfig if this is Ketua RT or Sekretaris
      const cfg = this.getConfig();
      if (current.role === 'ADMIN_KETUA_RT') {
        cfg.namaKetuaRT = current.namaLengkap;
        this.saveConfig(cfg);
      } else if (current.role === 'ADMIN_SEKRETARIS') {
        cfg.namaSekretaris = current.namaLengkap;
        this.saveConfig(cfg);
      }
    }

    if (updates.role !== undefined) current.role = updates.role;
    if (updates.roleLabel !== undefined) current.roleLabel = updates.roleLabel.trim();
    if (updates.pinOrPassword !== undefined && updates.pinOrPassword.trim()) {
      if (updates.pinOrPassword.trim().length < 4) {
        return { success: false, message: 'Password / PIN baru minimal 4 karakter.' };
      }
      current.pinOrPassword = updates.pinOrPassword.trim();
    }
    if (updates.nomorHp !== undefined) current.nomorHp = updates.nomorHp.trim();
    if (updates.email !== undefined) current.email = updates.email.trim();
    if (updates.isActive !== undefined) current.isActive = updates.isActive;

    accounts[index] = current;
    this.savePengurusAccounts(accounts);
    this.addAuditLog('Manajemen Akun', current.namaLengkap, `Memperbarui profil/kredensial akun pengurus (${current.roleLabel})`, 'SUKSES');

    return { success: true, message: `Data akun "${current.namaLengkap}" berhasil diperbarui!` };
  }

  public deletePengurusAccount(id: string): { success: boolean; message: string } {
    const accounts = this.getPengurusAccounts();
    const account = accounts.find(a => a.id === id);
    if (!account) {
      return { success: false, message: 'Akun tidak ditemukan.' };
    }

    // Protect Ketua RT
    if (account.role === 'ADMIN_KETUA_RT') {
      return { success: false, message: 'Akun Ketua RT utama tidak dapat dihapus demi integritas sistem.' };
    }

    if (accounts.length <= 1) {
      return { success: false, message: 'Minimal harus ada 1 akun administrator tersisa.' };
    }

    const filtered = accounts.filter(a => a.id !== id);
    this.savePengurusAccounts(filtered);
    this.addAuditLog('Manajemen Akun', account.namaLengkap, `Menghapus akun pengurus ${account.roleLabel}`, 'PERINGATAN');

    return { success: true, message: `Akun "${account.namaLengkap}" (${account.roleLabel}) berhasil dihapus.` };
  }

  public updateSekretarisName(newName: string): { success: boolean; message: string } {
    const cleanName = (newName || '').trim();
    if (cleanName.length < 2) {
      return { success: false, message: 'Nama Sekretaris tidak boleh kosong.' };
    }

    // 1. Update in RTConfig
    const cfg = this.getConfig();
    cfg.namaSekretaris = cleanName;
    this.saveConfig(cfg);

    // 2. Update in PengurusAccounts
    const accounts = this.getPengurusAccounts();
    const sekreAccount = accounts.find(a => a.role === 'ADMIN_SEKRETARIS');
    if (sekreAccount) {
      sekreAccount.namaLengkap = cleanName;
      this.savePengurusAccounts(accounts);
    }

    // 3. Update active session if currently logged in as Sekretaris
    const currentUser = this.getCurrentUser();
    if (currentUser.role === 'ADMIN_SEKRETARIS') {
      currentUser.nama = `${cleanName} (Sekretaris RT 004)`;
      this.saveCurrentUser(currentUser);
    }

    this.addAuditLog('Pengaturan RT', cleanName, 'Memperbarui nama resmi Sekretaris RT 004', 'SUKSES');
    return { success: true, message: `Nama Sekretaris RT berhasil diubah menjadi "${cleanName}"!` };
  }

  public updateKetuaRTName(newName: string): { success: boolean; message: string } {
    const cleanName = (newName || '').trim();
    if (cleanName.length < 2) {
      return { success: false, message: 'Nama Ketua RT tidak boleh kosong.' };
    }

    const cfg = this.getConfig();
    cfg.namaKetuaRT = cleanName;
    this.saveConfig(cfg);

    const accounts = this.getPengurusAccounts();
    const rtAccount = accounts.find(a => a.role === 'ADMIN_KETUA_RT');
    if (rtAccount) {
      rtAccount.namaLengkap = cleanName;
      this.savePengurusAccounts(accounts);
    }

    const currentUser = this.getCurrentUser();
    if (currentUser.role === 'ADMIN_KETUA_RT') {
      currentUser.nama = `${cleanName} (Ketua RT 004)`;
      this.saveCurrentUser(currentUser);
    }

    this.addAuditLog('Pengaturan RT', cleanName, 'Memperbarui nama resmi Ketua RT 004', 'SUKSES');
    return { success: true, message: `Nama Ketua RT berhasil diubah menjadi "${cleanName}"!` };
  }

  public updateSecretariatAddress(newAddress: string): { success: boolean; message: string } {
    const cleanAddress = (newAddress || '').trim();
    if (cleanAddress.length < 5) {
      return { success: false, message: 'Alamat sekretariat tidak boleh kosong.' };
    }

    const cfg = this.getConfig();
    cfg.alamatSekretariat = cleanAddress;
    this.saveConfig(cfg);

    this.addAuditLog('Pengaturan RT', 'Sekretariat', `Memperbarui alamat sekretariat menjadi ${cleanAddress}`, 'SUKSES');
    return { success: true, message: 'Alamat Sekretariat berhasil diperbarui!' };
  }

  public updatePengurusPin(identifier: string, oldPin: string, newPin: string): { success: boolean; message: string } {
    const accounts = this.getPengurusAccounts();
    const account = accounts.find(a => a.id === identifier || a.role === identifier || a.username.toLowerCase() === identifier.toLowerCase());
    if (!account) {
      return { success: false, message: 'Akun pengurus tidak ditemukan.' };
    }

    // Verifikasi PIN lama harus sesuai dengan yang tersimpan (tanpa jalur pintas)
    const currentPin = account.pinOrPassword || '';
    if (!oldPin || oldPin.trim() !== currentPin) {
      return { success: false, message: 'PIN / Password lama tidak sesuai.' };
    }

    if (!newPin || newPin.trim().length < 4) {
      return { success: false, message: 'PIN baru minimal 4 karakter / angka.' };
    }

    account.pinOrPassword = newPin.trim();
    this.savePengurusAccounts(accounts);
    this.addAuditLog('Keamanan', account.namaLengkap, `Pembaruan PIN / Password Akun Pengurus (${account.roleLabel})`, 'SUKSES');

    return { success: true, message: `PIN / Password untuk akun ${account.namaLengkap} berhasil diperbarui!` };
  }

  public verifyLogin(roleOrIdentifier: string, pinOrPassword: string): { success: boolean; message: string; user?: CurrentUser } {
    // Check lockout first
    const lockout = this.getLockoutStatus();
    if (lockout.isLocked) {
      return {
        success: false,
        message: `Terlalu banyak percobaan login gagal. Harap tunggu ${lockout.remainingSeconds} detik lagi.`
      };
    }

    const accounts = this.getPengurusAccounts();
    const account = accounts.find(a => 
      a.id === roleOrIdentifier || 
      a.role === roleOrIdentifier || 
      a.username.toLowerCase() === (roleOrIdentifier || '').toLowerCase()
    );

    const config = this.getConfig();
    const cleanInput = (pinOrPassword || '').trim();

    // Akun harus terdaftar & aktif — tidak ada jalur pintas/bypass PIN.
    if (!account || !account.isActive) {
      this.recordFailedAttempt();
      this.addAuditLog('Autentikasi Gagal', roleOrIdentifier, 'Percobaan login dengan akun tidak terdaftar / tidak aktif', 'PERINGATAN');
      return {
        success: false,
        message: 'Akun pengurus tidak ditemukan atau sedang tidak aktif.'
      };
    }

    if (!cleanInput || cleanInput !== (account.pinOrPassword || '')) {
      this.recordFailedAttempt();
      this.addAuditLog('Autentikasi Gagal', roleOrIdentifier, 'Percobaan login dengan PIN/Password tidak valid', 'PERINGATAN');
      return {
        success: false,
        message: 'PIN / Password yang dimasukkan salah.'
      };
    }

    this.resetFailedAttempts();

    const targetRole = account?.role || (roleOrIdentifier as UserRole) || 'ADMIN_KETUA_RT';
    let userName = account?.namaLengkap;
    if (!userName) {
      if (targetRole === 'ADMIN_KETUA_RT') {
        userName = config.namaKetuaRT ? `${config.namaKetuaRT} (Ketua RT 004)` : 'Ketua RT 004';
      } else if (targetRole === 'ADMIN_SEKRETARIS') {
        userName = config.namaSekretaris ? `${config.namaSekretaris} (Sekretaris RT 004)` : 'Sekretaris RT 004';
      } else {
        userName = `${targetRole} RT 004`;
      }
    } else {
      userName = `${userName} (${account?.roleLabel || targetRole})`;
    }

    const currentUser: CurrentUser = {
      role: targetRole,
      nama: userName,
      username: account?.username || (targetRole === 'ADMIN_KETUA_RT' ? 'ketua_rt004' : 'sekretaris_rt004'),
      nomorHp: account?.nomorHp || config.kontakRT,
      email: account?.email || config.emailRT,
      isAuthenticated: true,
      isLoggedIn: true
    };

    // Update last login timestamp
    if (account) {
      const now = new Date();
      account.terakhirLogin = `${now.getDate()} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} WIB`;
      this.savePengurusAccounts(accounts);
    }

    this.saveCurrentUser(currentUser);
    this.addAuditLog('Autentikasi Sukses', userName, `Login berhasil sebagai ${account?.roleLabel || targetRole}`, 'SUKSES');

    return {
      success: true,
      message: `Login berhasil sebagai ${userName}`,
      user: currentUser
    };
  }

  // --- BRUTE FORCE LOCKOUT HANDLING ---
  public getLockoutStatus(): { isLocked: boolean; remainingSeconds: number; attempts: number } {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
      if (!data) return { isLocked: false, remainingSeconds: 0, attempts: 0 };
      const parsed = JSON.parse(data);
      const now = Date.now();
      if (parsed.lockedUntil && parsed.lockedUntil > now) {
        return {
          isLocked: true,
          remainingSeconds: Math.ceil((parsed.lockedUntil - now) / 1000),
          attempts: parsed.attempts || 0
        };
      }
      return { isLocked: false, remainingSeconds: 0, attempts: parsed.attempts || 0 };
    } catch {
      return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }
  }

  public recordFailedAttempt() {
    try {
      const current = this.getLockoutStatus();
      const newAttempts = current.attempts + 1;
      const now = Date.now();
      let lockedUntil: number | null = null;

      // Lockout for 30 seconds after 5 failed attempts
      if (newAttempts >= 5) {
        lockedUntil = now + 30000;
      }

      localStorage.setItem(STORAGE_KEYS.LOGIN_ATTEMPTS, JSON.stringify({
        attempts: newAttempts,
        lockedUntil,
        lastAttempt: now
      }));
    } catch (e) {
      console.error('Failed to record login attempt', e);
    }
  }

  public resetFailedAttempts() {
    localStorage.removeItem(STORAGE_KEYS.LOGIN_ATTEMPTS);
  }

  // --- PRIVACY (UU PDP) MASKING PREFERENCE ---
  public isPrivacyMaskEnabled(): boolean {
    const pref = localStorage.getItem(STORAGE_KEYS.PRIVACY_MASK);
    return pref !== 'false'; // Default to masked for privacy protection
  }

  public togglePrivacyMask(): boolean {
    const current = this.isPrivacyMaskEnabled();
    const next = !current;
    localStorage.setItem(STORAGE_KEYS.PRIVACY_MASK, next ? 'true' : 'false');
    this.notify();
    return next;
  }

  // --- CURRENT USER & AUTH ---
  public getCurrentUser(): CurrentUser {
    const data = localStorage.getItem(STORAGE_KEYS.USER);
    if (!data) {
      return {
        role: 'ADMIN_KETUA_RT',
        nama: 'Ketua RT 004',
        isAuthenticated: false,
        isLoggedIn: false
      };
    }
    try {
      const parsed = JSON.parse(data);
      const isAuthed = parsed.isAuthenticated === true && parsed.isLoggedIn === true;
      return {
        role: parsed.role || 'ADMIN_KETUA_RT',
        nama: parsed.nama || 'Ketua RT 004',
        isAuthenticated: isAuthed,
        isLoggedIn: isAuthed
      };
    } catch {
      return {
        role: 'ADMIN_KETUA_RT',
        nama: 'Ketua RT 004',
        isAuthenticated: false,
        isLoggedIn: false
      };
    }
  }

  public saveCurrentUser(user: CurrentUser) {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    this.notify();
  }

  public setCurrentUser(user: CurrentUser) {
    this.saveCurrentUser(user);
  }

  public logout(): void {
    const current = this.getCurrentUser();
    this.saveCurrentUser({
      ...current,
      isAuthenticated: false,
      isLoggedIn: false
    });
  }

  // --- CONFIG ---
  public getConfig(): RTConfig {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!data) return initialRTConfig;
    try {
      const storedConfig = JSON.parse(data) as Partial<RTConfig>;

      // Migrate only the former built-in wording; preserve administrator custom text.
      if (storedConfig.kopInstansiAtas === 'PEMERINTAHAN KABUPATEN BEKASI') {
        storedConfig.kopInstansiAtas = 'PEMERINTAH KABUPATEN BEKASI';
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(storedConfig));
      }

      return { ...initialRTConfig, ...storedConfig };
    } catch {
      return initialRTConfig;
    }
  }

  public getRTConfig(): RTConfig {
    return this.getConfig();
  }

  public saveConfig(config: RTConfig) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    this.notify();
  }

  public saveRTConfig(config: RTConfig) {
    this.saveConfig(config);
  }

  // --- WARGA ---
  public getWargaList(): Warga[] {
    const data = localStorage.getItem(STORAGE_KEYS.WARGA);
    if (!data) return initialWargaList;
    try {
      const list: Warga[] = JSON.parse(data);
      // Ensure age flags are calculated dynamically
      return list.map(w => {
        const demo = calculateDemographics(w.tanggalLahir);
        return {
          ...w,
          isLansia: w.isLansia !== undefined ? w.isLansia : demo.isLansia,
          isBalita: w.isBalita !== undefined ? w.isBalita : demo.isBalita
        };
      });
    } catch {
      return initialWargaList;
    }
  }

  public saveWargaList(list: Warga[]) {
    localStorage.setItem(STORAGE_KEYS.WARGA, JSON.stringify(list));
    this.notify();
  }

  public saveWarga(input: Warga | Warga[]) {
    if (Array.isArray(input)) {
      this.saveWargaList(input);
    } else {
      this.upsertWarga(input);
    }
  }

  public upsertWarga(warga: Warga) {
    const list = this.getWargaList();
    const demo = calculateDemographics(warga.tanggalLahir);
    const enriched: Warga = {
      ...warga,
      isLansia: demo.isLansia,
      isBalita: demo.isBalita,
      tanggalInput: warga.tanggalInput || new Date().toISOString().split('T')[0]
    };

    const index = list.findIndex(w => w.id === warga.id || (w.nik && w.nik === warga.nik));
    if (index >= 0) {
      list[index] = { ...list[index], ...enriched };
    } else {
      list.unshift(enriched);
    }
    this.saveWargaList(list);
    this.syncKKMember(enriched);
    this.emitMutation({ type: 'WARGA_UPSERT', data: enriched });
  }

  public deleteWarga(id: string) {
    const list = this.getWargaList();
    const target = list.find(w => w.id === id);
    const updated = list.filter(w => w.id !== id);
    this.saveWargaList(updated);

    if (target) {
      this.emitMutation({ type: 'WARGA_DELETE', nik: target.nik, id: target.id });
      // Remove from KK as well
      const kkList = this.getKKList();
      const kk = kkList.find(k => k.nomorKK === target.nomorKK);
      if (kk) {
        kk.anggota = kk.anggota.filter(m => m.id !== id && m.nik !== target.nik);
        kk.tanggalUpdate = new Date().toISOString().split('T')[0];
        this.saveKKList(kkList);
      }
    }
  }

  // --- KARTU KELUARGA (KK) ---
  public getKKList(): KartuKeluarga[] {
    const data = localStorage.getItem(STORAGE_KEYS.KK);
    if (!data) return initialKartuKeluargaList;
    try {
      const kkList: KartuKeluarga[] = JSON.parse(data);
      const wargaList = this.getWargaList();
      // Ensure anggota list is aligned with latest warga items
      return kkList.map(kk => ({
        ...kk,
        anggota: wargaList.filter(w => w.nomorKK === kk.nomorKK)
      }));
    } catch {
      return initialKartuKeluargaList;
    }
  }

  public saveKKList(list: KartuKeluarga[]) {
    localStorage.setItem(STORAGE_KEYS.KK, JSON.stringify(list));
    this.notify();
  }

  public saveKK(input: KartuKeluarga | KartuKeluarga[]) {
    if (Array.isArray(input)) {
      this.saveKKList(input);
    } else {
      this.upsertKK(input);
    }
  }

  public upsertKK(kk: KartuKeluarga) {
    const kkList = this.getKKList();
    const index = kkList.findIndex(k => k.id === kk.id || k.nomorKK === kk.nomorKK);
    if (index >= 0) {
      kkList[index] = { ...kkList[index], ...kk, tanggalUpdate: new Date().toISOString().split('T')[0] };
    } else {
      kkList.unshift({ ...kk, tanggalUpdate: new Date().toISOString().split('T')[0] });
    }
    this.saveKKList(kkList);
    this.emitMutation({ type: 'KK_UPSERT', data: kk });

    // Also update all anggota in warga store
    if (kk.anggota && kk.anggota.length > 0) {
      const allWarga = this.getWargaList();
      kk.anggota.forEach(member => {
        const demo = calculateDemographics(member.tanggalLahir);
        const enrichedMember: Warga = {
          ...member,
          nomorKK: kk.nomorKK,
          isLansia: demo.isLansia,
          isBalita: demo.isBalita,
          statusTinggal: kk.statusDomisili
        };
        const mIdx = allWarga.findIndex(w => w.id === member.id || (w.nik && w.nik === member.nik));
        if (mIdx >= 0) {
          allWarga[mIdx] = { ...allWarga[mIdx], ...enrichedMember };
        } else {
          allWarga.unshift(enrichedMember);
        }
      });
      this.saveWargaList(allWarga);
    }
  }

  public deleteKK(id: string) {
    const kkList = this.getKKList();
    const target = kkList.find(k => k.id === id);
    const updated = kkList.filter(k => k.id !== id);
    this.saveKKList(updated);
    if (target) {
      this.emitMutation({ type: 'KK_DELETE', nomorKK: target.nomorKK, id: target.id });
    }
  }

  private syncKKMember(warga: Warga) {
    const kkList = this.getKKList();
    const kk = kkList.find(k => k.nomorKK === warga.nomorKK);
    if (kk) {
      const memberIdx = kk.anggota.findIndex(m => m.id === warga.id || m.nik === warga.nik);
      if (memberIdx >= 0) {
        kk.anggota[memberIdx] = warga;
      } else {
        kk.anggota.push(warga);
      }
      if (warga.statusHubunganKK === 'KEPALA KELUARGA') {
        kk.kepalaKeluargaNama = warga.nama;
        kk.kepalaKeluargaNik = warga.nik;
      }
      kk.tanggalUpdate = new Date().toISOString().split('T')[0];
      this.saveKKList(kkList);
    }
  }

  // --- SURAT PENGANTAR ---
  public getSuratList(): SuratPengantar[] {
    const data = localStorage.getItem(STORAGE_KEYS.SURAT);
    if (!data) return initialSuratPengantarList;
    try {
      return JSON.parse(data);
    } catch {
      return initialSuratPengantarList;
    }
  }

  public saveSurat(list: SuratPengantar[]) {
    localStorage.setItem(STORAGE_KEYS.SURAT, JSON.stringify(list));
    this.notify();
  }

  public addSurat(surat: any): SuratPengantar {
    const list = this.getSuratList();
    const config = this.getConfig();
    const currentYear = new Date().getFullYear();
    
    // Auto generate next sequence number or use custom provided
    const nextSeq = (list.length + 1).toString();
    const nomorSurat = surat.nomorSurat || `${nextSeq} / RT ${config.namaRT || '004'} RW ${config.namaRW || '007'} / SP / ${currentYear}`;
    const qrCode = surat.kodeVerifikasiQr || `VERIF-RT04-RW07-${Date.now().toString(36).toUpperCase()}-${nextSeq}`;

    const newSurat: SuratPengantar = {
      ...surat,
      id: surat.id || `sp-${Date.now()}`,
      nomorSurat,
      kodeVerifikasiQr: qrCode,
      tanggalPengajuan: surat.tanggalPengajuan || new Date().toISOString().split('T')[0],
      status: surat.status || 'DISETUJUI',
      namaPejabatTtd: surat.namaPejabatTtd || config.namaKetuaRT || 'Ketua RT 004',
      jabatanTtd: surat.jabatanTtd || `Ketua RT ${config.namaRT || '004'}`,
      namaKetuaRT: surat.namaKetuaRT || config.namaKetuaRT || 'Ketua RT 004',
      namaKetuaRW: surat.namaKetuaRW || config.namaKetuaRW || 'Ketua RW 007',
      dibuatOleh: surat.dibuatOleh || 'ADMIN'
    };

    list.unshift(newSurat);
    this.saveSurat(list);
    this.emitMutation({ type: 'SURAT_UPSERT', data: newSurat });

    // Create notification if submitted by warga
    if (newSurat.dibuatOleh === 'WARGA' || newSurat.status === 'PENDING') {
      this.addNotifikasi({
        judul: `Permohonan ${newSurat.judulSurat}`,
        pesan: `${newSurat.namaPemohon} mengajukan surat pengantar untuk: ${newSurat.keperluan}`,
        tipe: 'SURAT_BARU',
        dibaca: false,
        linkTab: 'surat',
        entityId: newSurat.id,
        suratId: newSurat.id
      });
    }

    return newSurat;
  }

  public updateSuratStatus(id: string, status: 'DISETUJUI' | 'DITOLAK', alasan?: string) {
    const list = this.getSuratList();
    const item = list.find(s => s.id === id);
    if (item) {
      item.status = status;
      if (status === 'DISETUJUI') {
        item.tanggalDisetujui = new Date().toISOString().split('T')[0];
        item.alasanPenolakan = undefined;
      } else if (status === 'DITOLAK') {
        item.alasanPenolakan = alasan || 'Dokumen/persyaratan belum memenuhi standar RT 004.';
      }
      this.saveSurat(list);
      this.emitMutation({ type: 'SURAT_UPSERT', data: item });

      // Notification
      this.addNotifikasi({
        judul: `Status Surat ${status === 'DISETUJUI' ? 'Disetujui' : 'Ditolak'}: ${item.namaPemohon}`,
        pesan: `Surat nomor ${item.nomorSurat} (${item.judulSurat}) telah ${status.toLowerCase()} oleh Pengurus RT.`,
        tipe: 'SURAT_BARU',
        dibaca: false,
        linkTab: 'surat',
        entityId: item.id,
        suratId: item.id
      });
    }
  }

  public deleteSurat(id: string) {
    const list = this.getSuratList();
    this.saveSurat(list.filter(s => s.id !== id));
    this.emitMutation({ type: 'SURAT_DELETE', id });
  }

  // --- MUTASI PENDUDUK ---
  public getMutasiList(): MutasiPenduduk[] {
    const data = localStorage.getItem(STORAGE_KEYS.MUTASI);
    if (!data) return initialMutasiList;
    try {
      return JSON.parse(data);
    } catch {
      return initialMutasiList;
    }
  }

  public saveMutasi(list: MutasiPenduduk[]) {
    localStorage.setItem(STORAGE_KEYS.MUTASI, JSON.stringify(list));
    this.notify();
  }

  public addMutasi(mutasi: MutasiPenduduk): MutasiPenduduk {
    const list = this.getMutasiList();
    const newMutasi: MutasiPenduduk = {
      ...mutasi,
      id: mutasi.id || `mut-${Date.now()}`
    };
    list.unshift(newMutasi);
    this.saveMutasi(list);
    this.emitMutation({ type: 'MUTASI_ADD', data: newMutasi });

    // Auto update citizen / KK status if relevant
    const citizenNik = mutasi.nik || mutasi.nikWarga;
    const wargaList = this.getWargaList();
    const targetWarga = wargaList.find(w => w.nik === citizenNik);
    if (targetWarga) {
      if (mutasi.jenisMutasi === 'PINDAH_KELUAR') {
        targetWarga.statusTinggal = 'PINDAH_KELUAR';
      } else if (mutasi.jenisMutasi === 'KEMATIAN') {
        targetWarga.statusTinggal = 'MENINGGAL';
      }
      this.saveWargaList(wargaList);
    }

    this.addNotifikasi({
      judul: `Pencatatan Mutasi: ${mutasi.jenisMutasi.replace('_', ' ')}`,
      pesan: `Pencatatan mutasi warga ${mutasi.namaWarga} berhasil disimpan.`,
      tipe: 'MUTASI',
      dibaca: false,
      linkTab: 'mutasi',
      entityId: newMutasi.id
    });

    return newMutasi;
  }

  public deleteMutasi(id: string) {
    const list = this.getMutasiList();
    this.saveMutasi(list.filter(m => m.id !== id));
    // Pancarkan event agar baris mutasi juga terhapus di Supabase (bukan hanya lokal)
    this.emitMutation({ type: 'MUTASI_DELETE', id });
  }

  // --- NOTIFIKASI ---
  public getNotifikasiList(): Notifikasi[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIF);
    if (!data) return initialNotifikasiList;
    try {
      return JSON.parse(data);
    } catch {
      return initialNotifikasiList;
    }
  }

  public getNotifications(): Notifikasi[] {
    return this.getNotifikasiList();
  }

  public saveNotifikasi(list: Notifikasi[]) {
    localStorage.setItem(STORAGE_KEYS.NOTIF, JSON.stringify(list));
    this.notify();
  }

  public addNotifikasi(notif: Omit<Notifikasi, 'id' | 'timestamp'>) {
    const list = this.getNotifikasiList();
    const now = new Date();
    const timeString = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} WIB`;
    const newNotif: Notifikasi = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: timeString
    };
    list.unshift(newNotif);
    this.saveNotifikasi(list);
  }

  public markNotifikasiRead(id: string) {
    const list = this.getNotifikasiList();
    const item = list.find(n => n.id === id);
    if (item) {
      item.dibaca = true;
      this.saveNotifikasi(list);
    }
  }

  public markNotificationAsRead(id: string) {
    this.markNotifikasiRead(id);
  }

  public markAllNotifikasiRead() {
    const list = this.getNotifikasiList().map(n => ({ ...n, dibaca: true }));
    this.saveNotifikasi(list);
  }

  public clearAllNotifikasi() {
    this.saveNotifikasi([]);
  }

  public clearNotifications() {
    this.clearAllNotifikasi();
  }

  // --- SPREADSHEET / EXCEL EXPORT & IMPORT ---
  // Metode-metode di bagian ini `async` karena pustaka `xlsx` dimuat saat dipakai
  // (lihat loadXlsx di atas), bukan karena ada I/O yang lambat.
  public async exportToExcel(): Promise<void> {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();

    // 1. Sheet Data Warga
    const wargaList = this.getWargaList();
    const wargaRows = wargaList.map((w, idx) => {
      const demo = calculateDemographics(w.tanggalLahir);
      return {
        No: idx + 1,
        NIK: `'${w.nik}`,
        'Nomor KK': `'${w.nomorKK}`,
        'Nama Lengkap': w.nama,
        'Jenis Kelamin': w.jenisKelamin === 'L' ? 'Laki-Laki' : 'Perempuan',
        'Tempat Lahir': w.tempatLahir,
        'Tanggal Lahir': formatDateDDMMYYYY(w.tanggalLahir),
        'Usia (Tahun)': demo.usia,
        Agama: w.agama,
        Pendidikan: w.pendidikan,
        Pekerjaan: w.pekerjaan,
        'Status Perkawinan': w.statusPerkawinan,
        'Status Hub KK': w.statusHubunganKK,
        'Gol Darah': w.golonganDarah,
        'No WhatsApp/HP': w.nomorHp,
        'Status Domisili': w.statusTinggal,
        'Kategori Lansia (>=60)': demo.isLansia ? 'YA' : 'TIDAK',
        'Kategori Balita (<=5)': demo.isBalita ? 'YA' : 'TIDAK',
        'Kategori Yatim/Piatu': w.isYatim ? 'YA' : 'TIDAK',
        'Bantuan Sosial (Bansos)': w.statusBansos,
        'Keterangan Bansos': w.keteranganBansos || '-',
        'Tanggal Input': w.tanggalInput
      };
    });
    const wsWarga = XLSX.utils.json_to_sheet(wargaRows);
    XLSX.utils.book_append_sheet(wb, wsWarga, 'Data Warga RT04');

    // 2. Sheet Data Kartu Keluarga
    const kkList = this.getKKList();
    const kkRows = kkList.map((k, idx) => ({
      No: idx + 1,
      'Nomor KK': `'${k.nomorKK}`,
      'Kepala Keluarga': k.kepalaKeluargaNama,
      'NIK Kepala Keluarga': `'${k.kepalaKeluargaNik}`,
      'Alamat Rumah': k.alamat,
      'Blok/No Rumah': k.blokRumah,
      'RT/RW': `${k.rt}/${k.rw}`,
      'Status Domisili': k.statusDomisili,
      'Jumlah Anggota': k.anggota?.length || 0,
      'Tanggal Terbit': k.tanggalTerbit,
      Catatan: k.catatan || '-'
    }));
    const wsKK = XLSX.utils.json_to_sheet(kkRows);
    XLSX.utils.book_append_sheet(wb, wsKK, 'Data Kartu Keluarga');

    // 3. Sheet Penerima Bansos & Kelompok Prioritas
    const bansosRows = wargaList
      .filter(w => w.statusBansos !== 'TIDAK_ADA' || w.isLansia || w.isBalita || w.isYatim)
      .map((w, idx) => {
        const demo = calculateDemographics(w.tanggalLahir);
        return {
          No: idx + 1,
          'Nama Penerima': w.nama,
          NIK: `'${w.nik}`,
          'Nomor KK': `'${w.nomorKK}`,
          'Status Hub KK': w.statusHubunganKK,
          Usia: demo.usia,
          'Status Tinggal': w.statusTinggal,
          'Kategori Prioritas': [
            demo.isLansia ? 'Lansia' : null,
            demo.isBalita ? 'Balita' : null,
            w.isYatim ? 'Anak Yatim' : null,
            w.statusTinggal === 'KONTRAK' ? 'Pengontrak' : null
          ].filter(Boolean).join(', ') || 'Warga Umum',
          'Jenis Bansos Terdaftar': w.statusBansos,
          'Keterangan / Catatan': w.keteranganBansos || w.catatan || 'Layak Distribusi',
          'No HP/WA': w.nomorHp
        };
      });
    const wsBansos = XLSX.utils.json_to_sheet(bansosRows);
    XLSX.utils.book_append_sheet(wb, wsBansos, 'Kelompok Bansos & Prioritas');

    // 4. Sheet Surat Pengantar
    const suratList = this.getSuratList();
    const suratRows = suratList.map((s, idx) => ({
      No: idx + 1,
      'Nomor Surat': s.nomorSurat,
      'Jenis Surat': s.jenisSurat,
      'Judul Surat': s.judulSurat,
      'Nama Pemohon': s.namaPemohon,
      'NIK Pemohon': `'${s.nikPemohon}`,
      Keperluan: s.keperluan,
      'Tgl Pengajuan': s.tanggalPengajuan,
      'Tgl Disetujui': s.tanggalDisetujui || '-',
      Status: s.status,
      'Kode Validasi QR': s.kodeVerifikasiQr
    }));
    const wsSurat = XLSX.utils.json_to_sheet(suratRows);
    XLSX.utils.book_append_sheet(wb, wsSurat, 'Arsip Surat Pengantar');

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Data_Kependudukan_RT004_RW007_Jatimulya_${dateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // --- TEMPLATES SURAT ---
  public getTemplates(): SuratTemplate[] {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!data) return initialTemplates;
    try {
      const list: SuratTemplate[] = JSON.parse(data);
      // If user had multiple old templates, clean and keep only the official one
      if (list.length > 1 || !list.some(t => t.id === 'tpl-pengantar-resmi')) {
        this.saveTemplates(initialTemplates);
        return initialTemplates;
      }
      return list;
    } catch {
      return initialTemplates;
    }
  }

  public saveTemplates(templates: SuratTemplate[]) {
    localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
    this.notify();
  }

  public saveTemplate(template: SuratTemplate) {
    const list = this.getTemplates();
    const idx = list.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      list[idx] = template;
    } else {
      list.push(template);
    }
    this.saveTemplates(list);
    this.addAuditLog('Pembaruan Template Surat', template.nama, `Menyimpan template surat: ${template.judulSurat}`);
  }

  public deleteTemplate(id: string) {
    const list = this.getTemplates().filter(t => t.id !== id);
    this.saveTemplates(list);
    this.addAuditLog('Hapus Template Surat', id, 'Menghapus template surat kustom');
  }

  public resetTemplates() {
    this.saveTemplates(initialTemplates);
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    const data = localStorage.getItem(STORAGE_KEYS.AUDIT);
    if (!data) return initialAuditLogs;
    try {
      return JSON.parse(data);
    } catch {
      return initialAuditLogs;
    }
  }

  public saveAuditLogs(logs: AuditLog[]) {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(logs));
    this.notify();
  }

  public addAuditLog(
    aktivitas: string,
    target: string,
    detail: string,
    status: 'SUKSES' | 'GAGAL' | 'PERINGATAN' = 'SUKSES'
  ) {
    const logs = this.getAuditLogs();
    const currentUser = this.getCurrentUser();
    const now = new Date();
    const timeString = `${now.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'][now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} WIB`;

    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timeString,
      adminNama: currentUser.nama || 'Admin RT',
      adminRole: currentUser.role || 'ADMIN_RT',
      aktivitas,
      target,
      detail,
      status
    };

    logs.unshift(newLog);
    // Keep max 200 logs
    this.saveAuditLogs(logs.slice(0, 200));
  }

  public clearAuditLogs() {
    this.saveAuditLogs([]);
  }

  // --- AUTO INCREMENT NOMOR SURAT RESMI ---
  public getNextNomorSurat(jenis: string = 'SP'): string {
    const config = this.getConfig();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Roman numerals for months
    const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    const romanMonth = romanMonths[currentMonth - 1];

    let counter = config.nomorSuratCounter || 44;
    let savedYear = config.tahunSuratCounter || currentYear;

    // Reset if new year
    if (savedYear !== currentYear) {
      counter = 1;
      savedYear = currentYear;
    } else {
      counter += 1;
    }

    // Save updated counter
    this.saveConfig({
      ...config,
      nomorSuratCounter: counter,
      tahunSuratCounter: savedYear
    });

    const paddedCounter = counter.toString().padStart(3, '0');
    return `${paddedCounter}/SP-RT${config.namaRT}/RW${config.namaRW}/JTM/${romanMonth}/${currentYear}`;
  }

  // --- PEMBERSIHAN DATABASE ---
  /**
   * Data demo sudah dihapus permanen dari initialData.ts, sehingga tidak ada
   * lagi data contoh yang perlu dideteksi. Dipertahankan agar API tetap stabil.
   */
  public isDummyDataActive(): boolean {
    return false;
  }

  public clearAllData() {
    localStorage.setItem(STORAGE_KEYS.WARGA, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.KK, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SURAT, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.MUTASI, JSON.stringify([]));
    localStorage.setItem('sip_rt004_dummy_cleared', 'true');
    this.addAuditLog(
      'Pembersihan Database',
      'Seluruh Data Kependudukan',
      'Database warga, kartu keluarga, surat, dan mutasi telah dikosongkan.'
    );
    this.notify();
  }

  /** Alias lama agar pemanggil yang sudah ada tetap berfungsi. */
  public clearAllDummyData() {
    this.clearAllData();
  }

  // --- ANALYZE WORKBOOK DATA (ROBUST MULTI-SHEET & CONTENT HEURISTIC PARSER) ---
  public async analyzeWorkbookData(
    workbook: WorkBook,
    customSheetConfigs?: Record<string, {
      role?: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE';
      startRow?: number;
      columnMapping?: SheetColumnMapping
    }>
  ): Promise<ImportAnalysisResult> {
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        totalRows: 0,
        validCount: 0,
        tanpaNikCount: 0,
        wargaTetapCount: 0,
        pengontrakCount: 0,
        lansiaCount: 0,
        duplicateInFileCount: 0,
        existingInDbCount: 0,
        invalidNikCount: 0,
        invalidKkCount: 0,
        detectedSheets: [],
        sheetsInfo: [],
        parsedRows: []
      };
    }

    const XLSX = await loadXlsx();
    const currentWarga = this.getWargaList();
    const existingNikSet = new Set(currentWarga.map(w => w.nik.trim()));
    const seenNikInFile = new Set<string>();

    let validCount = 0;
    let tanpaNikCount = 0;
    let wargaTetapCount = 0;
    let pengontrakCount = 0;
    let lansiaCount = 0;
    let balitaCount = 0;
    let duplicateInFileCount = 0;
    let existingInDbCount = 0;
    let invalidNikCount = 0;
    // CATATAN: penghitung ini tidak pernah dinaikkan di mana pun, jadi ringkasan
    // impor selalu melaporkan 0 "KK tidak valid". Dibiarkan `const` agar sifatnya
    // jujur terlihat; menambahkan validasi nomor KK adalah pekerjaan tersendiri
    // (perlu keputusan: format mana yang dianggap tidak valid) dan akan mengubah
    // angka yang dilihat pengurus, jadi tidak diselipkan di sini.
    const invalidKkCount = 0;

    const allParsedRows: ImportPreviewRow[] = [];
    const detectedSheets: string[] = workbook.SheetNames;
    const sheetsInfo: DetectedSheetInfo[] = [];

    let globalRowCounter = 1;

    // Process each sheet
    for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
      const sheetName = workbook.SheetNames[sIdx];
      const worksheet = workbook.Sheets[sheetName];
      const rawSheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        raw: false, 
        defval: '' 
      });

      if (!rawSheetData || rawSheetData.length === 0) {
        continue;
      }

      const upperSheetName = sheetName.toUpperCase().trim();
      const customConfig = customSheetConfigs?.[sheetName];

      // 1. Inferred Sheet Role
      let inferredRole: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE' = 'TETAP';
      if (customConfig?.role) {
        inferredRole = customConfig.role;
      } else {
        if (
          upperSheetName.includes('PENGONTRAK') || 
          upperSheetName.includes('TIDAK TETAP') || 
          upperSheetName.includes('KONTRAK') || 
          upperSheetName.includes('KOST') || 
          upperSheetName.includes('KOS')
        ) {
          inferredRole = 'KONTRAK';
        } else if (
          upperSheetName.includes('LANSIA') || 
          upperSheetName.includes('VAKSIN')
        ) {
          inferredRole = 'LANSIA';
        } else {
          // Default to TETAP (Warga Tetap) for Sheet1, Data Warga Tetap, Warga, KK, etc.
          inferredRole = 'TETAP';
        }
      }

      if (inferredRole === 'IGNORE') {
        sheetsInfo.push({
          sheetIndex: sIdx,
          name: sheetName,
          totalRawRows: rawSheetData.length,
          headerRowIdx: 0,
          startDataRow: 1,
          headers: [],
          sampleRows: rawSheetData.slice(0, 5),
          inferredRole: 'IGNORE',
          columnMapping: {},
          parsedRowCount: 0
        });
        continue;
      }

      // 2. Scan Header Rows (Find single or merged header rows across first 25 rows)
      let headerRowIdx = -1;
      let lastHeaderRowIdx = -1;
      const detectedHeaderRows: number[] = [];

      for (let r = 0; r < Math.min(25, rawSheetData.length); r++) {
        const row = rawSheetData[r];
        if (!row || !Array.isArray(row)) continue;
        const rowStr = row.map(c => String(c || '').toUpperCase().trim()).join(' | ');

        const hasNama = rowStr.includes('NAMA') || rowStr.includes('WARGA');
        const hasNikOrKK = rowStr.includes('NIK') || rowStr.includes('NO KK') || rowStr.includes('NO. KK') || rowStr.includes('NO NIK') || rowStr.includes('NO KELUARGA') || rowStr.includes('NO KTP');
        const hasVaksin = rowStr.includes('FASKES') || rowStr.includes('VAKSIN') || rowStr.includes('DOSIS');
        const hasTTL = rowStr.includes('TTL') || rowStr.includes('TANGGAL LAHIR') || rowStr.includes('TGL LAHIR') || rowStr.includes('TEMPAT');
        const hasJK = rowStr.includes('JK') || rowStr.includes('JENIS KELAMIN') || rowStr.includes('L/P');
        const hasAlamat = rowStr.includes('ALAMAT') || rowStr.includes('DOMISILI') || rowStr.includes('NO RM') || rowStr.includes('NO RUMAH');

        if ((hasNama && (hasNikOrKK || hasTTL || hasJK)) || (hasNikOrKK && (hasTTL || hasAlamat)) || hasVaksin) {
          if (headerRowIdx === -1) headerRowIdx = r;
          lastHeaderRowIdx = r;
          detectedHeaderRows.push(r);
        }
      }

      // Determine max columns in this sheet
      let maxCols = 0;
      for (let r = 0; r < Math.min(50, rawSheetData.length); r++) {
        if (rawSheetData[r] && rawSheetData[r].length > maxCols) {
          maxCols = rawSheetData[r].length;
        }
      }

      // Build composite header strings for each column
      const compositeHeaders: string[] = new Array(maxCols).fill('');
      if (detectedHeaderRows.length > 0) {
        for (let c = 0; c < maxCols; c++) {
          const parts: string[] = [];
          for (const hRow of detectedHeaderRows) {
            const val = String(rawSheetData[hRow]?.[c] || '').trim();
            if (val && !parts.includes(val)) parts.push(val);
          }
          compositeHeaders[c] = parts.join(' ').trim();
        }
      }

      // Determine startDataRow
      let startDataRow = 0;
      if (customConfig?.startRow !== undefined) {
        startDataRow = customConfig.startRow;
      } else if (lastHeaderRowIdx >= 0) {
        startDataRow = lastHeaderRowIdx + 1;
      } else {
        // Fallback heuristic: find first row where a cell has 16 digits or looks like a person's name
        for (let r = 0; r < Math.min(15, rawSheetData.length); r++) {
          const row = rawSheetData[r];
          if (!row) continue;
          const has16Digit = row.some(cell => this.cleanIdNumber(cell).length === 16);
          if (has16Digit) {
            startDataRow = r;
            break;
          }
        }
      }

      // 3. Detect Column Mapping (by Header Names + Content Heuristics)
      const mapping: SheetColumnMapping = customConfig?.columnMapping ? { ...customConfig.columnMapping } : {};

      // Detect NO KELUARGA / NO URUT
      if (mapping.noKeluargaCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase().trim();
          if (
            h.includes('NO KELUARGA') || 
            h.includes('NO. KELUARGA') || 
            h.includes('NO KEL') || 
            h.includes('NO. KEL') || 
            h.includes('KELUARGA KE') || 
            h === 'KELUARGA' ||
            h === 'NO_KELUARGA' ||
            h === 'NO' ||
            h === 'NO.' ||
            h === 'NOMOR' ||
            h === 'NO URUT' ||
            h === 'NO. URUT'
          ) {
            mapping.noKeluargaCol = c;
            break;
          }
        }
      }

      // Detect combined "NO NIK / KK", "NIK / KK", "NO NIK/KK", or dedicated NO KK
      let combinedNikKkCol: number | undefined = undefined;
      for (let c = 0; c < maxCols; c++) {
        const h = (compositeHeaders[c] || '').toUpperCase().trim();
        if (
          h.includes('NIK / KK') || 
          h.includes('NIK/KK') || 
          h.includes('NO NIK / KK') || 
          h.includes('NO. NIK / KK') || 
          h.includes('NO NIK/KK') || 
          h.includes('NO. NIK/KK') || 
          h.includes('NIK DAN KK') || 
          h.includes('NIK & KK')
        ) {
          combinedNikKkCol = c;
          break;
        }
      }

      // Detect NO KK (Prioritize explicit KK header and ensure no collision with NIK or NO KELUARGA)
      if (mapping.kkCol === undefined) {
        if (combinedNikKkCol !== undefined) {
          mapping.kkCol = combinedNikKkCol;
        } else {
          for (let c = 0; c < maxCols; c++) {
            const h = (compositeHeaders[c] || '').toUpperCase();
            if (
              (h.includes('NO KK') || h.includes('NO. KK') || h.includes('NOMOR KK') || h.includes('NO.KK') || h.includes('KARTU KELUARGA') || h === 'KK' || h === 'NO_KK') &&
              !h.includes('NO KELUARGA') && !h.includes('KELUARGA KE')
            ) {
              mapping.kkCol = c;
              break;
            }
          }
        }
      }

      // Detect NIK (KTP)
      if (mapping.nikCol === undefined) {
        if (combinedNikKkCol !== undefined) {
          mapping.nikCol = combinedNikKkCol;
        } else {
          for (let c = 0; c < maxCols; c++) {
            const h = (compositeHeaders[c] || '').toUpperCase();
            if (
              (h.includes('NIK') || h.includes('NO KTP') || h.includes('NO. KTP') || h.includes('KTP') || h.includes('NO NIK') || h.includes('NO. NIK')) &&
              !h.includes('NO KK') && !h.includes('NO. KK') && h !== 'KK'
            ) {
              mapping.nikCol = c;
              break;
            }
          }
        }
      }

      // Detect NAMA LENGKAP
      if (mapping.namaCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (h.includes('NAMA') || h.includes('WARGA')) {
            mapping.namaCol = c;
            break;
          }
        }
      }

      // Detect JK (Jenis Kelamin)
      if (mapping.jkCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (h === 'JK' || h.includes('JENIS KELAMIN') || h.includes('L/P') || h === 'SEX' || h === 'J K') {
            mapping.jkCol = c;
            break;
          }
        }
      }

      // Detect TTL / TANGGAL LAHIR
      if (mapping.ttlCol === undefined && mapping.tglLahirCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (
            h.includes('TANGGAL LAHIR') || 
            h.includes('TGL LAHIR') || 
            h.includes('TGL. LAHIR') || 
            h.includes('TANGGAL_LAHIR') || 
            h.includes('TTL') || 
            h.includes('TEMPAT TANGGAL') || 
            h.includes('TEMPAT/TGL') || 
            h.includes('TEMPAT TGL') ||
            h.includes('DOB') ||
            h.includes('BIRTH') ||
            h.includes('LAHIR') ||
            h === 'TANGGAL' ||
            h === 'TGL'
          ) {
            mapping.ttlCol = c;
            mapping.tglLahirCol = c;
            break;
          }
        }
      }

      // Detect NO HP / WHATSAPP
      if (mapping.noHpCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (
            h.includes('NO HP') || 
            h.includes('NO. HP') || 
            h.includes('NOMOR HP') || 
            h.includes('NO TELP') || 
            h.includes('NO. TELP') || 
            h.includes('TELEPON') || 
            h.includes('TELP') || 
            h.includes('HP') || 
            h.includes('WHATSAPP') || 
            h.includes('WA')
          ) {
            mapping.noHpCol = c;
            break;
          }
        }
      }

      // Detect NO RM / RUMAH
      if (mapping.noRmCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (
            h.includes('NO RM') || 
            h.includes('NO. RM') || 
            h.includes('NO RUMAH') || 
            h.includes('NO. RUMAH') || 
            h.includes('BLOK') || 
            h === 'RM' || 
            h === 'NO_RM'
          ) {
            mapping.noRmCol = c;
            break;
          }
        }
      }

      // Detect ALAMAT
      if (mapping.alamatCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (h.includes('ALAMAT') || h.includes('DOMISILI') || h.includes('TEMPAT TINGGAL') || h.includes('JALAN')) {
            mapping.alamatCol = c;
            break;
          }
        }
      }

      // Detect KETERANGAN
      if (mapping.ketCol === undefined) {
        for (let c = 0; c < maxCols; c++) {
          const h = (compositeHeaders[c] || '').toUpperCase();
          if (h.includes('KETERANGAN') || h.includes('CATATAN') || h.includes('KET') || h.includes('STATUS')) {
            mapping.ketCol = c;
            break;
          }
        }
      }

      // 3.1 Content-Based Heuristic Fallback (Especially for Copy-Paste or Unlabeled Columns)
      const sampleRows = rawSheetData.slice(startDataRow, startDataRow + 10);
      const sixteenDigitCols: number[] = [];

      for (let c = 0; c < maxCols; c++) {
        let count16 = 0;
        let countName = 0;
        let countJk = 0;
        let countHp = 0;

        for (const row of sampleRows) {
          const rawCell = row[c];
          const cleanNum = this.cleanIdNumber(rawCell);
          if (cleanNum.length === 16) count16++;

          const valStr = String(rawCell || '').trim();
          if (/^[A-Za-z\s.,'-]{3,50}$/.test(valStr) && !/^\d+$/.test(valStr) && valStr.length > 2) {
            const u = valStr.toUpperCase();
            if (!['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDHA', 'KAWIN', 'BELUM KAWIN', 'TETAP', 'KONTRAK', 'LAKI-LAKI', 'PEREMPUAN', 'L', 'P', 'WNI', 'SLTA', 'DIPLOMA', 'SARJANA'].includes(u)) {
              countName++;
            }
          }

          if (['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(valStr.toUpperCase())) {
            countJk++;
          }

          if (/^(08|62|\+62)\d{7,13}$/.test(cleanNum) || /^08\d{2}[-\s]?\d{4}[-\s]?\d{3,5}$/.test(valStr)) {
            countHp++;
          }
        }

        if (count16 >= 1 && !sixteenDigitCols.includes(c)) {
          sixteenDigitCols.push(c);
        }

        if (mapping.namaCol === undefined && countName >= 2) {
          mapping.namaCol = c;
        }

        if (mapping.jkCol === undefined && countJk >= 2) {
          mapping.jkCol = c;
        }

        if (mapping.noHpCol === undefined && countHp >= 1) {
          mapping.noHpCol = c;
        }
      }

      // If we found two 16-digit columns and mapping is missing, 1st is NO KK, 2nd is NIK (Standard Indonesian RT Layout)
      if (sixteenDigitCols.length >= 2) {
        if (mapping.kkCol === undefined) mapping.kkCol = sixteenDigitCols[0];
        if (mapping.nikCol === undefined) mapping.nikCol = sixteenDigitCols[1];
      } else if (sixteenDigitCols.length === 1) {
        if (mapping.nikCol === undefined && mapping.kkCol !== sixteenDigitCols[0]) {
          mapping.nikCol = sixteenDigitCols[0];
        } else if (mapping.kkCol === undefined && mapping.nikCol !== sixteenDigitCols[0]) {
          mapping.kkCol = sixteenDigitCols[0];
        }
      }

      // Standard 5-Column Format Detection (NO, NAMA LENGKAP, NO NIK / KK, TTL, KETERANGAN)
      if (maxCols === 5 && mapping.namaCol === undefined) {
        if (mapping.noKeluargaCol === undefined) mapping.noKeluargaCol = 0;
        if (mapping.namaCol === undefined) mapping.namaCol = 1;
        if (mapping.nikCol === undefined) mapping.nikCol = 2;
        if (mapping.kkCol === undefined) mapping.kkCol = 2;
        if (mapping.ttlCol === undefined) mapping.ttlCol = 3;
        if (mapping.ketCol === undefined) mapping.ketCol = 4;
      }

      // Standard Format Default Fallback if layout matches standard 9-column format
      // (NO KELUARGA=0, NO KK=1, NIK=2, NAMA=3, JK=4, TANGGAL LAHIR=5, NO HP=6, NO RM=7, ALAMAT=8)
      if (maxCols >= 5 && mapping.namaCol === undefined && mapping.nikCol === undefined) {
        if (mapping.noKeluargaCol === undefined) mapping.noKeluargaCol = 0;
        if (mapping.kkCol === undefined) mapping.kkCol = 1;
        if (mapping.nikCol === undefined) mapping.nikCol = 2;
        if (mapping.namaCol === undefined) mapping.namaCol = 3;
        if (mapping.jkCol === undefined) mapping.jkCol = 4;
        if (mapping.ttlCol === undefined) mapping.ttlCol = 5;
        if (mapping.noHpCol === undefined && maxCols > 6) mapping.noHpCol = 6;
        if (mapping.noRmCol === undefined && maxCols > 7) mapping.noRmCol = 7;
        if (mapping.alamatCol === undefined && maxCols > 8) mapping.alamatCol = 8;
      }

      // 4. Extract and parse data rows for this sheet
      let lastFamilyNo: string = '';
      let lastKK: string = '';
      let lastAlamat: string = 'RT 004 RW 007 Kel. Jatimulya';
      let lastKeteranganKontrakan: string = '';
      let sheetParsedCount = 0;

      for (let r = startDataRow; r < rawSheetData.length; r++) {
        const row = rawSheetData[r];
        if (!row || !Array.isArray(row) || row.every(cell => !cell || String(cell).trim() === '')) {
          continue;
        }

        // Helper to get cell by mapped column or header
        const getVal = (colIndex?: number): string => {
          if (colIndex !== undefined && colIndex >= 0 && row[colIndex] !== undefined) {
            return String(row[colIndex] || '').trim();
          }
          return '';
        };

        let rawNama = getVal(mapping.namaCol);
        
        // Fallback for nama if mapped column was empty on this row: scan row for first text
        if (!rawNama) {
          for (let c = 0; c < row.length; c++) {
            if (c === mapping.nikCol || c === mapping.kkCol || c === mapping.jkCol || c === mapping.noKeluargaCol) continue;
            const testVal = String(row[c] || '').trim();
            if (/^[A-Za-z\s.,'-]{3,50}$/.test(testVal)) {
              const u = testVal.toUpperCase();
              if (!['ISLAM', 'KRISTEN', 'KATOLIK', 'HINDU', 'BUDHA', 'KAWIN', 'BELUM KAWIN', 'TETAP', 'KONTRAK', 'L', 'P', 'WNI', 'SLTA', 'D3', 'S1', 'RT 004', 'BEKASI'].includes(u)) {
                rawNama = testVal;
                break;
              }
            }
          }
        }

        const upperNama = rawNama.toUpperCase();
        if (
          !rawNama || 
          upperNama.includes('DATA KEPENDUDUKAN') || 
          upperNama.includes('REKAPITULASI') || 
          upperNama.includes('DATA WARGA') || 
          upperNama.includes('NAMA LENGKAP') ||
          upperNama.includes('TOTAL') ||
          upperNama.includes('JUMLAH')
        ) {
          continue;
        }

        const rawNoKeluarga = getVal(mapping.noKeluargaCol);
        const rawNoRM = getVal(mapping.noRmCol);
        const rawNoHp = getVal(mapping.noHpCol);

        if (rawNoKeluarga) {
          lastFamilyNo = rawNoKeluarga;
        }

        let rawNik = this.cleanIdNumber(getVal(mapping.nikCol));
        let rawKK = this.cleanIdNumber(getVal(mapping.kkCol));

        // Update or inherit KK number within the same family
        if (rawKK && rawKK.length >= 10) {
          lastKK = rawKK;
        } else if (lastKK && (!rawNoKeluarga || rawNoKeluarga === lastFamilyNo || inferredRole === 'KONTRAK')) {
          rawKK = lastKK;
        }

        // If rawNik is missing but row contains another 16-digit number, capture it
        if (!rawNik) {
          for (let c = 0; c < row.length; c++) {
            if (c === mapping.kkCol) continue;
            const testDigits = this.cleanIdNumber(row[c]);
            if (testDigits.length === 16 && testDigits !== rawKK) {
              rawNik = testDigits;
              break;
            }
          }
        }

        // Keterangan
        const rawKeterangan = getVal(mapping.ketCol);
        if (rawKeterangan && (rawKeterangan.toLowerCase().includes('kontrakan') || rawKeterangan.toLowerCase().includes('kost') || rawKeterangan.toLowerCase().includes('sewa'))) {
          lastKeteranganKontrakan = rawKeterangan;
        }

        // Tanggal Lahir (detect from mapped column or search row for date)
        let rawTTL = getVal(mapping.tglLahirCol ?? mapping.ttlCol);
        if (!rawTTL || !this.isDateLike(rawTTL)) {
          // Scan row to find any cell with a date pattern
          for (let c = 0; c < row.length; c++) {
            if (c === mapping.nikCol || c === mapping.kkCol || c === mapping.namaCol || c === mapping.jkCol || c === mapping.noKeluargaCol) continue;
            const testCell = String(row[c] || '').trim();
            if (this.isDateLike(testCell)) {
              rawTTL = testCell;
              break;
            }
          }
        }
        const { tempatLahir, tanggalLahir } = this.parseTTLString(rawTTL);
        const demo = calculateDemographics(tanggalLahir);

        // JK
        let rawJK = getVal(mapping.jkCol).toUpperCase().trim();
        if (!rawJK) {
          // Check if any cell in row is L or P
          const foundJk = row.find(c => ['L', 'P', 'LAKI-LAKI', 'PEREMPUAN'].includes(String(c || '').toUpperCase().trim()));
          if (foundJk) rawJK = String(foundJk).toUpperCase().trim();
        }
        const jenisKelamin: 'L' | 'P' = (rawJK.startsWith('P') || rawJK === 'PEREMPUAN' || rawJK === 'W' || rawJK === 'WANITA') ? 'P' : 'L';

        // Alamat
        let rawAlamat = getVal(mapping.alamatCol);
        if (rawAlamat) {
          lastAlamat = rawAlamat;
        } else if (inferredRole === 'KONTRAK' && lastKeteranganKontrakan) {
          rawAlamat = `${lastKeteranganKontrakan}, RT 004 RW 007 Kel. Jatimulya`;
        } else {
          rawAlamat = lastAlamat || 'RT 004 RW 007 Kel. Jatimulya';
        }

        const tanpaNikKtp = !rawNik || rawNik === '' || rawNik === '-' || rawNik === '0';
        let finalNik = rawNik;

        let statusTinggal: 'TETAP' | 'KONTRAK' | 'KOS' = 'TETAP';
        let sheetOrigin = sheetName;

        const isLansia = demo.isLansia || (inferredRole === 'LANSIA');
        const isBalita = demo.isBalita;

        if (isLansia) {
          lansiaCount++;
        }
        if (isBalita) {
          balitaCount++;
        }

        if (inferredRole === 'LANSIA') {
          statusTinggal = 'TETAP';
          sheetOrigin = 'Data Lansia RT 004';
        } else if (inferredRole === 'KONTRAK') {
          statusTinggal = 'KONTRAK';
          sheetOrigin = 'Data Pengontrak';
          pengontrakCount++;
        } else {
          statusTinggal = 'TETAP';
          sheetOrigin = 'Data Warga Tetap';
          wargaTetapCount++;
        }

        if (tanpaNikKtp) {
          tanpaNikCount++;
          finalNik = `NONIK-${statusTinggal === 'KONTRAK' ? 'KONTRAK' : 'WARGA'}-${globalRowCounter.toString().padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
        }

        const errorMessages: string[] = [];
        if (!rawNama) {
          errorMessages.push('Nama lengkap warga tidak boleh kosong');
        }

        if (!tanpaNikKtp) {
          const isNikValidLength = rawNik.length === 16 && /^\d+$/.test(rawNik);
          if (!isNikValidLength) {
            errorMessages.push(`Format NIK ${rawNik.length} digit (standar KTP 16 digit)`);
            invalidNikCount++;
          }
        }

        let isDuplicateInFile = false;
        if (!tanpaNikKtp && rawNik) {
          if (seenNikInFile.has(rawNik)) {
            isDuplicateInFile = true;
            duplicateInFileCount++;
            errorMessages.push('Duplikat NIK terdeteksi di dalam berkas');
          } else {
            seenNikInFile.add(rawNik);
          }
        }

        const isExistingInDb = (!tanpaNikKtp && rawNik) ? existingNikSet.has(rawNik) : false;
        if (isExistingInDb) {
          existingInDbCount++;
        }

        const isValid = Boolean(rawNama && rawNama.length > 0);
        if (isValid) validCount++;

        // Status bansos memang TIDAK ditebak dari spreadsheet — kelayakan bansos
        // adalah keputusan pengurus, bukan hasil inferensi baris impor. Semua baris
        // masuk sebagai 'TIDAK_ADA' lalu ditetapkan manual di layar Prioritas Bansos.
        const bansosStr = 'TIDAK_ADA';
        let ketKhusus = '';
        if (inferredRole === 'LANSIA') {
          ketKhusus = rawKeterangan || 'Data Lansia Prioritas RT 004';
        } else if (statusTinggal === 'KONTRAK' && (rawKeterangan || lastKeteranganKontrakan)) {
          ketKhusus = rawKeterangan || lastKeteranganKontrakan;
        } else if (rawKeterangan) {
          ketKhusus = rawKeterangan;
        }

        const finalKK = rawKK || (lastKK || '3216060000000000');

        allParsedRows.push({
          rowNumber: globalRowCounter++,
          sheetOrigin,
          noKeluarga: rawNoKeluarga || lastFamilyNo || undefined,
          noRumah: rawNoRM || undefined,
          nik: finalNik,
          nomorKK: finalKK,
          nama: rawNama,
          jenisKelamin,
          tempatLahir: tempatLahir || 'Bekasi',
          tanggalLahir,
          agama: 'ISLAM',
          statusPerkawinan: 'KAWIN',
          statusHubunganKK: (rawNoKeluarga && rawNoKeluarga !== '') ? 'KEPALA KELUARGA' : 'ANGGOTA KELUARGA',
          pekerjaan: inferredRole === 'LANSIA' ? 'Pensiunan / Tidak Bekerja' : 'Karyawan Swasta',
          nomorHp: rawNoHp || '-',
          statusTinggal,
          alamat: rawAlamat,
          bansos: bansosStr,
          keteranganKhusus: ketKhusus,
          tanpaNikKtp,
          isLansia,
          isBalita,
          usia: demo.usia,
          isValid,
          isDuplicateInFile,
          isExistingInDb,
          errorMessages
        });

        sheetParsedCount++;
      }

      sheetsInfo.push({
        sheetIndex: sIdx,
        name: sheetName,
        totalRawRows: rawSheetData.length,
        headerRowIdx: headerRowIdx >= 0 ? headerRowIdx : 0,
        startDataRow,
        headers: compositeHeaders.map((h, i) => h || `Kolom ${String.fromCharCode(65 + i)}`),
        sampleRows: rawSheetData.slice(0, 6),
        inferredRole,
        columnMapping: mapping,
        parsedRowCount: sheetParsedCount
      });
    }

    return {
      totalRows: allParsedRows.length,
      validCount,
      tanpaNikCount,
      wargaTetapCount,
      pengontrakCount,
      lansiaCount,
      balitaCount,
      duplicateInFileCount,
      existingInDbCount,
      invalidNikCount,
      invalidKkCount,
      detectedSheets,
      sheetsInfo,
      parsedRows: allParsedRows
    };
  }

  // --- ANALYZE IMPORT FILE (EXCEL / CSV) ---
  public async analyzeImportFile(
    file: File, 
    customSheetConfigs?: Record<string, { 
      role?: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE'; 
      startRow?: number; 
      columnMapping?: SheetColumnMapping 
    }>
  ): Promise<ImportAnalysisResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await loadXlsx();
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const result = await this.analyzeWorkbookData(workbook, customSheetConfigs);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  }

  // --- DIRECT COPY-PASTE TABULAR DATA ANALYZER ---
  public async analyzeRawTextData(
    rawText: string,
    defaultRole: 'TETAP' | 'KONTRAK' | 'LANSIA' = 'TETAP',
    sheetName: string = 'Spreadsheet Salinan',
    customSheetConfigs?: Record<string, {
      role?: 'TETAP' | 'KONTRAK' | 'LANSIA' | 'IGNORE';
      startRow?: number;
      columnMapping?: SheetColumnMapping
    }>
  ): Promise<ImportAnalysisResult> {
    if (!rawText || rawText.trim() === '') {
      return {
        totalRows: 0,
        validCount: 0,
        tanpaNikCount: 0,
        wargaTetapCount: 0,
        pengontrakCount: 0,
        lansiaCount: 0,
        balitaCount: 0,
        duplicateInFileCount: 0,
        existingInDbCount: 0,
        invalidNikCount: 0,
        invalidKkCount: 0,
        detectedSheets: [],
        sheetsInfo: [],
        parsedRows: []
      };
    }

    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      return this.analyzeWorkbookData({ SheetNames: [], Sheets: {} });
    }

    // Determine delimiter (Tab, Pipe, Semicolon, or Comma)
    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes('|')) {
      delimiter = '|';
    } else if (firstLine.includes(';') && (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0)) {
      delimiter = ';';
    } else if (firstLine.includes(',')) {
      delimiter = ',';
    }

    const gridData: any[][] = lines.map(line => {
      // Split and strip wrapping quotes
      return line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    });

    const XLSX = await loadXlsx();
    const worksheet = XLSX.utils.aoa_to_sheet(gridData);
    const workbook: WorkBook = {
      SheetNames: [sheetName],
      Sheets: { [sheetName]: worksheet }
    };

    const configs = customSheetConfigs && Object.keys(customSheetConfigs).length > 0 
      ? customSheetConfigs 
      : { [sheetName]: { role: defaultRole } };

    return this.analyzeWorkbookData(workbook, configs);
  }

  // --- FETCH GOOGLE SHEETS VIA LINK ---
  public async fetchGoogleSheetData(
    sheetUrl: string,
    defaultRole: 'TETAP' | 'KONTRAK' | 'LANSIA' = 'TETAP'
  ): Promise<ImportAnalysisResult> {
    let cleanUrl = sheetUrl.trim();

    // Convert standard Google Docs spreadsheet URL to export CSV URL
    const match = cleanUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      const sheetId = match[1];
      const gidMatch = cleanUrl.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      cleanUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    }

    const response = await fetch(cleanUrl);
    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari Google Sheets (${response.status} ${response.statusText}). Pastikan tautan Google Sheets berstatus Publik / Dapat dilihat siapa saja dengan tautan.`);
    }

    const csvText = await response.text();
    return this.analyzeRawTextData(csvText, defaultRole, 'Google Sheets Terhubung');
  }

  // Helper to check if a value looks like a date or serial
  public isDateLike(val: any): boolean {
    if (val === null || val === undefined) return false;
    const clean = String(val).trim();
    if (clean.length < 4) return false;

    // Ignore standard 16 digits NIK/KK
    if (clean.length === 16 && /^\d+$/.test(clean)) return false;

    // DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD
    if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(clean)) return true;
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(clean)) return true;

    // Indonesian month name e.g. "12 Mei 1975", "08-Agustus-1963", "Bekasi, 02-05-2000"
    if (/(jan|feb|mar|apr|mei|may|jun|jul|agu|ags|sep|okt|nov|des)/i.test(clean) && /\d{2,4}/.test(clean)) return true;
    if (/,\s*\d{1,2}/.test(clean)) return true;

    // Excel serial 1000 - 60000 (4-5 digits)
    if (/^\d{4,5}$/.test(clean)) {
      const num = parseInt(clean, 10);
      if (num >= 1000 && num <= 60000) return true;
    }

    return false;
  }

  // Helper to clean and normalize NIK/KK numbers (handles Excel scientific notation, float decimals, quotes, spaces)
  public cleanIdNumber(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    if (!str || str === '-' || str === '0') return '';

    // Remove wrapping quotes or leading apostrophes often inserted by Excel
    str = str.replace(/^['"`]+|['"`]+$/g, '').trim();

    // Exponential/Scientific notation (e.g. 3.21606030719003e+15 or 3.21606E+15)
    if (/^[0-9.]+[eE]\+[0-9]+$/i.test(str)) {
      try {
        const num = Number(str);
        if (!isNaN(num)) {
          str = BigInt(Math.floor(num)).toString();
        }
      } catch {
        // fallback
      }
    }

    // Decimal suffix from Excel float representation (e.g. 3216060307190030.0)
    if (/^\d+\.0+$/.test(str)) {
      str = str.split('.')[0];
    }

    // Strip internal spaces, hyphens, dots, or slashes
    return str.replace(/[\s\-._/]/g, '').trim();
  }

  // Helper to parse TTL string into { tempatLahir, tanggalLahir }
  public parseTTLString(ttlRaw: string, explicitTempat?: string): { tempatLahir: string; tanggalLahir: string } {
    let tempat = (explicitTempat || 'Bekasi').trim();
    let tgl = '1990-01-01';

    if (!ttlRaw || ttlRaw.trim() === '') {
      return { tempatLahir: tempat, tanggalLahir: tgl };
    }

    const clean = ttlRaw.trim();

    // Check if contains comma like "Bekasi, 08-08-1963"
    if (clean.includes(',')) {
      const parts = clean.split(',');
      tempat = parts[0].trim() || tempat;
      const datePart = parts.slice(1).join(',').trim();
      tgl = parseDateToIso(datePart);
    } else {
      // Check if matches date pattern
      const dateIso = parseDateToIso(clean);
      if (dateIso && dateIso !== '1990-01-01') {
        tgl = dateIso;
      } else {
        // Maybe "Bekasi 08-08-1963"
        const dateMatch = clean.match(/(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          tgl = parseDateToIso(dateMatch[0]);
          const prefix = clean.substring(0, dateMatch.index).trim();
          if (prefix) tempat = prefix;
        } else {
          tgl = parseDateToIso(clean);
        }
      }
    }

    return { tempatLahir: tempat, tanggalLahir: tgl };
  }

  // Helper to convert DD-MM-YYYY, DD/MM/YYYY, Indonesian date, or serial date to YYYY-MM-DD
  public formatDateToIso(dateStr: string): string {
    return parseDateToIso(dateStr);
  }

  // --- COMMIT CONFIRMED IMPORT DATA ---
  public commitImportData(
    rows: ImportPreviewRow[], 
    updateExisting: boolean = true,
    clearExistingBeforeImport: boolean = false,
    persist: boolean = true
  ): { added: number; updated: number; skipped: number; wargaList: Warga[]; kkList: KartuKeluarga[] } {
    const currentWarga = clearExistingBeforeImport ? [] : this.getWargaList();
    const currentKK = clearExistingBeforeImport ? [] : this.getKKList();
    
    let added = 0;
    let updated = 0;
    let skipped = 0;

    // Map to group families by KK number
    const kkMap = new Map<string, Warga[]>();

    rows.forEach(r => {
      const demo = calculateDemographics(r.tanggalLahir);
      const existingIdx = currentWarga.findIndex(w => w.nik === r.nik);

      const isLansia = demo.isLansia || (r.sheetOrigin === 'Data Lansia RT 004') || Boolean(r.isLansia);
      const isBalita = demo.isBalita || Boolean(r.isBalita);

      const wargaObj: Warga = {
        id: existingIdx >= 0 ? currentWarga[existingIdx].id : `w-imp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nik: r.nik,
        nomorKK: r.nomorKK,
        nama: r.nama,
        jenisKelamin: r.jenisKelamin,
        tempatLahir: r.tempatLahir,
        tanggalLahir: r.tanggalLahir,
        agama: (r.agama || 'ISLAM') as any,
        pendidikan: 'SLTA',
        pekerjaan: r.pekerjaan,
        statusPerkawinan: (r.statusPerkawinan || 'KAWIN') as any,
        statusHubunganKK: (r.statusHubunganKK || 'KEPALA KELUARGA') as any,
        kewarganegaraan: 'WNI',
        golonganDarah: '-',
        nomorHp: r.nomorHp,
        statusTinggal: r.statusTinggal,
        isLansia,
        isBalita,
        isYatim: false,
        statusBansos: (r.bansos || 'TIDAK_ADA') as any,
        keteranganBansos: r.keteranganKhusus || undefined,
        tanggalInput: new Date().toISOString().split('T')[0],
        catatan: r.tanpaNikKtp 
          ? `Warga tanpa NIK/KTP (${r.statusTinggal}). ${r.keteranganKhusus || ''}`.trim()
          : `Diimpor dari ${r.sheetOrigin || 'Excel'} (${r.statusTinggal}). ${r.keteranganKhusus || ''}`.trim()
      };

      if (existingIdx >= 0 && !r.tanpaNikKtp && !clearExistingBeforeImport) {
        if (updateExisting) {
          currentWarga[existingIdx] = { ...currentWarga[existingIdx], ...wargaObj };
          updated++;
        } else {
          skipped++;
        }
      } else {
        currentWarga.push(wargaObj);
        added++;
      }

      // Group for Kartu Keluarga synchronization (include ALL valid or generated KKs)
      const targetKK = r.nomorKK || '3216060000000000';
      if (!kkMap.has(targetKK)) {
        kkMap.set(targetKK, []);
      }
      kkMap.get(targetKK)!.push(wargaObj);
    });

    // Synchronize KK records based on imported citizens
    kkMap.forEach((members, kkNum) => {
      const headMember = members.find(m => m.statusHubunganKK === 'KEPALA KELUARGA') || members[0];
      const existingKkIdx = currentKK.findIndex(k => k.nomorKK === kkNum);

      const matchingRow = rows.find(r => r.nomorKK === kkNum);
      const noRumah = matchingRow?.noRumah || '01';
      const alamat = matchingRow?.alamat || (headMember.statusTinggal === 'KONTRAK' ? 'Kontrakan RT 004 RW 007 Kel. Jatimulya' : 'RT 004 RW 007 Kel. Jatimulya');

      const kkObj: KartuKeluarga = {
        id: existingKkIdx >= 0 ? currentKK[existingKkIdx].id : `kk-imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        nomorKK: kkNum,
        kepalaKeluargaNama: headMember ? headMember.nama : 'Kepala Keluarga RT 004',
        kepalaKeluargaNik: headMember ? headMember.nik : `321606${Date.now().toString().slice(-10)}`,
        alamat: alamat,
        rt: '004',
        rw: '007',
        kelurahan: 'Jatimulya',
        kecamatan: 'Tambun Selatan',
        kabupatenKota: 'Kabupaten Bekasi',
        provinsi: 'Jawa Barat',
        kodePos: '17510',
        statusDomisili: headMember.statusTinggal === 'KONTRAK' ? 'KONTRAK' : headMember.statusTinggal === 'KOS' ? 'KOS' : 'TETAP',
        blokRumah: noRumah,
        tanggalTerbit: new Date().toISOString().split('T')[0],
        anggota: members,
        tanggalUpdate: new Date().toISOString().split('T')[0],
        catatan: `Sinkronisasi impor spreadsheet RT 004 (${members.length} anggota)`
      };

      if (existingKkIdx >= 0) {
        currentKK[existingKkIdx] = kkObj;
      } else {
        currentKK.push(kkObj);
      }
    });

    if (persist) {
      this.saveWargaList(currentWarga);
      this.saveKKList(currentKK);
      localStorage.setItem('sip_rt004_dummy_cleared', 'true');
    }

    if (persist) {
      this.addAuditLog(
        'Impor Data Spreadsheet Excel',
        `${added} Baru, ${updated} Diperbarui`,
        `Impor data kependudukan RT 004 selesai. Total diproses: ${added + updated} warga (${rows.filter(r => r.tanpaNikKtp).length} warga belum ber-NIK diterima).`
      );
    }

    return { added, updated, skipped, wargaList: currentWarga, kkList: currentKK };
  }

    // Template hanya memuat data sintetis agar data warga tidak ikut tersebar.
  public async downloadRT004TemplateExcel(): Promise<void> {
    const XLSX = await loadXlsx();
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Data Warga Tetap
    const wsWargaTetapData = [
      ['DATA KEPENDUDUKAN WARGA TETAP RT 004 / RW 007 KEL. JATIMULYA'],
      ['Data Rekapitulasi Profil Keluarga, NIK, dan Alamat Warga Tetap'],
      [],
      ['NO KELUARGA', 'NO KK', 'NIK', 'NAMA LENGKAP', 'JK', 'TANGGAL LAHIR', 'NO HP', 'NO RM', 'ALAMAT'],
      [1, '', '', 'WARGA CONTOH 01', 'P', '01-01-1990', '', '01', 'ALAMAT CONTOH'],
      [1, '', '', 'WARGA CONTOH 02', 'L', '02-02-1991', '', '01', 'ALAMAT CONTOH']
    ];
    const wsWargaTetap = XLSX.utils.aoa_to_sheet(wsWargaTetapData);
    XLSX.utils.book_append_sheet(wb, wsWargaTetap, 'Data Warga Tetap');

    // 2. Sheet: Data Pengontrak
    const wsPengontrakData = [
      ['DATA WARGA TIDAK TETAP ATAU PENGONTRAK'],
      ['Rekapitulasi Data Gabungan & Perapihan Keterangan Tempat Tinggal'],
      [],
      ['NO', 'NAMA LENGKAP', 'NO NIK / KK', 'TANGGAL LAHIR', 'KETERANGAN'],
      [1, 'PENGONTRAK CONTOH 01', '', '01-01-1990', 'KONTRAKAN CONTOH A'],
      [2, 'PENGONTRAK CONTOH 02', '', '02-02-1991', 'KONTRAKAN CONTOH B']
    ];
    const wsPengontrak = XLSX.utils.aoa_to_sheet(wsPengontrakData);
    XLSX.utils.book_append_sheet(wb, wsPengontrak, 'Data Pengontrak');

    // 3. Sheet: Data Lansia RT 004
    const wsLansiaData = [
      ['DATA LANSIA & STATUS VAKSINASI RW 007 RT 004 KEL. JATIMULYA'],
      ['Data Pemantauan Kesehatan, Vaksinasi, dan Status Warga Lansia'],
      [],
      ['NO', 'NIK', 'NAMA LENGKAP', 'FASKES VAKSIN', 'KECAMATAN', 'SA / KELURAHAN', 'DOSIS VAKSINASI', 'JENIS VAKSIN', 'ALAMAT', 'RT', 'RW'],
      [1, '', 'LANSIA CONTOH 01', 'FASKES CONTOH', 'TAMBUN SELATAN', 'JATIMULYA', '', '', 'ALAMAT CONTOH', '004', '007']
    ];
    const wsLansia = XLSX.utils.aoa_to_sheet(wsLansiaData);
    XLSX.utils.book_append_sheet(wb, wsLansia, 'Data Lansia RT 004');

    // Trigger download
    XLSX.writeFile(wb, 'REKAPITULASI_DATA_WARGA_RT004_RW007_LENGKAP.xlsx');
  }

  // --- BACKUP & RESTORE (Google Drive / JSON Snapshot) ---

  public exportFullBackupJSON() {
    const payload = {
      version: '1.0.0',
      rt: 'RT 004 RW 007 Kelurahan Jatimulya',
      exportDate: new Date().toISOString(),
      config: this.getConfig(),
      kartuKeluarga: this.getKKList(),
      warga: this.getWargaList(),
      suratPengantar: this.getSuratList(),
      mutasi: this.getMutasiList(),
      notifikasi: this.getNotifikasiList()
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `BACKUP_SIP_RT004_JATIMULYA_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  public importFullBackupJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.config) this.saveConfig(parsed.config);
      if (parsed.warga) this.saveWargaList(parsed.warga);
      if (parsed.kartuKeluarga) this.saveKKList(parsed.kartuKeluarga);
      if (parsed.suratPengantar) this.saveSurat(parsed.suratPengantar);
      if (parsed.mutasi) this.saveMutasi(parsed.mutasi);
      if (parsed.notifikasi) this.saveNotifikasi(parsed.notifikasi);
      return true;
    } catch (e) {
      console.error('Failed to restore backup', e);
      return false;
    }
  }

  public resetToDefault() {
    this.saveConfig(initialRTConfig);
    this.saveWargaList(initialWargaList);
    this.saveKKList(initialKartuKeluargaList);
    this.saveSurat(initialSuratPengantarList);
    this.saveMutasi(initialMutasiList);
    this.saveNotifikasi(initialNotifikasiList);
  }

  public resetToInitial() {
    this.resetToDefault();
  }
}

export const storageService = new StorageService();
