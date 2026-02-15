from sqlalchemy import Column, Integer, String
from app.db.database import Base

class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, index=True)
