from pydantic import BaseModel, Field
from datetime import date, datetime

class Entry(BaseModel):
    entry_date:   date
    sales_amount: float = Field(ge=0)
    client_count: int   = Field(ge=0, default=0)
    debt_paid:    float = Field(ge=0, default=0.0)
    debt_new:     float = Field(ge=0, default=0.0)

class ScoreResult(BaseModel):
    score:                 int   = Field(ge=0, le=100)
    score_regularity:      float
    score_growth:          float
    score_diversification: float
    score_debt:            float
    score_seniority:       float
    entries_count:         int
    calculated_at:         datetime

class InsufficientDataError(Exception):
    pass