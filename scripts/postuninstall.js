#!/usr/bin/env node
/**
 * CCS Postuninstall Script
 *
 * Cleans up CCS-specific files after npm uninstall.
 * Does NOT touch global ~/.claude/settings.json (hooks are per-profile now).
 *
 * Self-contained, no external dependencies.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Note: Uses os.homedir() directly because this script runs during npm uninstall,
// not in test context. CCS_HOME isolation is for src/ code only.
const CCS_DIR = path.join(os.homedir(), '.ccs');
const HOOKS_DIR = path.join(CCS_DIR, 'hooks');
const MIGRATION_MARKER = path.join(CCS_DIR, '.hook-migrated');

function cleanupCcsFiles() {
  try {
    // Remove WebSearch hook file
    const hookPath = path.join(HOOKS_DIR, 'websearch-transformer.cjs');
    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
    }

    // Remove migration marker (so fresh install re-runs migration)
    if (fs.existsSync(MIGRATION_MARKER)) {
      fs.unlinkSync(MIGRATION_MARKER);
    }

    // Note: Do NOT touch ~/.claude/settings.json
    // Per-profile hooks in ~/.ccs/*.settings.json will be cleaned up
    // when the user removes ~/.ccs/ directory.
  } catch (err) {
    // Silent fail - not critical, but log for debugging
    try {
      const logPath = path.join(CCS_DIR, 'uninstall.log');
      fs.appendFileSync(logPath, `${new Date().toISOString()}: ${err.message}\n`);
    } catch {
      // Ignore logging failures
    }
  }
}

cleanupCcsFiles();
