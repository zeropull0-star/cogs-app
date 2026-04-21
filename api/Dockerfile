# C:\ledger\api\Dockerfile
FROM python:3.12-slim

WORKDIR /app

# 한글 폰트 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-nanum \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi uvicorn sqlalchemy psycopg[binary] python-jose pydantic \
    passlib==1.7.4 bcrypt==4.0.1 \
    python-multipart openpyxl \
    pillow reportlab \
    pdfplumber

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]