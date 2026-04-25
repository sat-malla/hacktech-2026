import requests
import os
import time
import httpx

from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("BACKBOARD_API_KEY")
BASE_URL = "https://app.backboard.io/api"
HEADERS = {"X-API-Key": API_KEY}
DATA_PATH = r"data"
ASSISTANT_ID_FILE = ".assistant_id"

SUPPORTED_EXTENSIONS = {".csv", ".pdf", ".txt", ".md", ".json"}

def get_or_create_assistant():
    if os.path.exists(ASSISTANT_ID_FILE):
        with open(ASSISTANT_ID_FILE) as f:
            assistant_id = f.read().strip()
        if assistant_id:
            print(f"Using existing assistant: {assistant_id}")
            return assistant_id

    print("No assistant found, creating one...")
    response = requests.post(
        f"{BASE_URL}/assistants",
        headers=HEADERS,
        json={
            "name": "Soil Intelligence Advisor",
            "system_prompt": (
                "You are an expert agricultural advisor helping farmers make "
                "smart, data-driven decisions about their crops and soil health. "
                "Answer using ONLY the sensor data and documents provided. "
                "Give concrete, actionable, concise advice a 17 year old can understand. "
                "Keep answers under 500 characters. If data is insufficient, say so clearly. "
                "Always provide reasoning for your recommendations. "
                "If the user asks about something outside the provided data, provide the best "
                "information you can based on outside available data "
                "or use PDF documents as reference if provided."
            ),
        },
    )
    assistant_id = response.json()["assistant_id"]
    with open(ASSISTANT_ID_FILE, "w") as f:
        f.write(assistant_id)
    print(f"Created assistant: {assistant_id}")
    return assistant_id


def upload_file(filepath: str, assistant_id: str):
    filename = os.path.basename(filepath)
    ext = os.path.splitext(filename)[1].lower()

    if ext not in SUPPORTED_EXTENSIONS:
        print(f"SKIP {filename} — unsupported type {ext}")
        return

    print(f"Uploading {filename}...")
    with open(filepath, "rb") as f:
        response = httpx.post(
            f"{BASE_URL}/assistants/{assistant_id}/documents",
            headers=HEADERS,
            files={"file": (filename, f)},
            timeout=120,
        )

    if response.status_code == 200:
        doc = response.json()
        print(f"  OK — document_id: {doc.get('document_id')} status: {doc.get('status')}")
    else:
        print(f"  FAIL {response.status_code}: {response.text}")


def main():
    assistant_id = get_or_create_assistant()

    files = [
        os.path.join(DATA_PATH, f)
        for f in os.listdir(DATA_PATH)
        if os.path.isfile(os.path.join(DATA_PATH, f))
    ]

    if not files:
        print(f"No files found in {DATA_PATH}/")
        return

    print(f"\nFound {len(files)} file(s) in {DATA_PATH}/\n")
    for filepath in files:
        upload_file(filepath, assistant_id)

    print("\nDone. Check app.backboard.io to confirm indexing status.")


if __name__ == "__main__":
    main()





