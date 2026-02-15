from app.database import SessionLocal
from app.models.models import Company

db = SessionLocal()
company = db.query(Company).filter(Company.id == 1).first()
if company:
    # Aquí imprimiremos cómo se llaman las columnas para no fallar
    print(f"Columnas disponibles: {company.__dict__.keys()}")
db.close()
