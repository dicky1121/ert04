import type { Session } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';
import { storageService } from './storage';
import { authState, PengurusProfile } from './authState';
import type { CurrentUser, UserRole } from '../types';

/**
 * Layanan autentikasi berbasis Supabase Auth.
 *
 * Alur:
 * 1. Pengurus login dengan email + password akun Supabase Auth.
 * 2. Setelah sesi terbentuk, profil (role/jabatan) dibaca dari tabel
 *    `pengurus_profil` yang dilindungi RLS (hanya baris milik pengguna
 *    terautentikasi yang bisa dibaca).
 * 3. Role dari profil dipakai untuk mengisi CurrentUser di aplikasi.
 *
 * Semua akses tabel data warga kini memerlukan sesi ini karena policy RLS
 * di database membatasi akses ke `authenticated` yang punya profil aktif.
 */

const ROLE_LABELS: Record<string, string> = {
  ADMIN_KETUA_RT: 'Ketua RT 004 (Admin Utama)',
  ADMIN_SEKRETARIS: 'Sekretaris RT 004',
  BENDAHARA: 'Bendahara RT 004',
  SEKSI_KEAMANAN: 'Seksi Keamanan RT 004',
  STAF_PELAYANAN: 'Staf Pelayanan RT 004'
};

export interface AuthResult {
  success: boolean;
  message: string;
  user?: CurrentUser;
  needsProfile?: boolean;
}

class AuthService {
  private listenerAttached = false;

  /** True bila kredensial Supabase tersedia sehingga login cloud bisa dipakai. */
  public isCloudAuthAvailable(): boolean {
    const { url, anonKey } = supabaseService.getSupabaseConfig();
    return !!(url && anonKey);
  }

  public hasActiveSession(): boolean {
    return authState.hasActiveSession();
  }

  private toCurrentUser(profile: PengurusProfile, email: string | null): CurrentUser {
    return {
      role: profile.role,
      nama: profile.namaLengkap,
      username: profile.username,
      email: email || profile.email || '',
      nomorHp: profile.nomorHp,
      isAuthenticated: true,
      isLoggedIn: true
    };
  }

  /**
   * Ambil profil pengurus milik user yang sedang login.
   * Baris difilter oleh RLS, jadi tidak perlu (dan tidak boleh) percaya
   * filter dari sisi klien saja.
   */
  public async fetchProfile(): Promise<PengurusProfile | null> {
    const client = supabaseService.getClient();
    const userId = authState.getUserId();
    if (!client || !userId) return null;

    const { data, error } = await client
      .from('pengurus_profil')
      .select('id, username, nama_lengkap, role, role_label, nomor_hp, email, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Gagal membaca profil pengurus:', error.message);
      return null;
    }
    if (!data) return null;

    const role = (data.role || 'STAF_PELAYANAN') as UserRole;
    const profile: PengurusProfile = {
      id: data.id,
      username: data.username || (data.email || '').split('@')[0] || 'pengurus',
      namaLengkap: data.nama_lengkap || 'Pengurus RT 004',
      role,
      roleLabel: data.role_label || ROLE_LABELS[role] || 'Pengurus RT 004',
      nomorHp: data.nomor_hp || undefined,
      email: data.email || undefined,
      isActive: data.is_active !== false
    };

    authState.setProfile(profile);
    return profile;
  }

  private async applySession(session: Session | null): Promise<CurrentUser | null> {
    authState.setSession(session);
    if (!session) return null;

    const profile = await this.fetchProfile();
    if (!profile) return null;
    if (!profile.isActive) {
      await this.signOut();
      return null;
    }

    const user = this.toCurrentUser(profile, authState.getEmail());
    storageService.setCurrentUser(user);
    return user;
  }

  /** Login pengurus memakai email + password Supabase Auth. */
  public async signIn(email: string, password: string): Promise<AuthResult> {
    const client = supabaseService.getClient();
    if (!client) {
      return {
        success: false,
        message:
          'Koneksi Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, atau lengkapi di tab Integrasi.'
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { success: false, message: 'Email dan password wajib diisi.' };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      const msg = /invalid login credentials/i.test(error.message)
        ? 'Email atau password salah. Silakan periksa kembali.'
        : /email not confirmed/i.test(error.message)
          ? 'Email akun belum dikonfirmasi. Cek email verifikasi dari Supabase.'
          : `Gagal login: ${error.message}`;
      storageService.addAuditLog('Login Gagal', 'Supabase Auth', `Percobaan login gagal untuk ${cleanEmail}`);
      return { success: false, message: msg };
    }

    const user = await this.applySession(data.session);
    if (!user) {
      const profileMissing = !authState.getProfile();
      await this.signOut();
      return {
        success: false,
        needsProfile: profileMissing,
        message: profileMissing
          ? 'Akun berhasil diverifikasi, tetapi belum terdaftar sebagai pengurus RT. Minta Ketua RT menambahkan profil Anda di tabel pengurus_profil.'
          : 'Akun pengurus Anda berstatus tidak aktif. Hubungi Ketua RT 004.'
      };
    }

    storageService.addAuditLog('Login Berhasil', 'Supabase Auth', `${user.nama} (${user.role}) masuk ke dashboard`);
    return { success: true, message: `Selamat datang, ${user.nama}!`, user };
  }

  /** Pulihkan sesi yang tersimpan (dipanggil saat aplikasi dibuka). */
  public async restoreSession(): Promise<CurrentUser | null> {
    const client = supabaseService.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) {
        authState.setSession(null);
        return null;
      }
      return await this.applySession(data.session);
    } catch (e: any) {
      console.warn('Gagal memulihkan sesi Supabase:', e?.message);
      return null;
    }
  }

  public async signOut(): Promise<void> {
    const client = supabaseService.getClient();
    try {
      if (client) await client.auth.signOut();
    } catch (e: any) {
      console.warn('Gagal sign out dari Supabase:', e?.message);
    } finally {
      authState.reset();
      storageService.logout();
    }
  }

  public async changePassword(newPassword: string): Promise<{ success: boolean; message: string }> {
    const client = supabaseService.getClient();
    if (!client || !authState.hasActiveSession()) {
      return { success: false, message: 'Anda harus login terlebih dahulu untuk mengganti password.' };
    }
    if (newPassword.length < 8) {
      return { success: false, message: 'Password baru minimal 8 karakter.' };
    }
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, message: `Gagal mengganti password: ${error.message}` };
    }
    storageService.addAuditLog('Ganti Password', 'Supabase Auth', 'Password akun pengurus diperbarui');
    return { success: true, message: 'Password berhasil diperbarui.' };
  }

  public async sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const client = supabaseService.getClient();
    if (!client) {
      return { success: false, message: 'Koneksi Supabase belum dikonfigurasi.' };
    }
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
    });
    if (error) {
      return { success: false, message: `Gagal mengirim email reset: ${error.message}` };
    }
    return { success: true, message: 'Email reset password telah dikirim. Silakan cek inbox Anda.' };
  }

  /**
   * Pantau perubahan sesi (refresh token, sign out dari tab lain)
   * agar authState selalu sinkron dengan Supabase.
   */
  public initSessionListener(onChange?: (user: CurrentUser | null) => void) {
    if (this.listenerAttached) return;
    const client = supabaseService.getClient();
    if (!client) return;

    this.listenerAttached = true;
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        authState.reset();
        onChange?.(null);
        return;
      }
      authState.setSession(session);
      if (event === 'TOKEN_REFRESHED') return;
      void this.applySession(session).then(user => onChange?.(user));
    });
  }
}

export const authService = new AuthService();
