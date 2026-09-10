const features = [
  {
    title: 'AI Agents',
    description:
      'Deploy a squad of specialized agents that plan, act, and report like senior operators — around the clock.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1" />
        <path d="M8.5 13.5v1M12 13v2.5M15.5 13.5v3" />
      </svg>
    ),
  },
  {
    title: 'Store Builder',
    description:
      'Launch a branded storefront in minutes. Hosted, fast, and styled to your brand — no code required.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        <path d="M5 12v8h14v-8" />
        <path d="M10 20v-5h4v5" />
      </svg>
    ),
  },
  {
    title: 'Customer 360',
    description:
      'Every touchpoint, order, and message unified into one customer profile your agents can act on.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M15.5 15.5a3.5 3.5 0 0 1 5 0" />
      </svg>
    ),
  },
  {
    title: 'Finance & Analytics',
    description:
      'Live P&L, cash flow forecasts, and revenue intelligence generated straight from your real numbers.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: 'WhatsApp / Email',
    description:
      'Agents natively reach customers over WhatsApp and email — confirmations, support, and re-orders.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    ),
  },
  {
    title: 'Growth Engine',
    description:
      'A/B tests, promotions, and retention loops orchestrated automatically to compound your revenue.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="platform" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Platform
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything your business needs, in one operating system.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Stop juggling ten tools. ZYRA brings operations, finance, customer experience, and
            growth under a single AI command layer.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-slate-200 bg-white p-8 transition-shadow hover:shadow-lg hover:shadow-indigo-100"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                {feature.icon}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}