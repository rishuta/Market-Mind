import { briefing } from '@/lib/briefing'

function ImportanceMark({ level }: { level: string }) {
  const dots = level === 'High' ? 3 : level === 'Medium' ? 2 : 1
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex items-center gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={
              i < dots
                ? 'h-1.5 w-1.5 rounded-full bg-gold'
                : 'h-1.5 w-1.5 rounded-full bg-border'
            }
          />
        ))}
      </span>
      <span className="text-xs font-medium tracking-wide text-gold-ink">
        {level}
      </span>
    </span>
  )
}

export function WatchToday() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-14 md:py-16">
      <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Today&apos;s catalysts
      </h2>

      <div className="mt-8 flex flex-col gap-10">
        {briefing.watchToday.map((event) => (
          <article key={event.title} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-6">
              <h3 className="text-pretty font-serif text-2xl leading-snug text-foreground md:text-3xl">
                {event.title}
              </h3>
              <span className="mt-1.5 shrink-0">
                <ImportanceMark level={event.importance} />
              </span>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {event.why}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
