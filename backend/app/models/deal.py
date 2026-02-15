from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # 👇 AHORA OPCIONAL (WhatsApp, entradas directas, etc.)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)

    title = Column(String, nullable=False)

    amount_estimated = Column(Float, nullable=True)
    currency = Column(String, default="CLP")
    stage = Column(String, default="new")
    probability = Column(Integer, nullable=True)

    assigned_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
