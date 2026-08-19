# =====================================================================
# CEK ISI APK - membuka APK release dan memeriksa bundle di DALAMNYA.
#
# Berbeda dari cek-bundle-notif.ps1 yang memeriksa folder sumber, skrip ini
# memeriksa berkas APK yang akan dibagikan ke warga. Inilah bukti akhir
# bahwa kode perbaikan notifikasi benar-benar ikut terpasang di HP.
#
# CARA PAKAI: powershell -ExecutionPolicy Bypass -File scripts\cek-isi-apk-notif.ps1
# =====================================================================

$ErrorActionPreference = 'Stop'
$akar = Split-Path -Parent $PSScriptRoot
$apk  = Join-Path $akar 'android\app\build\outputs\apk\release\E-RT04-v1.0.0-release.apk'

Write-Host ''
Write-Host '=== CEK ISI APK RELEASE ===' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $apk)) {
    Write-Host 'GAGAL: APK release belum ada. Jalankan: cd android; .\gradlew assembleRelease' -ForegroundColor Red
    exit 1
}

$info = Get-Item $apk
Write-Host ("APK      : " + $info.Name)
Write-Host ("Ukuran   : " + [math]::Round($info.Length / 1MB, 2) + " MB")
Write-Host ("Dibuat   : " + $info.LastWriteTime)
Write-Host ''

# APK adalah arsip ZIP. Salin dengan ekstensi .zip supaya bisa diekstrak.
$kerja = Join-Path $env:TEMP ('cek-apk-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $kerja | Out-Null
$zip = Join-Path $kerja 'apk.zip'

try {
    Copy-Item $apk $zip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $arsip = [System.IO.Compression.ZipFile]::OpenRead($zip)

    # Ambil bundle JavaScript utama dari dalam APK.
    $entri = $arsip.Entries | Where-Object { $_.FullName -like 'assets/public/assets/index-*.js' } | Select-Object -First 1

    if (-not $entri) {
        Write-Host 'GAGAL: bundle index-*.js tidak ada di dalam APK.' -ForegroundColor Red
        $arsip.Dispose()
        exit 1
    }

    Write-Host ('Bundle di dalam APK : ' + $entri.FullName)
    Write-Host ''

    $pembaca = New-Object System.IO.StreamReader($entri.Open())
    $isi = $pembaca.ReadToEnd()
    $pembaca.Close()
    $arsip.Dispose()

    $penanda = [ordered]@{
        'Listener dipasang sebelum register()' = 'menunggu token dari Firebase'
        'Pelaporan kegagalan simpan token'     = 'Token FCM tersimpan di server'
        'Pendaftaran token via RPC'            = 'daftar_fcm_token'
        'Channel notifikasi ews_darurat'       = 'ews_darurat'
        'Penanganan registrationError'         = 'registrationError'
        'Panel status notifikasi di aplikasi'  = 'Status Notifikasi HP Ini'
        'Tombol daftarkan ulang'               = 'Daftarkan ulang'
    }

    $kurang = 0
    foreach ($kunci in $penanda.Keys) {
        if ($isi.Contains($penanda[$kunci])) {
            Write-Host ('  [ADA]    ' + $kunci) -ForegroundColor Green
        } else {
            Write-Host ('  [KURANG] ' + $kunci) -ForegroundColor Red
            $kurang++
        }
    }

    Write-Host ''
    if ($isi -match 'https://[a-z0-9]+\.supabase\.co') {
        Write-Host ('  [ADA]    Konfigurasi Supabase: ' + $Matches[0]) -ForegroundColor Green
    } else {
        Write-Host '  [KURANG] URL Supabase tidak ada di dalam APK' -ForegroundColor Red
        $kurang++
    }

    Write-Host ''
    if ($kurang -eq 0) {
        Write-Host 'HASIL: APK ini SIAP DIBAGIKAN - seluruh kode notifikasi sudah ikut.' -ForegroundColor Green
        Write-Host ''
        Write-Host 'Ingat di HP: uninstall aplikasi lama dulu, baru pasang APK ini,'
        Write-Host 'lalu izinkan notifikasi saat diminta.'
    } else {
        Write-Host ("HASIL: " + $kurang + " penanda tidak ada - JANGAN dibagikan dulu.") -ForegroundColor Red
        Write-Host 'Jalankan: npm run build; npx cap sync android; cd android; .\gradlew assembleRelease'
    }
    Write-Host ''
}
finally {
    if (Test-Path $kerja) { Remove-Item -Recurse -Force $kerja }
}
