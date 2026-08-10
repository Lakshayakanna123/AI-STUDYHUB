"""
AI Feature 1: Automatic Question Generation & Speech-to-Text Transcription.

Pipeline triggered by the Node backend right after a teacher uploads a video:
  1. Speech-to-text (Groq Whisper API directly on video/audio file or ffmpeg fallback)
  2. Summarize + extract key concepts (LLM)
  3. Generate MCQ / True-False / Fill-blank / Short & Long answer questions (LLM)
  4. Store transcript + draft questions in MongoDB & rebuild AI Tutor course RAG index
"""
import json
import os
import subprocess
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel

from app.config import db, USE_MOCK_AI
from app.llm import chat_completion
from app.routers.chat import rebuild_course_index

router = APIRouter()


class ProcessVideoRequest(BaseModel):
    videoId: str
    videoUrl: str
    courseId: str


def extract_audio(video_path: str) -> str:
    """Extracts audio to .wav using ffmpeg if installed."""
    audio_path = video_path.rsplit(".", 1)[0] + ".wav"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-ar", "16000", "-ac", "1", audio_path],
            check=True, capture_output=True,
        )
        return audio_path
    except Exception as e:
        print(f"ffmpeg audio extraction skipped/failed: {e}")
        return ""


def transcribe_audio(video_or_audio_path: str, title: str = "", description: str = "") -> str:
    """Transcribes video/audio file using Groq Whisper API directly or with ffmpeg fallback."""
    if USE_MOCK_AI:
        return f"[MOCK TRANSCRIPT for '{title}'] This lecture covers key concepts of {title or 'the topic'}, including definitions, core algorithms, and practical code examples."

    from app.config import GROQ_API_KEY, GROQ_BASE_URL
    if not GROQ_API_KEY:
        return f"[MOCK TRANSCRIPT for '{title}'] Lecture on {title or 'the topic'}. Core definitions, code syntax, step-by-step logic, and working examples."

    # Try direct Groq Whisper transcription on the media file
    if video_or_audio_path and os.path.exists(video_or_audio_path):
        try:
            from openai import OpenAI
            groq_client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
            with open(video_or_audio_path, "rb") as f:
                result = groq_client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=f,
                )
            if result and result.text and len(result.text.strip()) > 10:
                return result.text.strip()
        except Exception as e:
            print(f"Direct Groq Whisper transcription failed for {video_or_audio_path}: {e}")

        # Try extracting audio with ffmpeg if direct upload failed
        audio_path = extract_audio(video_or_audio_path)
        if audio_path and os.path.exists(audio_path):
            try:
                from openai import OpenAI
                groq_client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
                with open(audio_path, "rb") as f:
                    result = groq_client.audio.transcriptions.create(
                        model="whisper-large-v3",
                        file=f,
                    )
                if result and result.text and len(result.text.strip()) > 10:
                    return result.text.strip()
            except Exception as e:
                print(f"Whisper transcription with extracted audio failed: {e}")

    # Fallback transcript if media file cannot be transcribed by API
    fallback_text = (
        f"This lecture is titled '{title or 'Lecture'}'. "
        f"{description or 'It covers core concepts, fundamentals, step-by-step examples, and practical exercises.'} "
        f"Key topics include problem solving, syntax, execution details, and key takeaways for student practice."
    )
    return fallback_text


def generate_questions(transcript: str) -> dict:
    system_prompt = (
        "You are an expert instructional designer. Given a lecture transcript, produce a JSON object "
        "with keys: summary (string), key_concepts (list of strings), and questions (list of objects). "
        "Each question object has: type (one of mcq, true_false, fill_blank, short_answer, long_answer), "
        "questionText, options (list, only for mcq), correctAnswer (for mcq/true_false/fill_blank), "
        "modelAnswer (for short_answer/long_answer), marks (int). "
        "Generate a balanced mix: 4 mcq, 2 true_false, 2 fill_blank, 2 short_answer, 1 long_answer."
    )
    raw = chat_completion(system_prompt, transcript, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"summary": "Lecture summary based on video transcript.", "key_concepts": ["Lecture Overview"], "questions": []}


@router.post("/process-video")
async def process_video(req: ProcessVideoRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(_process_video_task, req.videoId, req.videoUrl, req.courseId)
    return {"status": "processing_started", "videoId": req.videoId}


def _process_video_task(video_id: str, video_url: str, course_id: str):
    try:
        v_obj_id = ObjectId(video_id) if ObjectId.is_valid(video_id) else video_id
        c_obj_id = ObjectId(course_id) if ObjectId.is_valid(course_id) else course_id

        video_doc = db.videos.find_one({"_id": v_obj_id}) or {}
        v_title = video_doc.get("title", "")
        v_desc = video_doc.get("description", "")

        filename = os.path.basename(video_url)
        local_path = os.path.join(os.getcwd(), "..", "backend", "uploads", filename)

        if not os.path.exists(local_path):
            alt_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "backend", "uploads", filename)
            if os.path.exists(alt_path):
                local_path = alt_path

        print(f"Processing video {video_id} at {local_path}...")
        transcript_text = transcribe_audio(local_path, title=v_title, description=v_desc)

        gen = generate_questions(transcript_text)

        # Upsert transcript document
        db.transcripts.update_one(
            {"video": v_obj_id},
            {
                "$set": {
                    "video": v_obj_id,
                    "course": c_obj_id,
                    "rawText": transcript_text,
                    "summary": gen.get("summary", ""),
                    "keyConcepts": gen.get("key_concepts", []),
                }
            },
            upsert=True
        )

        # Upsert generated questions document
        db.generatedquestions.update_one(
            {"video": v_obj_id},
            {
                "$set": {
                    "video": v_obj_id,
                    "questions": gen.get("questions", []),
                    "reviewed": False,
                }
            },
            upsert=True
        )

        # Auto-publish quiz so students can take it immediately
        db.quizzes.update_one(
            {"video": v_obj_id},
            {
                "$set": {
                    "video": v_obj_id,
                    "course": c_obj_id,
                    "title": f"{v_title or 'Lecture'} Quiz",
                    "questions": gen.get("questions", []),
                    "published": True,
                }
            },
            upsert=True
        )

        # Mark video as transcript done
        db.videos.update_one(
            {"_id": v_obj_id},
            {"$set": {"transcriptStatus": "done", "questionsGenerated": True}},
        )

        rebuild_course_index(course_id)
        print(f"Successfully processed video {video_id} for course {course_id}!")

    except Exception as e:
        db.videos.update_one(
            {"_id": ObjectId(video_id) if ObjectId.is_valid(video_id) else video_id},
            {"$set": {"transcriptStatus": "failed"}}
        )
        print(f"process_video failed for {video_id}: {e}")