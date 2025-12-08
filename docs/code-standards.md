# CCS Code Standards

## Overview

This document defines the coding standards and principles for the CCS (Claude Code Switch) project. The project uses TypeScript throughout, React 19 for the UI dashboard, Vite for fast builds, and Bun as the primary package manager. Following these standards ensures consistency, maintainability, and quality across the entire codebase.

## Core Principles

### Design Philosophy

**YAGNI** (You Aren't Gonna Need It)
- Only implement features that are immediately needed
- Avoid code "just in case" scenarios
- Keep the codebase minimal and focused

**KISS** (Keep It Simple, Stupid)
- Prefer simple solutions over complex ones
- Avoid unnecessary abstractions
- Use straightforward, readable code

**DRY** (Don't Repeat Yourself)
- Eliminate duplicate code through consolidation
- Create reusable functions for common operations
- Maintain single sources of truth

### Simplification Standards

The recent codebase simplification (35% reduction from 1,315 to 855 lines) established these standards:

1. **Consolidate duplicate logic**: Unified spawn logic in `execClaude()` function
2. **Remove security theater**: Eliminate unnecessary validation functions
3. **Simplify error handling**: Direct console.error instead of complex formatting
4. **Deduplicate platform checks**: Centralize platform-specific logic

## TypeScript Standards

### Code Style

#### File Structure
```typescript
// Dependencies
import { spawn } from 'child_process';
import path from 'path';
import { error } from './helpers';

// Constants
const CCS_VERSION = require('../package.json').version;

// Functions (grouped by responsibility)
function mainFunction(): void {
  // Implementation
}

// Main execution
function main(): void {
  // Implementation
}

// Run main
main();
```

#### Function Declarations
- Use `function` declarations for named functions
- Use arrow functions only for anonymous functions or callbacks
- Group related functions together
- Place main execution logic at the bottom

```javascript
// Good
function handleVersionCommand() {
  console.log(`CCS version ${CCS_VERSION}`);
  process.exit(0);
}

// Acceptable for callbacks
fs.readFile(file, (err, data) => {
  if (err) return error(err.message);
  // Process data
});
```

#### Variable Declarations
- Use `const` for variables that won't be reassigned
- Use `let` only when reassignment is necessary
- Declare variables as close to usage as possible
- Avoid `var` entirely

```javascript
// Good
const configPath = getConfigPath();
const claudeCli = detectClaudeCli();

// Avoid
let configPath;
configPath = getConfigPath();
```

### Error Handling Standards

#### Simple Error Reporting
```javascript
// Preferred - Simple and direct
function error(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

// Usage
if (!fs.existsSync(configPath)) {
  error(`Config file not found: ${configPath}`);
}
```

#### Avoid Complex Error Formatting
```javascript
// Avoid - Complex box-drawing formatting
function showErrorBox(message) {
  console.log('╔══════════════════════════════════════╗');
  console.log('║ ERROR                              ║');
  console.log(`║ ${message.padEnd(34)} ║`);
  console.log('╚══════════════════════════════════════╝');
}
```

#### Early Validation Pattern
```javascript
function getSettingsPath(profile) {
  // Validate early and exit fast
  const config = readConfig();
  const settingsPath = config.profiles[profile];

  if (!settingsPath) {
    error(`Profile '${profile}' not found. Available: ${Object.keys(config.profiles).join(', ')}`);
  }

  return settingsPath;
}
```

### Process Management Standards

#### Unified Spawn Logic
```javascript
// Consolidated spawn function - single source of truth
function execClaude(claudeCli, args) {
  const child = spawn(claudeCli, args, {
    stdio: 'inherit',
    windowsHide: true
  });

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code || 0);
  });

  child.on('error', () => {
    showClaudeNotFoundError();
    process.exit(1);
  });
}
```

#### Security Best Practices
- Always use arrays with `spawn()` to prevent shell injection
- Never construct shell command strings with user input
- Validate inputs before using them in file operations

```javascript
// Good - Safe with array arguments
spawn(claudeCli, ['--settings', settingsPath, ...args]);

// Avoid - Unsafe string concatenation
spawn('sh', ['-c', `claude --settings ${settingsPath} ${args.join(' ')}`]);
```

### Module Organization Standards (Phase 02 Complete - 2025-11-27)

#### Subsystem Directory Structure
```
src/
├── ccs.ts                   # Main entry point (593 lines, 44.6% reduction)
├── commands/                # Modular command handlers (Phase 02 NEW)
│   ├── version-command.ts          # Version display functionality
│   ├── help-command.ts            # Help system
│   ├── install-command.ts         # Installation workflows
│   ├── doctor-command.ts          # System diagnostics
│   ├── sync-command.ts            # Configuration synchronization
│   └── shell-completion-command.ts # Shell completion management
├── auth/                    # Auth system modules
├── delegation/              # Delegation system modules
├── glmt/                    # GLMT system modules
├── management/              # Management system modules
├── utils/                   # Utility modules (expanded in Phase 02)
│   ├── shell-executor.ts            # Cross-platform execution (NEW)
│   └── package-manager-detector.ts # Package manager detection (NEW)
└── types/                   # TypeScript type definitions
```

#### Module Dependencies
```javascript
// Group imports by type
// Node.js built-ins
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Local modules (relative paths from current subsystem)
const { error } = require('../utils/helpers');
const { detectClaudeCli } = require('../utils/claude-detector');

// Subsystem-specific modules
const DelegationHandler = require('./delegation-handler');
const SessionManager = require('./session-manager');
```

#### Exports Pattern
```javascript
// Clear, named exports
module.exports = {
  getConfigPath,
  readConfig,
  getSettingsPath
};

// Class exports (delegation, management modules)
class DelegationHandler {
  constructor() {
    // Implementation
  }
}
module.exports = DelegationHandler;

// Avoid exports with mixed responsibilities
module.exports = {
  getConfigPath,
  someUtilityFunction,
  anotherUnrelatedFunction
};
```

#### Subsystem Naming Conventions (v4.x)
- **handler**: Routing and orchestration (e.g., `delegation-handler.js`)
- **executor**: Execution logic (e.g., `headless-executor.js`)
- **manager**: State management (e.g., `session-manager.js`, `instance-manager.js`)
- **validator**: Validation logic (e.g., `delegation-validator.js`)
- **formatter**: Output formatting (e.g., `result-formatter.js`)
- **parser**: Parsing logic (e.g., `settings-parser.js`, `sse-parser.js`)

## Modular Command Architecture Standards (Phase 02, 2025-11-27)

### Overview

Phase 02 introduced modular command architecture that separates command handling logic from the main orchestrator. This enhances maintainability, testability, and development workflow efficiency.

### Command Handler Pattern

**Structure Requirements**:
- Each command must be implemented in its own dedicated file in `src/commands/`
- Commands must follow consistent interface pattern for type safety
- Single responsibility principle - each module handles one command only

**Interface Pattern**:
```typescript
interface CommandHandler {
  handle(args: string[]): Promise<void>;
  requiresProfile?: boolean;
  description?: string;
}

// Example: Update command options interface
interface UpdateOptions {
  force?: boolean;
  beta?: boolean;
}
```

**Implementation Example**:
```typescript
export class VersionCommand implements CommandHandler {
  async handle(args: string[]): Promise<void> {
    // Command implementation
  }

  get description(): string {
    return "Display version information";
  }
}
```

### Command Handler Standards

#### File Organization
- **Location**: `src/commands/<command-name>-command.ts`
- **Naming**: kebab-case with `-command.ts` suffix
- **Export**: Default export of command class

#### Function Size Limits
- **Command handlers**: Maximum 200 lines (enforces focused responsibility)
- **Helper functions**: Maximum 50 lines within command modules
- **Type definitions**: Separate files for complex types (>5 interfaces)

#### Import Patterns
```typescript
// Preferred: Specific imports
import { ConfigManager } from '../utils/config-manager.js';
import { Logger } from '../utils/logger.js';

// Avoid: Wildcard imports
import * as Utils from '../utils/index.js';
```

### Module Dependencies Standards

#### Dependency Direction
```
Main Entry Point (src/ccs.ts)
    ↓
Command Handlers (src/commands/)
    ↓
Utility Modules (src/utils/)
```

**Rules**:
- Command handlers may import from utils, types, and management modules
- Command handlers MUST NOT import from other command handlers
- Utility modules may import from other utilities and types
- No circular dependencies allowed

#### Import Organization
```typescript
// 1. Node.js built-ins
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

// 2. External dependencies
import ora from 'ora';

// 3. Internal modules (sorted alphabetically)
import { ConfigManager } from '../utils/config-manager.js';
import { Logger } from '../utils/logger.js';
import { Types } from '../types/index.js';
```

### Error Handling in Command Modules

#### Standardized Error Pattern
```typescript
export class CommandError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

// Usage
try {
  await this.executeCommand();
} catch (error) {
  if (error instanceof CommandError) {
    console.error(`[X] ${error.message}`);
    process.exit(error.exitCode);
  }
  throw error;
}
```

#### Validation Requirements
- **Input validation**: Must validate arguments before processing
- **State validation**: Check required dependencies exist
- **Permission validation**: Verify file system access where needed

### Testing Standards for Command Modules

#### Unit Test Structure
```typescript
import { assert } from 'chai';
import { VersionCommand } from '../src/commands/version-command.js';

describe('VersionCommand', () => {
  let command: VersionCommand;

  beforeEach(() => {
    command = new VersionCommand();
  });

  describe('handle()', () => {
    it('should display version information', async () => {
      // Test implementation
    });
  });
});
```

#### Mock Requirements
- **File system**: Mock all file operations
- **External processes**: Mock spawn/exec calls
- **Configuration**: Use test fixtures for config data

### New Utility Module Standards

#### Shell Executor (`src/utils/shell-executor.ts`)
- **Cross-platform**: Must work on Windows, macOS, Linux
- **Process management**: Proper cleanup and signal handling
- **Error handling**: Standardized error reporting

#### Package Manager Detector (`src/utils/package-manager-detector.ts`)
- **Detection order**: npm → yarn → pnpm → bun (priority based on availability)
- **Caching**: Cache detection results for performance
- **Fallback**: Graceful degradation when managers unavailable

### Integration with Main Orchestrator

#### Command Registration Pattern
```typescript
// In src/ccs.ts
import { VersionCommand } from './commands/version-command.js';
import { HelpCommand } from './commands/help-command.js';

const commandHandlers = {
  '--version': new VersionCommand(),
  '--help': new HelpCommand(),
  // ... other commands
};
```

#### Routing Logic
```typescript
// Command detection and routing
for (const [flag, handler] of Object.entries(commandHandlers)) {
  if (args.includes(flag)) {
    await handler.handle(args);
    return;
  }
}
```

## React 19 UI Standards

### Component Architecture

#### Functional Components with Hooks
```typescript
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
  className?: string;
}

export function MyComponent({ title, onAction, className }: MyComponentProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Side effects
  }, []);

  return (
    <div className={cn('p-4 rounded-lg', className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <button onClick={onAction}>Action</button>
      )}
    </div>
  );
}
```

### UI Library Standards (shadcn/ui)

#### Component Usage
- Use shadcn/ui components as base building blocks
- Customize with Tailwind CSS classes
- Maintain consistent design tokens
- Support dark mode out of the box

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsPage(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">Save Changes</Button>
      </CardContent>
    </Card>
  );
}
```

### State Management

#### TanStack Query for Server State
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfiles, updateProfile } from '@/lib/api';

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}
```

#### Local State with useState
- Use useState for simple component state
- Use useReducer for complex state logic
- Consider Zustand for global state (if needed)

### Vite Configuration

#### Build Settings (vite.config.ts)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

### Performance Guidelines

#### Code Splitting
- Lazy load routes with React.lazy()
- Dynamic imports for heavy components
- Use Suspense boundaries for loading states

```typescript
import { lazy, Suspense } from 'react';

const SettingsPage = lazy(() => import('@/pages/settings'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsPage />
    </Suspense>
  );
}
```

#### Optimization
- Use React.memo() for expensive components
- Implement virtual scrolling for long lists
- Optimize re-renders with useMemo() and useCallback()

### WebSocket Integration

#### Real-time Updates
```typescript
import { useEffect, useState } from 'react';

export function useWebSocket(url: string) {
  const [data, setData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => setData(JSON.parse(event.data));

    return () => ws.close();
  }, [url]);

  return { data, isConnected };
}
```

### Testing Standards

#### Vitest Configuration
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

#### Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## UI System Patterns (Phase 5, v4.5.0+)

### Central UI Module (src/utils/ui.ts)

#### Initialization Pattern
```typescript
import { ui } from '../utils/ui';

// Initialize UI (call once at startup)
async function main() {
  await ui.init();
  // UI functions now available
}
```

#### Semantic Color Usage
```typescript
// Apply semantic colors
ui.color('Success!', 'success')        // Green bold
ui.color('Error!', 'error')            // Red bold
ui.color('Warning!', 'warning')        // Yellow
ui.color('Info', 'info')               // Cyan
ui.color('Command: ccs', 'command')    // Yellow italic
ui.color('/path/to/file', 'path')      // Cyan underline
```

#### ASCII Status Indicators (NO EMOJIS)
```typescript
// Preferred: ASCII indicators only
ui.ok('Installation complete')         // [OK] Installation complete
ui.fail('Build failed')                // [X] Build failed
ui.warn('Deprecated feature')          // [!] Deprecated feature
ui.info('Checking system')             // [i] Checking system

// NEVER use emoji (violates CLAUDE.md)
// DON'T: console.log('✓ Success') or '❌ Error'
```

#### Box & Table Rendering
```typescript
// Styled boxes
ui.box('Content here', {
  title: 'Header',
  borderColor: '#00ECFA',
  padding: 1
});

ui.errorBox('Error message', 'ERROR');
ui.infoBox('Info content', 'INFO');

// Styled tables
ui.table([
  ['Column 1', 'Column 2'],
  ['Data 1', 'Data 2']
], {
  head: ['Header 1', 'Header 2'],
  style: 'unicode'
});
```

#### Spinner & Progress
```typescript
// Simple spinner (falls back to plain text in non-TTY)
const spin = await ui.spinner('Processing...');
await doWork();
spin.succeed('Done!');

// Spinner with message update
const spin = await ui.spinner('Loading');
spin.update('Still loading...');
spin.succeed('Completed');
```

#### Task Lists (Listr2 Integration - Phase 5)
```typescript
// Create task list with intelligent renderer selection
const ctx = await ui.taskList([
  {
    title: 'Install dependencies',
    task: async () => {
      await installDeps();
    }
  },
  {
    title: 'Build project',
    task: async () => {
      await build();
    },
    skip: () => !needsBuild() ? 'Already built' : undefined
  }
], {
  concurrent: false  // Set true for parallel execution
});

// Renderer selection (automatic):
// - TTY: Default renderer with subtask hierarchy
// - Non-TTY: Simple renderer (plain text)
// - CI environment: Simple renderer
// - Claude Code context: Fallback spinner-based
```

#### Context Detection
```typescript
// Check if running in interactive TTY
if (ui.isInteractive()) {
  // Can use full spinner/box features
}

// Check if running inside Claude Code tool
if (ui.isClaudeCodeContext()) {
  // May need fallback rendering
}
```

### UI Compliance Rules (STRICT)

**Mandatory**:
- ALWAYS call `await ui.init()` before using any UI functions
- ASCII status indicators ONLY: [OK], [X], [!], [i] - NO EMOJIS
- Respect NO_COLOR and FORCE_COLOR environment variables
- Use semantic colors (success, error, warning, info, dim, primary, secondary, command, path)

**Patterns**:
- Status messages: `ui.ok()`, `ui.fail()`, `ui.warn()`, `ui.info()`
- Styled output: `ui.box()`, `ui.table()`, `ui.spinner()`
- Progress: Use `ui.taskList()` for multi-step operations (Phase 5)
- Fallback-first: Always test in non-TTY (pipe) mode

**Testing**:
```bash
# Test in non-TTY (pipes/CI)
ccs doctor | cat        # Forces plain text output
NO_COLOR=1 ccs doctor  # Disables colors
```

## Delegation System Patterns (v4.0+, Phase 5 Enhanced)

### Stream-JSON Parsing

#### Tool Extraction Pattern
```javascript
// Real-time extraction of tool calls from stream-JSON output
function parseToolLine(line) {
  const toolRegex = /\[Tool\]\s+(\w+)\((.*?)\)/;
  const match = line.match(toolRegex);

  if (match) {
    const [_, toolName, params] = match;
    return { toolName, params };
  }

  return null;
}

// Usage in stream parser
childProcess.stdout.on('data', (chunk) => {
  const lines = chunk.toString().split('\n');
  for (const line of lines) {
    const tool = parseToolLine(line);
    if (tool) {
      console.log(`  ${formatToolName(tool.toolName)} ${formatParams(tool.params)}`);
    }
  }
});
```

### Session Management Pattern

#### Session Persistence
```javascript
// Save session for continuation
class SessionManager {
  saveSession(profile, sessionId, prompt) {
    const sessionData = {
      profile,
      sessionId,
      timestamp: new Date().toISOString(),
      prompt
    };

    const sessionPath = path.join(DELEGATION_SESSIONS_DIR, `${profile}-last.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
  }

  loadSession(profile) {
    const sessionPath = path.join(DELEGATION_SESSIONS_DIR, `${profile}-last.json`);

    if (!fs.existsSync(sessionPath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  }
}
```

### Headless Execution Pattern

#### Spawning with Stream-JSON
```javascript
// Execute Claude CLI in headless mode with stream-JSON output
function executeHeadless(claudeCli, profile, prompt, sessionId = null) {
  const args = [
    '--output-format', 'stream-json',
    '--verbose',
    '-p', prompt
  ];

  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  const child = spawn(claudeCli, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    windowsHide: true
  });

  // Parse stdout for tools
  child.stdout.on('data', (chunk) => {
    parseStreamOutput(chunk.toString());
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    child.kill('SIGTERM');
    process.exit(130);
  });

  return child;
}
```

### Result Formatting Pattern (Phase 5 Enhanced - Async)

#### Async Result Formatter with UI Integration
```typescript
// result-formatter.ts - Phase 5 now fully async
import { ui } from '../utils/ui';

