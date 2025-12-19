/**
 * Proxy Routes - API endpoints for proxy configuration
 *
 * Provides REST endpoints for managing CLIProxyAPI connection settings:
 * - GET /api/proxy - Get proxy configuration
 * - PUT /api/proxy - Update proxy configuration
 * - POST /api/proxy/test - Test remote connection
 */

import { Router, Request, Response } from 'express';
import { loadOrCreateUnifiedConfig, saveUnifiedConfig } from '../../config/unified-config-loader';
import { testConnection } from '../../cliproxy/remote-proxy-client';
import { DEFAULT_PROXY_CONFIG, ProxyConfig } from '../../config/unified-config-types';

const router = Router();

/**
 * GET /api/proxy - Get proxy configuration
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await loadOrCreateUnifiedConfig();
    res.json(config.proxy || DEFAULT_PROXY_CONFIG);
  } catch (error) {
    console.error('[proxy-routes] Failed to load proxy config:', error);
    res.status(500).json({ error: 'Failed to load proxy config' });
  }
});

/**
 * PUT /api/proxy - Update proxy configuration
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const config = await loadOrCreateUnifiedConfig();
    const updates = req.body as Partial<ProxyConfig>;

    // Deep merge with defaults and current config
    config.proxy = {
      remote: {
        ...DEFAULT_PROXY_CONFIG.remote,
        ...config.proxy?.remote,
        ...updates.remote,
      },
      fallback: {
        ...DEFAULT_PROXY_CONFIG.fallback,
        ...config.proxy?.fallback,
        ...updates.fallback,
      },
      local: {
        ...DEFAULT_PROXY_CONFIG.local,
        ...config.proxy?.local,
        ...updates.local,
      },
    };

    await saveUnifiedConfig(config);
    res.json(config.proxy);
  } catch (error) {
    console.error('[proxy-routes] Failed to save proxy config:', error);
    res.status(500).json({ error: 'Failed to save proxy config' });
  }
});

/**
 * POST /api/proxy/test - Test remote proxy connection
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, port, protocol, authToken, allowSelfSigned } = req.body;

    if (!host || !port) {
      res.status(400).json({ error: 'Host and port are required' });
      return;
    }

    const status = await testConnection({
      host,
      port: typeof port === 'number' ? port : parseInt(port, 10),
      protocol: protocol || 'http',
      authToken,
      allowSelfSigned: allowSelfSigned || false,
      timeout: 5000,
    });

    res.json(status);
  } catch (error) {
    console.error('[proxy-routes] Failed to test connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

export default router;
