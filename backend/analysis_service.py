from __future__ import annotations

import logging
from typing import Any

from prediction_service import predict_stock_symbol
from sentiment_service import get_stock_sentiment


logger = logging.getLogger("marketmind-api")

TRANSFORMER_WEIGHT = 0.65
SENTIMENT_WEIGHT = 0.35

RECOMMENDATION_SCORES = {
    "BUY": 1,
    "HOLD": 0,
    "AVOID": -1,
}

SENTIMENT_SCORES = {
    "positive": 1,
    "neutral": 0,
    "negative": -1,
}
NO_NEWS_EXPLANATION = "Recommendation is based entirely on historical price and volume patterns."


class AnalysisServiceError(Exception):
    """Raised when both AI inputs fail and no analysis can be returned."""


def _final_recommendation(score: float) -> str:
    """Convert the weighted score into BUY/HOLD/AVOID."""

    if score >= 0.35:
        return "BUY"
    if score <= -0.35:
        return "AVOID"
    return "HOLD"


def _sentiment_confidence(sentiment: dict[str, Any]) -> float:
    """Use the score of the winning sentiment label as sentiment confidence."""

    label = str(sentiment["sentiment"])
    score_key = f"{label}_score"
    return float(sentiment.get(score_key, 0.0)) * 100


def _combined_confidence(
    transformer: dict[str, Any] | None,
    sentiment: dict[str, Any] | None,
) -> float:
    """Blend available model confidences using the same model weights.

    If one model fails, the available model gets 100% of the confidence weight.
    This keeps partial-failure responses useful instead of artificially low.
    """

    confidence_total = 0.0
    weight_total = 0.0

    if transformer is not None:
        confidence_total += float(transformer["confidence"]) * TRANSFORMER_WEIGHT
        weight_total += TRANSFORMER_WEIGHT

    if sentiment is not None:
        confidence_total += _sentiment_confidence(sentiment) * SENTIMENT_WEIGHT
        weight_total += SENTIMENT_WEIGHT

    if weight_total == 0:
        return 0.0

    return round(confidence_total / weight_total, 2)


def _risk_level(recommendation: str, confidence: float) -> str:
    """Apply the product risk rules to the final recommendation."""

    if recommendation == "BUY" and confidence >= 75:
        return "Low-Medium"
    if recommendation == "BUY":
        return "Medium"
    if recommendation == "HOLD":
        return "Medium"
    return "High"


def _suggested_allocation(recommendation: str, risk_level: str) -> str:
    """Map the final decision into a simple allocation range."""

    if recommendation == "BUY" and risk_level == "Low-Medium":
        return "10-15%"
    if recommendation == "BUY" and risk_level == "Medium":
        return "5-10%"
    if recommendation == "HOLD":
        return "0-5%"
    return "0%"


def _sentiment_strength_phrase(sentiment: dict[str, Any]) -> str:
    """Describe sentiment intensity from the dominant FinBERT score."""

    label = str(sentiment["sentiment"])

    if label == "neutral":
        return "neutral or mixed"

    score = float(sentiment.get(f"{label}_score", 0.0))
    if score > 0.75:
        strength = "strongly"
    elif score >= 0.55:
        strength = "moderately"
    else:
        strength = "mildly"

    return f"{strength} {label}"


def _sentiment_sentence(sentiment: dict[str, Any]) -> str:
    """Create a natural sentence about financial news sentiment."""

    phrase = _sentiment_strength_phrase(sentiment)
    if phrase == "neutral or mixed":
        return "Financial news sentiment remains mostly neutral."
    return f"Financial news sentiment is {phrase}."


def _sentiment_clause(sentiment: dict[str, Any]) -> str:
    """Lowercase sentiment sentence without the final period for clauses."""

    sentence = _sentiment_sentence(sentiment)
    return (sentence[0].lower() + sentence[1:]).rstrip(".")


def _weighted_score(
    transformer: dict[str, Any] | None,
    sentiment: dict[str, Any] | None,
) -> float:
    """Calculate the final score from available AI signals."""

    score_total = 0.0
    weight_total = 0.0

    if transformer is not None:
        transformer_label = str(transformer["recommendation"])
        score_total += RECOMMENDATION_SCORES[transformer_label] * TRANSFORMER_WEIGHT
        weight_total += TRANSFORMER_WEIGHT

    if sentiment is not None:
        sentiment_label = str(sentiment["sentiment"])
        score_total += SENTIMENT_SCORES[sentiment_label] * SENTIMENT_WEIGHT
        weight_total += SENTIMENT_WEIGHT

    if weight_total == 0:
        raise AnalysisServiceError("Transformer prediction and sentiment analysis both failed.")

    # Normalize when only one model is available so the same thresholds still
    # make sense during partial outages.
    return score_total / weight_total


