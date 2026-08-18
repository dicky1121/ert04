# =====================================================================
# SIAPKAN APK UNTUK DISTRIBUSI
#
# Menyalin APK release hasil build ke Desktop dengan nama yang rapi,
# lalu menampilkan ringkasan (ukuran + sidik jari SHA-256 file) supaya
# bisa dicocokkan setelah diunggah ke Google Drive.
#
# Jalankan dari root proyek:
#     powershell -ExecutionPolicy Bypass -File scripts\siapkan-apk-distribusi.ps1
# =====================================================================

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$sumber = Join-Path $root 'android\app\build\outputs\apk\release\E-RT04-v1.0.0-release.apk'

if (-not (Test-Path $sumber)) {
    Write-Host "APK release TIDAK DITEMUKAN -> $sumber" -ForegroundColor Red
    Write-Host 'Build dulu:' -ForegroundColor Yellow
    Write-Host '  npm run build'
    Write-Host '  npx cap sync android'
    Write-Host '  npm run android:release'
    exit 1
}

$tujuan = Join-Path ([Environment]::GetFolderPath('Desktop')) 'E-RT04-v1.0.0.apk'
Copy-Item $sumber $tujuan -Force

$berkas  = Get-Item $tujuan
$ukuran  = [math]::Round($berkas.Length / 1MB, 2)
$sidikJari = (Get-FileHash $tujuan -Algorithm SHA256).Hash

Write-Host ''
Write-Host '=== APK SIAP DIKIRIM ===' -ForegroundColor Green
Write-Host "  Berkas   : $($berkas.FullName)"
Write-Host "  Ukuran   : $ukuran MB"
Write-Host "  SHA-256  : $sidikJari"
Write-Host "  Dibuat   : $($berkas.LastWriteTime)"
Write-Host ''
Write-Host 'LANGKAH DISTRIBUSI:' -ForegroundColor Cyan
Write-Host '  1. Upload berkas di atas ke Google Drive'
Write-Host '  2. Klik kanan -> Share -> "Anyone with the link" -> Copy link'
Write-Host '  3. Kirim link + panduan install ke grup WA RT 004'
Write-Host '     (teks siap pakai ada di PLAN_LENGKAP_BUILD_ANDROID.txt, Langkah 9)'
Write-Host ''
Write-Host 'CATATAN: warga yang sudah pasang versi lama cukup pasang APK ini'
Write-Host 'di atasnya (keystore sama), data tidak hilang.' -ForegroundColor Yellow
Write-Host ''
