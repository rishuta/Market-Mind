# MarketMind UI Guidelines

Purpose: define how MarketMind screens should be structured and how users should move through the product.  
Source of truth: [MarketMind Product Blueprint](product-blueprint.md) and [MarketMind Design Language](02_DESIGN_LANGUAGE.md).

This document is not a technical specification. It does not define components, styling implementation, or frontend architecture. It defines the product experience that should remain true across any technology.

## 1. Global UI Principles

Every page must answer one question quickly:

> What should I do?

The first visible section should reduce uncertainty. It should tell the user whether to invest, wait, hold cash, review a stock, avoid an area, or look more closely.

MarketMind should always place the recommendation before the evidence. Evidence matters because it builds trust, but it should not force the user to interpret raw data before seeing the conclusion.

The default page structure should follow the decision pyramid:

1. Recommendation
2. Explanation
3. Supporting evidence
4. Technical details

Technical details should be collapsed by default. MarketMind should feel like an advisor translating complexity, not a dashboard asking the user to decode it.

Use advisor language instead of dashboard language. Prefer "Hold more cash today" over "Cash allocation increased" and "Worth considering" over "AI score: 82."

## 2. Navigation Structure

Navigation should reflect user intent, not internal data categories.

Primary navigation should stay focused on the core questions MarketMind answers:

- Home: What is happening today?
- Invest: What should I do with my money today?
- Market Overview: What is the market environment?
- Analyze Stock: Should I buy this stock?
- Portfolio: Am I on track?

Home should not duplicate Invest My Money. It should orient the user and then guide them toward the right next action.

Find Opportunities should become Market Overview. The new name better reflects the purpose: market context, risks, sectors, sentiment, and opportunities without pretending every view is a direct buy recommendation.

Navigation labels should be plain and stable. A user should not need financial vocabulary or product knowledge to know where to go.

## 3. Home Page: AI Daily Brief

The home page should become MarketMind's AI Daily Brief.

Its job is to answer:

> What is happening today, and what does it mean for me?

Home should provide orientation, not recreate the Invest workflow. It should summarize the market environment, highlight what changed, explain MarketMind's take, and suggest the next sensible action.

Recommended structure:

1. AI Daily Brief: a short advisor summary of today's market.
2. MarketMind's Take: what the current conditions mean for an everyday investor.
3. Things to Watch: risks, events, or signals worth monitoring.
4. Opportunity Radar: areas that may deserve attention, without overwhelming the user.
5. Next Step: a clear path to Invest, Analyze Stock, or Market Overview.

Home should avoid dense allocation tables, raw score grids, and detailed investment-plan outputs. Those belong on Invest after the user chooses to build a plan.

## 4. Invest Page: Today's Recommendation

Invest is the flagship decision page. It should immediately answer:

- How much to invest
- How much cash to hold
- Where to focus
- What to avoid
- Why today

The first recommendation should feel like a complete advisor answer. A user should understand the plan before seeing bucket diagnostics, market regime details, or scoring evidence.

Recommended structure:

1. Today's Recommendation: the main plan in plain language.
2. Invest Amount: the amount MarketMind recommends putting to work.
3. Cash to Hold: how much should remain liquid and why.
4. Focus Area: the strongest area for today's plan, such as index funds or selective direct stocks.
5. What to Avoid: areas that are too risky, capped, or unattractive today.
6. Why Today: a concise explanation tied to market conditions and the user's profile.
7. Preferences: user guidance that lets MarketMind adapt the plan without exposing allocation mechanics.
8. Details: allocation buckets, diagnostics, scoring evidence, and deeper explanations.

Bucket scores and AI scores should not be shown raw by default. They may support explanations in an expanded detail view, but the main view should translate them into advice.

## 5. Market Overview Page: Replacing Find Opportunities

Market Overview should explain the environment rather than present itself as a stock-picking surface.

Its job is to answer:

> What kind of market are we in, and what should I pay attention to?

Recommended structure:

1. Market Regime: the current broad condition in human language.
2. MarketMind's Read: what the regime means for investment behavior.
3. Sector Rotation: areas showing strength or weakness.
4. Key Risks: events, sentiment shifts, or volatility signals.
5. Top Opportunities: broad areas worth watching, framed carefully.
6. Commodities and Crypto: context for alternative exposure.
7. Upcoming Events: events that could affect decisions.

This page should not compete with Invest. It should help users understand why MarketMind may favor cash, index funds, gold, selective stocks, or caution.

## 6. Analyze Stock Page: Decision-First Redesign

Analyze Stock should answer one question:

> Should I buy this stock?

The page should be simplified into this order:

1. Verdict
2. What MarketMind Would Do
3. Entry, Target, Exit
4. Why
5. Details

The verdict should be visible first and use human decision language, such as "Worth Considering," "Wait," or "Avoid for Now."

"What MarketMind Would Do" should translate the verdict into action. For example: wait for a better entry, consider a small position, avoid because risk is too high, or hold if already owned.

Entry, target, and exit should appear before deep evidence because they make the recommendation practical. Users need to know not only whether a stock is interesting, but how MarketMind would manage the decision.

The "Why" section should explain the main drivers in plain language. It should summarize valuation, trend, sentiment, risk, and market context without requiring the user to inspect every metric.

