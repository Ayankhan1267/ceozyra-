import Logo from './Logo';

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Platform', href: '#platform' },
      { label: 'Agents', href: '#agents' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Storefront', href: '/storefront/demo' },
      { label: 'Admin Login', href: 'https://admin.ceozyra.com' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#' },
      { label: 'API Reference', href: '#' },
      { label: 'Help Center', href: '#' },
      { label: 'Status', href: '#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-slate-950 pb-10 pt-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid gap-12 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="text-lg font-bold tracking-tight text-white">ZYRA</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
              The AI Business Operating System. Run your entire business on autopilot.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-slate-500">ZYRA © 2026. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-slate-500 transition-colors hover:text-white">
              Privacy
            </a>
            <a href="#" className="text-sm text-slate-500 transition-colors hover:text-white">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}