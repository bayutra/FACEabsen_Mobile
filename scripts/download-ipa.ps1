# Unduh artifact .ipa dari Codemagic memakai API token.
#
# Kenapa lewat API: unduhan artifact di UI kadang tidak muncul (panel kanan
# tidak ter-scroll / jendela terlalu pendek). Endpoint ini mengembalikan daftar
# artifact build beserta URL-nya, jadi kita tidak tergantung tampilan.
#
# Cara pakai:
#   # A) tempel URL halaman build (paling aman, ID tidak perlu diketik)
#   powershell -ExecutionPolicy Bypass -File scripts\download-ipa.ps1 `
#       -BuildUrl "https://codemagic.io/app/<appId>/build/<buildId>"
#
#   # B) kalau tahu ID build
#   ... -BuildId 6ad6cfb7550aed810906252
#
#   # C) cari build terakhir otomatis (butuh endpoint listing yang tersedia)
#   ... -Latest
#
# Token diminta secara tersembunyi (tidak muncul di layar/riwayat).

param(
    [string]$BuildUrl,
    [string]$BuildId,
    [string]$AppId,
    [switch]$Latest,
    [switch]$ListApps,
    [string]$OutDir = "$env:USERPROFILE\Downloads",
    [switch]$DumpJson
)

$ErrorActionPreference = 'Stop'

function Read-Token {
    $secure = Read-Host 'Codemagic API token' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$script:Headers = @{ 'x-auth-token' = (Read-Token) }

function Invoke-CmApi {
    param([string]$Path, [switch]$AllowFailure)

    $uri = "https://api.codemagic.io$Path"
    try {
        $res = Invoke-WebRequest -Uri $uri -Headers $script:Headers -UseBasicParsing
        return ($res.Content | ConvertFrom-Json)
    } catch {
        $body = ''
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
        }
        if ($AllowFailure) { return $null }
        throw "Gagal memanggil $Path`n$($_.Exception.Message)`n$body"
    }
}

function Get-AppId {
    param($App)
    if ($App.appId) { return $App.appId }
    return $App._id
}

function Get-BuildDetail {
    param([string]$Id)
    $res = Invoke-CmApi "/builds/$Id" -AllowFailure
    if ($null -eq $res) { return $null }
    return $res.build
}

if ($ListApps) {
    $apps = (Invoke-CmApi '/apps').applications
    Write-Host "`nAplikasi pada akun ini:"
    $apps | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_.appName, (Get-AppId $_)) }
    exit 0
}

# --- Tentukan ID build ------------------------------------------------------

if ($BuildUrl) {
    $trimmed = $BuildUrl.Trim().TrimEnd('/')
    $BuildId = ($trimmed -split '/')[-1]
    if ($trimmed -match '/app/([0-9a-f]{24})') { $AppId = $Matches[1] }
}

if ($BuildId -and $BuildId -match '^(https?://)?(www\.)?codemagic\.io') {
    $trimmed = $BuildId.Trim().TrimEnd('/')
    $BuildId = ($trimmed -split '/')[-1]
    if ($trimmed -match '/app/([0-9a-f]{24})') { $AppId = $Matches[1] }
}

$build = $null

if ($BuildId) {
    Write-Host "Mengambil build $BuildId ..."
    $build = Get-BuildDetail -Id $BuildId
    if ($null -eq $build) {
        throw "Build ID '$BuildId' tidak dikenali. Salin URL halaman build dari address bar, lalu jalankan lagi dengan -BuildUrl `"<url>`"."
    }
} else {
    if (-not $AppId) {
        $apps = (Invoke-CmApi '/apps').applications
        if ($apps.Count -eq 1) {
            $AppId = Get-AppId $apps[0]
            Write-Host "Memakai aplikasi: $($apps[0].appName) ($AppId)"
        } else {
            Write-Host "`nAda $($apps.Count) aplikasi. Jalankan ulang dengan -AppId <id>."
            $apps | ForEach-Object { Write-Host ("  {0,-24} {1}" -f $_.appName, (Get-AppId $_)) }
            exit 1
        }
    }

    # Endpoint listing build pernah berubah antar versi API: coba beberapa.
    $candidates = @()
    foreach ($path in @("/builds?appId=$AppId", "/apps/$AppId/builds")) {
        Write-Host "Mencoba $path ..."
        $res = Invoke-CmApi $path -AllowFailure
        if ($null -eq $res) { continue }
        if ($res.builds) { $candidates = $res.builds; break }
    }

    if ($candidates.Count -eq 0) {
        throw 'Daftar build tidak bisa diambil lewat API ini. Buka halaman build di browser, salin URL-nya, lalu jalankan lagi dengan -BuildUrl "<url>".'
    }

    foreach ($b in ($candidates | Sort-Object { [int]$_.index } -Descending)) {
        $detail = Get-BuildDetail -Id $b._id
        if ($null -eq $detail) { continue }
        if ($detail.artifacts -and $detail.artifacts.Count -gt 0) { $build = $detail; break }
    }

    if ($null -eq $build) { throw 'Tidak ada build dengan artifact pada aplikasi ini.' }
}

# --- Unduh ------------------------------------------------------------------

if ($DumpJson) {
    $dump = Join-Path $OutDir 'build.json'
    $build | ConvertTo-Json -Depth 10 | Out-File -FilePath $dump -Encoding utf8
    Write-Host "Respons mentah disimpan: $dump"
}

$commitShort = 'unknown'
if ($build.commit -and $build.commit.hash) {
    $commitShort = $build.commit.hash.Substring(0, 7)
}
Write-Host ("`nBuild #{0} ({1}) - {2}" -f $build.index, $commitShort, $build.status)

if (-not $build.artifacts -or $build.artifacts.Count -eq 0) {
    Write-Warning 'Build ini tidak punya artifact. Periksa pola artifacts: di codemagic.yaml.'
    exit 2
}

Write-Host ("Ditemukan {0} artifact:" -f $build.artifacts.Count)
$build.artifacts | ForEach-Object { Write-Host ("  - {0} ({1:N1} MB)" -f $_.name, ($_.size / 1MB)) }

$downloaded = 0
foreach ($a in $build.artifacts) {
    if ($a.name -notlike '*.ipa') { continue }
    $dest = Join-Path $OutDir $a.name
    Write-Host "Mengunduh $($a.name) ..."
    Invoke-WebRequest -Uri $a.url -Headers $script:Headers -OutFile $dest -UseBasicParsing
    Write-Host ("OK -> {0} ({1:N1} MB)" -f $dest, ((Get-Item $dest).Length / 1MB))
    $downloaded++
}

if ($downloaded -eq 0) {
    Write-Warning 'Tidak ada artifact .ipa pada build ini.'
    exit 3
}

Write-Host "`nSelesai. Drag file .ipa tersebut ke Sideloadly."
