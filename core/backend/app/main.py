from fastapi import FastAPI

app = FastAPI(title="ConectaAI Core")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "core"
    }

