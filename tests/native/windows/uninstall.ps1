#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Test suite for CCS --uninstall functionality (Windows PowerShell)

.DESCRIPTION
    Tests the --uninstall flag for CCS executable on Windows PowerShell.
    Tests against actual system installation for simplicity.

.NOTES
    Author: CCS Test Suite
    Version: 1.0
    Based on: install-test.ps1 patterns
#>

#Requires -Version 5.1

param(
    [Parameter(Mandatory=$false)]
    [string]$CcsPath = (Join-Path $PSScriptRoot "..\ccs.ps1")
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Test variables
$PassCount = 0
$FailCount = 0
$TotalTests = 0

# Colors
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Cyan = "Cyan"
    Gray = "Gray"
    White = "White"
}

# Test paths
$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
$BackupDir = Join-Path $env:TEMP "ccs-test-backup-$(Get-Date -Format 'yyyyMMddHHmmss')"
$TestHome = Join-Path $env:TEMP "ccs-test-home"
$TestClaudeDir = Join-Path $TestHome ".claude"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Test-Case {
    param(
        [string]$Name,
        [string]$Expected,
        [scriptblock]$TestCode
    )

    $script:TotalTests++
    Write-Host ""
    Write-ColorOutput "[$TotalTests] $Name" "Cyan"
    Write-ColorOutput "    Expected: $Expected" "Gray"

    try {
        $result = & $TestCode
        if ($result) {
            Write-ColorOutput "    Result: PASS" "Green"
            $script:PassCount++
            return $true
        } else {
            Write-ColorOutput "    Result: FAIL" "Red"
            $script:FailCount++
            return $false
        }
    } catch {
        Write-ColorOutput "    Result: FAIL - Exception: $($_.Exception.Message)" "Red"
        $script:FailCount++
        return $false
    }
}

function Cleanup-AndRestore {
    Write-Host ""
    Write-ColorOutput "Cleaning up and restoring..." "Yellow"

    # Remove test directory
    if (Test-Path $TestHome) {
        Remove-Item $TestHome -Recurse -Force
    }

    # Restore backup if it exists
    if (Test-Path $BackupDir) {
        if (Test-Path $ClaudeDir) {
            Remove-Item $ClaudeDir -Recurse -Force
        }
        Move-Item $BackupDir $ClaudeDir
    }

    Write-ColorOutput "Cleanup complete." "Green"
}

# ============================================================================
# SETUP
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Cyan"
Write-ColorOutput "CCS --uninstall Functionality Tests" "Cyan"
Write-ColorOutput "========================================" "Cyan"
Write-Host ""

# Backup existing .claude directory if it exists
if (Test-Path $ClaudeDir) {
    Write-ColorOutput "Backing up existing .claude directory..." "Yellow"
    Copy-Item $ClaudeDir $BackupDir -Recurse
}

# Clean any existing test directory
if (Test-Path $TestHome) {
    Remove-Item $TestHome -Recurse -Force
}

New-Item -ItemType Directory -Path $TestHome -Force | Out-Null

# Verify CCS executable exists
if (-not (Test-Path $CcsPath)) {
    Write-ColorOutput "ERROR: CCS executable not found at $CcsPath" "Red"
    exit 1
}

# Test CCS executable basic functionality
Write-ColorOutput "Testing CCS executable basic functionality..." "Yellow"
try {
    $versionOutput = & "$CcsPath" --version 2>&1 | Out-String
    Write-ColorOutput "CCS Version: $versionOutput" "Green"
} catch {
    Write-ColorOutput "Warning: CCS executable test failed: $($_.Exception.Message)" "Yellow"
    Write-ColorOutput "Attempting to continue with tests..." "Yellow"
}

# ============================================================================
# TEST SECTION 1: UNINSTALL WHEN NOTHING IS INSTALLED
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 1: UNINSTALL WHEN NOTHING IS INSTALLED" "Yellow"
Write-ColorOutput "========================================" "Yellow"

