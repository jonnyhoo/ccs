<div align="center">

# CCS - Claude Code Switch

![CCS Logo](docs/assets/ccs-logo-medium.png)

### Manage multiple AI accounts from one dashboard.
Run Claude, Gemini, GLM, and more - concurrently, without conflicts.

[![License](https://img.shields.io/badge/license-MIT-C15F3C?style=for-the-badge)](LICENSE)
[![npm](https://img.shields.io/npm/v/@kaitranntt/ccs?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@kaitranntt/ccs)
[![PoweredBy](https://img.shields.io/badge/PoweredBy-ClaudeKit-C15F3C?style=for-the-badge)](https://claudekit.cc?ref=HMNKXOHN)

**[Features & Pricing](https://ccs.kaitran.ca)** | **[Documentation](./docs/en/)** | [Tiếng Việt](docs/vi/README.md) | [日本語](docs/ja/README.md)

</div>

<br>

## The Three Pillars

| Capability | What It Does | Manage Via |
|------------|--------------|------------|
| **Multiple Claude Accounts** | Run work + personal Claude subs simultaneously | Dashboard |
| **OAuth Providers** | Gemini, Codex, Antigravity - zero API keys needed | Dashboard |
| **API Profiles** | GLM, Kimi with your own API keys | Dashboard |

<br>

## Quick Start

### 1. Install

```bash
npm install -g @kaitranntt/ccs
```

<details>
<summary>Alternative package managers</summary>

```bash
yarn global add @kaitranntt/ccs    # yarn
pnpm add -g @kaitranntt/ccs        # pnpm (70% less disk space)
bun add -g @kaitranntt/ccs         # bun (30x faster)
```

</details>

### 2. Open Dashboard

```bash
ccs config
# Opens http://localhost:3000
```

### 3. Configure Your Accounts

The dashboard provides visual management for all account types:

- **Claude Accounts**: Create isolated instances (work, personal, client)
- **OAuth Providers**: One-click auth for Gemini, Codex, Antigravity
- **API Profiles**: Configure GLM, Kimi with your keys
- **Health Monitor**: Real-time status across all profiles

**Analytics (Light/Dark Theme)**

![Analytics Light](docs/assets/screenshots/analytics-light.png)

![Analytics Dark](docs/assets/screenshots/analytics.png)

**API Profiles & OAuth Providers**

![API Profiles](docs/assets/screenshots/api_profiles.png)

![CLIProxy](docs/assets/screenshots/cliproxy.png)

<br>

## Supported Providers

| Provider | Auth Type | Command | Best For |
|----------|-----------|---------|----------|
| **Claude** | Subscription | `ccs` | Default, strategic planning |
| **Gemini** | OAuth | `ccs gemini` | Zero-config, fast iteration |
| **Codex** | OAuth | `ccs codex` | Code generation |
| **Antigravity** | OAuth | `ccs agy` | Alternative routing |
| **GLM** | API Key | `ccs glm` | Cost-optimized execution |
| **Kimi** | API Key | `ccs kimi` | Long-context, thinking mode |

> **OAuth providers** authenticate via browser on first run. Tokens are cached in `~/.ccs/cliproxy/auth/`.

<br>

## Usage

### Basic Commands

```bash
ccs           # Default Claude session
ccs agy       # Antigravity (OAuth)
ccs gemini    # Gemini (OAuth)
ccs glm       # GLM (API key)
```

### Parallel Workflows

Run multiple terminals with different providers:

```bash
# Terminal 1: Planning (Claude Pro)
ccs work "design the authentication system"

# Terminal 2: Execution (GLM - cost optimized)
ccs glm "implement the user service from the plan"

# Terminal 3: Review (Gemini)
ccs gemini "review the implementation for security issues"
```

### Multi-Account Claude

Create isolated Claude instances for work/personal separation:

```bash
ccs auth create work

# Run concurrently in separate terminals
ccs work "implement feature"    # Terminal 1
ccs  "review code"              # Terminal 2 (personal account)
```

<br>

## Maintenance

### Health Check

```bash
ccs doctor
```

Verifies: Claude CLI, config files, symlinks, permissions.

### Update

```bash
ccs update              # Update to latest
ccs update --force      # Force reinstall
ccs update --beta       # Install dev channel
```

### Sync Shared Items

```bash
ccs sync
```

Re-creates symlinks for shared commands, skills, and settings.

<br>

## Configuration

CCS auto-creates config on install. Dashboard is the recommended way to manage settings.

**Config location**: `~/.ccs/config.yaml`

<details>
<summary>Custom Claude CLI path</summary>

If Claude CLI is installed in a non-standard location:

```bash
export CCS_CLAUDE_PATH="/path/to/claude"              # Unix
$env:CCS_CLAUDE_PATH = "D:\Tools\Claude\claude.exe"   # Windows
```

</details>

<details>
<summary>Windows symlink support</summary>

Enable Developer Mode for true symlinks:

1. **Settings** → **Privacy & Security** → **For developers**
2. Enable **Developer Mode**
3. Reinstall: `npm install -g @kaitranntt/ccs`

Without Developer Mode, CCS falls back to copying directories.

</details>

<br>

## Documentation

| Topic | Link |
|-------|------|
| Installation | [docs/en/installation.md](./docs/en/installation.md) |
| Configuration | [docs/en/configuration.md](./docs/en/configuration.md) |
| OAuth Providers | [docs/en/oauth.md](./docs/en/oauth.md) |
| Multi-Account Claude | [docs/en/multi-account.md](./docs/en/multi-account.md) |
| Delegation | [docs/en/delegation.md](./docs/en/delegation.md) |
| GLMT (Experimental) | [docs/en/glmt.md](./docs/en/glmt.md) |
| Architecture | [docs/system-architecture.md](./docs/system-architecture.md) |
| Troubleshooting | [docs/en/troubleshooting.md](./docs/en/troubleshooting.md) |

<br>

## Uninstall

```bash
npm uninstall -g @kaitranntt/ccs
```

<details>
<summary>Alternative package managers</summary>

```bash
yarn global remove @kaitranntt/ccs
pnpm remove -g @kaitranntt/ccs
bun remove -g @kaitranntt/ccs
```

</details>

<br>

## Philosophy

- **YAGNI**: No features "just in case"
- **KISS**: Simple, focused implementation
- **DRY**: One source of truth (config)

<br>

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

<br>

## License

MIT License - see [LICENSE](LICENSE).

<div align="center">

---

**[ccs.kaitran.ca](https://ccs.kaitran.ca)** | [Report Issues](https://github.com/kaitranntt/ccs/issues) | [Star on GitHub](https://github.com/kaitranntt/ccs)

</div>
