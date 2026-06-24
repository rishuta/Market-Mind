from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from html import unescape
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen

import yfinance as yf
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV_PATH = PROJECT_ROOT / "backend" / ".env"
ROOT_ENV_PATH = PROJECT_ROOT / ".env"

# Load environment variables explicitly. This keeps API-key discovery stable
# whether the backend is started from C:\Projects\SPWA or C:\Projects\SPWA\backend.
def _load_env() -> None:
    """Load env files every time we need keys, so edits are picked up safely."""

    load_dotenv(ROOT_ENV_PATH)
    load_dotenv(dotenv_path=BACKEND_ENV_PATH, override=True)
    print(f"ENV PATH LOADED: {BACKEND_ENV_PATH}")
    print(f"ENV FILE EXISTS: {BACKEND_ENV_PATH.exists()}")


_load_env()


NO_NEWS_EXPLANATION = "Recommendation is based entirely on historical price and volume patterns."


@dataclass(frozen=True)
class NewsHeadlinesResult:
    """Headlines plus the provider that produced them."""

    headlines: list[str]
    news_source: str
    raw_headlines_count: int
    basic_filtered_count: int
    strict_filtered_count: int
    filtered_headlines_count: int
    excluded_headlines_count: int
    strict_filter_fallback: bool
    fallback_reason: str | None
    alpha_vantage_status: str
    finnhub_status: str
    yahoo_finance_status: str = "not_configured"
    economic_times_status: str = "not_configured"
    moneycontrol_status: str = "not_configured"
    marketscreener_status: str = "not_configured"
    market: str = "Global"
    news_available: bool = True
    unique_headlines_count: int = 0
    duplicate_headlines_removed: int = 0
    deduplication_fallback: bool = False


class NewsFetchError(Exception):
    """Raised when a news provider cannot return usable headlines."""

    def __init__(
        self,
        message: str,
        reason: str = "alpha_vantage_request_failed",
        status: str = "request_failed",
    ) -> None:
        super().__init__(message)
        self.reason = reason
        self.status = status


@dataclass(frozen=True)
class NewsProvider:
    name: str
    status_field: str
    fetch: Callable[[], NewsHeadlinesResult]


def _clean_api_key(value: str | None, placeholder: str) -> str:
    """Return a usable key, treating blank/example placeholders as missing."""

    key = (value or "").strip().strip('"').strip("'")
    if not key or key == placeholder:
        return ""
    return key


def _key_prefix(key: str) -> str:
    """Show only a safe 4-character prefix for debugging."""

    return key[:4] if key else ""


def _mask_secret_in_message(message: str, secret: str) -> str:
    """Remove full API keys from provider error messages before logging."""

    if secret:
        return message.replace(secret, f"{_key_prefix(secret)}...")
    return message


def _detect_market(symbol: str) -> str:
    """Detect the broad market from the ticker suffix."""

    clean_symbol = symbol.strip().upper()
    if clean_symbol.endswith(".NS"):
        return "India"
    if clean_symbol.endswith((".AE", ".AD")):
        return "UAE"
    return "Global"


def _uses_europe_news_sources(symbol: str) -> bool:
    """Return whether a non-UAE ticker should use Europe-focused providers."""

    clean_symbol = symbol.strip().upper()
    europe_suffixes = (
        ".L",
        ".PA",
        ".AS",
        ".BR",
        ".DE",
        ".F",
        ".HM",
        ".HA",
        ".DU",
        ".MU",
        ".BE",
        ".SG",
        ".MI",
        ".MC",
        ".SW",
        ".ST",
        ".CO",
        ".HE",
        ".OL",
        ".IR",
        ".LS",
        ".VI",
        ".WA",
        ".PR",
        ".AT",
        ".IC",
        ".RG",
        ".TL",
        ".VS",
    )
    return clean_symbol.endswith(europe_suffixes)


def _provider_market(symbol: str) -> str:
    """Pick the provider route without changing the public market label."""

    market = _detect_market(symbol)
    if market == "Global" and _uses_europe_news_sources(symbol):
        return "Europe"
    return market


