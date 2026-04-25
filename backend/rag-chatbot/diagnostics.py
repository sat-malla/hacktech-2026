import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()

K2_API_KEY = os.getenv("K2_API_KEY")
API_KEY = os.getenv("BACKBOARD_API_KEY")
BASE_URL = "https://app.backboard.io/api"
HEADERS = {"X-API-Key": API_KEY}

with open(".assistant_id") as f:
    ASSISTANT_ID = f.read().strip()

async def run_diagnostics():
    print("\n=== STEP 1: ENV VARS ===")
    print(f"K2_API_KEY present:        {'YES' if K2_API_KEY else 'NO — check .env'}")
    print(f"BACKBOARD_API_KEY present: {'YES' if API_KEY else 'NO — check .env'}")
    print(f"ASSISTANT_ID:              {ASSISTANT_ID or 'EMPTY — check .assistant_id file'}")

    print("\n=== STEP 2: CREATE BACKBOARD THREAD ===")
    thread_id = None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{BASE_URL}/assistants/{ASSISTANT_ID}/threads",
                headers=HEADERS,
                data={},
            )
        print(f"Status: {r.status_code}")
        print(f"Raw response: {r.text}")
        thread_id = r.json().get("thread_id")
        print(f"thread_id: {thread_id}")
        assert thread_id, "FAIL: no thread_id in response"
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    print("\n=== STEP 3: CHECK DOCUMENTS INDEXED IN BACKBOARD ===")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{BASE_URL}/assistants/{ASSISTANT_ID}/documents",
                headers=HEADERS,
            )
        print(f"Status: {r.status_code}")
        body = r.json()
        print(f"Raw response: {json.dumps(body, indent=2)}")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")

    print("\n=== STEP 4: BACKBOARD MESSAGE WITH LLM ENABLED (real retrieval) ===")
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{BASE_URL}/threads/{thread_id}/messages",
                headers=HEADERS,
                data={
                    "content": "what is the soil moisture for tomato?",
                    "stream": "false",
                    "memory": "Auto",
                },
            )
        print(f"Status: {r.status_code}")
        body = r.json()
        print(f"All response keys: {list(body.keys())}")
        print(f"status field:          {body.get('status')}")
        print(f"retrieved_files:       {body.get('retrieved_files')}")
        print(f"retrieved_files_count: {body.get('retrieved_files_count')}")
        print(f"retrieved_memories:    {body.get('retrieved_memories')}")
        print(f"content preview:       {body.get('content', '')[:300]}")
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    print("\n=== STEP 5: K2 STREAMING (isolated test) ===")
    try:
        k2_timeout = httpx.Timeout(connect=10, read=None, write=10, pool=10)
        collected = ""
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
                    "messages": [{"role": "user", "content": "Say only: K2 is working"}],
                    "stream": True,
                },
            ) as response:
                print(f"Status: {response.status_code}")
                async for line in response.aiter_lines():
                    if not line or line == "data: [DONE]":
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    try:
                        chunk = json.loads(line)
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        collected += delta
                    except Exception:
                        continue
        print(f"K2 raw output: {collected}")
        assert collected, "FAIL: K2 returned nothing"
        print("PASS")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    print("\n=== STEP 6: FULL END-TO-END (Backboard context → K2 stream) ===")
    try:
        # Get context from Backboard
        async with httpx.AsyncClient(timeout=60) as client:
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
        parts = []
        if body.get("retrieved_files"):
            parts.append("Retrieved documents: " + ", ".join(body["retrieved_files"]))
        if body.get("retrieved_memories"):
            for m in body["retrieved_memories"]:
                parts.append(f"Memory: {m.get('content', '')}")
        if body.get("content"):
            parts.append("Data summary: " + body["content"])
        retrieved_context = "\n".join(parts) if parts else "No relevant sensor data found."
        print(f"Context being sent to K2:\n{retrieved_context[:400]}\n")

        # Stream through K2
        k2_timeout = httpx.Timeout(connect=10, read=None, write=10, pool=10)
        full_message = ""
        in_think = False
        past_think = False

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
                            "content": (
                                "You are an expert agricultural advisor. "
                                "Answer using ONLY the sensor data provided. "
                                "Be concise and actionable."
                            ),
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
                async for line in response.aiter_lines():
                    if not line or line == "data: [DONE]":
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    try:
                        chunk = json.loads(line)
                        delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        full_message += delta
                        if "<think>" in full_message and not past_think:
                            in_think = True
                        if "</think>" in full_message and in_think:
                            in_think = False
                            past_think = True
                    except Exception:
                        continue

        if "</think>" in full_message:
            final = full_message.split("</think>", 1)[1].strip()
        else:
            final = full_message.strip()

        print(f"Final K2 answer:\n{final}")
        assert final, "FAIL: no final answer produced"
        print("\nPASS — full pipeline working")
    except Exception as e:
        print(f"FAIL: {e}")

asyncio.run(run_diagnostics())