from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas import MarketSignalRequest, MarketSignalResponse
from app.services import score_market_signal

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "environment": settings.environment,
        "status": "running",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict/market-signal", response_model=MarketSignalResponse)
def predict_market_signal(payload: MarketSignalRequest) -> MarketSignalResponse:
    return score_market_signal(payload)

