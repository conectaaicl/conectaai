from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DealBase(BaseModel):
    title: str
    amount_estimated: Optional[float] = None
    currency: str = "CLP"
    stage: Optional[str] = None
    probability: Optional[int] = None


class DealCreate(DealBase):
    company_id: int
    lead_id: int
    assigned_user_id: Optional[int] = None


class DealUpdate(BaseModel):
    stage: Optional[str] = None
    probability: Optional[int] = None
    assigned_user_id: Optional[int] = None
    amount_estimated: Optional[float] = None


class DealOut(DealBase):
    id: int
    company_id: int
    lead_id: int
    assigned_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
