/**
 * Package Manager Detector Utilities
 *
 * Cross-platform package manager detection utilities for CCS.
 */

import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

/**
 * Detect installation method
 */
export function detectInstallationMethod(): 'npm' | 'direct' {
  const scriptPath = process.argv[1];

  // Method 1: Check if script is inside node_modules
  if (scriptPath.includes('node_modules')) {
    return 'npm';
  }

  // Method 2: Check if script is in npm global bin directory
  const npmGlobalBinPatterns = [
    /\.npm\/global\/bin\//,
    /\/\.nvm\/versions\/node\/[^/]+\/bin\//,
    /\/usr\/local\/bin\//,
    /\/usr\/bin\//,
  ];

  for (const pattern of npmGlobalBinPatterns) {
    if (pattern.test(scriptPath)) {
      try {
        const binDir = path.dirname(scriptPath);
        const nodeModulesDir = path.join(binDir, '..', 'lib', 'node_modules', '@kaitranntt', 'ccs');
        const globalModulesDir = path.join(binDir, '..', 'node_modules', '@kaitranntt', 'ccs');

        if (fs.existsSync(nodeModulesDir) || fs.existsSync(globalModulesDir)) {
          return 'npm';
        }
      } catch (_err) {
        // Continue checking other patterns
      }
    }
  }

  // Method 3: Check if package.json exists in parent directory
  const packageJsonPath = path.join(__dirname, '..', 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.name === '@kaitranntt/ccs') {
        return 'npm';
      }
    } catch (_err) {
      // Ignore parse errors
    }
  }

  // Method 4: Check if script is a symlink pointing to node_modules
  try {
    const stats = fs.lstatSync(scriptPath);
    if (stats.isSymbolicLink()) {
      const targetPath = fs.readlinkSync(scriptPath);
      if (targetPath.includes('node_modules') || targetPath.includes('@kaitranntt/ccs')) {
        return 'npm';
      }
    }
  } catch (_err) {
    // Continue to default
  }

  return 'direct';
}

/**
 * Detect which package manager was used for installation
 */
export function detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
  const scriptPath = process.argv[1];

  // Check if script path contains package manager indicators
  if (scriptPath.includes('.pnpm')) return 'pnpm';
  if (scriptPath.includes('yarn')) return 'yarn';
  if (scriptPath.includes('bun')) return 'bun';

  // Check parent directories for lock files
  const binDir = path.dirname(scriptPath);

  let checkDir = binDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(checkDir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(checkDir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(checkDir, 'bun.lockb'))) return 'bun';
    checkDir = path.dirname(checkDir);
  }

  // Check if package managers are available on the system
  try {
    const yarnResult = spawnSync('yarn', ['global', 'list', '--pattern', '@kaitranntt/ccs'], {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });
    if (yarnResult.status === 0 && yarnResult.stdout.includes('@kaitranntt/ccs')) {
      return 'yarn';
    }
  } catch (_err) {
    // Continue to next check
  }

  try {
    const pnpmResult = spawnSync('pnpm', ['list', '-g', '--pattern', '@kaitranntt/ccs'], {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });
    if (pnpmResult.status === 0 && pnpmResult.stdout.includes('@kaitranntt/ccs')) {
      return 'pnpm';
    }
  } catch (_err) {
    // Continue to next check
  }

  try {
    const bunResult = spawnSync('bun', ['pm', 'ls', '-g', '--pattern', '@kaitranntt/ccs'], {
      encoding: 'utf8',
      shell: true,
      timeout: 5000,
    });
    if (bunResult.status === 0 && bunResult.stdout.includes('@kaitranntt/ccs')) {
      return 'bun';
    }
  } catch (_err) {
    // Continue to default
  }

  return 'npm';
}
