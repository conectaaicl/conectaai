import sys
sys.path.insert(0, '/app')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.wa_platform import router as wa_router
from app.core import database  # noqa

app = FastAPI(title='WhatsApp Microservice', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(wa_router)

@app.get('/health')
def health():
    return {'ok': True, 'service': 'wa'}
