# CCS - Claude Code Switch (Windows PowerShell)
# Cross-platform Claude CLI profile switcher
# https://github.com/kaitranntt/ccs

param(
    [Parameter(Position=0)]
    [string]$Profile = "default",

    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

# Config file location (supports environment variable override)
$ConfigFile = if ($env:CCS_CONFIG) {
    $env:CCS_CONFIG
} else {
    "$env:USERPROFILE\.ccs\config.json"
}

# Check config exists
if (-not (Test-Path $ConfigFile)) {
    Write-Host "Error: Config file not found: $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create $env:USERPROFILE\.ccs\config.json with your profile mappings."
    Write-Host "See .ccs.example.json for template."
    exit 1
}

# Validate profile name (alphanumeric, dash, underscore only)
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-Host "Error: Invalid profile name. Use only alphanumeric characters, dash, or underscore." -ForegroundColor Red
    exit 1
}

# Read and parse JSON config
try {
    $ConfigContent = Get-Content $ConfigFile -Raw -ErrorAction Stop
    $Config = $ConfigContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Error: Invalid JSON in $ConfigFile" -ForegroundColor Red
    exit 1
}

# Validate config has profiles object
if (-not $Config.profiles) {
    Write-Host "Error: Config must have 'profiles' object" -ForegroundColor Red
    Write-Host "See .ccs.example.json for correct format"
    exit 1
}

# Get settings path for profile
$SettingsPath = $Config.profiles.$Profile

if (-not $SettingsPath) {
    Write-Host "Error: Profile '$Profile' not found in $ConfigFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available profiles:"
    $Config.profiles.PSObject.Properties.Name | ForEach-Object {
        Write-Host "  - $_"
    }
    exit 1
}

# Path expansion and normalization
# 1. Handle Unix-style tilde expansion (~/path -> %USERPROFILE%\path)
if ($SettingsPath -match '^~[/\\]') {
    $SettingsPath = $SettingsPath -replace '^~', $env:USERPROFILE
}

# 2. Expand Windows environment variables (%USERPROFILE%, etc.)
$SettingsPath = [System.Environment]::ExpandEnvironmentVariables($SettingsPath)

# 3. Convert forward slashes to backslashes (Unix path compatibility)
$SettingsPath = $SettingsPath -replace '/', '\'

# Validate settings file exists
if (-not (Test-Path $SettingsPath)) {
    Write-Host "Error: Settings file not found: $SettingsPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create the settings file or update the path in $ConfigFile"
    exit 1
}

# Read settings file (contains environment variables for Windows)
try {
    $SettingsContent = Get-Content $SettingsPath -Raw -ErrorAction Stop
    $Settings = $SettingsContent | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Host "Error: Invalid JSON in $SettingsPath" -ForegroundColor Red
    exit 1
}

# Windows Claude CLI uses environment variables instead of --settings flag
# Settings file contains env vars directly or nested in "env" object (Linux compat)

# Check if settings contain "env" wrapper (Linux format) or direct env vars (Windows format)
$EnvVars = if ($Settings.env) {
    # Linux format: { "env": { "ANTHROPIC_AUTH_TOKEN": "..." } }
    $Settings.env
} else {
    # Windows format: { "ANTHROPIC_AUTH_TOKEN": "..." }
    $Settings
}

# Save original environment variables to restore after execution
$OriginalEnvVars = @{}

if ($EnvVars.PSObject.Properties.Count -gt 0) {
    foreach ($Property in $EnvVars.PSObject.Properties) {
        $VarName = $Property.Name
        $VarValue = $Property.Value

        # Save original value
        $OriginalEnvVars[$VarName] = [System.Environment]::GetEnvironmentVariable($VarName, 'Process')

        # Set new value for this process only
        [System.Environment]::SetEnvironmentVariable($VarName, $VarValue, 'Process')
    }
}

# Execute claude with environment variables set
try {
    if ($RemainingArgs) {
        & claude @RemainingArgs
    } else {
        & claude
    }
    $ExitCode = $LASTEXITCODE
} finally {
    # Restore original environment variables
    foreach ($VarName in $OriginalEnvVars.Keys) {
        $OriginalValue = $OriginalEnvVars[$VarName]
        if ($null -eq $OriginalValue) {
            # Variable didn't exist before, remove it
            [System.Environment]::SetEnvironmentVariable($VarName, $null, 'Process')
        } else {
            # Restore original value
            [System.Environment]::SetEnvironmentVariable($VarName, $OriginalValue, 'Process')
        }
    }
}

exit $ExitCode
