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
    "You are an expert agricultural advisor helping farmers make smart, "
    "data-driven decisions about their crops and soil health. "
    "You have access to real sensor readings from CSV files. "
    "Use the schema below to interpret the data correctly.\n\n"
    f"{CSV_SCHEMA}\n"
    "Give concrete, actionable advice a 17-year-old can understand. "
    "IMPORTANT: Do NOT use any markdown formatting. No bold, no asterisks, no bullet points."
    "Structure your response as short punchy sentences separated by newlines. "
    "Line 1: What the data shows. "
    "Line 2: Whether it's healthy or not. "
    "Line 3: What to do right now. "
    "Keep total response under 500 characters."
    "If asked about specific readings, quote the actual values from the data. "
    "Always explain your reasoning briefly. "
    "If the user asks about a plant not in their sensor data, say you lack data for that plant "
    "and give general advice for that plant only. "
    "Do NOT reference the user's current sensor readings when answering about a different plant. "
    "Never ask clarifying questions. Always give a direct answer. Don't add unnecessary data or explanations."
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

    messages_payload = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Question: {req.message}\n\n"
            f"=== USER'S ACTUAL SENSOR READINGS (answer primarily from this) ===\n{user_context}\n\n"
            f"=== REFERENCE KNOWLEDGE BASE (use only to provide context or healthy ranges) ===\n{knowledge_context}\n"
            f"=== End ==="
        )},
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