import * as fs from 'fs';
import * as path from 'path';
import { initUI, box, color, dim, sectionHeader, subheader } from '../utils/ui';
import { isUnifiedMode } from '../config/unified-config-loader';

// Get version from package.json (same as version-command.ts)
const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8')
).version;

/**
 * Print a major section with ═══ borders (only for 3 main sections)
 * Format:
 *   ═══ TITLE ═══
 *   Subtitle line 1
 *   Subtitle line 2
 *
 *   command    Description
 */
function printMajorSection(title: string, subtitles: string[], items: [string, string][]): void {
  // Section header with ═══ borders
  console.log(sectionHeader(title));

  // Subtitles on separate lines (dim)
  for (const subtitle of subtitles) {
    console.log(`  ${dim(subtitle)}`);
  }

  // Empty line before items
  console.log('');

  // Calculate max command length for alignment
  const maxCmdLen = Math.max(...items.map(([cmd]) => cmd.length));

  for (const [cmd, desc] of items) {
    const paddedCmd = cmd.padEnd(maxCmdLen + 2);
    console.log(`  ${color(paddedCmd, 'command')} ${desc}`);
  }

  // Extra spacing after section
  console.log('');
}

/**
 * Print a sub-section with colored title
 * Format:
 *   Title (context):
 *     command    Description
 */
function printSubSection(title: string, items: [string, string][]): void {
  // Sub-section header (colored, no borders)
  console.log(subheader(`${title}:`));

  // Calculate max command length for alignment
  const maxCmdLen = Math.max(...items.map(([cmd]) => cmd.length));

  for (const [cmd, desc] of items) {
    const paddedCmd = cmd.padEnd(maxCmdLen + 2);
    console.log(`  ${color(paddedCmd, 'command')} ${desc}`);
  }

  // Spacing after section
  console.log('');
}

/**
 * Print a config/paths section
 * Format:
 *   Title:
 *     Label:    path
 */
function printConfigSection(title: string, items: [string, string][]): void {
  console.log(subheader(`${title}:`));

  // Calculate max label length for alignment
  const maxLabelLen = Math.max(...items.map(([label]) => label.length));

  for (const [label, path] of items) {
    const paddedLabel = label.padEnd(maxLabelLen);
    console.log(`  ${paddedLabel} ${color(path, 'path')}`);
  }

  console.log('');
}

/**
 * Display comprehensive help information for CCS (Claude Code Switch)
 */
