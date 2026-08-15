import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '../types';

/**
 * Penyimpan status sesi Supabase Auth yang dipakai bersama.
 *
 * Modul ini sengaja dibuat tanpa import ke supabaseService / authService
 * agar tidak terjadi circular import: supabaseService butuh tahu apakah ada
 * sesi terautentikasi (untuk mengizinkan sinkronisasi), sementara authService
 * butuh client dari supabaseService.
 */

export interface PengurusProfile {
  id: string;
  username: string;
  namaLengkap: string;
  role: UserRole;
  roleLabel: string;
  nomorHp?: string;
  email?: string;
  isActive: boolean;
}

let currentSession: Session | null = null;
let currentProfile: PengurusProfile | null = null;

export const authState = {
  getSession(): Session | null {
    return currentSession;
  },

  setSession(session: Session | null) {
    currentSession = session;
    if (!session) currentProfile = null;
  },

  /** True bila ada access token aktif (belum kedaluwarsa). */
  hasActiveSession(): boolean {
    if (!currentSession?.access_token) return false;
    const expiresAt = currentSession.expires_at;
    if (!expiresAt) return true;
    return expiresAt * 1000 > Date.now();
  },

  getUserId(): string | null {
    return currentSession?.user?.id ?? null;
  },

  getEmail(): string | null {
    return currentSession?.user?.email ?? null;
  },

  getProfile(): PengurusProfile | null {
    return currentProfile;
  },

  setProfile(profile: PengurusProfile | null) {
    currentProfile = profile;
  },

  reset() {
    currentSession = null;
    currentProfile = null;
  }
};
