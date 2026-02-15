"""
Servicio de email usando Resend API
"""
import requests
from typing import Optional
from datetime import datetime

RESEND_API_KEY = "re_vEbK2oeZ_PVQBXJRY9mxFmNr8iSbFZ5kS"
RESEND_API_URL = "https://api.resend.com/emails"

class EmailService:
    """Servicio para enviar emails con Resend"""
    
    def __init__(self):
        self.api_key = RESEND_API_KEY
        # Cambiar cuando verifiques el dominio en DNS:
        # self.from_email = "ConectaAI <noreply@conectaai.cl>"
        self.from_email = "ConectaAI <onboarding@resend.dev>"  # Dominio prueba
    
    def _send_email(self, to: str, subject: str, html: str) -> dict:
        """Método base para enviar emails"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "from": self.from_email,
            "to": [to],
            "subject": subject,
            "html": html
        }
        
        try:
            response = requests.post(RESEND_API_URL, json=data, headers=headers)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except requests.exceptions.RequestException as e:
            print(f"❌ Error enviando email: {e}")
            return {"success": False, "error": str(e)}
    
    def send_credentials_email(
        self,
        company_name: str,
        email: str,
        username: str,
        temporary_password: str,
        subdomain: str,
        plan: str
    ) -> dict:
        """Enviar credenciales de acceso a nueva empresa"""
        
        login_url = f"https://{subdomain}.conectaai.cl/login"
        
        subject = f"Bienvenido a ConectaAI - {company_name}"
        html = self._get_credentials_template(
            company_name=company_name,
            username=username,
            temporary_password=temporary_password,
            login_url=login_url,
            plan=plan,
            email=email
        )
        
        return self._send_email(email, subject, html)
    
    def send_payment_reminder(
        self,
        company_name: str,
        email: str,
        days_until_suspension: int,
        amount: float,
        payment_url: str
    ) -> dict:
        """Enviar recordatorio de pago"""
        
        subject = f"Recordatorio de Pago - {company_name}"
        html = self._get_payment_reminder_template(
            company_name=company_name,
            days_until_suspension=days_until_suspension,
            amount=amount,
            payment_url=payment_url
        )
        
        return self._send_email(email, subject, html)
    
    def _get_credentials_template(
        self,
        company_name: str,
        username: str,
        temporary_password: str,
        login_url: str,
        plan: str,
        email: str
    ) -> str:
        """Template HTML para credenciales"""
        return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }}
    .container {{
      background-color: white;
      border-radius: 10px;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }}
    .header {{
      text-align: center;
      margin-bottom: 30px;
    }}
    .logo {{
      font-size: 32px;
      font-weight: bold;
      color: #6366f1;
      margin-bottom: 10px;
    }}
    .title {{
      font-size: 24px;
      font-weight: bold;
      color: #1f2937;
      margin-bottom: 20px;
    }}
    .credentials-box {{
      background-color: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }}
    .credential-row {{
      margin: 15px 0;
    }}
    .credential-label {{
      font-weight: 600;
      color: #6b7280;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .credential-value {{
      font-size: 18px;
      font-weight: bold;
      color: #1f2937;
      font-family: 'Courier New', monospace;
      padding: 8px;
      background-color: white;
      border-radius: 4px;
      margin-top: 5px;
    }}
    .button {{
      display: inline-block;
      background-color: #6366f1;
      color: white !important;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      text-align: center;
      margin: 20px 0;
    }}
    .info-box {{
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }}
    .warning {{
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }}
    .footer {{
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🚀 ConectaAI</div>
      <div class="title">¡Bienvenido a ConectaAI!</div>
    </div>

    <p>Hola <strong>{company_name}</strong>,</p>
    
    <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>

    <div class="credentials-box">
      <div class="credential-row">
        <div class="credential-label">Usuario</div>
        <div class="credential-value">{username}</div>
      </div>
      <div class="credential-row">
        <div class="credential-label">Contraseña Temporal</div>
        <div class="credential-value">{temporary_password}</div>
      </div>
      <div class="credential-row">
        <div class="credential-label">Plan Activo</div>
        <div class="credential-value">{plan.upper()}</div>
      </div>
      <div class="credential-row">
        <div class="credential-label">URL de Acceso</div>
        <div class="credential-value">{login_url}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="{login_url}" class="button">Acceder a mi CRM</a>
    </div>

    <div class="warning">
      <strong>⚠️ Importante:</strong> Por seguridad, cambia tu contraseña temporal en tu primer inicio de sesión.
    </div>

    <div class="info-box">
      <strong>💡 Próximos pasos:</strong>
      <ol>
        <li>Inicia sesión con tus credenciales</li>
        <li>Cambia tu contraseña</li>
        <li>Configura tu marca blanca (logo y colores)</li>
        <li>Invita a tu equipo</li>
        <li>Empieza a gestionar tus ventas</li>
      </ol>
    </div>

    <p>Si tienes alguna pregunta, no dudes en contactarnos por WhatsApp al +56 9 3531 8909.</p>

    <p>¡Éxito en tus ventas! 🎯</p>

    <div class="footer">
      <p><strong>ConectaAI</strong> - CRM Inteligente con IA</p>
      <p>Este email fue enviado a {email}</p>
      <p style="font-size: 12px; margin-top: 10px;">
        <a href="{login_url}" style="color: #6366f1;">Iniciar Sesión</a> • 
        <a href="https://wa.me/56935318909" style="color: #6366f1;">WhatsApp</a>
      </p>
    </div>
  </div>
</body>
</html>
        """
    
    def _get_payment_reminder_template(
        self,
        company_name: str,
        days_until_suspension: int,
        amount: float,
        payment_url: str
    ) -> str:
        """Template para recordatorio de pago"""
        return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }}
    .container {{
      background-color: white;
      border-radius: 10px;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }}
    .warning-header {{
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 4px;
    }}
    .button {{
      display: inline-block;
      background-color: #f59e0b;
      color: white !important;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      text-align: center;
      margin: 20px 0;
    }}
    .amount {{
      font-size: 32px;
      font-weight: bold;
      color: #f59e0b;
      text-align: center;
      margin: 20px 0;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="warning-header">
      <h2 style="margin: 0;">⚠️ Recordatorio de Pago</h2>
    </div>

    <p>Hola <strong>{company_name}</strong>,</p>
    
    <p>Tu suscripción a ConectaAI está próxima a vencer.</p>

    <div class="amount">${amount:,.0f} CLP</div>

    <p><strong>Días restantes:</strong> {days_until_suspension} días</p>

    <div style="text-align: center;">
      <a href="{payment_url}" class="button">Realizar Pago</a>
    </div>

    <p>Si no realizas el pago antes del vencimiento, tu cuenta será suspendida temporalmente.</p>

    <p>Cualquier consulta, contáctanos al +56 9 3531 8909.</p>

    <p>Saludos,<br>Equipo ConectaAI</p>
  </div>
</body>
</html>
        """


# Instancia global del servicio
email_service = EmailService()
