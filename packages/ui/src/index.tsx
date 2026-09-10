import React, { useState, useCallback, useRef, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cva, type VariantProps } from 'class-variance-authority';

// ─── Utility ──────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Button ───────────────────────────────────────────────────

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-700 hover:to-violet-700',
        outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-100',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 py-2',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

// ─── Card ─────────────────────────────────────────────────────

const cardVariants = cva(
  'rounded-xl border border-slate-200 bg-white shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-slate-200',
        elevated: 'border-0 shadow-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, className }))} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg font-semibold text-slate-900', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-slate-500', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

// ─── Input ────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

// ─── Label ────────────────────────────────────────────────────

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-sm font-medium text-slate-700', className)}
      {...props}
    />
  );
}

// ─── Badge ────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-indigo-100 text-indigo-700',
        success: 'bg-emerald-100 text-emerald-700',
        warning: 'bg-amber-100 text-amber-700',
        danger: 'bg-red-100 text-red-700',
        neutral: 'bg-slate-100 text-slate-700',
        info: 'bg-sky-100 text-sky-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

// ─── Avatar ───────────────────────────────────────────────────

const avatarVariants = cva(
  'flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-medium select-none',
  {
    variants: {
      size: {
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-12 w-12 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

export interface AvatarProps
  extends React.ImgHTMLAttributes<HTMLImageElement>,
    VariantProps<typeof avatarVariants> {
  initials?: string;
  fallbackClassName?: string;
}

export function Avatar({ className, size, src, alt, initials, fallbackClassName, ...props }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || 'Avatar'}
        className={cn(avatarVariants({ size, className }), 'object-cover')}
        {...props}
      />
    );
  }

  const displayInitials = initials || alt?.slice(0, 2).toUpperCase() || '?';

  return (
    <span
      className={cn(avatarVariants({ size, className }), fallbackClassName)}
      aria-label={alt ? `Avatar for ${alt}` : 'Avatar'}
      role="img"
      {...props}
    >
      {displayInitials}
    </span>
  );
}

// ─── Separator ────────────────────────────────────────────────

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'shrink-0 bg-slate-200',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className
      )}
      {...props}
    />
  );
}

