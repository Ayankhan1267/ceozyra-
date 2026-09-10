const stats = [
  { label: 'Revenue', value: '$128,450', delta: '+18.2%', trend: 'up' },
  { label: 'Orders', value: '3,204', delta: '+12.4%', trend: 'up' },
  { label: 'AOV', value: '$40.08', delta: '+5.1%', trend: 'up' },
  { label: 'Active Agents', value: '24', delta: '+3 today', trend: 'up' },
];

const revenueBars = [42, 58, 45, 72, 61, 85, 78, 96, 88, 74, 92, 100];

const agentRows = [
  { name: 'CEO Agent', task: 'Weekly strategy review', status: 'Running', color: 'bg-indigo-500' },
  { name: 'CMO Agent', task: 'Email campaign: Summer Drop', status: 'Running', color: 'bg-violet-500' },
  { name: 'CFO Agent', task: 'Payroll reconciliation', status: 'Done', color: 'bg-emerald-500' },
  { name: 'COO Agent', task: 'Restock SKU #1042', status: 'Queued', color: 'bg-amber-500' },
];

export default function Hero() {
  return (
    <section id="platform" className="relative overflow-hidden bg-slate-950 py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60rem 30rem at 20% 0%, rgba(79,70,229,0.35), transparent 60%), radial-gradient(50rem 30rem at 85% 20%, rgba(124,58,237,0.3), transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6">
        <div className="max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-sm font-medium text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            The AI Business Operating System
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
            Run your entire business on{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              autopilot.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            ZYRA connects your store, finances, and customers into one brain. Deploy AI agents that
            sell, support, forecast, and operate while you focus on growth.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#pricing"
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-transform hover:scale-[1.02]"
            >
              Get Started Free
            </a>
            <a
              href="/storefront/demo"
              className="rounded-lg border border-slate-600 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              See a Live Storefront
            </a>
          </div>
        </div>

        <div className="mt-16 w-full max-w-5xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-2xl shadow-indigo-950/50 backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-4 rounded-md bg-white/5 px-3 py-1 text-xs text-slate-400">
                app.ceozyra.com/dashboard
              </span>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                    {stat.delta}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 lg:col-span-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Revenue</p>
                  <p className="text-xs text-slate-400">Last 30 days</p>
                </div>
                <div className="mt-4 flex h-40 items-end gap-2">
                  {revenueBars.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-indigo-600 to-violet-500"
                      style={{ height: `${height}%`, opacity: 0.55 + (height / 100) * 0.45 }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 lg:col-span-2">
                <p className="text-sm font-semibold text-white">Agent Activity</p>
                <div className="mt-4 flex flex-col gap-2.5">
                  {agentRows.map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2 w-2 rounded-full ${row.color}`} />
                        <div>
                          <p className="text-xs font-medium text-white">{row.name}</p>
                          <p className="text-[11px] text-slate-400">{row.task}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.status === 'Running'
                            ? 'bg-indigo-500/20 text-indigo-200'
                            : row.status === 'Done'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-amber-500/20 text-amber-200'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}