def _empty_news_result(
    symbol: str,
    fallback_reason: str,
    statuses: dict[str, str] | None = None,
) -> NewsHeadlinesResult:
    """Return an explicit no-news result without artificial headlines."""

    provider_statuses = statuses or {}
    return NewsHeadlinesResult(
        headlines=[],
        news_source="none",
        raw_headlines_count=0,
        basic_filtered_count=0,
        strict_filtered_count=0,
        filtered_headlines_count=0,
        excluded_headlines_count=0,
        strict_filter_fallback=False,
        fallback_reason=fallback_reason,
        alpha_vantage_status=provider_statuses.get("alpha_vantage_status", "not_configured"),
        finnhub_status=provider_statuses.get("finnhub_status", "not_configured"),
        yahoo_finance_status=provider_statuses.get("yahoo_finance_status", "not_configured"),
        economic_times_status=provider_statuses.get("economic_times_status", "not_configured"),
        moneycontrol_status=provider_statuses.get("moneycontrol_status", "not_configured"),
        marketscreener_status=provider_statuses.get("marketscreener_status", "not_configured"),
        market=_detect_market(symbol),
        news_available=False,
        unique_headlines_count=0,
        duplicate_headlines_removed=0,
        deduplication_fallback=False,
    )


def get_env_debug_info() -> dict[str, str | bool]:
    """Return safe env diagnostics for /debug/env without exposing full keys."""

    _load_env()
    alpha_key = _clean_api_key(os.getenv("ALPHA_VANTAGE_API_KEY"), "your_alpha_vantage_key_here")
    finnhub_key = _clean_api_key(os.getenv("FINNHUB_API_KEY"), "your_finnhub_key_here")
    return {
        "env_path_loaded": str(BACKEND_ENV_PATH),
        "env_file_exists": BACKEND_ENV_PATH.exists(),
        "alpha_vantage_key_detected": bool(alpha_key),
        "alpha_vantage_key_prefix": _key_prefix(alpha_key),
        "finnhub_key_detected": bool(finnhub_key),
        "finnhub_key_prefix": _key_prefix(finnhub_key),
    }


def _debug(message: str) -> None:
    """Small debug helper for provider selection without printing secrets."""

    print(f"[news] {message}")


def _read_json_url(url: str) -> dict | list:
    """Fetch JSON with a short timeout and a friendly user agent."""

    request = Request(url, headers={"User-Agent": "MarketMindAI/1.0"})
    try:
        with urlopen(request, timeout=12) as response:
            _debug(f"request status: {response.status}")
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        _debug(f"request status: {exc.code}")
        raise NewsFetchError(
            f"HTTP {exc.code}: {exc.reason}",
            reason="alpha_vantage_request_failed",
            status="request_failed",
        ) from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        _debug(f"request failed: {exc}")
        raise NewsFetchError(str(exc), reason="network_error", status="request_failed") from exc


def _read_text_url(url: str) -> str:
    """Fetch text content with the same timeout and user agent policy."""

    request = Request(url, headers={"User-Agent": "MarketMindAI/1.0"})
    try:
        with urlopen(request, timeout=12) as response:
            _debug(f"request status: {response.status}")
            return response.read().decode("utf-8", errors="replace")
    except HTTPError as exc:
        _debug(f"request status: {exc.code}")
        raise NewsFetchError(f"HTTP {exc.code}: {exc.reason}", reason="provider_request_failed", status="request_failed") from exc
    except (URLError, TimeoutError) as exc:
        _debug(f"request failed: {exc}")
        raise NewsFetchError(str(exc), reason="network_error", status="request_failed") from exc


def _parse_rss_titles(xml_text: str) -> list[str]:
    """Extract item titles from a standard RSS/Atom response."""

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise NewsFetchError(str(exc), reason="provider_parse_failed", status="request_failed") from exc

    titles: list[str] = []
    for element in root.iter():
        tag = element.tag.split("}", 1)[-1].lower()
        if tag == "title" and element.text:
            title = " ".join(unescape(element.text).split())
            if title:
                titles.append(title)

    # Drop the channel title when an RSS feed includes it before item titles.
    return titles[1:] if len(titles) > 1 else titles


def _clean_headlines(headlines: list[str], limit: int = 10) -> list[str]:
    """Remove empty and duplicate headlines while preserving order."""

    cleaned: list[str] = []
    seen = set()

    for headline in headlines:
        text = " ".join(str(headline).split())
        if text and text.lower() not in seen:
            cleaned.append(text)
            seen.add(text.lower())
        if len(cleaned) >= limit:
            break

    return cleaned


