FROM python:3.12-slim

WORKDIR /app

# System deps (psycopg[binary] doesn't require libpq, but build tooling can help for some wheels)
RUN python -m pip install --no-cache-dir -U pip

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run migrations on start, then serve API
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

