# CCS - Claude Code Switch (Windows PowerShell)
# Cross-platform Claude CLI profile switcher
# https://github.com/kaitranntt/ccs

param(
    [switch]$Help,
    [switch]$Version,
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

# --- Color/Format Functions ---
function Write-ErrorMsg {
    param([string]$Message)
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Red
    Write-Host "  ERROR" -ForegroundColor Red
    Write-Host "=============================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    Write-Host ""
}

function Write-ColoredText {
    param(
        [string]$Text,
        [string]$Color = "White",
        [switch]$NoNewline
    )

    $UseColors = $env:FORCE_COLOR -or ([Console]::IsOutputRedirected -eq $false -and -not $env:NO_COLOR)

    if ($UseColors -and $Color) {
        if ($NoNewline) {
            Write-Host $Text -ForegroundColor $Color -NoNewline
        } else {
            Write-Host $Text -ForegroundColor $Color
        }
    } else {
        if ($NoNewline) {
            Write-Host $Text -NoNewline
        } else {
            Write-Host $Text
        }
    }
}

# --- Claude CLI Detection Logic ---

function Find-ClaudeCli {
    if ($env:CCS_CLAUDE_PATH) {
        return $env:CCS_CLAUDE_PATH
    } else {
        return "claude"
    }
}

function Show-ClaudeNotFoundError {
    $Message = "Claude CLI not found in PATH" + "`n`n" +
    "CCS requires Claude CLI to be installed and available in your PATH." + "`n`n" +
    "Solutions:" + "`n" +
    "  1. Install Claude CLI:" + "`n" +
    "     https://docs.claude.com/en/docs/claude-code/installation" + "`n`n" +
    "  2. Verify installation:" + "`n" +
    "     Get-Command claude" + "`n`n" +
    "  3. If installed but not in PATH, add it:" + "`n" +
    "     # Find Claude installation" + "`n" +
    "     where.exe claude" + "`n`n" +
    "     # Or set custom path" + "`n" +
    "     `$env:CCS_CLAUDE_PATH = 'C:\path\to\claude.exe'" + "`n`n" +
    "Restart your terminal after installation."

    Write-ErrorMsg $Message
}

function Show-Help {
    $UseColors = $env:FORCE_COLOR -or ([Console]::IsOutputRedirected -eq $false -and -not $env:NO_COLOR)

    # Helper for colored output
    function Write-ColorLine {
        param([string]$Text, [string]$Color = "White")
        if ($UseColors) { Write-Host $Text -ForegroundColor $Color }
        else { Write-Host $Text }
    }

    Write-ColorLine "CCS (Claude Code Switch) - Instant profile switching for Claude CLI" "White"
    Write-Host ""
    Write-ColorLine "Usage:" "Cyan"
    Write-ColorLine "  ccs [profile] [claude-args...]" "Yellow"
    Write-ColorLine "  ccs [flags]" "Yellow"
    Write-Host ""
    Write-ColorLine "Description:" "Cyan"
    Write-Host "  Switch between Claude models instantly. Stop hitting rate limits."
    Write-Host "  Maps profile names to Claude settings files via ~/.ccs/config.json"
    Write-Host ""
    Write-ColorLine "Profile Switching:" "Cyan"
    Write-ColorLine "  ccs                         Use default profile" "Yellow"
    Write-ColorLine "  ccs glm                     Switch to GLM profile" "Yellow"
    Write-ColorLine "  ccs kimi                    Switch to Kimi profile" "Yellow"
    Write-ColorLine "  ccs glm 'debug this code'   Switch to GLM and run command" "Yellow"
    Write-ColorLine "  ccs kimi 'write tests'      Switch to Kimi and run command" "Yellow"
    Write-ColorLine "  ccs glm --verbose           Switch to GLM with Claude flags" "Yellow"
    Write-ColorLine "  ccs kimi --verbose           Switch to Kimi with Claude flags" "Yellow"
    Write-Host ""
    Write-ColorLine "Flags:" "Cyan"
    Write-ColorLine "  -h, --help                  Show this help message" "Yellow"
    Write-ColorLine "  -v, --version               Show version and installation info" "Yellow"
        Write-Host ""
    Write-ColorLine "Configuration:" "Cyan"
    Write-Host "  Config File: ~/.ccs/config.json"
    Write-Host "  Settings:    ~/.ccs/*.settings.json"
    Write-Host "  Environment: CCS_CONFIG (override config path)"
    Write-Host ""
    Write-ColorLine "Examples:" "Cyan"
    Write-Host "  # Use default Claude subscription"
    Write-ColorLine "  ccs 'Review this architecture'" "Yellow"
    Write-Host ""
    Write-Host "  # Switch to GLM for cost-effective tasks"
    Write-ColorLine "  ccs glm 'Write unit tests'" "Yellow"
    Write-Host ""
    Write-Host "  # Switch to Kimi for alternative option"
    Write-ColorLine "  ccs kimi 'Write integration tests'" "Yellow"
    Write-Host ""
    Write-Host "  # Use with verbose output"
    Write-ColorLine "  ccs glm --verbose 'Debug error'" "Yellow"
    Write-ColorLine "  ccs kimi --verbose 'Review code'" "Yellow"
    Write-Host ""
        Write-ColorLine "Uninstall:" "Cyan"
    Write-Host "  macOS/Linux:  curl -fsSL ccs.kaitran.ca/uninstall | bash"
    Write-Host "  Windows:      irm ccs.kaitran.ca/uninstall | iex"
    Write-Host "  npm:          npm uninstall -g @kaitranntt/ccs"
    Write-Host ""
    Write-ColorLine "Documentation:" "Cyan"
    Write-Host "  GitHub:  https://github.com/kaitranntt/ccs"
    Write-Host "  Docs:    https://github.com/kaitranntt/ccs/blob/main/README.md"
    Write-Host "  Issues:  https://github.com/kaitranntt/ccs/issues"
    Write-Host ""
    Write-ColorLine "License: MIT" "Cyan"
}

# Version (updated by scripts/bump-version.sh)
$CcsVersion = "3.0.0"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = if ($env:CCS_CONFIG) { $env:CCS_CONFIG } else { "$env:USERPROFILE\.ccs\config.json" }

function Show-Version {
    $UseColors = $env:FORCE_COLOR -or ([Console]::IsOutputRedirected -eq $false -and -not $env:NO_COLOR)

    # Title
    if ($UseColors) {
        Write-Host "CCS (Claude Code Switch) v$CcsVersion" -ForegroundColor White
    } else {
        Write-Host "CCS (Claude Code Switch) v$CcsVersion"
    }
    Write-Host ""

    # Installation
    if ($UseColors) { Write-Host "Installation:" -ForegroundColor Cyan }
    else { Write-Host "Installation:" }

    # Location
    $InstallLocation = (Get-Command ccs -ErrorAction SilentlyContinue).Source
    if ($InstallLocation) {
        if ($UseColors) {
            Write-Host "  Location: " -ForegroundColor Cyan -NoNewline
            Write-Host $InstallLocation
        } else {
            Write-Host "  Location: $InstallLocation"
        }
    } else {
        if ($UseColors) {
            Write-Host "  Location: " -ForegroundColor Cyan -NoNewline
            Write-Host "(not found - run from current directory)" -ForegroundColor Gray
        } else {
            Write-Host "  Location: (not found - run from current directory)"
        }
    }

    # Config
    if ($UseColors) {
        Write-Host "  Config: " -ForegroundColor Cyan -NoNewline
        Write-Host $ConfigFile
    } else {
        Write-Host "  Config: $ConfigFile"
    }

    Write-Host ""

    # Documentation
    if ($UseColors) {
        Write-Host "Documentation: https://github.com/kaitranntt/ccs" -ForegroundColor Cyan
        Write-Host "License: MIT" -ForegroundColor Cyan
    } else {
        Write-Host "Documentation: https://github.com/kaitranntt/ccs"
        Write-Host "License: MIT"
    }
    Write-Host ""

    if ($UseColors) {
        Write-Host "Run 'ccs --help' for usage information" -ForegroundColor Yellow
    } else {
        Write-Host "Run 'ccs --help' for usage information"
    }
}

# Special case: version command (check BEFORE profile detection)
# Handle switch parameters and remaining arguments
if ($Version) {
    Show-Version
    exit 0
} elseif ($RemainingArgs.Count -gt 0) {
    $FirstArg = $RemainingArgs[0]
    if ($FirstArg -eq "version" -or $FirstArg -eq "--version" -or $FirstArg -eq "-v") {
        Show-Version
        exit 0
    }
}

# Special case: help command (check BEFORE profile detection)
if ($Help) {
    Show-Help
    exit 0
} elseif ($RemainingArgs.Count -gt 0) {
    $FirstArg = $RemainingArgs[0]
    if ($FirstArg -eq "--help" -or $FirstArg -eq "-h" -or $FirstArg -eq "help") {
        Show-Help
        exit 0
    }
}

# Special case: install command (check BEFORE profile detection)
if ($FirstArg -eq "--install") {
    Write-Host ""
    Write-Host "Feature not available" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The --install flag is currently under development."
    Write-Host ".claude/ integration testing is not complete."
    Write-Host ""
    Write-Host "For updates: https://github.com/kaitranntt/ccs/issues"
    Write-Host ""
    exit 0
}

# Special case: uninstall command (check BEFORE profile detection)
if ($FirstArg -eq "--uninstall") {
    Write-Host ""
    Write-Host "Feature not available" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The --uninstall flag is currently under development."
    Write-Host ".claude/ integration testing is not complete."
    Write-Host ""
    Write-Host "For updates: https://github.com/kaitranntt/ccs/issues"
    Write-Host ""
    exit 0
}

# Smart profile detection: if first arg starts with '-', it's a flag not a profile
if ($RemainingArgs.Count -eq 0 -or $RemainingArgs[0] -match '^-') {
    # No args or first arg is a flag → use default profile
    $Profile = "default"
    # $RemainingArgs already contains the remaining args correctly
} else {
    # First arg is a profile name
    $Profile = $RemainingArgs[0]
    $RemainingArgs = if ($RemainingArgs.Count -gt 1) { $RemainingArgs | Select-Object -Skip 1 } else { @() }
}

# Check config exists
if (-not (Test-Path $ConfigFile)) {
    $ErrorMessage = "Config file not found: $ConfigFile" + "`n`n" +
    "Solutions:" + "`n" +
    "  1. Reinstall CCS:" + "`n" +
    "     irm ccs.kaitran.ca/install | iex" + "`n`n" +
    "  2. Or create config manually:" + "`n" +
    "     New-Item -ItemType Directory -Force -Path '$env:USERPROFILE\.ccs'" + "`n" +
    "     Set-Content -Path '$env:USERPROFILE\.ccs\config.json' -Value '{`"profiles`":{`"glm`":`"~/.ccs/glm.settings.json`",`"kimi`":`"~/.ccs/kimi.settings.json`",`"default`":`"~/.claude/settings.json`"}}'"

    Write-ErrorMsg $ErrorMessage
    exit 1
}

# Validate profile name (alphanumeric, dash, underscore only)
if ($Profile -notmatch '^[a-zA-Z0-9_-]+$') {
    $ErrorMessage = "Invalid profile name: $Profile" + "`n`n" +
    "Use only alphanumeric characters, dash, or underscore."

    Write-ErrorMsg $ErrorMessage
    exit 1
}

# Read and parse JSON config, get profile path in one step
try {
    $ConfigContent = Get-Content $ConfigFile -Raw -ErrorAction Stop
    $Config = $ConfigContent | ConvertFrom-Json -ErrorAction Stop
    $SettingsPath = $Config.profiles.$Profile

    if (-not $SettingsPath) {
        $AvailableProfiles = ($Config.profiles.PSObject.Properties.Name | ForEach-Object { "  - $_" }) -join "`n"
        $ErrorMessage = "Profile '$Profile' not found in $ConfigFile" + "`n`n" +
        "Available profiles:" + "`n" +
        $AvailableProfiles

        Write-ErrorMsg $ErrorMessage
        exit 1
    }
} catch {
    $ErrorMessage = "Invalid JSON in $ConfigFile" + "`n`n" +
    "Fix the JSON syntax or reinstall:" + "`n" +
    "  irm ccs.kaitran.ca/install | iex"

    Write-ErrorMsg $ErrorMessage
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
    $ErrorMessage = "Settings file not found: $SettingsPath" + "`n`n" +
    "Solutions:" + "`n" +
    "  1. Create the settings file for profile '$Profile'" + "`n" +
    "  2. Update the path in $ConfigFile" + "`n" +
    "  3. Or reinstall: irm ccs.kaitran.ca/install | iex"

    Write-ErrorMsg $ErrorMessage
    exit 1
}

# Detect Claude CLI executable
$ClaudeCli = Find-ClaudeCli

# Execute Claude with the profile settings
try {
    if ($RemainingArgs) {
        & $ClaudeCli --settings $SettingsPath @RemainingArgs
    } else {
        & $ClaudeCli --settings $SettingsPath
    }
    exit $LASTEXITCODE
} catch {
    Show-ClaudeNotFoundError
    exit 1
}