class ResultFormatter {
  // Initialize UI and format result
  static async format(result: ExecutionResult): Promise<string> {
    await ui.init();  // Phase 5: Initialize UI layer

    // Build styled output
    let output = '';

    // Header box with status indicator
    const modelName = this.getModelDisplayName(result.profile);
    const headerIcon = result.success ? '[i]' : '[X]';
    output += ui.box(`${headerIcon} Delegated to ${modelName}`, {
      borderStyle: 'round',
      padding: 0,
    });
    output += '\n\n';

    // Info table with styled columns
    output += this.formatInfoTable(result);

    // Error details if needed
    if (result.errors && result.errors.length > 0) {
      output += '\n' + ui.errorBox('Execution Errors', 'ERRORS');
    }

    return output;
  }

  // Phase 5: Table formatting
  private static formatInfoTable(result: ExecutionResult): string {
    const rows = [
      ['Working Directory', result.cwd],
      ['Model', this.getModelDisplayName(result.profile)],
      ['Duration', `${(result.duration / 1000).toFixed(2)}s`],
      ['Exit Code', result.exitCode === 0 ? '[OK]' : '[X]'],
    ];

    if (result.totalCost) {
      rows.push(['Total Cost', `$${result.totalCost.toFixed(4)}`]);
    }

    return ui.table(rows, {
      style: 'unicode',
      wordWrap: true
    });
  }
}

