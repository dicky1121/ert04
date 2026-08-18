# =====================================================================
# BACKUP KEYSTORE RELEASE  (WAJIB - jangan ditunda!)
#
# Jalankan:
#     powershell -ExecutionPolicy Bypass -File scripts\backup-keystore.ps1
#
# Atau tentukan folder tujuan sendiri (mis. Google Drive / flashdisk):
#     powershell -ExecutionPolicy Bypass -File scripts\backup-keystore.ps1 -Tujuan "D:\Backup-ERT04"
#
# KENAPA WAJIB:
#   Keystore adalah "stempel digital" aplikasi. Kalau file ini hilang,
#   Anda TIDAK BISA lagi mengirim update APK. Warga harus uninstall
#   aplikasi lama lalu install ulang dari nol.
#
# CATATAN: file ini sengaja memakai karakter ASCII saja supaya aman
# dijalankan di Windows PowerShell 5.1 (yang membaca skrip sebagai ANSI).
# =====================================================================

param(
    [string]$Tujuan = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Default: folder Documents\Backup-ERT04-Keystore
if ([string]::IsNullOrWhiteSpace($Tujuan)) {
    $Tujuan = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Backup-ERT04-Keystore'
}

$berkas = @(
    'android\ert04-release.keystore',
    'android\keystore.properties',
    'android\app\google-services.json'
)

Write-Host ''
Write-Host '=== BACKUP KEYSTORE E-RT04 ===' -ForegroundColor Cyan
Write-Host "Tujuan: $Tujuan"
Write-Host ''

if (-not (Test-Path $Tujuan)) {
    New-Item -ItemType Directory -Path $Tujuan -Force | Out-Null
    Write-Host 'Folder tujuan dibuat.' -ForegroundColor Green
}

$jumlahOk = 0
foreach ($b in $berkas) {
    $sumber = Join-Path $root $b
    $nama   = Split-Path $b -Leaf

    if (Test-Path $sumber) {
        Copy-Item $sumber (Join-Path $Tujuan $nama) -Force
        Write-Host "  [OK]    $nama" -ForegroundColor Green
        $jumlahOk++
    }
    else {
        Write-Host "  [LEWAT] $nama (tidak ditemukan)" -ForegroundColor Yellow
    }
}

# Catatan pendamping agar detail signing tidak terlupa
$tanggal = Get-Date -Format 'dd-MM-yyyy HH:mm'
$catatan = @"
BACKUP KEYSTORE APLIKASI E-RT04
Dibuat: $tanggal

Package name : id.go.bekasi.jatimulya.rt004
Alias key    : ert04
Password     : TIDAK dicatat di sini. Password store & key sama, dan
               tersimpan di file keystore.properties yang ikut dibackup
               di folder ini. Salin juga ke password manager pribadi Anda.
Sertifikat   : CN=E-RT04 Jatimulya, OU=RT 004, O=Kelurahan Jatimulya
Berlaku      : 10.000 hari (s/d Januari 2054)


CARA PAKAI JIKA PC RUSAK / GANTI KOMPUTER:
  1. Clone ulang project dari GitHub.
  2. Copy ert04-release.keystore     -> android\
  3. Copy keystore.properties        -> android\
  4. Copy google-services.json       -> android\app\
  5. npm install
  6. npm run cap:sync
  7. npm run android:release

JANGAN UNGGAH FILE-FILE INI KE GITHUB ATAU GRUP WHATSAPP.
Simpan minimal di 2 tempat: cloud pribadi (Google Drive) + flashdisk.
"@

Set-Content -Path (Join-Path $Tujuan 'BACA-SAYA-PENTING.txt') -Value $catatan -Encoding UTF8
Write-Host '  [OK]    BACA-SAYA-PENTING.txt' -ForegroundColor Green

Write-Host ''
Write-Host "Selesai. $jumlahOk berkas penting tersalin." -ForegroundColor Green
Write-Host ''
Write-Host 'LANGKAH TERAKHIR (manual, tidak bisa diotomatiskan):' -ForegroundColor Yellow
Write-Host '  Upload folder backup ini ke Google Drive pribadi Anda,'
Write-Host '  DAN copy juga ke flashdisk. Minimal 2 tempat berbeda.'
Write-Host ''

# Buka folder backup di File Explorer supaya mudah di-drag ke Drive
Start-Process explorer.exe $Tujuan
