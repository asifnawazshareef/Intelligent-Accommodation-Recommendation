"""Small test client for a running API (uvicorn app:app --port 8000)."""

import requests

API_URL = "http://localhost:8000/predict"

samples = [
    "room was bad and WIFI internet was good.",
    "room was bad but WIFI internet was good.",
    "The staff were kind and the bed was filthy.",
    "The hotel was not only clean but also comfortable.",
    "The room had two chairs.",
    "Good Wi-Fi helped a lot.",
    "Good Wi-Fi would help a lot.",
    "The room was clean and the staff was very helpful.",
    "The bathroom was dirty and the wifi was terrible.",
    "The hotel is located near the city center.",
    "It's not too much good service.",
    "Everything was perfect except the wifi.",
]

for text in samples:
    response = requests.post(API_URL, json={"review": text}, timeout=20)
    data = response.json()
    print("Review:", text)
    print("Sentiment:", data.get("sentiment"), "| Confidence:", data.get("confidence"))
    print("Aspects:", ", ".join(f"{a['aspect']}={a['sentiment']}" for a in data.get("aspectInsights", [])))
    print("Summary:", data.get("summary"))
    for clause in data.get("sentenceResults", []):
        print(f"   - {clause['text']!r}: {clause['sentiment']} ({clause['method']})")
    print("-" * 80)