def _headline_keywords(symbol: str) -> list[str]:
    """Return symbol-specific words that make a headline relevant.

    Alpha Vantage can occasionally return broad market headlines. The filter
    keeps headlines that mention the ticker, company name, or major products.
    """

    clean_symbol = symbol.upper()
    base_symbol = clean_symbol.split(".")[0]

    keywords_by_symbol = {
        "AAPL": ["AAPL", "Apple", "iPhone", "iPad", "Mac", "iOS", "App Store", "WWDC"],
        "MSFT": ["Microsoft", "MSFT", "Azure", "Windows", "Xbox", "Copilot", "OpenAI", "Office", "Teams", "LinkedIn"],
        "GOOGL": ["Google", "Alphabet", "GOOGL", "YouTube", "Android", "Gemini", "Search", "Cloud"],
        "TSLA": ["Tesla", "TSLA", "EV", "Model 3", "Model Y", "Elon Musk", "Cybertruck"],
        "NVDA": ["Nvidia", "NVDA", "GPU", "AI chips", "CUDA", "Blackwell", "data center"],
        "RELIANCE.NS": ["Reliance", "Reliance Industries", "RIL", "Jio"],
        "TCS.NS": ["TCS", "Tata Consultancy", "Tata Consultancy Services"],
        "INFY.NS": ["Infosys", "INFY"],
        "HDFCBANK.NS": ["HDFC Bank", "HDFCBANK"],
        "ICICIBANK.NS": ["ICICI Bank", "ICICIBANK"],
        "SBIN.NS": ["State Bank of India", "SBI", "SBIN"],
        "ASIANPAINT.NS": ["Asian Paints", "Asian Paint"],
        "ADANIENT.NS": ["Adani Enterprises", "Adani Enterprise"],
        "ADANIPORTS.NS": ["Adani Ports", "Adani Port"],
        "WIPRO.NS": ["Wipro"],
        "ZOMATO.NS": ["Zomato"],
        "SWIGGY.NS": ["Swiggy"],
        "BAJFINANCE.NS": ["Bajaj Finance", "Bajfinance"],
        "AXISBANK.NS": ["Axis Bank", "Axisbank"],
        "MARUTI.NS": ["Maruti", "Maruti Suzuki"],
        "TATAMOTORS.NS": ["Tata Motors", "Tatamotors"],
        "HCLTECH.NS": ["HCL Tech", "HCL Technologies", "HCLTech"],
        "ITC.NS": ["ITC"],
        "SUNPHARMA.NS": ["Sun Pharma", "Sun Pharmaceutical"],
        "NESTLEIND.NS": ["Nestle India", "Nestleind"],
        "BHARTIARTL.NS": ["Bharti Airtel", "Airtel"],
        "HINDUNILVR.NS": ["Hindustan Unilever", "HUL"],
        "HDFCLIFE.NS": ["HDFC Life"],
    }

    return keywords_by_symbol.get(clean_symbol, [clean_symbol, base_symbol])


def _headline_mentions_keyword(headline: str, keywords: list[str]) -> bool:
    """Check whether a headline clearly mentions a relevant stock keyword."""

    headline_lower = headline.lower()
    for keyword in keywords:
        keyword_lower = keyword.lower()
        if keyword_lower in headline_lower:
            return True
    return False


