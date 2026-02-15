from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LeadBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    source: str


class LeadCreate(LeadBase):
    company_id: int


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    assigned_user_id: Optional[int] = None


class LeadOut(LeadBase):
    id: int
    status: str
    company_id: int
    assigned_user_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
