/**
 * Push Notification Service untuk Android (Capacitor)
 *
 * Menangani:
 * - Request permission notifikasi
 * - Registrasi FCM token ke Supabase (dengan retry, tahan gangguan jaringan)
 * - Receive notification (foreground & background)
 * - Setup Android Notification Channel untuk EWS
 *
 * CATATAN PENTING (perbaikan bug yang membuat notifikasi tidak pernah masuk):
 * Listener `registration` WAJIB dipasang SEBELUM `PushNotifications.register()`
 * dipanggil. Firebase mengirim event token secara asinkron dan sangat cepat
 * (biasanya sudah di-cache Google Play Services). Bila listener dipasang
 * setelah register(), event token bisa terlewat sepenuhnya sehingga token
 * tidak pernah tersimpan ke tabel `ews_fcm_tokens` — akibatnya Edge Function
 * tidak punya tujuan pengiriman dan HP tidak menerima notifikasi apa pun.
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabaseService } from './supabaseService';

const CHANNEL_ID = 'ews_darurat';
const CHANNEL_NAME = 'EWS Darurat RT 004';
const CHANNEL_DESCRIPTION = 'Notifikasi darurat untuk warga RT 004 RW 007 Jatimulya';

/** Token terakhir yang diberikan Firebase di perangkat ini. */
const KUNCI_TOKEN = 'ert04.fcm.token';
/** Token yang sudah TERBUKTI tersimpan di Supabase. */
const KUNCI_TOKEN_TERKIRIM = 'ert04.fcm.token.terkirim';

/** Jeda antar percobaan ulang pendaftaran token (milidetik). */
const JEDA_RETRY = [1_000, 3_000, 8_000, 20_000, 45_000];

export type StatusNotifikasi = {
  /** Apakah berjalan di aplikasi Android/iOS (bukan browser). */
  nativePlatform: boolean;
  izin: 'granted' | 'denied' | 'prompt' | 'belum-diminta';
  /** Token FCM perangkat ini (dipotong untuk keamanan tampilan). */
  token: string | null;
  /** Sudah tersimpan di database Supabase atau belum. */
  terdaftarDiServer: boolean;
  pesan: string;
  waktuTerakhir: string | null;
};

