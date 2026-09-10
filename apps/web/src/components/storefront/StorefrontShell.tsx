'use client';

import { ReactNode } from 'react';
import StorefrontTheme from './StorefrontTheme';

export interface StoreData {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  theme?: Record<string, unknown>;
  seoTitle?: string;
  seoDescription?: string;
  socialLinks?: Record<string, string>;
  contactEmail?: string;
}

interface Props {
  store: StoreData;
  children: ReactNode;
}

export default function StorefrontShell({ store, children }: Props) {
  return (
    <>
      <StorefrontTheme theme={store.theme as Record<string, unknown> ?? {}} />
      <div
        className="sf-shell min-h-screen flex flex-col"
        style={{
          fontFamily: 'var(--sf-font)',
          color: 'var(--sf-text)',
          backgroundColor: 'var(--sf-bg)',
        }}
        data-store={store.slug}
      >
        {children}
      </div>
    </>
  );
}
