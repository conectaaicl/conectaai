from pydantic import BaseModel, EmailStr
from typing import Optional, Dict
from datetime import datetime

# Crear empresa
class CompanyCreate(BaseModel):
    name: str
    admin_name: str
    admin_email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    plan: str = "trial"
    monthly_price: Optional[float] = 0.0
    modules: Optional[Dict[str, bool]] = None

# Respuesta empresa
class CompanyResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    address: Optional[str]
    status: str
    created_at: Optional[datetime]
    subscription: Optional[Dict]
    user_count: int
    admin_password: Optional[str] = None

# Crear usuario
class UserCreateAdmin(BaseModel):
    name: str
    email: EmailStr
    role: str = "seller"
    auto_generate_password: bool = True

# Respuesta usuario
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    company_id: int
    role: str
    password_plain: Optional[str] = None

# Actualizar suscripción
class SubscriptionUpdate(BaseModel):
    plan_name: Optional[str] = None
    monthly_price: Optional[float] = None
    status: Optional[str] = None
    modules: Optional[Dict[str, bool]] = None
    max_users: Optional[int] = None
    max_deals: Optional[int] = None
    max_storage_mb: Optional[int] = None

# Actualizar empresa
class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None

# Historial de pago
class PaymentCreate(BaseModel):
    company_id: int
    subscription_id: int
    amount: float
    currency: str = "USD"
    status: str = "pending"
    payment_method: Optional[str] = None
    description: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    company_id: int
    amount: float
    currency: str
    status: str
    payment_method: Optional[str]
    description: Optional[str]
    paid_at: Optional[datetime]
    created_at: datetime
