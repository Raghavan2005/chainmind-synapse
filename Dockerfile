FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services ./services
COPY scripts ./scripts
COPY data/model.joblib data/metrics.json data/claims_train.jsonl ./data/

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --retries=8 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/v1/health')"

CMD ["uvicorn", "services.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
