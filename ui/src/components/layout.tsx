import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { GitHubLink } from '@/components/github-link';
import { ConnectionIndicator } from '@/components/connection-indicator';
import { LocalhostDisclaimer } from '@/components/localhost-disclaimer';
import { Skeleton } from '@/components/ui/skeleton';

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background">
        <header className="flex h-14 items-center justify-between px-6 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="font-semibold text-lg tracking-tight">CCS Config</div>
          <div className="flex items-center gap-2">
            <ConnectionIndicator />
            <GitHubLink />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-auto min-h-0">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
        <LocalhostDisclaimer />
      </main>
    </SidebarProvider>
  );
}
