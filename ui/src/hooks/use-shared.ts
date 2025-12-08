import { useQuery } from '@tanstack/react-query';

interface SharedItem {
  name: string;
  description: string;
  path: string;
  type: 'command' | 'skill' | 'agent';
}

interface SharedSummary {
  commands: number;
  skills: number;
  agents: number;
  total: number;
  symlinkStatus: { valid: boolean; message: string };
}

export function useSharedSummary() {
  return useQuery<SharedSummary>({
    queryKey: ['shared', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/shared/summary');
      return res.json();
    },
  });
}

export function useSharedItems(type: 'commands' | 'skills' | 'agents') {
  return useQuery<{ items: SharedItem[] }>({
    queryKey: ['shared', type],
    queryFn: async () => {
      const res = await fetch(`/api/shared/${type}`);
      return res.json();
    },
  });
}