def _relevance_score(symbol: str, headline: str) -> int:
    """Score whether the searched company is the main subject."""

    clean_symbol = symbol.upper()
    base_symbol = clean_symbol.split(".")[0]
    headline_lower = headline.lower()
    stripped_headline = headline_lower.strip()

    company_keywords = _headline_keywords(symbol)
    product_keywords_by_symbol = {
        "AAPL": ["iphone", "ipad", "mac", "ios", "app store", "wwdc"],
        "MSFT": ["azure", "windows", "xbox", "copilot", "openai", "office", "teams", "linkedin"],
        "GOOGL": ["youtube", "android", "gemini", "search", "cloud"],
        "TSLA": ["ev", "model 3", "model y", "elon musk", "cybertruck"],
        "NVDA": ["gpu", "ai chips", "cuda", "blackwell", "data center"],
    }
    unrelated_company_names = [
        "alphabet",
        "google",
        "amazon",
        "microsoft",
        "meta",
        "tesla",
        "netflix",
        "micron",
        "nvidia",
        "amd",
        "globalstar",
        "apple",
        "oracle",
        "salesforce",
        "intel",
        "broadcom",
    ]
    primary_names_by_symbol = {
        "AAPL": {"apple", "aapl"},
        "MSFT": {"microsoft", "msft"},
        "GOOGL": {"google", "alphabet", "googl"},
        "TSLA": {"tesla", "tsla"},
        "NVDA": {"nvidia", "nvda"},
    }
    list_style_phrases = [
        "top analyst reports",
        "best stocks",
        "stocks to buy",
        "market movers",
        "including",
        "watchlist",
        "hitting highs",
        "hitting lows",
    ]

    score = 0

    if stripped_headline.startswith(clean_symbol.lower()) or stripped_headline.startswith(base_symbol.lower()):
        score += 3
    if stripped_headline.startswith("apple") and clean_symbol == "AAPL":
        score += 3
    if stripped_headline.startswith("microsoft") and clean_symbol == "MSFT":
        score += 3
    if stripped_headline.startswith("google") and clean_symbol == "GOOGL":
        score += 3
    if stripped_headline.startswith("alphabet") and clean_symbol == "GOOGL":
        score += 3
    if stripped_headline.startswith("tesla") and clean_symbol == "TSLA":
        score += 3
    if (stripped_headline.startswith("nvidia") or stripped_headline.startswith("nvda")) and clean_symbol == "NVDA":
        score += 3

    if any(keyword.lower() in headline_lower for keyword in product_keywords_by_symbol.get(clean_symbol, [])):
        score += 2

    if any(keyword.lower() in headline_lower for keyword in company_keywords):
        score += 1

    if " vs. " in headline_lower or " vs " in headline_lower or " versus " in headline_lower:
        score -= 2

    unrelated_mentions = [
        name
        for name in unrelated_company_names
        if name in headline_lower and name not in primary_names_by_symbol.get(clean_symbol, {base_symbol.lower(), clean_symbol.lower()})
    ]
    if len(unrelated_mentions) >= 2:
        score -= 2
    elif len(unrelated_mentions) == 1 and ("&" in headline or "," in headline):
        score -= 2

    has_list_style_wording = any(phrase in headline_lower for phrase in list_style_phrases)
    has_comparison_wording = " vs. " in headline_lower or " vs " in headline_lower or " versus " in headline_lower

    if has_list_style_wording:
        score -= 2

    # A headline that names the searched company and does not look like a list
    # or comparison is usually company-specific even if it does not start with
    # the company name, e.g. "Pentagon awards Microsoft ...".
    if score > 0 and not unrelated_mentions and not has_list_style_wording and not has_comparison_wording:
        score += 1

    return score


def _score_headlines(symbol: str, headlines: list[str]) -> list[tuple[str, int]]:
    """Return headlines with their relevance scores, highest score first."""

    scored_headlines = [(headline, _relevance_score(symbol, headline)) for headline in headlines]
    return sorted(scored_headlines, key=lambda item: item[1], reverse=True)


def _strict_filter_headlines(symbol: str, headlines: list[str]) -> list[tuple[str, int]]:
    """Keep headlines with a relevance score high enough for sentiment."""

    return [(headline, score) for headline, score in _score_headlines(symbol, headlines) if score >= 2]


def _filter_relevant_headlines(symbol: str, raw_headlines: list[str]) -> tuple[list[str], int, int, int, int, bool]:
    """Keep only stock-specific headlines and report filter counts.

    The basic filter checks whether the company is mentioned at all. The strict
    filter then tries to keep only headlines where the company is clearly the
    main subject.
    """

    cleaned_headlines = _clean_headlines(raw_headlines, limit=10)
    keywords = _headline_keywords(symbol)
    basic_filtered = [
        headline
        for headline in cleaned_headlines
        if _headline_mentions_keyword(headline, keywords)
    ]

    raw_count = len(cleaned_headlines)
    basic_filtered_count = len(basic_filtered)
    basic_scored = _score_headlines(symbol, basic_filtered)
    strict_filtered_with_scores = [(headline, score) for headline, score in basic_scored if score >= 2]
    strict_filtered = [headline for headline, _ in strict_filtered_with_scores]
    strict_filtered_count = len(strict_filtered)
    strict_filter_fallback = False

    if strict_filtered:
        selected = strict_filtered
        if len(selected) < 3:
            selected_set = set(selected)
            backfill = [
                headline
                for headline, _ in basic_scored
                if headline not in selected_set
            ]
            selected = (selected + backfill)[:3]
            if len(selected) > strict_filtered_count:
                _debug("Strict filter returned fewer than 3 headlines; backfilled with highest-scoring basic headlines.")
    elif basic_filtered:
        _debug("Strict filtering removed all headlines; using basic filtered provider headlines.")
        selected = basic_filtered
        strict_filter_fallback = True
    else:
        _debug("Filtering removed all provider headlines.")
        selected = []
        strict_filter_fallback = True

    excluded_count = raw_count - len(selected)

    return selected, raw_count, basic_filtered_count, strict_filtered_count, excluded_count, strict_filter_fallback


