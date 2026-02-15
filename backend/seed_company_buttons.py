from app.core.database import SessionLocal
from app.models.company_button import CompanyButton
from app.models.button import Button

db = SessionLocal()

company_id = 1

base_buttons = db.query(Button).all()

order = 1
for b in base_buttons:
    exists = (
        db.query(CompanyButton)
        .filter(
            CompanyButton.company_id == company_id,
            CompanyButton.button_id == b.id
        )
        .first()
    )

    if not exists:
        db.add(
            CompanyButton(
                company_id=company_id,
                button_id=b.id,
                custom_label=b.default_label,
                color="#2563eb",
                order=order,
                enabled=True,
            )
        )
        order += 1

db.commit()
db.close()
print("Botones asignados a empresa", company_id)
