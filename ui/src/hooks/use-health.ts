import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface HealthCheck {
  id: string;
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  fixable?: boolean;
}

interface HealthReport {
  timestamp: number;
  checks: HealthCheck[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    errors: number;
  };
}

export function useHealth() {
  return useQuery<HealthReport>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      return res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30s
  });
}

export function useFixHealth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (checkId: string) => {
      const res = await fetch(`/api/health/fix/${checkId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      return data;
    },
    onSuccess: (data: { message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
