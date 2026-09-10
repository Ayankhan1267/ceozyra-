const companies = [
  'Northwind',
  'Acme Labs',
  'Bluepeak',
  'Veltrix',
  'Osmosis',
  'Corelight',
];

export default function TrustStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-slate-400">
          Trusted by ambitious teams
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((name) => (
            <span
              key={name}
              className="text-xl font-bold tracking-tight text-slate-300"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}