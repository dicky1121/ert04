import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';
import { useModalDismiss } from '../hooks/useModalDismiss';

export type ConfirmTone = 'danger' | 'warning' | 'info';

export interface ConfirmOptions {
  /** Judul singkat, mis. "Hapus Data Warga". */
  title: string;
  /** Penjelasan konsekuensi tindakan bagi pengurus RT. */
  message: string;
  /** Label tombol aksi utama. */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  /** Bila true, dialog hanya berisi satu tombol (pengganti window.alert). */
  infoOnly?: boolean;
}

const toneStyles: Record<ConfirmTone, { icon: React.ReactNode; iconWrap: string; action: string }> = {
  danger: {
    icon: <Trash2 className="w-5 h-5" />,
    iconWrap: 'bg-rose-100 text-rose-700',
    action: 'bg-rose-600 hover:bg-rose-700 text-white'
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    iconWrap: 'bg-amber-100 text-amber-800',
    action: 'bg-amber-600 hover:bg-amber-700 text-white'
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    iconWrap: 'bg-emerald-100 text-emerald-800',
    action: 'bg-brand-600 hover:bg-brand-700 text-white'
  }
};

interface ConfirmDialogProps extends ConfirmOptions {
  onResolve: (value: boolean) => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  tone = 'danger',
  infoOnly = false,
  onResolve
}) => {
  const styles = toneStyles[tone];
  const actionRef = useRef<HTMLButtonElement>(null);

  // Escape, focus trap, dan pemulihan fokus ditangani hook bersama.
  const dialogRef = useModalDismiss<HTMLDivElement>(() => onResolve(false));

  // Fokus otomatis ke tombol aksi agar dialog bisa dioperasikan lewat keyboard.
  // Effect ini dideklarasikan setelah hook di atas, jadi fokusnya menang atas
  // fokus awal generik hook (yang akan mendarat di tombol tutup).
  React.useEffect(() => {
    actionRef.current?.focus();
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-5 flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles.iconWrap}`}>
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="font-bold text-slate-900 text-sm leading-snug">
              {title}
            </h3>
            <p id="confirm-dialog-message" className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onResolve(false)}
            aria-label="Tutup dialog"
            className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!infoOnly && (
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={actionRef}
            type="button"
            onClick={() => onResolve(true)}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer ${styles.action}`}
          >
            {confirmLabel || (infoOnly ? 'Mengerti' : 'Ya, Lanjutkan')}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Pengganti window.confirm() / window.alert() agar tampilannya konsisten
 * dengan modal lain di aplikasi.
 *
 * Pemakaian:
 *   const { confirm, notify, dialog } = useConfirm();
 *   if (await confirm({ title, message })) { ... }
 *   ...
 *   return (<>{dialog}...</>);
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const notify = useCallback((options: Omit<ConfirmOptions, 'infoOnly'>) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, infoOnly: true, tone: options.tone || 'info', resolve });
    });
  }, []);

  const dialog = state ? (
    <ConfirmDialog
      {...state}
      onResolve={(value) => {
        state.resolve(value);
        setState(null);
      }}
    />
  ) : null;

  return { confirm, notify, dialog };
}

export default ConfirmDialog;
