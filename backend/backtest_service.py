from __future__ import annotations

import logging
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

import torch
import yfinance as yf


logger = logging.getLogger("marketmind-api")

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_DIR = PROJECT_ROOT / "ml"
GLOBAL_MODEL_PATH = ML_DIR / "models" / "transformer_stock_model_global.pth"
LEGACY_MODEL_PATH = ML_DIR / "models" / "transformer_stock_model.pth"

# The backend runs from C:\Projects\SPWA\backend, while the ML code lives in
# C:\Projects\SPWA\ml. Adding the absolute ML path keeps imports reliable.
if str(ML_DIR) not in sys.path:
    sys.path.insert(0, str(ML_DIR))

from features import LABEL_TO_NAME, add_technical_indicators, scaler_from_state, transform_features  # noqa: E402
from model import StockTransformerClassifier  # noqa: E402
from utils import get_device  # noqa: E402


STARTING_CAPITAL = 100_000.0
TRANSACTION_COST_RATE = 0.001
SLIPPAGE_RATE = 0.001


class BacktestServiceError(Exception):
    """Raised when the backtest cannot be completed cleanly."""


def _default_model_path() -> Path:
    """Prefer the global model, then fall back to the original model."""

    return GLOBAL_MODEL_PATH if GLOBAL_MODEL_PATH.exists() else LEGACY_MODEL_PATH


