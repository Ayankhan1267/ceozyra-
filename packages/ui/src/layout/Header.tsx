import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../index';
import { Avatar } from '../index';

export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  notificationsCount?: number;
  onNotificationClick?: () => void;
  user?: {
    name: string;
    avatarSrc?: string;
    initials?: string;
  };
  onUserAction?: (action: string) => void;
}

export function Header({
  className,
  title,
  searchPlaceholder = 'Search...',
  onSearch,
  notificationsCount = 0,
  onNotificationClick,
  user,
  onUserAction,
  ...props
}: HeaderProps) {
  const [searchValue, setSearchValue] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center justify-between gap-4',
        'border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 lg:px-6',
        className
      )}
      {...props}
    >
      {/* Title (mobile) */}
      {title && <h1 className="text-lg font-semibold text-slate-900 lg:hidden">{title}</h1>}

      {/* Search bar */}
      {onSearch && (
        <div className="relative flex-1 max-w-md">
          <label htmlFor="header-search" className="sr-only">
            {searchPlaceholder}
          </label>
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            id="header-search"
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className={cn(
              'h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4',
              'text-sm text-slate-900 placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
            )}
          />
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        {onNotificationClick && (
          <button
            type="button"
            onClick={onNotificationClick}
            className={cn(
              'relative rounded-lg p-2 text-slate-500',
              'hover:bg-slate-100 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
            )}
            aria-label={`Notifications${notificationsCount > 0 ? `, ${notificationsCount} unread` : ''}`}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            {notificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {notificationsCount > 9 ? '9+' : notificationsCount}
              </span>
            )}
          </button>
        )}

        {/* User dropdown */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                'flex items-center gap-2 rounded-lg p-1',
                'hover:bg-slate-100 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
              )}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <Avatar size="sm" src={user.avatarSrc} initials={user.initials} alt={user.name} />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                <div
                  className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{user.name}</p>
                  </div>
                  {['Profile', 'Settings', 'Sign out'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onUserAction?.(item.toLowerCase());
                        setUserMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
