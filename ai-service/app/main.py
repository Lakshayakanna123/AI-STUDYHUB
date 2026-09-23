from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import transcribe, evaluate, chat, analytics

app = FastAPI(title="Virtual Classroom AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Virtual Classroom AI Service is running", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(transcribe.router, prefix="/transcribe", tags=["Question Generation"])
app.include_router(evaluate.router, prefix="/evaluate", tags=["Answer Evaluation"])
app.include_router(chat.router, prefix="/chat", tags=["AI Tutor (RAG)"])
app.include_router(analytics.router, prefix="/analytics", tags=["Learning Analytics"])
