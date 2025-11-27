# CCS Code Standards

## Overview

This document defines the coding standards and principles for the CCS (Claude Code Switch) project. Following these standards ensures consistency, maintainability, and quality across the codebase.

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

## JavaScript Standards

### Code Style

#### File Structure
```javascript
'use strict';

// Dependencies
const { spawn } = require('child_process');
const path = require('path');
const { error } = require('./helpers');

// Constants
const CCS_VERSION = require('../package.json').version;

// Functions (grouped by responsibility)
function mainFunction() {
  // Implementation
}

// Main execution
function main() {
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

### Module Organization Standards (v4.3.2)

#### Subsystem Directory Structure
```
bin/
├── auth/                    # Auth system modules
├── delegation/              # Delegation system modules
├── glmt/                    # GLMT system modules
├── management/              # Management system modules
└── utils/                   # Utility modules
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

## Delegation System Patterns (v4.0+)

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

### Result Formatting Pattern

#### Cost and Duration Extraction
```javascript
// Extract cost and duration from Claude CLI output
function parseExecutionStats(output) {
  const costRegex = /Cost:\s+\$(\d+\.\d+)/;
  const durationRegex = /Duration:\s+(\d+)ms/;

  const costMatch = output.match(costRegex);
  const durationMatch = output.match(durationRegex);

  return {
    cost: costMatch ? parseFloat(costMatch[1]) : null,
    duration: durationMatch ? parseInt(durationMatch[1]) : null
  };
}

// Format results
function formatResults(exitCode, stats) {
  const status = exitCode === 0 ? '[OK]' : '[X]';
  const costStr = stats.cost ? `\$${stats.cost.toFixed(4)}` : 'N/A';
  const durationStr = stats.duration ? `${(stats.duration / 1000).toFixed(2)}s` : 'N/A';

  console.log(`\n${status} Execution complete`);
  console.log(`  Cost: ${costStr}`);
  console.log(`  Duration: ${durationStr}`);
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

### Code Review Checklist
Before submitting code, verify:
- [ ] Follows all coding standards
- [ ] Has appropriate test coverage
- [ ] Documentation is updated
- [ ] No console.log statements left in production code
- [ ] Error handling is comprehensive
- [ ] Cross-platform compatibility is maintained

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

**v4.x Specific Standards**:
- **Delegation patterns**: Stream-JSON parsing, session management, headless execution
- **Symlinking patterns**: Cross-platform symlink creation, validation, repair
- **Subsystem organization**: Clear separation (auth, delegation, glmt, management, utils)
- **Naming conventions**: handler, executor, manager, validator, formatter, parser suffixes

**v4.5.0 Installation Standards**:
- **Bootstrap-based installers**: Native shell wrappers delegate to Node.js via npx
- **Node.js requirement**: 14+ required (checked during install)
- **No shell dependencies**: error-codes.sh, progress-indicator.sh, prompt.sh removed
- **First-run bootstrap**: Auto-installs @kaitranntt/ccs npm package globally

Following these standards helps maintain the quality, modularity, and extensibility of the v4.x architecture while enabling future development with AI delegation, shared data management, and comprehensive diagnostics.