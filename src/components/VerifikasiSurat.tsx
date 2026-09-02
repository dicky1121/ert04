import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  XCircle,
} from 'lucide-react';
import { SuratPengantar } from '../types';
import { supabaseService } from '../services/supabaseService';
import { BekasiLogo } from './BekasiLogo';
import { formatTanggalSedang } from '../utils/tanggal';

interface VerifikasiSuratProps {
  kode: string;
  onTutup: () => void;
}

/**
 * Halaman/overlay verifikasi keaslian surat pengantar.
 * Dibuka saat URL memiliki parameter ?verifikasi=<kode>.
 * Query ke tabel surat_pengantar_rt004 by kode_verifikasi_qr.
 */
export const VerifikasiSurat: React.FC<VerifikasiSuratProps> = ({ kode, onTutup }) => {
  const [surat, setSurat] = useState<SuratPengantar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kode) {
      setError('Kode verifikasi tidak valid.');
      setLoading(false);
      return;
    }

    let aktif = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const client = supabaseService.getClient();
        if (!client) {
          setError('Aplikasi belum tersambung ke Supabase. Tidak dapat memverifikasi.');
          setLoading(false);
          return;
        }
        const { data, error: err } = await client
          .from('surat_pengantar_rt004')
          .select('*')
          .eq('kode_verifikasi_qr', kode)
          .maybeSingle();

        if (!aktif) return;
        if (err) { setError(`Gagal memverifikasi: ${err.message}`); return; }
        if (!data) { setError('Surat tidak ditemukan. Kode verifikasi tidak valid atau surat telah dihapus.'); return; }

        // Map baris DB ke SuratPengantar
        setSurat({
          id: data.id || '',
          nomorSurat: data.nomor_surat || '',
          jenisSurat: data.jenis_surat || '',
          judulSurat: data.judul_surat || '',
          nikPemohon: data.nik_pemohon || '',
          namaPemohon: data.nama_pemohon || '',
          nomorKKPemohon: data.nomor_kk_pemohon || '',
          tempatTglLahirPemohon: data.tempat_tgl_lahir_pemohon || '',
          jenisKelaminPemohon: data.jenis_kelamin_pemohon || '',
          statusKawinPemohon: data.status_kawin_pemohon || '',
          pekerjaanPemohon: data.pekerjaan_pemohon || '',
          alamatPemohon: data.alamat_pemohon || '',
          keperluan: data.keperluan || '',
          tanggalPengajuan: data.tanggal_pengajuan || '',
          tanggalDisetujui: data.tanggal_disetujui || null,
          status: data.status || 'PENDING',
          alasanPenolakan: data.alasan_penolakan || null,
          namaPejabatTtd: data.nama_pejabat_ttd || '',
          jabatanTtd: data.jabatan_ttd || '',
          kodeVerifikasiQr: data.kode_verifikasi_qr || '',
          catatan: data.catatan || null,
          dibuatOleh: data.dibuat_oleh || 'ADMIN',
        } as SuratPengantar);
      } catch (err: any) {
        if (aktif) setError(err?.message || 'Gagal menghubungi server.');
      } finally {
        if (aktif) setLoading(false);
      }
    })();
    return () => { aktif = false; };
  }, [kode]);

  const isValid = surat?.status === 'DISETUJUI';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onTutup(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white px-5 py-4 flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-2xl border border-white/15">
            <BekasiLogo className="w-10 h-12" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Verifikasi Surat</p>
            <p className="text-sm font-bold text-white">RT 004 RW 007 Kelurahan Jatimulya</p>
            <p className="text-[11px] text-slate-300">Kec. Tambun Selatan, Kab. Bekasi</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              <span className="text-sm font-medium">Memverifikasi surat…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-rose-600" />
              </div>
              <p className="text-base font-bold text-rose-700">Surat Tidak Valid</p>
              <p className="text-sm text-slate-500 leading-relaxed">{error}</p>
            </div>
          )}

          {!loading && surat && (
            <div className="space-y-4">
              {/* Status utama */}
              <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {isValid
                  ? <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600" />
                  : <AlertTriangle className="w-6 h-6 shrink-0 text-amber-600" />}
                <div>
                  <p className="text-sm font-extrabold">
                    {isValid ? 'Surat Valid & Asli' : 'Surat Belum Disetujui'}
                  </p>
                  <p className="text-[11px] mt-0.5">
                    {isValid
                      ? `Diterbitkan ${formatTanggalSedang(surat.tanggalDisetujui)}`
                      : `Status: ${surat.status}`}
                  </p>
                </div>
              </div>

              {/* Detail surat */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: 'Nama Pemohon', value: surat.namaPemohon },
                  { label: 'NIK', value: surat.nikPemohon },
                  { label: 'Jenis Surat', value: surat.judulSurat || surat.jenisSurat },
                  { label: 'Nomor Surat', value: surat.nomorSurat },
                  { label: 'Ditandatangani', value: surat.namaPejabatTtd || '-' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2 px-3 py-2.5">
                    <span className="text-[11px] text-slate-400 font-medium w-28 shrink-0">{label}</span>
                    <span className="text-xs font-semibold text-slate-800 break-all">{value || '-'}</span>
                  </div>
                ))}
              </div>

              {/* Kode verifikasi */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 justify-center">
                <Shield className="w-3.5 h-3.5" />
                <span className="font-mono">{kode}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onTutup}
            className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
