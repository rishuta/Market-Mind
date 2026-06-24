from pydantic import BaseModel, Field


class MarketSignalRequest(BaseModel):
    search_interest: float = Field(ge=0, description="Relative search demand")
    social_sentiment: float = Field(ge=-1, le=1, description="Sentiment from -1 to 1")
    competitor_activity: float = Field(ge=0, description="Competitor activity index")


class MarketSignalResponse(BaseModel):
    score: float
    recommendation: str

