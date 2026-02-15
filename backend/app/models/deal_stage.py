from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.core.database import Base

class DealStage(Base):
    __tablename__ = "deal_stages"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String, nullable=False)
    order = Column(Integer)
    is_final = Column(Boolean, default=False)
