from sqlalchemy.orm import Session

from app.core.models.plan import Plan
from app.core.models.feature import Feature
from app.core.models.plan_feature import PlanFeature


# =========================
# DEFINICIÓN DE PLANES
# =========================
PLANS = [
    "basic",
    "plus",
    "elite",
]

# =========================
# DEFINICIÓN DE FEATURES
# =========================
FEATURES = {
    # Ventas
    "ventas": "CRM base",
    "automatizaciones": "Reglas y flujos",
    "email": "Email transaccional",

    # Comunicación
    "whatsapp": "WhatsApp Business",
    "instagram": "Instagram DM",
    "facebook": "Facebook Messenger",
    "tiktok": "TikTok Leads",

    # Integraciones
    "shopify": "Integración Shopify",
    "pagos": "Pagos online",
    "calendarios": "Google Calendar",

    # Inteligencia Artificial
    "ia": "OpenAI",
    "ia_advanced": "Claude / IA avanzada",

    # Otros módulos
    "condominios": "Gestión de condominios",
    "gps": "Tracking GPS",
}

# =========================
# FEATURES POR PLAN
# =========================
PLAN_FEATURES = {
    "basic": [
        "ventas",
        "email",
    ],
    "plus": [
        "ventas",
        "email",
        "whatsapp",
        "ia",
    ],
    "elite": list(FEATURES.keys()),  # TODO habilitado
}


def seed_feature_flags(db: Session):
    """
    Crea planes, features y relaciones plan-feature.
    Este seed es IDEMPOTENTE (puede ejecutarse más de una vez).
    """

    # -------------------------
    # CREAR PLANES
    # -------------------------
    plans_db = {}
    for plan_name in PLANS:
        plan = db.query(Plan).filter(Plan.name == plan_name).first()
        if not plan:
            plan = Plan(name=plan_name)
            db.add(plan)
            db.commit()
            db.refresh(plan)
        plans_db[plan_name] = plan

    # -------------------------
    # CREAR FEATURES
    # -------------------------
    features_db = {}
    for key, description in FEATURES.items():
        feature = db.query(Feature).filter(Feature.key == key).first()
        if not feature:
            feature = Feature(
                key=key,
                description=description,
            )
            db.add(feature)
            db.commit()
            db.refresh(feature)
        features_db[key] = feature

    # -------------------------
    # CREAR RELACIONES PLAN ↔ FEATURE
    # -------------------------
    for plan_name, feature_keys in PLAN_FEATURES.items():
        plan = plans_db[plan_name]

        for feature_key in feature_keys:
            feature = features_db[feature_key]

            exists = (
                db.query(PlanFeature)
                .filter(
                    PlanFeature.plan_id == plan.id,
                    PlanFeature.feature_id == feature.id,
                )
                .first()
            )

            if not exists:
                db.add(
                    PlanFeature(
                        plan_id=plan.id,
                        feature_id=feature.id,
                        enabled=True,
                    )
                )

    db.commit()
