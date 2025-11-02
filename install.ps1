# CCS Installation Script (Windows PowerShell)
# https://github.com/kaitranntt/ccs

param(
    [string]$InstallDir = "$env:USERPROFILE\.ccs"
)

$ErrorActionPreference = "Stop"

# Configuration
$CcsDir = "$env:USERPROFILE\.ccs"
$ClaudeDir = "$env:USERPROFILE\.claude"
$GlmModel = "glm-4.6"

# Detect if running from git repository or standalone
$ScriptDir = if ($MyInvocation.MyCommand.Path) {
    Split-Path -Parent $MyInvocation.MyCommand.Path
} else {
    # Running via irm | iex (in-memory, no file path)
    $null
}

$InstallMethod = if ($ScriptDir -and (Test-Path "$ScriptDir\ccs.ps1")) {
    "git"
} else {
    "standalone"
}

# Helper Functions

function Detect-CurrentProvider {
    $SettingsFile = "$ClaudeDir\settings.json"
    if (-not (Test-Path $SettingsFile)) {
        return "unknown"
    }

    try {
        $Content = Get-Content $SettingsFile -Raw
        if ($Content -match "api\.z\.ai|glm-4") {
            return "glm"
        } elseif ($Content -match "ANTHROPIC_BASE_URL" -and $Content -notmatch "api\.z\.ai") {
            return "custom"
        } else {
            return "claude"
        }
    } catch {
        return "unknown"
    }
}

function New-GlmTemplate {
    $Template = @{
        env = @{
            ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"
            ANTHROPIC_AUTH_TOKEN = "YOUR_GLM_API_KEY_HERE"
            ANTHROPIC_MODEL = $GlmModel
            ANTHROPIC_DEFAULT_OPUS_MODEL = $GlmModel
            ANTHROPIC_DEFAULT_SONNET_MODEL = $GlmModel
            ANTHROPIC_DEFAULT_HAIKU_MODEL = $GlmModel
        }
    }
    return $Template | ConvertTo-Json -Depth 10
}

function New-SonnetTemplate {
    $Template = @{ env = @{} }
    return $Template | ConvertTo-Json -Depth 10
}

function New-GlmProfile {
    param([string]$Provider)

    $CurrentSettings = "$ClaudeDir\settings.json"
    $GlmSettings = "$CcsDir\glm.settings.json"

    if ($Provider -eq "glm" -and (Test-Path $CurrentSettings)) {
        Write-Host "[OK] Copying current GLM config to profile..."

        try {
            $Config = Get-Content $CurrentSettings -Raw | ConvertFrom-Json
            if (-not $Config.env) {
                $Config | Add-Member -NotePropertyName env -NotePropertyValue @{} -Force
            }
            $Config.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_OPUS_MODEL -NotePropertyValue $GlmModel -Force
            $Config.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_SONNET_MODEL -NotePropertyValue $GlmModel -Force
            $Config.env | Add-Member -NotePropertyName ANTHROPIC_DEFAULT_HAIKU_MODEL -NotePropertyValue $GlmModel -Force

            $Config | ConvertTo-Json -Depth 10 | Set-Content $GlmSettings
            Write-Host "  Created: $GlmSettings (with your existing API key + enhanced settings)"
        } catch {
            Write-Host "  [i]  Copying current settings failed, using template"
            New-GlmTemplate | Set-Content $GlmSettings
        }
    } else {
        Write-Host "Creating GLM profile template at $GlmSettings"
        New-GlmTemplate | Set-Content $GlmSettings
        Write-Host "  Created: $GlmSettings"
        Write-Host "  [!]  Edit this file and replace YOUR_GLM_API_KEY_HERE with your actual GLM API key"
    }
}

function New-SonnetProfile {
    param([string]$Provider)

    $CurrentSettings = "$ClaudeDir\settings.json"
    $SonnetSettings = "$CcsDir\sonnet.settings.json"

    if ($Provider -eq "claude" -and (Test-Path $CurrentSettings)) {
        Write-Host "[OK] Copying current Claude config to profile..."
        Copy-Item $CurrentSettings $SonnetSettings
        Write-Host "  Created: $SonnetSettings"
    } else {
        Write-Host "Creating Claude Sonnet profile template at $SonnetSettings"

        if (Test-Path $CurrentSettings) {
            try {
                $Config = Get-Content $CurrentSettings -Raw | ConvertFrom-Json
                # Remove GLM-specific vars
                if ($Config.env) {
                    $Config.env.PSObject.Properties.Remove('ANTHROPIC_BASE_URL')
                    $Config.env.PSObject.Properties.Remove('ANTHROPIC_AUTH_TOKEN')
                    $Config.env.PSObject.Properties.Remove('ANTHROPIC_MODEL')
                }
                $Config | ConvertTo-Json -Depth 10 | Set-Content $SonnetSettings
            } catch {
                New-SonnetTemplate | Set-Content $SonnetSettings
            }
        } else {
            New-SonnetTemplate | Set-Content $SonnetSettings
        }

        Write-Host "  Created: $SonnetSettings"
        Write-Host "  [i]  This uses your Claude subscription (no API key needed)"
    }
}

# Main Installation

Write-Host "┌─ Installing CCS (Windows)"

# Create directories
New-Item -ItemType Directory -Force -Path $CcsDir | Out-Null

