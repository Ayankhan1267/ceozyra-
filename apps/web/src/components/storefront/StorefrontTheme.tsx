'use client';

import { useEffect } from 'react';

export interface StoreTheme {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  textMutedColor?: string;
  borderColor?: string;
  fontFamily?: string;
  headingFontFamily?: string;
  borderRadius?: string;
  buttonRadius?: string;
  logoUrl?: string;
  faviconUrl?: string;
  customCss?: string;
}

interface Props {
  theme: StoreTheme;
}

const DEFAULT_THEME: StoreTheme = {
  primaryColor: '#4F46E5',
  secondaryColor: '#7C3AED',
  accentColor: '#F59E0B',
  backgroundColor: '#ffffff',
  surfaceColor: '#F9FAFB',
  textColor: '#111827',
  textMutedColor: '#6B7280',
  borderColor: '#E5E7EB',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  borderRadius: '8px',
  buttonRadius: '8px',
};

export default function StorefrontTheme({ theme = {} }: { theme: StoreTheme }) {
  const resolved = { ...DEFAULT_THEME, ...theme };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sf-primary', resolved.primaryColor ?? '');
    root.style.setProperty('--sf-secondary', resolved.secondaryColor ?? '');
    root.style.setProperty('--sf-accent', resolved.accentColor ?? '');
    root.style.setProperty('--sf-bg', resolved.backgroundColor ?? '');
    root.style.setProperty('--sf-surface', resolved.surfaceColor ?? '');
    root.style.setProperty('--sf-text', resolved.textColor ?? '');
    root.style.setProperty('--sf-text-muted', resolved.textMutedColor ?? '');
    root.style.setProperty('--sf-border', resolved.borderColor ?? '');
    root.style.setProperty('--sf-font', resolved.fontFamily ?? '');
    root.style.setProperty('--sf-heading-font', resolved.headingFontFamily ?? '');
    root.style.setProperty('--sf-radius', resolved.borderRadius ?? '');
    root.style.setProperty('--sf-btn-radius', resolved.buttonRadius ?? '');

    if (resolved.logoUrl) {
      let link = document.getElementById('sf-favicon') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = 'sf-favicon';
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = resolved.logoUrl;
    }

    if (resolved.customCss) {
      let style = document.getElementById('sf-custom-css') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = 'sf-custom-css';
        document.head.appendChild(style);
      }
      style.textContent = resolved.customCss;
    }
  }, [resolved]);

  return null;
}
