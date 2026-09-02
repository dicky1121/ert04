import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Send, X } from 'lucide-react';
import { JenisSurat, PengajuanSuratPublik } from '../types';
import { supabaseService } from '../services/supabaseService';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface PublicSuratFormProps {
  onClose: () => void;
}

const jenisOptions: Array<{ value: JenisSurat; label: string }> = [
  { value: 'KTP_KK', label: 'Pengantar KTP / KK' },
  { value: 'DOMISILI', label: 'Keterangan Domisili' },
  { value: 'SKTM', label: 'Surat Keterangan Tidak Mampu' },
  { value: 'USAHA', label: 'Keterangan Usaha' },
  { value: 'NIKAH', label: 'Pengantar Nikah' },
  { value: 'KELAHIRAN', label: 'Keterangan Kelahiran' },
  { value: 'KEMATIAN', label: 'Keterangan Kematian' },
  { value: 'SKCK', label: 'Pengantar SKCK' },
  { value: 'IZIN_KERAMAIAN', label: 'Izin Keramaian' },
  { value: 'LAINNYA', label: 'Keperluan Lainnya' }
];

const initialForm: PengajuanSuratPublik = {
  jenisSurat: 'KTP_KK', nikPemohon: '', namaPemohon: '', nomorKKPemohon: '',
  jenisKelaminPemohon: 'L', tempatTglLahirPemohon: '', agamaPemohon: 'ISLAM',
  pekerjaanPemohon: '', statusKawinPemohon: 'BELUM KAWIN', teleponPemohon: '',
  alamatPemohon: '', keperluan: '', keteranganLain: ''
};

export const PublicSuratForm: React.FC<PublicSuratFormProps> = ({ onClose }) => {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose);
  const update = (field: keyof PengajuanSuratPublik, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{16}$/.test(form.nikPemohon) || !/^\d{16}$/.test(form.nomorKKPemohon)) {
      setError('NIK dan nomor KK masing-masing harus tepat 16 digit.');
      return;
    }
    if (form.namaPemohon.trim().length < 3 || form.alamatPemohon.trim().length < 10 || form.keperluan.trim().length < 5) {
      setError('Lengkapi nama, alamat, dan keperluan pengajuan.');
      return;
    }
    setIsSubmitting(true);
    const result = await supabaseService.submitPublicSurat(form);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error?.includes('ajukan_surat_warga')
        ? 'Layanan belum diaktifkan oleh administrator. Silakan hubungi pengurus.'
        : result.error || 'Pengajuan gagal dikirim.');
      return;
    }
    setReference(result.reference || 'Pengajuan diterima');
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Form pengajuan surat warga">
      <div className="mx-auto my-3 w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl sm:my-8">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FileText className="h-5 w-5" /></span>
            <div><h2 className="text-base font-extrabold text-slate-900">Pengajuan Surat Warga</h2><p className="text-xs text-slate-500">Data akan ditinjau oleh pengurus RT.</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup form" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>

        {reference ? (
          <div className="px-6 py-14 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h3 className="mt-4 text-xl font-extrabold text-slate-900">Pengajuan berhasil dikirim</h3>
            <p className="mt-2 text-sm text-slate-600">Simpan nomor referensi berikut untuk komunikasi dengan pengurus.</p>
            <div className="mx-auto mt-5 max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-mono text-base font-bold text-emerald-800">{reference}</div>
            <button type="button" onClick={onClose} className="mt-7 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800">Kembali ke Sapa Warga</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">Jenis surat<select value={form.jenisSurat} onChange={e => update('jenisSurat', e.target.value)} className={`${inputClass} mt-1`}>{jenisOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-700">Nama lengkap<input required maxLength={150} value={form.namaPemohon} onChange={e => update('namaPemohon', e.target.value)} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs font-bold text-slate-700">Nomor WhatsApp<input required inputMode="tel" maxLength={20} placeholder="08xxxxxxxxxx" value={form.teleponPemohon} onChange={e => update('teleponPemohon', e.target.value)} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs font-bold text-slate-700">NIK<input required inputMode="numeric" maxLength={16} value={form.nikPemohon} onChange={e => update('nikPemohon', e.target.value.replace(/\D/g, ''))} className={`${inputClass} mt-1 font-mono`} /></label>
              <label className="text-xs font-bold text-slate-700">Nomor KK<input required inputMode="numeric" maxLength={16} value={form.nomorKKPemohon} onChange={e => update('nomorKKPemohon', e.target.value.replace(/\D/g, ''))} className={`${inputClass} mt-1 font-mono`} /></label>
              <label className="text-xs font-bold text-slate-700">Jenis kelamin<select value={form.jenisKelaminPemohon} onChange={e => update('jenisKelaminPemohon', e.target.value)} className={`${inputClass} mt-1`}><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></label>
              <label className="text-xs font-bold text-slate-700">Tempat, tanggal lahir<input required maxLength={150} placeholder="Bekasi, 17 Agustus 1990" value={form.tempatTglLahirPemohon} onChange={e => update('tempatTglLahirPemohon', e.target.value)} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs font-bold text-slate-700">Agama<select value={form.agamaPemohon} onChange={e => update('agamaPemohon', e.target.value)} className={`${inputClass} mt-1`}>{['ISLAM','KRISTEN','KATOLIK','HINDU','BUDDHA','KONGHUCU'].map(item => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-700">Status perkawinan<select value={form.statusKawinPemohon} onChange={e => update('statusKawinPemohon', e.target.value)} className={`${inputClass} mt-1`}>{['BELUM KAWIN','KAWIN','CERAI HIDUP','CERAI MATI'].map(item => <option key={item}>{item}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">Pekerjaan<input required maxLength={100} value={form.pekerjaanPemohon} onChange={e => update('pekerjaanPemohon', e.target.value)} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">Alamat lengkap<textarea required rows={3} maxLength={500} value={form.alamatPemohon} onChange={e => update('alamatPemohon', e.target.value)} className={`${inputClass} mt-1 resize-y`} /></label>
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">Keperluan<textarea required rows={3} maxLength={500} value={form.keperluan} onChange={e => update('keperluan', e.target.value)} className={`${inputClass} mt-1 resize-y`} /></label>
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">Keterangan tambahan <span className="font-normal text-slate-500">(opsional)</span><textarea rows={2} maxLength={500} value={form.keteranganLain} onChange={e => update('keteranganLain', e.target.value)} className={`${inputClass} mt-1 resize-y`} /></label>
            </div>
            {error && <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Batal</button>
              <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};