// ─── Switch ───────────────────────────────────────────────────

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Switch({ className, label, id, ...props }: SwitchProps) {
  const switchId = id || `switch-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <label htmlFor={switchId} className={cn('inline-flex items-center gap-2 cursor-pointer', className)}>
      <span className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full bg-slate-200 transition-colors duration-200 ease-in-out has-[:checked]:bg-indigo-600">
        <span className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out translate-x-0.5 mt-0.5 has-[:checked]:translate-x-4" />
        <input
          type="checkbox"
          id={switchId}
          className="sr-only"
          {...props}
        />
      </span>
      {label && <span className="text-sm text-slate-700 select-none">{label}</span>}
    </label>
  );
}

// ─── Textarea ─────────────────────────────────────────────────

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

// ─── Select ───────────────────────────────────────────────────

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ className, options, placeholder, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 appearance-none',
        'bg-[url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748B%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22m6 9 6 6 6-6%22/%3E%3C/svg%3E")] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ─── Dropdown Menu ────────────────────────────────────────────

export interface DropdownMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  trigger: React.ReactNode;
  align?: 'start' | 'end';
}

export function DropdownMenu({ className, trigger, align = 'end', children, ...props }: DropdownMenuProps) {
  return (
    <div className={cn('relative inline-block text-left', className)} {...props}>
      <DropdownRoot trigger={trigger} align={align}>
        {children}
      </DropdownRoot>
    </div>
  );
}

interface DropdownRootProps {
  trigger: React.ReactNode;
  align: 'start' | 'end';
  children: React.ReactNode;
}

function DropdownRoot({ trigger, align, children }: DropdownRootProps) {
  return (
    <details className="group relative">
      <summary className="list-none cursor-pointer flex items-center">{trigger}</summary>
      <div
        className={cn(
          'absolute z-50 mt-2 min-w-[10rem] rounded-lg border border-slate-200 bg-white shadow-lg py-1',
          'group-open:block hidden',
          align === 'end' ? 'right-0' : 'left-0'
        )}
      >
        {children}
      </div>
    </details>
  );
}

export interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export function DropdownMenuItem({ className, destructive, ...props }: DropdownMenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-3 py-2 text-sm cursor-pointer rounded-md transition-colors',
        destructive
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50',
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 h-px bg-slate-200', className)} />;
}

// ─── Alert ────────────────────────────────────────────────────

const alertVariants = cva(
  'rounded-lg border px-4 py-3',
  {
    variants: {
      variant: {
        info: 'border-blue-200 bg-blue-50 text-blue-800',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
        error: 'border-red-200 bg-red-50 text-red-800',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  title?: string;
  description?: string;
}

const alertIcons: Record<string, React.ReactNode> = {
  info: (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 5a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  success: (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
};

export function Alert({ className, variant, title, description, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant, className }), 'flex gap-3')}
      {...props}
    >
      <span className="mt-0.5">{alertIcons[variant || 'info']}</span>
      <div className="flex-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {description && <p className="text-sm opacity-90 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

const skeletonVariants = cva(
  'rounded-md bg-slate-200',
  {
    variants: {
      variant: {
        default: 'animate-pulse',
        shimmer: 'overflow-hidden relative',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof skeletonVariants> {}

export function Skeleton({ className, variant, ...props }: SkeletonProps) {
  if (variant === 'shimmer') {
    return (
      <div
        className={cn(
          'rounded-md bg-slate-200 relative overflow-hidden',
          'after:absolute after:inset-0 after:-translate-x-full',
          'after:animate-[shimmer_1.5s_infinite]',
          'after:bg-gradient-to-r after:from-transparent after:via-slate-100 after:to-transparent',
          className
        )}
        {...props}
      />
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(skeletonVariants({ variant, className }))}
      {...props}
    />
  );
}

// ─── Tooltip ──────────────────────────────────────────────────

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ className, content, side = 'top', children, ...props }: TooltipProps) {
  const sideClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={cn('relative inline-flex', className)} {...props}>
      <span
        className="group relative inline-flex"
        aria-describedby={content ? 'tooltip' : undefined}
      >
        {children}
        {content && (
          <span
            id="tooltip"
            role="tooltip"
            className={cn(
              'absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg',
              'opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100',
              'before:absolute before:border-4 before:border-transparent',
              sideClasses[side],
              side === 'top' && 'before:top-full before:border-t-slate-900',
              side === 'bottom' && 'before:bottom-full before:border-b-slate-900',
              side === 'left' && 'before:left-full before:border-l-slate-900',
              side === 'right' && 'before:right-full before:border-r-slate-900',
            )}
          >
            {content}
          </span>
        )}
      </span>
    </span>
  );
}

// ─── Sheet / Drawer ───────────────────────────────────────────

export interface SheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  title?: string;
}

export function Sheet({ className, open, onClose, side = 'right', title, children, ...props }: SheetProps) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50',
        open ? 'block' : 'hidden'
      )}
      {...props}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          'fixed inset-y-0 z-50 bg-white shadow-xl flex flex-col',
          'transition-transform duration-300 ease-in-out',
          side === 'right' ? 'right-0 w-80' : 'left-0 w-80',
          open
            ? 'translate-x-0'
            : side === 'right'
              ? 'translate-x-full'
              : '-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close panel"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  defaultValue: string;
  tabs: { value: string; label: string }[];
  children: React.ReactNode | ((activeTab: string) => React.ReactNode);
}

export function Tabs({ className, defaultValue, tabs, children, ...props }: TabsProps) {
  return (
    <div className={cn('w-full', className)} {...props}>
      <TabList tabs={tabs} defaultValue={defaultValue} />
      <div className="mt-4">
        {typeof children === 'function' ? children(defaultValue) : children}
      </div>
    </div>
  );
}

export interface TabListProps {
  tabs: { value: string; label: string }[];
  defaultValue: string;
}

function TabList({ tabs, defaultValue }: TabListProps) {
  const [active, setActive] = useState(defaultValue);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((t) => t.value === active);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      newIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else {
      return;
    }

    e.preventDefault();
    const newTab = tabs[newIndex];
    setActive(newTab.value);
    const tabBtn = document.getElementById(`tab-${newTab.value}`);
    tabBtn?.focus();
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className="flex items-center gap-1 border-b border-slate-200"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          id={`tab-${tab.value}`}
          role="tab"
          aria-selected={active === tab.value}
          aria-controls={`panel-${tab.value}`}
          tabIndex={active === tab.value ? 0 : -1}
          onClick={() => setActive(tab.value)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 rounded-t-md',
            active === tab.value
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  activeTab: string;
}

export function TabPanel({ value, activeTab, className, children, ...props }: TabPanelProps) {
  if (value !== activeTab) return null;

  return (
    <div
      id={`panel-${value}`}
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn('outline-none', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Typography ───────────────────────────────────────────────

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

const headingClasses: Record<string, string> = {
  h1: 'text-3xl font-bold tracking-tight text-slate-900',
  h2: 'text-2xl font-semibold tracking-tight text-slate-900',
  h3: 'text-xl font-semibold text-slate-900',
  h4: 'text-lg font-semibold text-slate-900',
  h5: 'text-base font-semibold text-slate-900',
  h6: 'text-sm font-semibold text-slate-900',
};

export function Heading({ as: Component = 'h2', className, ...props }: HeadingProps) {
  return <Component className={cn(headingClasses[Component], className)} {...props} />;
}

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'default' | 'muted' | 'small' | 'lead';
  as?: 'p' | 'span' | 'div';
}

const textClasses: Record<string, string> = {
  default: 'text-base text-slate-700',
  muted: 'text-sm text-slate-500',
  small: 'text-xs text-slate-500',
  lead: 'text-lg text-slate-600',
};

export function Text({ variant = 'default', as: Component = 'p', className, ...props }: TextProps) {
  return <Component className={cn(textClasses[variant], className)} {...props} />;
}

// ─── Re-export everything ─────────────────────────────────────

export default {
  cn,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Badge,
  Avatar,
  Separator,
  Switch,
  Textarea,
  Select,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Alert,
  Skeleton,
  Tooltip,
  Sheet,
  Tabs,
  TabPanel,
  Heading,
  Text,
};
