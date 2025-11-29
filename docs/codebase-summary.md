# CCS Codebase Summary (v4.5.0)

## Overview

CCS (Claude Code Switch) v4.5.0 is a lightweight CLI wrapper enabling instant profile switching between Claude Sonnet 4.5, GLM 4.6, GLMT (GLM with Thinking), and Kimi for Coding models. Version 4.x introduces AI-powered delegation, selective .claude/ directory symlinking, stream-JSON output, and enhanced shell completion. **Phase 02 (2025-11-28)** completes modular command architecture refactoring with 44.6% main file reduction and deprecates native shell installers. v4.5.0 completes transition to npm-first, Node.js-based architecture with bootstrap installers and CSS text-only output (no emojis).

## Version Evolution

### v4.5.0 Architecture (Current, Phase 02 Complete - 2025-11-28)
- **Total LOC**: ~8,477 lines (JavaScript/TypeScript)
- **Main File**: src/ccs.ts - 593 lines (**44.6% reduction** from 1,071 lines)
- **Key Features**: AI delegation, stream-JSON output, shell completion, doctor diagnostics, sync command
- **Phase 02 Modular Commands**: 6 specialized command handlers (version, help, install, doctor, sync, shell-completion) + deprecation notices
- **Installation Method**: npm-first (curl/irm scripts deprecated, auto-redirect to npm)
- **New Components**: src/commands/, src/utils/shell-executor.ts, src/utils/package-manager-detector.ts
- **Architecture**: Modular design with clear separation: auth/, delegation/, glmt/, management/, utils/, commands/, types/
- **Output Format**: Text-only ASCII indicators ([OK], [!], [X], [i]) - no emoji usage per CLAUDE.md

### Evolution Summary
- **v2.x**: Vault-based credential encryption (~1,700 LOC)
- **v3.0**: Vault removal, login-per-profile (~1,100 LOC, 40% reduction)
- **v4.0-4.4.x**: Delegation system, .claude/ sharing, stream-JSON (~8,477 LOC including tests/utils)
- **Phase 02 (2025-11-28)**: Modular command architecture, native installer deprecation, main file 44.6% reduction
- **v4.5.0**: npm-first distribution, TypeScript package with quality gates, modular commands, text-only output (no emojis)

## Core Components (Phase 02 Complete - 2025-11-28)

### 1. Main Entry Point (`src/ccs.ts` - 593 lines, 44.6% reduction)

**Role**: Central orchestrator with **modular command routing** (Phase 02 enhanced)

**Key Functions**:
- `execClaude(claudeCli, args, envVars)`: Unified spawn logic (Windows shell detection)
- `execClaudeWithProxy(claudeCli, profile, args)`: GLMT proxy lifecycle
- `main()`: Profile routing + delegation detection (-p flag) + **command routing to modular handlers**

**Phase 02 Modular Enhancements**:
- **Command Routing**: Delegates to 6 specialized command handlers
- **Main File Focus**: Now contains only routing logic + profile detection + GLMT proxy
- **Maintainability**: Single responsibility principle applied to all commands
- **Testing Independence**: Each command handler can be unit tested in isolation

**v4.x Enhancements**:
- Delegation detection: `-p` flag routes to DelegationHandler
- Stream-JSON output support for real-time tool tracking
- Shell completion installation (`--shell-completion`)
- Update checking and CCS sync commands
- Enhanced version display with API key validation

**Architecture Flow**:
```javascript
// Delegation path (v4.0+)
if (args.includes('-p') || args.includes('--prompt')) {
  const { DelegationHandler } = require('./delegation/delegation-handler');
  const handler = new DelegationHandler();
  await handler.route(args);
}

// Settings profile (glm, kimi, glmt)
const expandedSettingsPath = getSettingsPath(profileInfo.name);
if (profileInfo.name === 'glmt') {
  await execClaudeWithProxy(claudeCli, 'glmt', remainingArgs);
} else {
  execClaude(claudeCli, ['--settings', expandedSettingsPath, ...remainingArgs]);
}

// Account profile (work, personal)
const instancePath = instanceMgr.ensureInstance(profileInfo.name);
registry.touchProfile(profileInfo.name);
const envVars = { CLAUDE_CONFIG_DIR: instancePath };
execClaude(claudeCli, remainingArgs, envVars);
```

