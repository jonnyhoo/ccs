/**
 * Thinking Config Hook
 * Manages thinking budget configuration with direct API calls
 * Includes W4 optimistic locking via lastModified timestamps
 */

import { useCallback, useState, useRef } from 'react';
import type { ThinkingConfig, ThinkingMode } from '../types';

const DEFAULT_THINKING_CONFIG: ThinkingConfig = {
  mode: 'auto',
  tier_defaults: {
    opus: 'high',
    sonnet: 'medium',
    haiku: 'low',
  },
  show_warnings: true,
};

const FETCH_TIMEOUT = 10000; // 10 second timeout

export function useThinkingConfig() {
  const [config, setConfig] = useState<ThinkingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // W4: Track lastModified for optimistic locking
  const lastModifiedRef = useRef<number | undefined>(undefined);

  const fetchConfig = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/thinking', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Failed to load Thinking config');
      const data = await res.json();
      setConfig(data.config || DEFAULT_THINKING_CONFIG);
      // W4: Store lastModified for optimistic locking
      lastModifiedRef.current = data.lastModified;
    } catch (err) {
      clearTimeout(timeoutId);
      if ((err as Error).name === 'AbortError') {
        setError('Request timeout - please try again');
      } else {
        setError((err as Error).message);
      }
      setConfig(DEFAULT_THINKING_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(
    async (updates: Partial<ThinkingConfig>) => {
      const currentConfig = config || DEFAULT_THINKING_CONFIG;
      const optimisticConfig = { ...currentConfig, ...updates };
      setConfig(optimisticConfig);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      try {
        setSaving(true);
        setError(null);

        // W4: Include lastModified for optimistic locking
        const payload = {
          ...optimisticConfig,
          lastModified: lastModifiedRef.current,
        };

        const res = await fetch('/api/thinking', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const data = await res.json();
          // W4: Handle conflict (409) with user-friendly message
          if (res.status === 409) {
            throw new Error('Config changed by another session. Refreshing...');
          }
          throw new Error(data.error || 'Failed to save');
        }

        const data = await res.json();
        setConfig(data.config);
        // W4: Update lastModified after successful save
        lastModifiedRef.current = data.lastModified;
        setSuccess(true);
        setTimeout(() => setSuccess(false), 1500);
      } catch (err) {
        clearTimeout(timeoutId);
        setConfig(currentConfig);
        if ((err as Error).name === 'AbortError') {
          setError('Request timeout - please try again');
        } else {
          setError((err as Error).message);
          // W4: On conflict, auto-refresh to get latest
          if ((err as Error).message.includes('another session')) {
            setTimeout(() => fetchConfig(), 1000);
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [config, fetchConfig]
  );

  const setMode = useCallback(
    (mode: ThinkingMode) => {
      saveConfig({ mode });
    },
    [saveConfig]
  );

  const setTierDefault = useCallback(
    (tier: 'opus' | 'sonnet' | 'haiku', value: string) => {
      const currentDefaults = config?.tier_defaults || DEFAULT_THINKING_CONFIG.tier_defaults;
      saveConfig({
        tier_defaults: { ...currentDefaults, [tier]: value },
      });
    },
    [config, saveConfig]
  );

  const setShowWarnings = useCallback(
    (show: boolean) => {
      saveConfig({ show_warnings: show });
    },
    [saveConfig]
  );

  const setManualOverride = useCallback(
    (value: string | number | undefined) => {
      saveConfig({ mode: 'manual', override: value });
    },
    [saveConfig]
  );

  return {
    config: config || DEFAULT_THINKING_CONFIG,
    loading,
    saving,
    error,
    success,
    fetchConfig,
    saveConfig,
    setMode,
    setTierDefault,
    setShowWarnings,
    setManualOverride,
  };
}
