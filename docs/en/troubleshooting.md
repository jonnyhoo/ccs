# CCS Troubleshooting Guide

> **Note**: CCS has been recently simplified with a 35% code reduction (1,315 → 855 lines) while maintaining all functionality. The troubleshooting steps below apply to the simplified architecture.

## Native Installer Deprecation

**Issue:** "Why does the curl/irm installer show a deprecation warning?"

**Cause:** Native shell installers are deprecated in favor of npm installation.

**Solution:**
```bash
# Uninstall legacy version (if installed via curl/irm)
ccs-uninstall  # or: curl -fsSL ccs.kaitran.ca/uninstall | bash

# Install via npm (recommended)
npm install -g @kaitranntt/ccs
```

**Note:** The legacy installer now auto-runs npm install if Node.js is available.

## npm Installation Issues

### Config File Not Found After npm Install

**Symptom**: After `npm install -g @kaitranntt/ccs`, running `ccs --version` shows error:
```
Config file not found: /home/user/.ccs/config.json
```

**Cause**: You may have installed with `--ignore-scripts` flag, which skips the postinstall script that creates config files.

**Solution**:
```bash
# Reinstall without --ignore-scripts
npm install -g @kaitranntt/ccs --force

# Or manually run postinstall
node $(npm root -g)/@kaitranntt/ccs/scripts/postinstall.js

# Or use traditional installer
curl -fsSL ccs.kaitran.ca/install | bash  # macOS/Linux
irm ccs.kaitran.ca/install | iex           # Windows
```

**Verify**:
```bash
ls -la ~/.ccs/
# Should show: config.json, glm.settings.json
```

### Check npm ignore-scripts Setting

```bash
# Check if ignore-scripts is enabled
npm config get ignore-scripts

# If true, disable it (or use --force on install)
npm config set ignore-scripts false
```

## Windows-Specific Issues

### PowerShell Execution Policy

If you see "cannot be loaded because running scripts is disabled":

```powershell
# Check current policy
Get-ExecutionPolicy

# Allow current user to run scripts (recommended)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or run with bypass (one-time)
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ccs\ccs.ps1" glm
```

### PATH not updated (Windows)

If `ccs` command not found after installation:

1. Restart your terminal
2. Or manually add to PATH:
   - Open "Edit environment variables for your account"
   - Add `%USERPROFILE%\.ccs` to User PATH
   - Restart terminal

### Claude CLI not found (Windows)

```powershell
# Check Claude CLI
where.exe claude

# If missing, install from Claude docs
```

## Claude CLI in Non-Standard Location

If Claude CLI is installed on a different drive or custom location (common on Windows systems with D: drives):

### Symptoms
```
╔═════════════════════════════════════════════╗
║  ERROR                                      ║
╚═════════════════════════════════════════════╝

Claude CLI not found

Searched:
  - CCS_CLAUDE_PATH: (not set)
  - System PATH: not found
  - Common locations: not found
```

### Solution: Set CCS_CLAUDE_PATH

**Step 1: Find Claude CLI Location**

*Windows*:
```powershell
# Search all drives
Get-ChildItem -Path C:\,D:\,E:\ -Filter claude.exe -Recurse -ErrorAction SilentlyContinue | Select-Object FullName

# Common locations to check manually
D:\Program Files\Claude\claude.exe
D:\Tools\Claude\claude.exe
D:\Users\<Username>\AppData\Local\Claude\claude.exe
```

*Unix/Linux/macOS*:
```bash
# Search system
sudo find / -name claude 2>/dev/null

# Or check specific locations
ls -la /usr/local/bin/claude
ls -la ~/.local/bin/claude
ls -la /opt/homebrew/bin/claude
```

**Step 2: Set Environment Variable**

*Windows (PowerShell) - Permanent*:
```powershell
# Replace with your actual path
$ClaudePath = "D:\Program Files\Claude\claude.exe"

# Set for current session
$env:CCS_CLAUDE_PATH = $ClaudePath

# Set permanently for user
[Environment]::SetEnvironmentVariable("CCS_CLAUDE_PATH", $ClaudePath, "User")

# Restart terminal to apply
```

*Unix (bash) - Permanent*:
```bash
# Replace with your actual path
CLAUDE_PATH="/opt/custom/location/claude"

# Add to shell profile
echo "export CCS_CLAUDE_PATH=\"$CLAUDE_PATH\"" >> ~/.bashrc

# Reload profile
source ~/.bashrc
```

