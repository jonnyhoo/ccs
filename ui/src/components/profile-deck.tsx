import { useProfiles } from '@/hooks/use-profiles';
import { ProfileCard } from './profile-card';
import { Skeleton } from '@/components/ui/skeleton';

export function ProfileDeck() {
  const { data: response, isLoading, error } = useProfiles();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-sm">Failed to load profiles: {error.message}</div>;
  }

  const profiles = response?.profiles || [];

  if (!profiles || profiles.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-8">
        No profiles configured. Create your first profile to get started.
      </div>
    );
  }

  // Mock data for demonstration
  const mockProfiles = profiles.map((profile, index: number) => ({
    ...profile,
    configured: profile.configured ?? false, // Ensure configured is always boolean
    isActive: index === 0, // First profile is active
    lastUsed: index === 0 ? '2 hours ago' : index === 1 ? '1 day ago' : undefined,
    model: index === 0 ? 'claude-3.5-sonnet' : index === 1 ? 'claude-3-haiku' : undefined,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Profiles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProfiles.map((profile) => (
          <ProfileCard
            key={profile.name}
            profile={profile}
            onSwitch={() => console.log('Switch to', profile.name)}
            onConfig={() => console.log('Config', profile.name)}
            onTest={() => console.log('Test', profile.name)}
          />
        ))}
      </div>
    </div>
  );
}
