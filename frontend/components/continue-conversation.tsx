'use client'

import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { briefing } from '@/lib/briefing'

export function ContinueConversation() {
  const [value, setValue] = useState('')

  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <h2 className="font-serif text-3xl text-foreground md:text-4xl">
          Continue the conversation
        </h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          The briefing above is only the beginning. Ask anything, and MarketMind
          will reason it through with you.
        </p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="mt-8 flex items-center gap-3 rounded-full border border-border bg-card py-2.5 pl-5 pr-2.5 transition-colors focus-within:border-primary/40"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask MarketMind anything about your finances…"
            aria-label="Ask MarketMind anything about your finances"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity"
            style={{ opacity: value ? 1 : 0.45 }}
          >
            <ArrowUp className="size-4" />
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {briefing.askPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setValue(prompt)}
              className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
