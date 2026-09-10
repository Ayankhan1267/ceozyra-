import React, { useState } from 'react';
import { cn } from '../index';
import { Sidebar, type SidebarProps } from './Sidebar';
import { Header, type HeaderProps } from './Header';

export interface DashboardShellProps extends React.HTMLAttributes<HTMLElement> {
  sidebarProps: Omit<SidebarProps, 'collapsed' | 'onToggleCollapse'>;
  headerProps: Omit<HeaderProps, 'className'>;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}

export function DashboardShell({
  className,
  sidebarProps,
  headerProps,
  children,
  defaultCollapsed = false,
  ...props
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn('flex h-screen bg-slate-50', className)} {...props}>
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative z-50">
            <Sidebar
              {...sidebarProps}
              collapsed={false}
              onToggleCollapse={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header {...headerProps}>
          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className={cn(
              'rounded-lg p-2 text-slate-500 lg:hidden',
              'hover:bg-slate-100 transition-colors'
            )}
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </Header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