// Usage in delegation-handler.ts
const formatted = await ResultFormatter.format(result);  // Phase 5: Now async!
console.log(formatted);
```

#### Cost and Duration Extraction (Unchanged from v4.0)
```typescript
// Extract cost and duration from stream-JSON output
interface ExecutionStats {
  cost: number | null;
  duration: number | null;
  exitCode: number;
}

function parseExecutionStats(output: string): ExecutionStats {
  const costRegex = /Cost:\s+\$(\d+\.\d+)/;
  const durationRegex = /Duration:\s+(\d+)ms/;

  const costMatch = output.match(costRegex);
  const durationMatch = output.match(durationRegex);

  return {
    cost: costMatch ? parseFloat(costMatch[1]) : null,
    duration: durationMatch ? parseInt(durationMatch[1]) : null,
    exitCode: 0
  };
}
```

## Symlinking Patterns (v4.1+)

### Symlink Creation Pattern

#### Cross-Platform Symlinking
```javascript
// Create symlink with Windows fallback
async function createSymlink(source, target) {
  try {
    // Try symlink first
    await fs.promises.symlink(source, target, 'dir');
    return 'symlink';
  } catch (error) {
    if (error.code === 'EPERM' && process.platform === 'win32') {
      // Windows fallback: copy directory
      await fs.promises.cp(source, target, { recursive: true });
      return 'copy';
    }
    throw error;
  }
}
```

### Symlink Validation Pattern

#### Integrity Checking
```javascript
// Validate symlink integrity
function validateSymlink(linkPath, expectedTarget) {
  try {
    const stats = fs.lstatSync(linkPath);

    if (!stats.isSymbolicLink()) {
      return { valid: false, reason: 'not_a_symlink' };
    }

    const actualTarget = fs.readlinkSync(linkPath);
    const resolvedActual = path.resolve(path.dirname(linkPath), actualTarget);
    const resolvedExpected = path.resolve(expectedTarget);

    if (resolvedActual !== resolvedExpected) {
      return { valid: false, reason: 'wrong_target', actualTarget, expectedTarget };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'missing', error: error.message };
  }
}
```

### Sync Command Pattern

#### Repairing Broken Symlinks
```javascript
// Repair broken symlinks
function repairSymlinks(instancePath, sharedPath) {
  const symlinkDirs = ['commands', 'skills', 'agents'];
  const repaired = [];

  for (const dir of symlinkDirs) {
    const linkPath = path.join(instancePath, '.claude', dir);
    const targetPath = path.join(sharedPath, dir);

    const validation = validateSymlink(linkPath, targetPath);

    if (!validation.valid) {
      // Remove broken symlink/directory
      if (fs.existsSync(linkPath)) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }

      // Recreate symlink
      fs.symlinkSync(targetPath, linkPath, 'dir');
      repaired.push(dir);
    }
  }

  return repaired;
}
```

## Platform Compatibility Standards

### Cross-Platform Development

#### Path Handling
```javascript
// Use path module for cross-platform compatibility
const configPath = path.join(os.homedir(), '.ccs', 'config.json');

