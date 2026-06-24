from __future__ import annotations

import logging
import sys
from pathlib import Path


logger = logging.getLogger("marketmind-api")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_DIR = PROJECT_ROOT / "ml"

# Make the standalone ml folder importable when the backend is launched from
# C:\Projects\SPWA\backend with: python -m uvicorn main:app --reload
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from sentiment import analyze_stock_sentiment  # noqa: E402


class SentimentServiceError(Exception):
    """Raised for expected sentiment analysis failures."""


def get_stock_sentiment(symbol: str) -> dict:
    """Call the ML sentiment module and wrap errors for the API layer."""

    try:
        return analyze_stock_sentiment(symbol)
    except Exception as exc:
        logger.exception("Sentiment analysis failed for %s", symbol)
        raise SentimentServiceError(str(exc)) from exc
