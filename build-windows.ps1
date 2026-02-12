# Hardwave Organizer - Windows Build Script
# Run this on a Windows machine with PowerShell

Write-Host "=== Hardwave Organizer Windows Build ===" -ForegroundColor Cyan

# Check for Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js is not installed. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $(node --version)" -ForegroundColor Green

# Check for Rust
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Rust is not installed. Installing via rustup..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
    .\rustup-init.exe -y
    Remove-Item rustup-init.exe
    $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
}
Write-Host "Rust: $(rustc --version)" -ForegroundColor Green

# Install npm dependencies
Write-Host "`nInstalling npm dependencies..." -ForegroundColor Cyan
npm install

# Build the Tauri app
Write-Host "`nBuilding Tauri application..." -ForegroundColor Cyan
npm run tauri:build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== Build Complete ===" -ForegroundColor Green
    Write-Host "Installer location:" -ForegroundColor Cyan
    Write-Host "  NSIS: src-tauri\target\release\bundle\nsis\" -ForegroundColor White
    Write-Host "  MSI:  src-tauri\target\release\bundle\msi\" -ForegroundColor White

    # Open the output folder
    $nsisPath = "src-tauri\target\release\bundle\nsis"
    if (Test-Path $nsisPath) {
        explorer $nsisPath
    }
} else {
    Write-Host "`nBuild failed!" -ForegroundColor Red
    exit 1
}
