'use client';

import React, { useState } from 'react';

interface SidebarLink {
  href: string;
  label: string;
  active?: boolean;
}

export interface DashboardShellProps {
  sidebarProps: {
    logo?: React.ReactNode;
    navLinks: SidebarLink[];
    user?: { name: string; email: string; initials: string };
  };
  headerProps: {
    title: string;
    subtitle?: string;
    breadcrumbs?: { label: string; href?: string; active?: boolean }[];
    actions?: React.ReactNode;
  };
  children: React.ReactNode;
}

export default function DashboardShell({
  sidebarProps,
  headerProps,
  children,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinks = sidebarProps.navLinks || [];
  const user = sidebarProps.user || { name: 'Admin', email: '', initials: 'A' };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 w-64">
            <SidebarInner
              logo={sidebarProps.logo}
              navLinks={navLinks}
              user={user}
              onClose={() => setMobileOpen(false)}
              isMobile
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className={['hidden lg:block', collapsed ? 'lg:w-16' : 'lg:w-64'].join(' ')}>
        <SidebarInner
          logo={sidebarProps.logo}
          navLinks={navLinks}
          user={user}
          onToggle={() => setCollapsed(!collapsed)}
          isMobile={false}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Open menu"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">{headerProps.title}</h1>
              {headerProps.subtitle && (
                <p className="text-sm text-slate-500">{headerProps.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {headerProps?.actions}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-medium">
              {user.initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarInner({
  logo,
  navLinks,
  user,
  onClose,
  onToggle,
  isMobile,
}: {
  logo: React.ReactNode;
  navLinks: SidebarLink[];
  user: { name: string; email: string; initials: string };
  onClose?: () => void;
  onToggle?: () => void;
  isMobile: boolean;
}) {
  return (
    <div className={['flex flex-col h-full bg-white', isMobile ? 'w-64' : 'w-64 lg:w-auto'].join(' ')}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
        <div className="font-bold text-indigo-600 text-lg">{logo}</div>
        {!isMobile && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors lg:block hidden"
            aria-label="Collapse sidebar"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        {isMobile && onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5" aria-label="Sidebar">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              link.active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            ].join(' ')}
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-medium shrink-0">
            {user.initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
