from fastapi import FastAPI

app = FastAPI(title="ConectaAI Bodegas")

@app.get("/health")
def health():
    return {"status": "ok", "service": "bodegas"}
