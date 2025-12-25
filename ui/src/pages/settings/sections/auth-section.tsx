/**
 * Auth Section
 * Settings section for CLIProxy auth tokens (API key and management secret)
 */

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  KeyRound,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { useRawConfig } from '../hooks';

interface TokenInfo {
  value: string;
  isCustom: boolean;
}

interface AuthTokens {
  apiKey: TokenInfo;
  managementSecret: TokenInfo;
}

export default function AuthSection() {
  const { fetchRawConfig } = useRawConfig();

  // State
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit state
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [editedApiKey, setEditedApiKey] = useState<string | null>(null);
  const [editedSecret, setEditedSecret] = useState<string | null>(null);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Fetch tokens
  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Use /raw to get unmasked values for editing
      const response = await fetch('/api/settings/auth/tokens/raw');
      if (!response.ok) {
        throw new Error('Failed to fetch auth tokens');
      }
      const data = await response.json();
      setTokens(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchTokens();
    fetchRawConfig();
  }, [fetchTokens, fetchRawConfig]);

  // Clear success after timeout
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Save all changes
  const saveChanges = async () => {
    const hasApiKeyChange = editedApiKey !== null && editedApiKey !== tokens?.apiKey.value;
    const hasSecretChange =
      editedSecret !== null && editedSecret !== tokens?.managementSecret.value;

    if (!hasApiKeyChange && !hasSecretChange) return;

    try {
      setSaving(true);
      setError(null);

      const payload: { apiKey?: string; managementSecret?: string } = {};
      if (hasApiKeyChange) payload.apiKey = editedApiKey;
      if (hasSecretChange) payload.managementSecret = editedSecret;

      const response = await fetch('/api/settings/auth/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save tokens');
      }

      setSuccess('Tokens updated. Restart CLIProxy to apply.');
      setEditedApiKey(null);
      setEditedSecret(null);
      await fetchTokens();
      await fetchRawConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Regenerate management secret
  const regenerateSecret = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch('/api/settings/auth/tokens/regenerate-secret', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate secret');
      }

      setSuccess('New management secret generated. Restart CLIProxy to apply.');
      await fetchTokens();
      await fetchRawConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch('/api/settings/auth/tokens/reset', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset tokens');
      }

      setSuccess('Tokens reset to defaults. Restart CLIProxy to apply.');
      setEditedApiKey(null);
      setEditedSecret(null);
      await fetchTokens();
      await fetchRawConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // Copy to clipboard helpers
  const copyApiKey = async () => {
    if (!tokens) return;
    await navigator.clipboard.writeText(tokens.apiKey.value);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  const copySecret = async () => {
    if (!tokens) return;
    await navigator.clipboard.writeText(tokens.managementSecret.value);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (loading || !tokens) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Display values
  const displayApiKey = editedApiKey ?? tokens.apiKey.value;
  const displaySecret = editedSecret ?? tokens.managementSecret.value;

  // Check for unsaved changes
  const hasChanges =
    (editedApiKey !== null && editedApiKey !== tokens.apiKey.value) ||
    (editedSecret !== null && editedSecret !== tokens.managementSecret.value);

  return (
    <>
      {/* Toast-style alerts */}
      <div
        className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
          error || success
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {error && (
          <Alert variant="destructive" className="py-2 shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure CLIProxy authentication tokens. Changes require CLIProxy restart.
          </p>

          {/* API Key Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="text-base font-medium">API Key</h3>
              {tokens.apiKey.isCustom && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  Custom
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Used by Claude Code to authenticate with CLIProxy
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={displayApiKey}
                  onChange={(e) => setEditedApiKey(e.target.value)}
                  placeholder="API key"
                  disabled={saving}
                  className="pr-20 font-mono text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={copyApiKey}
                    disabled={!tokens.apiKey.value}
                  >
                    {copiedApiKey ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Management Secret Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h3 className="text-base font-medium">Management Secret</h3>
              {tokens.managementSecret.isCustom && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  Custom
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Used by CCS dashboard to access CLIProxy management APIs
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={displaySecret}
                  onChange={(e) => setEditedSecret(e.target.value)}
                  placeholder="Management secret"
                  disabled={saving}
                  className="pr-20 font-mono text-sm"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={copySecret}
                    disabled={!tokens.managementSecret.value}
                  >
                    {copiedSecret ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateSecret}
                disabled={saving}
                title="Generate new secure secret"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={saving || (!tokens.apiKey.isCustom && !tokens.managementSecret.isCustom)}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Resets both API key and management secret to their default values.
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchTokens();
            fetchRawConfig();
          }}
          disabled={loading || saving}
          className="flex-1"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={saveChanges}
          disabled={!hasChanges || saving}
          className="flex-1"
        >
          <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-pulse' : ''}`} />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </>
  );
}
