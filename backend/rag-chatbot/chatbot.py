from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import os
import re
from dotenv import load_dotenv

import csv_sync

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s | %(message)s")

K2_API_KEY = os.getenv("K2_API_KEY")
BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")
BASE_URL = "https://app.backboard.io/api"
HEADERS = {"X-API-Key": BACKBOARD_API_KEY}

AGRI_KEYWORDS = {
    "soil", "moisture", "nitrogen", "humidity", "temperature", "crop", "plant",
    "water", "irrigat", "fertiliz", "harvest", "seed", "grow", "farm", "field",
    "sensor", "data", "reading", "level", "healthy", "pH", "nutrient", "root",
    "leaf", "yield", "pest", "disease", "compost", "drainage", "tomato", "lettuce",
    "pepper", "cucumber", "carrot", "spinach", "broccoli", "raspberry", "guava"
}

def is_agri_query(message: str) -> bool:
    msg_lower = message.lower()
    return any(keyword in msg_lower for keyword in AGRI_KEYWORDS)

def clean(text: str) -> str:
    if "</think>" in text:
        text = text.split("</think>")[-1]
    elif "<think>" in text:
        text = text.split("<think>")[0]
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"#{1,6}\s+", "", text)
    text = re.sub(r"^\s*[-•]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"≈", "~", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

with open(".assistant_id") as f:
    ASSISTANT_ID = f.read().strip()

with open("data/soil_plant_data.csv") as f:
    CSV_CONTEXT = f.read()

k2_timeout = httpx.Timeout(connect=10, read=None, write=10, pool=10)

CSV_SCHEMA = """
    The sensor CSV files contain the following columns:
    - timestamp: when the reading was taken
    - soil_moisture: percentage of water content in soil (0-100%)
    - nitrogen_concentration: nitrogen level in ppm
    - humidity: air humidity percentage
    - soil_temperature: soil temperature in Celsius
    - air_temperature: air temperature in Celsius
    - plant_species: the crop being monitored at that sensor location

    Healthy ranges:
    - soil_moisture: 40-70%
    - nitrogen_concentration: 10-14 ppm
    - humidity: 65-80%
    - soil_temperature: 16-24°C
    - air_temperature: 19-29°C
"""

SYSTEM_PROMPT = (
    "You are SoilLink, an AI assistant that answers questions STRICTLY using the provided knowledge base and sensor data. "
    "You must NOT use your own training knowledge to answer plant, soil, crop, or sensor questions. "
    "If the answer is not in the provided data, say: 'I don't have that information in the knowledge base.' "
    "Do not invent facts, ranges, or advice from memory. "

    "Answer priority: "
    "1. USER'S ACTUAL SENSOR READINGS — use these for any question about current conditions. "
    "2. REFERENCE KNOWLEDGE BASE — use this for plant care and interpretation questions. "
    "3. If neither source contains the answer, say so explicitly. Do not guess. "

    "Specific Instructions: "
    "Your responses must be plain text only. "
    "Do not use markdown, bullet points, asterisks, triple backticks, bold, italics, or any special formatting. "
    "Structure your response as short punchy sentences separated by newlines. "
    "Line 1: What the data shows (cite the actual value from the sensor data or knowledge base). "
    "Line 2: Whether it is healthy or not (based only on ranges found in the knowledge base). "
    "Line 3: What to do right now (based only on knowledge base recommendations). "
    "Keep total response under 500 characters. "
    "Never ask clarifying questions. Always give a direct answer. "
    "Never add information not found in the provided sources. "

    "Use the schema below to interpret sensor data correctly.\n\n"
    f"{CSV_SCHEMA}\n"
)

NON_AGRI_PROMPT = (
    "You are SoilLink, a friendly AI assistant for farmers. "
    "The user is making general conversation unrelated to agriculture or sensor data. "
    "Respond naturally and conversationally. "
    "If they say hello, greet them warmly. "
    "If they need help, ask what they need help with. "
    "Keep it short, friendly, and natural. "
    "No markdown, no bullet points, plain text only."
)

def clean(text: str) -> str:
    if "</think>" in text:
        text = text.split("</think>")[-1]
    elif "<think>" in text:
        text = text.split("<think>")[0]
    text = re.sub(r"~~(.+?)~~", r"\1", text)
    return text.strip()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(csv_sync.run(ASSISTANT_ID, BACKBOARD_API_KEY))
    logging.getLogger(__name__).info("csv_sync started (poll=%ds)", csv_sync.POLL_INTERVAL_S)
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

def load_csv_context(path: str) -> str:
    parts = []
    if not os.path.exists(path):
        return ""
    for fname in sorted(os.listdir(path)):
        if fname.endswith(".csv"):
            with open(os.path.join(path, fname)) as f:
                parts.append(f"=== {fname} ===\n{f.read()}")
    return "\n\n".join(parts)

user_context = load_csv_context("../ml-prediction/csv_output")
knowledge_context = load_csv_context("data")

def classify_intent(message: str) -> str:
    msg = message.lower().strip()
    
    # Data intent — user asking about THEIR current conditions
    data_patterns = [
        r"\bmy (soil|crop|plant|field|farm|sensor|data|reading)\b",
        r"\b(should i|do i need to|when should i) (water|irrigate|fertilize|harvest|plant)\b",
        r"\bhow (is|are) my\b",
        r"\bwhat('s| is) (my|the current|today's)\b",
        r"\b(today|right now|currently|latest|recent)\b",
        r"\b(too (wet|dry|hot|cold)|healthy|unhealthy)\b",
        r"\breadings?\b",
        r"\bsensor\b",
    ]
    
    # Agri intent — general plant/farming question, no personal data needed
    agri_patterns = [
        r"\b(how (do|to|can)|tips?|advice|guide|best way)\b.*(plant|grow|care|water|fertilize|harvest)\b",
        r"\b(what (does|do)|why (does|do|is|are))\b.*(plant|soil|crop|flower|vegetable|fruit)\b",
        r"\b(plant|grow|farm|garden|crop|soil|seed|harvest|fertilize|irrigate|compost|pest|disease)\b",
    ]
    
    for pattern in data_patterns:
        if re.search(pattern, msg):
            return "data"
    
    for pattern in agri_patterns:
        if re.search(pattern, msg):
            return "agri"
    
    return "chat"

async def _backboard_retrieve(question: str) -> str:
    """
    Create a Backboard thread, post the question, and return the retrieved
    context string. Falls back to empty string on any error so the chat
    endpoint can continue with inline CSV context.
    """
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                f"{BASE_URL}/assistants/{ASSISTANT_ID}/threads",
                headers=HEADERS,
                data={},
            )
            if r.status_code != 200:
                return ""
            thread_id = r.json().get("thread_id", "")
            if not thread_id:
                return ""

            r2 = await client.post(
                f"{BASE_URL}/threads/{thread_id}/messages",
                headers=HEADERS,
                data={"content": question, "stream": "false", "memory": "Auto"},
            )
            if r2.status_code != 200:
                return ""
            body = r2.json()

        parts: list[str] = []
        if body.get("retrieved_files"):
            parts.append("Retrieved files: " + ", ".join(body["retrieved_files"]))
        for mem in body.get("retrieved_memories") or []:
            parts.append(mem.get("content", ""))
        if body.get("content"):
            parts.append(body["content"])
        return "\n".join(parts)
    except Exception as e:
        logging.getLogger(__name__).warning("backboard retrieve error: %s", e)
        return ""