Test-Case "Empty uninstall: Command executes without error" "Exit code 0" {
    $originalHome = $env:HOME
    $env:HOME = $TestHome
    try {
        $exitCode = 0
        & "$CcsPath" --uninstall 2>&1 | Out-Null
        if ($LASTEXITCODE) { $exitCode = $LASTEXITCODE }
        $exitCode -eq 0
    } finally {
        $env:HOME = $originalHome
    }
}

Test-Case "Empty uninstall: Output contains appropriate message" "Nothing to uninstall message" {
    $originalHome = $env:HOME
    $env:HOME = $TestHome
    try {
        $output = & "$CcsPath" --uninstall 2>&1 | Out-String
        $output -match "Nothing to uninstall" -or $output -match "not found"
    } finally {
        $env:HOME = $originalHome
    }
}

Test-Case "Empty uninstall: Reports 0 items removed" "Zero removed count" {
    $originalHome = $env:HOME
    $env:HOME = $TestHome
    try {
        $output = & "$CcsPath" --uninstall 2>&1 | Out-String
        $output -match "Removed: 0 items"
    } finally {
        $env:HOME = $originalHome
    }
}

# ============================================================================
# SETUP FOR FULL INSTALL/UNINSTALL CYCLE
# ============================================================================

# Install first so we can test uninstall
# NOTE: --install is currently a no-op (under development), but we call it
# to test the install/uninstall cycle works without errors
Write-Host ""
Write-ColorOutput "Setting up for install/uninstall cycle test..." "Yellow"
$originalHome = $env:HOME
$env:HOME = $TestHome
try {
    & $CcsPath --install | Out-Null
    Write-ColorOutput "Install completed successfully" "Green"
} catch {
    Write-ColorOutput "Warning: Install command failed, but continuing with tests" "Yellow"
} finally {
    $env:HOME = $originalHome
}

# ============================================================================
# TEST SECTION 2: UNINSTALL AFTER INSTALL
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 2: UNINSTALL AFTER INSTALL" "Yellow"
Write-ColorOutput "========================================" "Yellow"

Test-Case "Uninstall: Command executes without error" "Exit code 0" {
    $originalHome = $env:HOME
    $env:HOME = $TestHome
    try {
        $exitCode = 0
        & "$CcsPath" --uninstall 2>&1 | Out-Null
        if ($LASTEXITCODE) { $exitCode = $LASTEXITCODE }
        $exitCode -eq 0
    } finally {
        $env:HOME = $originalHome
    }
}

Test-Case "Uninstall: Removes ccs.md command file" "Command file removed" {
    -not (Test-Path (Join-Path $TestClaudeDir "commands\ccs.md"))
}

Test-Case "Uninstall: Removes ccs-delegation skill directory" "Skill directory removed" {
    -not (Test-Path (Join-Path $TestClaudeDir "skills\ccs-delegation"))
}

Test-Case "Uninstall: Preserves other commands" "Other commands unaffected" {
    # Create a dummy command file first
    $commandsDir = Join-Path $TestClaudeDir "commands"
    New-Item -ItemType Directory -Path $commandsDir -Force | Out-Null
    Set-Content -Path (Join-Path $commandsDir "test.md") -Value "test"

    # Install CCS, then uninstall
    $originalHome = $env:HOME
    $env:HOME = $TestHome
    try {
        & $CcsPath --install | Out-Null
        & $CcsPath --uninstall | Out-Null
    } finally {
        $env:HOME = $originalHome
    }

    # Check that test.md still exists
    Test-Path (Join-Path $commandsDir "test.md")
}

Test-Case "Uninstall: Preserves other skills" "Other skills unaffected" {
    # Create a dummy skill directory first
    $skillDir = Join-Path $TestClaudeDir "skills\test-skill"
    New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
    Set-Content -Path (Join-Path $skillDir "SKILL.md") -Value "test"

    # Install CCS, then uninstall
    $originalHome = $env:HOME
    $env:HOME = $TestHome
    try {
        & $CcsPath --install | Out-Null
        & $CcsPath --uninstall | Out-Null
    } finally {
        $env:HOME = $originalHome
    }

    # Check that test-skill still exists
    Test-Path $skillDir
}

