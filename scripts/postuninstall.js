#!/usr/bin/env node
/**
 * CCS Postuninstall Script
 *
 * Cleans up WebSearch hook from ~/.claude/settings.json after npm uninstall.
 * Self-contained, no external dependencies.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function cleanupHook() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return; // Nothing to clean
    }

    const content = fs.readFileSync(SETTINGS_PATH, 'utf8');
    let settings;
    try {
      settings = JSON.parse(content);
    } catch {
      return; // Malformed JSON, don't touch
    }

    const hooks = settings.hooks;
    if (!hooks?.PreToolUse) {
      return; // No hooks to remove
    }

    const originalLength = hooks.PreToolUse.length;
    hooks.PreToolUse = hooks.PreToolUse.filter((h) => {
      if (h.matcher !== 'WebSearch') return true;
      const command = h.hooks?.[0]?.command;
      if (!command) return true;
      return !command.includes('.ccs/hooks/websearch-transformer');
    });

    if (hooks.PreToolUse.length === originalLength) {
      return; // Nothing changed
    }

    // Clean up empty structures
    if (hooks.PreToolUse.length === 0) {
      delete hooks.PreToolUse;
    }
    if (Object.keys(hooks).length === 0) {
      delete settings.hooks;
    }

    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
  } catch {
    // Silent fail - not critical
  }
}

cleanupHook();
