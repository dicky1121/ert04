/**
 * Push Notification Service untuk Android (Capacitor)
 * 
 * Menangani:
 * - Request permission notifikasi
 * - Registrasi FCM token ke Supabase
 * - Receive notification (foreground & background)
 * - Setup Android Notification Channel untuk EWS
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabaseService } from './supabaseService';

const CHANNEL_ID = 'ews_darurat';
const CHANNEL_NAME = 'EWS Darurat RT 004';
const CHANNEL_DESCRIPTION = 'Notifikasi darurat untuk warga RT 004 RW 007 Jatimulya';

export const pushNotificationService = {
  /**
   * Inisialisasi push notification service.
   * Dipanggil saat app pertama kali dibuka (main.tsx atau App.tsx).
   * Hanya berjalan di native platform (Android/iOS), tidak di web browser.
   */
  async init(): Promise<void> {
    // Skip jika bukan native platform
    if (!Capacitor.isNativePlatform()) {
      console.log('[PushNotif] Skipped: not a native platform');
      return;
    }

    console.log('[PushNotif] Initializing...');

    try {
      // 1. Setup Android Notification Channel (harus dilakukan sebelum request permission)
      await this.setupNotificationChannel();

      // 2. Request permission
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.warn('[PushNotif] Permission denied by user');
        return;
      }

      console.log('[PushNotif] Permission granted');

      // 3. Register dengan FCM untuk dapatkan token
      await PushNotifications.register();

      // 4. Setup listeners
      this.setupListeners();

      console.log('[PushNotif] Initialization complete');
    } catch (error) {
      console.error('[PushNotif] Initialization error:', error);
    }
  },

  /**
   * Setup Android Notification Channel dengan prioritas HIGH untuk EWS.
   * Channel ini akan muncul di Android Settings > Notifications > App > Channels.
   */
  async setupNotificationChannel(): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') return;

    try {
      await PushNotifications.createChannel({
        id: CHANNEL_ID,
        name: CHANNEL_NAME,
        description: CHANNEL_DESCRIPTION,
        importance: 5, // IMPORTANCE_HIGH (4 = default, 5 = high)
        sound: 'default', // Bunyi notifikasi default Android
        vibration: true,
        visibility: 1, // Public — muncul di lock screen
      });

      console.log(`[PushNotif] Channel "${CHANNEL_ID}" created`);
    } catch (error) {
      console.error('[PushNotif] Error creating notification channel:', error);
    }
  },

  /**
   * Setup event listeners untuk FCM token & notification events
   */
  setupListeners(): void {
    // Event: FCM token berhasil didapat dari Firebase
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PushNotif] FCM Token:', token.value);
      
      // Simpan token ke Supabase agar bisa menerima broadcast notification
      try {
        const deviceInfo = `${Capacitor.getPlatform()} - ${navigator.userAgent}`;
        await supabaseService.registerFCMToken(token.value, deviceInfo);
        console.log('[PushNotif] Token registered to Supabase');
      } catch (error) {
        console.error('[PushNotif] Error registering token to Supabase:', error);
      }
    });

    // Event: Error saat registrasi
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotif] Registration error:', error);
    });

    // Event: Notification diterima saat app di FOREGROUND (terbuka)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotif] Received (foreground):', notification);

      // Tampilkan toast/alert custom jika app sedang terbuka
      // Karena notifikasi foreground tidak muncul sebagai system notification
      const title = notification.title || 'Notifikasi Baru';
      const body = notification.body || '';
      
      // Dispatch custom event agar komponen UI bisa handle (optional)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ews-notification-foreground', {
            detail: { title, body, data: notification.data },
          })
        );
      }

      // Alternatif: gunakan alert (sederhana tapi tidak elegan)
      // alert(`🚨 ${title}\n\n${body}`);
    });

    // Event: User tap notification (app di background/terminated, lalu dibuka via notif)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PushNotif] Action performed:', action);

      const notification = action.notification;
      const data = notification.data;

      // Jika notifikasi EWS, buka tab EWS di dashboard admin (jika user sudah login)
      // atau buka halaman Sapa Warga (jika belum login)
      if (data && data.type === 'EWS') {
        console.log('[PushNotif] EWS notification tapped, laporan_id:', data.laporan_id);
        
        // Dispatch event agar App.tsx bisa handle navigasi
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('ews-notification-tapped', {
              detail: { laporan_id: data.laporan_id, data },
            })
          );
        }
      }
    });
  },

  /**
   * Unregister dari push notifications (untuk logout atau disable notif)
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Hapus semua listeners
      await PushNotifications.removeAllListeners();
      console.log('[PushNotif] Unregistered and removed all listeners');
    } catch (error) {
      console.error('[PushNotif] Error unregistering:', error);
    }
  },
};
