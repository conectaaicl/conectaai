from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.core.database import Base

class CompanyButton(Base):
    __tablename__ = "company_buttons"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    button_id = Column(Integer, ForeignKey("buttons.id"), nullable=False)
    custom_label = Column(String)
    color = Column(String)
    order = Column(Integer)
    enabled = Column(Boolean, default=True)
