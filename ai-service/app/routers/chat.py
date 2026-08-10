"""
AI Feature 3: AI Tutor Chatbot (RAG).

Builds a per-course index from lecture transcripts. On each question,
retrieves the most relevant transcript chunks using TF-IDF & term matching
and sends them as context to the LLM so answers are grounded in the course's material.
"""
import re
import numpy as np
from collections import Counter
from fastapi import APIRouter
from pydantic import BaseModel

from app.config import db, VECTOR_STORE_CACHE
from app.llm import chat_completion, embed_texts

router = APIRouter()

CHUNK_SIZE = 500  # characters per chunk


class ChatRequest(BaseModel):
    courseId: str
    question: str


def chunk_text(text: str, size: int = CHUNK_SIZE) -> list[str]:
    return [text[i:i + size] for i in range(0, len(text), size) if text[i:i + size].strip()]


def _as_object_id(id_str: str):
    try:
        from bson import ObjectId
        if ObjectId.is_valid(id_str):
            return ObjectId(id_str)
        return id_str
    except Exception:
        return id_str


def rebuild_course_index(course_id: str):
    """Pulls all transcripts for a course, chunks them, and caches in-memory index."""
    c_obj = _as_object_id(course_id)
    videos = list(db.videos.find({"course": {"$in": [course_id, c_obj]}}))
    video_ids = [v["_id"] for v in videos] + [str(v["_id"]) for v in videos]

    transcripts = list(db.transcripts.find({
        "$or": [
            {"course": {"$in": [course_id, c_obj]}},
            {"video": {"$in": video_ids}}
        ]
    }))

    chunks = []
    for t in transcripts:
        raw_text = t.get("rawText", "").strip()
        if raw_text:
            chunks.extend(chunk_text(raw_text))

    if not chunks:
        VECTOR_STORE_CACHE[course_id] = {"chunks": []}
        return

    VECTOR_STORE_CACHE[course_id] = {"chunks": chunks}


def rank_chunks(question: str, chunks: list[str], top_k: int = 3) -> list[str]:
    """Ranks transcript chunks based on TF-IDF similarity and keyword overlap."""
    q_tokens = [w.lower() for w in re.findall(r'\b\w+\b', question) if len(w) > 1]
    if not q_tokens or not chunks:
        return chunks[:top_k]

    doc_tokens = [[w.lower() for w in re.findall(r'\b\w+\b', chunk)] for chunk in chunks]
    all_words = set(q_tokens)
    for dt in doc_tokens:
        all_words.update(dt)

    vocab = sorted(list(all_words))
    vocab_map = {w: i for i, w in enumerate(vocab)}

    num_docs = len(chunks)
    df = Counter()
    for dt in doc_tokens:
        for w in set(dt):
            df[w] += 1

    idf = {w: float(np.log((num_docs + 1) / (df[w] + 1)) + 1.0) for w in vocab}

    # Vectorize docs
    doc_vecs = []
    for dt in doc_tokens:
        vec = np.zeros(len(vocab), dtype=float)
        counts = Counter(dt)
        tot = max(len(dt), 1)
        for w, cnt in counts.items():
            vec[vocab_map[w]] = (cnt / tot) * idf[w]
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
        doc_vecs.append(vec)

    # Vectorize question
    q_vec = np.zeros(len(vocab), dtype=float)
    q_counts = Counter(q_tokens)
    q_tot = max(len(q_tokens), 1)
    for w, cnt in q_counts.items():
        if w in vocab_map:
            q_vec[vocab_map[w]] = (cnt / q_tot) * idf[w]
    q_norm = float(np.linalg.norm(q_vec))
    if q_norm > 0:
        q_vec = q_vec / q_norm

    scores = []
    for i, d_vec in enumerate(doc_vecs):
        sim = float(np.dot(d_vec, q_vec))
        overlap = len(set(q_tokens).intersection(set(doc_tokens[i])))
        total_score = sim + (overlap * 0.5)
        scores.append((total_score, chunks[i]))

    scores.sort(key=lambda x: x[0], reverse=True)
    return [c for s, c in scores[:top_k]]


def retrieve_context(course_id: str, question: str, top_k: int = 3) -> list[str]:
    index = VECTOR_STORE_CACHE.get(course_id)
    if not index or not index.get("chunks"):
        rebuild_course_index(course_id)
        index = VECTOR_STORE_CACHE.get(course_id, {"chunks": []})

    chunks = index.get("chunks", [])
    if not chunks:
        # Re-check database directly in case transcripts were just added
        rebuild_course_index(course_id)
        index = VECTOR_STORE_CACHE.get(course_id, {"chunks": []})
        chunks = index.get("chunks", [])

    if not chunks:
        return []

    return rank_chunks(question, chunks, top_k=top_k)


@router.post("/ask")
async def ask(req: ChatRequest):
    context_chunks = retrieve_context(req.courseId, req.question)

    if context_chunks:
        context = "\n---\n".join(context_chunks)
        system_prompt = (
            "You are an expert AI Tutor for this course. Your task is to answer the student's question "
            "clearly, accurately, and thoroughly using the provided lecture context below. Explain concepts "
            "step-by-step, provide examples, and highlight key terms mentioned in the lecture material.\n\n"
            "Course Lecture Context:\n" + context
        )
    else:
        system_prompt = (
            "You are an expert AI Tutor for this course. The lecture transcripts for this course are currently "
            "being processed or have not been uploaded yet. Inform the student politely that lecture context is "
            "still being indexed, and answer their question based on standard educational knowledge while advising "
            "them to review the lecture video."
        )

    answer = chat_completion(system_prompt, req.question)
    return {"answer": answer, "sources": context_chunks}


@router.post("/reindex/{course_id}")
async def reindex(course_id: str):
    rebuild_course_index(course_id)
    return {"status": "reindexed", "courseId": course_id}

