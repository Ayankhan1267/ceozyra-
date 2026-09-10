import React from 'react';
import { cn } from '../index';
import { Avatar } from '../index';
import { Button } from '../index';

export interface NavLink {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  logo: React.ReactNode;
  navLinks: NavLink[];
  user?: {
    name: string;
    email: string;
    avatarSrc?: string;
    initials?: string;
  };
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  className,
  logo,
  navLinks,
  user,
  collapsed = false,
  onToggleCollapse,
  ...props
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      {...props}
    >
      {/* Logo area */}
      <div className={cn('flex items-center h-14 px-4 border-b border-slate-100', collapsed && 'justify-center px-0')}>
        {collapsed ? (
          <span className="text-lg font-bold text-indigo-600">{logo}</span>
        ) : (
          <div className="flex items-center gap-2">{logo}</div>
        )}
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2" aria-label="Sidebar">
        <ul className="space-y-0.5">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  link.active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
                aria-current={link.active ? 'page' : undefined}
              >
                {link.icon && <span className="shrink-0">{link.icon}</span>}
                {!collapsed && <span>{link.label}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-100 px-2 py-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            'flex w-full items-center justify-center rounded-lg py-2 text-slate-400',
            'hover:bg-slate-50 hover:text-slate-600 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={cn('h-5 w-5 transition-transform duration-300', collapsed && 'rotate-180')}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* User profile section */}
      {user && (
        <div className={cn('border-t border-slate-200 p-3', collapsed && 'flex justify-center px-0')}>
          {collapsed ? (
            <Avatar size="md" initials={user.initials} alt={user.name} />
          ) : (
            <div className="flex items-center gap-3">
              <Avatar size="sm" src={user.avatarSrc} initials={user.initials} alt={user.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
