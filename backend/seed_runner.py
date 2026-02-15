from app.db.database import SessionLocal
from app.core.seed.seed_features import seed_feature_flags

def run():
    db = SessionLocal()
    try:
        seed_feature_flags(db)
        print("✅ Seed de feature flags ejecutado correctamente")
    finally:
        db.close()

if __name__ == "__main__":
    run()
