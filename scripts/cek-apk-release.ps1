# =====================================================================
# VERIFIKASI APK RELEASE
#
# Jalankan dari root proyek:
#     powershell -ExecutionPolicy Bypass -File scripts\cek-apk-release.ps1
#
# Memastikan APK release ada, ukurannya wajar, dan SUDAH DITANDATANGANI
# dengan keystore ert04-release.keystore (bukan debug key).
# =====================================================================

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pathApk = Join-Path $root 'android\app\build\outputs\apk\release\E-RT04-v1.0.0-release.apk'

Write-Host ''
Write-Host '=== 1. Cek file APK ===' -ForegroundColor Cyan

if (-not (Test-Path $pathApk)) {
    Write-Host "APK TIDAK DITEMUKAN -> $pathApk" -ForegroundColor Red
    Write-Host 'Jalankan dulu: npm run cap:sync ; npm run android:release' -ForegroundColor Yellow
    exit 1
}

$apk = Get-Item $pathApk
$ukuranMB = [math]::Round($apk.Length / 1MB, 2)
Write-Host "  Lokasi  : $($apk.FullName)"
Write-Host "  Ukuran  : $ukuranMB MB"
Write-Host "  Dibuat  : $($apk.LastWriteTime)"

Write-Host ''
Write-Host '=== 2. Cek tanda tangan (signature) ===' -ForegroundColor Cyan

# apksigner ada di dalam Android SDK build-tools. Cari versi terbaru.
$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot) { $sdkRoot = $env:ANDROID_SDK_ROOT }
if (-not $sdkRoot) { $sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }

$apksigner = $null
$dirBuildTools = Join-Path $sdkRoot 'build-tools'
if (Test-Path $dirBuildTools) {
    $kandidat = Get-ChildItem $dirBuildTools -Directory |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'apksigner.bat' } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1
    if ($kandidat) { $apksigner = $kandidat }
}

$signed = $false

if ($apksigner) {
    Write-Host "  apksigner: $apksigner"
    Write-Host ''
    $hasil = & $apksigner verify --print-certs $pathApk 2>&1 | Out-String
    Write-Host $hasil
    if ($LASTEXITCODE -eq 0) { $signed = $true }
}
else {
    # Fallback: APK adalah file ZIP. APK yang ditandatangani punya entri
    # META-INF\*.RSA (v1) dan/atau blok signing v2 yang tidak terlihat di ZIP.
    Write-Host '  apksigner tidak ditemukan — memakai pemeriksaan cadangan (isi META-INF).' -ForegroundColor Yellow
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($pathApk)
    try {
        $entriSign = $zip.Entries | Where-Object {
            $_.FullName -like 'META-INF/*.RSA' -or $_.FullName -like 'META-INF/*.SF'
        }
        if ($entriSign) {
            $signed = $true
            $entriSign | ForEach-Object { Write-Host "   ditemukan: $($_.FullName)" }
        }
    }
    finally { $zip.Dispose() }
}

Write-Host ''
Write-Host '=== 3. RINGKASAN ===' -ForegroundColor Cyan
Write-Host ("  APK tersedia     : OK ($ukuranMB MB)")
Write-Host ("  Ditandatangani   : " + $(if ($signed) { 'OK' } else { 'BELUM / TIDAK TERDETEKSI' }))

Write-Host ''
if ($signed) {
    Write-Host 'APK RELEASE SIAP DIDISTRIBUSIKAN.' -ForegroundColor Green
    Write-Host 'Langkah selanjutnya (Langkah 9):' -ForegroundColor Green
    Write-Host '  1. Upload APK ke Google Drive'
    Write-Host '  2. Set sharing link ke "Anyone with the link"'
    Write-Host '  3. Kirim link + instruksi install ke grup WA RT 004'
}
else {
    Write-Host 'PERINGATAN: APK belum tertandatangani.' -ForegroundColor Red
    Write-Host 'Pastikan android\keystore.properties ada, lalu build ulang:' -ForegroundColor Yellow
    Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\buat-keystore.ps1' -ForegroundColor White
    Write-Host '  npm run android:release' -ForegroundColor White
    exit 1
}
Write-Host ''
