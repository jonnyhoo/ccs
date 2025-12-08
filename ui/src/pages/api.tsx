/**
 * API Profiles Page
 * Phase 03: REST API Routes & CRUD
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ProfilesTable } from '@/components/profiles-table';
import { ProfileDialog } from '@/components/profile-dialog';
import { SettingsDialog } from '@/components/settings-dialog';
import { useProfiles } from '@/hooks/use-profiles';
import type { Profile } from '@/lib/api-client';

export function ApiPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsProfileName, setSettingsProfileName] = useState<string | null>(null);
  const { data, isLoading } = useProfiles();

  const handleEditSettings = (profile: Profile) => {
    setSettingsProfileName(profile.name);
    setSettingsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProfile(null);
  };

  const handleCloseSettingsDialog = () => {
    setSettingsDialogOpen(false);
    setSettingsProfileName(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage custom API profiles for Claude CLI
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Profile
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading profiles...</div>
      ) : (
        <ProfilesTable data={data?.profiles || []} onEditSettings={handleEditSettings} />
      )}

      <ProfileDialog open={dialogOpen} onClose={handleCloseDialog} profile={editingProfile} />
      <SettingsDialog
        open={settingsDialogOpen}
        onClose={handleCloseSettingsDialog}
        profileName={settingsProfileName}
      />
    </div>
  );
}