def _explanation(
    final_recommendation: str,
    transformer: dict[str, Any] | None,
    sentiment: dict[str, Any] | None,
    transformer_error: str | None,
    sentiment_error: str | None,
) -> str:
    """Create a clear, presentation-friendly explanation for the dashboard."""

    if transformer is None and sentiment is not None:
        return (
            f"Transformer prediction is unavailable ({transformer_error}), so the final recommendation is based on "
            f"{_sentiment_strength_phrase(sentiment)} financial news sentiment."
        )

    if sentiment is None and transformer is not None:
        if sentiment_error == NO_NEWS_EXPLANATION:
            return NO_NEWS_EXPLANATION
        return (
            f"Financial news sentiment is unavailable ({sentiment_error}), so the final recommendation follows the "
            f"Transformer model's {transformer['recommendation']} signal."
        )

    transformer_label = str(transformer["recommendation"])
    sentiment_label = str(sentiment["sentiment"])
    sentiment_sentence = _sentiment_sentence(sentiment)
    sentiment_clause = _sentiment_clause(sentiment)

    if transformer_label == "HOLD" and sentiment_label == "positive" and final_recommendation == "BUY":
        return (
            f"Transformer prediction is neutral, but {sentiment_clause}, "
            "so the final recommendation is slightly upgraded."
        )

    if transformer_label == "BUY" and sentiment_label == "negative" and final_recommendation == "HOLD":
        return (
            f"Transformer prediction is positive, but {sentiment_clause}, "
            "so the final recommendation is moderated to HOLD."
        )

    if transformer_label == "AVOID" and sentiment_label == "positive" and final_recommendation == "HOLD":
        return (
            f"Transformer prediction flags downside risk, while {sentiment_clause}, "
            "so the final recommendation is balanced at HOLD."
        )

    if transformer_label == "BUY" and sentiment_label == "positive":
        return f"The Transformer model is positive, and {sentiment_clause}. This supports a BUY recommendation."

    if transformer_label == "AVOID" and sentiment_label == "negative":
        return f"The Transformer model is negative, and {sentiment_clause}. This supports an AVOID recommendation."

    if final_recommendation == "HOLD":
        return (
            f"Transformer prediction is {transformer_label}. {sentiment_sentence} "
            "The combined AI decision remains neutral."
        )

    return (
        f"Transformer prediction is {transformer_label}. {sentiment_sentence} "
        f"the weighted AI score supports a final {final_recommendation} recommendation."
    )


def analyze_stock(symbol: str) -> dict[str, Any]:
    """Build the final MarketMind AI decision from Transformer and FinBERT.

    No model is retrained here. The function only reuses the existing inference
    services and combines their outputs into one professional dashboard payload.
    """

    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        raise AnalysisServiceError("Stock symbol is required.")

    transformer_result = None
    sentiment_result = None
    transformer_error = None
    sentiment_error = None

    try:
        transformer_result = predict_stock_symbol(clean_symbol)
    except Exception as exc:
        transformer_error = str(exc)
        logger.exception("Transformer analysis failed for %s", clean_symbol)

    try:
        sentiment_result = get_stock_sentiment(clean_symbol)
    except Exception as exc:
        sentiment_error = str(exc)
        logger.exception("Sentiment analysis failed for %s", clean_symbol)

    sentiment_for_decision = sentiment_result
    if sentiment_result is not None and not bool(sentiment_result.get("sentiment_used", True)):
        sentiment_for_decision = None
        sentiment_error = NO_NEWS_EXPLANATION

    if transformer_result is None and sentiment_for_decision is None:
        raise AnalysisServiceError(
            f"Unable to analyze {clean_symbol}. Transformer error: {transformer_error}. "
            f"Sentiment error: {sentiment_error}."
        )

    final_score = _weighted_score(transformer_result, sentiment_for_decision)
    final_recommendation = _final_recommendation(final_score)
    confidence = _combined_confidence(transformer_result, sentiment_for_decision)
    risk_level = _risk_level(final_recommendation, confidence)

    response: dict[str, Any] = {
        "symbol": clean_symbol,
        "final_recommendation": final_recommendation,
        "confidence": confidence,
        "risk_level": risk_level,
        "suggested_allocation": _suggested_allocation(final_recommendation, risk_level),
        "transformer_prediction": None,
        "sentiment_analysis": None,
        "explanation": _explanation(
            final_recommendation,
            transformer_result,
            sentiment_for_decision,
            transformer_error,
            sentiment_error,
        ),
    }

    if transformer_result is not None:
        response["transformer_prediction"] = {
            "recommendation": transformer_result["recommendation"],
            "confidence": transformer_result["confidence"],
        }
    else:
        response["transformer_error"] = transformer_error

    if sentiment_result is not None:
        response["sentiment_analysis"] = {
            "sentiment": sentiment_result["sentiment"],
            "positive_score": sentiment_result["positive_score"],
            "neutral_score": sentiment_result["neutral_score"],
            "negative_score": sentiment_result["negative_score"],
            "headlines_analyzed": sentiment_result["headlines_analyzed"],
            "news_source": sentiment_result.get("news_source"),
            "headlines": sentiment_result.get("headlines", []),
            "raw_headlines_count": sentiment_result.get("raw_headlines_count"),
            "basic_filtered_count": sentiment_result.get("basic_filtered_count"),
            "strict_filtered_count": sentiment_result.get("strict_filtered_count"),
            "filtered_headlines_count": sentiment_result.get("filtered_headlines_count"),
            "unique_headlines_count": sentiment_result.get("unique_headlines_count"),
            "duplicate_headlines_removed": sentiment_result.get("duplicate_headlines_removed"),
            "excluded_headlines_count": sentiment_result.get("excluded_headlines_count"),
            "strict_filter_fallback": sentiment_result.get("strict_filter_fallback"),
            "deduplication_fallback": sentiment_result.get("deduplication_fallback"),
            "fallback_reason": sentiment_result.get("fallback_reason"),
            "alpha_vantage_status": sentiment_result.get("alpha_vantage_status"),
            "finnhub_status": sentiment_result.get("finnhub_status"),
            "yahoo_finance_status": sentiment_result.get("yahoo_finance_status"),
            "economic_times_status": sentiment_result.get("economic_times_status"),
            "moneycontrol_status": sentiment_result.get("moneycontrol_status"),
            "marketscreener_status": sentiment_result.get("marketscreener_status"),
            "market": sentiment_result.get("market"),
            "news_available": sentiment_result.get("news_available", True),
            "sentiment_used": sentiment_result.get("sentiment_used", True),
        }
    else:
        response["sentiment_error"] = sentiment_error

    return response