// Avoid hardcoded separators
const configPath = os.homedir() + '/.ccs/config.json'; // Unix only
```

#### Platform Detection
```javascript
// Centralized platform detection
const isWindows = process.platform === 'win32';

if (isWindows) {
  // Windows-specific logic
} else {
  // Unix/macOS logic
}
```

#### Environment Variables
```javascript
// Support both Windows and Unix environment variable formats
function expandPath(pathStr) {
  // Unix style: $HOME or ${HOME}
  pathStr = pathStr.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '');

  // Windows style: %USERPROFILE%
  if (process.platform === 'win32') {
    pathStr = pathStr.replace(/%([^%]+)%/g, (_, name) => process.env[name] || '');
  }

  return path.normalize(pathStr);
}
```

## Configuration Standards

### JSON Configuration Format

#### Configuration Schema
```json
{
  "profiles": {
    "default": "~/.claude/settings.json",
    "glm": "~/.ccs/glm.settings.json"
  }
}
```

#### Settings File Format
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your_api_key",
    "ANTHROPIC_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6"
  }
}
```

### Configuration Handling Patterns

#### Safe JSON Parsing
```javascript
function readConfig() {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (e) {
    error(`Invalid JSON in ${configPath}: ${e.message}`);
  }
}
```

#### Validation Patterns
```javascript
function validateConfig(config) {
  if (!config.profiles || typeof config.profiles !== 'object') {
    error(`Config must have 'profiles' object`);
  }

  // Essential validation only - avoid excessive checks
  return true;
}
```

