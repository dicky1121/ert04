import { useEffect, useRef } from 'react';

/**
 * Perilaku keyboard standar untuk overlay modal.
 *
 * Sebelum hook ini hanya `ConfirmDialog` yang bisa ditutup dengan Escape;
 * 25 berkas modal lain memerangkap pengguna keyboard — Tab bahkan bisa keluar
 * dari modal ke konten latar yang tersembunyi di belakang overlay. Hook ini
 * mengangkat pola yang sudah terbukti di `ConfirmDialog` menjadi satu sumber
 * kebenaran dan menambah dua hal yang belum ada di sana: focus trap dan
 * pemulihan fokus.
 *
 * Yang ditangani:
 *  1. Escape  → memanggil `onClose`
 *  2. Fokus awal masuk ke elemen fokusabel pertama di dalam overlay
 *  3. Tab / Shift+Tab berputar di dalam overlay (focus trap)
 *  4. Saat modal tutup, fokus kembali ke elemen yang membukanya
 *
 * Yang SENGAJA tidak ditangani: mengunci scroll latar. Itu sudah dikerjakan
 * lewat CSS di `index.css` dengan `body:has([role='dialog'][aria-modal='true'])`
 * — satu aturan untuk semua modal, jadi tidak perlu diduplikasi di JS.
 * Konsekuensinya overlay WAJIB punya `role="dialog"` dan `aria-modal="true"`.
 *
 * Pemakaian:
 *   const ref = useModalDismiss<HTMLDivElement>(onClose);
 *   return <div ref={ref} role="dialog" aria-modal="true" …>…</div>;
 *
 * Untuk modal yang tampil bersyarat, lewatkan `aktif` agar listener hanya
 * terpasang saat modal benar-benar tampil:
 *   const ref = useModalDismiss<HTMLDivElement>(onClose, isOpen);
 */

/** Elemen yang bisa menerima fokus keyboard, dalam urutan dokumen. */
const SELECTOR_FOKUSABEL = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalDismiss<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  aktif: boolean = true
) {
  const containerRef = useRef<T>(null);

  // `onClose` disimpan di ref supaya effect utama tidak perlu memasang ulang
  // listener setiap render — pemanggil biasanya melewatkan arrow function baru
  // tiap kali. Penugasannya di dalam effect (bukan saat render) karena menulis
  // ref saat render dilarang aturan `react-hooks/refs`.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!aktif) return;
    const container = containerRef.current;
    if (!container) return;

    // Simpan pemicu SEBELUM fokus dipindah, supaya bisa dipulihkan saat tutup.
    const pemicu = document.activeElement as HTMLElement | null;

    const daftarFokusabel = () =>
      Array.from(container.querySelectorAll<HTMLElement>(SELECTOR_FOKUSABEL)).filter(
        // `offsetParent === null` menyaring elemen yang tersembunyi (mis. tab
        // form yang tidak aktif) — elemen begitu tidak boleh ikut urutan Tab.
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    // Fokus awal: elemen fokusabel pertama. Bila overlay belum punya elemen
    // fokusabel sama sekali, fokuskan kontainernya agar Escape tetap tertangkap.
    const target = daftarFokusabel()[0];
    if (target) {
      target.focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const fokusabel = daftarFokusabel();
      if (fokusabel.length === 0) {
        e.preventDefault();
        return;
      }

      const pertama = fokusabel[0];
      const terakhir = fokusabel[fokusabel.length - 1];
      const aktifSekarang = document.activeElement;

      // Putar fokus di ujung daftar. Cek `!container.contains` menangani kasus
      // fokus sedang di luar overlay (mis. baru saja modal dibuka lewat klik).
      if (e.shiftKey && (aktifSekarang === pertama || !container.contains(aktifSekarang))) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && aktifSekarang === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    };

    // Listener dipasang di dokumen, bukan di overlay: fokus bisa berada di
    // elemen yang secara DOM ada di luar overlay (mis. portal), dan Escape
    // harus tetap bekerja saat belum ada elemen yang fokus.
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Pulihkan fokus ke pemicu, tapi hanya bila elemennya masih ada di
      // dokumen — kalau modal ditutup bersamaan dengan hilangnya baris yang
      // membukanya, memaksa fokus ke elemen lepas akan melempar fokus ke <body>.
      if (pemicu && pemicu.isConnected) pemicu.focus();
    };
  }, [aktif]);

  return containerRef;
}
