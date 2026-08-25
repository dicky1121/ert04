// Konfigurasi ESLint (flat config, ESLint 9).
//
// Pembagian tugas dengan TypeScript: `tsc --noEmit` sudah menjaga kebenaran
// tipe, jadi ESLint di sini fokus pada hal yang TIDAK dilihat compiler —
// aturan React Hooks, sisa kode mati, dan pola yang mudah jadi bug halus.
// Karena itu dipakai preset `recommended` typescript-eslint yang TANPA
// type-checking: hasilnya sama tajamnya untuk keperluan ini, tapi jalannya
// beberapa kali lebih cepat sehingga `npm run lint` tetap enak dipakai.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `android/` berisi proyek Gradle hasil Capacitor (bukan sumber kita),
    // `supabase/functions/` berjalan di Deno dengan import lewat URL yang
    // tidak bisa diselesaikan resolver Node — keduanya juga sudah
    // dikecualikan di tsconfig.json. `gen-icons.cjs` adalah skrip sekali
    // jalan untuk membuat ikon launcher dan sudah menandai dirinya sendiri
    // dengan `/* eslint-disable */`; dimasukkan ke sini supaya penanda itu
    // tidak balik dilaporkan sebagai "disable directive tak terpakai".
    ignores: [
      'dist/**',
      'android/**',
      'node_modules/**',
      'supabase/functions/**',
      'gen-icons.cjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      // ── Sisa kode mati ────────────────────────────────────────────────
      // Aturan bawaan diganti versi TS-nya agar tidak salah tuduh pada
      // tipe & enum. Argumen yang diawali `_` dibiarkan: dipakai untuk
      // penanda posisi, mis. `.filter((_, i) => …)`.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none', // `catch (err)` yang tak dipakai itu wajar
        },
      ],

      // ── `any` ──────────────────────────────────────────────────────────
      // Sengaja hanya peringatan. Baris cloud di service memang datang
      // sebagai JSON tak bertipe dari Supabase dan sudah dinormalkan oleh
      // mapper `from…Row()`; menjadikannya error hanya akan memaksa
      // `unknown` + type guard berlapis tanpa menambah keamanan nyata.
      '@typescript-eslint/no-explicit-any': 'warn',

      // ── Pola yang gampang jadi bug halus ──────────────────────────────
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-implicit-coercion': ['warn', { boolean: false }],

      // React Hooks: dependensi yang kurang adalah sumber bug data basi
      // yang paling sering di layar-layar ini, jadi tetap peringatan keras
      // (bukan dimatikan) walau kadang perlu dikecualikan per baris.
      'react-hooks/exhaustive-deps': 'warn',

      // ── Aturan era React Compiler yang diturunkan ke peringatan ───────
      // eslint-plugin-react-hooks v7 memuat ruleset React Compiler.
      // Proyek ini belum memakai compiler-nya, dan dua aturan di bawah
      // menyala di kode yang sudah berjalan baik:
      //
      // • set-state-in-effect — 20 titik, hampir semuanya pola "muat data
      //   saat mount lalu setState". Membetulkannya berarti membongkar
      //   seluruh alur pemuatan data tiap layar; itu pekerjaan tersendiri,
      //   bukan bagian dari memasang linter. Dibiarkan terlihat sebagai
      //   peringatan supaya tetap tercatat, bukan dimatikan.
      //
      // • purity — memberi positif palsu di SuratPengantarView: `Date.now()`
      //   di sana dipanggil dari handler submit, bukan saat render, tetapi
      //   aturan ini tidak dapat membedakannya.
      //
      // Aturan compiler lain yang saat ini bersih dibiarkan 'error' agar
      // menjaga kode baru.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',

      // Hanya memengaruhi kualitas hot-reload saat pengembangan, bukan
      // kebenaran hasil build. Beberapa berkas memang sengaja mengekspor
      // komponen bersama konstanta/hook pendampingnya.
      'react-refresh/only-export-components': 'warn',
    },
  },

  {
    // Berkas konfigurasi & skrip berjalan di Node, bukan browser.
    files: [
      'eslint.config.js',
      'vite.config.ts',
      'capacitor.config.ts',
      'scripts/**/*.{js,mjs,cjs,ts}',
      '**/*.{cjs,mjs}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
