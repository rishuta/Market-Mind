import { briefing } from '@/lib/briefing'

export function MarketSnapshot() {
  return (
    <section className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-3xl px-6 py-14 md:py-16">
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Today&apos;s environment
        </h2>

        <dl className="mt-8 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
          {briefing.snapshot.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="font-serif text-3xl text-foreground">
                {item.value}
              </dd>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {item.note}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
