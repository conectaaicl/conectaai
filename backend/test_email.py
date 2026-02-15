import sys
from app.services.email_service import email_service

print("🧪 Probando envío de email...\n")

# Cambiar por tu email real
result = email_service.send_credentials_email(
    company_name="Empresa Demo",
    email="corp.conectaai@gmail.com",
    username="admin@empresademo",
    temporary_password="Demo123456!",
    subdomain="empresademo",
    plan="professional"
)

if result["success"]:
    print("✅ Email enviado exitosamente!")
    print(f"📨 ID: {result['data']}")
else:
    print("❌ Error:", result['error'])
