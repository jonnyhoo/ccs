/**
 * Settings Routes - Settings and preset management
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getCcsDir, loadSettings } from '../../utils/config-manager';
import { isSensitiveKey, maskSensitiveValue } from '../../utils/sensitive-keys';
import { listVariants } from '../../cliproxy/services/variant-service';
import {
  generateSecureToken,
  maskToken,
  getAuthSummary,
  setGlobalApiKey,
  setGlobalManagementSecret,
  resetAuthToDefaults,
} from '../../cliproxy';
import { regenerateConfig } from '../../cliproxy/config-generator';
import type { Settings } from '../../types/config';

const router = Router();

/**
 * Helper: Resolve settings path for profile or variant
 * Variants have settings paths in config, regular profiles use {name}.settings.json
 */
function resolveSettingsPath(profileOrVariant: string): string {
  const ccsDir = getCcsDir();

  // Check if this is a variant
  const variants = listVariants();
  const variant = variants[profileOrVariant];
  if (variant?.settings) {
    // Variant settings path (e.g., ~/.ccs/agy-g3.settings.json)
    return variant.settings.replace(/^~/, os.homedir());
  }

  // Regular profile settings
  return path.join(ccsDir, `${profileOrVariant}.settings.json`);
}

/**
 * Helper: Mask API keys in settings
 */
function maskApiKeys(settings: Settings): Settings {
  if (!settings.env) return settings;

  const masked = { ...settings, env: { ...settings.env } };

  for (const key of Object.keys(masked.env)) {
    if (isSensitiveKey(key)) {
      masked.env[key] = maskSensitiveValue(masked.env[key]);
    }
  }

  return masked;
}

/**
 * GET /api/settings/:profile - Get settings with masked API keys
 */
