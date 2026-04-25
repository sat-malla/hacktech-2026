from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai.embeddings import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from uuid import uuid4
import pandas as pd
import os

from dotenv import load_dotenv
load_dotenv()

DATA_PATH = r"data"
CHROMA_PATH = r"chroma_db"

embeddings_model = OpenAIEmbeddings(model="text-embedding-3-large")

vector_store = Chroma(
    collection_name="soil_data_collection",
    embedding_function=embeddings_model,
    persist_directory=CHROMA_PATH,
)

csv_file = os.path.join(DATA_PATH, "soil_plant_data.csv")
df = pd.read_csv(csv_file)

# Convert CSV rows to LangChain documents
raw_documents = []
for index, row in df.iterrows():
    # Create a descriptive text content for each row
    content = f"""
    Date: {row['date']}
    Plant Species: {row['plant_species']}
    Soil Moisture: {row['soil_moisture']}%
    Nitrogen Concentration: {row['nitrogen_concentration']} mg/kg
    Humidity: {row['humidity']}%
    Soil Temperature: {row['soil_temperature']}°C
    Air Temperature: {row['air_temperature']}°C
    """
    
    metadata = {
        "date": row['date'],
        "plant_species": row['plant_species'],
        "soil_moisture": row['soil_moisture'],
        "nitrogen_concentration": row['nitrogen_concentration'],
        "humidity": row['humidity'],
        "soil_temperature": row['soil_temperature'],
        "air_temperature": row['air_temperature']
    }
    
    doc = Document(page_content=content, metadata=metadata)
    raw_documents.append(doc)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=100,
    length_function=len,
    is_separator_regex=False,
)

chunks = text_splitter.split_documents(raw_documents)

uuids = [str(uuid4()) for _ in range(len(chunks))]

vector_store.add_documents(documents=chunks, ids=uuids)

print(f"Successfully loaded {len(raw_documents)} records and created {len(chunks)} chunks in the vector store.")