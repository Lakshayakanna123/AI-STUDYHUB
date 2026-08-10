"""
AI Feature 2: Automatic Answer Evaluation.

Called by the Node backend when a student submits a quiz. Handles objective
question types (mcq, true_false, fill_blank) with exact/fuzzy matching, and
subjective types (short_answer, long_answer) via LLM comparison against the
teacher's model answer, returning marks, correctness %, missing concepts,
and improvement suggestions.
"""
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from app.llm import chat_completion

router = APIRouter()


class Question(BaseModel):
    id: Optional[str] = None
    type: str
    questionText: str
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = None
    modelAnswer: Optional[str] = None
    marks: int = 1


class AnswerIn(BaseModel):
    questionId: str
    studentAnswer: str


class EvaluateRequest(BaseModel):
    questions: List[dict]
    answers: List[AnswerIn]


def evaluate_objective(question: dict, student_answer: str) -> dict:
    correct = (question.get("correctAnswer") or "").strip().lower()
    given = (student_answer or "").strip().lower()
    is_correct = correct == given
    marks = question.get("marks", 1) if is_correct else 0
    return {
        "marksAwarded": marks,
        "maxMarks": question.get("marks", 1),
        "correctnessPercent": 100 if is_correct else 0,
        "strengths": ["Correct answer"] if is_correct else [],
        "missingConcepts": [] if is_correct else [question.get("correctAnswer", "")],
        "suggestions": [] if is_correct else [f"Review: {question.get('questionText')}"],
    }


def evaluate_subjective(question: dict, student_answer: str) -> dict:
    system_prompt = (
        "You are grading a student's answer against a model answer. Respond ONLY as JSON with keys: "
        "marksAwarded (number, out of max_marks), correctnessPercent (0-100), strengths (list of short strings), "
        "missingConcepts (list of short strings), suggestions (list of short actionable strings)."
    )
    user_prompt = json.dumps({
        "question": question.get("questionText"),
        "model_answer": question.get("modelAnswer", ""),
        "student_answer": student_answer,
        "max_marks": question.get("marks", 1),
    })
    raw = chat_completion(system_prompt, user_prompt, json_mode=True)
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {"marksAwarded": 0, "correctnessPercent": 0, "strengths": [], "missingConcepts": [], "suggestions": []}

    result.setdefault("maxMarks", question.get("marks", 1))
    return result


@router.post("/quiz")
async def evaluate_quiz(req: EvaluateRequest):
    answer_map = {a.questionId: a.studentAnswer for a in req.answers}
    results = []
    total_score = 0
    total_marks = 0

    for q in req.questions:
        q_id = str(q.get("_id") or q.get("id", ""))
        student_answer = answer_map.get(q_id, "")
        total_marks += q.get("marks", 1)

        if q.get("type") in ("mcq", "true_false", "fill_blank"):
            result = evaluate_objective(q, student_answer)
        else:
            result = evaluate_subjective(q, student_answer)

        result["questionId"] = q_id
        result["studentAnswer"] = student_answer
        total_score += result.get("marksAwarded", 0)
        results.append(result)

    feedback_summary = (
        f"Scored {total_score}/{total_marks}. "
        + ("Strong overall understanding." if total_marks and total_score / total_marks >= 0.7
           else "Some concepts need review — see suggestions per question.")
    )

    return {
        "results": results,
        "totalScore": total_score,
        "totalMarks": total_marks,
        "feedbackSummary": feedback_summary,
    }