def _normalise_for_deduplication(symbol: str, headline: str) -> str:
    """Turn a headline into simple words so similar stories compare cleanly."""

    text = headline.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # These common words add noise, so removing them makes the comparison focus
    # on the actual news event instead of sentence filler.
    stop_words = {
        "a",
        "an",
        "and",
        "as",
        "at",
        "by",
        "for",
        "from",
        "in",
        "into",
        "is",
        "its",
        "of",
        "on",
        "or",
        "s",
        "the",
        "their",
        "this",
        "to",
        "with",
    }
    company_words = {
        word
        for keyword in _headline_keywords(symbol)
        for word in re.sub(r"[^\w\s]", " ", keyword.lower()).split()
    }
    company_words.add(symbol.lower().split(".")[0])
    rewrite_words = {
        "adoption",
        "deploy",
        "deployment",
        "deployments",
        "drive",
        "drives",
        "driving",
        "promote",
        "promotes",
        "scales",
        "scale",
        "scaling",
        "tap",
        "taps",
        "partner",
        "partners",
        "partnering",
    }

    useful_words = [
        word
        for word in text.split()
        if word not in stop_words and word not in company_words and word not in rewrite_words
    ]
    return " ".join(useful_words) or text


def _headline_information_score(symbol: str, headline: str) -> int:
    """Score how much detail a headline carries when choosing between duplicates."""

    headline_lower = headline.lower()
    company_keyword_hits = sum(
        1
        for keyword in _headline_keywords(symbol)
        if keyword.lower() in headline_lower
    )
    business_keywords = {
        "acquisition",
        "adoption",
        "ai",
        "analyst",
        "buyback",
        "deal",
        "deployment",
        "earnings",
        "enterprise",
        "forecast",
        "growth",
        "guidance",
        "investment",
        "launch",
        "margin",
        "market",
        "merger",
        "outlook",
        "partners",
        "profit",
        "revenue",
        "sales",
        "scale",
        "stock",
    }
    business_keyword_hits = sum(1 for keyword in business_keywords if keyword in headline_lower)
    return len(headline) + (company_keyword_hits * 12) + (business_keyword_hits * 8)


def _deduplicate_headlines(
    symbol: str,
    headlines: list[str],
    threshold: float = 0.88,
) -> tuple[list[str], int, bool]:
    """Remove near-identical headlines after filtering and before FinBERT."""

    unique_headlines: list[str] = []
    normalised_unique: list[str] = []
    duplicates_removed = 0

    for headline in headlines:
        normalised_headline = _normalise_for_deduplication(symbol, headline)
        duplicate_index = None

        for index, existing_normalised in enumerate(normalised_unique):
            similarity = SequenceMatcher(None, normalised_headline, existing_normalised).ratio()
            if similarity >= threshold:
                duplicate_index = index
                break

        if duplicate_index is None:
            unique_headlines.append(headline)
            normalised_unique.append(normalised_headline)
            continue

        duplicates_removed += 1
        existing_headline = unique_headlines[duplicate_index]
        if _headline_information_score(symbol, headline) > _headline_information_score(symbol, existing_headline):
            unique_headlines[duplicate_index] = headline
            normalised_unique[duplicate_index] = normalised_headline

    # This should not happen when input headlines exist, but the fallback keeps
    # sentiment available if future cleanup rules become too aggressive.
    if headlines and not unique_headlines:
        return headlines, 0, True

    return unique_headlines, duplicates_removed, False