router.get('/:profile', (req: Request, res: Response): void => {
  try {
    const { profile } = req.params;
    const settingsPath = resolveSettingsPath(profile);

    if (!fs.existsSync(settingsPath)) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    const stat = fs.statSync(settingsPath);
    const settings = loadSettings(settingsPath);
    const masked = maskApiKeys(settings);

    res.json({
      profile,
      settings: masked,
      mtime: stat.mtime.getTime(),
      path: settingsPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/settings/:profile/raw - Get full settings (for editing)
 */
router.get('/:profile/raw', (req: Request, res: Response): void => {
  try {
    const { profile } = req.params;
    const settingsPath = resolveSettingsPath(profile);

    if (!fs.existsSync(settingsPath)) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    const stat = fs.statSync(settingsPath);
    const settings = loadSettings(settingsPath);

    res.json({
      profile,
      settings,
      mtime: stat.mtime.getTime(),
      path: settingsPath,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/** Required env vars for CLIProxy providers to function */
const REQUIRED_ENV_KEYS = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN'] as const;

/** Check if settings have required fields (returns missing list for warnings) */
function checkRequiredEnvVars(settings: Settings): string[] {
  const env = settings?.env || {};
  return REQUIRED_ENV_KEYS.filter((key) => !env[key]?.trim());
}

/**
 * PUT /api/settings/:profile - Update settings with conflict detection and backup
 */
router.put('/:profile', (req: Request, res: Response): void => {
  try {
    const { profile } = req.params;
    const { settings, expectedMtime } = req.body;

    // Validate settings object exists
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'settings object is required in request body' });
      return;
    }

    const ccsDir = getCcsDir();

    // Check for missing required fields (warning, not blocking - runtime fills defaults)
    const missingFields = checkRequiredEnvVars(settings);
    const settingsPath = resolveSettingsPath(profile);

    const fileExists = fs.existsSync(settingsPath);

    // Only check conflict if file exists and expectedMtime was provided
    if (fileExists && expectedMtime) {
      const stat = fs.statSync(settingsPath);
      if (stat.mtime.getTime() !== expectedMtime) {
        res.status(409).json({
          error: 'File modified externally',
          currentMtime: stat.mtime.getTime(),
        });
        return;
      }
    }

    // Create backup only if file exists AND content actually changed
    let backupPath: string | undefined;
    const newContent = JSON.stringify(settings, null, 2) + '\n';
    if (fileExists) {
      const existingContent = fs.readFileSync(settingsPath, 'utf8');
      // Only create backup if content differs
      if (existingContent !== newContent) {
        const backupDir = path.join(ccsDir, 'backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = path.join(backupDir, `${profile}.${timestamp}.settings.json`);
        fs.copyFileSync(settingsPath, backupPath);
      }
    }

    // Ensure directory exists for new files
    if (!fileExists) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    }

    // Write new settings atomically
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, newContent);
    fs.renameSync(tempPath, settingsPath);

    const newStat = fs.statSync(settingsPath);
    res.json({
      profile,
      mtime: newStat.mtime.getTime(),
      backupPath,
      created: !fileExists,
      // Include warning if fields missing (runtime will use defaults)
      ...(missingFields.length > 0 && {
        warning: `Missing fields will use defaults: ${missingFields.join(', ')}`,
        missingFields,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Presets ====================

/**
 * GET /api/settings/:profile/presets - Get saved presets for a provider
 */
router.get('/:profile/presets', (req: Request, res: Response): void => {
  try {
    const { profile } = req.params;
    const settingsPath = resolveSettingsPath(profile);

    if (!fs.existsSync(settingsPath)) {
      res.json({ presets: [] });
      return;
    }

    const settings = loadSettings(settingsPath);
    res.json({ presets: settings.presets || [] });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/settings/:profile/presets - Create a new preset
 */
router.post('/:profile/presets', (req: Request, res: Response): void => {
  try {
    const { profile } = req.params;
    const { name, default: defaultModel, opus, sonnet, haiku } = req.body;

    if (!name || !defaultModel) {
      res.status(400).json({ error: 'Missing required fields: name, default' });
      return;
    }

    const settingsPath = resolveSettingsPath(profile);

    // Create settings file if it doesn't exist
    if (!fs.existsSync(settingsPath)) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({ env: {}, presets: [] }, null, 2) + '\n');
    }

    const settings = loadSettings(settingsPath);
    settings.presets = settings.presets || [];

    // Check for duplicate name
    if (settings.presets.some((p) => p.name === name)) {
      res.status(409).json({ error: 'Preset with this name already exists' });
      return;
    }

    const preset = {
      name,
      default: defaultModel,
      opus: opus || defaultModel,
      sonnet: sonnet || defaultModel,
      haiku: haiku || defaultModel,
    };

    settings.presets.push(preset);

    // Atomic write: temp file + rename
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tempPath, settingsPath);

    res.status(201).json({ preset });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/settings/:profile/presets/:name - Delete a preset
 */
router.delete('/:profile/presets/:name', (req: Request, res: Response): void => {
  try {
    const { profile, name } = req.params;
    const settingsPath = resolveSettingsPath(profile);

    if (!fs.existsSync(settingsPath)) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    const settings = loadSettings(settingsPath);
    if (!settings.presets || !settings.presets.some((p) => p.name === name)) {
      res.status(404).json({ error: 'Preset not found' });
      return;
    }

    settings.presets = settings.presets.filter((p) => p.name !== name);

    // Atomic write: temp file + rename
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tempPath, settingsPath);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ==================== Auth Tokens ====================

/**
 * GET /api/settings/auth/tokens - Get current auth token status (masked)
 */
router.get('/auth/tokens', (_req: Request, res: Response): void => {
  try {
    const summary = getAuthSummary();

    res.json({
      apiKey: {
        value: maskToken(summary.apiKey.value),
        isCustom: summary.apiKey.isCustom,
      },
      managementSecret: {
        value: maskToken(summary.managementSecret.value),
        isCustom: summary.managementSecret.isCustom,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/settings/auth/tokens/raw - Get current auth tokens unmasked
 * NOTE: Sensitive endpoint - no caching, localhost only
 */
router.get('/auth/tokens/raw', (_req: Request, res: Response): void => {
  try {
    // Prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-store');

    const summary = getAuthSummary();

    res.json({
      apiKey: {
        value: summary.apiKey.value,
        isCustom: summary.apiKey.isCustom,
      },
      managementSecret: {
        value: summary.managementSecret.value,
        isCustom: summary.managementSecret.isCustom,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/settings/auth/tokens - Update auth tokens
 */
router.put('/auth/tokens', (req: Request, res: Response): void => {
  try {
    const { apiKey, managementSecret } = req.body;

    if (apiKey !== undefined) {
      setGlobalApiKey(apiKey || undefined);
    }

    if (managementSecret !== undefined) {
      setGlobalManagementSecret(managementSecret || undefined);
    }

    // Regenerate CLIProxy config to apply changes
    regenerateConfig();

    const summary = getAuthSummary();
    res.json({
      success: true,
      apiKey: {
        value: maskToken(summary.apiKey.value),
        isCustom: summary.apiKey.isCustom,
      },
      managementSecret: {
        value: maskToken(summary.managementSecret.value),
        isCustom: summary.managementSecret.isCustom,
      },
      message: 'Restart CLIProxy to apply changes',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/settings/auth/tokens/regenerate-secret - Generate new management secret
 */
router.post('/auth/tokens/regenerate-secret', (_req: Request, res: Response): void => {
  try {
    const newSecret = generateSecureToken(32);
    setGlobalManagementSecret(newSecret);

    // Regenerate CLIProxy config to apply changes
    regenerateConfig();

    res.json({
      success: true,
      managementSecret: {
        value: maskToken(newSecret),
        isCustom: true,
      },
      message: 'Restart CLIProxy to apply changes',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/settings/auth/tokens/reset - Reset auth tokens to defaults
 */
router.post('/auth/tokens/reset', (_req: Request, res: Response): void => {
  try {
    resetAuthToDefaults();

    // Regenerate CLIProxy config to apply changes
    regenerateConfig();

    const summary = getAuthSummary();
    res.json({
      success: true,
      apiKey: {
        value: maskToken(summary.apiKey.value),
        isCustom: summary.apiKey.isCustom,
      },
      managementSecret: {
        value: maskToken(summary.managementSecret.value),
        isCustom: summary.managementSecret.isCustom,
      },
      message: 'Tokens reset to defaults. Restart CLIProxy to apply.',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
