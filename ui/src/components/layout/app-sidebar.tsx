import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Key,
  Zap,
  Users,
  Settings,
  Activity,
  FolderOpen,
  ChevronRight,
  BarChart3,
  Gauge,
  Github,
} from 'lucide-react';
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
import { CcsLogo } from '@/components/shared/ccs-logo';
import { useSidebar } from '@/hooks/use-sidebar';
import { useCliproxyUpdateCheck } from '@/hooks/use-cliproxy';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Define navigation groups
const navGroups = [
  {
    title: 'General',
    items: [
      { path: '/', icon: Home, label: 'Home' },
      { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    title: 'Identity & Access',
    items: [
      {
        path: '/providers',
        icon: Key,
        label: 'API Profiles',
        badge: { text: 'OpenRouter', icon: '/icons/openrouter.svg' },
      },
      {
        path: '/cliproxy',
        icon: Zap,
        label: 'CLIProxy Plus',
        isCollapsible: true,
        children: [
          { path: '/cliproxy', label: 'Overview' },
          { path: '/cliproxy/control-panel', icon: Gauge, label: 'Control Panel' },
        ],
      },
      { path: '/copilot', icon: Github, label: 'GitHub Copilot' },
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
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { data: updateCheck } = useCliproxyUpdateCheck();

  // Dynamic label for CLIProxy based on backend
  const cliproxyLabel = updateCheck?.backendLabel ?? 'CLIProxy';

  // Helper to get dynamic label (for CLIProxy route)
  const getItemLabel = (item: { path: string; label: string }) => {
    if (item.path === '/cliproxy') {
      return cliproxyLabel;
    }
    return item.label;
  };

  // Helper to check if a route is active (exact match)
  const isRouteActive = (path: string) => location.pathname === path;

  // Helper to check if a group/parent should be open based on active child
  // Also handles sub-routes (e.g., /cliproxy/control-panel matches /cliproxy)
  const isParentActive = (children: { path: string }[]) => {
    return children.some(
      (child) => isRouteActive(child.path) || location.pathname.startsWith(child.path + '/')
    );
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
                          {/* Click navigates to overview AND opens submenu */}
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={getItemLabel(item)}
                              isActive={isParentActive(item.children)}
                              onClick={() => navigate(item.path)}
                            >
                              {item.icon && <item.icon className="w-4 h-4" />}
                              <span className="group-data-[collapsible=icon]:hidden">
                                {getItemLabel(item)}
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
                        tooltip={getItemLabel(item)}
                      >
                        <Link to={item.path}>
                          {item.icon && <item.icon className="w-4 h-4" />}
                          <span className="group-data-[collapsible=icon]:hidden flex-1">
                            {getItemLabel(item)}
                          </span>
                          {item.badge && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className={`group-data-[collapsible=icon]:hidden ml-auto flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
                                    isRouteActive(item.path)
                                      ? 'bg-sidebar-accent-foreground/20 text-sidebar-accent-foreground border border-sidebar-accent-foreground/30'
                                      : 'bg-accent/15 text-accent border border-accent/30 group-hover/menu-item:bg-sidebar-accent-foreground/20 group-hover/menu-item:text-sidebar-accent-foreground group-hover/menu-item:border-sidebar-accent-foreground/30'
                                  }`}
                                >
                                  <img src={item.badge.icon} alt="" className="w-3 h-3" />
                                  <span className="hidden sm:inline">{item.badge.text}</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>349+ models via OpenRouter</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
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
