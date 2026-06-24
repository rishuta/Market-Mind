from __future__ import annotations

from functools import lru_cache

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from news_fetcher import NO_NEWS_EXPLANATION, _deduplicate_headlines, get_news_headlines_with_source


# ProsusAI/finbert is a commonly used FinBERT checkpoint trained for financial
# sentiment classification. It returns positive, negative, and neutral scores.
FINBERT_MODEL_NAME = "ProsusAI/finbert"


def _device() -> torch.device:
    """Use the GPU when PyTorch can see CUDA, otherwise fall back to CPU."""

    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


@lru_cache(maxsize=1)
def _load_finbert() -> tuple[AutoTokenizer, AutoModelForSequenceClassification, torch.device]:
    """Load FinBERT once so repeated API calls are fast."""

    device = _device()
    print(f"FinBERT sentiment device: {device}")

    tokenizer = AutoTokenizer.from_pretrained(FINBERT_MODEL_NAME)
    model = AutoModelForSequenceClassification.from_pretrained(FINBERT_MODEL_NAME)
    model.to(device)
    model.eval()
    return tokenizer, model, device


def _normalise_label(label: str) -> str:
    """Convert model labels such as LABEL_0 or Positive into stable names."""

    cleaned = label.lower()
    if cleaned in {"positive", "negative", "neutral"}:
        return cleaned
    return cleaned


def analyze_stock_sentiment(symbol: str, headlines: list[str] | None = None) -> dict[str, str | float | int | bool | list[str] | None]:
    """Analyze finance headline sentiment with FinBERT.

    The function averages FinBERT probabilities across all supplied headlines,
    then returns one overall label and the positive/neutral/negative scores.
    """

    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        raise ValueError("Stock symbol is required.")

    if headlines is None:
        news_result = get_news_headlines_with_source(clean_symbol)
        headlines_to_analyze = news_result.headlines
        news_source = news_result.news_source
        raw_headlines_count = news_result.raw_headlines_count
        basic_filtered_count = news_result.basic_filtered_count
        strict_filtered_count = news_result.strict_filtered_count
        filtered_headlines_count = news_result.filtered_headlines_count
        unique_headlines_count = news_result.unique_headlines_count
        duplicate_headlines_removed = news_result.duplicate_headlines_removed
        deduplication_fallback = news_result.deduplication_fallback
        excluded_headlines_count = news_result.excluded_headlines_count
        strict_filter_fallback = news_result.strict_filter_fallback
        fallback_reason = news_result.fallback_reason
        alpha_vantage_status = news_result.alpha_vantage_status
        finnhub_status = news_result.finnhub_status
        yahoo_finance_status = news_result.yahoo_finance_status
        economic_times_status = news_result.economic_times_status
        moneycontrol_status = news_result.moneycontrol_status
        marketscreener_status = news_result.marketscreener_status
        market = news_result.market
        news_available = news_result.news_available
    else:
        unique_headlines, duplicate_headlines_removed, deduplication_fallback = _deduplicate_headlines(clean_symbol, headlines)
        headlines_to_analyze = unique_headlines
        news_source = "provided"
        raw_headlines_count = len(headlines)
        basic_filtered_count = len(headlines)
        strict_filtered_count = len(headlines)
        filtered_headlines_count = len(headlines)
        unique_headlines_count = len(unique_headlines)
        excluded_headlines_count = 0
        strict_filter_fallback = False
        fallback_reason = None
        alpha_vantage_status = "not_configured"
        finnhub_status = "not_configured"
        yahoo_finance_status = "not_configured"
        economic_times_status = "not_configured"
        moneycontrol_status = "not_configured"
        marketscreener_status = "not_configured"
        market = "Provided"
        news_available = bool(headlines)

    if not headlines_to_analyze:
        return {
            "symbol": clean_symbol,
            "sentiment": "neutral",
            "positive_score": 0.0,
            "neutral_score": 0.0,
            "negative_score": 0.0,
            "headlines_analyzed": 0,
            "news_source": news_source,
            "headlines": [],
            "raw_headlines_count": raw_headlines_count,
            "basic_filtered_count": basic_filtered_count,
            "strict_filtered_count": strict_filtered_count,
            "filtered_headlines_count": filtered_headlines_count,
            "unique_headlines_count": unique_headlines_count,
            "duplicate_headlines_removed": duplicate_headlines_removed,
            "excluded_headlines_count": excluded_headlines_count,
            "strict_filter_fallback": strict_filter_fallback,
            "deduplication_fallback": deduplication_fallback,
            "fallback_reason": fallback_reason,
            "alpha_vantage_status": alpha_vantage_status,
            "finnhub_status": finnhub_status,
            "yahoo_finance_status": yahoo_finance_status,
            "economic_times_status": economic_times_status,
            "moneycontrol_status": moneycontrol_status,
            "marketscreener_status": marketscreener_status,
            "market": market,
            "news_available": False,
            "sentiment_used": False,
            "explanation": NO_NEWS_EXPLANATION,
        }

    tokenizer, model, device = _load_finbert()

    encoded = tokenizer(
        headlines_to_analyze,
        padding=True,
        truncation=True,
        max_length=128,
        return_tensors="pt",
    )
    encoded = {name: tensor.to(device) for name, tensor in encoded.items()}

    with torch.no_grad():
        logits = model(**encoded).logits
        probabilities = torch.softmax(logits, dim=1)

    average_scores = probabilities.mean(dim=0).detach().cpu()

    # Build a dict using the labels stored in the Hugging Face model config.
    label_scores: dict[str, float] = {}
    for index, score in enumerate(average_scores):
        raw_label = model.config.id2label.get(index, f"LABEL_{index}")
        label_scores[_normalise_label(raw_label)] = float(score.item())

    positive_score = round(label_scores.get("positive", 0.0), 2)
    neutral_score = round(label_scores.get("neutral", 0.0), 2)
    negative_score = round(label_scores.get("negative", 0.0), 2)

    sentiment_scores = {
        "positive": positive_score,
        "neutral": neutral_score,
        "negative": negative_score,
    }
    sentiment = max(sentiment_scores, key=sentiment_scores.get)

    return {
        "symbol": clean_symbol,
        "sentiment": sentiment,
        "positive_score": positive_score,
        "neutral_score": neutral_score,
        "negative_score": negative_score,
        "headlines_analyzed": len(headlines_to_analyze),
        "news_source": news_source,
        "headlines": headlines_to_analyze,
        "raw_headlines_count": raw_headlines_count,
        "basic_filtered_count": basic_filtered_count,
        "strict_filtered_count": strict_filtered_count,
        "filtered_headlines_count": filtered_headlines_count,
        "unique_headlines_count": unique_headlines_count,
        "duplicate_headlines_removed": duplicate_headlines_removed,
        "excluded_headlines_count": excluded_headlines_count,
        "strict_filter_fallback": strict_filter_fallback,
        "deduplication_fallback": deduplication_fallback,
        "fallback_reason": fallback_reason,
        "alpha_vantage_status": alpha_vantage_status,
        "finnhub_status": finnhub_status,
        "yahoo_finance_status": yahoo_finance_status,
        "economic_times_status": economic_times_status,
        "moneycontrol_status": moneycontrol_status,
        "marketscreener_status": marketscreener_status,
        "market": market,
        "news_available": news_available,
        "sentiment_used": True,
        "explanation": None,
    }


if __name__ == "__main__":
    print(analyze_stock_sentiment("AAPL"))
