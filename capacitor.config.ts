import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.go.bekasi.jatimulya.rt004',
  appName: 'SIP RT 004 Jatimulya',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Untuk development, uncomment baris berikut dan ganti dengan IP komputer
    // agar bisa live reload dari Android device ke Vite dev server
    // url: 'http://192.168.1.100:3000',
    // cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#020617', // slate-950
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#10b981', // emerald-500
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#020617', // slate-950
    },
  },
};

export default config;
