# =====================================================================
# CEK BUNDLE NOTIFIKASI - apakah kode perbaikan notifikasi sudah ikut
# masuk ke dalam APK yang dipasang di HP warga?
#
# Kode JavaScript aplikasi ada di android\app\src\main\assets\public.
# Folder itu HANYA diperbarui oleh `npx cap sync android`. Kalau kode
# TypeScript sudah diperbaiki tetapi build belum dijalankan, APK di HP
# masih memakai kode lama -> notifikasi tidak akan pernah masuk.
#
# CARA PAKAI:  powershell -ExecutionPolicy Bypass -File scripts\cek-bundle-notif.ps1
# =====================================================================

$ErrorActionPreference = 'Stop'
$akar   = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $akar 'android\app\src\main\assets\public\assets'

Write-Host ''
Write-Host '=== CEK ISI BUNDLE APLIKASI ANDROID ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $folder)) {
    Write-Host 'GAGAL: folder bundle Android belum ada.' -ForegroundColor Red
    Write-Host 'Jalankan dulu:  npm run build ; npx cap sync android'
    exit 1
}

$berkas = Get-ChildItem -Path $folder -Filter 'index-*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $berkas) {
    Write-Host 'GAGAL: file index-*.js tidak ditemukan di bundle.' -ForegroundColor Red
    exit 1
}

Write-Host ("Bundle aktif : " + $berkas.Name)
Write-Host ("Dibuat pada  : " + $berkas.LastWriteTime)
Write-Host ''

# Penanda dari kode perbaikan. Semua HARUS "ADA".
$penanda = [ordered]@{
    'Listener dipasang sebelum register()' = 'menunggu token dari Firebase'
    'Pelaporan kegagalan simpan token'     = 'Token FCM tersimpan di server'
    'Pendaftaran token via RPC'            = 'daftar_fcm_token'
    'Channel notifikasi ews_darurat'       = 'ews_darurat'
    'Penanganan registrationError'         = 'registrationError'
    'Pintu diagnosa dari DevTools'         = 'ewsDaftarkanUlangNotifikasi'
}

$isi     = Get-Content -Path $berkas.FullName -Raw
$kurang  = 0

foreach ($kunci in $penanda.Keys) {
    $teks = $penanda[$kunci]
    if ($isi.Contains($teks)) {
        Write-Host ('  [ADA]    ' + $kunci) -ForegroundColor Green
    } else {
        Write-Host ('  [KURANG] ' + $kunci) -ForegroundColor Red
        $kurang++
    }
}

# Konfigurasi Supabase wajib ter-bundle, kalau kosong token tidak bisa
# didaftarkan sama sekali karena client Supabase tidak pernah terbentuk.
Write-Host ''
if ($isi -match 'https://[a-z0-9]+\.supabase\.co') {
    Write-Host ('  [ADA]    Konfigurasi Supabase: ' + $Matches[0]) -ForegroundColor Green
} else {
    Write-Host '  [KURANG] URL Supabase tidak ada di bundle - isi .env lalu build ulang' -ForegroundColor Red
    $kurang++
}

Write-Host ''
if ($kurang -eq 0) {
    Write-Host 'HASIL: bundle sudah memuat seluruh kode perbaikan notifikasi.' -ForegroundColor Green
    Write-Host 'Bila notifikasi masih belum masuk, periksa sisi database:'
    Write-Host '  jalankan scripts\diagnosa-notifikasi-ews.sql di Supabase SQL Editor.'
} else {
    Write-Host ("HASIL: " + $kurang + " penanda tidak ditemukan - APK memakai kode LAMA.") -ForegroundColor Red
    Write-Host ''
    Write-Host 'PERBAIKAN (jalankan berurutan):' -ForegroundColor Yellow
    Write-Host '  npm run build'
    Write-Host '  npx cap sync android'
    Write-Host '  cd android; .\gradlew assembleRelease; cd ..'
    Write-Host ''
    Write-Host 'Lalu di HP: uninstall aplikasi lama, pasang APK baru, izinkan notifikasi.'
}
Write-Host ''
