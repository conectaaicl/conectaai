from fastapi import APIRouter, Depends
from app.core.deps import get_current_user

router = APIRouter(tags=["me"])

@router.get("/me")
def get_me(current_user = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "company_id": current_user.company_id,
    }
