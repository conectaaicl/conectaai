import sys
sys.path.insert(0, '/app')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.pagos_flow import router as pagos_flow_router
from app.routers.pagos_mp import router as pagos_mp_router
from app.routers.pagos_online import router as pagos_online_router
from app.routers.pagos_config import router as pagos_config_router
from app.core import database  # noqa

app = FastAPI(title='Pagos Microservice', version='1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(pagos_flow_router)
app.include_router(pagos_mp_router)
app.include_router(pagos_online_router)
app.include_router(pagos_config_router)

@app.get('/health')
def health():
    return {'ok': True, 'service': 'pagos'}
