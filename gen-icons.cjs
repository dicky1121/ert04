/* eslint-disable */
// Generator ikon launcher Android dari assets/_src-icon.jpeg memakai jimp (pure JS).
// Varian: SHIELD-ONLY (emblem tanpa wordmark "WARGA DIGITAL") — pilihan tepat untuk launcher icon:
//   wordmark tetap tampil di splash & dalam app; emblem shield bersih di mask lingkaran & persegi.
// - autocrop margin putih -> crop pita teks bawah -> autocrop lagi (emblem shield rapat).
// - Kanvas putih (mulus dgn @color/ic_launcher_background #FFFFFF).
// - Fill: adaptive foreground 0.70 (aman safe-zone), legacy kotak 0.80, legacy bulat 0.70.
const Jimp = require('jimp');
const path = require('path');

const ROOT = __dirname;
const RES = path.join(ROOT, 'android/app/src/main/res');
const SRC = path.join(ROOT, 'assets/_src-icon.jpeg');
const WHITE = 0xffffffff;
const TOL = 0.06;
const FILL_FG = 0.70;      // adaptive foreground (108dp) — aman thd mask lingkaran
const FILL_LEGACY = 0.80;  // legacy ic_launcher.png (kotak/rounded)
const FILL_ROUND = 0.70;   // legacy ic_launcher_round.png (dimask bulat)

// [folder, ukuran legacy px, ukuran adaptive foreground px (108dp)]
const densities = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
];

function place(size, logo, fill) {
  const c = new Jimp(size, size, WHITE);
  const box = Math.round(size * fill);
  const l = logo.clone().scaleToFit(box, box);
  c.composite(l, Math.round((size - l.bitmap.width) / 2), Math.round((size - l.bitmap.height) / 2));
  return c;
}

(async () => {
  const orig = await Jimp.read(SRC);
  const full = orig.clone().autocrop(TOL, false);
  const W = full.bitmap.width, H = full.bitmap.height;
  const shield = full.clone().crop(0, 0, W, Math.round(H * 0.86)).autocrop(TOL, false);
  console.log('shield emblem:', shield.bitmap.width + 'x' + shield.bitmap.height);
  await shield.clone().writeAsync(path.join(ROOT, 'assets/_shield_emblem.png'));

  for (const [d, legacy, adaptive] of densities) {
    const dir = path.join(RES, 'mipmap-' + d);
    await place(legacy, shield, FILL_LEGACY).writeAsync(path.join(dir, 'ic_launcher.png'));
    await place(legacy, shield, FILL_ROUND).writeAsync(path.join(dir, 'ic_launcher_round.png'));
    await place(adaptive, shield, FILL_FG).writeAsync(path.join(dir, 'ic_launcher_foreground.png'));
  }
  console.log('DONE final icons (shield-only)');
})().catch(e => { console.error('ERR', e); process.exit(1); });
