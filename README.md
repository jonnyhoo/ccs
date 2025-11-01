# CCS - Claude Code Switch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bash](https://img.shields.io/badge/bash-3.2%2B-blue.svg)](https://www.gnu.org/software/bash/)
[![GitHub Stars](https://img.shields.io/github/stars/kaitranntt/ccs.svg)](https://github.com/kaitranntt/ccs/stargazers)

> Switch between Claude Sonnet 4.5 and GLM 4.6 instantly. Use the right model for each task.

**The Problem**: You have both Claude subscription and GLM Coding Plan. Two scenarios happen daily:
1. **Rate limits**: Claude hits limit mid-project, you manually edit `~/.claude/settings.json` to switch
2. **Task optimization**: Complex planning needs Claude Sonnet 4.5's intelligence, but simple coding works fine with GLM 4.6

Manual switching is tedious and error-prone.

**The Solution**:
```bash
ccs son       # Complex refactoring? Use Claude Sonnet 4.5
ccs glm       # Simple bug fix? Use GLM 4.6
# Hit rate limit? Switch instantly:
ccs glm       # Continue working with GLM
```

One command. Zero downtime. No file editing. Right model, right task.

## Quick Start

**Install** (one-liner):
```bash
curl -fsSL kaitran.ca/ccs/install | bash
```

**Configure**:
```bash
# Edit with your profiles
cat > ~/.ccs.json << 'EOF'
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "son": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
EOF
```

**Use**:
```bash
ccs          # Use default profile
ccs glm      # Use GLM profile
ccs son      # Use Sonnet profile
```

## Why CCS?

**Built for developers with both Claude subscription and GLM Coding Plan.**

### Two Real Use Cases

#### 1. Task-Appropriate Model Selection
**Claude Sonnet 4.5** excels at:
- Complex architectural decisions
- System design and planning
- Debugging tricky issues
- Code reviews requiring deep reasoning

**GLM 4.6** works great for:
- Simple bug fixes
- Straightforward implementations
- Routine refactoring
- Documentation writing

**With CCS**: Switch models based on task complexity, maximize quality while managing costs.

```bash
ccs son       # Planning new feature architecture
# Got the plan? Implement with GLM:
ccs glm       # Write the straightforward code
```

#### 2. Rate Limit Management
If you have both Claude subscription and GLM Coding Plan, you know the pain:
- Claude hits rate limit mid-project
- You manually copy GLM config to `~/.claude/settings.json`
- 5 minutes later, need to switch back
- Repeat 10x per day

**CCS solves this**:
- One command to switch: `ccs glm` or `ccs son`
- Keep both configs saved as profiles
- Switch in <1 second
- No file editing, no copy-paste, no mistakes

### Features
- Instant profile switching (Claude ↔ GLM)
- Pass-through all Claude CLI args
- Smart setup: detects your current provider
- Auto-creates configs during install
- No proxies, no magic—just bash + jq

## Installation

### One-Liner (Recommended)

**Short URL** (via CloudFlare):
```bash
curl -fsSL kaitran.ca/ccs/install | bash
```

**Direct from GitHub**:
```bash
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/install.sh | bash
```

**Note**: The installer supports both direct execution (`./install.sh`) and piped installation (`curl | bash`).

### Git Clone

```bash
git clone https://github.com/kaitranntt/ccs.git
cd ccs
./install.sh
```

**Note**: Works with git worktrees and submodules - the installer detects both `.git` directory and `.git` file.

### Manual

```bash
# Download script
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/ccs -o ~/.local/bin/ccs
chmod +x ~/.local/bin/ccs

# Ensure ~/.local/bin in PATH
export PATH="$HOME/.local/bin:$PATH"
```

### Upgrade

**From git clone**:
```bash
cd ccs && git pull && ./install.sh
```

**From curl install**:
```bash
# Short URL
curl -fsSL kaitran.ca/ccs/install | bash

# Or direct from GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/install.sh | bash
```

**Note**: Upgrading preserves your existing API keys and settings. The installer only adds new features without overwriting your configuration.

## Configuration

The installer auto-creates `~/.ccs.json` and profile templates during installation. If you need to customize:

```json
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "sonnet": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

Each profile points to a Claude settings JSON file. Create settings files per [Claude CLI docs](https://docs.claude.com/en/docs/claude-code/installation).

### GLM Profile Configuration

The installer automatically configures GLM profiles with enhanced environment variables:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY_HERE",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

**Environment Variables**:
- `ANTHROPIC_DEFAULT_OPUS_MODEL`: Default model for Opus-class requests
- `ANTHROPIC_DEFAULT_SONNET_MODEL`: Default model for Sonnet-class requests
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`: Default model for Haiku-class requests

These variables ensure GLM is used as the default provider when switching profiles.

## Usage

### Basic

```bash
ccs           # Use default profile (no args)
ccs glm       # Use GLM profile
ccs son       # Use Sonnet profile
```

### With Arguments

All args after profile name pass directly to Claude CLI:

```bash
ccs glm --verbose
ccs son /plan "add feature"
ccs default --model claude-sonnet-4
```

### Custom Config Location

```bash
export CCS_CONFIG=~/my-custom-ccs.json
ccs glm
```

## Use Cases

### Real Workflow: Task-Based Model Selection

**Scenario**: Building a new payment integration feature

```bash
# Step 1: Architecture & Planning (needs Claude's intelligence)
ccs son
/plan "Design payment integration with Stripe, handle webhooks, errors, retries"
# → Claude Sonnet 4.5 thinks deeply about edge cases, security, architecture

# Step 2: Implementation (straightforward coding, use GLM)
ccs glm
/code "implement the payment webhook handler from the plan"
# → GLM 4.6 writes the code efficiently, saves Claude usage

# Step 3: Code Review (needs deep analysis)
ccs son
/review "check the payment handler for security issues"
# → Claude Sonnet 4.5 catches subtle vulnerabilities

# Step 4: Bug Fixes (simple)
ccs glm
/fix "update error message formatting"
# → GLM 4.6 handles routine fixes
```

**Result**: Best model for each task, lower costs, better quality.

### Real Workflow: Rate Limit Management

```bash
# Working on complex refactoring with Claude
ccs son
/plan "refactor authentication system"

# Claude hits rate limit mid-task
# → Error: Rate limit exceeded

# Switch to GLM instantly
ccs glm
# Continue working without interruption

# Rate limit resets? Switch back
ccs son
```

### Configuration Examples

**Standard setup** (Claude sub + GLM):
```json
{
  "profiles": {
    "glm": "~/.claude/glm.settings.json",
    "sonnet": "~/.claude/sonnet.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

**Advanced setup** (multiple providers):
```json
{
  "profiles": {
    "sonnet": "~/.claude/sonnet.settings.json",
    "glm": "~/.claude/glm.settings.json",
    "haiku": "~/.claude/haiku.settings.json",
    "default": "~/.claude/settings.json"
  }
}
```

## How It Works

1. Reads profile name (defaults to "default" if omitted)
2. Looks up settings file path in `~/.ccs.json`
3. Executes `claude --settings <path> [remaining-args]`

No magic. No file modification. Pure delegation.

## Requirements

- `bash` 3.2+
- `jq` (JSON processor)
- [Claude CLI](https://docs.claude.com/en/docs/claude-code/installation)

### Installing jq

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Fedora
sudo dnf install jq

# Arch
sudo pacman -S jq
```

## Troubleshooting

### Installation Issues

#### BASH_SOURCE unbound variable error

This error occurs when running the installer in some shells or environments.

**Fixed in latest version**: The installer now handles both piped execution (`curl | bash`) and direct execution (`./install.sh`).

**Solution**: Upgrade to the latest version:
```bash
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/install.sh | bash
```

#### Git worktree not detected

If installing from a git worktree or submodule, older versions may fail to detect the git repository.

**Fixed in latest version**: The installer now detects both `.git` directory (standard clone) and `.git` file (worktree/submodule).

**Solution**: Upgrade to the latest version or use the curl installation method.

### Configuration Issues

#### Profile not found

```
Error: Profile 'foo' not found in ~/.ccs.json
```

**Fix**: Add profile to `~/.ccs.json`:
```json
{
  "profiles": {
    "foo": "~/.claude/foo.settings.json"
  }
}
```

#### Settings file missing

```
Error: Settings file not found: ~/.claude/foo.settings.json
```

**Fix**: Create settings file or fix path in config.

#### jq not installed

```
Error: jq is required but not installed
```

**Fix**: Install jq (see Requirements).

**Note**: The installer creates basic templates even without jq, but enhanced features require jq.

### Environment Issues

#### PATH not set

```
⚠️  Warning: ~/.local/bin is not in PATH
```

**Fix**: Add to `~/.bashrc` or `~/.zshrc`:
```bash
export PATH="$HOME/.local/bin:$PATH"
```
Then `source ~/.bashrc` or restart shell.

#### Default profile missing

```
Error: Profile 'default' not found in ~/.ccs.json
```

**Fix**: Add "default" profile or always specify profile name:
```json
{
  "profiles": {
    "default": "~/.claude/settings.json"
  }
}
```

### Upgrade Issues

#### API keys lost after upgrade

**Not a problem**: The installer preserves existing API keys when upgrading. If you're using GLM, your API key is automatically preserved and the profile is enhanced with new default model variables.

**Verification**: Check `~/.claude/glm.settings.json` - your `ANTHROPIC_AUTH_TOKEN` should still be present.

## Uninstallation

**Using installed command**:
```bash
ccs-uninstall
```

**One-liner** (if ccs-uninstall not available):
```bash
# Short URL
curl -fsSL kaitran.ca/ccs/uninstall | bash

# Or direct from GitHub
curl -fsSL https://raw.githubusercontent.com/kaitranntt/ccs/main/uninstall.sh | bash
```

**Manual**:
```bash
rm ~/.local/bin/ccs
rm ~/.local/bin/ccs-uninstall
rm ~/.ccs.json  # If you want to remove config
```

## Contributing

PRs welcome! Keep it simple (KISS principle).

**Guidelines**:
- Maintain bash 3.2+ compatibility
- No dependencies beyond jq
- Test on macOS and Linux
- Follow existing code style

## Philosophy

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash, no complexity
- **DRY**: One source of truth (config)

This tool does ONE thing well: map profile names to settings files.

## License

MIT © [Kai Tran](https://github.com/kaitranntt)

## Links

- [Claude CLI Docs](https://docs.claude.com/en/docs/claude-code/installation)
- [Report Issues](https://github.com/kaitranntt/ccs/issues)
- [Changelog](https://github.com/kaitranntt/ccs/releases)