*Unix (zsh) - Permanent*:
```bash
# Replace with your actual path
CLAUDE_PATH="/opt/custom/location/claude"

# Add to shell profile
echo "export CCS_CLAUDE_PATH=\"$CLAUDE_PATH\"" >> ~/.zshrc

# Reload profile
source ~/.zshrc
```

**Step 3: Verify Configuration**

```bash
# Check environment variable is set
echo $CCS_CLAUDE_PATH        # Unix
$env:CCS_CLAUDE_PATH         # Windows

# Test CCS can find Claude
ccs --version

# Test with actual profile
ccs glm --version
```

### Common Issues

**Invalid Path**:
```
Error: File not found: D:\Program Files\Claude\claude.exe
```

**Fix**: Double-check path, ensure file exists:
```powershell
Test-Path "D:\Program Files\Claude\claude.exe"  # Windows
ls -la "/path/to/claude"                         # Unix
```

**Directory Instead of File**:
```
Error: Path is a directory: D:\Program Files\Claude
```

**Fix**: Path must point to `claude.exe` file, not directory:
```powershell
# Wrong
$env:CCS_CLAUDE_PATH = "D:\Program Files\Claude"

# Right
$env:CCS_CLAUDE_PATH = "D:\Program Files\Claude\claude.exe"
```

**Not Executable**:
```
Error: File is not executable: /path/to/claude
```

**Fix** (Unix only):
```bash
chmod +x /path/to/claude
```

### WSL-Specific Configuration

When using Windows Claude from WSL:

```bash
# Mount path format: /mnt/d/ for D: drive
export CCS_CLAUDE_PATH="/mnt/d/Program Files/Claude/claude.exe"

# Add to ~/.bashrc for persistence
echo 'export CCS_CLAUDE_PATH="/mnt/d/Program Files/Claude/claude.exe"' >> ~/.bashrc
source ~/.bashrc
```

**Note**: Spaces in Windows paths work correctly from WSL when quoted properly.

### Debugging Detection

To see what CCS checked:

```bash
# Temporarily move claude out of PATH to test
# Then run ccs - error message shows what was checked

ccs --version
# Will show:
#   - CCS_CLAUDE_PATH: (status)
#   - System PATH: not found
#   - Common locations: not found
```

### Alternative: Add to PATH Instead

If you prefer not using CCS_CLAUDE_PATH, add Claude directory to PATH:

*Windows (PowerShell)*:
```powershell
# Add D:\Program Files\Claude to PATH
$ClaudeDir = "D:\Program Files\Claude"
$env:Path += ";$ClaudeDir"
[Environment]::SetEnvironmentVariable("Path", $env:Path, "User")

# Restart terminal
```

*Unix (bash)*:
```bash
# Add /opt/claude/bin to PATH
echo 'export PATH="/opt/claude/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**Note**: CCS_CLAUDE_PATH takes priority over PATH, allowing per-project overrides.

## Installation Issues

### BASH_SOURCE unbound variable error

This error occurs when running the installer in some shells or environments.

**Fixed in latest version**: The installer now handles both piped execution (`curl | bash`) and direct execution (`./install.sh`).

**Solution**: Upgrade to the latest version:
```bash
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/installers/install.sh | bash
```

### Git worktree not detected

If installing from a git worktree or submodule, older versions may fail to detect the git repository.

**Fixed in latest version**: The installer now detects both `.git` directory (standard clone) and `.git` file (worktree/submodule).

**Solution**: Upgrade to the latest version or use the curl installation method.

## Configuration Issues

### Profile not found

```
Error: Profile 'foo' not found in ~/.ccs/config.json
```

**Fix**: Add profile to `~/.ccs/config.json`:
```json
{
  "profiles": {
    "foo": "~/.ccs/foo.settings.json"
  }
}
```

### Settings file missing

```
Error: Settings file not found: ~/.ccs/foo.settings.json
```

**Fix**: Create settings file or fix path in config.

### jq not installed

```
Error: jq is required but not installed
```

**Fix**: Install jq (see installation guide).

**Note**: The installer creates basic templates even without jq, but enhanced features require jq.

## PATH Configuration Issues

### Auto PATH Configuration

v2.2.0+ automatically configures shell PATH. If you see reload instructions after install, follow them:

**For bash**:
```bash
source ~/.bashrc
```

**For zsh**:
```bash
source ~/.zshrc
```

**For fish**:
```fish
source ~/.config/fish/config.fish
```

**Or open new terminal window** (PATH auto-loaded).

### PATH Not Configured

If `ccs` command not found after install and reload:

**Verify PATH entry exists**:
```bash
# For bash/zsh
grep "\.local/bin" ~/.bashrc ~/.zshrc

