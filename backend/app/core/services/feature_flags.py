from sqlalchemy.orm import Session

from app.core.models.plan import Plan
from app.core.models.feature import Feature
from app.core.models.plan_feature import PlanFeature


def has_feature(db: Session, plan_name: str, feature_key: str) -> bool:
    plan = db.query(Plan).filter(Plan.name == plan_name).first()
    if not plan:
        return False

    feature = db.query(Feature).filter(Feature.key == feature_key).first()
    if not feature:
        return False

    pf = (
        db.query(PlanFeature)
        .filter(
            PlanFeature.plan_id == plan.id,
            PlanFeature.feature_id == feature.id,
            PlanFeature.enabled == True,
        )
        .first()
    )

    return pf is not None


def get_features_for_plan(db: Session, plan_name: str) -> list[str]:
    plan = db.query(Plan).filter(Plan.name == plan_name).first()
    if not plan:
        return []

    rows = (
        db.query(Feature.key)
        .join(PlanFeature, Feature.id == PlanFeature.feature_id)
        .filter(
            PlanFeature.plan_id == plan.id,
            PlanFeature.enabled == True,
        )
        .all()
    )

    return [r[0] for r in rows]
