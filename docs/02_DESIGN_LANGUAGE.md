# MarketMind Design Language

Purpose: define the visual philosophy, interaction principles, and communication style of MarketMind.  
Source of truth: [MarketMind Product Blueprint](product-blueprint.md).

This document is not a technical specification. It describes the design decisions that should remain true regardless of framework, styling system, or implementation details.

## 1. Design Philosophy

MarketMind exists to help a person decide what to do with their money today. The design must therefore put decisions before decoration, explanation before data density, and calm guidance before visual drama.

Every screen should feel like a good financial advisor organizing the conversation. The first thing a user sees should reduce uncertainty: invest, wait, keep cash, avoid a risky area, or look more closely. Supporting evidence comes later, because confidence grows when information arrives in the right order.

The interface should never feel like a stock screener, a trading terminal, or a collection of AI metrics. MarketMind can use complex analysis behind the scenes, but the visible product should translate that complexity into clear advice.

## 2. Brand Personality

MarketMind should feel calm, trustworthy, honest, practical, and transparent.

Calm means the product does not shout. It avoids sensational wording, urgent visual treatment, and exaggerated certainty. Financial decisions are already emotionally loaded; the interface should lower the user's pulse.

Trustworthy means recommendations are clear about uncertainty. If MarketMind would wait, it should say so. If a preference cannot be fully applied because risk rules or market conditions disagree, the product should explain that plainly.

Practical means every element should help the user act. A chart, card, label, or sentence earns its place only when it helps answer "What should I do?"

## 3. Emotional Design Goals

MarketMind should create relief, not stimulation. A user should feel that the mess of market data has been sorted into a small number of sensible choices.

The emotional arc should be:

1. I understand the recommendation.
2. I understand why MarketMind thinks this.
3. I understand what could go wrong.
4. I know what to do next.

The product should avoid shame, fear, hype, and false precision. It should meet beginners without talking down to them and give advanced users depth without making the first view feel technical.

## 4. Visual Principles

Visual hierarchy should follow the decision pyramid:

1. Recommendation
2. Explanation
3. Supporting evidence
4. Technical details

The strongest visual emphasis belongs to the decision, not to secondary metrics. For example, "Hold more cash today" deserves more prominence than a bucket score or confidence value.

Whitespace is part of the product's trust signal. Crowded screens make financial advice feel rushed and mechanical. Each section should have enough breathing room for a user to understand one idea before moving to the next.

The visual system should prefer clarity over ornament. Decoration is acceptable only when it reinforces meaning, such as distinguishing cash, index exposure, gold, direct stocks, and crypto in the Invest plan.

## 5. Typography Hierarchy

Typography should make the decision obvious within ten seconds.

Primary headings should state the user's task or MarketMind's answer. They should not be vague marketing slogans. On the Invest page, the heading should support today's plan. On Analyze Stock, it should support the buy/wait/avoid decision.

Secondary headings should organize the explanation. They should be short and human, such as "Why MarketMind would wait" or "Where the money goes."

Body text should be brief and advisory. It should explain the reason behind the recommendation in everyday language. Long paragraphs should be rare, and technical details should appear only after the user has already seen the recommendation and explanation.

Labels should avoid internal system language. Prefer "Cash to keep" over "Cash allocation," and "Gold already provides enough protection" over "Gold cap reached."

## 6. Card Philosophy

Cards should group decisions or evidence, not decorate the page. A card is useful when it helps a user compare a small set of options, understand one recommendation, or inspect one investment bucket.

Cards should not multiply just because data exists. Repeated cards with similar messages make MarketMind feel like a dashboard instead of an advisor.

The most important card on a page should answer the user's primary question. Supporting cards should explain the recommendation, show risks, or reveal details progressively.

Nested cards should be avoided because they dilute hierarchy. If a section needs many framed areas inside another frame, the design is probably exposing too much at once.

## 7. Motion & Interaction Principles

Motion should clarify state changes, not entertain. It can guide attention when a plan is generated, a recommendation updates, or supporting evidence expands.

Interactions should feel advisory rather than mechanical. Preference controls in Invest should feel like telling MarketMind what the user cares about, not editing a spreadsheet.

Progressive disclosure should be built into interactions. A user should be able to stop after the top-level recommendation, then open details only when they want more evidence.

Loading states should communicate useful progress without pretending to be more precise than they are. Phrases like "Scanning market conditions" are better than technical model or pipeline language.

## 8. Iconography

Icons should support recognition, not replace meaning. They are useful for repeated categories such as cash, index funds, gold, direct stocks, crypto, risk, and watch items.

Icons should be familiar and quiet. They should not make the product feel playful when the user is making a serious financial decision.

An icon should not carry the whole message. If the user needs to understand a recommendation, the text must be clear on its own.

## 9. Language & Tone

MarketMind should sound like an experienced financial advisor: direct, measured, and practical.

Use human phrases:

- I would wait today.
- Holding more cash is sensible.
- Index funds offer better value today.
- Gold already provides enough protection.
- Crypto stayed out because your risk profile does not allow it.

Avoid technical phrases:

- Allocation optimizer
- Bucket normalization
- Confidence threshold
- Regression output
- Model score

Language should acknowledge uncertainty. MarketMind should not say "This will happen." It should say "This looks sensible because..." or "This is worth considering, but..."

## 10. Recommendation Language

Recommendations should be action-oriented and understandable.

For stock analysis, prefer:

- Buy
- Worth Considering
- Wait
- Avoid for Now

For investment planning, prefer:

- Invest this much
- Keep this much cash
- Favor index funds today
- Reduce direct stock exposure
- Avoid crypto for this profile

When a preference is constrained, say why:

- Gold was not increased because today's market conditions already limit gold exposure.
- Crypto stayed at 0% because Safe risk plans do not allow crypto exposure.
- Direct technology stocks were reduced where alternatives were available.

The explanation should not blame the user. MarketMind is collaborating with the user while protecting them from risk.

## 11. Accessibility Principles

Accessibility is part of financial trust. A user should not need perfect vision, perfect motor control, or advanced financial vocabulary to understand what MarketMind recommends.

The primary recommendation should be available as text, not only color, icon, or position. Risk and return states should use clear labels alongside visual treatment.

Interactive elements should have clear names and predictable behavior. A preference should read like a sentence the user understands.

Content should be scannable. Short headings, concise explanations, and clear grouping help users with attention constraints and users reviewing financial decisions under stress.

Technical details should never be required to understand the main recommendation.

## 12. Design Review Checklist

Before shipping a design, ask:

- Does the first view answer "What should I do?"
- Is the recommendation visible before the supporting evidence?
- Can a user understand the page in ten seconds?
- Does the language sound like a calm advisor?
- Are technical terms hidden unless they are genuinely useful?
- Is every card necessary?
- Are charts and metrics supporting the decision rather than competing with it?
- Does the design explain uncertainty honestly?
- Does the interaction feel like guidance rather than spreadsheet editing?
- Can the experience work for a beginner without frustrating an advanced user?
- Are accessibility needs handled through text, hierarchy, labels, and predictable controls?

If the answer to any of these is no, simplify before adding more UI.

## 13. Final Design Principles

MarketMind should help users make better financial decisions with less friction.

The best design is not the one that displays the most intelligence. It is the one that turns intelligence into a clear next step.

The product should be calm when markets are noisy, honest when confidence is limited, and practical when users need to act.

Every visual decision, interaction, and sentence should move MarketMind closer to being a trusted financial advisor.
