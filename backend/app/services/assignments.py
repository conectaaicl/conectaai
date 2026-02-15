from sqlalchemy.orm import Session
from app.models.user import User
from app.models.deal import Deal


def assign_seller_round_robin(db: Session, company_id: int) -> int | None:
    """
    Devuelve el user_id del seller al que se debe asignar el próximo deal.
    Estrategia:
    - Toma sellers de la empresa (role='seller')
    - Ordena por id
    - Usa el último deal asignado para rotar
    """

    sellers = (
        db.query(User)
        .filter(
            User.company_id == company_id,
            User.role == "seller",
        )
        .order_by(User.id)
        .all()
    )

    if not sellers:
        return None

    last_assigned = (
        db.query(Deal)
        .filter(
            Deal.company_id == company_id,
            Deal.assigned_user_id.isnot(None),
        )
        .order_by(Deal.id.desc())
        .first()
    )

    if not last_assigned or last_assigned.assigned_user_id not in [s.id for s in sellers]:
        return sellers[0].id

    ids = [s.id for s in sellers]
    idx = ids.index(last_assigned.assigned_user_id)
    next_idx = (idx + 1) % len(ids)
    return ids[next_idx]
