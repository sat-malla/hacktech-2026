from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

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
    "You are an AI assistant designed to analyze plant sensor data and provide insights to a general consumer. "
    "Your goal is to make complex data easy to understand and actionable. "

    "Core Functionality: "
    "Analyze provided sensor data such as soil moisture, temperature, and light levels along with a knowledge base about plants. "
    "Generate clear, concise insights and recommendations. "
    "Avoid technical jargon. Explain findings in simple terms that a regular consumer can easily grasp. "
    "If a user asks about a plant not present in the sensor data, clearly state that you lack specific data for that plant, "
    "then provide general care advice for that plant based on your broader knowledge base. "
    "If the user engages in general conversation without mentioning keywords related to agriculture, data, crops, soil, or similar topics, "
    "respond as a typical friendly chatbot. "

    "Specific Instructions: "
    "Your responses must be plain text only. "
    "Do not use markdown, bullet points, asterisks, triple backticks, bold, italics, or any other special formatting. "
    "Insights should lead to practical steps the user can take to care for their plants. "
    "Structure your response as short punchy sentences separated by newlines. "
    "Line 1: What the data shows. "
    "Line 2: Whether it is healthy or not. "
    "Line 3: What to do right now. "
    "Keep total response under 500 characters. "
    "Never ask clarifying questions. Always give a direct answer. "
    "Do not add unnecessary data or explanations. "

    "Handling sensor data: "
    "Always confirm whether you have sensor data for the specific plant mentioned. "
    "When providing general advice, make it clear that it is not based on specific sensor readings. "
    "Do NOT reference the user's current sensor readings when answering about a plant not in the data. "

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

app = FastAPI()
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

@app.post("/chat")
async def chat(req: ChatRequest):
    user_data_parts = []
    for data_path in ["../ml-prediction/csv_output"]:
        if not os.path.exists(data_path):
            continue
        for fname in sorted(os.listdir(data_path)):
            if fname.endswith(".csv"):
                with open(os.path.join(data_path, fname)) as f:
                    content = f.read()
                user_data_parts.append(f"=== {fname} ===\n{content}")

    knowledge_parts = []
    for fname in sorted(os.listdir("data")):
        if fname.endswith(".csv"):
            with open(os.path.join("data", fname)) as f:
                content = f.read()
            knowledge_parts.append(f"=== {fname} ===\n{content}")

    user_context = "\n\n".join(user_data_parts) if user_data_parts else "No user sensor data available."
    knowledge_context = "\n\n".join(knowledge_parts) if knowledge_parts else "No reference data available."

    intent = classify_intent(req.message)

    if intent == "data":
        user_content = (
            f"Question: {req.message}\n\n"
            f"=== USER'S ACTUAL SENSOR READINGS ===\n{user_context}\n\n"
            f"=== REFERENCE KNOWLEDGE BASE ===\n{knowledge_context}\n=== End ==="
        )
        system = SYSTEM_PROMPT
    elif intent == "agri":
        user_content = (
            f"Question: {req.message}\n\n"
            f"=== REFERENCE KNOWLEDGE BASE ===\n{knowledge_context}\n=== End ==="
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
                except:
                    continue
    return {"response": clean(full_message)}