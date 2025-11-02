# CCS Uninstallation Script (Windows PowerShell)
# https://github.com/kaitranntt/ccs

$ErrorActionPreference = "Stop"

Write-Host "Uninstalling ccs..."
Write-Host ""

$CcsDir = "$env:USERPROFILE\.ccs"

# Remove ccs.ps1
if (Test-Path "$CcsDir\ccs.ps1") {
    Remove-Item "$CcsDir\ccs.ps1" -Force
    Write-Host "[OK] Removed: $CcsDir\ccs.ps1"
} else {
    Write-Host "[i]  No ccs.ps1 found at $CcsDir"
}

# Remove uninstall script itself (will be last)
$UninstallScript = "$CcsDir\uninstall.ps1"

# Remove from PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -like "*$CcsDir*") {
    try {
        $NewPath = ($UserPath -split ';' | Where-Object { $_ -ne $CcsDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
        Write-Host "[OK] Removed from PATH: $CcsDir"
        Write-Host "   Restart your terminal for changes to take effect."
    } catch {
        Write-Host "[!]  Could not remove from PATH automatically. Please remove manually: $CcsDir" -ForegroundColor Yellow
    }
}

# Ask about ~/.ccs directory
if (Test-Path $CcsDir) {
    Write-Host ""
    $Response = Read-Host "Remove CCS directory $CcsDir`? This includes config and profiles. (y/N)"
    if ($Response -match '^[Yy]$') {
        Remove-Item $CcsDir -Recurse -Force
        Write-Host "[OK] Removed: $CcsDir"
    } else {
        # If keeping directory, remove uninstall script
        if (Test-Path $UninstallScript) {
            Remove-Item $UninstallScript -Force
            Write-Host "[OK] Removed: $UninstallScript"
        }
        Write-Host "[i]  Kept: $CcsDir"
    }
} else {
    Write-Host "[i]  No CCS directory found at $CcsDir"
}

Write-Host ""
Write-Host "[SUCCESS] Uninstall complete!"
Write-Host ""
