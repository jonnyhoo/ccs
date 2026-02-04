/**
 * Tab Navigation Component
 * Settings page tab switcher with icons
 */

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, Settings2, Server, KeyRound, Brain, Archive } from 'lucide-react';
import type { SettingsTab } from '../types';

interface TabNavigationProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs = [
  { value: 'websearch' as const, label: 'Web', icon: Globe },
  { value: 'globalenv' as const, label: 'Env', icon: Settings2 },
  { value: 'thinking' as const, label: 'Think', icon: Brain },
  { value: 'proxy' as const, label: 'Proxy', icon: Server },
  { value: 'auth' as const, label: 'Auth', icon: KeyRound },
  { value: 'backups' as const, label: 'Backup', icon: Archive },
] as const;

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as SettingsTab)}>
      <TabsList className="grid w-full grid-cols-6">
        {tabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="gap-1.5 px-1 text-xs">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
