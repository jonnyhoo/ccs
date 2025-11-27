#!/usr/bin/env node

/**
 * Parses Claude Code settings for tool restrictions
 */

import * as fs from 'fs';
import * as path from 'path';

interface ToolRestrictions {
  allowedTools: string[];
  disallowedTools: string[];
}

interface Settings {
  permissions?: {
    allow?: string[];
    deny?: string[];
    defaultMode?: string;
  };
}

/**
 * Settings Parser Class
 */
class SettingsParser {
  /**
   * Parse default permission mode from project settings
   */
  static parseDefaultPermissionMode(projectDir: string): string {
    const settings = this.loadSettings(projectDir);
    const permissions = settings.permissions || {};

    // Priority: local > shared > fallback to 'acceptEdits'
    const defaultMode = permissions.defaultMode || 'acceptEdits';

    if (process.env.CCS_DEBUG) {
      console.error(`[i] Permission mode from settings: ${defaultMode}`);
    }

    return defaultMode;
  }

  /**
   * Parse project settings for tool restrictions
   */
  static parseToolRestrictions(projectDir: string): ToolRestrictions {
    const settings = this.loadSettings(projectDir);
    const permissions = settings.permissions || {};

    const allowed = permissions.allow || [];
    const denied = permissions.deny || [];

    if (process.env.CCS_DEBUG) {
      console.error(`[i] Tool restrictions: ${allowed.length} allowed, ${denied.length} denied`);
    }

    return {
      allowedTools: allowed,
      disallowedTools: denied
    };
  }

  /**
   * Load and merge settings files (local overrides shared)
   */
  private static loadSettings(projectDir: string): Settings {
    const claudeDir = path.join(projectDir, '.claude');
    const sharedPath = path.join(claudeDir, 'settings.json');
    const localPath = path.join(claudeDir, 'settings.local.json');

    // Load shared settings
    const shared = this.readJsonSafe(sharedPath) || {};

    // Load local settings (overrides shared)
    const local = this.readJsonSafe(localPath) || {};

    // Merge permissions (local overrides shared)
    return {
      permissions: {
        allow: [
          ...(shared.permissions?.allow || []),
          ...(local.permissions?.allow || [])
        ],
        deny: [
          ...(shared.permissions?.deny || []),
          ...(local.permissions?.deny || [])
        ],
        // Local defaultMode takes priority over shared
        defaultMode: local.permissions?.defaultMode || shared.permissions?.defaultMode || undefined
      }
    };
  }

  /**
   * Read JSON file safely (no throw)
   */
  private static readJsonSafe(filePath: string): Settings | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as Settings;
    } catch (error) {
      if (process.env.CCS_DEBUG) {
        console.warn(`[!] Failed to read settings: ${filePath}: ${(error as Error).message}`);
      }
      return null;
    }
  }
}

export { SettingsParser };