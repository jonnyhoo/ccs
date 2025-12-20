/**
 * Settings Page - WebSearch, Global Env & Proxy Configuration
 * Supports Gemini CLI and Grok CLI providers + Global Environment Variables + Proxy Settings
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Copy,
  Check,
  GripVertical,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Settings2,
  Plus,
  Trash2,
  Server,
  Laptop,
  Cloud,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { CodeEditor } from '@/components/shared/code-editor';
import { api } from '@/lib/api-client';
import type { CliproxyServerConfig, RemoteProxyStatus } from '@/lib/api-client';

interface ProviderConfig {
  enabled?: boolean;
  model?: string;
  timeout?: number;
}

interface WebSearchProvidersConfig {
  gemini?: ProviderConfig;
  grok?: ProviderConfig;
  opencode?: ProviderConfig;
}

interface WebSearchConfig {
  enabled: boolean;
  providers?: WebSearchProvidersConfig;
}

interface CliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

interface WebSearchStatus {
  geminiCli: CliStatus;
  grokCli: CliStatus;
  opencodeCli: CliStatus;
  readiness: {
    status: 'ready' | 'unavailable';
    message: string;
  };
}

interface GlobalEnvConfig {
  enabled: boolean;
  env: Record<string, string>;
}

export function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'globalenv' ? 'globalenv' : tabParam === 'proxy' ? 'proxy' : 'websearch';
  const [activeTab, setActiveTab] = useState<'websearch' | 'globalenv' | 'proxy'>(initialTab);
  const [config, setConfig] = useState<WebSearchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [status, setStatus] = useState<WebSearchStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  // Config viewer state
  const [rawConfig, setRawConfig] = useState<string | null>(null);
  const [rawConfigLoading, setRawConfigLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // Local model input state (to avoid saving on every keystroke)
  const [geminiModelInput, setGeminiModelInput] = useState('');
  const [opencodeModelInput, setOpencodeModelInput] = useState('');
  // Collapsible install hints state
  const [showGeminiHint, setShowGeminiHint] = useState(false);
  const [showOpencodeHint, setShowOpencodeHint] = useState(false);
  const [showGrokHint, setShowGrokHint] = useState(false);
  // Global Env state
  const [globalEnvConfig, setGlobalEnvConfig] = useState<GlobalEnvConfig | null>(null);
  const [globalEnvLoading, setGlobalEnvLoading] = useState(true);
  const [globalEnvSaving, setGlobalEnvSaving] = useState(false);
  const [globalEnvError, setGlobalEnvError] = useState<string | null>(null);
  const [globalEnvSuccess, setGlobalEnvSuccess] = useState(false);
  // New env var inputs
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  // Proxy state
  const [proxyConfig, setCliproxyServerConfig] = useState<CliproxyServerConfig | null>(null);
  const [proxyLoading, setProxyLoading] = useState(true);
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);
  const [proxySuccess, setProxySuccess] = useState(false);
  const [testResult, setTestResult] = useState<RemoteProxyStatus | null>(null);
  const [testing, setTesting] = useState(false);

  // Load config and status on mount
  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchRawConfig();
    fetchGlobalEnvConfig();
    fetchCliproxyServerConfig();
  }, []);

  // Sync local model inputs when config changes
  useEffect(() => {
    if (config) {
      setGeminiModelInput(config.providers?.gemini?.model ?? 'gemini-2.5-flash');
      setOpencodeModelInput(config.providers?.opencode?.model ?? 'opencode/grok-code');
    }
  }, [config]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/websearch');
      if (!res.ok) throw new Error('Failed to load WebSearch config');
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      setStatusLoading(true);
      const res = await fetch('/api/websearch/status');
      if (!res.ok) throw new Error('Failed to load status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch WebSearch status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchRawConfig = async () => {
    try {
      setRawConfigLoading(true);
      const res = await fetch('/api/config/raw');
      if (!res.ok) {
        setRawConfig(null);
        return;
      }
      const text = await res.text();
      setRawConfig(text);
    } catch (err) {
      console.error('Failed to fetch raw config:', err);
      setRawConfig(null);
    } finally {
      setRawConfigLoading(false);
    }
  };

  const fetchGlobalEnvConfig = async () => {
    try {
      setGlobalEnvLoading(true);
      setGlobalEnvError(null);
      const res = await fetch('/api/global-env');
      if (!res.ok) throw new Error('Failed to load Global Env config');
      const data = await res.json();
      setGlobalEnvConfig(data);
    } catch (err) {
      setGlobalEnvError((err as Error).message);
    } finally {
      setGlobalEnvLoading(false);
    }
  };

  const fetchCliproxyServerConfig = async () => {
    try {
      setProxyLoading(true);
      setProxyError(null);
      const data = await api.cliproxyServer.get();
      setCliproxyServerConfig(data);
    } catch (err) {
      setProxyError((err as Error).message);
    } finally {
      setProxyLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!rawConfig) return;
    try {
      await navigator.clipboard.writeText(rawConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Toggle Gemini provider
  const toggleGemini = () => {
    const providers = config?.providers || {};
    const currentState = providers.gemini?.enabled ?? false;
    const grokState = providers.grok?.enabled ?? false;
    const opencodeState = providers.opencode?.enabled ?? false;

    saveConfig({
      enabled: !currentState || grokState || opencodeState, // Enable WebSearch if any provider is enabled
      providers: {
        ...providers,
        gemini: {
          ...providers.gemini,
          enabled: !currentState,
        },
      },
    });
  };

  const saveConfig = async (updates: Partial<WebSearchConfig>) => {
    if (!config) return;

    // Optimistic update - apply changes immediately to local state
    const optimisticConfig = { ...config, ...updates };
    setConfig(optimisticConfig);

    try {
      setSaving(true);
      setError(null);

      const res = await fetch('/api/websearch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimisticConfig),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setConfig(data.websearch);
      // Quick flash of success (shorter duration, less intrusive)
      setSuccess(true);
      setTimeout(() => setSuccess(false), 1500);
      // Silently refresh raw config without loading state
      fetch('/api/config/raw')
        .then((r) => (r.ok ? r.text() : null))
        .then((text) => text && setRawConfig(text))
        .catch(() => {});
    } catch (err) {
      // Revert optimistic update on error
      setConfig(config);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isGeminiEnabled = config?.providers?.gemini?.enabled ?? false;
  const isGrokEnabled = config?.providers?.grok?.enabled ?? false;
  const isOpenCodeEnabled = config?.providers?.opencode?.enabled ?? false;

  // Toggle Grok provider
  const toggleGrok = () => {
    const providers = config?.providers || {};
    const currentState = providers.grok?.enabled ?? false;

    saveConfig({
      enabled: isGeminiEnabled || !currentState || isOpenCodeEnabled, // Enable WebSearch if any provider is enabled
      providers: {
        ...providers,
        grok: {
          ...providers.grok,
          enabled: !currentState,
        },
      },
    });
  };

  // Toggle OpenCode provider
  const toggleOpenCode = () => {
    const providers = config?.providers || {};
    const currentState = providers.opencode?.enabled ?? false;

    saveConfig({
      enabled: isGeminiEnabled || isGrokEnabled || !currentState, // Enable WebSearch if any provider is enabled
      providers: {
        ...providers,
        opencode: {
          ...providers.opencode,
          enabled: !currentState,
        },
      },
    });
  };

  // Save Gemini model on blur (only if changed)
  const saveGeminiModel = () => {
    const currentModel = config?.providers?.gemini?.model ?? 'gemini-2.5-flash';
    if (geminiModelInput !== currentModel) {
      const providers = config?.providers || {};
      saveConfig({
        providers: {
          ...providers,
          gemini: {
            ...providers.gemini,
            model: geminiModelInput,
          },
        },
      });
    }
  };

  // Save OpenCode model on blur (only if changed)
  const saveOpencodeModel = () => {
    const currentModel = config?.providers?.opencode?.model ?? 'opencode/grok-code';
    if (opencodeModelInput !== currentModel) {
      const providers = config?.providers || {};
      saveConfig({
        providers: {
          ...providers,
          opencode: {
            ...providers.opencode,
            model: opencodeModelInput,
          },
        },
      });
    }
  };

  // Global Env functions
  const saveGlobalEnvConfig = async (updates: Partial<GlobalEnvConfig>) => {
    if (!globalEnvConfig) return;

    // Optimistic update
    const optimisticConfig = { ...globalEnvConfig, ...updates };
    setGlobalEnvConfig(optimisticConfig);

    try {
      setGlobalEnvSaving(true);
      setGlobalEnvError(null);

      const res = await fetch('/api/global-env', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimisticConfig),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      const data = await res.json();
      setGlobalEnvConfig(data.config);
      setGlobalEnvSuccess(true);
      setTimeout(() => setGlobalEnvSuccess(false), 1500);
      // Silently refresh raw config
      fetch('/api/config/raw')
        .then((r) => (r.ok ? r.text() : null))
        .then((text) => text && setRawConfig(text))
        .catch(() => {});
    } catch (err) {
      setGlobalEnvConfig(globalEnvConfig);
      setGlobalEnvError((err as Error).message);
    } finally {
      setGlobalEnvSaving(false);
    }
  };

  const toggleGlobalEnv = () => {
    saveGlobalEnvConfig({ enabled: !globalEnvConfig?.enabled });
  };

  const addEnvVar = () => {
    if (!newEnvKey.trim() || !globalEnvConfig) return;
    const newEnv = { ...globalEnvConfig.env, [newEnvKey.trim()]: newEnvValue };
    saveGlobalEnvConfig({ env: newEnv });
    setNewEnvKey('');
    setNewEnvValue('');
  };

  const removeEnvVar = (key: string) => {
    if (!globalEnvConfig) return;
    const newEnv = { ...globalEnvConfig.env };
    delete newEnv[key];
    saveGlobalEnvConfig({ env: newEnv });
  };

  const updateEnvValue = (key: string, value: string) => {
    if (!globalEnvConfig) return;
    const newEnv = { ...globalEnvConfig.env, [key]: value };
    saveGlobalEnvConfig({ env: newEnv });
  };

  // Proxy functions
  const saveCliproxyServerConfig = async (updates: Partial<CliproxyServerConfig>) => {
    if (!proxyConfig) return;

    // Optimistic update
    const optimisticConfig = {
      remote: { ...proxyConfig.remote, ...updates.remote },
      fallback: { ...proxyConfig.fallback, ...updates.fallback },
      local: { ...proxyConfig.local, ...updates.local },
    };
    setCliproxyServerConfig(optimisticConfig);
    setTestResult(null); // Clear previous test result on config change

    try {
      setProxySaving(true);
      setProxyError(null);

      const data = await api.cliproxyServer.update(updates);
      setCliproxyServerConfig(data);
      setProxySuccess(true);
      setTimeout(() => setProxySuccess(false), 1500);
      // Silently refresh raw config
      fetch('/api/config/raw')
        .then((r) => (r.ok ? r.text() : null))
        .then((text) => text && setRawConfig(text))
        .catch(() => {});
    } catch (err) {
      setCliproxyServerConfig(proxyConfig);
      setProxyError((err as Error).message);
    } finally {
      setProxySaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!proxyConfig) return;

    const { host, port, protocol, auth_token } = proxyConfig.remote;
    if (!host) {
      setProxyError('Host is required');
      return;
    }

    try {
      setTesting(true);
      setProxyError(null);
      setTestResult(null);

      const result = await api.cliproxyServer.test({
        host,
        port: port || undefined, // Empty/0 means use protocol default
        protocol,
        authToken: auth_token || undefined,
      });
      setTestResult(result);
    } catch (err) {
      setProxyError((err as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-100px)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-lg">Loading configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)]">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel - Settings Controls */}
        <Panel defaultSize={40} minSize={30} maxSize={55}>
          <div className="h-full border-r flex flex-col bg-muted/30 relative">
            {/* Header with Tabs */}
            <div className="p-5 border-b bg-background">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as 'websearch' | 'globalenv' | 'proxy')}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="websearch" className="flex-1 gap-2">
                    <Globe className="w-4 h-4" />
                    WebSearch
                  </TabsTrigger>
                  <TabsTrigger value="globalenv" className="flex-1 gap-2">
                    <Settings2 className="w-4 h-4" />
                    Global Env
                  </TabsTrigger>
                  <TabsTrigger value="proxy" className="flex-1 gap-2">
                    <Server className="w-4 h-4" />
                    Proxy
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Tab Content */}
            {activeTab === 'websearch' ? (
              <WebSearchContent
                config={config}
                status={status}
                statusLoading={statusLoading}
                saving={saving}
                error={error}
                success={success}
                isGeminiEnabled={isGeminiEnabled}
                isGrokEnabled={isGrokEnabled}
                isOpenCodeEnabled={isOpenCodeEnabled}
                geminiModelInput={geminiModelInput}
                opencodeModelInput={opencodeModelInput}
                showGeminiHint={showGeminiHint}
                showOpencodeHint={showOpencodeHint}
                showGrokHint={showGrokHint}
                setGeminiModelInput={setGeminiModelInput}
                setOpencodeModelInput={setOpencodeModelInput}
                setShowGeminiHint={setShowGeminiHint}
                setShowOpencodeHint={setShowOpencodeHint}
                setShowGrokHint={setShowGrokHint}
                toggleGemini={toggleGemini}
                toggleGrok={toggleGrok}
                toggleOpenCode={toggleOpenCode}
                saveGeminiModel={saveGeminiModel}
                saveOpencodeModel={saveOpencodeModel}
                fetchStatus={fetchStatus}
                fetchConfig={fetchConfig}
                fetchRawConfig={fetchRawConfig}
                loading={loading}
              />
            ) : activeTab === 'globalenv' ? (
              <GlobalEnvContent
                config={globalEnvConfig}
                loading={globalEnvLoading}
                saving={globalEnvSaving}
                error={globalEnvError}
                success={globalEnvSuccess}
                newEnvKey={newEnvKey}
                newEnvValue={newEnvValue}
                setNewEnvKey={setNewEnvKey}
                setNewEnvValue={setNewEnvValue}
                toggleGlobalEnv={toggleGlobalEnv}
                addEnvVar={addEnvVar}
                removeEnvVar={removeEnvVar}
                updateEnvValue={updateEnvValue}
                fetchGlobalEnvConfig={fetchGlobalEnvConfig}
                fetchRawConfig={fetchRawConfig}
              />
            ) : (
              <ProxyContent
                config={proxyConfig}
                loading={proxyLoading}
                saving={proxySaving}
                error={proxyError}
                success={proxySuccess}
                testResult={testResult}
                testing={testing}
                saveCliproxyServerConfig={saveCliproxyServerConfig}
                handleTestConnection={handleTestConnection}
                fetchCliproxyServerConfig={fetchCliproxyServerConfig}
                fetchRawConfig={fetchRawConfig}
              />
            )}
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-2 bg-border hover:bg-primary/20 transition-colors cursor-col-resize flex items-center justify-center group">
          <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
        </PanelResizeHandle>

        {/* Right Panel - Config Viewer */}
        <Panel defaultSize={60} minSize={35}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCode className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="font-semibold">config.yaml</h2>
                  <p className="text-sm text-muted-foreground">~/.ccs/config.yaml</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!rawConfig}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRawConfig}
                  disabled={rawConfigLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${rawConfigLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Config Content - scrollable */}
            <div className="flex-1 overflow-auto">
              {rawConfigLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : rawConfig ? (
                <CodeEditor
                  value={rawConfig}
                  onChange={() => {}}
                  language="yaml"
                  readonly
                  minHeight="auto"
                  className="min-h-full"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <FileCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Config file not found</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded mt-2 inline-block">
                      ccs migrate
                    </code>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

// WebSearch Tab Content Component
interface WebSearchContentProps {
  config: WebSearchConfig | null;
  status: WebSearchStatus | null;
  statusLoading: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
  isGeminiEnabled: boolean;
  isGrokEnabled: boolean;
  isOpenCodeEnabled: boolean;
  geminiModelInput: string;
  opencodeModelInput: string;
  showGeminiHint: boolean;
  showOpencodeHint: boolean;
  showGrokHint: boolean;
  setGeminiModelInput: (v: string) => void;
  setOpencodeModelInput: (v: string) => void;
  setShowGeminiHint: (v: boolean) => void;
  setShowOpencodeHint: (v: boolean) => void;
  setShowGrokHint: (v: boolean) => void;
  toggleGemini: () => void;
  toggleGrok: () => void;
  toggleOpenCode: () => void;
  saveGeminiModel: () => void;
  saveOpencodeModel: () => void;
  fetchStatus: () => void;
  fetchConfig: () => void;
  fetchRawConfig: () => void;
  loading: boolean;
}

function WebSearchContent({
  status,
  statusLoading,
  saving,
  error,
  success,
  isGeminiEnabled,
  isGrokEnabled,
  isOpenCodeEnabled,
  geminiModelInput,
  opencodeModelInput,
  showGeminiHint,
  showOpencodeHint,
  showGrokHint,
  setGeminiModelInput,
  setOpencodeModelInput,
  setShowGeminiHint,
  setShowOpencodeHint,
  setShowGrokHint,
  toggleGemini,
  toggleGrok,
  toggleOpenCode,
  saveGeminiModel,
  saveOpencodeModel,
  fetchStatus,
  fetchConfig,
  fetchRawConfig,
  loading,
}: WebSearchContentProps) {
  return (
    <>
      {/* Toast-style alerts - absolute positioned, no layout shift */}
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
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            CLI-based web search for third-party profiles (gemini, codex, agy, etc.)
          </p>

          {/* Status Summary */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">
                {isGeminiEnabled ? 'WebSearch enabled' : 'WebSearch disabled'}
              </p>
              {statusLoading ? (
                <p className="text-sm text-muted-foreground">Checking status...</p>
              ) : status?.readiness ? (
                <p className="text-sm text-muted-foreground">{status.readiness.message}</p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchStatus} disabled={statusLoading}>
              <RefreshCw className={`w-4 h-4 ${statusLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* CLI Providers */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Providers</h3>

            {/* Gemini CLI Provider */}
            <div
              className={`rounded-lg border transition-colors ${
                isGeminiEnabled ? 'border-primary border-l-4' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Terminal
                    className={`w-5 h-5 ${isGeminiEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">gemini</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                        FREE
                      </span>
                      {status?.geminiCli?.installed ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                          installed
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                          not installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Google Gemini CLI (1000 req/day free)
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isGeminiEnabled}
                  onCheckedChange={toggleGemini}
                  disabled={saving || !status?.geminiCli?.installed}
                />
              </div>
              {/* Model input when enabled */}
              {isGeminiEnabled && (
                <div className="px-4 pb-4 pt-0">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      Model:
                    </label>
                    <Input
                      value={geminiModelInput}
                      onChange={(e) => setGeminiModelInput(e.target.value)}
                      onBlur={saveGeminiModel}
                      placeholder="gemini-2.5-flash"
                      className="h-8 text-sm font-mono"
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
              {/* Installation hint when not installed - inside card */}
              {!status?.geminiCli?.installed && !statusLoading && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50">
                  <button
                    onClick={() => setShowGeminiHint(!showGeminiHint)}
                    className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:underline w-full py-2"
                  >
                    {showGeminiHint ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    How to install Gemini CLI
                  </button>
                  {showGeminiHint && (
                    <div className="mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-sm">
                      <p className="text-amber-700 dark:text-amber-300 mb-2">
                        Install globally (FREE tier available):
                      </p>
                      <code className="text-sm bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded font-mono block mb-2">
                        npm install -g @google/gemini-cli
                      </code>
                      <a
                        href="https://github.com/google-gemini/gemini-cli"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View documentation
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* OpenCode CLI Provider */}
            <div
              className={`rounded-lg border transition-colors ${
                isOpenCodeEnabled ? 'border-primary border-l-4' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Terminal
                    className={`w-5 h-5 ${isOpenCodeEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">opencode</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                        FREE
                      </span>
                      {status?.opencodeCli?.installed ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                          installed
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                          not installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">OpenCode (web search via Zen)</p>
                  </div>
                </div>
                <Switch
                  checked={isOpenCodeEnabled}
                  onCheckedChange={toggleOpenCode}
                  disabled={saving || !status?.opencodeCli?.installed}
                />
              </div>
              {/* Model input when enabled */}
              {isOpenCodeEnabled && (
                <div className="px-4 pb-4 pt-0">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      Model:
                    </label>
                    <Input
                      value={opencodeModelInput}
                      onChange={(e) => setOpencodeModelInput(e.target.value)}
                      onBlur={saveOpencodeModel}
                      placeholder="opencode/grok-code"
                      className="h-8 text-sm font-mono"
                      disabled={saving}
                    />
                  </div>
                </div>
              )}
              {/* Installation hint when not installed - inside card */}
              {!status?.opencodeCli?.installed && !statusLoading && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50">
                  <button
                    onClick={() => setShowOpencodeHint(!showOpencodeHint)}
                    className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline w-full py-2"
                  >
                    {showOpencodeHint ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    How to install OpenCode
                  </button>
                  {showOpencodeHint && (
                    <div className="mt-2 p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 text-sm">
                      <p className="text-purple-700 dark:text-purple-300 mb-2">
                        Install globally (FREE tier available):
                      </p>
                      <code className="text-sm bg-purple-100 dark:bg-purple-900/40 px-2 py-1 rounded font-mono block mb-2">
                        curl -fsSL https://opencode.ai/install | bash
                      </code>
                      <a
                        href="https://github.com/sst/opencode"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-700 dark:text-purple-300 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View documentation
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Grok CLI Provider */}
            <div
              className={`rounded-lg border transition-colors ${
                isGrokEnabled ? 'border-primary border-l-4' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Terminal
                    className={`w-5 h-5 ${isGrokEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-medium">grok</p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">
                        GROK_API_KEY
                      </span>
                      {status?.grokCli?.installed ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                          installed
                        </span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-medium">
                          not installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">xAI Grok CLI (web + X search)</p>
                  </div>
                </div>
                <Switch
                  checked={isGrokEnabled}
                  onCheckedChange={toggleGrok}
                  disabled={saving || !status?.grokCli?.installed}
                />
              </div>
              {/* Installation hint when not installed - inside card */}
              {!status?.grokCli?.installed && !statusLoading && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50">
                  <button
                    onClick={() => setShowGrokHint(!showGrokHint)}
                    className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline w-full py-2"
                  >
                    {showGrokHint ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    How to install Grok CLI
                  </button>
                  {showGrokHint && (
                    <div className="mt-2 p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-sm">
                      <p className="text-blue-700 dark:text-blue-300 mb-2">
                        Install globally (requires xAI API key):
                      </p>
                      <code className="text-sm bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded font-mono block mb-2">
                        npm install -g @vibe-kit/grok-cli
                      </code>
                      <a
                        href="https://github.com/superagent-ai/grok-cli"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View documentation
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchConfig();
            fetchRawConfig();
          }}
          disabled={loading || saving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </>
  );
}

// Global Env Tab Content Component
interface GlobalEnvContentProps {
  config: GlobalEnvConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
  newEnvKey: string;
  newEnvValue: string;
  setNewEnvKey: (v: string) => void;
  setNewEnvValue: (v: string) => void;
  toggleGlobalEnv: () => void;
  addEnvVar: () => void;
  removeEnvVar: (key: string) => void;
  updateEnvValue: (key: string, value: string) => void;
  fetchGlobalEnvConfig: () => void;
  fetchRawConfig: () => void;
}

function GlobalEnvContent({
  config,
  loading,
  saving,
  error,
  success,
  newEnvKey,
  newEnvValue,
  setNewEnvKey,
  setNewEnvValue,
  toggleGlobalEnv,
  addEnvVar,
  removeEnvVar,
  fetchGlobalEnvConfig,
  fetchRawConfig,
}: GlobalEnvContentProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

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
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            Environment variables injected into all non-Claude subscription profiles (gemini, codex,
            agy, copilot, etc.)
          </p>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">
                {config?.enabled ? 'Global Env enabled' : 'Global Env disabled'}
              </p>
              <p className="text-sm text-muted-foreground">
                {config?.enabled
                  ? 'Env vars will be injected into third-party profiles'
                  : 'Env vars will not be injected'}
              </p>
            </div>
            <Switch checked={config?.enabled ?? true} onCheckedChange={toggleGlobalEnv} />
          </div>

          {/* Current Environment Variables */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Environment Variables</h3>

            {config?.env && Object.keys(config.env).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(config.env).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-background"
                  >
                    <code className="flex-1 font-mono text-sm truncate">{key}</code>
                    <span className="text-muted-foreground">=</span>
                    <code className="font-mono text-sm px-2 py-1 bg-muted rounded">{value}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEnvVar(key)}
                      disabled={saving}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
                <p>No environment variables configured</p>
              </div>
            )}

            {/* Add New Variable */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium mb-3">Add New Variable</h4>
              <div className="flex gap-2">
                <Input
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                  placeholder="KEY_NAME"
                  className="flex-1 font-mono text-sm h-9"
                  disabled={saving}
                />
                <span className="flex items-center text-muted-foreground">=</span>
                <Input
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="value"
                  className="flex-1 font-mono text-sm h-9"
                  disabled={saving}
                />
                <Button
                  size="sm"
                  onClick={addEnvVar}
                  disabled={saving || !newEnvKey.trim()}
                  className="h-9"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Common Variables Quick Add */}
            <div className="p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium mb-3">Quick Add Common Variables</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'DISABLE_BUG_COMMAND', value: '1' },
                  { key: 'DISABLE_ERROR_REPORTING', value: '1' },
                  { key: 'DISABLE_TELEMETRY', value: '1' },
                ].map(
                  ({ key, value }) =>
                    !config?.env?.[key] && (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewEnvKey(key);
                          setNewEnvValue(value);
                        }}
                        className="text-xs font-mono"
                      >
                        + {key}
                      </Button>
                    )
                )}
                {config?.env &&
                  ['DISABLE_BUG_COMMAND', 'DISABLE_ERROR_REPORTING', 'DISABLE_TELEMETRY'].every(
                    (k) => config.env[k]
                  ) && (
                    <span className="text-sm text-muted-foreground">
                      All common variables are configured
                    </span>
                  )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchGlobalEnvConfig();
            fetchRawConfig();
          }}
          disabled={loading || saving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </>
  );
}

// Proxy Tab Content Component
interface ProxyContentProps {
  config: CliproxyServerConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  success: boolean;
  testResult: RemoteProxyStatus | null;
  testing: boolean;
  saveCliproxyServerConfig: (updates: Partial<CliproxyServerConfig>) => void;
  handleTestConnection: () => void;
  fetchCliproxyServerConfig: () => void;
  fetchRawConfig: () => void;
}

function ProxyContent({
  config,
  loading,
  saving,
  error,
  success,
  testResult,
  testing,
  saveCliproxyServerConfig,
  handleTestConnection,
  fetchCliproxyServerConfig,
  fetchRawConfig,
}: ProxyContentProps) {
  // Default configs for fallback
  const defaultRemote = {
    enabled: false,
    host: '',
    port: undefined as number | undefined,
    protocol: 'http' as const,
    auth_token: '',
  };
  const defaultFallback = { enabled: true, auto_start: true };
  const defaultLocal = { port: 8317, auto_start: true };

  // Helper to get default port based on protocol
  const getDefaultPort = (protocol: 'http' | 'https') => (protocol === 'https' ? 443 : 80);

  // Sync local state with config (using refs to avoid lint warnings)
  const hostInput = config?.remote.host ?? '';
  // Show empty string for port if undefined (will use protocol default)
  const portInput = config?.remote.port !== undefined ? config.remote.port.toString() : '';
  const authTokenInput = config?.remote.auth_token ?? '';
  const localPortInput = (config?.local.port ?? 8317).toString();

  // Track edited values separately
  const [editedHost, setEditedHost] = useState<string | null>(null);
  const [editedPort, setEditedPort] = useState<string | null>(null);
  const [editedAuthToken, setEditedAuthToken] = useState<string | null>(null);
  const [editedLocalPort, setEditedLocalPort] = useState<string | null>(null);

  // Get display values (edited or from config)
  const displayHost = editedHost ?? hostInput;
  const displayPort = editedPort ?? portInput;
  const displayAuthToken = editedAuthToken ?? authTokenInput;
  const displayLocalPort = editedLocalPort ?? localPortInput;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const isRemoteMode = config?.remote.enabled ?? false;
  const remoteConfig = config?.remote ?? defaultRemote;
  const fallbackConfig = config?.fallback ?? defaultFallback;
  const localConfig = config?.local ?? defaultLocal;

  // Save functions for blur events
  const saveHost = () => {
    const value = editedHost ?? displayHost;
    if (value !== config?.remote.host) {
      saveCliproxyServerConfig({ remote: { ...remoteConfig, host: value } });
    }
    setEditedHost(null);
  };

  const savePort = () => {
    const portStr = editedPort ?? displayPort;
    // Empty string means use protocol default (undefined)
    const port = portStr === '' ? undefined : parseInt(portStr, 10);
    const effectivePort = port && !isNaN(port) && port > 0 ? port : undefined;

    if (effectivePort !== config?.remote.port) {
      saveCliproxyServerConfig({ remote: { ...remoteConfig, port: effectivePort } });
    }
    setEditedPort(null);
  };

  const saveAuthToken = () => {
    const value = editedAuthToken ?? displayAuthToken;
    if (value !== config?.remote.auth_token) {
      saveCliproxyServerConfig({ remote: { ...remoteConfig, auth_token: value } });
    }
    setEditedAuthToken(null);
  };

  const saveLocalPort = () => {
    const port = parseInt(editedLocalPort ?? displayLocalPort, 10);
    if (!isNaN(port) && port !== config?.local.port) {
      saveCliproxyServerConfig({ local: { ...localConfig, port } });
    }
    setEditedLocalPort(null);
  };

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
            <span className="text-sm font-medium">Saved</span>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-6">
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            Configure local or remote CLIProxyAPI connection for proxy-based profiles
          </p>

          {/* Mode Toggle - Card based selection */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Connection Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Local Mode Card */}
              <button
                onClick={() =>
                  saveCliproxyServerConfig({ remote: { ...remoteConfig, enabled: false } })
                }
                disabled={saving}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  !isRemoteMode
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Laptop
                    className={`w-5 h-5 ${!isRemoteMode ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="font-medium">Local</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Run CLIProxyAPI binary on this machine
                </p>
              </button>

              {/* Remote Mode Card */}
              <button
                onClick={() =>
                  saveCliproxyServerConfig({ remote: { ...remoteConfig, enabled: true } })
                }
                disabled={saving}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isRemoteMode
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Cloud
                    className={`w-5 h-5 ${isRemoteMode ? 'text-primary' : 'text-muted-foreground'}`}
                  />
                  <span className="font-medium">Remote</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Connect to a remote CLIProxyAPI server
                </p>
              </button>
            </div>
          </div>

          {/* Remote Settings - Show when remote mode is enabled */}
          {isRemoteMode && (
            <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Remote Server Configuration
              </h4>

              {/* Host */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Host</label>
                <Input
                  value={displayHost}
                  onChange={(e) => setEditedHost(e.target.value)}
                  onBlur={saveHost}
                  placeholder="192.168.1.100 or proxy.example.com"
                  className="font-mono"
                  disabled={saving}
                />
              </div>

              {/* Port and Protocol */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">
                    Port{' '}
                    <span className="text-xs opacity-70">
                      (default: {getDefaultPort(config?.remote.protocol || 'http')})
                    </span>
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={displayPort}
                    onChange={(e) => setEditedPort(e.target.value.replace(/\D/g, ''))}
                    onBlur={savePort}
                    placeholder={`Leave empty for ${getDefaultPort(config?.remote.protocol || 'http')}`}
                    className="font-mono"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">Protocol</label>
                  <Select
                    value={config?.remote.protocol || 'http'}
                    onValueChange={(value: 'http' | 'https') =>
                      saveCliproxyServerConfig({ remote: { ...remoteConfig, protocol: value } })
                    }
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="http">HTTP</SelectItem>
                      <SelectItem value="https">HTTPS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Auth Token */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Auth Token (optional)</label>
                <Input
                  type="password"
                  value={displayAuthToken}
                  onChange={(e) => setEditedAuthToken(e.target.value)}
                  onBlur={saveAuthToken}
                  placeholder="Bearer token for authentication"
                  className="font-mono"
                  disabled={saving}
                />
              </div>

              {/* Test Connection */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || !displayHost}
                  variant="outline"
                  className="w-full"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={`p-3 rounded-md ${
                      testResult.reachable
                        ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-900/50'
                        : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {testResult.reachable ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-300">
                            Connected ({testResult.latencyMs}ms)
                          </span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span className="text-sm font-medium text-red-700 dark:text-red-300">
                            {testResult.error || 'Connection failed'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fallback Settings */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Fallback Settings</h3>
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              {/* Enable Fallback */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Enable fallback to local</p>
                  <p className="text-xs text-muted-foreground">
                    Use local proxy if remote is unreachable
                  </p>
                </div>
                <Switch
                  checked={config?.fallback.enabled ?? true}
                  onCheckedChange={(checked) =>
                    saveCliproxyServerConfig({ fallback: { ...fallbackConfig, enabled: checked } })
                  }
                  disabled={saving || !isRemoteMode}
                />
              </div>

              {/* Auto-start on fallback */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Auto-start local proxy</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically start local proxy on fallback
                  </p>
                </div>
                <Switch
                  checked={config?.fallback.auto_start ?? false}
                  onCheckedChange={(checked) =>
                    saveCliproxyServerConfig({
                      fallback: { ...fallbackConfig, auto_start: checked },
                    })
                  }
                  disabled={saving || !isRemoteMode || !config?.fallback.enabled}
                />
              </div>
            </div>
          </div>

          {/* Local Proxy Settings */}
          <div className="space-y-3">
            <h3 className="text-base font-medium">Local Proxy</h3>
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              {/* Port */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Port</label>
                <Input
                  type="number"
                  value={displayLocalPort}
                  onChange={(e) => setEditedLocalPort(e.target.value)}
                  onBlur={saveLocalPort}
                  placeholder="8317"
                  className="font-mono max-w-32"
                  disabled={saving}
                />
              </div>

              {/* Auto-start */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Auto-start</p>
                  <p className="text-xs text-muted-foreground">
                    Start local proxy automatically when needed
                  </p>
                </div>
                <Switch
                  checked={config?.local.auto_start ?? true}
                  onCheckedChange={(checked) =>
                    saveCliproxyServerConfig({ local: { ...localConfig, auto_start: checked } })
                  }
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchCliproxyServerConfig();
            fetchRawConfig();
          }}
          disabled={loading || saving}
          className="w-full"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </>
  );
}
