/**
 * React Query hooks for accounts (profiles.json)
 * Phase 03: REST API Routes & CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.accounts.list(),
  });
}

export function useSetDefaultAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.accounts.setDefault(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Default account set to "${name}"`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
