import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/virtual-classroom")

mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
try:
    db = mongo_client.get_default_database()
except Exception:
    db = mongo_client.get_database("virtual-classroom")

VECTOR_STORE_CACHE = {}

USE_MOCK_AI = not bool(GROQ_API_KEY)