### 2. Modular Command Handlers (`src/commands/` - Phase 02 New)

**New in Phase 02**: Complete command modularization for enhanced maintainability

**Components**:
- **version-command.ts** (3.0KB): Version display with build information and platform details
- **help-command.ts** (4.9KB): Comprehensive help system with dynamic profile listings
- **install-command.ts** (957B): Installation and uninstallation workflows
- **doctor-command.ts** (415B): System diagnostics and health checks
- **sync-command.ts** (1.0KB): Configuration synchronization and symlink repair
- **shell-completion-command.ts** (2.1KB): Shell completion installation for 4 shells

**Phase 02 Benefits**:
- **Single Responsibility**: Each command has focused, dedicated module
- **Code Navigation**: Developers can quickly locate specific command logic
- **Testing Independence**: Command handlers can be unit tested in isolation
- **Parallel Development**: Multiple developers can work on different commands simultaneously
- **Future Extension**: New commands can be added without modifying main orchestrator

**Command Handler Interface**:
```typescript
interface CommandHandler {
  handle(args: string[]): Promise<void>;
  requiresProfile?: boolean;
  description?: string;
}
```

**New Utility Modules** (`src/utils/` - Phase 02):
- **shell-executor.ts** (1.5KB): Cross-platform shell command execution with process management
- **package-manager-detector.ts** (3.8KB): Package manager detection (npm, yarn, pnpm, bun)

### 3. Delegation System (`src/delegation/` - ~1,200 lines)

**New in v4.0**: Complete delegation subsystem

**Components**:
- **delegation-handler.js** (~300 lines): Routes `-p` commands, validates profiles
- **headless-executor.js** (~400 lines): Executes Claude CLI in headless mode with stream-JSON
- **session-manager.js** (~200 lines): Manages delegation session persistence (continue support)
- **result-formatter.js** (~150 lines): Formats execution results with cost/duration
- **settings-parser.js** (~150 lines): Parses profile settings for validation

**Key Features**:
- **Stream-JSON output**: Real-time tool visibility (`--output-format stream-json --verbose`)
- **Session continuation**: `ccs glm:continue -p "follow-up"` resumes last session
- **Tool tracking**: Shows file paths, commands, patterns as they execute
- **Signal handling**: Ctrl+C kills child processes properly
- **Cost tracking**: USD cost display per delegation
- **13 Claude Code tools** supported: Bash, Read, Write, Edit, Glob, Grep, NotebookEdit, SlashCommand, TodoWrite, etc.

**Delegation Flow**:
```
User: ccs glm -p "add tests"
  ↓
DelegationHandler: Parse args, validate profile
  ↓
HeadlessExecutor: Spawn Claude CLI with --output-format stream-json --verbose
  ↓
Stream parser: Extract [Tool] lines, format in real-time
  ↓
SessionManager: Save session ID for :continue
  ↓
ResultFormatter: Display cost, duration, exit code
```

### 3. Auth System (`bin/auth/` - ~800 lines)

**Role**: Multi-account management (unchanged from v3.0 core)

**Components**:
- **auth-commands.js** (~400 lines): CLI handlers for auth subcommands
- **profile-detector.js** (~150 lines): Profile type routing (settings vs account)
- **profile-registry.js** (~250 lines): Metadata management (profiles.json)

**v4.x Status**: Core logic stable, focus shifted to delegation

**Profile Creation Flow (v3.0+)**:
```bash
# Create profile (prompts login)
ccs auth create work  # Opens Claude, auto-prompts OAuth
# Use directly (credentials in instance)
ccs work "task"
```

### 4. GLMT System (`bin/glmt/` - ~900 lines)

**Role**: GLM with thinking mode via embedded proxy

