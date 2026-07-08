import { briefing } from '@/lib/briefing'

export function Perspective() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
          MarketMind&apos;s perspective
        </h2>
      </div>

      <blockquote className="mt-8">
        <p className="text-balance font-serif text-3xl leading-[1.25] text-foreground md:text-4xl md:leading-[1.22]">
          {briefing.perspective}
        </p>
      </blockquote>

      <p className="mt-6 text-sm text-muted-foreground">
        Tailored to your profile &middot; Updated this morning
      </p>
    </section>
  )
}