## Testing Standards

### Test Organization

#### Unit Test Structure
```javascript
const assert = require('assert');
const { getSettingsPath } = require('../../../bin/config-manager');

describe('config-manager', () => {
  describe('getSettingsPath', () => {
    it('should return settings path for valid profile', () => {
      const result = getSettingsPath('glm');
      assert(result.includes('glm.settings.json'));
    });

    it('should throw error for invalid profile', () => {
      assert.throws(() => {
        getSettingsPath('invalid');
      }, /Profile 'invalid' not found/);
    });
  });
});
```

#### Test Data Management
```javascript
// Use fixtures for test data
const testConfig = {
  profiles: {
    glm: '~/.ccs/glm.settings.json',
    default: '~/.claude/settings.json'
  }
};

// Clean up after tests
afterEach(() => {
  // Clean up test files
});
```

### Test Coverage Requirements

Before any PR, ensure:
- [ ] All new functions have unit tests
- [ ] Error conditions are tested
- [ ] Cross-platform behavior is verified
- [ ] Edge cases are covered
- [ ] Integration tests validate end-to-end workflows

## Documentation Standards

### Code Documentation

#### Function Documentation
```javascript
/**
 * Execute Claude CLI with unified spawn logic
 * @param {string} claudeCli - Path to Claude CLI executable
 * @param {string[]} args - Arguments to pass to Claude CLI
 */
function execClaude(claudeCli, args) {
  // Implementation
}
```