def _provider_result(
    symbol: str,
    news_source: str,
    raw_headlines: list[str],
    statuses: dict[str, str],
) -> NewsHeadlinesResult:
    """Filter provider headlines and wrap them in the common result shape."""

    (
        headlines,
        raw_count,
        basic_filtered_count,
        strict_filtered_count,
        excluded_count,
        strict_filter_fallback,
    ) = _filter_relevant_headlines(symbol, raw_headlines)

    if not headlines:
        raise NewsFetchError(
            f"{news_source} returned no relevant headlines for this symbol.",
            reason=f"{news_source}_empty_response",
            status="empty_response",
        )

    unique_headlines, duplicates_removed, deduplication_fallback = _deduplicate_headlines(symbol, headlines)

    _debug(f"selected news source: {news_source}")
    return NewsHeadlinesResult(
        headlines=unique_headlines,
        news_source=news_source,
        raw_headlines_count=raw_count,
        basic_filtered_count=basic_filtered_count,
        strict_filtered_count=strict_filtered_count,
        filtered_headlines_count=len(headlines),
        excluded_headlines_count=excluded_count,
        strict_filter_fallback=strict_filter_fallback,
        fallback_reason=None,
        alpha_vantage_status=statuses.get("alpha_vantage_status", "not_configured"),
        finnhub_status=statuses.get("finnhub_status", "not_configured"),
        yahoo_finance_status=statuses.get("yahoo_finance_status", "not_configured"),
        economic_times_status=statuses.get("economic_times_status", "not_configured"),
        moneycontrol_status=statuses.get("moneycontrol_status", "not_configured"),
        marketscreener_status=statuses.get("marketscreener_status", "not_configured"),
        market=_detect_market(symbol),
        news_available=True,
        unique_headlines_count=len(unique_headlines),
        duplicate_headlines_removed=duplicates_removed,
        deduplication_fallback=deduplication_fallback,
    )


def _fetch_yahoo_finance(symbol: str) -> NewsHeadlinesResult:
    """Fetch Yahoo Finance headlines using yfinance first, then Yahoo RSS."""

    _debug("selected news source candidate: yahoo_finance")
    raw_headlines: list[str] = []

    try:
        for item in yf.Ticker(symbol).news or []:
            if not isinstance(item, dict):
                continue
            content = item.get("content") if isinstance(item.get("content"), dict) else {}
            title = item.get("title") or content.get("title")
            if title:
                raw_headlines.append(str(title))
    except Exception as exc:
        _debug(f"yfinance news failed: {exc}")

    if not raw_headlines:
        rss_text = _read_text_url(f"https://finance.yahoo.com/rss/headline?s={quote_plus(symbol)}")
        raw_headlines = _parse_rss_titles(rss_text)

    return _provider_result(
        symbol,
        "yahoo_finance",
        raw_headlines,
        {"yahoo_finance_status": "success"},
    )


def _fetch_economic_times(symbol: str) -> NewsHeadlinesResult:
    """Fetch Indian market headlines from Economic Times Markets RSS."""

    _debug("selected news source candidate: economic_times")
    rss_text = _read_text_url("https://economictimes.indiatimes.com/markets/stocks/news/rssfeeds/2146842.cms")
    return _provider_result(
        symbol,
        "economic_times",
        _parse_rss_titles(rss_text),
        {"economic_times_status": "success"},
    )


def _fetch_moneycontrol(symbol: str) -> NewsHeadlinesResult:
    """Fetch Indian market headlines from Moneycontrol RSS feeds."""

    _debug("selected news source candidate: moneycontrol")
    urls = [
        "https://www.moneycontrol.com/rss/marketreports.xml",
        "https://www.moneycontrol.com/rss/business.xml",
    ]
    raw_headlines: list[str] = []
    last_error: NewsFetchError | None = None
    for url in urls:
        try:
            raw_headlines.extend(_parse_rss_titles(_read_text_url(url)))
        except NewsFetchError as exc:
            last_error = exc

    if not raw_headlines and last_error is not None:
        raise last_error

    return _provider_result(
        symbol,
        "moneycontrol",
        raw_headlines,
        {"moneycontrol_status": "success"},
    )


def _fetch_marketscreener(symbol: str) -> NewsHeadlinesResult:
    """Fetch MarketScreener search result headlines for Europe/UAE symbols."""

    _debug("selected news source candidate: marketscreener")
    base_symbol = symbol.split(".")[0]
    html = _read_text_url(f"https://www.marketscreener.com/search/?q={quote_plus(base_symbol)}")
    titles = [
        re.sub(r"\s+", " ", unescape(match)).strip()
        for match in re.findall(r"<(?:h[23]|a)[^>]*>(.*?)</(?:h[23]|a)>", html, flags=re.IGNORECASE | re.DOTALL)
    ]
    titles = [re.sub(r"<[^>]+>", "", title).strip() for title in titles]
    return _provider_result(
        symbol,
        "marketscreener",
        titles,
        {"marketscreener_status": "success"},
    )


