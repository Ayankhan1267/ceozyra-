const agents = [
  {
    name: 'CEO Agent',
    initials: 'CE',
    gradient: 'from-indigo-600 to-indigo-500',
    tagline: 'Strategy & decisions',
    duties: [
      'Daily operating review and KPI briefs',
      'Revenue forecasts and scenario planning',
      'Cross-team task coordination',
    ],
  },
  {
    name: 'CFO Agent',
    initials: 'CF',
    gradient: 'from-violet-600 to-violet-500',
    tagline: 'Finance & cash flow',
    duties: [
      'Real-time P&L and margin tracking',
      'Cash flow forecasting and alerts',
      'Invoice, payroll, and expense management',
    ],
  },
  {
    name: 'CMO Agent',
    initials: 'CM',
    gradient: 'from-rose-500 to-orange-500',
    tagline: 'Growth & marketing',
    duties: [
      'Campaigns across email, WhatsApp, and ads',
      'Customer segmentation and retention',
      'A/B test design and automated optimization',
    ],
  },
  {
    name: 'COO Agent',
    initials: 'CO',
    gradient: 'from-emerald-500 to-teal-500',
    tagline: 'Operations & fulfillment',
    duties: [
      'Inventory replenishment and stock alerts',
      'Order routing and fulfillment monitoring',
      'Supplier and logistics coordination',
    ],
  },
  {
    name: 'Growth Agent',
    initials: 'GR',
    gradient: 'from-amber-500 to-yellow-500',
    tagline: 'Experiments & AOV',
    duties: [
      'Pricing and promotion experiments',
      'Bundle and upsell opportunity mining',
      'Landing page and funnel optimization',
    ],
  },
];

export default function Agents() {
  return (
    <section id="agents" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Agents
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            A leadership team that never sleeps.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Each ZYRA agent owns a function end-to-end and reports back like a senior operator.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 transition-shadow hover:shadow-lg hover:shadow-gray-100"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${agent.gradient} text-sm font-bold text-white shadow-sm`}
                >
                  {agent.initials}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{agent.name}</h3>
                  <p className="text-sm text-slate-500">{agent.tagline}</p>
                </div>
              </div>
              <ul className="mt-6 flex flex-col gap-3">
                {agent.duties.map((duty) => (
                  <li key={duty} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0 text-indigo-500"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {duty}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="flex flex-col items-start justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8">
            <h3 className="text-xl font-bold text-white">Build your own agent.</h3>
            <p className="mt-3 text-sm leading-relaxed text-indigo-100">
              Describe any workflow in plain language and give it tools. ZYRA turns it into a
              working agent with guardrails and approval modes.
            </p>
            <a
              href="#pricing"
              className="mt-6 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 transition-transform hover:scale-[1.02]"
            >
              Start building
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}