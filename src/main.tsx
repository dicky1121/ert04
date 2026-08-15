import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Catatan keamanan:
// Penarikan data dari Supabase TIDAK lagi dilakukan di sini. Sejak akses tabel
// dilindungi RLS (hanya untuk pengurus terautentikasi), sinkronisasi awal
// dijalankan di App.tsx setelah sesi Supabase Auth berhasil dipulihkan.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
