import { useQuery } from '@tanstack/react-query';

interface Overview {
  profiles: number;
  cliproxy: number;
  accounts: number;
  health: {
    status: 'ok' | 'warning' | 'error';
    passed: number;
    total: number;
  };
}

export function useOverview() {
  return useQuery<Overview>({
    queryKey: ['overview'],
    queryFn: async () => {
      const res = await fetch('/api/overview');
      return res.json();
    },
  });
}
