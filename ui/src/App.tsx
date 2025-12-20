import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/query-client';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { PrivacyProvider } from '@/contexts/privacy-context';
import { Layout } from '@/components/layout/layout';

// Eager load: HomePage (initial route)
import { HomePage } from '@/pages';

// Lazy load: heavy pages with charts or complex dependencies
const AnalyticsPage = lazy(() =>
  import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage }))
);
const ApiPage = lazy(() => import('@/pages/api').then((m) => ({ default: m.ApiPage })));
const CliproxyPage = lazy(() =>
  import('@/pages/cliproxy').then((m) => ({ default: m.CliproxyPage }))
);
const CliproxyControlPanelPage = lazy(() =>
  import('@/pages/cliproxy-control-panel').then((m) => ({ default: m.CliproxyControlPanelPage }))
);
const CopilotPage = lazy(() => import('@/pages/copilot').then((m) => ({ default: m.CopilotPage })));
const AccountsPage = lazy(() =>
  import('@/pages/accounts').then((m) => ({ default: m.AccountsPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/settings').then((m) => ({ default: m.SettingsPage }))
);
const HealthPage = lazy(() => import('@/pages/health').then((m) => ({ default: m.HealthPage })));
const SharedPage = lazy(() => import('@/pages/shared').then((m) => ({ default: m.SharedPage })));

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <PrivacyProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/api" element={<ApiPage />} />
                <Route path="/cliproxy" element={<CliproxyPage />} />
                <Route path="/cliproxy/control-panel" element={<CliproxyControlPanelPage />} />
                <Route path="/copilot" element={<CopilotPage />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/health" element={<HealthPage />} />
                <Route path="/shared" element={<SharedPage />} />
              </Route>
            </Routes>
            <Toaster position="top-right" />
          </BrowserRouter>
        </PrivacyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
