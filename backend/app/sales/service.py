from sqlalchemy.orm import Session
from app.models.user import User


class SalesOrchestrator:
    """
    Orquestador de lógica de ventas.
    Por ahora es simple, luego se amplía con IA, reglas, SLA, etc.
    """

    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def assign_seller(self) -> int | None:
        """
        Asignación básica de seller (round-robin simple).
        """
        sellers = (
            self.db.query(User)
            .filter(
                User.company_id == self.company_id,
                User.role == "seller",
            )
            .order_by(User.id.asc())
            .all()
        )

        if not sellers:
            return None

        return sellers[0].id


def assign_seller_round_robin(db: Session, company_id: int) -> int | None:
    """
    Función helper usada por el router de deals.
    """
    orchestrator = SalesOrchestrator(db=db, company_id=company_id)
    return orchestrator.assign_seller()
