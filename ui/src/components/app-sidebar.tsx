import { Link, useLocation } from 'react-router-dom';
import { Home, Key, Zap, Users, Settings, Activity, FolderOpen, ChevronRight } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { CcsLogo } from '@/components/ccs-logo';
import { useSidebar } from '@/hooks/use-sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Define navigation groups
const navGroups = [
  {
    title: 'General',
    items: [{ path: '/', icon: Home, label: 'Home' }],
  },
  {
    title: 'Identity & Access',
    items: [
      { path: '/api', icon: Key, label: 'API Profiles' },
      { path: '/cliproxy', icon: Zap, label: 'CLIProxy' },
      {
        path: '/accounts',
        icon: Users,
        label: 'Accounts',
        isCollapsible: true,
        children: [
          { path: '/accounts', label: 'All Accounts' },
          { path: '/shared', icon: FolderOpen, label: 'Shared Data' },
        ],
      },
    ],
  },
  {
    title: 'System',
    items: [
      { path: '/health', icon: Activity, label: 'Health' },
      { path: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();

  // Helper to check if a route is active (including sub-routes if needed)
  const isRouteActive = (path: string) => location.pathname === path;

  // Helper to check if a group/parent should be open based on active child
  const isParentActive = (children: { path: string }[]) => {
    return children.some((child) => isRouteActive(child.path));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 flex items-center justify-center">
        <CcsLogo size="sm" showText={state === 'expanded'} />
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.title || index}>
            {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    {item.isCollapsible && item.children ? (
                      <Collapsible
                        defaultOpen={isParentActive(item.children) || isRouteActive(item.path)}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.label}>
                              {item.icon && <item.icon className="w-4 h-4" />}
                              <span className="group-data-[collapsible=icon]:hidden">
                                {item.label}
                              </span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.path}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isRouteActive(child.path)}
                                  >
                                    <Link to={child.path}>
                                      <span>{child.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    ) : (
                      <SidebarMenuButton
                        asChild
                        isActive={isRouteActive(item.path)}
                        tooltip={item.label}
                      >
                        <Link to={item.path}>
                          {item.icon && <item.icon className="w-4 h-4" />}
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t flex items-center justify-center">
        <SidebarTrigger />
      </SidebarFooter>
    </Sidebar>
  );
}
