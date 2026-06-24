# MarketMind AI ML

GPU-enabled Transformer module for BUY/HOLD/AVOID stock prediction.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

The requirements file uses the PyTorch CUDA 12.1 wheel index, which is a good
fit for an RTX 4060 system with a current NVIDIA driver.

## Train

```bash
python train.py
```

The trainer downloads stock history with yfinance, builds technical indicators,
uses CUDA automatically when available, prints GPU information, logs epoch loss
and validation accuracy, applies early stopping, and saves:

```text
models/transformer_stock_model_global.pth
```

The original `models/transformer_stock_model.pth` file is kept as a backup.
Prediction loads the global model first and falls back to the original model if
the global checkpoint has not been trained yet.

## Predict

```bash
python predict.py NVDA
```

Output:

```text
Ticker: NVDA
Recommendation: BUY
Confidence: 72.34%
```

Global validation examples:

```bash
python predict.py AAPL
python predict.py RELIANCE.NS
python predict.py TCS.NS
python predict.py ASML.AS
python predict.py EMAAR.AE
```
