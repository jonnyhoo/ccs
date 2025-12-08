/**
 * Health Check Service (Phase 06)
 *
 * Runs health checks for CCS dashboard: Claude CLI, config files, CLIProxy binary.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getCcsDir, getConfigPath } from '../utils/config-manager';
import { isCLIProxyInstalled, getInstalledCliproxyVersion, getCLIProxyPath } from '../cliproxy';

export interface HealthCheck {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  fixable?: boolean;
}

export interface HealthReport {
  timestamp: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

/**
 * Run all health checks and return report
 */
export function runHealthChecks(): HealthReport {
  const checks: HealthCheck[] = [];

  // Check 1: Claude CLI
  checks.push(checkClaudeCli());

  // Check 2: Config file
  checks.push(checkConfigFile());

  // Check 3: Profiles file
  checks.push(checkProfilesFile());

  // Check 4: CLIProxy binary
  checks.push(checkCliproxy());

  // Check 5: CCS directory
  checks.push(checkCcsDirectory());

  // Calculate summary
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'ok').length,
    warnings: checks.filter((c) => c.status === 'warning').length,
    errors: checks.filter((c) => c.status === 'error').length,
  };

  return {
    timestamp: Date.now(),
    checks,
    summary,
  };
}

function checkClaudeCli(): HealthCheck {
  try {
    const version = execSync('claude --version', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return {
      id: 'claude-cli',
      name: 'Claude CLI',
      status: 'ok',
      message: `Installed: ${version}`,
    };
  } catch {
    return {
      id: 'claude-cli',
      name: 'Claude CLI',
      status: 'error',
      message: 'Not found in PATH',
      details: 'Install: npm install -g @anthropic-ai/claude-code',
    };
  }
}

function checkConfigFile(): HealthCheck {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return {
      id: 'config-file',
      name: 'Config File',
      status: 'warning',
      message: 'Not found',
      details: configPath,
      fixable: true,
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    JSON.parse(content);
    return {
      id: 'config-file',
      name: 'Config File',
      status: 'ok',
      message: 'Valid JSON',
      details: configPath,
    };
  } catch {
    return {
      id: 'config-file',
      name: 'Config File',
      status: 'error',
      message: 'Invalid JSON',
      details: configPath,
    };
  }
}

function checkProfilesFile(): HealthCheck {
  const ccsDir = getCcsDir();
  const profilesPath = path.join(ccsDir, 'profiles.json');

  if (!fs.existsSync(profilesPath)) {
    return {
      id: 'profiles-file',
      name: 'Profiles Registry',
      status: 'warning',
      message: 'Not found (will be created on first account)',
      details: profilesPath,
      fixable: true,
    };
  }

  try {
    const content = fs.readFileSync(profilesPath, 'utf8');
    JSON.parse(content);
    return {
      id: 'profiles-file',
      name: 'Profiles Registry',
      status: 'ok',
      message: 'Valid',
      details: profilesPath,
    };
  } catch {
    return {
      id: 'profiles-file',
      name: 'Profiles Registry',
      status: 'error',
      message: 'Invalid JSON',
      details: profilesPath,
    };
  }
}

function checkCliproxy(): HealthCheck {
  if (isCLIProxyInstalled()) {
    const version = getInstalledCliproxyVersion();
    const binaryPath = getCLIProxyPath();
    return {
      id: 'cliproxy',
      name: 'CLIProxy',
      status: 'ok',
      message: `Installed: ${version}`,
      details: binaryPath,
    };
  }

  return {
    id: 'cliproxy',
    name: 'CLIProxy',
    status: 'warning',
    message: 'Not installed (optional)',
    details: 'Required for gemini/codex/agy providers. Install: ccs cliproxy --latest',
  };
}

function checkCcsDirectory(): HealthCheck {
  const ccsDir = getCcsDir();

  if (!fs.existsSync(ccsDir)) {
    return {
      id: 'ccs-dir',
      name: 'CCS Directory',
      status: 'warning',
      message: 'Not found',
      details: ccsDir,
      fixable: true,
    };
  }

  return {
    id: 'ccs-dir',
    name: 'CCS Directory',
    status: 'ok',
    message: 'Exists',
    details: ccsDir,
  };
}

/**
 * Fix a health issue by its check ID
 */
export function fixHealthIssue(checkId: string): { success: boolean; message: string } {
  const ccsDir = getCcsDir();

  switch (checkId) {
    case 'ccs-dir':
      fs.mkdirSync(ccsDir, { recursive: true });
      return { success: true, message: 'Created ~/.ccs directory' };

    case 'config-file': {
      const configPath = getConfigPath();
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({ profiles: {} }, null, 2) + '\n');
      return { success: true, message: 'Created config.json' };
    }

    case 'profiles-file': {
      const profilesPath = path.join(ccsDir, 'profiles.json');
      fs.mkdirSync(ccsDir, { recursive: true });
      fs.writeFileSync(profilesPath, JSON.stringify({ profiles: {} }, null, 2) + '\n');
      return { success: true, message: 'Created profiles.json' };
    }

    default:
      return { success: false, message: 'Cannot auto-fix this issue' };
  }
}
