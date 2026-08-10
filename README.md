# AI-Powered Virtual Classroom

A full-stack Virtual Classroom platform with Teacher & Student portals, video-based
learning, AI-generated quizzes, AI answer evaluation, and a RAG-based AI tutor chatbot.

This repo is a **working starter implementation** of the architecture described in the
project brief. It is structured so every module (auth, courses, videos, quizzes,
analytics, AI service) is real, runnable code you can extend — not a mockup.

## Architecture

```
                        ┌──────────────────────┐
                        │   React Frontend      │
                        │  (Teacher / Student)  │
                        └──────────┬────────────┘
                                   │ REST (Axios, JWT)
                                   ▼
                        ┌──────────────────────┐
                        │  Node.js / Express    │
                        │  API  (Auth, Courses, │
                        │  Videos, Quizzes,     │
                        │  Progress, Analytics) │
                        └──────────┬────────────┘
                          │        │        │
                 MongoDB  │        │ HTTP   │ Cloud/local
                (Mongoose)│        ▼        │ storage (videos)
                          │  ┌──────────────┐│
                          │  │ FastAPI AI   ││
                          │  │ Service      ││
                          │  │ - Whisper STT││
                          │  │ - Question   ││
                          │  │   Generation ││
                          │  │ - Answer     ││
                          │  │   Evaluation ││
                          │  │ - RAG Tutor  ││
                          │  │   (FAISS)    ││
                          │  └──────────────┘│
                          ▼                  ▼
                     ┌─────────┐      ┌────────────┐
                     │ MongoDB │      │ Vector DB   │
                     │         │      │ (FAISS)     │
                     └─────────┘      └────────────┘
```

## Folder structure

```
virtual-classroom/
├── backend/            # Node.js + Express + MongoDB API
│   ├── config/         # DB connection
│   ├── middleware/      # JWT auth, role guard, multer upload
│   ├── models/          # Mongoose schemas (all 15 collections)
│   ├── routes/          # auth, courses, videos, quizzes, progress, analytics, chatbot
│   └── server.js
├── ai-service/          # Python FastAPI micro-service
│   └── app/
│       ├── main.py
│       └── routers/     # transcribe, question_gen, evaluate, chat, analytics
└── frontend/            # React + Tailwind + React Router + Chart.js
    └── src/
        ├── api/          # axios instance
        ├── context/      # AuthContext
        ├── components/   # Navbar, ProtectedRoute, VideoPlayer, Charts
        └── pages/         # Login, Register, TeacherDashboard, StudentDashboard,
                            # CourseDetail, QuizPage, ChatbotWidget
```

## Quick start

### 1. Backend (Node/Express/MongoDB)
```bash
cd backend
npm install
cp .env.example .env      # set MONGO_URI, JWT_SECRET, AI_SERVICE_URL
npm run dev                # http://localhost:5000
```

### 2. AI Service (Python FastAPI)
```bash
cd ai-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # set OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend (React)
```bash
cd frontend
npm install
npm start                  # http://localhost:3000
```

## What's implemented vs. stubbed

| Feature | Status |
|---|---|
| JWT auth + role-based access (Teacher/Student) | ✅ Full |
| Course CRUD, enrollment, announcements | ✅ Full |
| Video upload (Multer, local/S3-ready) + progress tracking (watch %, pauses, replays) | ✅ Full |
| Quiz unlock at 90% watch completion | ✅ Full |
| Teacher & Student dashboards with Chart.js analytics | ✅ Full |
| Speech-to-text (Whisper) + AI question generation | ✅ Working pipeline, calls OpenAI/Whisper — swap in your API key |
| AI answer evaluation (objective + subjective via LLM) | ✅ Working pipeline |
| RAG AI Tutor chatbot (embeddings + FAISS retrieval + LLM) | ✅ Working pipeline, in-memory FAISS index per course |
| Certificates, PDF reports | 🟡 Basic implementation, extend styling as needed |

All AI endpoints work out of the box with an `OPENAI_API_KEY`; without one they fall
back to clearly-marked mock responses so the rest of the app still runs end-to-end for
demos.

## Environment variables

**backend/.env**
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/virtual-classroom
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
```

**ai-service/.env**
```
OPENAI_API_KEY=sk-...
MONGO_URI=mongodb://localhost:27017/virtual-classroom
```