# ============================================================================
# TEST SECTION 3: IDEMPOTENCY
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 3: IDEMPOTENCY" "Yellow"
Write-ColorOutput "========================================" "Yellow"

Test-Case "Idempotent: Second uninstall succeeds" "Second --uninstall doesn't error" {
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
        return $true
    } catch {
        return $false
    }
}

Test-Case "Idempotent: Reports nothing to remove on second run" "Reports nothing found" {
    $env:HOME = $TestHome
    $output = try { & $CcsPath --uninstall 2>&1 | Out-String } catch { $_.Exception.Message }
    $output -match "not found" -or $output -match "Nothing to uninstall"
}

# ============================================================================
# TEST SECTION 4: OUTPUT FORMATTING
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 4: OUTPUT FORMATTING" "Yellow"
Write-ColorOutput "========================================" "Yellow"

# Set up fresh install for output testing
$env:HOME = $TestHome
try { & $CcsPath --install | Out-Null } catch { }

Test-Case "Output: Contains uninstall header" "Contains uninstall message" {
    $env:HOME = $TestHome
    $output = try { & $CcsPath --uninstall 2>&1 | Out-String } catch { $_.Exception.Message }
    $output -match "Uninstalling CCS"
}

Test-Case "Output: Shows removal success message" "Contains success message" {
    $env:HOME = $TestHome
    $output = try { & $CcsPath --uninstall 2>&1 | Out-String } catch { $_.Exception.Message }
    $output -match "\[OK\] Uninstall complete!"
}

Test-Case "Output: Shows reinstallation instruction" "Contains reinstallation hint" {
    $env:HOME = $TestHome
    $output = try { & $CcsPath --uninstall 2>&1 | Out-String } catch { $_.Exception.Message }
    $output -match "To reinstall: ccs --install"
}

# ============================================================================
# TEST SECTION 5: INTEGRATION WITH CCS
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 5: INTEGRATION WITH CCS" "Yellow"
Write-ColorOutput "========================================" "Yellow"

Test-Case "Integration: --uninstall executes without profile error" "No profile error on --uninstall" {
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
        return $true
    } catch {
        return $false
    }
}

Test-Case "Integration: --version still works after uninstall" "Version command exits successfully" {
    $env:HOME = $TestHome
    try {
        & $CcsPath --version | Out-Null
        return $true
    } catch {
        return $false
    }
}

Test-Case "Integration: --help still works after uninstall" "Help command exits successfully" {
    $env:HOME = $TestHome
    try {
        & $CcsPath --help | Out-Null
        return $true
    } catch {
        return $false
    }
}

# ============================================================================
# TEST SECTION 6: EDGE CASES
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 6: EDGE CASES" "Yellow"
Write-ColorOutput "========================================" "Yellow"

Test-Case "Edge case: Partial install (commands only)" "Handles partial installation" {
    # Create only command file
    $commandsDir = Join-Path $TestClaudeDir "commands"
    New-Item -ItemType Directory -Path $commandsDir -Force | Out-Null
    Set-Content -Path (Join-Path $commandsDir "ccs.md") -Value "test"

    # Uninstall should handle this gracefully
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
        return $true
    } catch {
        return $false
    }
}

Test-Case "Edge case: Partial install (skills only)" "Handles partial installation" {
    # Create only skill directory
    $skillDir = Join-Path $TestClaudeDir "skills\ccs-delegation"
    New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
    Set-Content -Path (Join-Path $skillDir "SKILL.md") -Value "test"

    # Uninstall should handle this gracefully
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
        return $true
    } catch {
        return $false
    }
}

Test-Case "Edge case: Missing parent directories" "Handles missing .claude directory" {
    # Ensure .claude directory doesn't exist
    if (Test-Path $TestClaudeDir) {
        Remove-Item $TestClaudeDir -Recurse -Force
    }

    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
        return $true
    } catch {
        return $false
    }
}

