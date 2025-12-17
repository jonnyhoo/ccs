/**
 * Provider Logo Component
 * Uses actual provider logos with fallback to styled letters
 */

import { cn } from '@/lib/utils';

interface ProviderLogoProps {
  provider: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Provider image assets mapping */
const PROVIDER_IMAGES: Record<string, string> = {
  gemini: '/assets/providers/gemini-color.svg',
  codex: '/assets/providers/openai.svg',
  agy: '/assets/providers/agy.png',
  qwen: '/assets/providers/qwen-color.svg',
  iflow: '/assets/providers/iflow.png',
};

/** Provider color configuration (for fallback only - no background for image logos) */
const PROVIDER_CONFIG: Record<string, { text: string; letter: string }> = {
  gemini: { text: 'text-blue-600', letter: 'G' },
  claude: { text: 'text-orange-600', letter: 'C' },
  codex: { text: 'text-emerald-600', letter: 'X' },
  agy: { text: 'text-violet-600', letter: 'A' },
  qwen: { text: 'text-cyan-600', letter: 'Q' },
  iflow: { text: 'text-indigo-600', letter: 'i' },
};

/** Size configuration */
const SIZE_CONFIG = {
  sm: { container: 'w-6 h-6', icon: 'w-4 h-4', text: 'text-xs' },
  md: { container: 'w-8 h-8', icon: 'w-5 h-5', text: 'text-sm' },
  lg: { container: 'w-12 h-12', icon: 'w-8 h-8', text: 'text-lg' },
};

export function ProviderLogo({ provider, className, size = 'md' }: ProviderLogoProps) {
  const providerKey = provider.toLowerCase();
  const config = PROVIDER_CONFIG[providerKey] || {
    text: 'text-gray-600',
    letter: provider[0]?.toUpperCase() || '?',
  };
  const sizeConfig = SIZE_CONFIG[size];
  const imageSrc = PROVIDER_IMAGES[providerKey];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md',
        imageSrc && 'bg-white p-1',
        sizeConfig.container,
        className
      )}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={`${provider} logo`}
          className={cn(sizeConfig.icon, 'object-contain')}
        />
      ) : (
        <span className={cn('font-semibold', config.text, sizeConfig.text)}>{config.letter}</span>
      )}
    </div>
  );
}

/** Inline variant for use in text */
export function ProviderLogoInline({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  return <ProviderLogo provider={provider} size="sm" className={className} />;
}
