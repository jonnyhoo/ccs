# CCS Uninstallation Script (Windows PowerShell)
# https://github.com/kaitranntt/ccs

$ErrorActionPreference = "Stop"

# --- Color/Format Functions ---
function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[i] $Message" -ForegroundColor Cyan
}

# --- Selective Cleanup Function ---
function Invoke-SelectiveCleanup {
    param([string]$CcsDir)

    $Removed = @()
    $Kept = @()

    # Remove executables and version metadata
    $FilesToRemove = @("ccs.ps1", "VERSION")

    # Also remove the uninstall script itself
    $UninstallScript = $PSCommandPath
    if ($UninstallScript -and (Test-Path $UninstallScript)) {
        $FilesToRemove += $UninstallScript
    }

    foreach ($File in $FilesToRemove) {
        $FilePath = if ([System.IO.Path]::IsPathRooted($File)) { $File } else { Join-Path $CcsDir $File }
        if (Test-Path $FilePath) {
            Remove-Item $FilePath -Force
            $Removed += Split-Path $FilePath -Leaf
        }
    }

    # Track kept files
    if (Test-Path "$CcsDir\config.json") { $Kept += "config.json" }
    if (Test-Path "$CcsDir\config.json.backup") { $Kept += "config.json.backup" }
    Get-ChildItem "$CcsDir\*.settings.json" -ErrorAction SilentlyContinue | ForEach-Object {
        $Kept += $_.Name
    }
    if (Test-Path "$CcsDir\.claude") { $Kept += ".claude/" }

    # Report results
    if ($Removed.Count -gt 0) {
        Write-Info "Cleaned up: $($Removed -join ', ')"
    }

    if ($Kept.Count -gt 0) {
        Write-Info "Kept config files: $($Kept -join ', ')"
    }
}

Write-Host "Uninstalling ccs..."
Write-Host ""

$CcsDir = "$env:USERPROFILE\.ccs"

# Remove from PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
if ($UserPath -like "*$CcsDir*") {
    try {
        $NewPath = ($UserPath -split ';' | Where-Object { $_ -ne $CcsDir }) -join ';'
        [Environment]::SetEnvironmentVariable("Path", $NewPath, [System.EnvironmentVariableTarget]::User)
        Write-Success "Removed from PATH: $CcsDir"
        Write-Host "   Restart your terminal for changes to take effect."
    } catch {
        Write-Host "[!] Could not remove from PATH automatically. Please remove manually: $CcsDir" -ForegroundColor Yellow
    }
}

# Ask about ~/.ccs directory
if (Test-Path $CcsDir) {
    Write-Host ""
    $Response = Read-Host "Remove CCS directory $CcsDir`? This includes config and profiles. (y/N)"
    if ($Response -match '^[Yy]$') {
        Remove-Item $CcsDir -Recurse -Force
        Write-Success "Removed: $CcsDir"
    } else {
        Write-Host ""
        Invoke-SelectiveCleanup -CcsDir $CcsDir
    }
} else {
    Write-Info "No CCS directory found at $CcsDir"
}

Write-Host ""
Write-Success "Uninstall complete!"
Write-Host ""
