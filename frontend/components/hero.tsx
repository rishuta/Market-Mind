import { briefing } from '@/lib/briefing'

export function Hero() {
  const { wordmark, greeting, date, masthead, mood, insight, primaryActions } =
    briefing

  return (
    <section className="relative overflow-hidden">
      {/* Sunrise atmosphere — warm gold blending into muted lavender, barely visible */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[620px]"
        style={{
          background:
            'radial-gradient(115% 85% at 50% -12%, color-mix(in oklch, var(--gold) 42%, transparent) 0%, color-mix(in oklch, var(--primary) 22%, transparent) 45%, transparent 72%)',
          opacity: 0.22,
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 pt-16 pb-14 md:pt-24 md:pb-20">
        {/* Masthead */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-[0.32em] text-muted-foreground">
            {wordmark}
          </span>
          <span className="text-xs tracking-wide text-muted-foreground">
            {date}
          </span>
        </div>

        <div className="mt-14 md:mt-20">
          <p className="font-serif text-2xl italic text-muted-foreground md:text-3xl">
            {greeting}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="text-sm font-medium uppercase tracking-[0.2em] text-foreground">
              {masthead}
            </h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold-soft bg-gold-soft/25 px-3 py-1 text-xs font-medium text-gold-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Market mood &middot; {mood}
            </span>
          </div>
        </div>

        {/* The one insight */}
        <div className="mt-10 md:mt-12">
          <p className="text-sm text-muted-foreground">{insight.lead}</p>
          <p className="mt-4 text-pretty font-serif text-4xl leading-[1.12] text-foreground md:text-6xl md:leading-[1.08]">
            {insight.headline}
          </p>
          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {insight.support}
          </p>
        </div>

        {/* Primary actions */}
        <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          {primaryActions.map((action) =>
            action.variant === 'filled' ? (
              <button
                key={action.title}
                type="button"
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:-translate-y-0.5 hover:bg-primary/90"
              >
                {action.title}
              </button>
            ) : (
              <button
                key={action.title}
                type="button"
                className="group inline-flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                {action.title}
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                  &rarr;
                </span>
              </button>
            ),
          )}
        </div>
      </div>
    </section>
  )
}
