"""
Thin wrapper so every router calls one chat_completion() function.
Uses Groq via its OpenAI-compatible endpoint. Falls back to mock output
when no GROQ_API_KEY is configured, so the pipeline stays demo-able.
"""
import re
import numpy as np
from collections import Counter
from app.config import GROQ_API_KEY, GROQ_BASE_URL, GROQ_CHAT_MODEL, USE_MOCK_AI

client = None
if not USE_MOCK_AI:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
    except ImportError:
        print("WARNING: GROQ_API_KEY is set but the 'openai' package isn't installed "
              "(pip install openai). Falling back to mock AI responses.")
        USE_MOCK_AI = True


def chat_completion(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    if USE_MOCK_AI or client is None:
        return _mock_response(user_prompt, json_mode)

    final_system = system_prompt
    if json_mode:
        final_system += "\n\nRespond ONLY with valid JSON. No markdown, no code fences, no commentary."

    models_to_try = [GROQ_CHAT_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    last_err = None

    for model in models_to_try:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": final_system},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
            )
            content = response.choices[0].message.content
            if json_mode and content:
                content = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return content
        except Exception as e:
            last_err = e
            print(f"Groq completion attempt failed with model {model}: {e}")
            continue

    print(f"All Groq models failed. Last error: {last_err}")
    return _mock_response(user_prompt, json_mode)


def _tokenize(text: str) -> list[str]:
    return [w.lower() for w in re.findall(r'\b\w+\b', text) if len(w) > 1]


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generates normalized TF-IDF vector embeddings for a list of text chunks."""
    if not texts:
        return []

    tokenized_docs = [_tokenize(t) for t in texts]
    all_words = set()
    for tokens in tokenized_docs:
        all_words.update(tokens)

    vocab = sorted(list(all_words))
    if not vocab:
        return [[0.0] for _ in texts]

    vocab_idx = {word: i for i, word in enumerate(vocab)}
    num_docs = len(texts)
    num_vocab = len(vocab)

    doc_freq = Counter()
    for tokens in tokenized_docs:
        for word in set(tokens):
            doc_freq[word] += 1

    idf = {word: float(np.log((num_docs + 1) / (df + 1)) + 1.0) for word, df in doc_freq.items()}

    vectors = []
    for tokens in tokenized_docs:
        vec = np.zeros(num_vocab, dtype=float)
        tf_counts = Counter(tokens)
        total_tokens = max(len(tokens), 1)
        for word, count in tf_counts.items():
            if word in vocab_idx:
                tf = count / total_tokens
                vec[vocab_idx[word]] = tf * idf.get(word, 1.0)

        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec = vec / norm
        vectors.append(vec.tolist())

    return vectors


def _mock_response(user_prompt: str, json_mode: bool) -> str:
    if json_mode:
        preview = user_prompt[:80].replace('"', "'")
        return '{"mock": true, "note": "Set GROQ_API_KEY in ai-service/.env for real AI output.", "prompt_preview": "%s"}' % preview
    return f"[MOCK RESPONSE — set GROQ_API_KEY for real output] Prompt was: {user_prompt[:120]}..."