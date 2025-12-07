import { Link, useLocation } from 'react-router-dom';
import { Home, Key, Zap, Users, Settings, Activity, FolderOpen } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { CcsLogo } from '@/components/ccs-logo';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/api', icon: Key, label: 'API Profiles' },
  { path: '/cliproxy', icon: Zap, label: 'CLIProxy' },
  { path: '/accounts', icon: Users, label: 'Accounts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/health', icon: Activity, label: 'Health' },
  { path: '/shared', icon: FolderOpen, label: 'Shared Data' },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <CcsLogo size="sm" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                <Link to={item.path}>
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