@app.post("/chat")
async def chat(req: ChatRequest):
    # Always load the most-recent sensor CSVs for inline context (fast path)
    user_data_parts = []
    csv_output_path = "../ml-prediction/csv_output"
    if os.path.exists(csv_output_path):
        for fname in sorted(os.listdir(csv_output_path))[-10:]:  # last 10 CSVs
            if fname.endswith(".csv"):
                with open(os.path.join(csv_output_path, fname)) as f:
                    user_data_parts.append(f"=== {fname} ===\n{f.read()}")

    knowledge_parts = []
    for fname in sorted(os.listdir("data")):
        if fname.endswith(".csv"):
            with open(os.path.join("data", fname)) as f:
                knowledge_parts.append(f"=== {fname} ===\n{f.read()}")

    inline_sensor   = "\n\n".join(user_data_parts) if user_data_parts else "No sensor data available."
    inline_knowledge = "\n\n".join(knowledge_parts) if knowledge_parts else "No reference data available."

    # Retrieve RAG context from Backboard (non-blocking — degrades gracefully)
    rag_context = await _backboard_retrieve(req.message)

    intent = classify_intent(req.message)

    if intent == "data":
        rag_block = f"\n=== BACKBOARD RAG CONTEXT ===\n{rag_context}\n" if rag_context else ""
        user_content = (
            f"Question: {req.message}\n\n"
            f"=== USER'S ACTUAL SENSOR READINGS ===\n{inline_sensor}\n"
            f"{rag_block}"
            f"=== REFERENCE KNOWLEDGE BASE ===\n{inline_knowledge}\n=== End ==="
        )
        system = SYSTEM_PROMPT
    elif intent == "agri":
        rag_block = f"\n=== BACKBOARD RAG CONTEXT ===\n{rag_context}\n" if rag_context else ""
        user_content = (
            f"Question: {req.message}\n\n"
            f"Answer using ONLY the sources below. Do not use outside knowledge.\n"
            f"{rag_block}"
            f"=== REFERENCE KNOWLEDGE BASE ===\n{inline_knowledge}\n=== End ==="
        )
        system = SYSTEM_PROMPT
    else:
        user_content = req.message
        system = NON_AGRI_PROMPT

    messages_payload = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]

    full_message = ""
    async with httpx.AsyncClient(timeout=k2_timeout) as client:
        async with client.stream(
            "POST",
            "https://api.k2think.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {K2_API_KEY}", "Content-Type": "application/json"},
            json={"model": "MBZUAI-IFM/K2-Think-v2", "messages": messages_payload, "stream": True},
        ) as response:
            async for line in response.aiter_lines():
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    line = line[6:]
                try:
                    delta = json.loads(line)["choices"][0]["delta"].get("content", "")
                    full_message += delta
                except Exception:
                    continue
    return {"response": clean(full_message)}