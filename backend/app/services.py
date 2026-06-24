from app.schemas import MarketSignalRequest, MarketSignalResponse


def score_market_signal(payload: MarketSignalRequest) -> MarketSignalResponse:
    raw_score = (
        payload.search_interest * 0.55
        + ((payload.social_sentiment + 1) * 50) * 0.30
        - payload.competitor_activity * 0.15
    )
    score = max(0, min(100, round(raw_score, 2)))

    if score >= 70:
        recommendation = "Strong opportunity"
    elif score >= 45:
        recommendation = "Watch and validate"
    else:
        recommendation = "Low priority"

    return MarketSignalResponse(score=score, recommendation=recommendation)

