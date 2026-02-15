from fastapi import APIRouter
from app.ai.schemas import AIDecisionInput, AIDecisionOutput
from app.ai.service import AIDecisionService

router = APIRouter(
    prefix="/ai",
    tags=["AI"]
)

@router.post("/decide", response_model=AIDecisionOutput)
def decide(data: AIDecisionInput):
    service = AIDecisionService()
    return service.decide(data.from_number, data.message)
