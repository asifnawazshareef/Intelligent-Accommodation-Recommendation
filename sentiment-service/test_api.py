"""Small test client for local API testing."""

import requests

API_URL = "http://localhost:8000/predict"

samples = [
    "The room was clean and the staff was very helpful.",
    "The bathroom was dirty and the wifi was terrible.",
    "The hotel is located near the city center.",
    "The room was clean. The staff was rude and the internet was poor.",
    "It's not too much good service.",
    "The service was not good at all.",
    "Not so good wifi connection.",
    "Staff was not helpful and room was dirty.",
]

for text in samples:
    response = requests.post(API_URL, json={"review": text}, timeout=20)
    data = response.json()
    print("Review:", text)
    print("Sentiment:", data.get("sentiment"), "| Confidence:", data.get("confidence"))
    print("Summary:", data.get("summary"))
    print("-" * 80)
