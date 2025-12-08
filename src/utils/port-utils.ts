/**
 * Port utilities for detecting process ownership
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PortProcess {
  pid: number;
  processName: string;
  commandLine?: string;
}

/**
 * Get process information for a port
 * @param port Port number to check
 * @returns Process info or null if port is free
 */
export async function getPortProcess(port: number): Promise<PortProcess | null> {
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      return await getPortProcessWindows(port);
    } else {
      return await getPortProcessUnix(port);
    }
  } catch {
    // If detection fails, return null (assume port is free)
    return null;
  }
}

/**
 * Unix/Linux/macOS implementation using lsof
 */
async function getPortProcessUnix(port: number): Promise<PortProcess | null> {
  try {
    const { stdout } = await execAsync(`lsof -i :${port} -sTCP:LISTEN -t -F pcn`, {
      timeout: 3000,
    });

    if (!stdout.trim()) {
      return null; // Port free
    }

    // Parse lsof -F output:
    // p<pid>
    // c<command>
    // n<network>
    const lines = stdout.trim().split('\n');
    let pid: number | null = null;
    let processName: string | null = null;

    for (const line of lines) {
      if (line.startsWith('p')) {
        pid = parseInt(line.substring(1), 10);
      } else if (line.startsWith('c')) {
        processName = line.substring(1);
      }
    }

    if (pid && processName) {
      return { pid, processName };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Windows implementation using netstat
 */
async function getPortProcessWindows(port: number): Promise<PortProcess | null> {
  try {
    // netstat -ano finds PID, then tasklist gets process name
    const { stdout: netstatOut } = await execAsync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { timeout: 3000 }
    );

    if (!netstatOut.trim()) {
      return null; // Port free
    }

    // Parse netstat output to get PID (last column)
    const match = netstatOut.match(/\\s+(\d+)\\s*$/m);
    if (!match) {
      return null;
    }

    const pid = parseInt(match[1], 10);

    // Get process name from PID
    const { stdout: tasklistOut } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH`, {
      timeout: 3000,
    });

    const taskMatch = tasklistOut.match(/^([^\\s]+)/);
    const processName = taskMatch ? taskMatch[1] : `PID-${pid}`;

    return { pid, processName };
  } catch {
    return null;
  }
}

/**
 * Check if process is CLIProxy
 */
export function isCLIProxyProcess(process: PortProcess | null): boolean {
  if (!process) {
    return false;
  }

  // Match cli-proxy, cli-proxy.exe, cliproxy, cliproxy.exe, cli-proxy-api
  const name = process.processName.toLowerCase();
  return [
    'cli-proxy',
    'cli-proxy.exe',
    'cliproxy',
    'cliproxy.exe',
    'cli-proxy-api',
    'cli-proxy-api.exe',
  ].includes(name);
}
