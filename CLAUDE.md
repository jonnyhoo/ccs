# CLAUDE.md

AI-facing guidance for Claude Code when working with this repository.

## Core Function

CLI wrapper for instant switching between multiple Claude accounts and alternative models (GLM, GLMT, Kimi). See README.md for user documentation.

## Design Principles (ENFORCE STRICTLY)

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash/PowerShell/Node.js only
- **DRY**: One source of truth (config.json)
- **CLI-First**: All features must have CLI interface

## TypeScript Quality Gates

**The npm package is 100% TypeScript. Quality gates MUST pass before publish.**

**Package Manager: bun** - 10-25x faster than npm
```bash
bun install          # Install dependencies (creates bun.lockb)
bun run build        # Compile src/ → dist/
bun run validate     # Full validation: typecheck + lint:fix + format:check + test
```

**Fix issues before committing:**
```bash
bun run lint:fix     # Auto-fix lint issues
bun run format       # Auto-fix formatting
```

**Automatic enforcement:**
- `prepublishOnly` / `prepack` runs `validate` + `sync-version.js`
- CI/CD runs `bun run validate` on every PR

**File structure:**
- `src/` - TypeScript source (55 modules)
- `dist/` - Compiled JavaScript (npm package)
- `lib/` - Native shell scripts (bash, PowerShell)
- `ui/` - React dashboard (Vite + React 19 + shadcn/ui)

## UI Quality Gates (React Dashboard)

**The ui/ directory has IDENTICAL quality gates to the main project.**

**Package Manager: bun** (same as root)
```bash
cd ui
bun install          # Install dependencies
bun run build        # TypeScript + Vite build
bun run validate     # Full validation: typecheck + lint:fix + format:check
```

**Fix issues before committing:**
```bash
cd ui
bun run typecheck    # Type check only
bun run lint:fix     # Auto-fix lint issues
bun run format       # Auto-fix formatting
bun run format:check # Verify formatting (no changes)
```

**Linting rules (ui/eslint.config.js) - ALL errors:**
- `@typescript-eslint/no-unused-vars` - error (ignore `_` prefix)
- `@typescript-eslint/no-explicit-any` - error
- `@typescript-eslint/no-non-null-assertion` - error
- `prefer-const`, `no-var`, `eqeqeq` - error
- `react-hooks/exhaustive-deps` - warning
- `react-refresh/only-export-components` - error

**Type safety (ui/tsconfig.app.json):**
- `strict: true` with `verbatimModuleSyntax` enabled
- `noUnusedLocals`, `noUnusedParameters` - enabled
- Type-only imports required: `import type { X }` for types

**UI file structure:**
- `ui/src/` - React components, hooks, pages
- `ui/src/components/ui/` - shadcn/ui components
- `ui/src/hooks/` - Custom React hooks
- `ui/src/pages/` - Route pages
- `ui/src/providers/` - Context providers
- `dist/ui/` - Built bundle (served by Express)

**Linting rules (eslint.config.mjs) - ALL errors:**
- `@typescript-eslint/no-unused-vars` - error (ignore `_` prefix)
- `@typescript-eslint/no-explicit-any` - error
- `@typescript-eslint/no-non-null-assertion` - error
- `prefer-const`, `no-var`, `eqeqeq` - error

**Type safety (tsconfig.json):**
- `strict: true` with all strict flags enabled
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` - enabled
- Avoid `any` types - use proper typing or `unknown`
- Avoid `@ts-ignore` - fix the type error properly

## Critical Constraints (NEVER VIOLATE)

1. **NO EMOJIS** - ASCII only: [OK], [!], [X], [i]
2. **TTY-aware colors** - Respect NO_COLOR env var
3. **Non-invasive** - NEVER modify `~/.claude/settings.json`
4. **Cross-platform parity** - bash/PowerShell/Node.js must behave identically
5. **CLI documentation** - ALL changes MUST update `--help` in src/ccs.ts, lib/ccs, lib/ccs.ps1
6. **Idempotent** - All install operations safe to run multiple times

## Key Technical Details

### Profile Mechanisms (Priority Order)

1. **CLIProxy hardcoded**: gemini, codex, agy → OAuth-based, zero config
2. **CLIProxy variants**: `config.cliproxy` section → user-defined providers
3. **Settings-based**: `config.profiles` section → GLM, GLMT, Kimi
4. **Account-based**: `profiles.json` → isolated instances via `CLAUDE_CONFIG_DIR`

### Settings Format (CRITICAL)

All env values MUST be strings (not booleans/objects) to prevent PowerShell crashes.

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.example.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_MODEL": "model-name"
  }
}
```