@lru_cache(maxsize=1)
def _load_backtest_model() -> tuple[StockTransformerClassifier, dict[str, Any], torch.device]:
    """Load the trained Transformer once and reuse it for backtests."""

    model_path = _default_model_path()

    if not model_path.exists():
        raise BacktestServiceError(f"Model file not found at {model_path}")

    device = get_device()
    checkpoint = torch.load(model_path, map_location=device)
    config = checkpoint["model_config"]

    model = StockTransformerClassifier(
        num_features=config["num_features"],
        sequence_length=config["sequence_length"],
        d_model=config["d_model"],
        num_heads=config["num_heads"],
        num_layers=config["num_layers"],
        dropout=config["dropout"],
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    return model, checkpoint, device


def _download_history(symbol: str):
    """Download enough daily history to build rolling Transformer signals."""

    try:
        history = yf.Ticker(symbol).history(period="5y", interval="1d", auto_adjust=False)
    except Exception as exc:
        raise BacktestServiceError(f"Unable to fetch historical data for {symbol}") from exc

    if history.empty:
        raise BacktestServiceError(f"No historical data found for {symbol}")

    return history


def _predict_recommendations(feature_df, model, checkpoint, device) -> list[tuple[int, int, str]]:
    """Run the Transformer on past-only windows.

    Each tuple is:
    - signal_index: the day whose close is the last value in the input window
    - trade_index: the next trading day, where the simulated order executes
    - recommendation: BUY/HOLD/AVOID
    """

    sequence_length = int(checkpoint["sequence_length"])
    scaler = scaler_from_state(checkpoint["scaler"])
    feature_columns = checkpoint.get("feature_columns")
    scaled_features = transform_features(feature_df, scaler, feature_columns=feature_columns)

    recommendations: list[tuple[int, int, str]] = []

    # The first signal is available after the close of the 60th clean row.
    # It can only be traded at the next day's open, so the final possible
    # signal is the second-to-last row.
    for signal_index in range(sequence_length - 1, len(scaled_features) - 1):
        start_index = signal_index - sequence_length + 1
        sequence = scaled_features[start_index : signal_index + 1]
        input_tensor = torch.tensor(sequence, dtype=torch.float32).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(input_tensor)
            class_index = int(torch.argmax(logits, dim=1).item())

        recommendations.append((signal_index, signal_index + 1, LABEL_TO_NAME[class_index]))

    return recommendations


def _max_drawdown(portfolio_values: list[float]) -> float:
    """Calculate the largest peak-to-trough percentage drop."""

    peak = portfolio_values[0]
    worst_drawdown = 0.0

    for value in portfolio_values:
        peak = max(peak, value)
        drawdown = ((value - peak) / peak) * 100
        worst_drawdown = min(worst_drawdown, drawdown)

    return round(worst_drawdown, 2)


def _summary(strategy_return: float, buy_hold_return: float) -> str:
    """Create a short comparison sentence for the dashboard."""

    difference = round(strategy_return - buy_hold_return, 2)
    if difference > 0:
        return f"AI strategy outperformed buy-and-hold by {difference}%."
    if difference < 0:
        return f"AI strategy underperformed buy-and-hold by {abs(difference)}%."
    return "AI strategy matched buy-and-hold performance."


def _date_string(value: Any) -> str:
    """Convert pandas Timestamp-like index values into YYYY-MM-DD strings."""

    return value.strftime("%Y-%m-%d") if hasattr(value, "strftime") else str(value)


def _buy_with_costs(cash: float, open_price: float) -> tuple[float, float, float]:
    """Buy shares at next open with slippage and transaction costs.

    Slippage makes the entry price slightly worse. Transaction cost is an
    explicit fee paid on the notional trade value.
    """

    execution_price = open_price * (1 + SLIPPAGE_RATE)
    trade_notional = cash / (1 + TRANSACTION_COST_RATE)
    transaction_cost = trade_notional * TRANSACTION_COST_RATE
    shares = trade_notional / execution_price
    remaining_cash = cash - trade_notional - transaction_cost
    return shares, remaining_cash, transaction_cost


def _sell_with_costs(shares: float, open_price: float) -> tuple[float, float]:
    """Sell shares with slippage and transaction costs."""

    execution_price = open_price * (1 - SLIPPAGE_RATE)
    trade_notional = shares * execution_price
    transaction_cost = trade_notional * TRANSACTION_COST_RATE
    cash_after_sale = trade_notional - transaction_cost
    return cash_after_sale, transaction_cost


def _buy_and_hold_benchmark(first_open: float, final_close: float) -> tuple[float, float]:
    """Calculate a fair buy-and-hold benchmark with the same entry/exit costs."""

    shares, cash, entry_cost = _buy_with_costs(STARTING_CAPITAL, first_open)
    exit_cash, exit_cost = _sell_with_costs(shares, final_close)
    final_value = cash + exit_cash
    total_costs = entry_cost + exit_cost
    return final_value, total_costs


def run_backtest(symbol: str) -> dict[str, Any]:
    """Backtest the Transformer BUY/HOLD/AVOID strategy.

    Trading rules:
    - BUY means enter or keep a long position.
    - HOLD means keep the current position.
    - AVOID means exit or stay in cash.

    Signals are generated from data available through the close of day t.
    Orders are executed at the next trading day's open, with transaction costs
    and slippage applied to every buy/sell order.
    """

    clean_symbol = symbol.strip().upper()
    if not clean_symbol:
        raise BacktestServiceError("Stock symbol is required.")

    model, checkpoint, device = _load_backtest_model()
    sequence_length = int(checkpoint["sequence_length"])

    history = _download_history(clean_symbol)
    feature_df = add_technical_indicators(history, ticker=clean_symbol)

    if "Open" not in feature_df.columns or "Close" not in feature_df.columns:
        raise BacktestServiceError("Historical data must include Open and Close prices.")

    if len(feature_df) <= sequence_length + 1:
        raise BacktestServiceError(
            f"{clean_symbol} does not have enough clean historical rows for a backtest."
        )

    signal_plan = _predict_recommendations(feature_df, model, checkpoint, device)
    if not signal_plan:
        raise BacktestServiceError(f"{clean_symbol} did not produce any backtest signals.")

    opens = feature_df["Open"].to_numpy(dtype=float)
    closes = feature_df["Close"].to_numpy(dtype=float)
    dates = list(feature_df.index)

    cash = STARTING_CAPITAL
    shares = 0.0
    in_position = False
    entry_cash_deployed = 0.0
    order_count = 0
    closed_positions = 0
    winning_trades = 0
    portfolio_values = [STARTING_CAPITAL]
    portfolio_history: list[dict[str, float | str]] = []
    transaction_costs_paid = 0.0
    trade_log: list[dict[str, str | float]] = []

    first_trade_index = signal_plan[0][1]
    test_period_start = _date_string(dates[first_trade_index])
    test_period_end = _date_string(dates[-1])
    benchmark_shares, benchmark_cash, _ = _buy_with_costs(STARTING_CAPITAL, opens[first_trade_index])

    for _, trade_index, recommendation in signal_plan:
        trade_open = opens[trade_index]
        trade_close = closes[trade_index]

        # BUY enters at the next day's open. If already invested, it simply
        # keeps the existing long position.
        if recommendation == "BUY" and not in_position:
            entry_cash_deployed = cash
            bought_shares, remaining_cash, transaction_cost = _buy_with_costs(cash, trade_open)
            shares = bought_shares
            cash = remaining_cash
            in_position = True
            order_count += 1
            transaction_costs_paid += transaction_cost
            portfolio_value_after_trade = cash + shares * trade_open
            trade_log.append(
                {
                    "date": _date_string(dates[trade_index]),
                    "action": "BUY",
                    "execution_price": round(float(trade_open * (1 + SLIPPAGE_RATE)), 2),
                    "shares_traded": round(float(bought_shares), 6),
                    "portfolio_value_after_trade": round(float(portfolio_value_after_trade), 2),
                    "transaction_cost": round(float(transaction_cost), 2),
                    "reason": "Transformer signal BUY: enter or hold long position.",
                }
            )

        # AVOID exits at the next day's open. If already in cash, it stays out.
        elif recommendation == "AVOID" and in_position:
            exit_cash, transaction_cost = _sell_with_costs(shares, trade_open)
            cash += exit_cash
            sold_shares = shares
            shares = 0.0
            in_position = False
            order_count += 1
            closed_positions += 1
            transaction_costs_paid += transaction_cost
            if cash > entry_cash_deployed:
                winning_trades += 1
            entry_cash_deployed = 0.0
            trade_log.append(
                {
                    "date": _date_string(dates[trade_index]),
                    "action": "SELL",
                    "execution_price": round(float(trade_open * (1 - SLIPPAGE_RATE)), 2),
                    "shares_traded": round(float(sold_shares), 6),
                    "portfolio_value_after_trade": round(float(cash), 2),
                    "transaction_cost": round(float(transaction_cost), 2),
                    "reason": "Transformer signal AVOID: exit to cash.",
                }
            )

        # Mark the portfolio at the same day's close after any open execution.
        portfolio_value = cash + shares * trade_close
        portfolio_values.append(portfolio_value)
        benchmark_value = benchmark_cash + benchmark_shares * trade_close
        portfolio_history.append(
            {
                "date": _date_string(dates[trade_index]),
                "ai_value": round(float(portfolio_value), 2),
                "ai_return_percent": round(float(((portfolio_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100), 2),
                "buy_hold_value": round(float(benchmark_value), 2),
                "buy_hold_return_percent": round(float(((benchmark_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100), 2),
            }
        )

    final_close = closes[-1]

    # Force-liquidate any open position at the final close so the final value is
    # cash-like and includes an exit cost. This is a simplified assumption.
    if in_position:
        sold_shares = shares
        exit_cash, transaction_cost = _sell_with_costs(shares, final_close)
        cash += exit_cash
        shares = 0.0
        order_count += 1
        closed_positions += 1
        transaction_costs_paid += transaction_cost
        if cash > entry_cash_deployed:
            winning_trades += 1
        trade_log.append(
            {
                "date": _date_string(dates[-1]),
                "action": "SELL",
                "execution_price": round(float(final_close * (1 - SLIPPAGE_RATE)), 2),
                "shares_traded": round(float(sold_shares), 6),
                "portfolio_value_after_trade": round(float(cash), 2),
                "transaction_cost": round(float(transaction_cost), 2),
                "reason": "End of backtest: force-liquidate open position.",
            }
        )

    final_value = cash
    portfolio_values.append(final_value)

    buy_hold_final_value, benchmark_costs = _buy_and_hold_benchmark(opens[first_trade_index], final_close)
    if portfolio_history:
        portfolio_history[-1] = {
            "date": _date_string(dates[-1]),
            "ai_value": round(float(final_value), 2),
            "ai_return_percent": round(float(((final_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100), 2),
            "buy_hold_value": round(float(buy_hold_final_value), 2),
            "buy_hold_return_percent": round(float(((buy_hold_final_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100), 2),
        }

    strategy_return = ((final_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100
    buy_hold_return = ((buy_hold_final_value - STARTING_CAPITAL) / STARTING_CAPITAL) * 100
    win_rate = (winning_trades / closed_positions) * 100 if closed_positions else 0.0
    rounded_strategy_return = round(float(strategy_return), 2)
    rounded_buy_hold_return = round(float(buy_hold_return), 2)

    return {
        "symbol": clean_symbol,
        "test_period_start": test_period_start,
        "test_period_end": test_period_end,
        "starting_capital": int(STARTING_CAPITAL),
        "final_value": round(float(final_value), 2),
        "strategy_return_percent": rounded_strategy_return,
        "buy_hold_return_percent": rounded_buy_hold_return,
        "number_of_trades": int(order_count),
        "total_trades": int(order_count),
        "win_rate": round(float(win_rate), 2),
        "max_drawdown": _max_drawdown(portfolio_values),
        "transaction_costs_paid": round(float(transaction_costs_paid), 2),
        "portfolio_history": portfolio_history,
        "trade_log": trade_log[-20:],
        "benchmark": {
            "name": "Buy and hold",
            "final_value": round(float(buy_hold_final_value), 2),
            "return_percent": rounded_buy_hold_return,
            "transaction_costs_paid": round(float(benchmark_costs), 2),
        },
        "warning": (
            "Simplified backtest: uses daily OHLC data, fixed 0.1% transaction cost and 0.1% slippage per order, "
            "assumes fills at the next day's open, and does not model taxes, spreads, liquidity limits, or intraday risk."
        ),
        "summary": _summary(rounded_strategy_return, rounded_buy_hold_return),
    }
