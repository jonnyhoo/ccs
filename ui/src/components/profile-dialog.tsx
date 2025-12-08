/**
 * Profile Dialog Component
 * Phase 03: REST API Routes & CRUD
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateProfile, useUpdateProfile } from '@/hooks/use-profiles';
import type { Profile } from '@/lib/api-client';

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, 'Invalid profile name'),
  baseUrl: z.string().url('Invalid URL'),
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
  model: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile?: Profile | null;
}

export function ProfileDialog({ open, onClose, profile }: ProfileDialogProps) {
  const createMutation = useCreateProfile();
  const updateMutation = useUpdateProfile();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: profile
      ? {
          name: profile.name,
          baseUrl: '',
          apiKey: '',
          model: '',
        }
      : undefined,
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (profile) {
        // Update mode
        await updateMutation.mutateAsync({
          name: profile.name,
          data: {
            baseUrl: data.baseUrl,
            apiKey: data.apiKey,
            model: data.model,
          },
        });
      } else {
        // Create mode
        await createMutation.mutateAsync(data);
      }
      reset();
      onClose();
    } catch (error) {
      // Error is handled by the mutation hooks
      console.error('Failed to save profile:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit Profile' : 'Create API Profile'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} placeholder="my-api" disabled={!!profile} />
            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
          </div>

          <div>
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input id="baseUrl" {...register('baseUrl')} placeholder="https://api.example.com" />
            {errors.baseUrl && (
              <span className="text-xs text-red-500">{errors.baseUrl.message}</span>
            )}
          </div>

          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <Input id="apiKey" type="password" {...register('apiKey')} />
            {errors.apiKey && <span className="text-xs text-red-500">{errors.apiKey.message}</span>}
          </div>

          <div>
            <Label htmlFor="model">Model (optional)</Label>
            <Input id="model" {...register('model')} placeholder="claude-sonnet-4-5-20250929" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : profile
                  ? 'Update'
                  : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
