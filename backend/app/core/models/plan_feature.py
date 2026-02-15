from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint
from app.db.database import Base

class PlanFeature(Base):
    __tablename__ = "plan_features"

    id = Column(Integer, primary_key=True)
    plan_id = Column(Integer, ForeignKey("plans.id"))
    feature_id = Column(Integer, ForeignKey("features.id"))
    enabled = Column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("plan_id", "feature_id", name="uix_plan_feature"),
    )
