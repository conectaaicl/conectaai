from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta

router = APIRouter()

SECRET_KEY = "supersecret"
ALGORITHM = "HS256"

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(data: LoginRequest):
    if data.email != "admin@conectaai.com":
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    token = jwt.encode(
        {
            "sub": data.email,
            "exp": datetime.utcnow() + timedelta(hours=2)
        },
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return {"access_token": token, "token_type": "bearer"}
