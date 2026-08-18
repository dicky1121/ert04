// Shim sementara untuk @capacitor/core sebelum package diinstall.
// File ini akan otomatis tidak digunakan setelah `npm install @capacitor/core`.
declare module '@capacitor/core' {
  export const Capacitor: {
    isNativePlatform(): boolean;
    getPlatform(): 'android' | 'ios' | 'web';
  };
}

declare module '@capacitor/push-notifications' {
  export const PushNotifications: {
    requestPermissions(): Promise<{ receive: 'granted' | 'denied' | 'prompt' }>;
    register(): Promise<void>;
    addListener(
      event: 'registration',
      listenerFunc: (token: { value: string }) => void
    ): Promise<{ remove: () => Promise<void> }>;
    addListener(
      event: 'registrationError',
      listenerFunc: (error: any) => void
    ): Promise<{ remove: () => Promise<void> }>;
    addListener(
      event: 'pushNotificationReceived',
      listenerFunc: (notification: any) => void
    ): Promise<{ remove: () => Promise<void> }>;
    addListener(
      event: 'pushNotificationActionPerformed',
      listenerFunc: (action: any) => void
    ): Promise<{ remove: () => Promise<void> }>;
    createChannel(channel: {
      id: string;
      name: string;
      description?: string;
      importance?: number;
      sound?: string;
      vibration?: boolean;
      visibility?: number;
    }): Promise<void>;
    removeAllListeners(): Promise<void>;
  };
}

declare module '@capacitor/status-bar' {
  export const StatusBar: {
    setBackgroundColor(options: { color: string }): Promise<void>;
    setStyle(options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void>;
  };
  export enum Style {
    Dark = 'DARK',
    Light = 'LIGHT',
    Default = 'DEFAULT',
  }
}

declare module '@capacitor/splash-screen' {
  export const SplashScreen: {
    hide(): Promise<void>;
  };
}
