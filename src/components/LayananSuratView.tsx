import React, { useState } from 'react';
import { FileSignature, Archive, FileText } from 'lucide-react';
import { RTConfig, Warga, SuratPengantar } from '../types';
import { TemplateSuratPengantarView } from './TemplateSuratPengantarView';
import { SuratPengantarView } from './SuratPengantarView';

interface LayananSuratViewProps {
  config: RTConfig;
  wargaList: Warga[];
  suratList: SuratPengantar[];
  onSaveConfig: (updated: RTConfig) => Promise<boolean>;
  onAddSurat: (surat: any) => Promise<boolean>;
  onUpdateStatus: (id: string, status: 'DISETUJUI' | 'DITOLAK', alasan?: string) => Promise<boolean>;
  onDeleteSurat: (id: string) => Promise<boolean>;
  selectedSuratId?: string | null;
}

type SectionKey = 'FORMAT' | 'ARSIP';

/**
 * Pusat Layanan Surat Pengantar RT.
 *
 * Menggabungkan dua fungsi yang sebelumnya terpisah pada dua menu:
 *  - Penyusunan / pencetakan surat & pengaturan format kop (TemplateSuratPengantarView)
 *  - Arsip permohonan, verifikasi, dan riwayat surat (SuratPengantarView)
 */
export const LayananSuratView: React.FC<LayananSuratViewProps> = ({
  config,
  wargaList,
  suratList,
  onSaveConfig,
  onAddSurat,
  onUpdateStatus,
  onDeleteSurat,
  selectedSuratId
}) => {
  const [section, setSection] = useState<SectionKey>(selectedSuratId ? 'ARSIP' : 'FORMAT');

  const pendingCount = suratList.filter(s => s.status === 'PENDING').length;

  const sections: { key: SectionKey; label: string; desc: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'FORMAT',
      label: 'Penyusunan & Format Surat',
      desc: 'Isi data pemohon, atur kop resmi, cetak & unduh dokumen',
      icon: <FileSignature className="w-4 h-4" />
    },
    {
      key: 'ARSIP',
      label: 'Arsip & Verifikasi Permohonan',
      desc: 'Riwayat surat terbit, permohonan menunggu persetujuan',
      icon: <Archive className="w-4 h-4" />,
      badge: pendingCount
    }
  ];

  return (
    <div className="space-y-6">
      {/* Section Header — formal government tone with modern surface */}
      <div className="no-print relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-400" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Layanan Surat Pengantar RT
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Penyusunan, penomoran, arsip, dan verifikasi surat pengantar resmi RT {config.namaRT} RW {config.namaRW} Kelurahan {config.kelurahan}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
                {suratList.length} Dokumen
              </span>
              {pendingCount > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                  {pendingCount} Menunggu
                </span>
              )}
            </div>
          </div>

          {/* Segmented navigation between the two merged functions */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sections.map(item => {
              const isActive = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  aria-pressed={isActive}
                  className={`group text-left p-3.5 rounded-xl border transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                    isActive
                      ? 'border-emerald-300 bg-emerald-50/60 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className={`block text-xs font-bold truncate ${isActive ? 'text-emerald-900' : 'text-slate-800'}`}>
                          {item.label}
                        </span>
                        {item.badge ? (
                          <span className="px-1.5 rounded-full bg-amber-400 text-slate-950 text-xs font-bold shrink-0">
                            {item.badge}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 leading-snug">
                        {item.desc}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {section === 'FORMAT' && (
        <TemplateSuratPengantarView
          config={config}
          wargaList={wargaList}
          onSaveConfig={onSaveConfig}
          onAddSurat={onAddSurat}
        />
      )}

      {section === 'ARSIP' && (
        <SuratPengantarView
          suratList={suratList}
          wargaList={wargaList}
          config={config}
          onAddSurat={onAddSurat}
          onUpdateStatus={onUpdateStatus}
          onDeleteSurat={onDeleteSurat}
          selectedSuratId={selectedSuratId}
        />
      )}
    </div>
  );
};
