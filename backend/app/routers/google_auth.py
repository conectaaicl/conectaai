from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import os

from app.core.database import get_db
from app.models.google_integration import GoogleIntegration

router = APIRouter(prefix="/api/google", tags=["Google OAuth"])

# Configuración OAuth
SCOPES = ['https://www.googleapis.com/auth/calendar']
CLIENT_CONFIG = {
    "web": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
        "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI", "https://conectaai.cl/api/google/callback")],
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token"
    }
}

@router.get("/calendar/connect")
def connect_google_calendar(company_id: int = 1):
    """Iniciar flujo OAuth para conectar Google Calendar"""
    
    if not CLIENT_CONFIG["web"]["client_id"]:
        return {
            "error": "Google OAuth no configurado",
            "instructions": "Necesitas crear credenciales en Google Cloud Console",
            "steps": [
                "1. Ve a https://console.cloud.google.com",
                "2. Crea un proyecto nuevo",
                "3. Activa Google Calendar API",
                "4. Crea credenciales OAuth 2.0",
                "5. Agrega https://conectaai.cl/api/google/callback como redirect URI",
                "6. Copia CLIENT_ID y CLIENT_SECRET al .env"
            ]
        }
    
    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri=CLIENT_CONFIG["web"]["redirect_uris"][0]
    )
    
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        state=str(company_id),
        prompt='consent'
    )
    
    return {"authorization_url": authorization_url}

@router.get("/callback")
async def google_callback(
    request: Request,
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """Callback OAuth"""
    try:
        company_id = int(state)
        flow = Flow.from_client_config(
            CLIENT_CONFIG,
            scopes=SCOPES,
            redirect_uri=CLIENT_CONFIG["web"]["redirect_uris"][0]
        )
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        integration = db.query(GoogleIntegration).filter(
            GoogleIntegration.company_id == company_id
        ).first()
        
        if not integration:
            integration = GoogleIntegration(company_id=company_id)
            db.add(integration)
        
        integration.access_token = credentials.token
        integration.refresh_token = credentials.refresh_token
        integration.token_expiry = credentials.expiry
        integration.calendar_id = "primary"
        db.commit()
        
        return RedirectResponse(url="/dashboard/integraciones?success=google_calendar")
    except Exception as e:
        return RedirectResponse(url=f"/dashboard/integraciones?error={str(e)}")

@router.get("/calendar/status")
def get_calendar_status(company_id: int = 1, db: Session = Depends(get_db)):
    """Verificar estado de conexión"""
    integration = db.query(GoogleIntegration).filter(
        GoogleIntegration.company_id == company_id
    ).first()
    
    if not integration or not integration.access_token:
        return {"connected": False, "message": "No conectado"}
    
    if integration.token_expiry and integration.token_expiry < datetime.utcnow():
        return {"connected": False, "message": "Token expirado", "expired": True}
    
    return {
        "connected": True,
        "calendar_id": integration.calendar_id,
        "expires_at": integration.token_expiry.isoformat() if integration.token_expiry else None
    }

@router.post("/calendar/create-event")
def create_calendar_event(company_id: int, event_data: dict, db: Session = Depends(get_db)):
    """Crear evento en Google Calendar"""
    integration = db.query(GoogleIntegration).filter(
        GoogleIntegration.company_id == company_id
    ).first()
    
    if not integration or not integration.access_token:
        raise HTTPException(status_code=400, detail="Google Calendar no conectado")
    
    try:
        from google.oauth2.credentials import Credentials
        creds = Credentials(
            token=integration.access_token,
            refresh_token=integration.refresh_token,
            token_uri=CLIENT_CONFIG["web"]["token_uri"],
            client_id=CLIENT_CONFIG["web"]["client_id"],
            client_secret=CLIENT_CONFIG["web"]["client_secret"]
        )
        
        service = build('calendar', 'v3', credentials=creds)
        event = {
            'summary': event_data.get('title', 'Reunión'),
            'description': event_data.get('description', ''),
            'start': {'dateTime': event_data['start_time'], 'timeZone': 'America/Santiago'},
            'end': {'dateTime': event_data['end_time'], 'timeZone': 'America/Santiago'},
        }
        
        if 'attendees' in event_data:
            event['attendees'] = [{'email': email} for email in event_data['attendees']]
        
        created = service.events().insert(
            calendarId=integration.calendar_id,
            body=event,
            sendUpdates='all'
        ).execute()
        
        return {"success": True, "event_id": created['id'], "event_link": created.get('htmlLink')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/calendar/disconnect")
def disconnect_google_calendar(company_id: int = 1, db: Session = Depends(get_db)):
    """Desconectar Google Calendar"""
    integration = db.query(GoogleIntegration).filter(
        GoogleIntegration.company_id == company_id
    ).first()
    if integration:
        db.delete(integration)
        db.commit()
    return {"message": "Desconectado"}
