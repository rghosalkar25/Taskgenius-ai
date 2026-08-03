"""
main.py
-------
FastAPI application entrypoint for TaskGenius AI.

Run with:
    uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.api.endpoints import analytics, auth, tasks
from app.database import Base, engine

# Create SQLite tables on startup if they don't already exist.
# NOTE: this only creates missing tables, it does NOT alter existing ones.
# Since this version adds new columns to `tasks` and a new `users` table,
# delete your old taskgenius.db once before running (dev data will be lost):
#     rm taskgenius.db
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TaskGenius AI",
    description="Smart NLP-Based To-Do List & Productivity Assistant",
    version="2.1.0",
)

# In production, set FRONTEND_URL to your deployed frontend origin, e.g.
# https://taskgenius-ai.vercel.app (comma-separate multiple origins if needed).
_extra_origins = os.environ.get("FRONTEND_URL", "")
allow_origins = ["http://localhost:5173"] + [o.strip() for o in _extra_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "TaskGenius AI backend"}
