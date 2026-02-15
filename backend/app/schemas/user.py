from pydantic import BaseModel, EmailStr
from typing import Optional


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: Optional[str] = "user"


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    company_id: int

    model_config = {
        "from_attributes": True
    }
