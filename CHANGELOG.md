# Changelog

All notable changes to CCS will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/).

## [2.2.1] - 2025-11-03

### Changed
- **Version Management Simplified**: Executables now use hardcoded versions instead of reading VERSION file
  - `ccs` and `ccs.ps1` have hardcoded `CCS_VERSION` variable
  - `bump-version.sh` updates all files atomically (5 locations)
  - No runtime file I/O for version display (~1-2ms faster startup)
  - Removed VERSION file copying from installers
- **Selective Uninstall Cleanup**: When keeping ~/.ccs directory, only config files preserved
  - Removes: `ccs`, `uninstall.sh`, `VERSION` (executables and metadata)
  - Keeps: `config.json`, `*.settings.json`, `.claude/` (user configuration)
  - Clear reporting of removed vs kept files

### Fixed
- **Uninstall Issue**: Executables no longer left in ~/.ccs when choosing to keep directory
- **Version Display**: No longer requires VERSION file in ~/.ccs

### Technical Details
- **Files Modified**:
  - `ccs`: Hardcoded version, removed VERSION file reading
  - `ccs.ps1`: Hardcoded version, removed VERSION file reading
  - `scripts/bump-version.sh`: Updates 5 files (VERSION, executables, installers)
  - `installers/install.sh`: Removed VERSION file copying
  - `installers/install.ps1`: Removed VERSION file copying
  - `installers/uninstall.sh`: Added selective_cleanup() function
  - `installers/uninstall.ps1`: Added Invoke-SelectiveCleanup function
- **Security**: No new vulnerabilities introduced
- **Cross-platform**: Full parity maintained (Unix/Linux/macOS/Windows)

## [2.2.0] - 2025-11-03

### Added
- **Auto PATH Configuration**: Installer automatically detects shell (bash/zsh/fish) and adds `~/.local/bin` to PATH
- **Terminal Color Support**: ANSI color codes with TTY detection for enhanced visual feedback
- **NO_COLOR Support**: Respects NO_COLOR environment variable for accessibility
- **Enhanced Error Messages**: Box-drawing characters for critical errors (╔═╗ style)
- Multi-shell support with shell-specific syntax (bash/zsh: `export`, fish: `set -gx`)
- Idempotent PATH configuration (checks for existing entries before adding)
- Shell profile detection logic with automatic configuration
- Reload instructions after installation (source profile or new terminal)
- Manual PATH fallback instructions if auto-config fails
- **Install Location Display**: --version output shows installation path

### Changed
- **Unified Install Location**: All Unix systems now use `~/.local/bin` (consistent across macOS/Linux)
- **No Sudo Required**: User-writable location eliminates permission issues
- **All Emojis Removed**: Replaced with ASCII symbols for universal compatibility
  - [!] for warnings
  - [OK] for success
  - [X] for errors
  - [i] for information
- **PATH Warnings Enhanced**: Step-by-step instructions for shell configuration
- **GLM API Key Notices Improved**: Actionable guidance with URLs and examples
- **Error Message Format**: Consistent boxed formatting across all scripts
- **Success/Warning/Info Messages**: Unified styling with color support
- Enhanced PATH configuration workflow with clear user instructions
- Simplified installation process (one location for all platforms)

### Fixed
- **Shell Injection Vulnerability**: Critical security fix in shell detection (CVE-level)
- Error handling for profile directory creation
- Profile file creation errors now properly handled
- SHELL environment variable edge cases

### Technical Details
- **Files Modified**:
  - installers/install.sh: Auto PATH config functions, shell detection, security fixes
  - installers/install.ps1: Color function equivalents
  - installers/uninstall.sh: Color functions, simplified cleanup
  - installers/uninstall.ps1: Color function equivalents
  - ccs: Color functions, enhanced error messages, install location display
  - ccs.ps1: Enhanced error messages with PowerShell colors
- **Lines Added**: ~200+ (new auto PATH logic)
- **Lines Removed**: ~50 (platform-specific code)
- **Test Coverage**: 100% pass rate (syntax, idempotent, shell detection, security)
- **Security Review**: Approved after fixes (shell injection vulnerability patched)
- **Cross-Platform Parity**: Maintained across macOS, Linux, Windows

