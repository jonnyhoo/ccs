/**
 * Settings Routes - Settings and preset management
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadSettings } from '../../utils/config-manager';
import { isSensitiveKey, maskSensitiveValue } from '../../utils/sensitive-keys';
import { listVariants } from '../../cliproxy/services/variant-service';
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
    return variant.settings.replace(/^~/, process.env.HOME || '');
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

/**
 * PUT /api/settings/:profile - Update settings with conflict detection and backup
 */
router.put('/:profile', (req: Request, res: Response): void => {
  try {
    const { profile } = req.params;
    const { settings, expectedMtime } = req.body;
    const ccsDir = getCcsDir();
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

    // Create backup only if file exists
    let backupPath: string | undefined;
    if (fileExists) {
      const backupDir = path.join(ccsDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = path.join(backupDir, `${profile}.${timestamp}.settings.json`);
      fs.copyFileSync(settingsPath, backupPath);
    }

    // Ensure directory exists for new files
    if (!fileExists) {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    }

    // Write new settings atomically
    const tempPath = settingsPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(tempPath, settingsPath);

    const newStat = fs.statSync(settingsPath);
    res.json({
      profile,
      mtime: newStat.mtime.getTime(),
      backupPath,
      created: !fileExists,
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
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

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
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
