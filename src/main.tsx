import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { pushNotificationService } from './services/pushNotificationService';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

// Inisialisasi Capacitor plugins (hanya di native platform)
if (Capacitor.isNativePlatform()) {
  // Setup status bar style
  StatusBar.setStyle({ style: 'DARK' }).catch((e) =>
    console.warn('StatusBar.setStyle failed:', e)
  );
  StatusBar.setBackgroundColor({ color: '#020617' }).catch((e) =>
    console.warn('StatusBar.setBackgroundColor failed:', e)
  );

  // Hide splash screen setelah app siap
  setTimeout(() => {
    SplashScreen.hide().catch((e) => console.warn('SplashScreen.hide failed:', e));
  }, 1000);

  // Inisialisasi push notification service
  pushNotificationService.init().catch((e) =>
    console.error('PushNotificationService.init failed:', e)
  );
}

// Catatan keamanan:
// Penarikan data dari Supabase TIDAK lagi dilakukan di sini. Sejak akses tabel
// dilindungi RLS (hanya untuk pengurus terautentikasi), sinkronisasi awal
// dijalankan di App.tsx setelah sesi Supabase Auth berhasil dipulihkan.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
