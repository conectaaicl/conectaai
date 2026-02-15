from sqlalchemy import Column, Integer, String, Boolean
from app.core.database import Base

class Button(Base):
    __tablename__ = "buttons"

    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    default_label = Column(String)
    action_type = Column(String)
    icon = Column(String)
    active = Column(Boolean, default=True)
