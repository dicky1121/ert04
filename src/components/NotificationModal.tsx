import React from 'react';
import { Bell, CheckCheck, Trash2, X, FileText, ArrowLeftRight, UserCheck, AlertCircle } from 'lucide-react';
import { Notifikasi } from '../types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifikasiList: Notifikasi[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onNavigateTab: (tab: string, entityId?: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifikasiList,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNavigateTab
}) => {
  if (!isOpen) return null;

  const unreadList = notifikasiList.filter(n => !n.dibaca);

  const getIcon = (tipe: Notifikasi['tipe']) => {
    switch (tipe) {
      case 'SURAT_BARU':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'MUTASI':
        return <ArrowLeftRight className="w-4 h-4 text-blue-600" />;
      case 'UPDATE_DATA':
        return <UserCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-16 bg-slate-900/40 backdrop-blur-xs"
      aria-label="Notifikasi"

    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Notifikasi Kependudukan RT</h3>
              <p className="text-[11px] text-slate-500">
                {unreadList.length > 0 ? `${unreadList.length} notifikasi baru perlu ditinjau` : 'Semua notifikasi sudah dibaca'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action toolbar */}
        {notifikasiList.length > 0 && (
          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
            <button
              onClick={onMarkAllRead}
              className="flex items-center gap-1 hover:text-emerald-700 font-medium transition cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tandai Semua Dibaca
            </button>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 hover:text-rose-600 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Semua
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="overflow-y-auto p-3 space-y-2 flex-1">
          {notifikasiList.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-semibold text-slate-600">Belum ada notifikasi</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pemberitahuan permohonan surat & mutasi akan tampil di sini.
              </p>
            </div>
          ) : (
            notifikasiList.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  onMarkRead(notif.id);
                  onNavigateTab(notif.linkTab, notif.entityId);
                  onClose();
                }}
                className={`p-3 rounded-xl border text-xs transition cursor-pointer flex items-start gap-3 ${
                  notif.dibaca
                    ? 'bg-white border-slate-100 hover:bg-slate-50'
                    : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60 shadow-2xs'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  notif.dibaca ? 'bg-slate-100 text-slate-600' : 'bg-white text-emerald-700 shadow-2xs'
                }`}>
                  {getIcon(notif.tipe)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h4 className={`font-semibold text-xs truncate ${notif.dibaca ? 'text-slate-700' : 'text-slate-900 font-bold'}`}>
                      {notif.judul}
                    </h4>
                    {!notif.dibaca && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                    {notif.pesan}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-1.5 flex items-center justify-between">
                    <span>{notif.timestamp}</span>
                    <span className="text-emerald-700 font-medium hover:underline">Buka & Periksa &rarr;</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
          <button
            onClick={onClose}
            className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition"
          >
            Tutup Notifikasi
          </button>
        </div>
      </div>
    </div>
  );
};