# Install main executable
if ($InstallMethod -eq "standalone") {
    # Standalone install - download from GitHub
    Write-Host "|  Downloading CCS from GitHub..."

    try {
        $BaseUrl = "https://raw.githubusercontent.com/kaitranntt/ccs/main"
        Invoke-WebRequest -Uri "$BaseUrl/ccs.ps1" -OutFile "$CcsDir\ccs.ps1" -UseBasicParsing
        Write-Host "|  [OK] Downloaded ccs.ps1"
    } catch {
        Write-Host "|"
        Write-Host "[X] Error: Failed to download ccs.ps1 from GitHub" -ForegroundColor Red
        Write-Host "  $_"
        exit 1
    }
} else {
    # Git install - copy local file
    Copy-Item "$ScriptDir\ccs.ps1" "$CcsDir\ccs.ps1" -Force
    Write-Host "|  [OK] Installed ccs.ps1"
}

# Install uninstall script
if ($ScriptDir -and (Test-Path "$ScriptDir\uninstall.ps1")) {
    # Only copy if source and destination are different
    if ($ScriptDir -ne $CcsDir) {
        Copy-Item "$ScriptDir\uninstall.ps1" "$CcsDir\uninstall.ps1" -Force
    }
    Write-Host "|  [OK] Installed uninstaller"
} elseif ($InstallMethod -eq "standalone") {
    try {
        $BaseUrl = "https://raw.githubusercontent.com/kaitranntt/ccs/main"
        Invoke-WebRequest -Uri "$BaseUrl/uninstall.ps1" -OutFile "$CcsDir\uninstall.ps1" -UseBasicParsing
        Write-Host "|  [OK] Installed uninstaller"
    } catch {
        Write-Host "|  [!]  Could not download uninstaller (optional)"
    }
}

Write-Host "|  [OK] Created directories"
Write-Host "└─"
Write-Host ""

# Profile Setup

$CurrentProvider = Detect-CurrentProvider

$ProviderLabel = switch ($CurrentProvider) {
    "glm" { " (detected: GLM)" }
    "claude" { " (detected: Claude)" }
    "custom" { " (detected: custom)" }
    default { "" }
}

Write-Host "┌─ Configuring Profiles$ProviderLabel"

$NeedsGlmKey = $false

# Create ccs config with file paths (same structure as Linux)
$ConfigFile = "$CcsDir\config.json"
if (-not (Test-Path $ConfigFile)) {
    $ConfigContent = @{
        profiles = @{
            glm = "~/.ccs/glm.settings.json"
            son = "~/.ccs/sonnet.settings.json"
            default = "~/.claude/settings.json"
        }
    }

    $ConfigContent | ConvertTo-Json -Depth 10 | Set-Content $ConfigFile
    Write-Host "|  [OK] Config -> $env:USERPROFILE\.ccs\config.json"
}

# Create profile settings files
$GlmSettings = "$CcsDir\glm.settings.json"
$SonnetSettings = "$CcsDir\sonnet.settings.json"

if (-not (Test-Path $GlmSettings)) {
    New-GlmProfile -Provider $CurrentProvider
    if ($CurrentProvider -ne "glm") {
        $NeedsGlmKey = $true
    }
} else {
    Write-Host "|  [OK] GLM profile exists: $GlmSettings"
}

if (-not (Test-Path $SonnetSettings)) {
    New-SonnetProfile -Provider $CurrentProvider
} else {
    Write-Host "|  [OK] Sonnet profile exists: $SonnetSettings"
}

Write-Host "└─"
Write-Host ""

# Check and update PATH
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$CcsDir*") {
    Write-Host "[!]  PATH Configuration Required"
    Write-Host ""
    Write-Host "   Adding $CcsDir to your PATH..."

    try {
        $NewPath = if ($UserPath) { "$UserPath;$CcsDir" } else { $CcsDir }
        [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")

        Write-Host "   [OK] PATH updated. Restart your terminal for changes to take effect."
        Write-Host ""
    } catch {
        Write-Host "   [X] Could not update PATH automatically." -ForegroundColor Yellow
        Write-Host "   Please add manually: $CcsDir"
        Write-Host ""
    }
}

# Show API key warning if needed
if ($NeedsGlmKey) {
    Write-Host "[!]  ACTION REQUIRED"
    Write-Host ""
    Write-Host "   Edit $env:USERPROFILE\.ccs\glm.settings.json and add your GLM API key"
    Write-Host "   Replace YOUR_GLM_API_KEY_HERE with your actual API key"
    Write-Host ""
}

Write-Host "[SUCCESS] CCS installed successfully!"
Write-Host ""

# Build quick start based on current provider
if ($CurrentProvider -eq "claude") {
    Write-Host "   Quick start:"
    Write-Host "     ccs son       # Claude Sonnet (current)"
    Write-Host "     ccs glm       # GLM (after adding API key)"
    Write-Host "     ccs           # Default profile"
} elseif ($CurrentProvider -eq "glm") {
    Write-Host "   Quick start:"
    Write-Host "     ccs glm       # GLM (current)"
    Write-Host "     ccs son       # Claude Sonnet"
    Write-Host "     ccs           # Default profile"
} else {
    Write-Host "   Quick start:"
    Write-Host "     ccs           # Default profile"
    Write-Host "     ccs son       # Claude Sonnet"
    Write-Host "     ccs glm       # GLM (after adding API key)"
}

Write-Host ""
Write-Host "   Usage: ccs [profile] [claude-args]"
Write-Host "   Example: ccs glm /plan 'implement feature'"
Write-Host ""
Write-Host "   To uninstall: ccs-uninstall"
Write-Host ""
