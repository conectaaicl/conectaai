from pydantic import BaseModel

class AIDecisionInput(BaseModel):
    from_number: str
    message: str

class AIDecisionOutput(BaseModel):
    action: str
    reply: str | None = None
    create_lead: bool = False
    assign_to: str | None = None