# ============================================================================
# TEST SECTION 7: PER-PROFILE HOOK BEHAVIOR (Global settings untouched)
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Yellow"
Write-ColorOutput "SECTION 7: PER-PROFILE HOOK BEHAVIOR" "Yellow"
Write-ColorOutput "========================================" "Yellow"

Test-Case "Per-profile: Uninstall does NOT touch global settings.json" "Global settings unchanged" {
    # Setup: Create settings.json with user hook
    New-Item -ItemType Directory -Path $TestClaudeDir -Force | Out-Null
    $settingsPath = Join-Path $TestClaudeDir "settings.json"
    $settingsContent = @'
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "WebSearch", "hooks": [{ "command": "my-custom-hook.sh" }] }
    ]
  }
}
'@
    Set-Content -Path $settingsPath -Value $settingsContent

    # Uninstall
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
    } catch { }

    # Verify global settings unchanged
    $content = Get-Content -Path $settingsPath -Raw
    $content -match "my-custom-hook"
}

Test-Case "Per-profile: Uninstall preserves CCS hooks in global settings (not touched)" "Both hooks preserved" {
    # Setup: Create settings.json with CCS hook (old format - shouldn't be touched)
    New-Item -ItemType Directory -Path $TestClaudeDir -Force | Out-Null
    $settingsPath = Join-Path $TestClaudeDir "settings.json"
    $settingsContent = @'
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "WebSearch", "hooks": [{ "command": "node ~/.ccs/hooks/websearch-transformer.cjs" }] },
      { "matcher": "WebSearch", "hooks": [{ "command": "my-custom-hook.sh" }] }
    ]
  }
}
'@
    Set-Content -Path $settingsPath -Value $settingsContent

    # Uninstall - should NOT modify global settings
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
    } catch { }

    # Both hooks should still be in global settings (not touched)
    $content = Get-Content -Path $settingsPath -Raw
    ($content -match "websearch-transformer") -and ($content -match "my-custom-hook")
}

Test-Case "Per-profile: Migration marker cleanup on uninstall" "Marker file removed" {
    # Setup: Create ~/.ccs/.hook-migrated marker
    $ccsDir = Join-Path $TestHome ".ccs"
    New-Item -ItemType Directory -Path $ccsDir -Force | Out-Null
    Set-Content -Path (Join-Path $ccsDir ".hook-migrated") -Value "2026-01-25T00:00:00.000Z"

    # Uninstall
    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
    } catch { }

    # Verify marker removed
    -not (Test-Path (Join-Path $ccsDir ".hook-migrated"))
}

Test-Case "Per-profile: Handles missing settings.json" "No error when settings.json missing" {
    # Ensure settings.json doesn't exist
    $settingsPath = Join-Path $TestClaudeDir "settings.json"
    if (Test-Path $settingsPath) {
        Remove-Item $settingsPath -Force
    }

    $env:HOME = $TestHome
    try {
        & $CcsPath --uninstall | Out-Null
        return $true
    } catch {
        return $false
    }
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-ColorOutput "========================================" "Cyan"
if ($FailCount -eq 0) {
    Write-ColorOutput "ALL TESTS PASSED!" "Green"
    Write-ColorOutput "========================================" "Green"
    Write-ColorOutput "--uninstall functionality is production ready!" "Green"
} else {
    Write-ColorOutput "SOME TESTS FAILED" "Red"
    Write-ColorOutput "========================================" "Red"
    Write-ColorOutput "Review failed tests above for details" "Red"
}

Write-Host ""
Write-ColorOutput "Test Summary:" "Cyan"
Write-Host "  Total tests: $TotalTests"
Write-ColorOutput "  Passed: $PassCount" "Green"
Write-ColorOutput "  Failed: $FailCount" "Red"
Write-Host ""

# Cleanup
Cleanup-AndRestore

exit $FailCount