#### Inline Comments
```javascript
// Special case: version command (check BEFORE profile detection)
if (firstArg === '--version') {
  handleVersionCommand();
}

// Validate settings file exists before using it
if (!fs.existsSync(expandedPath)) {
  error(`Settings file not found: ${expandedPath}`);
}
```

### README Standards

#### Installation Instructions
- Provide multiple installation methods
- Include prerequisites clearly
- Show first usage examples
- Include troubleshooting links

#### Usage Examples
```bash
# Basic usage
ccs                    # Use default profile
ccs glm                # Switch to GLM profile
ccs glm "your prompt"  # One-time command with GLM

# Special commands
ccs --version          # Show version
ccs --help             # Show help
ccs --install          # Install Claude Code integration
```

## Version Management Standards

### Version Synchronization
When updating version, maintain consistency across:
1. `package.json` version field
2. `VERSION` file
3. Installer scripts (if applicable)

### Semantic Versioning
- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

## Security Standards

### Input Validation
- Validate configuration file existence and format
- Check executable permissions before use
- Sanitize user inputs appropriately

### Safe Process Execution
```javascript
// Good: Using arrays prevents shell injection
spawn(claudeCli, ['--settings', settingsPath, ...userArgs]);

// Avoid: String concatenation can lead to injection
spawn('sh', ['-c', `claude --settings ${settingsPath} ${command}`]);
```

