from app.db.database import engine, Base

# IMPORTAR TODOS LOS MODELOS
from app.core.models.plan import Plan
from app.core.models.feature import Feature
from app.core.models.plan_feature import PlanFeature

def init_db():
    print("📦 Creando tablas en la base de datos...")
    Base.metadata.create_all(bind=engine)
    print("✅ Tablas creadas correctamente")
