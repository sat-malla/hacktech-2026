import httpx
import gradio as gr
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

with open("data/soil_plant_data.csv", "r") as f:
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
    text = re.sub(r"~~", "", text)
    return text.strip()


def create_thread() -> str:
    response = httpx.post(
        f"{BASE_URL}/assistants/{ASSISTANT_ID}/threads",
        headers=HEADERS,
        data={},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["thread_id"]


async def fetch_rag_context(question: str, thread_id: str) -> str:
    """
    Query Backboard's RAG index for relevant chunks from ALL uploaded documents
    (CSV, PDFs, etc.) and return them as a combined context string.
    Falls back to raw CSV if RAG retrieval fails.
    """
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10, read=30, write=10, pool=10)
        ) as client:
            resp = await client.post(
                f"{BASE_URL}/threads/{thread_id}/messages",
                headers=HEADERS,
                data={
                    "content": question,
                    "stream": "false",
                    "memory": "Auto",
                    "send_to_llm": "false",
                    "top_k": "8",
                },
            )
            resp.raise_for_status()
            payload = resp.json()

            chunks = (
                payload.get("context")
                or payload.get("documents")
                or payload.get("chunks")
                or payload.get("retrieved")
                or []
            )

            if chunks:
                if isinstance(chunks, list):
                    parts = []
                    for c in chunks:
                        if isinstance(c, dict):
                            text = c.get("text") or c.get("content") or c.get("chunk") or str(c)
                        else:
                            text = str(c)
                        parts.append(text.strip())
                    combined = "\n\n---\n\n".join(parts)
                    print(f"[RAG] Retrieved {len(parts)} chunk(s) from Backboard index.")
                    return combined
                elif isinstance(chunks, str):
                    return chunks.strip()

            print(f"[RAG] Unexpected Backboard payload keys: {list(payload.keys())}")

    except Exception as e:
        print(f"[RAG] Retrieval error (falling back to CSV): {e}")

    print("[RAG] Using raw CSV as fallback context.")
    return f"[Fallback — full CSV data]\n{CSV_CONTEXT}"

async def stream_response(message: str, history):
    try:
        thread_id = create_thread()
    except Exception as e:
        yield f"Could not start session: {e}"
        return
 
    rag_context = await fetch_rag_context(message, thread_id)
 
    messages_payload = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Question: {message}\n\n"
            f"=== Retrieved knowledge ===\n{rag_context}\n=== End ==="
        )},
    ]
 
    full_message = ""
    try:
        async with httpx.AsyncClient(timeout=k2_timeout) as client:
            async with client.stream(
                "POST",
                "https://api.k2think.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {K2_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "MBZUAI-IFM/K2-Think-v2",
                    "messages": messages_payload,
                    "stream": True,
                },
            ) as response:
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    if line == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_message += delta
                    except Exception:
                        continue
    except Exception as e:
        print(f"[K2] Error: {e}")
 
    final = clean(full_message) or (
        "Check soil moisture (40-60%), nitrogen (20-40 ppm), pH (6.0-7.0). "
        "Upload more data for tailored advice."
    )
    yield final

chatbot = gr.ChatInterface(
    stream_response,
    title="Soil Intelligence Advisor",
    description=(
        "Ask about your farm's soil health, crop planning, or sensor readings. "
        "All uploaded documents (CSV + PDFs) are searched automatically."
    ),
    textbox=gr.Textbox(
        placeholder="e.g. Is my soil ready to plant guava next season?",
        container=False,
        autoscroll=True,
        scale=7,
    ),
    examples=[
        "Which plant species has the lowest soil moisture?",
        "Is the nitrogen level healthy for current crops?",
        "Should I plant guava in the north section next spring?",
        "What data am I missing to make better planting decisions?",
        "What does my latest PDF report say about phosphorus levels?",
    ],
)

if __name__ == "__main__":
    chatbot.launch()