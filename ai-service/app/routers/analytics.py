"""
AI Feature 4: Student Learning Analytics (learning score + performance prediction)
AI Feature 5: Personalized Recommendations for students scoring below 50%.
"""
from bson import ObjectId
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import db

router = APIRouter()


class AnalyzeRequest(BaseModel):
    studentId: str
    courseId: str


def compute_learning_score(avg_quiz: float, avg_watch: float, chatbot_uses: int, retries: int) -> str:
    composite = (avg_quiz * 0.5) + (avg_watch * 0.3) + (min(chatbot_uses, 10) * 1.5) - (retries * 2)
    if composite >= 80:
        return "Excellent"
    if composite >= 60:
        return "Good"
    if composite >= 40:
        return "Average"
    return "Needs Improvement"


@router.post("/analyze-student")
async def analyze_student(req: AnalyzeRequest):
    events = list(db.analytics.find({
        "student": ObjectId(req.studentId),
        "course": ObjectId(req.courseId),
    }))

    quiz_events = [e for e in events if e["eventType"] == "quiz_attempt"]
    watch_events = [e for e in events if e["eventType"] == "video_watch"]
    chatbot_events = [e for e in events if e["eventType"] == "chatbot_query"]
    retry_events = [e for e in events if e["eventType"] == "retry"]

    avg_quiz = (
        sum(e["metadata"].get("score", 0) for e in quiz_events) / len(quiz_events)
        if quiz_events else 0
    )
    avg_watch = (
        sum(e["metadata"].get("completionPercent", 0) for e in watch_events) / len(watch_events)
        if watch_events else 0
    )

    learning_score = compute_learning_score(avg_quiz, avg_watch, len(chatbot_events), len(retry_events))

    at_risk = avg_quiz < 50 or avg_watch < 40
    prediction = "At risk — needs intervention" if at_risk else "On track to succeed"
    recommended_hours = 6 if at_risk else 2

    recommendations = []
    if avg_quiz < 50:
        recommendations = [
            "Revisit videos for weak topics",
            "Retake practice quizzes",
            "Review revision notes",
            "Ask the AI tutor to re-explain difficult concepts",
        ]

    return {
        "learningScore": learning_score,
        "performancePrediction": prediction,
        "recommendedStudyHoursPerWeek": recommended_hours,
        "isAtRisk": at_risk,
        "recommendations": recommendations,
        "stats": {
            "avgQuizScore": round(avg_quiz, 1),
            "avgWatchPercent": round(avg_watch, 1),
            "chatbotUsage": len(chatbot_events),
            "retries": len(retry_events),
        },
    }
