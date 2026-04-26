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

with open(".assistant_id") as f:
    ASSISTANT_ID = f.read().strip()

with open("data/soil_plant_data.csv") as f:
    CSV_CONTEXT = f.read()

k2_timeout = httpx.Timeout(connect=10, read=None, write=10, pool=10)

SYSTEM_PROMPT = (
    "You are an expert agricultural advisor helping farmers make smart, "
    "data-driven decisions about their crops and soil health. "
    "You have access to sensor readings and reference documents provided below. "
    "Use ALL the context provided — CSV data, PDF excerpts, and anything else given. "
    "Give concrete, actionable advice a 17-year-old can understand. "
    "Keep answers under 500 characters. "
    "IMPORTANT: Always give your best answer. Never say 'I don't have enough data' "
    "without also providing a useful recommendation based on what you do know. "
    "If specific sensor data is missing, estimate based on typical agricultural ranges "
    "and clearly note your assumption. "
    "Always explain your reasoning briefly."
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
    messages_payload = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Question: {req.message}\n\n"
            f"=== Sensor data ===\n{CSV_CONTEXT}\n=== End ==="
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