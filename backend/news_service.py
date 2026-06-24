from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_DIR = PROJECT_ROOT / "ml"

if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from news_fetcher import get_env_debug_info  # noqa: E402


def get_debug_env_info() -> dict[str, str | bool]:
    """Return safe API-key diagnostics for the backend debug endpoint."""

    return get_env_debug_info()