### File System Access
- Only access known configuration directories
- Use path normalization to prevent traversal
- Validate file permissions before reading

## Performance Standards

### Optimization Principles
- Minimize function call overhead
- Reduce I/O operations through caching
- Use efficient data structures
- Avoid unnecessary computations

### Memory Management
- Use streams for large file operations
- Clean up resources properly
- Avoid memory leaks in long-running processes

## Quality Assurance Standards

### ESLint Quality Gates (Phase 01 Enhanced + Phase 02 Modular)

**Strict TypeScript Rules** (enforced as errors):
- ✅ `@typescript-eslint/no-unused-vars`: Zero unused variables, imports, or parameters
- ✅ `@typescript-eslint/no-explicit-any`: No explicit `any` types allowed (use `unknown` or proper types)
- ✅ `@typescript-eslint/no-non-null-assertion`: No non-null assertions (`value!`) - use explicit checks

**Quality Validation Commands**:
```bash
bun run validate      # Full validation: typecheck + lint + format + test
bun run typecheck     # TypeScript compilation (tsc --noEmit)
bun run lint          # ESLint validation (must show 0 errors)
bun run format        # Prettier formatting
bun run test          # Test suite execution
```

**Pre-commit Requirements**:
- All ESLint rules must pass (zero errors, zero warnings)
- TypeScript compilation must succeed
- All tests must pass
- Code must be properly formatted