def _fetch_alpha_vantage(symbol: str, api_key: str) -> NewsHeadlinesResult:
    """Fetch latest article titles from Alpha Vantage News & Sentiment."""

    _debug("selected news source candidate: alpha_vantage")
    query = urlencode(
        {
            "function": "NEWS_SENTIMENT",
            "tickers": symbol,
            "apikey": api_key,
            "limit": "10",
        }
    )
    data = _read_json_url(f"https://www.alphavantage.co/query?{query}")

    if not isinstance(data, dict):
        raise NewsFetchError("Alpha Vantage returned an unexpected response.")

    # Alpha Vantage uses these keys for rate limits, invalid keys, and other
    # provider messages. Treat them as a failure and fall back safely.
    for message_key in ("Note", "Information", "Error Message"):
        if message_key in data:
            message = str(data[message_key])
            reason = "alpha_vantage_rate_limit" if "rate limit" in message.lower() else "alpha_vantage_request_failed"
            status = "rate_limited" if reason == "alpha_vantage_rate_limit" else "request_failed"
            raise NewsFetchError(message, reason=reason, status=status)

    feed = data.get("feed", [])
    if not isinstance(feed, list):
        raise NewsFetchError(
            "Alpha Vantage response did not include a news feed.",
            reason="alpha_vantage_empty_response",
            status="empty_response",
        )

    raw_headlines = [item.get("title", "") for item in feed if isinstance(item, dict)]
    return _provider_result(
        symbol,
        "alpha_vantage",
        raw_headlines,
        {"alpha_vantage_status": "success"},
    )


def _fetch_finnhub(symbol: str, api_key: str) -> NewsHeadlinesResult:
    """Fetch company news headlines from Finnhub as a backup provider."""

    _debug("selected news source candidate: finnhub")
    today = datetime.now(UTC).date()
    start_date = today - timedelta(days=30)
    query = urlencode(
        {
            "symbol": symbol,
            "from": start_date.isoformat(),
            "to": today.isoformat(),
            "token": api_key,
        }
    )
    data = _read_json_url(f"https://finnhub.io/api/v1/company-news?{query}")

    if isinstance(data, dict) and ("error" in data or "msg" in data):
        raise NewsFetchError(str(data.get("error") or data.get("msg")), reason="alpha_vantage_request_failed", status="request_failed")
    if not isinstance(data, list):
        raise NewsFetchError("Finnhub returned an unexpected response.", reason="alpha_vantage_request_failed", status="request_failed")

    raw_headlines = [item.get("headline", "") for item in data if isinstance(item, dict)]
    return _provider_result(
        symbol,
        "finnhub",
        raw_headlines,
        {"finnhub_status": "success"},
    )


