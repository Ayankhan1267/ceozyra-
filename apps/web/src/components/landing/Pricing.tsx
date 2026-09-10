const tiers = [
  {
    name: 'Starter',
    price: '$0',
    period: 'forever',
    description: 'For founders trying out their first AI operating layer.',
    cta: 'Start Free',
    highlight: false,
    features: [
      'Up to 100 orders / month',
      '1 storefront',
      'CEO & COO agents',
      'Basic analytics dashboard',
      'WhatsApp order notifications',
    ],
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/month',
    description: 'For growing brands ready to hand over daily operations.',
    cta: 'Start with Growth',
    highlight: true,
    features: [
      'Unlimited orders',
      'Unlimited storefronts',
      'All five core agents',
      'Customer 360 & segmentation',
      'Email + WhatsApp marketing automation',
      'Finance & cash flow forecasting',
      'Priority support',
    ],
  },
  {
    name: 'Business',
    price: '$299',
    period: '/month',
    description: 'For scaling teams that want full autonomy with guardrails.',
    cta: 'Talk to Sales',
    highlight: false,
    features: [
      'Everything in Growth',
      'Custom agent builder',
      'Multi-brand & multi-currency',
      'Advanced analytics + API access',
      'Approval workflows & audit logs',
      'Dedicated success manager',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Start free. Scale when you grow.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            No setup fees, no long-term contracts. Cancel anytime.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl p-8 ${
                tier.highlight
                  ? 'bg-gradient-to-b from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-300'
                  : 'border border-slate-200 bg-white'
              }`}
            >
              {tier.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-600 shadow">
                  Most popular
                </span>
              )}
              <h3 className={`text-lg font-semibold ${tier.highlight ? 'text-white' : 'text-slate-900'}`}>
                {tier.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{tier.price}</span>
                <span className={`text-sm ${tier.highlight ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {tier.period}
                </span>
              </div>
              <p className={`mt-3 text-sm ${tier.highlight ? 'text-indigo-100' : 'text-slate-600'}`}>
                {tier.description}
              </p>

              <ul className="mt-8 flex flex-col gap-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`mt-0.5 shrink-0 ${tier.highlight ? 'text-emerald-300' : 'text-indigo-500'}`}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className={tier.highlight ? 'text-indigo-50' : 'text-slate-700'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.highlight ? '/storefront/demo' : '#pricing'}
                className={`mt-8 rounded-lg px-6 py-3 text-center text-sm font-semibold transition-transform hover:scale-[1.02] ${
                  tier.highlight
                    ? 'bg-white text-indigo-700'
                    : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}