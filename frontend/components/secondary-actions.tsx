import Link from 'next/link'
import { briefing } from '@/lib/briefing'

export function SecondaryActions() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-14 md:py-16">
      <h2 className="mb-8 text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Continue with
      </h2>
      <ul className="divide-y divide-border border-y border-border">
        {briefing.secondaryActions.map((action) => {
          const href = 'href' in action ? action.href : undefined
          const content = (
            <>
              <span className="flex flex-col gap-1">
                <span className="text-base font-medium text-foreground transition-colors group-hover:text-primary">
                  {action.title}
                </span>
                <span className="text-sm text-muted-foreground">
                  {action.caption}
                </span>
              </span>
              <span
                aria-hidden
                className="mt-1 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
              >
                &rarr;
              </span>
            </>
          )

          return (
            <li key={action.title}>
              {href ? (
                <Link
                  href={href}
                  className="group flex w-full items-baseline justify-between gap-6 py-5 text-left transition-colors"
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className="group flex w-full items-baseline justify-between gap-6 py-5 text-left transition-colors"
                >
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
