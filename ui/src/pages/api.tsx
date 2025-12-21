/**
 * API Profiles Page - Master-Detail Layout
 * Comprehensive profile management with inline editing
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Server,
  FileJson,
  RefreshCw,
} from 'lucide-react';
import { ProfileEditor } from '@/components/profile-editor';
import { ProfileCreateDialog } from '@/components/profiles/profile-create-dialog';
import { OpenRouterBanner } from '@/components/profiles/openrouter-banner';
import { OpenRouterQuickStart } from '@/components/profiles/openrouter-quick-start';
import { OpenRouterPromoCard } from '@/components/profiles/openrouter-promo-card';
import { useProfiles, useDeleteProfile } from '@/hooks/use-profiles';
import { useOpenRouterModels } from '@/hooks/use-openrouter-models';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import type { Profile } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/ui/copy-button';

export function ApiPage() {
  const { data, isLoading, isError, refetch } = useProfiles();
  const deleteMutation = useDeleteProfile();
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'normal' | 'openrouter'>('normal');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Prefetch OpenRouter models when page loads (lazy - won't block render)
  useOpenRouterModels();

  // Memoize profiles to maintain stable reference
  const profiles = useMemo(() => data?.profiles || [], [data?.profiles]);

  // Filter profiles by search
  const filteredProfiles = useMemo(
    () => profiles.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [profiles, searchQuery]
  );

  // selectedProfile is null by default - user must click to select
  // This allows OpenRouterQuickStart to show as the default right panel
  const selectedProfileData = selectedProfile
    ? profiles.find((p) => p.name === selectedProfile)
    : null;

  // Handle profile deletion
  const handleDelete = (name: string) => {
    deleteMutation.mutate(name, {
      onSuccess: () => {
        if (selectedProfile === name) {
          setSelectedProfile(null);
        }
        setDeleteConfirm(null);
      },
    });
  };

  // Handle create success
  const handleCreateSuccess = (name: string) => {
    setCreateDialogOpen(false);
    setSelectedProfile(name);
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* OpenRouter Announcement Banner */}
      <OpenRouterBanner onCreateClick={() => setCreateDialogOpen(true)} />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Profiles List */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          {/* Header */}
          <div className="p-4 border-b bg-background">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                <h1 className="font-semibold">API Profiles</h1>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setCreateDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search profiles..."
                className="pl-8 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Profile List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading profiles...</div>
            ) : isError ? (
              <div className="p-4 text-center">
                <div className="space-y-3 py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-destructive/50" />
                  <div>
                    <p className="text-sm font-medium">Failed to load profiles</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unable to fetch API profiles. Please try again.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-4 text-center">
                {profiles.length === 0 ? (
                  <div className="space-y-3 py-8">
                    <FileJson className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium">No API profiles yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Create your first profile to connect to custom API endpoints
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Profile
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    No profiles match "{searchQuery}"
                  </p>
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredProfiles.map((profile) => (
                  <ProfileListItem
                    key={profile.name}
                    profile={profile}
                    isSelected={selectedProfile === profile.name}
                    onSelect={() => {
                      setSelectedProfile(profile.name);
                    }}
                    onDelete={() => setDeleteConfirm(profile.name)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer Stats */}
          {profiles.length > 0 && (
            <div className="p-3 border-t bg-background text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>
                  {profiles.length} profile{profiles.length !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  {profiles.filter((p) => p.configured).length} configured
                </span>
              </div>
            </div>
          )}

          {/* OpenRouter Promo - always visible */}
          <OpenRouterPromoCard
            onCreateClick={() => {
              setCreateMode('openrouter');
              setCreateDialogOpen(true);
            }}
          />
        </div>

        {/* Right Panel - Editor or QuickStart */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedProfileData ? (
            <ProfileEditor
              profileName={selectedProfileData.name}
              onDelete={() => setDeleteConfirm(selectedProfileData.name)}
            />
          ) : (
            <OpenRouterQuickStart
              onOpenRouterClick={() => {
                setCreateMode('openrouter');
                setCreateDialogOpen(true);
              }}
              onCustomClick={() => {
                setCreateMode('normal');
                setCreateDialogOpen(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <ProfileCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
        initialMode={createMode}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Profile"
        description={`Are you sure you want to delete "${deleteConfirm}"? This will remove the settings file and cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

/** Profile list item component */
function ProfileListItem({
  profile,
  isSelected,
  onSelect,
  onDelete,
}: {
  profile: Profile;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-colors',
        isSelected
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-muted border border-transparent'
      )}
      onClick={onSelect}
    >
      {/* Status indicator */}
      {profile.configured ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
      )}

      {/* Profile info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{profile.name}</div>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="text-xs text-muted-foreground truncate flex-1">
            {profile.settingsPath}
          </div>
          <CopyButton
            value={profile.settingsPath}
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </div>

      {/* Actions */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  );
}