export async function handleHelpCommand(): Promise<void> {
  // Initialize UI (if not already)
  await initUI();

  // Hero box with ASCII art logo and config hint
  // Each letter: C=╔═╗/║ /╚═╝, C=╔═╗/║ /╚═╝, S=╔═╗/╚═╗/╚═╝
  const logo = `
╔═╗ ╔═╗ ╔═╗
║   ║   ╚═╗  v${VERSION}
╚═╝ ╚═╝ ╚═╝

Claude Code Profile & Model Switcher

Run ${color('ccs config', 'command')} for web dashboard`.trim();

  console.log(
    box(logo, {
      padding: 1,
      borderStyle: 'round',
      titleAlignment: 'center',
    })
  );
  console.log('');

  // Usage section
  console.log(subheader('Usage:'));
  console.log(`  ${color('ccs', 'command')} [profile] [claude-args...]`);
  console.log(`  ${color('ccs', 'command')} [flags]`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // MAJOR SECTION 1: API Key Profiles
  // ═══════════════════════════════════════════════════════════════════════════
  printMajorSection(
    'API Key Profiles',
    ['Configure in ~/.ccs/*.settings.json'],
    [
      ['ccs', 'Use default Claude account'],
      ['ccs glm', 'GLM 4.6 (API key required)'],
      ['ccs glmt', 'GLM with thinking mode'],
      ['ccs kimi', 'Kimi for Coding (API key)'],
      ['ccs ollama', 'Local Ollama (http://localhost:11434)'],
      ['ccs ollama-cloud', 'Ollama Cloud (API key required)'],
      ['', ''], // Spacer
      ['ccs api create', 'Create custom API profile'],
      ['ccs api remove', 'Remove an API profile'],
      ['ccs api list', 'List all API profiles'],
    ]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAJOR SECTION 2: Account Management
  // ═══════════════════════════════════════════════════════════════════════════
  printMajorSection(
    'Account Management',
    ['Run multiple Claude accounts concurrently'],
    [
      ['ccs auth --help', 'Show account management commands'],
      ['ccs auth create <name>', 'Create new account profile'],
      ['ccs auth list', 'List all account profiles'],
      ['ccs auth default <name>', 'Set default profile'],
      ['ccs auth reset-default', 'Restore original CCS default'],
    ]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAJOR SECTION 3: CLI Proxy OAuth (Removed)
  // ═══════════════════════════════════════════════════════════════════════════
  printMajorSection(
    'CLI Proxy OAuth (Removed)',
    ['gemini/codex/agy/qwen/iflow/kiro/ghcp/claude are disabled in this build'],
    [
      ['ccs api create --openai', 'Use OpenAI-compatible endpoint profiles'],
      ['ccs glmt', 'Use GLMT thinking proxy'],
    ]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAJOR SECTION 4: GitHub Copilot Integration (copilot-api)
  // ═══════════════════════════════════════════════════════════════════════════
  printMajorSection(
    'GitHub Copilot Integration (copilot-api)',
    [
      'Use your GitHub Copilot subscription with Claude Code via copilot-api',
      'Requires: npm install -g copilot-api',
      'Note: CLIProxy OAuth providers are removed in this lite build',
    ],
    [
      ['ccs copilot', 'Use Copilot via copilot-api daemon'],
      ['ccs copilot auth', 'Authenticate with GitHub'],
      ['ccs copilot status', 'Show integration status'],
      ['ccs copilot models', 'List available models'],
      ['ccs copilot start', 'Start copilot-api daemon'],
      ['ccs copilot stop', 'Stop copilot-api daemon'],
      ['ccs copilot enable', 'Enable integration'],
      ['ccs copilot disable', 'Disable integration'],
    ]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SUB-SECTIONS (simpler styling)
  // ═══════════════════════════════════════════════════════════════════════════

  // Delegation
  printSubSection('Delegation (inside Claude Code CLI)', [
    ['/ccs "task"', 'Delegate task (auto-selects profile)'],
    ['/ccs --glm "task"', 'Force GLM-4.6 for simple tasks'],
    ['/ccs --kimi "task"', 'Force Kimi for long context'],
    ['/ccs:continue "follow-up"', 'Continue last delegation session'],
  ]);

  // Delegation CLI Flags (Claude Code passthrough)
  printSubSection('Delegation Flags (Claude Code passthrough)', [
    ['--max-turns <n>', 'Limit agentic turns (prevents loops)'],
    ['--fallback-model <model>', 'Auto-fallback on overload (sonnet)'],
    ['--agents <json>', 'Inject dynamic subagents'],
    ['--betas <features>', 'Enable experimental features'],
    ['--allowedTools <list>', 'Restrict available tools'],
    ['--disallowedTools <list>', 'Block specific tools'],
  ]);

  // Diagnostics
  printSubSection('Diagnostics', [
    ['ccs setup', 'First-time setup wizard'],
    ['ccs doctor', 'Run health check and diagnostics'],
    ['ccs cleanup', 'Remove old CCS temp/log files'],
    ['ccs config', 'Open web configuration dashboard'],
    ['ccs config auth setup', 'Configure dashboard login'],
    ['ccs config auth show', 'Show dashboard auth status'],
    ['ccs config image-analysis', 'Show image analysis settings'],
    ['ccs config image-analysis --enable', 'Enable image analysis'],
    ['ccs config --port 3000', 'Use specific port'],
    ['ccs persist <profile>', 'Write profile env to ~/.claude/settings.json'],
    ['ccs persist --list-backups', 'List available settings.json backups'],
    ['ccs persist --restore', 'Restore settings.json from latest backup'],
    ['ccs sync', 'Sync delegation commands and skills'],
    ['ccs update', 'Update CCS to latest version'],
    ['ccs update --force', 'Force reinstall current version'],
    ['ccs update --beta', 'Install from dev channel (unstable)'],
  ]);

  // Flags
  printSubSection('Flags', [
    ['-h, --help', 'Show this help message'],
    ['-v, --version', 'Show version and installation info'],
    ['-sc, --shell-completion', 'Install shell auto-completion'],
  ]);

  // Configuration
  printConfigSection('Configuration', [
    ['Config File:', isUnifiedMode() ? '~/.ccs/config.yaml' : '~/.ccs/config.json'],
    ['Profiles:', '~/.ccs/profiles.json'],
    ['Instances:', '~/.ccs/instances/'],
    ['Settings:', '~/.ccs/*.settings.json'],
  ]);

  // W3: Thinking Budget explanation
  printSubSection('Extended Thinking (--thinking)', [
    ['--thinking off', 'Disable extended thinking'],
    ['--thinking auto', 'Let model decide dynamically'],
    ['--thinking low', '1K tokens - Quick responses'],
    ['--thinking medium', '8K tokens - Standard analysis'],
    ['--thinking high', '24K tokens - Deep reasoning'],
    ['--thinking xhigh', '32K tokens - Maximum depth'],
    ['--thinking <number>', 'Custom token budget (512-100000)'],
    ['', ''],
    ['Note:', 'Extended thinking allocates compute for step-by-step reasoning'],
    ['', 'before responding. Supported when the active profile enables thinking.'],
  ]);

  // Shared Data
  console.log(subheader('Shared Data:'));
  console.log(`  Commands:    ${color('~/.ccs/shared/commands/', 'path')}`);
  console.log(`  Skills:      ${color('~/.ccs/shared/skills/', 'path')}`);
  console.log(`  Agents:      ${color('~/.ccs/shared/agents/', 'path')}`);
  console.log(`  ${dim('Note: Symlinked across all profiles')}`);
  console.log('');

  // Examples (aligned with consistent spacing)
  console.log(subheader('Examples:'));
  console.log(`  $ ${color('ccs', 'command')}                     ${dim('# Use default account')}`);
  console.log(
    `  $ ${color('ccs api create --openai', 'command')} ${dim('# Create OpenAI-compatible profile')}`
  );
  console.log(`  $ ${color('ccs glm "implement API"', 'command')} ${dim('# API key model')}`);
  console.log(`  $ ${color('ccs config', 'command')}              ${dim('# Open web dashboard')}`);
  console.log('');

  // Update examples
  console.log(subheader('Update:'));
  console.log(
    `  $ ${color('ccs update', 'command')}              ${dim('# Update to latest stable')}`
  );
  console.log(
    `  $ ${color('ccs update --force', 'command')}      ${dim('# Force reinstall current')}`
  );
  console.log(`  $ ${color('ccs update --beta', 'command')}       ${dim('# Install dev channel')}`);
  console.log('');

  // Docs link
  console.log(`  ${dim('Docs: https://github.com/kaitranntt/ccs')}`);
  console.log('');

  // Uninstall
  console.log(subheader('Uninstall:'));
  console.log(`  ${color('npm uninstall -g @kaitranntt/ccs', 'command')}`);
  console.log('');

  // License
  console.log(dim('License: MIT'));
  console.log('');

  process.exit(0);
}
