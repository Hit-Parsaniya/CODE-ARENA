FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies if required for database connectivity
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    netcat-traditional \
    cppcheck \
    checkstyle \
    default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and Alembic config
COPY . .

EXPOSE 8000

# Run migrations and start FastAPI server
CMD ["sh", "-c", "alembic upgrade head 2>&1 || true; uvicorn app.main:app --host 0.0.0.0 --port 8000"]