**Components** (unchanged from v3.x):
- **glmt-proxy.js** (~400 lines): HTTP proxy on localhost:random
- **glmt-transformer.js** (~300 lines): Anthropic ↔ OpenAI format conversion
- **reasoning-enforcer.js** (~100 lines): Inject reasoning prompts
- **locale-enforcer.js** (~50 lines): Force English output
- **delta-accumulator.js** (~200 lines): Streaming state tracking
- **sse-parser.js** (~50 lines): SSE stream parser

**Status**: Stable experimental feature, not actively developed in v4.x

### 5. Management System (`bin/management/` - ~600 lines)

**Role**: Diagnostics, recovery, instance management

**Components**:
- **doctor.js** (~250 lines): Health check diagnostics
- **instance-manager.js** (~220 lines): Instance lifecycle (v3.0 simplified)
- **recovery-manager.js** (~80 lines): Auto-recovery for missing configs
- **shared-manager.js** (~50 lines): Shared data symlinking (v3.1+)

**v4.x Enhancements**:
- **doctor.js**: Now checks delegation commands in `~/.ccs/.claude/commands/ccs/`
- Validates .claude/ symlinks from v4.1

### 6. Utilities (`bin/utils/` - ~1,500 lines)

**New in v4.x**: Expanded utility modules

**Components**:
- **claude-detector.js** (~70 lines): Claude CLI detection
- **claude-dir-installer.js** (~150 lines): Copy .claude/ from package (v4.1.1)
- **claude-symlink-manager.js** (~200 lines): Selective .claude/ symlinking (v4.1)
- **config-manager.js** (~80 lines): Settings config management
- **delegation-validator.js** (~100 lines): Validate delegation eligibility (v4.0)
- **error-codes.js** (~50 lines): Standard error codes
- **error-manager.js** (~200 lines): Error handling utilities
- **helpers.js** (~100 lines): TTY colors, path expansion
- **progress-indicator.js** (~150 lines): Spinner/progress display
- **prompt.js** (~100 lines): User input prompting
- **shell-completion.js** (~250 lines): Shell auto-completion installation (v4.1.4)
- **update-checker.js** (~100 lines): Version update notifications (v4.1)

**Key Utilities**:
- **ClaudeDirInstaller**: Copies `.claude/` from npm package to `~/.ccs/.claude/`
- **ClaudeSymlinkManager**: Creates selective symlinks to `~/.claude/` (Windows fallback to copy)
- **DelegationValidator**: Validates profile readiness (API keys, settings)

### 7. CCS .claude/ Directory (`/.claude/` - packaged with npm)

**New in v4.1**: Selective symlink approach

**Structure**:
```
.claude/
├── commands/ccs/       # Delegation slash commands
│   ├── ccs.md          # /ccs "task" (auto-select profile)
│   └── ccs/continue.md # /ccs:continue "follow-up" (auto-detect profile)
├── skills/ccs-delegation/  # Auto-delegation skill
│   ├── SKILL.md        # Skill definition
│   ├── CLAUDE.md.template  # User CLAUDE.md snippet
│   └── references/troubleshooting.md
└── settings.local.json # Repomix permissions
```

**Symlink Strategy** (v4.1):
- **Source**: `~/.ccs/.claude/` (copied from npm package)
- **Target**: `~/.claude/commands/ccs@`, `~/.claude/skills/ccs-delegation@`
- **Selective**: Only CCS items symlinked, doesn't overwrite user's other commands/skills
- **Windows**: Falls back to copying if Developer Mode not enabled

**Installation Flow** (v4.1.1):
1. `npm install -g @kaitranntt/ccs`
2. Postinstall: ClaudeDirInstaller copies `.claude/` → `~/.ccs/.claude/`
3. Postinstall: ClaudeSymlinkManager creates selective symlinks → `~/.claude/`
4. User can now use `/ccs` (auto-select) and `/ccs:continue` commands

## File Structure (Phase 02 Complete - 2025-11-28)

