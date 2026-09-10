export default function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(50rem 25rem at 50% 0%, rgba(79,70,229,0.35), transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Put your business on autopilot{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            today.
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          Join teams that let ZYRA run the day-to-day while they focus on what matters — building a
          brand people love.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://admin.ceozyra.com"
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-transform hover:scale-[1.02]"
          >
            Get Started Free
          </a>
          <a
            href="/storefront/demo"
            className="rounded-lg border border-slate-600 bg-white/5 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            Browse the demo store
          </a>
        </div>
      </div>
    </section>
  );
}