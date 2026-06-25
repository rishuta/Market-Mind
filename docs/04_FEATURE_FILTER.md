# MarketMind Feature Filter

Purpose: define how MarketMind decides whether a new feature should be built, postponed, simplified, or rejected.  
Source of truth: [MarketMind Product Blueprint](product-blueprint.md), [MarketMind Design Language](02_DESIGN_LANGUAGE.md), and [MarketMind UI Guidelines](03_UI_GUIDELINES.md).

This document exists to prevent feature creep. MarketMind should become a better AI financial advisor, not a broader dashboard.

## 1. Purpose of the Feature Filter

The feature filter protects MarketMind from becoming a collection of disconnected finance tools.

Every feature should earn its place by helping the user make a better financial decision. If a feature adds more information but does not reduce uncertainty, it is probably making the product worse.

The filter should be used before implementation, during design review, and again before release. Its job is not to block useful work. Its job is to keep useful work focused.

## 2. The MarketMind North Star

MarketMind's north star is:

> Know what to do with your money today.

A feature supports this north star when it helps answer one of these questions:

- Should I invest today?
- How much should I invest?
- What should I invest in?
- Should I hold cash?
- Is this stock worth buying?
- What changed in the market, and does it matter?
- What should I do next?

If a feature cannot connect clearly to one of these questions, it should be challenged.

## 3. Feature Approval Questions

Before approving a feature, answer:

- What user decision does this improve?
- Does it reduce uncertainty or add complexity?
- Does it make MarketMind feel more like a financial advisor?
- Would a good human financial advisor naturally provide this?
- Does it duplicate another page's job?
- Can the recommendation come before the evidence?
- Can technical details stay collapsed by default?
- Does it require exposing AI internals, or can they be translated into advice?
- Can it be implemented by extending existing behavior?
- What is the smallest clean architecture that solves the problem?

A feature does not need a perfect answer to every question, but weak answers are a signal to simplify, postpone, or reject it.

## 4. Product Review Checklist

Use this checklist to judge whether the feature belongs in MarketMind.

- It helps the user make a financial decision.
- It supports the AI advisor identity.
- It does not turn MarketMind into a trading terminal, screener, news site, or metric dashboard.
- It fits one page's responsibility clearly.
- It does not duplicate Invest, Analyze Stock, Home, Market Overview, or Portfolio.
- It explains what the user should do, not only what the data says.
- It avoids hype, fear, and false precision.
- It can be explained in one plain-language sentence.

If the product value is mostly "users might find this interesting," that is not enough.

## 5. UX Review Checklist

Use this checklist to judge whether the feature makes the product easier to use.

- The first view can still answer "What should I do?"
- The recommendation appears before evidence.
- Technical details are hidden until requested.
- The user does not need to interpret raw scores to understand the answer.
- The language sounds like a calm advisor.
- The feature creates fewer decisions for the user, not more.
- The flow works for beginners without frustrating advanced users.
- The feature does not crowd the page or weaken the main recommendation.

If the feature requires a long explanation before it feels useful, simplify it.

## 6. Architecture Review Checklist

Use this checklist to judge whether the feature can be built cleanly.

- It extends existing code where practical.
- It reuses existing helpers and business logic.
- It avoids duplicated scoring, allocation, or recommendation logic.
- It does not create speculative abstractions.
- It does not add configuration options that are not needed now.
- It keeps API changes minimal and intentional.
- It preserves existing response contracts unless a change is explicitly approved.
- It can be tested with focused validation.
- Another engineer could understand the change in six months.

Prefer the smallest clean implementation. A large architecture should be justified by a large product need.

## 7. AI Advisor Review Checklist

Use this checklist to judge whether the feature improves MarketMind's advisor quality.

- It helps MarketMind give a clearer recommendation.
- It explains uncertainty honestly.
- It translates model output into human advice.
- It avoids exposing AI internals unless they improve trust.
- It gives the user a practical next step.
- It respects risk profile, market context, and user intent.
- It does not sound overconfident.
- It feels like something a good financial advisor would naturally say or do.

If the feature mostly displays how the AI works, ask whether users actually need that to make a better decision.

## 8. When to Reject a Feature

Reject a feature when it conflicts with MarketMind's identity.

Reject it if:

- It does not improve a user decision.
- It mainly adds data, metrics, or charts.
- It duplicates another page's responsibility.
- It makes the product feel like a stock screener or trading terminal.
- It exposes AI internals without making the recommendation more trustworthy.
- It encourages short-term speculation instead of thoughtful investing.
- It requires complex architecture for unclear product value.
- It cannot be explained in advisor language.

Rejection is a product decision, not a failure. Saying no protects the clarity of the product.

## 9. When to Simplify a Feature

Simplify a feature when the user need is real but the proposed solution is too heavy.

Simplify it if:

- The same decision can be supported with fewer controls.
- A summary can replace a table.
- A recommendation can replace a score.
- A collapsed detail can replace a default chart.
- Existing logic can be reused instead of adding a new system.
- One page can own the feature more clearly than several pages.
- The feature is useful only after the user sees the main recommendation.

Simplification should preserve the decision value while removing friction.

## 10. When to Postpone a Feature

Postpone a feature when it may be valuable but MarketMind is not ready for it.

Postpone it if:

- It depends on missing product foundations.
- It needs portfolio intelligence that does not exist yet.
- It would distract from the current V2 roadmap.
- It requires data quality the product cannot yet guarantee.
- It would be useful only after core pages are redesigned.
- It creates architecture that would be cleaner after another planned change.

Postponing keeps the idea alive without forcing the product to carry it too early.

## 11. Examples of Good Features

Good features make MarketMind more advisory and decision-first.

Examples:

- AI Daily Brief that explains what today's market means for the user.
- Invest preferences that let the user express intent while MarketMind protects risk rules.
- Analyze Stock verdict that starts with what MarketMind would do.
- Portfolio health summary that explains whether the user is on track.
- A plain-language explanation when a preference is constrained by risk rules.
- Market Overview that explains regime, risks, and sectors without replacing Invest.

These features help the user decide what to do next.

## 12. Examples of Risky Features

Risky features may be useful, but they can easily pull MarketMind toward dashboard behavior.

Examples:

- Large sortable tables of stocks.
- Raw model confidence panels.
- Many charts on the first screen.
- Advanced filters for every metric.
- Real-time market feeds.
- Detailed backtest explorers.
- User-editable allocation formulas.

These ideas should be simplified, hidden behind progressive disclosure, or postponed unless they clearly improve a decision.

## 13. Examples of Features to Avoid

Avoid features that make MarketMind less focused.

Examples:

- A general financial news feed.
- A full trading terminal.
- A technical indicator dashboard.
- A public leaderboard of stock picks.
- Social posting or market chat.
- A crypto speculation board.
- A generic portfolio tracker with no advice.
- Raw AI pipeline or model debugging views for users.

These features may belong in other products, but they do not help MarketMind become a calm AI financial advisor.

## 14. Final Feature Decision Template

Use this template before implementation:

Feature name:

Decision supported:

Recommended decision:

- Build
- Simplify
- Postpone
- Reject

Why:

Advisor test:

User uncertainty reduced:

Page owner:

What stays hidden by default:

Smallest clean architecture:

Validation needed:

Risks or open questions:

Final reviewer:

The decision should be short, plain, and honest. If the template is hard to complete, the feature is probably not ready.