```
src/                         # TypeScript source files (Phase 02 Modular Architecture)
├── ccs.ts                   # Main entry point (593 lines, 44.6% reduction from 1,071)
├── commands/                # Modular command handlers (Phase 02 NEW)
│   ├── version-command.ts          # 3.0KB - Version display
│   ├── help-command.ts            # 4.9KB - Help system
│   ├── install-command.ts         # 957B - Install/uninstall
│   ├── doctor-command.ts          # 415B - System diagnostics
│   ├── sync-command.ts            # 1.0KB - Configuration sync
│   └── shell-completion-command.ts # 2.1KB - Shell completion
├── auth/               # Multi-account management (v3.0 core)
│   ├── auth-commands.ts       # CLI handlers (~400 lines)
│   ├── profile-detector.ts    # Profile routing (~150 lines)
│   └── profile-registry.ts    # Metadata management (~250 lines)
├── delegation/         # AI delegation system (v4.0+)
│   ├── delegation-handler.ts  # Route -p commands (~300 lines)
│   ├── headless-executor.ts   # Execute with stream-JSON (~400 lines)
│   ├── session-manager.ts     # Session persistence (~200 lines)
│   ├── result-formatter.ts    # Format results (~150 lines)
│   ├── settings-parser.ts     # Parse settings (~150 lines)
│   └── README.md              # Delegation documentation
├── glmt/               # GLM thinking mode (v3.x)
│   ├── glmt-proxy.ts          # Embedded HTTP proxy (~400 lines)
│   ├── glmt-transformer.ts    # Format conversion (~300 lines)
│   ├── reasoning-enforcer.ts  # Reasoning prompts (~100 lines)
│   ├── locale-enforcer.ts     # English enforcement (~50 lines)
│   ├── delta-accumulator.ts   # Stream state (~200 lines)
│   └── sse-parser.ts          # SSE parser (~50 lines)
├── management/         # System management (v3.x+)
│   ├── doctor.ts              # Health diagnostics (~250 lines)
│   ├── instance-manager.ts    # Instance lifecycle (~220 lines)
│   ├── recovery-manager.ts    # Auto-recovery (~80 lines)
│   └── shared-manager.ts      # Shared symlinking (~50 lines)
├── utils/              # Utilities (expanded in v4.x + Phase 02)
│   ├── claude-detector.ts         # CLI detection (~70 lines)
│   ├── claude-dir-installer.ts    # .claude/ installer (v4.1.1, ~150 lines)
│   ├── claude-symlink-manager.ts  # Selective symlinks (v4.1, ~200 lines)
│   ├── config-manager.ts          # Config management (~80 lines)
│   ├── shell-executor.ts          # 1.5KB - Cross-platform execution (Phase 02 NEW)
│   ├── package-manager-detector.ts # 3.8KB - Package manager detection (Phase 02 NEW)
│   ├── delegation-validator.js    # Delegation validation (v4.0, ~100 lines)
│   ├── error-codes.js             # Error codes (~50 lines)
│   ├── error-manager.js           # Error handling (~200 lines)
│   ├── helpers.js                 # Utilities (~100 lines)
│   ├── progress-indicator.js      # Progress display (~150 lines)
│   ├── prompt.js                  # User prompting (~100 lines)
│   ├── shell-completion.ts        # Shell completion (v4.1.4, ~250 lines)
│   └── update-checker.ts          # Update checker (v4.1, ~100 lines)
├── types/                   # TypeScript type definitions
│   ├── cli.ts           # CLI interface definitions
│   ├── config.ts        # Configuration type schemas
│   ├── delegation.ts    # Delegation system types
│   ├── glmt.ts         # GLMT-specific types
│   ├── utils.ts        # Utility function types
│   └── index.ts        # Central type exports
└── scripts/                 # Build and utility scripts

.claude/                # CCS-provided items (v4.1+)
├── commands/ccs/       # Delegation commands
│   ├── glm.md
│   ├── kimi.md
│   ├── glm/continue.md
│   └── kimi/continue.md
├── skills/ccs-delegation/  # Auto-delegation skill
│   ├── SKILL.md
│   ├── CLAUDE.md.template
│   └── references/troubleshooting.md
└── settings.local.json

scripts/
├── postinstall.js      # Auto-config + migration
├── sync-version.js     # Version management
├── check-executables.js # Validation
├── completion/         # Shell completions (v4.1.4)
│   ├── ccs.bash
│   ├── ccs.zsh
│   ├── ccs.fish
│   ├── ccs.ps1
│   └── README.md
└── worker.js           # Cloudflare Worker (ccs.kaitran.ca)

tests/
├── unit/               # Unit tests
│   ├── delegation/     # Delegation tests (v4.0+)
│   └── glmt/           # GLMT tests (v3.x)
├── npm/                # npm package tests
├── integration/        # Integration tests
└── shared/             # Shared test utilities

~/.ccs/                 # User installation
├── .claude/            # CCS items (copied from package)
│   ├── commands/ccs/
│   └── skills/ccs-delegation/
├── shared/             # Shared across profiles (v3.1+)
│   ├── commands@ → ~/.claude/commands/
│   ├── skills@ → ~/.claude/skills/
│   └── agents@ → ~/.claude/agents/
├── instances/          # Isolated Claude instances
│   └── work/
│       ├── commands@ → shared/commands/
│       ├── skills@ → shared/skills/
│       ├── agents@ → shared/agents/
│       ├── settings.json (if any)
│       ├── sessions/
│       └── ...
├── config.json         # Settings-based profiles
├── profiles.json       # Account-based profiles
├── delegation-sessions.json  # Delegation session history (v4.0)
├── glm.settings.json
├── glmt.settings.json
├── kimi.settings.json
└── logs/               # Debug logs

~/.claude/              # User's Claude directory
├── commands/ccs@ → ~/.ccs/.claude/commands/ccs/  # Selective symlink (v4.1)
├── skills/ccs-delegation@ → ~/.ccs/.claude/skills/ccs-delegation/  # Selective symlink
└── (user's other commands/skills remain untouched)
```

