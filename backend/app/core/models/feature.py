from sqlalchemy import Column, Integer, String
from app.db.database import Base

class Feature(Base):
    __tablename__ = "features"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True)
    description = Column(String)
