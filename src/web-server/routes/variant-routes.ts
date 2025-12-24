/**
 * Variant Routes - CLIProxy variant management (custom profiles)
 *
 * Uses variant-service.ts for proper port allocation and cleanup.
 */

import { Router, Request, Response } from 'express';
import { isReservedName, RESERVED_PROFILE_NAMES } from '../../config/reserved-names';
import type { CLIProxyProvider } from '../../cliproxy/types';
import {
  createVariant,
  removeVariant,
  listVariants,
  validateProfileName,
  updateVariant,
} from '../../cliproxy/services/variant-service';

const router = Router();

/**
 * GET /api/cliproxy - List cliproxy variants
 * Uses variant-service for consistent behavior with CLI
 */
router.get('/', (_req: Request, res: Response) => {
  const variants = listVariants();
  const variantList = Object.entries(variants).map(([name, variant]) => ({
    name,
    provider: variant.provider,
    settings: variant.settings,
    account: variant.account || 'default',
    port: variant.port, // Include port for port isolation
    model: variant.model,
  }));

  res.json({ variants: variantList });
});

/**
 * POST /api/cliproxy - Create cliproxy variant
 * Uses variant-service for proper port allocation
 */
router.post('/', (req: Request, res: Response): void => {
  const { name, provider, model, account } = req.body;

  if (!name || !provider) {
    res.status(400).json({ error: 'Missing required fields: name, provider' });
    return;
  }

  // Validate profile name
  const validationError = validateProfileName(name);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  // Reject reserved names (extra safety check)
  if (isReservedName(name)) {
    res.status(400).json({
      error: `Cannot use reserved name '${name}' as variant name`,
      reserved: RESERVED_PROFILE_NAMES,
    });
    return;
  }

  // Use variant-service for proper port allocation
  const result = createVariant(name, provider as CLIProxyProvider, model || '', account);

  if (!result.success) {
    res.status(409).json({ error: result.error });
    return;
  }

  res.status(201).json({
    name,
    provider,
    settings: result.settingsPath,
    account: account || 'default',
    port: result.variant?.port,
    model: result.variant?.model,
  });
});

/**
 * PUT /api/cliproxy/:name - Update cliproxy variant
 * Uses variant-service for consistent behavior with CLI
 */
router.put('/:name', (req: Request, res: Response): void => {
  try {
    const { name } = req.params;
    const { provider, account, model } = req.body;

    // Use variant-service for proper update handling
    const result = updateVariant(name, { provider, account, model });

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({
      name,
      provider: result.variant?.provider,
      account: result.variant?.account || 'default',
      settings: result.variant?.settings,
      port: result.variant?.port,
      updated: true,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * DELETE /api/cliproxy/:name - Delete cliproxy variant
 * Uses variant-service for proper port-specific file cleanup
 */
router.delete('/:name', (req: Request, res: Response): void => {
  try {
    const { name } = req.params;

    // Use variant-service for proper cleanup (settings, config, session files)
    const result = removeVariant(name);

    if (!result.success) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json({ name, deleted: true, port: result.variant?.port });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
