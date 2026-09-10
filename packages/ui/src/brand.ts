/**
 * ZYRA Brand Theme Configuration
 *
 * Central source of truth for brand colors, typography, and spacing tokens.
 * All UI components reference these tokens instead of hard-coded values.
 */

export const brand = {
  colors: {
    primary: '#4F46E5',    // Indigo 600
    secondary: '#7C3AED',  // Violet 600
    accent: '#06B6D4',     // Cyan 500
    success: '#10B981',    // Emerald 500
    warning: '#F59E0B',    // Amber 500
    danger: '#EF4444',     // Red 500
    background: '#FFFFFF',
    surface: '#F8FAFC',    // Slate 50
    text: '#0F172A',       // Slate 900
    muted: '#64748B',      // Slate 500
    border: '#E2E8F0',     // Slate 200
  },
  fonts: {
    heading: "'Plus Jakarta Sans', 'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },
};

export type Brand = typeof brand;
export type BrandColors = typeof brand.colors;
export type BrandFonts = typeof brand.fonts;
export type BrandRadius = typeof brand.radius;
