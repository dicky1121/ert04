import { useEffect, useState } from 'react';
import { animate, type Variants } from 'motion/react';

/**
 * Preset animasi bersama untuk seluruh komponen Portal Warga.
 * Disatukan di sini agar konsisten dengan pola Beranda; setiap komponen
 * memanggil `useReducedMotion()` dan mem-bypass variants bila aktif.
 */

// ── Spring setting —————————————————————————————————————————————————————————
export const SPRING = {
  type: 'spring' as const,
  stiffness: 240,
  damping: 22,
  mass: 0.7,
};

// ── Container variants: stagger anak ———————————————————————————————————————
export const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

// ── Rise: elemen naik halus dari bawah ————————————————————————————————————
export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: SPRING },
};

// ── Fade + slide-in ringan (alternatif untuk transisi antar tab) ———————————
export const fadeSlide: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
};

// ── Tap scale (untuk tombol interaktif) ————————————————————————————————————
export const tapScale = { scale: 0.95 };

// ── Count-up hook: angka menghitung dari 0 → target saat pertama tampil ———
export const useCountUp = (target: number, enabled: boolean): number => {
  const [val, setVal] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [target, enabled]);
  return val;
};