# For fish
grep "\.local/bin" ~/.config/fish/config.fish
```

**Manual fix** (if auto-config failed):

Bash:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Zsh:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Fish:
```fish
echo 'set -gx PATH $HOME/.local/bin $PATH' >> ~/.config/fish/config.fish
source ~/.config/fish/config.fish
```

### Wrong Shell Profile

If auto-config added to wrong file:

**Find active profile**:
```bash
echo $SHELL  # Shows current shell
```

**Common scenarios**:
- macOS bash uses `~/.bash_profile` (not `~/.bashrc`)
- Custom shells need manual config
- Tmux/screen may use different shell

**Solution**: Manually add PATH to correct profile file.

### Shell Not Detected

If installer couldn't detect shell:

**Symptoms**:
- No PATH warning shown
- `ccs` command not found after install

**Solution**: Manual PATH setup (see above).

### Default profile missing

```
Error: Profile 'default' not found in ~/.ccs/config.json
```

**Fix**: Add "default" profile or always specify profile name:
```json
{
  "profiles": {
    "default": "~/.claude/settings.json"
  }
}
```

## Common Problems

### Claude CLI not found

**Error Message**:
```
╔═════════════════════════════════════════════╗
║  ERROR                                      ║
╚═════════════════════════════════════════════╝

claude command not found
```

**Solution**: Install Claude CLI from [official documentation](https://docs.claude.com/en/docs/claude-code/installation).

### Permission denied

```
Error: Permission denied: ~/.local/bin/ccs
```

**Solution**: Make the script executable:
```bash
chmod +x ~/.local/bin/ccs
```

### Config file not found

**Error Message**:
```
╔═════════════════════════════════════════════╗
║  ERROR                                      ║
╚═════════════════════════════════════════════╝

Config file not found: ~/.ccs/config.json

Solutions:
  1. Reinstall CCS:
     curl -fsSL ccs.kaitran.ca/install | bash

  2. Or create config manually:
     mkdir -p ~/.ccs
     cat > ~/.ccs/config.json << 'EOF'
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
```

**Solution**: Re-run installer or create config manually:
```bash
mkdir -p ~/.ccs
cat > ~/.ccs/config.json << 'EOF'
{
  "profiles": {
    "glm": "~/.ccs/glm.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
```

## Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/kaitranntt/ccs/issues)
2. Create a new issue with:
   - Your operating system
   - CCS version (`ccs --version`)
   - Exact error message
   - Steps to reproduce

## Debug Mode

Enable verbose output to troubleshoot issues:

```bash
ccs --verbose glm
```

This will show:
- Which config file is being read
- Which profile is being selected
- Which settings file is being used
- The exact command being executed

## Disable Colored Output

If color output causes issues in your terminal or logs:

```bash
export NO_COLOR=1
ccs glm
```

**Use Cases**:
- CI/CD environments
- Log file generation
- Terminals without color support
- Accessibility preferences

---

## GLMT Troubleshooting

### Thinking Blocks Not Visible

1. **Enable debug logging**:
   ```bash
   export CCS_DEBUG_LOG=1
   ccs glmt --verbose "test"
   ```

2. **Check raw response**:
   ```bash
   cat ~/.ccs/logs/*response-openai.json | jq '.choices[0].message.reasoning_content'
   ```

3. **Scenarios**:
   - **reasoning_content present**: Transformation issue → check response-anthropic.json
   - **reasoning_content absent**: Z.AI API issue → verify API key/account status

### Duplicate "Enchanting" Lines

**Symptom**: Two spinner lines during thinking

**Cause**: Terminal rendering (not CCS issue)

**Solutions**:
- Use native terminal (iTerm2, GNOME Terminal, Windows Terminal)
- Exit tmux/screen before running
- Accept visual glitch (functionality unaffected)

### Proxy Startup Timeout

**Error**: "Proxy startup timeout (5s)"

**Solutions**:
```bash
# Try non-thinking mode
ccs glm "your prompt"

# Check Node.js
node --version  # Requires ≥14

# Check port availability
netstat -an | grep 127.0.0.1

# Verbose details
ccs glmt --verbose "test"
```