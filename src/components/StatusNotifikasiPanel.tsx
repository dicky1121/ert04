/**
 * Panel Status Notifikasi
 *
 * Menjawab keluhan "notifikasi tidak masuk di HP" secara mandiri, tanpa
 * perlu menyambungkan HP ke komputer untuk membaca log.
 *
 * Panel ini menampilkan rantai syarat notifikasi apa adanya:
 *   1. Aplikasi native (APK), bukan browser
 *   2. Izin notifikasi diberikan
 *   3. Token FCM diterima dari Firebase
 *   4. Token TERSIMPAN di server  <- paling sering gagal & tidak terlihat
 *
 * Bila salah satu gagal, sebabnya ditampilkan lengkap dengan tindakan yang
 * harus dilakukan, serta tombol untuk mendaftarkan ulang saat itu juga.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Smartphone,
  XCircle,
} from 'lucide-react';
import {
  pushNotificationService,
  StatusNotifikasi,
} from '../services/pushNotificationService';

type Tingkat = 'baik' | 'buruk' | 'netral';

interface Baris {
  label: string;
  nilai: string;
  tingkat: Tingkat;
}

const IkonBaris: React.FC<{ tingkat: Tingkat }> = ({ tingkat }) => {
  if (tingkat === 'baik') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (tingkat === 'buruk') return <XCircle className="w-4 h-4 text-rose-600 shrink-0" />;
  return <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />;
};

/** Ubah status mentah menjadi baris-baris yang mudah dibaca pengurus. */
const susunBaris = (s: StatusNotifikasi): Baris[] => {
  const izinLabel: Record<StatusNotifikasi['izin'], string> = {
    granted: 'Diizinkan',
    denied: 'DITOLAK',
    prompt: 'Belum dijawab',
    'belum-diminta': 'Belum diminta',
  };

  return [
    {
      label: 'Mode aplikasi',
      nilai: s.nativePlatform ? 'Aplikasi Android (APK)' : 'Browser - notifikasi tidak tersedia',
      tingkat: s.nativePlatform ? 'baik' : 'netral',
    },
    {
      label: 'Izin notifikasi',
      nilai: izinLabel[s.izin] ?? String(s.izin),
      tingkat: s.izin === 'granted' ? 'baik' : 'buruk',
    },
    {
      label: 'Token dari Firebase',
      nilai: s.token ? `Diterima (${s.token})` : 'Belum diterima',
      tingkat: s.token ? 'baik' : 'buruk',
    },
    {
      label: 'Token tersimpan di server',
      nilai: s.terdaftarDiServer ? 'Ya - HP ini siap menerima' : 'BELUM - HP ini tidak akan berbunyi',
      tingkat: s.terdaftarDiServer ? 'baik' : 'buruk',
    },
  ];
};

/** Saran tindakan sesuai kegagalan yang terdeteksi. */
const saranTindakan = (s: StatusNotifikasi): string | null => {
  if (!s.nativePlatform) {
    return 'Notifikasi darurat hanya berjalan di aplikasi Android. Buka lewat aplikasi E-RT04 yang terpasang di HP, bukan lewat browser.';
  }
  if (s.izin !== 'granted') {
    return 'Izin notifikasi belum diberikan. Buka Pengaturan HP > Aplikasi > E-RT04 > Notifikasi, lalu aktifkan. Sesudah itu tekan "Daftarkan ulang".';
  }
  if (!s.token) {
    return 'Firebase belum memberi token untuk HP ini. Pastikan HP tersambung internet dan Google Play Services aktif, lalu tekan "Daftarkan ulang".';
  }
  if (!s.terdaftarDiServer) {
    return 'Token sudah ada tetapi GAGAL tersimpan ke server, jadi laporan darurat tidak tahu harus dikirim ke mana. Tekan "Daftarkan ulang". Bila tetap gagal, jalankan scripts/aktifkan-rpc-fcm-token.sql di Supabase SQL Editor.';
  }
  return null;
};

export const StatusNotifikasiPanel: React.FC = () => {
  const [status, setStatus] = useState<StatusNotifikasi | null>(null);
  const [sedangDaftar, setSedangDaftar] = useState(false);

  const muat = useCallback(() => {
    try {
      setStatus(pushNotificationService.getStatus());
    } catch (err) {
      console.warn('Status notifikasi tidak dapat dibaca:', err);
    }
  }, []);

  useEffect(() => {
    muat();
    // Pendaftaran token berjalan asinkron dengan percobaan ulang, jadi
    // status disegarkan berkala agar hasilnya terlihat tanpa perlu
    // menutup dan membuka panel.
    const timer = setInterval(muat, 3000);
    return () => clearInterval(timer);
  }, [muat]);

  const daftarkanUlang = async () => {
    setSedangDaftar(true);
    try {
      const hasil = await pushNotificationService.daftarkanUlang();
      setStatus(hasil);
    } catch (err) {
      console.error('Pendaftaran ulang notifikasi gagal:', err);
    } finally {
      setSedangDaftar(false);
    }
  };

  if (!status) return null;

  const baris = susunBaris(status);
  const saran = saranTindakan(status);
  const semuaBaik = status.nativePlatform && status.izin === 'granted' && !!status.token && status.terdaftarDiServer;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        semuaBaik ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <BellRing className={`w-4 h-4 ${semuaBaik ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Status Notifikasi HP Ini</h2>
            <p className="text-xs text-slate-500">
              {semuaBaik
                ? 'Siap menerima notifikasi darurat.'
                : 'Ada syarat yang belum terpenuhi - notifikasi belum akan masuk.'}
            </p>
          </div>
        </div>
        <button
          onClick={daftarkanUlang}
          disabled={sedangDaftar}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-sm disabled:opacity-50 shrink-0"
        >
          {sedangDaftar ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Daftarkan ulang
        </button>
      </div>

      <dl className="space-y-1.5">
        {baris.map((b) => (
          <div key={b.label} className="flex items-start gap-2 text-xs">
            <IkonBaris tingkat={b.tingkat} />
            <dt className="font-semibold text-slate-600 shrink-0">{b.label}:</dt>
            <dd
              className={`${
                b.tingkat === 'buruk' ? 'text-rose-700 font-semibold' : 'text-slate-700'
              } break-words`}
            >
              {b.nilai}
            </dd>
          </div>
        ))}
      </dl>

      {saran && (
        <p className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-900 leading-relaxed">
          <span className="font-bold">Tindakan: </span>
          {saran}
        </p>
      )}

      {status.pesan && (
        <p className="mt-2 text-xs text-slate-500 leading-relaxed break-words">
          Catatan sistem: {status.pesan}
        </p>
      )}
    </div>
  );
};
