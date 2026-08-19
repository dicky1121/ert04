import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: string;
}

/**
 * Penangkap error render React.
 *
 * Tanpa komponen ini, satu error saat render (misalnya di panel EWS Darurat)
 * membuat React melepas SELURUH pohon komponen sehingga layar menjadi putih
 * kosong tanpa pesan apa pun — sangat sulit ditelusuri oleh pengurus RT.
 *
 * Dengan pembatas ini, error ditampilkan apa adanya beserta lokasi komponennya,
 * dan pengguna tetap bisa memuat ulang aplikasi tanpa menutup browser.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Tetap catat ke console agar terlihat di DevTools maupun logcat Android.
    console.error('Terjadi error saat menampilkan halaman:', error, errorInfo);
    this.setState({ info: errorInfo.componentStack || '' });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-rose-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-rose-50 border-b border-rose-100">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900">Halaman gagal ditampilkan</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Aplikasi menghentikan tampilan agar data tidak rusak. Rincian error ada di bawah.
              </p>
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Pesan error
              </p>
              <pre className="text-xs bg-slate-900 text-rose-200 rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                {error.name}: {error.message}
              </pre>
            </div>

            {info && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Lokasi komponen
                </p>
                <pre className="text-xs bg-slate-100 text-slate-600 rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                  {info.trim()}
                </pre>
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed">
              Tolong kirimkan tangkapan layar pesan di atas kepada pengelola sistem. Data yang sudah
              tersimpan di perangkat maupun di Supabase tidak terpengaruh oleh error ini.
            </p>

            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition"
            >
              <RefreshCw className="w-4 h-4" />
              Muat ulang aplikasi
            </button>
          </div>
        </div>
      </div>
    );
  }
}
