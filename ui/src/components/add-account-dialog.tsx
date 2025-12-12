/**
 * Add Account Dialog Component
 * Triggers OAuth flow server-side to add another account to a provider
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, User } from 'lucide-react';
import { useStartAuth } from '@/hooks/use-cliproxy';

interface AddAccountDialogProps {
  open: boolean;
  onClose: () => void;
  provider: string;
  displayName: string;
}

export function AddAccountDialog({ open, onClose, provider, displayName }: AddAccountDialogProps) {
  const [nickname, setNickname] = useState('');
  const startAuthMutation = useStartAuth();

  const handleStartAuth = () => {
    startAuthMutation.mutate(
      { provider, nickname: nickname.trim() || undefined },
      {
        onSuccess: () => {
          setNickname('');
          onClose();
        },
      }
    );
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !startAuthMutation.isPending) {
      setNickname('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add {displayName} Account</DialogTitle>
          <DialogDescription>
            Click the button below to authenticate a new account. A browser window will open for
            OAuth.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname (optional)</Label>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g., work, personal"
                disabled={startAuthMutation.isPending}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A friendly name to identify this account. Auto-generated from email if left empty.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={startAuthMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleStartAuth} disabled={startAuthMutation.isPending}>
              {startAuthMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Authenticate
                </>
              )}
            </Button>
          </div>

          {startAuthMutation.isPending && (
            <p className="text-sm text-center text-muted-foreground">
              Complete the OAuth flow in your browser...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
