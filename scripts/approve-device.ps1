# Aktifkan perangkat mobile yang masih PENDING (menunggu aktivasi admin).
#
# Kenapa perlu: aturan produk "1 karyawan = 1 perangkat". Setiap kali aplikasi
# dipasang ulang (mis. setelah sertifikat Apple ID gratis kedaluwarsa 7 hari),
# installationId berubah dan perangkat baru masuk antrean PENDING sampai
# diaktifkan. Di PRD, persetujuan perangkat dilakukan lewat API (UI admin
# belum ada di Fase 2), jadi skrip ini memanggil endpoint yang sama:
#   POST /api/v1/devices/:id/activate   (role ADMIN / SUPER_ADMIN)
#
# Contoh:
#   powershell -ExecutionPolicy Bypass -File scripts\approve-device.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\approve-device.ps1 -DryRun
#
# Perangkat aktif lama milik karyawan yang sama otomatis di-REVOKE oleh server.

param(
    [string]$BaseUrl = 'http://localhost:3000/api/v1',
    [string]$Email = 'superadmin@rs.test',
    [string]$Password = 'Password123!',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$body = @{ email = $Email; password = $Password } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post `
    -ContentType 'application/json' -Body $body -TimeoutSec 20

$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$devices = (Invoke-RestMethod -Uri "$BaseUrl/devices" -Headers $headers -TimeoutSec 20).data

$pending = @($devices | Where-Object { $_.status -eq 'PENDING' })
if ($pending.Count -eq 0) {
    Write-Host 'Tidak ada perangkat PENDING. Semua sudah aktif.'
    exit 0
}

Write-Host ("Ditemukan {0} perangkat PENDING:" -f $pending.Count)
foreach ($d in $pending) {
    Write-Host ("  {0,-7} {1,-22} {2}" -f $d.platform, $d.deviceName, $d.employee.name)
}

if ($DryRun) {
    Write-Host 'DryRun: tidak ada perubahan.'
    exit 0
}

foreach ($d in $pending) {
    $res = Invoke-RestMethod -Uri "$BaseUrl/devices/$($d.id)/activate" -Method Post `
        -Headers $headers -ContentType 'application/json' -Body '{}' -TimeoutSec 20
    Write-Host ("  -> ACTIVE  {0} ({1})" -f $d.employee.name, $d.platform)
}

Write-Host 'Selesai. Di aplikasi, tekan "Cek Status" atau buka ulang aplikasi, lalu login lagi.'
