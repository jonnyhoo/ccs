import { Shield, X } from 'lucide-react';
import { useState } from 'react';
import { useSidebar } from '@/hooks/use-sidebar';

export function LocalhostDisclaimer() {
  const [dismissed, setDismissed] = useState(false);
  const { state, isMobile } = useSidebar();

  if (dismissed) return null;

  // Calculate the left margin based on sidebar state
  // When expanded: sidebar width is 16rem
  // When collapsed: sidebar width is 3rem
  // On mobile: sidebar is overlay, no margin needed
  const getLeftMargin = () => {
    if (isMobile) return '0';
    return state === 'expanded' ? '16rem' : '3rem';
  };

  return (
    <div
      className="fixed bottom-0 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 px-4 py-2 transition-all duration-200 ease-linear z-50"
      style={{
        left: getLeftMargin(),
        right: '0',
      }}
    >
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">
            This dashboard runs locally. All data stays on your machine.
          </span>
          <span className="sm:hidden">Local dashboard - data stays on your device.</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 flex-shrink-0 p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-800/30 transition-colors"
          aria-label="Dismiss disclaimer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