def get_news_headlines_with_source(symbol: str) -> NewsHeadlinesResult:
    """Try region-specific real providers and return empty when none have news."""

    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        return _empty_news_result(symbol, "missing_symbol")

    _load_env()
    alpha_key = _clean_api_key(os.getenv("ALPHA_VANTAGE_API_KEY"), "your_alpha_vantage_key_here")
    finnhub_key = _clean_api_key(os.getenv("FINNHUB_API_KEY"), "your_finnhub_key_here")
    market = _detect_market(clean_symbol)
    provider_market = _provider_market(clean_symbol)
    statuses = {
        "alpha_vantage_status": "not_configured",
        "finnhub_status": "not_configured",
        "yahoo_finance_status": "not_configured",
        "economic_times_status": "not_configured",
        "moneycontrol_status": "not_configured",
        "marketscreener_status": "not_configured",
    }
    fallback_reason = "no_provider_returned_headlines"

    _debug(f"ENV PATH LOADED: {BACKEND_ENV_PATH}")
    _debug(f".env exists: {BACKEND_ENV_PATH.exists()}")
    _debug(f"detected market: {market}")
    _debug(f"news provider market: {provider_market}")
    _debug(f"Alpha Vantage API key detected: {'yes' if alpha_key else 'no'}")
    _debug(f"Alpha Vantage key prefix: {_key_prefix(alpha_key)}")
    _debug(f"Finnhub API key detected: {'yes' if finnhub_key else 'no'}")
    _debug(f"Finnhub key prefix: {_key_prefix(finnhub_key)}")

    providers: list[NewsProvider] = []
    if provider_market == "India":
        providers = [
            NewsProvider("yahoo_finance", "yahoo_finance_status", lambda: _fetch_yahoo_finance(clean_symbol)),
            NewsProvider("economic_times", "economic_times_status", lambda: _fetch_economic_times(clean_symbol)),
            NewsProvider("moneycontrol", "moneycontrol_status", lambda: _fetch_moneycontrol(clean_symbol)),
        ]
    elif provider_market in {"Europe", "UAE"}:
        providers = [
            NewsProvider("yahoo_finance", "yahoo_finance_status", lambda: _fetch_yahoo_finance(clean_symbol)),
            NewsProvider("marketscreener", "marketscreener_status", lambda: _fetch_marketscreener(clean_symbol)),
        ]
    else:
        if alpha_key:
            providers.append(NewsProvider("alpha_vantage", "alpha_vantage_status", lambda: _fetch_alpha_vantage(clean_symbol, alpha_key)))
        if finnhub_key:
            providers.append(NewsProvider("finnhub", "finnhub_status", lambda: _fetch_finnhub(clean_symbol, finnhub_key)))
        providers.append(NewsProvider("yahoo_finance", "yahoo_finance_status", lambda: _fetch_yahoo_finance(clean_symbol)))

    if market == "Global":
        statuses["alpha_vantage_status"] = "not_configured" if not alpha_key else "pending"
        statuses["finnhub_status"] = "not_configured" if not finnhub_key else "pending"

    for provider in providers:
        statuses[provider.status_field] = "pending"
        try:
            result = provider.fetch()
            result_statuses = {
                **statuses,
                provider.status_field: "success",
                "alpha_vantage_status": result.alpha_vantage_status if provider.name == "alpha_vantage" else statuses["alpha_vantage_status"],
                "finnhub_status": result.finnhub_status if provider.name == "finnhub" else statuses["finnhub_status"],
            }
            _debug(f"selected provider: {provider.name}")
            _debug(
                "headline counts: "
                f"raw={result.raw_headlines_count}, basic={result.basic_filtered_count}, "
                f"strict={result.strict_filtered_count}, filtered={result.filtered_headlines_count}, "
                f"unique={result.unique_headlines_count}, duplicates_removed={result.duplicate_headlines_removed}"
            )
            return NewsHeadlinesResult(
                headlines=result.headlines,
                news_source=result.news_source,
                raw_headlines_count=result.raw_headlines_count,
                basic_filtered_count=result.basic_filtered_count,
                strict_filtered_count=result.strict_filtered_count,
                filtered_headlines_count=result.filtered_headlines_count,
                excluded_headlines_count=result.excluded_headlines_count,
                strict_filter_fallback=result.strict_filter_fallback,
                fallback_reason=result.fallback_reason,
                alpha_vantage_status=result_statuses["alpha_vantage_status"],
                finnhub_status=result_statuses["finnhub_status"],
                yahoo_finance_status=result_statuses["yahoo_finance_status"],
                economic_times_status=result_statuses["economic_times_status"],
                moneycontrol_status=result_statuses["moneycontrol_status"],
                marketscreener_status=result_statuses["marketscreener_status"],
                market=market,
                news_available=True,
                unique_headlines_count=result.unique_headlines_count,
                duplicate_headlines_removed=result.duplicate_headlines_removed,
                deduplication_fallback=result.deduplication_fallback,
            )
        except NewsFetchError as exc:
            statuses[provider.status_field] = exc.status
            fallback_reason = exc.reason
            _debug(f"{provider.name} failed, falling back. Reason: {_mask_secret_in_message(str(exc), alpha_key or finnhub_key)}")

    _debug(f"selected provider: none; fallback reason: {fallback_reason}")
    _debug("headline counts: raw=0, basic=0, strict=0, returned=0")
    return _empty_news_result(clean_symbol, fallback_reason, statuses)


def get_news_headlines(symbol: str) -> list[str]:
    """Return only the headline list for callers that do not need source data."""

    return get_news_headlines_with_source(symbol).headlines
