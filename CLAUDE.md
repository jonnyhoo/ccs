# CLAUDE.md

AI-facing guidance for Claude Code when working with this repository.

## Core Function

CLI wrapper for instant switching between multiple Claude accounts and alternative models (GLM, GLMT, Kimi). See README.md for user documentation.

## Design Principles (ENFORCE STRICTLY)

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash/PowerShell/Node.js only
- **DRY**: One source of truth (config.json)
- **CLI-First**: All features must have CLI interface

## TypeScript Quality Gates (CORE PURPOSE)

**The npm package is 100% TypeScript. Quality gates MUST pass before publish.**

**Package Manager: bun (preferred)** - 10-25x faster than npm
```bash
bun install          # Install dependencies (creates bun.lockb)
bun run build        # Compile src/ → dist/
bun run validate     # Full validation: typecheck + lint + format + test
```

**Quality gate scripts:**
```bash
bun run typecheck    # Type-check without emit (tsc --noEmit)
bun run lint         # ESLint TypeScript rules
bun run lint:fix     # Auto-fix lint issues
bun run format       # Prettier formatting (write)
bun run format:check # Prettier check (CI)
bun run test         # Build + run all tests
```

**Automatic enforcement:**
- `prepublishOnly` runs `validate` before `npm publish`
- `prepack` runs `validate` before `npm pack`
- CI/CD should run `bun run validate` on every PR

**File structure:**
- `src/` - TypeScript source (development)
- `dist/` - Compiled JavaScript (production, npm package)
- `lib/` - Native shell scripts (bash, PowerShell)

**Linting rules (eslint.config.mjs):**
- `no-unused-vars` - warn (upgrade to error incrementally)
- `no-explicit-any` - warn (upgrade to error incrementally)
- `no-non-null-assertion` - warn
- `prefer-const`, `no-var`, `eqeqeq` - error

**Type safety rules:**
- Avoid `any` types - use proper typing or `unknown`
- Avoid `@ts-ignore` - fix the type error properly
- Strict mode enabled in tsconfig.json

## Critical Constraints (NEVER VIOLATE)

1. **NO EMOJIS** - ASCII only: [OK], [!], [X], [i]
2. **TTY-aware colors** - Respect NO_COLOR env var
3. **Non-invasive** - NEVER modify `~/.claude/settings.json`
4. **Cross-platform parity** - bash/PowerShell/Node.js must behave identically
5. **CLI documentation** - ALL changes MUST update `--help` in src/ccs.ts, lib/ccs, lib/ccs.ps1
6. **Idempotent** - All install operations safe to run multiple times

## Key Technical Details

### Profile Mechanisms

**Settings-based**: `--settings` flag → GLM, GLMT, Kimi, default
**Account-based**: `CLAUDE_CONFIG_DIR` → isolated Claude Sub instances

### Shared Data Architecture

Symlinked from `~/.ccs/shared/`: commands/, skills/, agents/
Profile-specific: settings.json, sessions/, todolists/, logs/
Windows fallback: Copies if symlinks unavailable

## Code Standards (REQUIRED)

### Bash (lib/ccs)
- bash 3.2+, `set -euo pipefail`, quote all vars `"$VAR"`, `[[ ]]` tests only
- `jq` only external dependency

### PowerShell (lib/ccs.ps1)
- PowerShell 5.1+, `$ErrorActionPreference = "Stop"`
- Native JSON only, no external dependencies

### TypeScript/Node.js (src/*.ts → dist/*.js)
- Node.js 14+, Bun 1.0+, TypeScript 5.3, strict mode
- `child_process.spawn`, handle SIGINT/SIGTERM
- Run `bun run lint && bun run typecheck` before committing
- Format with `bun run format` if needed

### Terminal Output (ENFORCE)
- ASCII only: [OK], [!], [X], [i] (NO emojis)
- TTY detect before colors, respect NO_COLOR
- Box borders for errors: ╔═╗║╚╝

## Development Workflows

### Version Management
```bash
./scripts/bump-version.sh [major|minor|patch]  # Updates VERSION, install scripts
```

### Testing (REQUIRED before PR)
```bash
./tests/edge-cases.sh      # Unix
./tests/edge-cases.ps1     # Windows
```

### Local Development
```bash
./installers/install.sh && ./ccs --version     # Test install
rm -rf ~/.ccs                                  # Clean environment
```

## Development Tasks (FOLLOW STRICTLY)

### New Feature Checklist
1. Verify YAGNI/KISS/DRY alignment - reject if doesn't align
2. Implement in bash + PowerShell + Node.js (all three)
3. **REQUIRED**: Update `--help` in src/ccs.ts, lib/ccs, lib/ccs.ps1
4. Test on macOS/Linux/Windows
5. Add test cases to tests/edge-cases.*
6. Update README.md if user-facing

### Bug Fix Checklist
1. Add regression test first
2. Fix in bash + PowerShell + Node.js (all three)
3. Verify no regressions
4. Test all platforms

## Pre-PR Checklist (MANDATORY)

Platform testing:
- [ ] macOS (bash), Linux (bash), Windows (PowerShell + Git Bash)
- [ ] Edge cases pass (./tests/edge-cases.*)

Code standards:
- [ ] ASCII only (NO emojis)
- [ ] TTY colors disabled when piped
- [ ] NO_COLOR respected
- [ ] `--help` updated in src/ccs.ts, lib/ccs, lib/ccs.ps1
- [ ] `--help` consistent across all three
- [ ] `bun run validate` passes (typecheck + lint + format + tests)

Install/behavior:
- [ ] Idempotent install
- [ ] Concurrent sessions work
- [ ] Instance isolation maintained

## Implementation Details

### Profile Resolution Logic
1. Check `profiles.json` (account-based) → `CLAUDE_CONFIG_DIR`
2. Check `config.json` (settings-based) → `--settings`
3. Not found → error + list available profiles

### Settings Format (CRITICAL)
All env values MUST be strings (not booleans/objects) to prevent PowerShell crashes.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "key",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

## Error Handling Principles

- Validate early, fail fast with clear messages
- Show available options on mistakes
- Never leave broken state
