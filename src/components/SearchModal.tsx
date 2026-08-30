import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Users, User, FileText, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { KartuKeluarga, Warga, SuratPengantar } from '../types';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  wargaList: Warga[];
  kkList: KartuKeluarga[];
  suratList: SuratPengantar[];
  onSelectWarga: (warga: Warga) => void;
  onSelectKK: (kk: KartuKeluarga) => void;
  onSelectSurat: (surat: SuratPengantar) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  wargaList,
  kkList,
  suratList,
  onSelectWarga,
  onSelectKK,
  onSelectSurat
}) => {
  const [query, setQuery] = useState('');

  // Escape, focus trap, dan pemulihan fokus ditangani hook bersama.
  const dialogRef = useModalDismiss<HTMLDivElement>(onClose, isOpen);

  // Pintasan Ctrl/Cmd+K untuk menutup kembali panel pencarian.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return {
        warga: wargaList.slice(0, 4),
        kk: kkList.slice(0, 3),
        surat: suratList.slice(0, 2)
      };
    }

    return {
      warga: wargaList.filter(w => 
        w.nik.toLowerCase().includes(q) ||
        w.nama.toLowerCase().includes(q) ||
        w.nomorKK.toLowerCase().includes(q) ||
        (w.pekerjaan && w.pekerjaan.toLowerCase().includes(q))
      ).slice(0, 6),
      kk: kkList.filter(k => 
        k.nomorKK.toLowerCase().includes(q) ||
        k.kepalaKeluargaNama.toLowerCase().includes(q) ||
        k.alamat.toLowerCase().includes(q) ||
        k.blokRumah.toLowerCase().includes(q)
      ).slice(0, 4),
      surat: suratList.filter(s => 
        s.nomorSurat.toLowerCase().includes(q) ||
        s.namaPemohon.toLowerCase().includes(q) ||
        s.nikPemohon.toLowerCase().includes(q) ||
        s.keperluan.toLowerCase().includes(q)
      ).slice(0, 4)
    };
  }, [query, wargaList, kkList, suratList]);

  if (!isOpen) return null;

  const totalResults = filtered.warga.length + filtered.kk.length + filtered.surat.length;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Bar Input */}
        <div className="relative border-b border-slate-200 p-4 bg-slate-50/70 flex items-center gap-3">
          <Search className="w-5 h-5 text-emerald-600 shrink-0" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nomor KK (16 digit), NIK, Nama Warga, atau Alamat..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-500 text-sm focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-slate-500 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-700 font-mono transition"
          >
            ESC
          </button>
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-5 text-xs">
          {totalResults === 0 && (
            <div className="text-center py-10 text-slate-500">
              <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Data tidak ditemukan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Pastikan nomor KK atau NIK 16 digit yang dimasukkan sudah benar.
              </p>
            </div>
          )}

          {/* Section Warga */}
          {filtered.warga.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 px-1">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  Data Warga / Penduduk ({filtered.warga.length})
                </span>
                <span>Pilih untuk Detail</span>
              </div>
              <div className="space-y-1.5">
                {filtered.warga.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => {
                      onSelectWarga(w);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl hover:bg-emerald-50/80 border border-slate-100 hover:border-emerald-200 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        w.jenisKelamin === 'L' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                      }`}>
                        {w.jenisKelamin}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 group-hover:text-emerald-800">{w.nama}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                            NIK: {w.nik}
                          </span>
                          {w.isLansia && <span className="text-xs px-1 bg-amber-100 text-amber-800 rounded font-semibold">Lansia</span>}
                          {w.isBalita && <span className="text-xs px-1 bg-purple-100 text-purple-800 rounded font-semibold">Balita</span>}
                          {w.isYatim && <span className="text-xs px-1 bg-teal-100 text-teal-800 rounded font-semibold">Yatim</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          KK: {w.nomorKK} &bull; {w.statusHubunganKK} &bull; {w.pekerjaan || 'Wiraswasta'} &bull; Status: {w.statusTinggal}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Kartu Keluarga */}
          {filtered.kk.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 px-1">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  Data Kartu Keluarga ({filtered.kk.length})
                </span>
                <span>Pilih untuk Lihat Anggota</span>
              </div>
              <div className="space-y-1.5">
                {filtered.kk.map((k) => (
                  <div
                    key={k.id}
                    onClick={() => {
                      onSelectKK(k);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl hover:bg-blue-50/80 border border-slate-100 hover:border-blue-200 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 group-hover:text-blue-800">
                          Kepala KK: {k.kepalaKeluargaNama}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-semibold">
                          No. KK: {k.nomorKK}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {k.statusDomisili}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {k.alamat} ({k.blokRumah}) &bull; {k.anggota?.length || 0} Anggota Keluarga
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Surat Pengantar */}
          {filtered.surat.length > 0 && (
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2 px-1">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  Surat Pengantar RT ({filtered.surat.length})
                </span>
                <span>Pilih untuk Cetak / Verifikasi</span>
              </div>
              <div className="space-y-1.5">
                {filtered.surat.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSurat(s);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl hover:bg-amber-50/80 border border-slate-100 hover:border-amber-200 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 group-hover:text-amber-800">
                          {s.judulSurat} - {s.namaPemohon}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                          s.status === 'DISETUJUI' ? 'bg-emerald-100 text-emerald-800' :
                          s.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        No: {s.nomorSurat} &bull; Keperluan: {s.keperluan}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-200 p-2.5 px-4 text-xs text-slate-500 flex items-center justify-between">
          <span>Pencarian instan data kependudukan RT 004 RW 007 Jatimulya</span>
          <span className="text-slate-500">Tekan ESC untuk menutup</span>
        </div>
      </div>
    </div>
  );
};
