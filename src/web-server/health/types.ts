/**
 * Health Check Types
 *
 * Core interfaces for the health check system.
 */

export interface HealthCheck {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error' | 'info';
  message: string;
  details?: string;
  fix?: string;
  fixable?: boolean;
}

export interface HealthGroup {
  id: string;
  name: string;
  icon: string;
  checks: HealthCheck[];
}

export interface HealthReport {
  timestamp: number;
  version: string;
  groups: HealthGroup[];
  checks: HealthCheck[]; // Flat list for backward compatibility
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
    info: number;
  };
}
