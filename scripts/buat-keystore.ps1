# =====================================================================
# BUAT KEYSTORE RELEASE + keystore.properties  (Langkah 8)
#
# Jalankan dari root proyek:
#     powershell -ExecutionPolicy Bypass -File scripts\buat-keystore.ps1
#
# Script ini AMAN dijalankan berulang: kalau keystore sudah ada, ia tidak
# akan menimpanya (menimpa keystore = APK update tidak bisa di-install
# di atas versi lama).
#
# PENTING: android/ert04-release.keystore dan android/keystore.properties
# TIDAK di-commit ke git (sudah tercantum di .gitignore). BACKUP keduanya
# ke tempat aman — kalau hilang, Anda tidak bisa merilis update aplikasi.
#
# PASSWORD TIDAK DITULIS DI DALAM SCRIPT INI. Urutan pengambilannya:
#   1. Parameter  -Password "..."      (paling tidak disarankan, tampil di histori shell)
#   2. Variabel lingkungan  ERT04_KEYSTORE_PASSWORD
#   3. Dibaca ulang dari android\keystore.properties (kalau sudah pernah dibuat)
#   4. Ditanyakan lewat prompt tersembunyi (Read-Host -AsSecureString)
# =====================================================================

param(
    [string]$Password = ''
)

$ErrorActionPreference = 'Stop'


# Pindah ke root proyek (folder induk dari scripts\)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$namaKeystore = 'ert04-release.keystore'
$pathKeystore = Join-Path $root "android\$namaKeystore"
$pathProps    = Join-Path $root 'android\keystore.properties'
$alias        = 'ert04'
$dname        = 'CN=E-RT04 Jatimulya, OU=RT 004, O=Kelurahan Jatimulya, L=Tambun Selatan, ST=Jawa Barat, C=ID'

# ---------------------------------------------------------------------
# Ambil password TANPA menuliskannya di dalam file ini.
# ---------------------------------------------------------------------
function Get-KeystorePassword {
    param([string]$FromParam, [string]$PropsPath)

    # 1. Parameter -Password
    if (-not [string]::IsNullOrWhiteSpace($FromParam)) {
        Write-Host '  Sumber password: parameter -Password' -ForegroundColor DarkGray
        return $FromParam
    }

    # 2. Variabel lingkungan
    if (-not [string]::IsNullOrWhiteSpace($env:ERT04_KEYSTORE_PASSWORD)) {
        Write-Host '  Sumber password: env ERT04_KEYSTORE_PASSWORD' -ForegroundColor DarkGray
        return $env:ERT04_KEYSTORE_PASSWORD
    }

    # 3. keystore.properties yang sudah ada (file ini gitignored)
    if (Test-Path $PropsPath) {
        $baris = Select-String -Path $PropsPath -Pattern '^\s*storePassword\s*=\s*(.+)$' |
            Select-Object -First 1
        if ($baris) {
            $nilai = $baris.Matches[0].Groups[1].Value.Trim()
            if (-not [string]::IsNullOrWhiteSpace($nilai)) {
                Write-Host '  Sumber password: android\keystore.properties yang sudah ada' -ForegroundColor DarkGray
                return $nilai
            }
        }
    }

    # 4. Prompt tersembunyi
    Write-Host ''
    Write-Host '  Password keystore belum tersedia. Masukkan sekarang (tidak akan tampil).' -ForegroundColor Yellow
    Write-Host '  Tips: simpan di password manager, JANGAN di dalam file proyek.' -ForegroundColor Yellow
    $secure = Read-Host '  Password keystore' -AsSecureString
    $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try   { $nilai = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

    if ([string]::IsNullOrWhiteSpace($nilai)) { throw 'Password keystore tidak boleh kosong.' }
    if ($nilai.Length -lt 6) { throw 'Password keystore minimal 6 karakter (syarat keytool).' }
    return $nilai
}

Write-Host ''
Write-Host '=== 0. Siapkan password ===' -ForegroundColor Cyan
$password = Get-KeystorePassword -FromParam $Password -PropsPath $pathProps

Write-Host ''
Write-Host '=== 1. Cek keystore ===' -ForegroundColor Cyan


if (Test-Path $pathKeystore) {
    Write-Host "Keystore sudah ada -> $pathKeystore" -ForegroundColor Yellow
    Write-Host 'Dilewati (tidak ditimpa agar update APK tetap bisa di-install).' -ForegroundColor Yellow
}
else {
    Write-Host "Membuat keystore baru -> $pathKeystore"

    # Semua argumen dilewatkan sebagai array supaya tidak ada masalah quoting
    $argsKeytool = @(
        '-genkeypair', '-v',
        '-keystore',  $pathKeystore,
        '-alias',     $alias,
        '-keyalg',    'RSA',
        '-keysize',   '2048',
        '-validity',  '10000',
        '-storetype', 'PKCS12',
        '-storepass', $password,
        '-keypass',   $password,
        '-dname',     $dname
    )

    & keytool @argsKeytool
    if ($LASTEXITCODE -ne 0) { throw "keytool gagal (exit code $LASTEXITCODE)" }

    Write-Host 'Keystore berhasil dibuat.' -ForegroundColor Green
}

Write-Host ''
Write-Host '=== 2. Tulis android\keystore.properties ===' -ForegroundColor Cyan

# storeFile relatif terhadap folder android/ (dibaca via rootProject.file)
$isiProps = @"
# Kredensial signing APK release E-RT04.
# JANGAN commit file ini ke git. Backup ke tempat aman.
storeFile=$namaKeystore
storePassword=$password
keyAlias=$alias
keyPassword=$password
"@

Set-Content -Path $pathProps -Value $isiProps -Encoding UTF8
Write-Host "Tersimpan -> $pathProps" -ForegroundColor Green

Write-Host ''
Write-Host '=== 3. Verifikasi ===' -ForegroundColor Cyan

$okKeystore = Test-Path $pathKeystore
$okProps    = Test-Path $pathProps

Write-Host ("  Keystore            : " + $(if ($okKeystore) { 'OK' } else { 'GAGAL' }))
Write-Host ("  keystore.properties : " + $(if ($okProps)    { 'OK' } else { 'GAGAL' }))

if ($okKeystore) {
    Write-Host ''
    Write-Host '  Sidik jari sertifikat:' -ForegroundColor Cyan
    & keytool -list -v -keystore $pathKeystore -storepass $password |
        Select-String -Pattern 'Alias name|Valid from|SHA1:|SHA256:' |
        ForEach-Object { Write-Host ('   ' + $_.Line.Trim()) }
}

Write-Host ''
if ($okKeystore -and $okProps) {
    Write-Host 'SELESAI. Lanjut build APK release:' -ForegroundColor Green
    Write-Host '    npm run cap:sync' -ForegroundColor White
    Write-Host '    npm run android:release' -ForegroundColor White
    Write-Host ''
    Write-Host 'Hasil: android\app\build\outputs\apk\release\E-RT04-v1.0.0-release.apk'
} else {
    Write-Host 'ADA YANG GAGAL — periksa pesan error di atas.' -ForegroundColor Red
    exit 1
}
Write-Host ''
