from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    modules = Column(JSONB, default={
        "ventas": True,
        "mail": False,
        "gps": False,
        "condominios": False,
        "whatsapp": False,
        "google_calendar": False
    })
    
    plan_name = Column(String(50), default="trial")
    monthly_price = Column(Float, default=0.0)
    status = Column(String(20), default="active")  # active, suspended, cancelled
    
    # Límites
    max_users = Column(Integer, default=5)
    max_deals = Column(Integer, default=100)
    max_storage_mb = Column(Integer, default=1000)
    
    # Fechas
    trial_ends_at = Column(DateTime, nullable=True)
    next_billing_date = Column(DateTime, nullable=True)
    activated_at = Column(DateTime, server_default=func.now())
    suspended_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class PaymentHistory(Base):
    __tablename__ = "payment_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    status = Column(String(20), default="pending")  # pending, paid, failed, refunded
    payment_method = Column(String(50), nullable=True)
    
    description = Column(Text, nullable=True)
    invoice_url = Column(String, nullable=True)
    
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
