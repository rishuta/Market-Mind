import { Hero } from '@/components/hero'
import { SecondaryActions } from '@/components/secondary-actions'
import { WatchToday } from '@/components/watch-today'
import { MarketSnapshot } from '@/components/market-snapshot'
import { Perspective } from '@/components/perspective'
import { ContinueConversation } from '@/components/continue-conversation'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <SecondaryActions />
      <WatchToday />
      <MarketSnapshot />
      <Perspective />
      <ContinueConversation />
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-8">
          <span className="text-xs font-medium tracking-[0.32em] text-muted-foreground">
            MARKETMIND
          </span>
          <span className="text-xs text-muted-foreground">
            Your morning financial briefing
          </span>
        </div>
      </footer>
    </main>
  )
}
