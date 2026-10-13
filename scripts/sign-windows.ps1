# Sign a Windows binary with Azure Trusted Signing. The same script as the DAW uses (hardwave-daw/scripts/sign-windows.ps1).
#
# Tauri calls this once per file it bundles, with the file as the only
# argument, so the installer and everything inside it are signed before
# the updater signature is taken over them. Signing afterwards would
# change the bytes the updater had already signed, and every running
# copy would refuse the update.
#
# Without the Azure settings in the environment this does nothing and
# says so: a local build has no business needing the company's
# certificate, and a developer's build should not fail for the want of
# one. A release is different. On a release tag (v...) a missing setting
# or a signature that does not check out stops the build: nothing ships
# unsigned.
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $File
)

$ErrorActionPreference = 'Stop'

$endpoint = $env:AZURE_TRUSTED_SIGNING_ENDPOINT
$account  = $env:AZURE_TRUSTED_SIGNING_ACCOUNT
$profile  = $env:AZURE_TRUSTED_SIGNING_PROFILE
$isRelease = "$env:GITHUB_REF" -like 'refs/tags/v*'

function Skip-Or-Stop([string] $why) {
    if ($isRelease) {
        throw "sign-windows: $why, and this is a release ($env:GITHUB_REF_NAME): it must be signed"
    }
    Write-Host "sign-windows: $why, leaving $File unsigned"
    exit 0
}

if (-not $endpoint -or -not $account -or -not $profile) {
    Skip-Or-Stop 'no Azure Trusted Signing settings'
}
if (-not $env:AZURE_TENANT_ID -or -not $env:AZURE_CLIENT_ID -or -not $env:AZURE_CLIENT_SECRET) {
    Skip-Or-Stop 'no Azure credentials'
}

# The client library signtool loads to talk to Trusted Signing. Cached
# under the runner's temp folder, so a build signs many files and
# downloads once.
$clientVersion = '1.0.86'
# The package's own hash, recorded when the version was chosen: signtool
# loads this library while the Azure secret is in the environment, so a
# package that is not exactly this one is not used.
$clientSha256 = 'FC0CE6F59F8002D53C99CB0F3DE7EB28D6DE572A4B2771462284862BD6425ECA'
$clientRoot = Join-Path $env:RUNNER_TEMP "trusted-signing-$clientVersion"
$dlib = Join-Path $clientRoot 'bin/x64/Azure.CodeSigning.Dlib.dll'
if (-not (Test-Path $dlib)) {
    New-Item -ItemType Directory -Force -Path $clientRoot | Out-Null
    $nupkg = Join-Path $env:RUNNER_TEMP 'trusted-signing-client.zip'
    $url = "https://www.nuget.org/api/v2/package/Microsoft.Trusted.Signing.Client/$clientVersion"
    Invoke-WebRequest -Uri $url -OutFile $nupkg -UseBasicParsing
    $actual = (Get-FileHash -Algorithm SHA256 -Path $nupkg).Hash
    if ($actual -ne $clientSha256) {
        throw "sign-windows: the Trusted Signing client download is not the expected package ($actual)"
    }
    Expand-Archive -Path $nupkg -DestinationPath $clientRoot -Force
}
if (-not (Test-Path $dlib)) {
    throw "sign-windows: the Trusted Signing client is missing at $dlib"
}

$metadata = Join-Path $clientRoot 'metadata.json'
@{
    Endpoint               = $endpoint
    CodeSigningAccountName = $account
    CertificateProfileName = $profile
} | ConvertTo-Json | Set-Content -Path $metadata -Encoding utf8

# signtool from the Windows SDK, whichever version the runner has.
$signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' `
    -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) {
    throw 'sign-windows: signtool.exe was not found; the Windows SDK is not installed'
}

& $signtool.FullName sign `
    /v /fd SHA256 /tr 'http://timestamp.acs.microsoft.com' /td SHA256 `
    /dlib $dlib /dmdf $metadata `
    $File
if ($LASTEXITCODE -ne 0) {
    throw "sign-windows: signing $File failed with $LASTEXITCODE"
}
# Windows' own check of what was just signed, so a signature that would
# not satisfy SmartScreen fails the build instead of the download.
$check = Get-AuthenticodeSignature -FilePath $File
if ($check.Status -ne 'Valid') {
    throw "sign-windows: $File does not carry a valid signature after signing ($($check.Status))"
}
Write-Host "sign-windows: signed $File ($($check.SignerCertificate.Subject))"
