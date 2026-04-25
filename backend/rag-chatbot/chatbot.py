from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from openai import OpenAI
import httpx
from langchain_chroma import Chroma
import gradio as gr
import requests
import json
import os
import re

from dotenv import load_dotenv
load_dotenv()

DATA_PATH = r"data"
CHROMA_PATH = r"chroma_db"

embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

vector_store = Chroma(
    collection_name="soil_data_collection",
    embedding_function=embeddings_model,
    persist_directory=CHROMA_PATH, 
)

num_results = 5
retriever = vector_store.as_retriever(search_kwargs={'k': num_results})

def strip_thinking(text):
    # Remove <think>...</think> blocks including everything inside
    if "</think>" in text:
        return text.split("</think>", 1)[1].strip()
    # If we're still inside a think block, return nothing yet
    if "<think>" in text:
        return ""
    return text.strip()

def call_k2(messages, stream=True):
    response = requests.post(
        "https://api.k2think.ai/v1/chat/completions",
        headers={
            "Authorization": "Bearer IFM-aNWQ0TPF3Rsamlkv",
            "Content-Type": "application/json",
        },
        json={
            "model": "MBZUAI-IFM/K2-Think-v2",
            "messages": messages,
            "stream": stream,
        },
        stream=stream,
    )
    return response

def stream_response(message, history):
    docs = retriever.invoke(message)
    knowledge = "\n\n".join(doc.page_content for doc in docs)

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert agricultural advisor. Answer using ONLY "
                "the sensor data provided. Give concrete, actionable, and concise advice. "
                "Please give answers within 500 characters, and keep it condensed and easy to read so that a 17 year old can understand it."
                "If the data is insufficient, say so clearly, but make educated guesses based on the available data as well as outside available knowledge."
            ),
        }
    ]
    for human, assistant in history:
        messages.append({"role": "user", "content": human})
        messages.append({"role": "assistant", "content": assistant})

    messages.append({
        "role": "user",
        "content": f"Question: {message}\n\n--- Sensor data ---\n{knowledge}\n---",
    })

    response = call_k2(messages, stream=True)

    partial_message = ""
    for line in response.iter_lines():
        if line:
            line = line.decode("utf-8")
            if line.startswith("data: "):
                line = line[6:]
            if line == "[DONE]":
                break
            try:
                chunk = json.loads(line)
                delta = chunk["choices"][0]["delta"].get("content", "")
                if delta:
                    partial_message += delta
            except json.JSONDecodeError:
                continue

    yield strip_thinking(partial_message)

chatbot = gr.ChatInterface(
    stream_response,
    title="Soil Intelligence Advisor (K2-Think-V2)",
    description="Ask about your farm's soil health, crop planning, or interpret sensor readings.",
    textbox=gr.Textbox(
        placeholder="e.g. Is my soil ready to plant guava next season?",
        container=False,
        autoscroll=True,
        scale=7,
    ),
    examples=[
        "Which zones have the lowest soil moisture this week?",
        "Is the nitrogen level healthy for my current crops?",
        "Should I plant guava in the north section next spring?",
        "What does a soil temperature of 28°C mean for root health?",
    ],
)

chatbot.launch()