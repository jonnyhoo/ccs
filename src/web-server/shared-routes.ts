/**
 * Shared Data Routes (Phase 07)
 *
 * API routes for commands, skills, agents from ~/.ccs/shared/
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getCcsDir } from '../utils/config-manager';

export const sharedRoutes = Router();

interface SharedItem {
  name: string;
  description: string;
  path: string;
  type: 'command' | 'skill' | 'agent';
}

/**
 * GET /api/shared/commands
 */
sharedRoutes.get('/commands', (_req: Request, res: Response) => {
  const items = getSharedItems('commands');
  res.json({ items });
});

/**
 * GET /api/shared/skills
 */
sharedRoutes.get('/skills', (_req: Request, res: Response) => {
  const items = getSharedItems('skills');
  res.json({ items });
});

/**
 * GET /api/shared/agents
 */
sharedRoutes.get('/agents', (_req: Request, res: Response) => {
  const items = getSharedItems('agents');
  res.json({ items });
});

/**
 * GET /api/shared/summary
 */
sharedRoutes.get('/summary', (_req: Request, res: Response) => {
  const commands = getSharedItems('commands').length;
  const skills = getSharedItems('skills').length;
  const agents = getSharedItems('agents').length;

  res.json({
    commands,
    skills,
    agents,
    total: commands + skills + agents,
    symlinkStatus: checkSymlinkStatus(),
  });
});

function getSharedItems(type: 'commands' | 'skills' | 'agents'): SharedItem[] {
  const ccsDir = getCcsDir();
  const sharedDir = path.join(ccsDir, 'shared', type);

  if (!fs.existsSync(sharedDir)) {
    return [];
  }

  const items: SharedItem[] = [];

  try {
    const entries = fs.readdirSync(sharedDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Skill/Agent: look for prompt.md
        const promptPath = path.join(sharedDir, entry.name, 'prompt.md');
        if (fs.existsSync(promptPath)) {
          const content = fs.readFileSync(promptPath, 'utf8');
          const description = extractDescription(content);
          items.push({
            name: entry.name,
            description,
            path: path.join(sharedDir, entry.name),
            type: type === 'commands' ? 'command' : (type.slice(0, -1) as 'skill' | 'agent'),
          });
        }
      } else if (entry.name.endsWith('.md')) {
        // Command: .md file
        const filePath = path.join(sharedDir, entry.name);
        const content = fs.readFileSync(filePath, 'utf8');
        const description = extractDescription(content);
        items.push({
          name: entry.name.replace('.md', ''),
          description,
          path: filePath,
          type: 'command',
        });
      }
    }
  } catch {
    // Directory read failed
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function extractDescription(content: string): string {
  // Extract first non-empty, non-heading line
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
      return trimmed.slice(0, 100);
    }
  }
  return 'No description';
}

function checkSymlinkStatus(): { valid: boolean; message: string } {
  const ccsDir = getCcsDir();
  const sharedDir = path.join(ccsDir, 'shared');

  if (!fs.existsSync(sharedDir)) {
    return { valid: false, message: 'Shared directory not found' };
  }

  // Check all three symlinks: commands, skills, agents
  const linkTypes = ['commands', 'skills', 'agents'];
  let validLinks = 0;

  for (const linkType of linkTypes) {
    const linkPath = path.join(sharedDir, linkType);

    try {
      if (fs.existsSync(linkPath)) {
        const stats = fs.lstatSync(linkPath);
        if (stats.isSymbolicLink()) {
          const target = fs.readlinkSync(linkPath);
          // Check if it points to ~/.claude/{linkType}
          const expectedTarget = path.join(os.homedir(), '.claude', linkType);
          if (path.resolve(path.dirname(linkPath), target) === path.resolve(expectedTarget)) {
            validLinks++;
          }
        }
      }
    } catch {
      // Not a symlink or read error
    }
  }

  if (validLinks === linkTypes.length) {
    return { valid: true, message: 'Symlinks active' };
  } else if (validLinks > 0) {
    return {
      valid: false,
      message: `Symlinks partially configured (${validLinks}/${linkTypes.length})`,
    };
  }

  return { valid: false, message: 'Symlinks not configured' };
}