## Data Flow (v4.3.2)

### Delegation Execution (v4.0+)
```
User: ccs glm -p "add tests to UserService"
  ↓
ccs.js: Detect -p flag → route to DelegationHandler
  ↓
DelegationHandler: Parse { profile: 'glm', prompt: 'add tests', options: {} }
  ↓
DelegationValidator: Check API key, settings validity
  ↓
HeadlessExecutor: Spawn Claude CLI with:
  - --settings ~/.ccs/glm.settings.json
  - --output-format stream-json
  - --verbose
  - --prompt "add tests to UserService"
  ↓
Stream parser: Extract [Tool] lines in real-time
  - [Tool] Grep: searching for test patterns
  - [Tool] Read: reading UserService.js
  - [Tool] Write: creating UserService.test.js
  ↓
SessionManager: Save { sessionId, profile: 'glm', timestamp }
  ↓
ResultFormatter: Display summary
  - Working Directory: /home/user/project
  - Model: GLM-4.6
  - Duration: 12.3s
  - Cost: $0.0023
  - Session ID: abc123 (use :continue to resume)
  ↓
Exit with Claude CLI exit code
```

### Settings Profile Execution (glm, kimi, glmt)
```
User: ccs glm "command"
  ↓
ccs.js: Parse arguments, detect profile "glm"
  ↓
ProfileDetector: detectProfileType("glm") → {type: 'settings'}
  ↓
ConfigManager: getSettingsPath("glm") → "~/.ccs/glm.settings.json"
  ↓
ccs.js: execClaude(["--settings", path, "command"])
  ↓
Claude CLI: Execute with GLM API
```

### Account Profile Execution (work, personal)
```
User: ccs work "command"
  ↓
ccs.js: Parse arguments, detect profile "work"
  ↓
ProfileDetector: detectProfileType("work") → {type: 'account'}
  ↓
InstanceManager: ensureInstance("work") → "~/.ccs/instances/work/"
  ↓
ProfileRegistry: touchProfile("work") → Update last_used
  ↓
ccs.js: execClaude(["command"], {CLAUDE_CONFIG_DIR: instancePath})
  ↓
Claude CLI: Read credentials from instance, execute
```

