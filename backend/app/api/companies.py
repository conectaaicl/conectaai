from fastapi import APIRouter

router = APIRouter(
    prefix="/api/companies",
    tags=["companies"]
)

@router.get("")
def list_companies():
    return []