### Shared Data Architecture

Symlinked from `~/.ccs/shared/`: commands/, skills/, agents/
Profile-specific: settings.json, sessions/, todolists/, logs/
Windows fallback: Copies if symlinks unavailable

## Code Standards (REQUIRED)

### Architecture
- `lib/ccs`, `lib/ccs.ps1` - Bootstrap scripts (delegate to Node.js via npx)
- `src/*.ts` → `dist/*.js` - Main implementation (TypeScript)

### Bash (lib/*.sh)
- bash 3.2+, `set -euo pipefail`, quote all vars `"$VAR"`, `[[ ]]` tests
- NO external dependencies

### PowerShell (lib/*.ps1)
- PowerShell 5.1+, `$ErrorActionPreference = "Stop"`
- Native JSON only, no external dependencies

### TypeScript (src/*.ts)
- Node.js 14+, Bun 1.0+, TypeScript 5.3, strict mode
- `child_process.spawn`, handle SIGINT/SIGTERM
- Run `bun run validate` before committing

### Terminal Output (ENFORCE)
- ASCII only: [OK], [!], [X], [i] (NO emojis)
- TTY detect before colors, respect NO_COLOR
- Box borders for errors: ╔═╗║╚╝

## Conventional Commits (MANDATORY)

**ALL commits MUST follow conventional commit format. Non-compliant commits are rejected by husky.**

### Commit Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Commit Types (determines version bump)
| Type | Version Bump | Use For |
|------|--------------|---------|
| `feat:` | MINOR | New features |
| `fix:` | PATCH | Bug fixes |
| `perf:` | PATCH | Performance improvements |
| `feat!:` | MAJOR | Breaking changes |
| `docs:` | None | Documentation only |
| `style:` | None | Formatting, no code change |
| `refactor:` | None | Code restructure |
| `test:` | None | Adding tests |
| `chore:` | None | Maintenance |
| `ci:` | None | CI/CD changes |
| `build:` | None | Build system |

### Examples
```bash
# Good - will be accepted
git commit -m "feat(cliproxy): add OAuth token refresh"
git commit -m "fix(doctor): handle missing config gracefully"
git commit -m "feat!: remove deprecated GLMT proxy"  # BREAKING CHANGE

# Bad - will be REJECTED
git commit -m "added new feature"
git commit -m "Fixed bug"
git commit -m "WIP"
```

## Branching Strategy (FOLLOW STRICTLY)

### Branch Hierarchy

```
main (production) ← dev (integration) ← feat/* | fix/* | docs/*
     ↑                   ↑
     │                   └── All development merges here FIRST
     │
     └── Only receives: (1) Tested code from dev, (2) Hotfixes
```

### Branch Types

| Branch | Purpose | Merges From | Releases To |
|--------|---------|-------------|-------------|
| `main` | Production-ready | `dev`, `hotfix/*` | npm `@latest` |
| `dev` | Integration/staging | `feat/*`, `fix/*`, `docs/*` | npm `@dev` |
| `feat/*` | New features | - | → `dev` |
| `fix/*` | Bug fixes | - | → `dev` |
| `docs/*` | Documentation | - | → `dev` |
| `hotfix/*` | Critical production fixes | - | → `main` directly |

### Branch Naming Convention

```
<type>/<short-description>

# Examples:
feat/oauth-token-refresh
fix/doctor-missing-config
docs/update-installation-guide
hotfix/critical-auth-bug
```

### Standard Development Workflow (Features/Fixes → Dev → Main)

