# syntax=docker/dockerfile:1
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN --mount=type=cache,id=pip-conectaai,target=/root/.cache/pip \
    pip install -r requirements.txt gunicorn
COPY . .
CMD ["gunicorn", "app.main:app", "-w", "3", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8003", "--timeout", "60"]
