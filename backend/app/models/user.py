from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # AGREGADO
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    role = Column(String, default="seller", nullable=False)