function bacaLocal(kunci: string): string | null {
  try {
    return localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

function tulisLocal(kunci: string, nilai: string): void {
  try {
    localStorage.setItem(kunci, nilai);
  } catch {
    /* localStorage penuh / diblokir — abaikan, bukan hal fatal */
  }
}

function tidur(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Getarkan perangkat sebagai penanda darurat saat app sedang terbuka. */
function getarkanDarurat(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([300, 150, 300, 150, 600]);
    }
  } catch {
    /* perangkat tidak mendukung getar */
  }
}

/** Deskripsi perangkat yang ringkas — userAgent penuh terlalu panjang & tidak informatif. */
function deskripsiPerangkat(): string {
  const platform = Capacitor.getPlatform();
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const model = ua.match(/\(Linux;.*?;\s*([^;)]+)\s*Build/i)?.[1]?.trim();
  const androidVer = ua.match(/Android\s+([\d.]+)/i)?.[1];

  // Anotasi string[] wajib: Capacitor.getPlatform() bertipe union literal
  // ('android' | 'ios' | 'web'), sehingga tanpa anotasi TypeScript menolak
  // penambahan teks bebas seperti nama model perangkat.
  const bagian: string[] = [platform];
  if (model) bagian.push(model);
  if (androidVer) bagian.push(`Android ${androidVer}`);

  return bagian.join(' • ').slice(0, 300);
}

let listenerSudahDipasang = false;
let pendaftaranSedangJalan = false;

const status: StatusNotifikasi = {
  nativePlatform: false,
  izin: 'belum-diminta',
  token: null,
  terdaftarDiServer: false,
  pesan: 'Belum diinisialisasi.',
  waktuTerakhir: null,
};

function setStatus(pesan: string, tambahan: Partial<StatusNotifikasi> = {}): void {
  status.pesan = pesan;
  status.waktuTerakhir = new Date().toISOString();
  Object.assign(status, tambahan);
  console.log(`[PushNotif] ${pesan}`);
}

export const pushNotificationService = {
  /**
   * Inisialisasi push notification service.
   * Dipanggil saat app pertama kali dibuka (main.tsx).
   * Hanya berjalan di native platform (Android/iOS), tidak di web browser.
   */
  async init(): Promise<void> {
    status.nativePlatform = Capacitor.isNativePlatform();

    if (!status.nativePlatform) {
      setStatus('Dilewati: bukan aplikasi native (berjalan di browser).');
      return;
    }

    try {
      // 1. Channel Android dibuat lebih dulu agar notifikasi masuk dengan
      //    prioritas tinggi (berbunyi + tampil di layar terkunci).
      await this.setupNotificationChannel();

      // 2. Listener dipasang SEBELUM register() — lihat catatan di atas file.
      //    Inilah inti perbaikan bug "notifikasi tidak pernah masuk".
      this.setupListeners();

      // 3. Minta izin notifikasi (Android 13+ wajib, di bawahnya otomatis granted).
      const izin = await PushNotifications.requestPermissions();
      status.izin = izin.receive;

      if (izin.receive !== 'granted') {
        setStatus(
          'Izin notifikasi TIDAK diberikan. Buka Pengaturan HP > Aplikasi > E-RT04 > ' +
            'Notifikasi, lalu aktifkan.'
        );
        return;
      }

      // 4. Daftar ke Firebase. Token akan datang lewat listener 'registration'.
      await PushNotifications.register();
      setStatus('Izin diberikan, menunggu token dari Firebase...');

      // 5. Jaring pengaman: bila token dari perangkat ini sudah pernah didapat
      //    pada sesi sebelumnya tetapi belum terbukti tersimpan di server,
      //    kirim ulang sekarang.
      const tokenLama = bacaLocal(KUNCI_TOKEN);
      const tokenTerkirim = bacaLocal(KUNCI_TOKEN_TERKIRIM);
      if (tokenLama && tokenLama !== tokenTerkirim) {
        setStatus('Token lama belum tersimpan di server, mencoba kirim ulang...');
        void this.daftarkanTokenKeServer(tokenLama);
      } else if (tokenLama) {
        status.token = tokenLama;
        status.terdaftarDiServer = true;
      }

      // 6. Saat aplikasi kembali dibuka dari background, pastikan sekali lagi
      //    token benar-benar ada di server (mis. sebelumnya HP sedang offline).
      this.pasangPemantauResume();
    } catch (error) {
      const pesan = error instanceof Error ? error.message : String(error);
      setStatus(`Gagal inisialisasi: ${pesan}`);
    }
  },

  /**
   * Setup Android Notification Channel dengan prioritas HIGH untuk EWS.
   * Channel ini akan muncul di Android Settings > Notifications > App > Channels.
   *
   * ID channel harus sama dengan `channel_id` yang dikirim Edge Function
   * (`ews_darurat`), kalau berbeda Android akan memakai channel default yang
   * prioritasnya rendah sehingga notifikasi tidak berbunyi.
   */
  async setupNotificationChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
      await PushNotifications.createChannel({
        id: CHANNEL_ID,
        name: CHANNEL_NAME,
        description: CHANNEL_DESCRIPTION,
        importance: 5, // IMPORTANCE_HIGH — muncul sebagai banner & berbunyi
        sound: 'default',
        vibration: true,
        visibility: 1, // Public — tampil di layar terkunci
      });

      console.log(`[PushNotif] Channel "${CHANNEL_ID}" siap`);
    } catch (error) {
      console.error('[PushNotif] Gagal membuat notification channel:', error);
    }
  },

  /**
   * Setup event listeners untuk FCM token & notification events.
   * Idempotent — aman dipanggil lebih dari sekali.
   */
  setupListeners(): void {
    if (listenerSudahDipasang) return;
    listenerSudahDipasang = true;

    // Event: FCM token berhasil didapat dari Firebase.
    void PushNotifications.addListener('registration', (token) => {
      const nilai = token?.value || '';
      if (!nilai) {
        setStatus('Firebase mengirim token kosong.');
        return;
      }

      status.token = nilai;
      tulisLocal(KUNCI_TOKEN, nilai);
      setStatus(`Token FCM diterima (…${nilai.slice(-10)}), mendaftarkan ke server...`);

      void this.daftarkanTokenKeServer(nilai);
    });

    // Event: Firebase gagal memberi token (biasanya Google Play Services bermasalah).
    void PushNotifications.addListener('registrationError', (error) => {
      const pesan = error?.error || JSON.stringify(error);
      setStatus(`Registrasi Firebase gagal: ${pesan}`);
    });

    // Event: notifikasi diterima saat app di FOREGROUND (terbuka).
    // Di Android, notifikasi TIDAK otomatis tampil di status bar saat app
    // terbuka, jadi kita bunyikan getar + kirim event ke UI untuk toast.
    void PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotif] Diterima (foreground):', notification);

      const title = notification?.title || notification?.data?.title || 'Notifikasi Baru';
      const body = notification?.body || notification?.data?.body || '';

      getarkanDarurat();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ews-notification-foreground', {
            detail: { title, body, data: notification?.data },
          })
        );
      }
    });

    // Event: user menekan notifikasi (app di background/tertutup).
    void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PushNotif] Notifikasi ditekan:', action);

      const data = action?.notification?.data;

      if (data && data.type === 'EWS') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ews-notification-tapped', {
              detail: { laporan_id: data.laporan_id, data },
            })
          );
        }
      }
    });

    console.log('[PushNotif] Semua listener terpasang (sebelum register)');
  },

  /**
   * Kirim token ke Supabase dengan percobaan ulang berjenjang.
   *
   * Sebelumnya kegagalan di sini tidak terdeteksi sama sekali karena
   * supabase-js TIDAK melempar exception saat ditolak — ia mengembalikan
   * `{ error }`. Akibatnya log tetap menampilkan "berhasil" walau token
   * sebenarnya tidak pernah masuk database.
   */
  async daftarkanTokenKeServer(token: string): Promise<boolean> {
    if (!token) return false;

    // Hindari dua proses pendaftaran berjalan bersamaan.
    if (pendaftaranSedangJalan) return false;
    pendaftaranSedangJalan = true;

    const info = deskripsiPerangkat();

    try {
      for (let percobaan = 0; percobaan <= JEDA_RETRY.length; percobaan++) {
        const hasil = await supabaseService.registerFCMToken(token, info);

        if (hasil.success) {
          status.terdaftarDiServer = true;
          status.token = token;
          tulisLocal(KUNCI_TOKEN_TERKIRIM, token);
          setStatus('Token FCM tersimpan di server. HP ini siap menerima notifikasi darurat.');
          return true;
        }

        status.terdaftarDiServer = false;

        const jeda = JEDA_RETRY[percobaan];
        if (jeda === undefined) {
          setStatus(
            `Token FCM GAGAL tersimpan setelah ${percobaan + 1} percobaan: ${hasil.error}. ` +
              'HP ini tidak akan menerima notifikasi sampai pendaftaran berhasil.'
          );
          return false;
        }

        setStatus(
          `Pendaftaran token gagal (${hasil.error}). Mencoba lagi dalam ${Math.round(jeda / 1000)} detik...`
        );
        await tidur(jeda);
      }

      return false;
    } finally {
      pendaftaranSedangJalan = false;
    }
  },

  /**
   * Saat aplikasi dibuka kembali (kembali dari background), periksa lagi
   * apakah token sudah benar-benar tersimpan. Ini menyelamatkan kasus HP
   * sedang tanpa sinyal saat pertama kali aplikasi dibuka.
   */
  pasangPemantauResume(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;

      const token = bacaLocal(KUNCI_TOKEN);
      const terkirim = bacaLocal(KUNCI_TOKEN_TERKIRIM);

      if (token && token !== terkirim) {
        void this.daftarkanTokenKeServer(token);
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        const token = bacaLocal(KUNCI_TOKEN);
        const terkirim = bacaLocal(KUNCI_TOKEN_TERKIRIM);
        if (token && token !== terkirim) {
          void this.daftarkanTokenKeServer(token);
        }
      });
    }
  },

  /**
   * Status terkini untuk keperluan diagnosa.
   * Bisa dipanggil dari Chrome DevTools (chrome://inspect) dengan:
   *   window.ewsStatusNotifikasi()
   */
  getStatus(): StatusNotifikasi {
    return {
      ...status,
      token: status.token ? `…${status.token.slice(-12)}` : null,
    };
  },

  /**
   * Paksa pendaftaran ulang token — dipakai tombol diagnosa di aplikasi.
   */
  async daftarkanUlang(): Promise<StatusNotifikasi> {
    if (!Capacitor.isNativePlatform()) {
      setStatus('Dilewati: bukan aplikasi native.');
      return this.getStatus();
    }

    const token = bacaLocal(KUNCI_TOKEN);

    if (token) {
      await this.daftarkanTokenKeServer(token);
    } else {
      // Belum punya token sama sekali — ulangi seluruh proses.
      await this.init();
    }

    return this.getStatus();
  },

  /**
   * Unregister dari push notifications (untuk logout atau disable notif)
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await PushNotifications.removeAllListeners();
      listenerSudahDipasang = false;
      setStatus('Listener notifikasi dilepas.');
    } catch (error) {
      console.error('[PushNotif] Gagal unregister:', error);
    }
  },
};

// Sediakan pintu diagnosa dari DevTools tanpa perlu build khusus.
if (typeof window !== 'undefined') {
  (window as any).ewsStatusNotifikasi = () => pushNotificationService.getStatus();
  (window as any).ewsDaftarkanUlangNotifikasi = () => pushNotificationService.daftarkanUlang();
}
