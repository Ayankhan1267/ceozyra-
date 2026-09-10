import DashboardShell from '@/components/DashboardShell';

const sidebarLinks = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/chat', label: 'Talk to ZYRA' },
  { href: '/dashboard/approvals', label: 'Approvals' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/products', label: 'Products' },
  { href: '/dashboard/customers', label: 'Customers' },
  { href: '/dashboard/finance', label: 'Finance' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/storefront', label: 'Storefront' },
  { href: '/dashboard/crm', label: 'CRM' },
  { href: '/dashboard/leads', label: 'Leads' },
  { href: '/dashboard/companies', label: 'Companies' },
  { href: '/dashboard/pipeline', label: 'Pipeline' },
  { href: '/dashboard/segments', label: 'Segments' },
  { href: '/dashboard/tags', label: 'Tags' },
  { href: '/dashboard/conversations', label: 'Conversations' },
  { href: '/dashboard/messages', label: 'Messages' },
  { href: '/dashboard/templates', label: 'Templates' },
  { href: '/dashboard/campaigns', label: 'Campaigns' },
  { href: '/dashboard/automation', label: 'Automation' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: sidebarLinks,
        user: {
          name: 'Admin',
          email: 'owner@demo.com',
          initials: 'A',
        },
      }}
      headerProps={{
        title: 'Dashboard',
        breadcrumbs: [{ label: 'Home', href: '/' }, { label: 'Dashboard' }],
      }}
    >
      {children}
    </DashboardShell>
  );
}
