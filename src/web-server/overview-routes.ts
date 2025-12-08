/**
 * Overview Routes (Phase 07)
 *
 * Dashboard overview API for counts and health summary.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir, loadConfig } from '../utils/config-manager';
import { runHealthChecks } from './health-service';

export const overviewRoutes = Router();

/**
 * GET /api/overview
 */
overviewRoutes.get('/', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();

    const profileCount = Object.keys(config.profiles).length;
    const cliproxyCount = Object.keys(config.cliproxy || {}).length;

    // Get quick health summary
    const health = runHealthChecks();

    res.json({
      profiles: profileCount,
      cliproxy: cliproxyCount,
      accounts: getAccountCount(),
      health: {
        status:
          health.summary.errors > 0 ? 'error' : health.summary.warnings > 0 ? 'warning' : 'ok',
        passed: health.summary.passed,
        total: health.summary.total,
      },
    });
  } catch {
    res.json({
      profiles: 0,
      cliproxy: 0,
      accounts: 0,
      health: { status: 'error', passed: 0, total: 0 },
    });
  }
});

function getAccountCount(): number {
  try {
    const profilesPath = path.join(getCcsDir(), 'profiles.json');

    if (!fs.existsSync(profilesPath)) return 0;

    const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
    return Object.keys(data.profiles || {}).length;
  } catch {
    return 0;
  }
}
