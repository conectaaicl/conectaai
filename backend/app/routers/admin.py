from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import secrets
import string
from passlib.context import CryptContext
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.company import Company
from app.models.user import User
from app.models.subscription import Subscription, PaymentHistory
from app.schemas.admin import (
    CompanyCreate, CompanyResponse, CompanyUpdate,
    UserCreateAdmin, UserResponse,
    SubscriptionUpdate,
    PaymentCreate, PaymentResponse
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def generate_password(length: int = 12) -> str:
    """Generar password seguro aleatorio"""
    chars = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(chars) for _ in range(length))

@router.post("/companies")
def create_company(
    company_data: CompanyCreate,
    db: Session = Depends(get_db)
):
    """Crear nueva empresa con usuario admin"""
    
    existing_user = db.query(User).filter(User.email == company_data.admin_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email ya está en uso")
    
    company = Company(
        name=company_data.name,
        email=company_data.admin_email,
        phone=company_data.phone,
        address=company_data.address,
        status="active"
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    
    trial_days = 14 if company_data.plan == "trial" else 0
    trial_ends = datetime.now() + timedelta(days=trial_days) if trial_days > 0 else None
    next_billing = datetime.now() + timedelta(days=30)
    
    subscription = Subscription(
        company_id=company.id,
        plan_name=company_data.plan,
        monthly_price=company_data.monthly_price or 0.0,
        modules=company_data.modules or {
            "ventas": True,
            "mail": False,
            "gps": False,
            "condominios": False
        },
        trial_ends_at=trial_ends,
        next_billing_date=next_billing,
        status="active"
    )
    db.add(subscription)
    
    plain_password = generate_password()
    hashed_password = pwd_context.hash(plain_password)
    
    admin_user = User(
        name=company_data.admin_name,
        email=company_data.admin_email,
        password=hashed_password,
        company_id=company.id,
        role="admin"
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    
    return {
        "id": company.id,
        "name": company.name,
        "email": company_data.admin_email,
        "phone": company.phone,
        "address": company.address,
        "status": company.status,
        "created_at": company.created_at,
        "admin_name": company_data.admin_name,
        "subscription": {
            "plan": subscription.plan_name,
            "modules": subscription.modules,
            "status": subscription.status,
            "trial_ends_at": subscription.trial_ends_at,
            "next_billing_date": subscription.next_billing_date
        },
        "user_count": 1,
        "admin_password": plain_password
    }

@router.get("/companies")
def list_companies(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar empresas con filtro opcional de estado"""
    query = db.query(Company)
    
    if status:
        query = query.filter(Company.status == status)
    
    companies = query.all()
    
    result = []
    for company in companies:
        subscription = db.query(Subscription).filter(
            Subscription.company_id == company.id
        ).first()
        
        user_count = db.query(User).filter(User.company_id == company.id).count()
        
        result.append({
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "phone": company.phone,
            "address": company.address,
            "status": company.status,
            "created_at": company.created_at,
            "subscription": {
                "plan": subscription.plan_name if subscription else "none",
                "modules": subscription.modules if subscription else {},
                "status": subscription.status if subscription else "inactive",
                "monthly_price": subscription.monthly_price if subscription else 0,
                "trial_ends_at": subscription.trial_ends_at if subscription else None,
                "next_billing_date": subscription.next_billing_date if subscription else None
            } if subscription else None,
            "user_count": user_count
        })
    
    return result

@router.get("/companies/{company_id}")
def get_company_details(company_id: int, db: Session = Depends(get_db)):
    """Ver detalles completos de una empresa"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    subscription = db.query(Subscription).filter(
        Subscription.company_id == company_id
    ).first()
    
    users = db.query(User).filter(User.company_id == company_id).all()
    
    payments = db.query(PaymentHistory).filter(
        PaymentHistory.company_id == company_id
    ).order_by(PaymentHistory.created_at.desc()).limit(10).all()
    
    return {
        "id": company.id,
        "name": company.name,
        "email": company.email,
        "phone": company.phone,
        "address": company.address,
        "status": company.status,
        "created_at": company.created_at,
        "updated_at": company.updated_at,
        "subscription": {
            "id": subscription.id if subscription else None,
            "plan": subscription.plan_name if subscription else "none",
            "monthly_price": subscription.monthly_price if subscription else 0,
            "status": subscription.status if subscription else "inactive",
            "modules": subscription.modules if subscription else {},
            "max_users": subscription.max_users if subscription else 0,
            "max_deals": subscription.max_deals if subscription else 0,
            "trial_ends_at": subscription.trial_ends_at if subscription else None,
            "next_billing_date": subscription.next_billing_date if subscription else None,
            "activated_at": subscription.activated_at if subscription else None,
            "suspended_at": subscription.suspended_at if subscription else None
        },
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role
            } for u in users
        ],
        "payment_history": [
            {
                "id": p.id,
                "amount": p.amount,
                "currency": p.currency,
                "status": p.status,
                "payment_method": p.payment_method,
                "description": p.description,
                "paid_at": p.paid_at,
                "created_at": p.created_at
            } for p in payments
        ]
    }

@router.put("/companies/{company_id}")
def update_company(
    company_id: int,
    company_data: CompanyUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar datos de empresa"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    for field, value in company_data.model_dump(exclude_unset=True).items():
        setattr(company, field, value)
    
    db.commit()
    db.refresh(company)
    
    return {"message": "Empresa actualizada", "company": company}

@router.post("/companies/{company_id}/activate")
def activate_company(company_id: int, db: Session = Depends(get_db)):
    """Activar empresa"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    company.status = "active"
    
    subscription = db.query(Subscription).filter(Subscription.company_id == company_id).first()
    if subscription:
        subscription.status = "active"
        subscription.suspended_at = None
    
    db.commit()
    
    return {"message": f"Empresa {company.name} activada"}

@router.post("/companies/{company_id}/suspend")
def suspend_company(company_id: int, db: Session = Depends(get_db)):
    """Suspender empresa por falta de pago"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    company.status = "suspended"
    
    subscription = db.query(Subscription).filter(Subscription.company_id == company_id).first()
    if subscription:
        subscription.status = "suspended"
        subscription.suspended_at = datetime.now()
    
    db.commit()
    
    return {"message": f"Empresa {company.name} suspendida"}

@router.post("/companies/{company_id}/users")
def create_user_for_company(
    company_id: int,
    user_data: UserCreateAdmin,
    db: Session = Depends(get_db)
):
    """Crear usuario para una empresa"""
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ya existe")
    
    plain_password = None
    if user_data.auto_generate_password:
        plain_password = generate_password()
        hashed_password = pwd_context.hash(plain_password)
    else:
        hashed_password = pwd_context.hash("changeme123")
    
    user = User(
        name=user_data.name,
        email=user_data.email,
        password=hashed_password,
        company_id=company_id,
        role=user_data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "company_id": user.company_id,
        "role": user.role,
        "password_plain": plain_password
    }

@router.put("/companies/{company_id}/subscription")
def update_subscription(
    company_id: int,
    sub_data: SubscriptionUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar suscripción de empresa"""
    
    subscription = db.query(Subscription).filter(
        Subscription.company_id == company_id
    ).first()
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Suscripción no encontrada")
    
    for field, value in sub_data.model_dump(exclude_unset=True).items():
        setattr(subscription, field, value)
    
    db.commit()
    db.refresh(subscription)
    
    return subscription

@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    """Eliminar empresa"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    
    company_name = company.name
    db.delete(company)
    db.commit()
    
    return {"message": f"Empresa {company_name} eliminada"}