**Phase 02 Additional Requirements**:
- Command modules must not exceed 200 lines (enforces single responsibility)
- No circular dependencies between command handlers
- Each command must implement the CommandHandler interface
- Utility modules must be cross-platform compatible

### Code Review Checklist
Before submitting code, verify:
- [ ] Follows all coding standards
- [ ] Has appropriate test coverage
- [ ] Documentation is updated
- [ ] No console.log statements left in production code
- [ ] Error handling is comprehensive
- [ ] Cross-platform compatibility is maintained
- [ ] **ESLint strictness rules pass** (no unused vars, no explicit any, no non-null assertions)

### Release Checklist
Before releasing new version:
- [ ] All tests pass on all platforms
- [ ] Documentation is updated
- [ ] Version numbers are synchronized
- [ ] Installation is tested from scratch
- [ ] Edge cases are manually verified

## Contributing Standards

### Development Workflow
1. Create feature branch from main
2. Implement changes following these standards
3. Add comprehensive tests
4. Update documentation
5. Submit PR with clear description

### Pull Request Requirements
- Clear description of changes
- Test coverage for new functionality
- Documentation updates
- No breaking changes without version bump
- All CI checks passing

## Summary

These code standards ensure the CCS codebase remains:
- **Maintainable**: Clear modular structure with 7 subsystems, consistent naming patterns
- **Reliable**: Comprehensive error handling, testing, and validation
- **Performant**: Optimized spawn logic, stream parsing, minimal overhead
- **Secure**: Safe process execution, symlink validation, file handling
- **Compatible**: Cross-platform symlinking, Windows fallbacks, unified behavior
- **Extensible**: Clean subsystem boundaries, reusable patterns
- **Type-Safe**: Enhanced ESLint strictness enforces zero-tolerance for code quality issues
- **User-Friendly**: Semantic UI system with intelligent fallback rendering (Phase 5)

**Phase 5 (2025-12-01) - UI & Listr2 Integration**:
- **Central UI Module**: src/utils/ui.ts with semantic colors, status indicators, boxes, tables
- **Listr2 Integration**: Task list progress with intelligent renderer selection
- **Claude Code Detection**: Automatic fallback for tool context (isClaudeCodeContext)
- **Async Formatting**: Result formatter now async with ui.init() call
- **Compliance**: ASCII-only indicators ([OK], [X], [!], [i]), NO_COLOR respect

**v4.x Specific Standards**:
- **Delegation patterns**: Stream-JSON parsing, session management, headless execution
- **Symlinking patterns**: Cross-platform symlink creation, validation, repair
- **UI patterns**: Semantic colors, status indicators, boxes, tables, spinners, task lists
- **Subsystem organization**: Clear separation (auth, delegation, glmt, management, utils)
- **Naming conventions**: handler, executor, manager, validator, formatter, parser suffixes

**v4.5.0 Installation Standards**:
- **Bootstrap-based installers**: Native shell wrappers delegate to Node.js via npx
- **Node.js requirement**: 14+ required (checked during install)
- **No shell dependencies**: error-codes.sh, progress-indicator.sh, prompt.sh removed
- **First-run bootstrap**: Auto-installs @kaitranntt/ccs npm package globally

Following these standards helps maintain the quality, modularity, and extensibility of the v4.x architecture while enabling future development with AI delegation, shared data management, and comprehensive diagnostics. Phase 5 adds a professional UI layer that gracefully degrades in non-TTY environments while maintaining strict compliance with project constraints.