Details should contain company profile, market snapshot, advanced metrics, historical backtests, raw model evidence, and other technical material. These should be available but not required to understand the recommendation.

## 7. Portfolio Page: Future Direction

The future Portfolio page should answer:

> Am I on track?

It should not begin as a holdings table. Holdings matter, but the first view should explain whether the user's portfolio is healthy, too concentrated, too risky, too inactive, or missing an important protection.

Recommended future structure:

1. Portfolio Health: a plain-language status.
2. What MarketMind Would Change: the most important action.
3. Risk and Diversification: where exposure is too high or too low.
4. Cash and Rebalancing: whether the user should hold, invest, or rebalance.
5. Holdings Detail: positions, performance, and deeper analytics.

Portfolio should feel like an ongoing advisory relationship, not only a record of past transactions.

## 8. Recommendation Card Rules

A recommendation card should contain one clear recommendation and the reason it matters.

Every major decision page should have one primary recommendation card. Supporting cards may explain risks, alternatives, or evidence, but they should not compete with the main answer.

A recommendation card should include:

- The action MarketMind recommends
- The reason in plain language
- The main risk or constraint
- The next step the user can take

Recommendation cards should avoid raw scores by default. If a score helps build trust, translate it first. For example, say "MarketMind sees stronger value in index funds today" before exposing any diagnostic detail.

Cards should not repeat the same message. If two cards say the same thing in different words, simplify.

## 9. Expandable Details Rules

Expandable details should protect the first view from overload while still giving curious users depth.

Use expandable sections for:

- Bucket scores
- AI model scores
- Allocation diagnostics
- Detailed market regime evidence
- Technical indicators
- Backtests
- Raw news lists
- Provider or data-source details

Expandable section labels should be user-facing. Prefer "Why MarketMind thinks this" or "See deeper allocation details" over internal model names.

The collapsed state should still leave the recommendation understandable. A user should never need to expand details to know what MarketMind recommends.

## 10. Preference UI Rules

Preference controls should feel like a conversation with an advisor.

The user should be able to express intent in plain terms, such as wanting more cash, less direct stock exposure, or allowing crypto. The interface should not make the user feel responsible for calculating the allocation.

The backend remains the source of truth for allocations, caps, and risk rules. The frontend should collect preferences and display MarketMind's adjusted recommendation.

Preference results should explain what happened:

- Applied: MarketMind changed the plan in line with the preference.
- Partially applied: MarketMind adjusted the plan but risk rules or market conditions limited the change.
- Blocked: MarketMind accepted the preference but protected the user from an unsuitable allocation.

When a preference is constrained, the explanation should be calm and specific. For example: "Crypto stayed at 0% because Safe risk plans do not allow crypto exposure."

## 11. Mobile Layout Rules

Mobile layouts should preserve the decision-first structure.

The first mobile view should still answer "What should I do?" without requiring the user to scroll through charts or controls first.

Mobile screens should present one main decision at a time. Dense grids, side-by-side comparisons, and multi-column evidence layouts should become simple stacked sections.

Primary actions should remain easy to find after the recommendation. Supporting evidence can follow, but it should not push the main action into a hard-to-find area.

Charts and tables should be summarized before they appear. On small screens, the user needs the takeaway before the visual detail.

## 12. Empty/Error/Loading States

Empty, error, and loading states should still sound like MarketMind.

An empty state should explain what the user can do next. It should not feel like a blank system screen.

An error state should be honest, calm, and actionable. It should say what failed, what MarketMind can still do, and whether the user should retry or change input.

A loading state should describe useful progress in advisory language, such as reviewing market conditions or preparing today's recommendation. It should avoid internal pipeline or model language.

If data is unavailable, MarketMind should not pretend certainty. It should explain that the recommendation is limited by missing or delayed information.

## 13. What Should Be Hidden by Default

The following should not be shown raw in the first view:

- Bucket scores
- AI scores
- Confidence thresholds
- Allocation diagnostics
- Model internals
- Provider debug details
- Backtest tables
- Technical indicator grids
- Long raw news lists
- Fine-grained scoring weights

These details may exist in expanded sections when they help advanced users trust the recommendation. They should not be the primary product experience.

MarketMind's visible product should translate these details into plain decisions, risks, and next steps.

## 14. UI Review Checklist

Before shipping a MarketMind screen, ask:

- Does the first view answer "What should I do?"
- Is the recommendation shown before evidence?
- Can the user understand the page within ten seconds?
- Does the page sound like an advisor rather than a dashboard?
- Are technical details collapsed by default?
- Are bucket scores and AI scores hidden from the primary view?
- Does Home avoid duplicating Invest My Money?
- Does Invest highlight invest amount, cash to hold, focus area, what to avoid, and why today?
- Does Analyze Stock follow Verdict, What MarketMind Would Do, Entry/Target/Exit, Why, Details?
- Does Market Overview explain context rather than overpromise opportunities?
- Do preference controls collect intent instead of asking the user to calculate?
- Do constrained preferences explain what happened and why?
- Does the mobile view preserve the same decision order?
- Do empty, error, and loading states give the user a next step?

If a screen fails these checks, simplify the experience before adding more content.
