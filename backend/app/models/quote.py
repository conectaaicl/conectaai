from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    quote_number = Column(String)
    total_amount = Column(Float)
    currency = Column(String)
    status = Column(String)
    pdf_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