## Key Features (v4.5.0 - Phase 02 Complete)

### 1. npm-First Installation (Phase 02 - 2025-11-28)
- **Recommended method**: All users directed to npm installation
- **Native installer deprecation**: curl/irm scripts auto-redirect to npm
- **Cross-platform parity**: Single installation method across macOS/Linux/Windows
- **Easy updates**: `npm install -g @kaitranntt/ccs` (version pinning supported)
- **Bootstrap installers**: Replaced shell scripts with Node.js-based installation

### 2. AI-Powered Delegation (v4.0+)
- **Headless execution**: `ccs glm -p "task"` runs without interactive UI
- **Stream-JSON output**: Real-time tool visibility (`[Tool] Write: file.js`)
- **Session continuation**: `ccs glm:continue -p "follow-up"` resumes last session
- **Cost tracking**: USD cost display per delegation
- **Signal handling**: Proper Ctrl+C cleanup
- **13 tools supported**: Comprehensive Claude Code tool coverage

### 3. Selective .claude/ Symlinking (v4.1)
- **Package-provided**: `.claude/` ships with npm, copied to `~/.ccs/.claude/`
- **Selective symlinks**: Only CCS items linked to `~/.claude/`
- **Non-invasive**: Doesn't overwrite user's commands/skills
- **Windows support**: Falls back to copying if symlinks unavailable
- **Auto-sync**: `ccs sync` re-creates symlinks

### 4. Enhanced Shell Completion (v4.1.4)
- **4 shells**: bash, zsh, fish, PowerShell
- **Color-coded**: Commands vs descriptions
- **Categorized**: Model profiles, account profiles, flags
- **Auto-install**: `ccs --shell-completion` or `ccs -sc`

### 5. Comprehensive Diagnostics (v4.1+)
- **ccs doctor**: Health check for installation, configs, symlinks, delegation
- **ccs sync**: Re-sync delegation commands and skills
- **ccs update**: Check for updates (v4.1+)

### 6. Text-Only Output (Phase 02 - CLAUDE.md Compliance)
- **ASCII indicators only**: [OK], [!], [X], [i] (no emoji)
- **TTY-aware colors**: Respects NO_COLOR environment variable
- **Consistent formatting**: Box borders for errors using ╔═╗║╚╝
- **Cross-platform consistency**: Identical output on all shells

### 7. GLMT Thinking Mode (v3.x, stable experimental)
- **Embedded proxy**: HTTP proxy on localhost:random
- **Format conversion**: Anthropic ↔ OpenAI
- **Reasoning injection**: Force English, thinking prompts
- **Debug logging**: `CCS_DEBUG_LOG=1` writes to `~/.ccs/logs/`

## Breaking Changes

### v3.0 → v4.0
- **No breaking changes**: v4.0 purely additive (delegation features)
- **New dependencies**: None (all Node.js built-ins)
- **Migration**: Automatic via postinstall

### v2.x → v3.0 (Historical)
- Command renamed: `ccs auth save` → `ccs auth create`
- Schema changed: Removed `vault`, `subscription`, `email` fields
- Migration required: Users must recreate profiles

## Performance Characteristics (v4.3.2)

### Delegation Performance
- **Headless spawn**: ~20-30ms overhead
- **Stream parsing**: <5ms per tool call
- **Session save**: ~10ms (JSON write)
- **Total overhead**: ~35-45ms vs direct Claude CLI

### Profile Activation (unchanged from v3.0)
- Instance validation: ~5ms
- `CLAUDE_CONFIG_DIR` env var: ~1ms
- Claude CLI spawn: ~20-30ms
- **Total overhead**: ~26-36ms

### .claude/ Symlinking (v4.1)
- **Symlink creation**: ~5-10ms per link
- **Copy fallback (Windows)**: ~50-100ms total
- **Sync command**: ~100-200ms (full re-sync)

