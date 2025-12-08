/**
 * Settings Page - Deprecated
 * Settings functionality has been moved to API Profiles page
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Construction, ArrowRight } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600">
            <Construction className="w-5 h-5" />
            Page Relocated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The settings editor has been integrated into the <strong>API Profiles</strong> page for
            a better user experience.
          </p>
          <p className="text-muted-foreground">To edit environment variables for a profile:</p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-2">
            <li>Go to API Profiles page</li>
            <li>Click the actions menu (...) on any profile</li>
            <li>Select &quot;Edit Settings&quot;</li>
          </ol>
          <div className="pt-2">
            <Button asChild>
              <Link to="/api">
                Go to API Profiles
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