### Migration Notes

#### For All Unix Users (macOS & Linux)
Installation location: `~/.local/bin/ccs`

**What Happens Automatically:**
1. Installer detects your shell (bash/zsh/fish)
2. Checks if ~/.local/bin in PATH
3. If not, adds to shell profile with clear comment
4. Shows reload instructions

**Manual PATH Config (if auto-config fails):**
```bash
# For bash/zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc  # or ~/.zshrc

# For fish
echo 'set -gx PATH $HOME/.local/bin $PATH' >> ~/.config/fish/config.fish

# Reload
source ~/.bashrc  # or ~/.zshrc or restart terminal
```

#### For Windows Users
No changes. Installation remains at `~/.ccs/ccs.ps1` with automatic PATH configuration.

## [2.1.0] - 2025-11-02

### Changed
- **MAJOR SIMPLIFICATION**: Windows PowerShell now uses `--settings` flag (confirmed working in Claude CLI 2.0.31+)
- Removed 64 lines of environment variable management code from ccs.ps1
- Windows and Unix/Linux/macOS now use identical approach
- Updated all documentation to reflect cross-platform consistency
- ccs.ps1: 235 lines → 171 lines (27% reduction)

### Technical Details
- Windows Claude CLI DOES support `--settings` flag (contrary to previous assumptions)
- No longer manually sets/restores environment variables
- Simpler, cleaner, more maintainable codebase
- Settings file format unchanged (still uses `{"env": {...}}` structure)

## [2.0.0] - 2025-11-02

### BREAKING CHANGES
- Removed `ccs son` profile - use `ccs` (default) for Claude subscription
- Config structure simplified - `sonnet` profile removed from default config

### Added
- `config/` folder with organized templates (base-glm, base-dsp, config.example)
- `config/README.md` - comprehensive config documentation
- `installers/` folder for clean project structure (install/uninstall scripts)
- Smart installer with validation and self-healing
- Non-invasive approach - never modifies `~/.claude/settings.json`
- Version pinning support: `curl ccs.kaitran.ca/v2.0.0/install | bash`
- CHANGELOG.md for release tracking
- WORKFLOW.md - comprehensive workflow documentation
- Migration detection and auto-migration from v1.x configs
- Config backup before modifications with timestamp
- JSON validation for all config files
- GitHub Actions workflow for auto-deploying CloudFlare Worker
- VERSION file for centralized version management

### Fixed
- **CRITICAL**: PowerShell env var bug - strict filtering prevents crashes on non-string values
- PowerShell now requires `env` object in settings files (prevents crashes on root-level fields)
- Type validation for environment variables (strings only)
- Installer now validates all JSON before processing
- Better error messages with actionable solutions

### Changed
- `ccs` now default behavior (uses Claude subscription, no profile needed)
- Simplified profile management (glm fallback only)
- Moved `.ccs.example.json` → `config/config.example.json`
- Reorganized project: install/uninstall scripts → `installers/` folder
- Enhanced error messages with solutions and reinstall instructions
- Removed sonnet profile creation from installers
- Config structure: `{ "glm": "...", "default": "~/.claude/settings.json" }`
- Worker.js routing updated for new installers/ path

### Migration Guide
- Old users: `ccs son` → `ccs` (automatic deprecation warning during install)
- Config auto-migrates during installation (son/sonnet profiles removed)
- GLM API keys preserved during upgrade
- Backup created automatically: `~/.ccs/config.json.backup.TIMESTAMP`
- No action needed unless you customized `sonnet` profile

## [1.1.0] - 2025-11-01

### Added
- Support for git worktrees and submodules
- Enhanced GLM profile with default model variables
- Improved installer detection logic

### Fixed
- BASH_SOURCE unbound variable error in installer
- Git worktree detection

## [1.0.0] - 2025-10-31

### Added
- Initial release
- Profile-based switching between Claude and GLM
- Cross-platform support (macOS, Linux, Windows)
- One-line installation
- Auto-detection of current provider