## Security Model (v4.3.2)

### Unchanged from v3.0
- No custom encryption (credentials managed by Claude CLI)
- Spawn with array arguments (no shell injection)
- Atomic file writes (temp + rename)
- Instance directory permissions (0700)

### New in v4.x
- API key validation (checks for placeholder keys)
- Delegation eligibility checks (validates settings before execution)
- Signal handling (proper cleanup of child processes)

## Testing Coverage (v4.3.2)

### Unit Tests
- `tests/unit/delegation/`: Delegation system tests (v4.0+)
- `tests/unit/glmt/`: GLMT transformer tests (v3.x)
- `tests/shared/unit/`: Utility function tests

### Integration Tests
- `tests/npm/`: End-to-end CLI functionality
- `tests/integration/`: Cross-platform behavior, edge cases

### Test Count
- **Total**: ~50 test files
- **Coverage**: >90% for critical paths

## Dependencies (v4.3.2)

### Production
- `cli-table3@^0.6.5`: Table formatting (doctor command)
- `ora@^5.4.1`: Spinner display (progress indicators)

### Development
- `mocha@^11.7.5`: Test runner

**Note**: Minimal dependencies, all critical functionality uses Node.js built-ins

## Future Extensibility

### Extension Points (v4.x)
1. **New delegation profiles**: Easy addition via DelegationValidator
2. **Custom result formatters**: Pluggable ResultFormatter
3. **Session management**: SQLite for better session queries
4. **MCP integration**: Delegation via MCP tools
5. **Cost optimization**: Model selection based on task complexity

## Summary

**CCS Phase 02 Achievements (2025-11-28)**:
- **npm-First Distribution**: Deprecated native shell installers, all users directed to npm
- **Modular Command Architecture**: 6 specialized command handlers with single responsibility principle
- **44.6% Main File Reduction**: src/ccs.ts reduced from 1,071 to 593 lines
- **Text-Only Output**: All emoji removed ([!] replaces ⚠️), CLAUDE.md compliance
- **Enhanced Maintainability**: Focused modules for version, help, install, doctor, sync, shell-completion
- **New Utility Modules**: Cross-platform shell execution and package manager detection
- **TypeScript Excellence**: 100% type coverage across all new modules
- **Installation Flow**: Auto-redirection from deprecated shell scripts to npm

**CCS v4.5.0 Overall Achievements**:
- **Delegation system**: Complete AI-powered task routing with stream-JSON
- **Selective symlinking**: Non-invasive .claude/ directory sharing
- **Shell completion**: Enhanced UX with color-coded completions
- **Diagnostics**: Comprehensive health checking and auto-recovery
- **npm Package**: Bootstrap-based installation, quality gates (typecheck, lint, format, test)
- **Modular architecture**: Clear separation of concerns (auth/, delegation/, glmt/, management/, utils/, commands/, types/)

**Design Principles (STRICT ENFORCEMENT)**:
- **YAGNI**: Only essential features implemented
- **KISS**: Simple, readable code without over-engineering
- **DRY**: Single source of truth for each concern
- **CLI-First**: All features must have CLI interface
- **No Emojis**: ASCII indicators only per CLAUDE.md

**Code Quality**:
- **Total LOC**: ~8,477 lines (src/ TypeScript)
- **Main File**: 593 lines (44.6% reduction from 1,071 lines)
- **Test Coverage**: >90% for critical paths
- **Modularity**: 9 subsystems (main, auth, delegation, glmt, management, utils, commands, types, .claude/)
- **Documentation**: Comprehensive inline comments, README.md, 8+ doc files
- **Output Format**: ASCII-only text, TTY-aware colors, NO_COLOR compliant

Phase 02 (2025-11-28) completes npm-first transition with native installer deprecation and text-only output compliance. v4.5.0 demonstrates successful feature expansion (delegation, symlinking, diagnostics, modular CLI) while maintaining core simplicity and zero breaking changes from v3.0. Bootstrap-based installers eliminate shell script complexity and provide consistent cross-platform behavior.
