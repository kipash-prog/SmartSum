import os
import requests

API_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
HEADERS = {"Authorization": f"Bearer {os.getenv('HF_API_KEY')}"}

def summarize_with_huggingface(text):
    response = requests.post(API_URL, headers=HEADERS, json={"inputs": text})
    if response.status_code == 200:
        summary = response.json()[0]['summary_text']
        return summary
    else:
        raise Exception(f"Hugging Face API Error: {response.status_code} - {response.text}")
