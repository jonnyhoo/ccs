/**
 * CLIProxy Health Checks
 *
 * Check CLIProxy binary, config, OAuth providers, and port.
 */

import * as fs from 'fs';
import {
  isCLIProxyInstalled,
  getInstalledCliproxyVersion,
  getCLIProxyPath,
  getConfigPath as getCliproxyConfigPath,
  getAllAuthStatus,
  CLIPROXY_DEFAULT_PORT,
} from '../../cliproxy';
import { getPortProcess, isCLIProxyProcess } from '../../utils/port-utils';
import type { HealthCheck } from './types';

/**
 * Check CLIProxy binary installation
 */
export function checkCliproxyBinary(): HealthCheck {
  if (isCLIProxyInstalled()) {
    const version = getInstalledCliproxyVersion();
    const binaryPath = getCLIProxyPath();
    return {
      id: 'cliproxy-binary',
      name: 'CLIProxy Binary',
      status: 'ok',
      message: `v${version}`,
      details: binaryPath,
    };
  }

  return {
    id: 'cliproxy-binary',
    name: 'CLIProxy Binary',
    status: 'info',
    message: 'Not installed',
    details: 'Downloads on first use',
  };
}

/**
 * Check CLIProxy config file
 */
export function checkCliproxyConfig(): HealthCheck {
  const configPath = getCliproxyConfigPath();

  if (fs.existsSync(configPath)) {
    return {
      id: 'cliproxy-config',
      name: 'CLIProxy Config',
      status: 'ok',
      message: 'cliproxy/config.yaml',
    };
  }

  return {
    id: 'cliproxy-config',
    name: 'CLIProxy Config',
    status: 'info',
    message: 'Not created',
    details: 'Generated on first use',
  };
}

/**
 * Check OAuth providers authentication status
 */
export function checkOAuthProviders(): HealthCheck[] {
  const authStatuses = getAllAuthStatus();
  const checks: HealthCheck[] = [];

  for (const status of authStatuses) {
    const providerName = status.provider.charAt(0).toUpperCase() + status.provider.slice(1);

    if (status.authenticated) {
      const lastAuth = status.lastAuth ? status.lastAuth.toLocaleDateString() : '';
      checks.push({
        id: `oauth-${status.provider}`,
        name: `${providerName} Auth`,
        status: 'ok',
        message: 'Authenticated',
        details: lastAuth,
      });
    } else {
      checks.push({
        id: `oauth-${status.provider}`,
        name: `${providerName} Auth`,
        status: 'info',
        message: 'Not authenticated',
        fix: `Run: ccs ${status.provider} --auth`,
      });
    }
  }

  return checks;
}

/**
 * Check CLIProxy port status
 */
export async function checkCliproxyPort(): Promise<HealthCheck> {
  const portProcess = await getPortProcess(CLIPROXY_DEFAULT_PORT);

  if (!portProcess) {
    return {
      id: 'cliproxy-port',
      name: 'CLIProxy Port',
      status: 'info',
      message: `${CLIPROXY_DEFAULT_PORT} free`,
      details: 'Proxy not running',
    };
  }

  if (isCLIProxyProcess(portProcess)) {
    return {
      id: 'cliproxy-port',
      name: 'CLIProxy Port',
      status: 'ok',
      message: 'CLIProxy running',
      details: `PID ${portProcess.pid}`,
    };
  }

  return {
    id: 'cliproxy-port',
    name: 'CLIProxy Port',
    status: 'warning',
    message: `Occupied by ${portProcess.processName}`,
    details: `PID ${portProcess.pid}`,
    fix: `Kill process: kill ${portProcess.pid}`,
  };
}
