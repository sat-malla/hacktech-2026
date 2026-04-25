import asyncio
import httpx
import json
import os
import traceback
from dotenv import load_dotenv

load_dotenv()

K2_API_KEY = os.getenv("K2_API_KEY")
API_KEY = os.getenv("BACKBOARD_API_KEY")
BASE_URL = "https://app.backboard.io/api"
HEADERS = {"X-API-Key": API_KEY}

with open(".assistant_id") as f:
    ASSISTANT_ID = f.read().strip()

async def debug():
    # Step 1: create thread
    print("Creating thread...")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{BASE_URL}/assistants/{ASSISTANT_ID}/threads",
            headers=HEADERS,
            data={},
        )
    thread_id = r.json()["thread_id"]
    print(f"Thread: {thread_id}")

    # Step 2: Backboard call
    print("\nCalling Backboard...")
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10, read=60, write=10, pool=10)
        ) as client:
            r = await client.post(
                f"{BASE_URL}/threads/{thread_id}/messages",
                headers=HEADERS,
                data={
                    "content": "what is the soil moisture for tomato?",
                    "stream": "false",
                    "memory": "Auto",
                },
            )
        body = r.json()
        print(f"Backboard status: {body.get('status')}")
        print(f"Backboard content: {body.get('content', '')[:200]}")

        parts = []
        if body.get("retrieved_files"):
            parts.append("Retrieved documents: " + ", ".join(body["retrieved_files"]))
        if body.get("retrieved_memories"):
            for m in body["retrieved_memories"]:
                parts.append(f"Memory: {m.get('content', m.get('memory', ''))}")
        if body.get("content"):
            parts.append("Data summary: " + body["content"])
        retrieved_context = "\n".join(parts) if parts else "No relevant sensor data found."
        print(f"\nContext going to K2:\n{retrieved_context[:300]}")
    except Exception:
        print("EXCEPTION in Backboard call:")
        traceback.print_exc()
        return

    # Step 3: K2 stream — with full exception visibility
    print("\nStreaming K2...")
    try:
        k2_timeout = httpx.Timeout(connect=10, read=None, write=10, pool=10)
        full_message = ""
        in_think_block = False
        past_think_block = False

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
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert agricultural advisor. Be concise.",
                        },
                        {
                            "role": "user",
                            "content": (
                                f"Question: what is the soil moisture for tomato?\n\n"
                                f"--- Sensor data context ---\n{retrieved_context}\n"
                                f"--------------------------"
                            ),
                        },
                    ],
                    "stream": True,
                },
            ) as response:
                print(f"K2 status: {response.status_code}")
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    if line == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        full_message += delta

                        if "<think>" in full_message and not past_think_block:
                            in_think_block = True
                        if "</think>" in full_message and in_think_block:
                            in_think_block = False
                            past_think_block = True

                    except Exception:
                        print("EXCEPTION parsing K2 chunk:")
                        traceback.print_exc()
                        continue

        if "</think>" in full_message:
            final = full_message.split("</think>", 1)[1].strip()
        else:
            final = full_message.strip()

        print(f"\nFinal answer:\n{final}")

    except Exception:
        print("EXCEPTION in K2 stream:")
        traceback.print_exc()

asyncio.run(debug())