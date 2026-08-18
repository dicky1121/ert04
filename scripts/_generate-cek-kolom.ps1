# =====================================================================
# Generator scripts/cek-kolom-kurang.sql
# ---------------------------------------------------------------------
# Membaca setup-skema-utama.sql, mengekstrak daftar (tabel, kolom) yang
# DIHARAPKAN oleh versi kode saat ini, lalu menghasilkan satu query SQL
# yang membandingkannya dengan kolom yang BENAR-BENAR ada di database.
#
# Dipakai untuk mendeteksi schema drift: CREATE TABLE IF NOT EXISTS
# TIDAK menambah kolom pada tabel yang sudah ada, sehingga database yang
# dibuat dari skema versi lama bisa kekurangan kolom tanpa error apa pun
# saat SQL dijalankan.
#
# Jalankan: powershell -File scripts\_generate-cek-kolom.ps1
# =====================================================================

$ErrorActionPreference = 'Stop'
$root   = Split-Path -Parent $PSScriptRoot
$skema  = Join-Path $root 'scripts\setup-skema-utama.sql'
$keluar = Join-Path $root 'scripts\cek-kolom-kurang.sql'

$isi = Get-Content $skema -Raw

# Tangkap tiap blok CREATE TABLE IF NOT EXISTS <nama> ( ... );
$pola = [regex]'CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\r?\n\s*\);'
$cocok = $pola.Matches($isi)

# Baris yang bukan definisi kolom
$bukanKolom = '^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE)\b'

$pasangan = New-Object System.Collections.Generic.List[string]
$ringkas  = New-Object System.Collections.Generic.List[string]

foreach ($m in $cocok) {
    $tabel = $m.Groups[1].Value
    $body  = $m.Groups[2].Value
    $jml   = 0

    foreach ($baris in ($body -split "`n")) {
        $b = $baris.Trim()
        if ($b -eq '' -or $b.StartsWith('--')) { continue }
        $b = $b -replace ',\s*$', ''
        if ($b -match $bukanKolom) { continue }
        if ($b -notmatch '^([A-Za-z_][A-Za-z0-9_]*)') { continue }

        $kolom = $Matches[1]
        $pasangan.Add("    ('$tabel', '$kolom')")
        $jml++
    }
    $ringkas.Add("--   $tabel : $jml kolom")
}

$header = @"
-- =====================================================================
-- E-RT04 - CEK KOLOM YANG KURANG (READ-ONLY / AMAN)
-- ---------------------------------------------------------------------
-- DIHASILKAN OTOMATIS oleh scripts/_generate-cek-kolom.ps1 dari
-- scripts/setup-skema-utama.sql. Jangan diedit manual.
--
-- Skrip ini HANYA MEMBACA. Tujuannya mendeteksi schema drift:
-- CREATE TABLE IF NOT EXISTS tidak menambah kolom pada tabel yang sudah
-- ada, jadi database yang dibuat dari skema versi lama bisa kekurangan
-- kolom tanpa memunculkan error saat SQL dijalankan. Kekurangan itu
-- baru terasa nanti sebagai gagal insert/update dari aplikasi.
--
-- Cara pakai: copy seluruh isi file ini ke Supabase SQL Editor, Run.
--
-- Cara baca hasil:
--   status = 'KOLOM KURANG'  -> perlu ALTER TABLE ADD COLUMN
--   status = 'TABEL BELUM ADA' -> cukup jalankan setup-skema-utama.sql
--   0 rows                   -> skema sudah lengkap, tidak perlu apa pun
--
-- Jumlah kolom yang diharapkan per tabel:
$($ringkas -join "`n")
-- =====================================================================

WITH diharapkan (nama_tabel, nama_kolom) AS (
    VALUES
$($pasangan -join ",`n")
),
tabel_ada AS (
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
),
kolom_ada AS (
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
)
SELECT
    d.nama_tabel,
    d.nama_kolom,
    CASE
        WHEN t.table_name IS NULL THEN 'TABEL BELUM ADA - jalankan setup-skema-utama.sql'
        ELSE 'KOLOM KURANG - perlu ALTER TABLE ADD COLUMN'
    END AS status
FROM diharapkan d
LEFT JOIN tabel_ada t ON t.table_name  = d.nama_tabel
LEFT JOIN kolom_ada k ON k.table_name  = d.nama_tabel
                     AND k.column_name = d.nama_kolom
WHERE k.column_name IS NULL
ORDER BY d.nama_tabel, d.nama_kolom;
"@

Set-Content -Path $keluar -Value $header -Encoding UTF8

Write-Output "DIBUAT : $keluar"
Write-Output "TABEL  : $($cocok.Count)"
Write-Output "KOLOM  : $($pasangan.Count)"
Write-Output ''
$ringkas | ForEach-Object { Write-Output $_ }
