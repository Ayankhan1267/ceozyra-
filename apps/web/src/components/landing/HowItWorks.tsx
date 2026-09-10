const steps = [
  {
    number: '01',
    title: 'Connect your store',
    description:
      'Bring your Shopify, WooCommerce, or any provider. ZYRA syncs products, inventory, and orders securely in minutes.',
  },
  {
    number: '02',
    title: 'ZYRA learns your business',
    description:
      'Our agents study your catalog, margins, customers, and sales history to build an operating model tuned to you.',
  },
  {
    number: '03',
    title: 'Agents run operations',
    description:
      'Pricing, support, marketing, and finance run on autopilot. You review decisions and steer with plain language.',
  },
];

export default function HowItWorks() {
  return (
    <section id="storefront" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Live in days, not quarters.
          </h2>
        </div>

        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-full top-8 hidden h-px w-full -translate-x-4 bg-gradient-to-r from-indigo-300 to-violet-300 md:block" />
              )}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">
                {step.number}
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}