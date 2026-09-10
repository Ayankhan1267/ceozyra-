'use client';

import { useState } from 'react';
import Logo from './Logo';

const links = [
  { label: 'Platform', href: '#platform' },
  { label: 'Storefront', href: '#storefront' },
  { label: 'Agents', href: '#agents' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-xl font-bold tracking-tight text-slate-900">ZYRA</span>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="https://admin.ceozyra.com"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Admin Login
          </a>
          <a
            href="/storefront/demo"
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Live Storefront
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-label="Toggle navigation menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-slate-700"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <a
                href="https://admin.ceozyra.com"
                className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700"
              >
                Admin Login
              </a>
              <a
                href="/storefront/demo"
                className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Live Storefront
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
