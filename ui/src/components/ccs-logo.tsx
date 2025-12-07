import { cn } from '@/lib/utils';

interface CcsLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: 24,
  md: 32,
  lg: 48,
};

export function CcsLogo({ size = 'md', className, showText = true }: CcsLogoProps) {
  const dimension = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src="/logo/ccs-logo-256.png"
        alt="CCS Logo"
        width={dimension}
        height={dimension}
        className="rounded"
      />
      {showText && <span className="font-bold text-lg">CCS Config</span>}
    </div>
  );
}