```bash
# 1. ALWAYS start from dev (integration branch)
git checkout dev
git pull origin dev

# 2. Create feature branch FROM DEV
git checkout -b feat/my-feature

# 3. Make changes with conventional commits
git commit -m "feat(scope): add new feature"
git commit -m "test(scope): add unit tests"

# 4. Push and create PR to DEV (not main!)
git push -u origin feat/my-feature
gh pr create --base dev --title "feat(scope): add new feature"
# → Merge triggers npm @dev release for testing

# 5. After testing in dev, promote to main (MUST use feat: or fix: prefix!)
git checkout dev
gh pr create --base main --title "feat(release): promote dev to main"
# → Merge triggers npm @latest release
# WARNING: Using "chore:" will NOT trigger a release!

# 6. Clean up
git checkout dev
git pull origin dev
git branch -d feat/my-feature
```

### Hotfix Workflow (Critical Production Fixes Only)

```bash
# 1. Start from main (production)
git checkout main
git pull origin main

# 2. Create hotfix branch
git checkout -b hotfix/critical-bug

# 3. Fix and commit
git commit -m "fix: critical authentication bypass"

# 4. PR directly to main (skip dev)
gh pr create --base main --title "fix: critical authentication bypass"
# → Merge triggers immediate npm @latest release

# 5. Sync hotfix back to dev
git checkout dev
git pull origin dev
git merge main
git push origin dev

# 6. Clean up
git branch -d hotfix/critical-bug
```

### Keeping Dev in Sync with Main

```bash
# After any main release, sync to dev
git checkout dev
git pull origin dev
git merge main
git push origin dev
```

### Rules

1. **NEVER commit directly to `main` or `dev`** - always use PRs
2. **ALWAYS create feature branches from `dev`** (not main)
3. **Only `hotfix/*` branches go directly to `main`**
4. **`dev` must always be up-to-date with `main`**
5. **Delete feature branches after merge**
6. **Test in `@dev` before promoting to `@latest`**
7. **dev→main PRs MUST use `feat:` or `fix:` prefix** - `chore:` won't trigger npm release

## Automated Releases (DO NOT MANUALLY TAG)

**Releases are FULLY AUTOMATED via semantic-release. NEVER manually bump versions or create tags.**

### Release Channels
| Branch | npm Tag | When |
|--------|---------|------|
| `main` | `@latest` | Merge PR to main |
| `dev` | `@dev` | Push to dev branch |

### What CI Does Automatically
1. Analyzes commits since last release
2. Determines version bump from commit types
3. Updates `CHANGELOG.md`, `VERSION`, `package.json`, installers
4. Creates git tag
5. Publishes to npm
6. Creates GitHub release

**NEVER DO:**
- `./scripts/bump-version.sh` (deprecated, emergency only)
- `git tag vX.Y.Z` (tags are auto-created)
- Manual `npm publish` (CI handles it)
- Commit directly to `main`

## Development Workflows

### Testing (REQUIRED before PR)
```bash
bun run test              # All tests
bun run test:npm          # npm package tests
bun run test:native       # Native install tests
bun run test:unit         # Unit tests
```

### Local Development
```bash
./scripts/dev-install.sh       # Build, pack, install globally
rm -rf ~/.ccs                  # Clean environment
```

## Development Tasks (FOLLOW STRICTLY)

### New Feature Checklist
1. Verify YAGNI/KISS/DRY alignment - reject if doesn't align
2. Implement in TypeScript (`src/*.ts`)
3. **REQUIRED**: Update `--help` in src/ccs.ts, lib/ccs, lib/ccs.ps1
4. Add unit tests (`tests/unit/**/*.test.js`)
5. Run `bun run validate`
6. Update README.md if user-facing
7. **Commit with**: `git commit -m "feat(scope): description"`

### Bug Fix Checklist
1. Add regression test first
2. Fix in TypeScript (or native scripts if bootstrap-related)
3. Run `bun run validate`
4. **Commit with**: `git commit -m "fix(scope): description"`

## Pre-PR Checklist (MANDATORY)

- [ ] `bun run validate` passes (typecheck + lint:fix + format:check + tests)
- [ ] All commits follow conventional format (`feat:`, `fix:`, etc.)
- [ ] `--help` updated and consistent across src/ccs.ts, lib/ccs, lib/ccs.ps1
- [ ] ASCII only (NO emojis), NO_COLOR respected
- [ ] Idempotent install, concurrent sessions work, instance isolation maintained
- [ ] **DO NOT** manually bump version or create tags

## Error Handling Principles

- Validate early, fail fast with clear messages
- Show available options on mistakes
- Never leave broken state
